"""Regression guard for the prod hardening claims that nothing else can check.

Three related things live here, because each is a claim about production that
only holds if something asserts it:

* **DW-4** — prod.py's HTTPS/HSTS settings and the Railway healthcheck
  exemption. Nothing else in the suite imports ``config.settings.prod``
  directly: pytest runs under ``config.settings.test`` locally, or
  ``config.settings.dev`` in CI (``DJANGO_SETTINGS_MODULE`` in the CI workflow
  env overrides the ``pyproject.toml`` default; see ``pyproject.toml``'s comment
  on that override), so this is the only test that would catch a
  missing/broken hardening setting or an exemption regex that stops matching.
* **DW-23** — the two ``check --deploy`` steps in ``.github/workflows/ci.yml``.
  That is why a test about settings parses a workflow file (and why ``yaml`` is
  imported here): the gates are declared in YAML, so YAML is the only place
  their regression is visible.
* **DW-22** — the CORS-preflight carve-out from those HTTPS/HSTS settings, which
  is an emergent property of ``MIDDLEWARE`` ordering plus a ``corsheaders``
  signal registry rather than of any single setting.
* **DW-31** — the three ``SIMPLE_JWT`` knobs the 401 indistinguishability rests
  on, resolved against the *prod* module. ``core/tests/test_authentication.py``
  pins them too, but against whichever settings module pytest loaded, so a
  prod-only ``SIMPLE_JWT`` override would slip past it — the same env-divergence
  blind spot as the DW-4 bullet above.
"""

import importlib
import re
import tomllib
from pathlib import Path

import yaml
from corsheaders.signals import check_request_enabled
from django.conf import settings
from django.test import Client, override_settings
from django.urls import reverse

_CORS_MIDDLEWARE = "corsheaders.middleware.CorsMiddleware"
_SECURITY_MIDDLEWARE = "django.middleware.security.SecurityMiddleware"

_CI_WORKFLOW = Path(__file__).resolve().parents[3] / ".github" / "workflows" / "ci.yml"
# The job the prod deploy-check gates live in. Named so a rename produces an
# explanatory failure instead of a bare KeyError.
_DEPLOY_CHECK_JOB = "backend"
# Presence of a tag filter, in any spelling argparse accepts. Django's check
# command registers ``("--tag", "-t")``, and a short option takes its value glued
# on (`-tsecurity`) just as readily as separated (`-t security`) -- so a presence
# test must NOT require a separator. Measured 2026-08-04: it did, and `-tsecurity`
# on the untagged step reopened the DW-23 gap with this test still green. The
# lookbehind keeps `-t` from matching inside a longer flag (`--traceback`).
_TAG_FLAG = r"(?<![\w-])(?:--tag|-t)"
# The same flag carrying the value `security`: the long form needs a separator,
# the short form does not. The optional quote and `\s*` are there so `--tag
# "security"` / `--tag  security` -- both valid shell -- do not read as "the flag
# is gone", which would blame the wrong step in the failure message.
_TAG_SECURITY = r"(?<![\w-])(?:--tag[= ]\s*|-t[= ]?\s*)[\"']?security\b"
# Shell constructs that discard a non-zero exit, so the step runs but cannot fail
# the job. GitHub Actions runs `run:` under `bash -e` without `pipefail`, so a
# pipe masks the failure too. (`||` needs no alternative of its own: `\|` already
# matches its first character.)
_EXIT_SUPPRESSORS = re.compile(r"\||;\s*(?:exit\s+0|true|:)\s*$")
# `errexit` turned off anywhere in a `run:` block: unlike the suppressors above,
# this neuters a command from a DIFFERENT line than the command itself.
_DISABLES_ERREXIT = re.compile(r"(?m)^\s*set\s+(?:\+e\b|\+o\s+errexit\b)")
# A `\`-continuation glues the next line onto this command; without joining them
# first, a `|| true` parked on the continuation line lands in a separate "line"
# and the suppressor check never sees it.
_LINE_CONTINUATION = re.compile(r"\\[ \t]*\n[ \t]*")
# Shell `#` comments. YAML strips these from a plain scalar but NOT from inside a
# `run: |` block scalar, so without this a commented-out command in a block still
# counted as a live gate -- the very "a commented-out line still matches" failure
# this test switched from grepping to parsing in order to avoid.
_SHELL_COMMENT = re.compile(r"(?m)(?<!\S)#.*$")
# `if:` expressions that change WHEN a step runs without stopping it from gating:
# `success()` is the default, and `always()`/`!cancelled()` only add runs. Reporting
# these as neutered would red the build over a benign edit, with a message claiming
# the step "cannot gate" when it still can.
_HARMLESS_IF = frozenset({"success()", "always()", "!cancelled()"})


def _cors_middleware_precedes_security(middleware, source):
    """Whether ``CorsMiddleware`` runs before ``SecurityMiddleware`` in a list."""
    assert _CORS_MIDDLEWARE in middleware, (
        f"{source}: CorsMiddleware is no longer installed, so the CORS-preflight "
        "carve-out documented in prod.py does not exist anymore -- drop that clause "
        "from prod.py's comment along with this test"
    )
    assert _SECURITY_MIDDLEWARE in middleware, (
        f"{source}: SecurityMiddleware is no longer installed, so the redirect/HSTS "
        "this carve-out is a carve-out FROM does not exist anymore -- prod.py's "
        "SECURE_SSL_REDIRECT/SECURE_HSTS_* settings are now inert and the whole "
        "DW-4 hardening needs revisiting, not just this test"
    )
    return middleware.index(_CORS_MIDDLEWARE) < middleware.index(_SECURITY_MIDDLEWARE)


def _deploy_check_invocations(run_block):
    """The individual prod ``check --deploy`` invocations inside one ``run:``.

    A ``run: |`` block holds several commands, so it cannot be treated as one
    invocation: scanning the whole block as a single string would attribute one
    command's ``--fail-level`` to another (e.g. reading step 2's ``ERROR`` as
    step 1's level after someone merges the two steps into one block).

    The block is normalized before splitting because both halves of that
    normalization were holes measured on 2026-08-04, each leaving this test green
    with a gate that could not fail: a ``\\``-continuation split one command into
    two "lines", hiding a ``|| true`` parked on the second; and a commented-out
    command inside a ``run: |`` block was counted as live.

    ``;`` splits only when what follows is itself a deploy check, so a merge gets
    reported as a merge while ``; exit 0`` stays attached to the command it
    silences.
    """
    normalized = _SHELL_COMMENT.sub("", _LINE_CONTINUATION.sub(" ", run_block))
    return [
        candidate.strip()
        for candidate in re.split(r"\n|&&|;(?=[^;]*check --deploy)", normalized)
        if "check --deploy" in candidate and "config.settings.prod" in candidate
    ]


def _shell_neutering_reason(invocation, run_block):
    """Why the shell would swallow this invocation's exit code, or ``None``.

    ``if:``/``continue-on-error:`` are YAML keys a parser can see; ``|| true``,
    ``| tee`` and ``; exit 0`` are shell-level suppressions *inside* ``run:``
    that leave the gate looking green while its exit code is thrown away.

    ``set +e`` is matched against the whole block, not the invocation, because it
    disarms the command from another line entirely -- measured 2026-08-04, a
    ``set +e`` above step 1's command left this test green with the DW-4/DW-5 gate
    unable to fail. Any ``set +e`` in the block disqualifies it, even one later
    re-armed with ``set -e``: erring toward a false alarm a human reads beats a
    false all-clear nobody sees.
    """
    if _DISABLES_ERREXIT.search(run_block):
        return "its `run:` block turns off errexit (`set +e`), so a non-zero exit is ignored"
    if _EXIT_SUPPRESSORS.search(invocation):
        return "its exit code is discarded by the shell"
    return None


def _effective_fail_level(invocation):
    """The ``--fail-level`` argparse would honor in ONE invocation: the LAST one.

    A plain ``"--fail-level ERROR" in command`` substring test would accept a
    command carrying both ``--fail-level ERROR`` and ``--fail-level WARNING``
    while only the trailing one takes effect. ``None`` means the flag is absent.

    Quotes and extra spaces are tolerated: ``--fail-level="WARNING"`` is valid
    shell, and reading it as absent would report a *correct* step as regressed and
    name a level the command never said.
    """
    levels = re.findall(r"--fail-level[= ]\s*[\"']?(\w+)", invocation)
    return levels[-1] if levels else None


def _describe_fail_level(level):
    """Render an effective ``--fail-level`` for a failure message.

    Absent is not the same as looser: Django declares ``--fail-level`` with
    ``default="ERROR"``, so a message that reports a missing flag by naming a
    level would be describing something the command never said.
    """
    return "absent (Django then defaults to ERROR)" if level is None else repr(level)


def _security_middleware_settings():
    """SecurityMiddleware-read settings, pulled from the real ``prod`` module.

    Sourced from ``config.settings.prod`` (not hardcoded) so the HTTP-level
    tests below stay coupled to whatever prod.py actually sets — a future edit
    to ``SECURE_REDIRECT_EXEMPT``/``SECURE_SSL_REDIRECT``/``SECURE_PROXY_SSL_HEADER``
    would break these tests instead of silently escaping coverage.
    """
    prod_settings = importlib.import_module("config.settings.prod")
    return {
        "SECURE_SSL_REDIRECT": prod_settings.SECURE_SSL_REDIRECT,
        "SECURE_REDIRECT_EXEMPT": prod_settings.SECURE_REDIRECT_EXEMPT,
        "SECURE_HSTS_SECONDS": prod_settings.SECURE_HSTS_SECONDS,
        "SECURE_HSTS_INCLUDE_SUBDOMAINS": prod_settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
        "SECURE_HSTS_PRELOAD": prod_settings.SECURE_HSTS_PRELOAD,
        # Pre-existing in prod.py (not part of DW-4), but SecurityMiddleware
        # needs it active to recognize HTTP_X_FORWARDED_PROTO as "secure" —
        # without it the trusted-proxy simulation below wouldn't be honest.
        "SECURE_PROXY_SSL_HEADER": prod_settings.SECURE_PROXY_SSL_HEADER,
    }


def test_prod_settings_https_and_hsts_hardening():
    prod_settings = importlib.import_module("config.settings.prod")

    assert prod_settings.SECURE_SSL_REDIRECT is True
    assert prod_settings.SECURE_HSTS_SECONDS == 31536000
    assert prod_settings.SECURE_HSTS_INCLUDE_SUBDOMAINS is True
    assert prod_settings.SECURE_HSTS_PRELOAD is True

    assert prod_settings.SECURE_REDIRECT_EXEMPT == [r"^api/health/$"]
    exempt_pattern = prod_settings.SECURE_REDIRECT_EXEMPT[0]
    assert re.search(exempt_pattern, reverse("health").lstrip("/"))


def test_exempt_pattern_is_anchored_not_a_prefix_match():
    """`^...$` must anchor exactly — a loosened regex (e.g. dropping the `$`)
    would start exempting unrelated paths like ``api/health/extra`` from the
    redirect, silently widening what bypasses HTTPS enforcement.
    """
    prod_settings = importlib.import_module("config.settings.prod")
    exempt_pattern = prod_settings.SECURE_REDIRECT_EXEMPT[0]

    near_miss = reverse("health").lstrip("/") + "extra"
    assert re.search(exempt_pattern, near_miss) is None
    assert re.search(exempt_pattern, "api/healthcheck/") is None


def test_healthcheck_path_is_exempt_from_ssl_redirect_under_prod_hardening():
    """Railway's healthcheck hits the container without X-Forwarded-Proto.

    SecurityMiddleware reads its settings once, in ``__init__`` — so the
    override only takes effect for a ``Client`` built (and used) *inside* the
    ``override_settings`` block, which is why one is constructed fresh here
    instead of reusing a fixture built under the plain test settings.
    """
    with override_settings(**_security_middleware_settings()):
        response = Client().get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_other_paths_redirect_to_https_under_prod_hardening():
    """Confirms the exemption is narrow: everything else still gets a 301
    to the exact same host and path — not just some https:// URL.

    ``/api/accounts/`` is an arbitrary non-exempt path, not a route this test
    depends on resolving: ``SecurityMiddleware``'s redirect fires before URL
    resolution, so this would pass the same way against any path outside
    ``SECURE_REDIRECT_EXEMPT``.
    """
    with override_settings(**_security_middleware_settings()):
        response = Client().get("/api/accounts/")

    assert response.status_code == 301
    assert response.headers["Location"] == "https://testserver/api/accounts/"


def test_secure_request_via_trusted_proxy_is_not_redirected_and_gets_hsts_header():
    """Simulates Railway's edge (unlike its internal healthcheck, the edge DOES
    forward X-Forwarded-Proto). SECURE_PROXY_SSL_HEADER — already set in
    prod.py — is what makes Django treat this request as secure: no redirect,
    and the HSTS header Django only emits for secure requests is present.
    """
    with override_settings(**_security_middleware_settings()):
        response = Client().get("/api/accounts/", HTTP_X_FORWARDED_PROTO="https")

    assert response.status_code != 301
    assert "Location" not in response.headers
    assert (
        response.headers["Strict-Transport-Security"]
        == "max-age=31536000; includeSubDomains; preload"
    )


def test_redirect_exempt_pattern_matches_railway_healthcheck_path():
    """`railway.toml`'s `healthcheckPath` and prod.py's `SECURE_REDIRECT_EXEMPT`
    are two independent, hand-maintained strings with no shared source of
    truth. If someone changes one without the other, Railway's healthcheck
    would start getting redirected (301) instead of 200, and the platform
    would mark the release unhealthy and block rollout — this guards that
    they stay in sync.
    """
    prod_settings = importlib.import_module("config.settings.prod")
    railway_toml = Path(__file__).resolve().parent.parent.parent / "railway.toml"
    healthcheck_path = tomllib.loads(railway_toml.read_text())["deploy"]["healthcheckPath"]

    exempt_pattern = prod_settings.SECURE_REDIRECT_EXEMPT[0]
    assert re.search(exempt_pattern, healthcheck_path.lstrip("/"))


def test_ci_prod_deploy_check_keeps_security_fail_level_gate():
    """ci.yml must keep BOTH prod deploy-check steps, each with its own flags.

    They split the deploy checks registered under ``config.settings.prod``
    across two failure levels, and neither half can be dropped:

    * step 1, ``--tag security --fail-level WARNING``, runs the security-tagged
      checks (18 of the 21 deploy checks, as of 2026-08-04) and is what turns
      `security.W004`/`W008` from harmless warnings (exit 0) into a real CI
      failure -- see Review Triage Log, 2026-07-31.
    * step 2 has no tag filter, so it runs *every* registered check; what it
      adds over step 1 are the 3 deploy checks outside the `security` tag
      (DW-23). At ``--fail-level ERROR`` only the ones that can emit an Error
      actually gate -- see the comment block above both steps in ci.yml for
      that residual.

    Collapsing them into one step breaks either way: adding ``--tag security``
    to step 2 reopens the DW-23 gap, and running it at ``WARNING`` fails CI on
    the pre-existing `drf_spectacular.W001` warnings. A future edit that quietly
    drops a flag, disables a step or deletes one outright would revert these
    gates to no-ops, with nothing else in the suite that would notice.

    The workflow is parsed, not grepped, because a raw text scan cannot tell a
    live gate from a dead one: a commented-out ``run:`` line still matches it,
    and ``if:``/``continue-on-error: true`` are invisible to it. Parsing is not
    enough on its own either, so this also rejects gates neutered a level up
    (``if:``/``continue-on-error:`` on the *job*), gates whose exit code is
    swallowed in the shell (``|| true``, ``| tee``, ``; exit 0``, ``set +e``
    anywhere in the block), gates commented out *inside* a ``run: |`` block (YAML
    only strips ``#`` from plain scalars, not from block scalars), and gates that
    drifted into some other job. Flags are matched in every spelling argparse
    accepts -- ``-t`` is Django's short form for ``--tag`` and takes its value
    glued on, so requiring a separator let ``-tsecurity`` on step 2 reopen the
    DW-23 gap while this test stayed green.

    Every one of those forms is here because it was *measured* passing this test
    on 2026-08-04, not anticipated: the guard is only worth what it has been shown
    to catch, and each round of mutation found another shape the previous round's
    regex missed.
    """
    assert _CI_WORKFLOW.exists(), (
        f"{_CI_WORKFLOW} does not exist. Both prod deploy-check gates are declared "
        "there and nothing else in the suite asserts them -- if the workflow moved, "
        "point _CI_WORKFLOW at its new path; do not delete this test."
    )
    workflow = yaml.safe_load(_CI_WORKFLOW.read_text()) or {}
    jobs = workflow.get("jobs")
    assert isinstance(jobs, dict), (
        f"{_CI_WORKFLOW.name} has no top-level `jobs:` mapping (got "
        f"{type(jobs).__name__}), so the prod deploy-check gates cannot be located at "
        "all. Either the workflow is malformed or its structure changed."
    )

    assert _DEPLOY_CHECK_JOB in jobs, (
        f"ci.yml has no `{_DEPLOY_CHECK_JOB}` job anymore (jobs: {sorted(jobs)}). The "
        "prod deploy-check gates were declared there -- if the job was renamed, point "
        "_DEPLOY_CHECK_JOB at its new id; do not delete this test."
    )

    # Every job is walked, not just `backend`: the raw-text scan this replaced
    # covered the whole file, so restricting the search to one job would quietly
    # stop noticing a second, conflicting deploy-check step elsewhere.
    live = []
    neutered = []
    merged_steps = []
    for job_id, job in jobs.items():
        job_reasons = []
        if str(job.get("if", "")).strip() not in _HARMLESS_IF | {""}:
            job_reasons.append(f"job `if: {job['if']}`")
        if job.get("continue-on-error"):
            job_reasons.append("job `continue-on-error: true`")
        for step in job.get("steps") or []:
            run_block = step.get("run") or ""
            invocations = _deploy_check_invocations(run_block)
            if len(invocations) > 1:
                merged_steps.append(f"{job_id} / {step.get('name', '<unnamed>')}")
            for invocation in invocations:
                reasons = list(job_reasons)
                if str(step.get("if", "")).strip() not in _HARMLESS_IF | {""}:
                    # Conditional: may be skipped at runtime, so it cannot be
                    # counted on.
                    reasons.append(f"step `if: {step['if']}`")
                if step.get("continue-on-error"):
                    # Runs, but its exit code cannot fail the job.
                    reasons.append("step `continue-on-error: true`")
                shell_reason = _shell_neutering_reason(invocation, run_block)
                if shell_reason:
                    reasons.append(shell_reason)
                if reasons:
                    name = step.get("name", "<unnamed>")
                    neutered.append(f"{job_id} / {name} ({', '.join(reasons)})")
                else:
                    live.append((job_id, invocation))

    neutered_note = (
        ""
        if not neutered
        else " NOTE: these prod deploy-check steps exist but cannot gate the build, "
        f"so they were not counted: {neutered}."
    )

    misplaced = [f"{job_id}: {c}" for job_id, c in live if job_id != _DEPLOY_CHECK_JOB]
    assert not misplaced, (
        "prod deploy-check steps found outside the "
        f"`{_DEPLOY_CHECK_JOB}` job: {misplaced}. They only carry the env the checks "
        "need (SECRET_KEY/ALLOWED_HOSTS/DATABASE_URL) inside that job, and a second "
        "copy elsewhere means the two can disagree about which flags gate what."
    )
    live_commands = [c for job_id, c in live if job_id == _DEPLOY_CHECK_JOB]

    # Asserted before the per-step flag checks below, so a merge reports itself as
    # a merge. Both commands do still run under `bash -e`, which is exactly why
    # this needs its own assertion: nothing about the flags looks wrong afterwards.
    assert not merged_steps, (
        f"the two prod deploy-check commands were merged into one step: {merged_steps}. "
        "They must stay separate steps -- ci.yml's comment block numbers them 1) and "
        "2) and the header comment names both step titles, and only separate steps "
        "report separately in the Actions UI, so a red build says which half of the "
        "split failed instead of just 'deploy checks'."
    )

    tagged = [c for c in live_commands if re.search(_TAG_SECURITY, c)]
    untagged = [c for c in live_commands if not re.search(_TAG_FLAG, c)]

    # Each side is asserted separately (rather than only checking the total)
    # so the failure message names *which* of the two steps regressed.
    assert len(tagged) == 1, (
        "STEP 1 (DW-4/DW-5, security-tagged) regressed: expected exactly one enabled "
        "`check --deploy ... --tag security ... config.settings.prod` step in ci.yml, "
        f"found {tagged}. Either that step lost `--tag security`/was deleted/was "
        "disabled, or it dropped `--settings=config.settings.prod` (only invocations "
        "carrying that flag are counted here -- without it the checks run under "
        "config.settings.dev, which is the exact regression DW-5 exists to prevent), "
        "or the untagged step 2 gained a `--tag`/`-t` filter (which reopens the DW-23 "
        f"gap).{neutered_note}"
    )
    step1_level = _effective_fail_level(tagged[0])
    assert step1_level == "WARNING", (
        "STEP 1 (DW-4/DW-5, security-tagged) regressed: its effective `--fail-level` "
        f"is {_describe_fail_level(step1_level)}, not 'WARNING' -- at ERROR or looser "
        "it exits 0 on security.W004/W008 and stops guarding prod.py's HTTPS/HSTS "
        f"hardening. Got: {tagged[0]}"
    )

    assert len(untagged) == 1, (
        "STEP 2 (DW-23, no tag filter) regressed: expected exactly one enabled "
        "`check --deploy ... config.settings.prod` step with no `--tag`/`-t` filter in "
        f"ci.yml, found {untagged}. Either it gained a tag filter (in any spelling, "
        "including `-tsecurity` glued together), lost `--settings=config.settings.prod`, "
        "was deleted, or was commented out. Without it the deploy checks outside the "
        f"`security` tag are never run in CI at all.{neutered_note}"
    )
    step2_level = _effective_fail_level(untagged[0])
    assert step2_level == "ERROR", (
        "STEP 2 (DW-23, no tag filter) regressed: its effective `--fail-level` is "
        f"{_describe_fail_level(step2_level)}, not 'ERROR'. ERROR is pinned explicitly "
        "even though it is Django's default, because it is the command the DW-23 "
        "decision prescribed; at `WARNING` this step fails CI on the pre-existing "
        f"drf_spectacular.W001 warnings and ends up deleted instead. Got: {untagged[0]}"
    )

    assert live_commands.index(tagged[0]) < live_commands.index(untagged[0]), (
        "the two prod deploy-check steps are in the wrong order. ci.yml's comment "
        "block numbers them 1) security-tagged, 2) untagged, and the DW-23 decision "
        "put the untagged one immediately AFTER the existing step. Swapping them "
        "desynchronizes the comment from the file and changes which gate reports first "
        "under Actions' fail-fast."
    )

    assert len(live_commands) == 2, (
        "expected exactly two enabled `check --deploy ... config.settings.prod` steps "
        "in ci.yml (step 1 scoped to `--tag security`, step 2 with no tag filter), "
        f"found {len(live_commands)}: {live_commands}{neutered_note}"
    )


def test_cors_preflight_bypasses_ssl_redirect_and_hsts_under_prod_hardening():
    """Documents (and locks) the second carve-out named in prod.py's comment.

    ``CorsMiddleware`` sits ahead of ``SecurityMiddleware`` in ``MIDDLEWARE``
    and answers preflight OPTIONS itself, short-circuiting everything below it
    -- so preflight reaches neither the redirect nor HSTS, on any path. DW-22
    was born from prod.py claiming HTTPS was forced "for every request" with no
    test that would have contradicted it, so all four edges of the replacement
    claim are exercised here:

    * a preflight over plain HTTP is answered 200, with no ``Location`` and no
      ``Strict-Transport-Security``;
    * the same holds for a path that resolves to no view at all, which is what
      makes "on any path" (``CORS_URLS_REGEX`` defaulting to ``^.*$``) an
      assertion rather than an inference from the setting being unset;
    * a plain ``OPTIONS`` (no ``Access-Control-Request-Method``) is *not*
      preflight and still gets redirected -- the carve-out is narrower than
      "OPTIONS is exempt";
    * with a NON-EMPTY allowlist, an Origin outside it still gets the same 200
      bypass and merely loses its ``Access-Control-Allow-*`` headers -- the
      carve-out is wider than "allow-listed origins get through". The allowlist
      is overridden precisely because it is empty in every settings module the
      suite runs under, which would make this contrast vacuous.

    ``Client()`` is built inside each ``override_settings`` block for the reason
    spelled out in the healthcheck-exemption test above. ``MIDDLEWARE`` itself
    is deliberately NOT overridden to prod's: that would drag WhiteNoise and its
    manifest storage into the request path. The premises below bridge that gap
    by reading the ordering off ``config.settings.prod`` directly.
    """
    prod_settings = importlib.import_module("config.settings.prod")

    # Premises are read off config.settings.prod, not django.conf.settings: the
    # comment this test locks lives in prod.py, and prod.py is the one module
    # that rewrites MIDDLEWARE (it injects WhiteNoise). Asserting against the
    # ambient settings would leave a prod-only reorder -- or a prod-only
    # CORS_URLS_REGEX -- invisible to this test.
    assert _cors_middleware_precedes_security(prod_settings.MIDDLEWARE, "config.settings.prod"), (
        "under config.settings.prod, CorsMiddleware no longer precedes "
        "SecurityMiddleware, so preflight is NOT exempt from the redirect/HSTS "
        "anymore -- prod.py's comment now overstates the carve-out and must be "
        "rewritten together with this test"
    )
    assert _cors_middleware_precedes_security(settings.MIDDLEWARE, "the active test settings"), (
        "the settings this test runs under order CorsMiddleware after "
        "SecurityMiddleware, so the HTTP exercise below no longer reproduces prod's "
        "middleware order and proves nothing about prod"
    )
    assert not hasattr(prod_settings, "CORS_URLS_REGEX"), (
        "config.settings.prod now sets CORS_URLS_REGEX "
        f"({getattr(prod_settings, 'CORS_URLS_REGEX', None)!r}), narrowing the "
        "preflight bypass to matching paths only. That is a legitimate tightening, "
        "not a forbidden one -- but prod.py's comment says the bypass applies on ANY "
        "path, so update that comment and the 'any path' case below to match the new "
        "regex"
    )
    assert not hasattr(settings, "CORS_URLS_REGEX"), (
        "the settings this test runs under now set CORS_URLS_REGEX "
        f"({getattr(settings, 'CORS_URLS_REGEX', None)!r}), so the 'any path' case "
        "below would be exercising THAT regex, not prod's default -- a failure there "
        "would point at prod.py, which is unchanged. Same two-sided check as the "
        "MIDDLEWARE premises above"
    )
    # has_listeners() rather than `.receivers`: the raw list keeps slots for
    # already-collected weak receivers, so reading it directly turns this premise
    # into a function of garbage-collection timing.
    assert not check_request_enabled.has_listeners(), (
        "a receiver is connected to corsheaders' check_request_enabled signal, so "
        "CorsMiddleware.is_enabled() can return True for reasons beyond "
        "CORS_URLS_REGEX. prod.py's comment claims the bypass is not filtered by "
        "Origin *because* only CORS_URLS_REGEX is consulted -- re-check that claim "
        "against the receiver. Signal registries are process-global, so an earlier "
        "test leaking a receiver is the likelier cause than a repo change"
    )

    prod_hardening = _security_middleware_settings()

    # Phase 1: the bypass and its preflight-vs-plain-OPTIONS edge, under the
    # empty allowlist the suite normally runs with.
    with override_settings(**prod_hardening):
        client = Client()
        preflight = client.options("/api/accounts/", HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST")
        unrouted_preflight = client.options(
            "/definitely/not/a/route/", HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST"
        )
        plain_options = client.options("/api/accounts/")

    # Phase 2: same hardening, but with a real allowlist, so "the bypass is not
    # filtered by Origin" becomes a contrast between two live branches instead
    # of a statement that holds trivially because nothing is ever allow-listed.
    allowed_origin = "http://good.example"
    foreign_origin = "http://evil.example"
    with override_settings(
        **prod_hardening,
        CORS_ALLOWED_ORIGINS=[allowed_origin],
        # Pinned, not inherited: either of these turning on elsewhere would make
        # foreign_origin allow-listed too, and the contrast below would go back to
        # being vacuous without any assertion noticing.
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGIN_REGEXES=[],
    ):
        client = Client()
        allowed_preflight = client.options(
            "/api/accounts/",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ORIGIN=allowed_origin,
        )
        foreign_preflight = client.options(
            "/api/accounts/",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ORIGIN=foreign_origin,
        )

    def allow_headers(response):
        return sorted(h for h in response.headers if h.lower().startswith("access-control-allow-"))

    assert preflight.status_code == 200, (
        "preflight over plain HTTP should be answered 200 by CorsMiddleware before "
        f"SecurityMiddleware can redirect it, got {preflight.status_code}"
    )
    assert "Location" not in preflight.headers, (
        "preflight got a redirect -- the carve-out documented in prod.py is gone: "
        f"Location={preflight.headers.get('Location')!r}"
    )
    assert "Strict-Transport-Security" not in preflight.headers, (
        "preflight reached the HSTS-emitting code, so it is no longer short-circuited "
        "by CorsMiddleware; prod.py's comment needs revisiting"
    )

    assert unrouted_preflight.status_code == 200, (
        "'on any path' failed: a preflight to a path that resolves to no view should "
        f"still be short-circuited 200 (CORS_URLS_REGEX defaults to `^.*$`), got "
        f"{unrouted_preflight.status_code}"
    )
    assert "Location" not in unrouted_preflight.headers, (
        "'on any path' failed: preflight to an unrouted path was redirected "
        f"(Location={unrouted_preflight.headers.get('Location')!r})"
    )
    assert "Strict-Transport-Security" not in unrouted_preflight.headers, (
        "'on any path' failed: preflight to an unrouted path picked up HSTS"
    )

    assert plain_options.status_code == 301, (
        "a plain OPTIONS (no Access-Control-Request-Method) is not preflight and must "
        f"still be redirected, got {plain_options.status_code} -- if this now passes "
        "through, the carve-out is wider than prod.py's comment claims"
    )
    assert plain_options.headers["Location"] == "https://testserver/api/accounts/", (
        f"plain OPTIONS redirected somewhere unexpected: {plain_options.headers['Location']!r}"
    )

    assert allowed_preflight.status_code == 200, (
        f"allow-listed preflight should be answered 200, got {allowed_preflight.status_code}"
    )
    assert allowed_preflight.headers.get("Access-Control-Allow-Origin") == allowed_origin, (
        "the allow-listed branch is not actually being exercised -- expected "
        f"Access-Control-Allow-Origin={allowed_origin!r}, got "
        f"{allowed_preflight.headers.get('Access-Control-Allow-Origin')!r}. Without "
        "this half, the foreign-origin assertion below proves nothing."
    )
    # The allow-listed side is asserted with the same triple as every other case,
    # so this phase contrasts two *bypasses* that differ only in their CORS
    # headers -- otherwise it could not tell "allow-listed origins also skip the
    # redirect" from "allow-listed origins get CORS headers".
    assert "Location" not in allowed_preflight.headers, (
        "allow-listed preflight was redirected, so the bypass now depends on Origin "
        f"after all: Location={allowed_preflight.headers.get('Location')!r}"
    )
    assert "Strict-Transport-Security" not in allowed_preflight.headers, (
        "allow-listed preflight picked up HSTS, so it reached SecurityMiddleware"
    )

    assert foreign_preflight.status_code == 200, (
        "a preflight from an Origin OUTSIDE a non-empty CORS_ALLOWED_ORIGINS must "
        "still get the 200 short-circuit (the bypass is not filtered by Origin), got "
        f"{foreign_preflight.status_code}"
    )
    assert "Location" not in foreign_preflight.headers, (
        "foreign-origin preflight was redirected, so the bypass HAS become "
        f"Origin-filtered: Location={foreign_preflight.headers.get('Location')!r}"
    )
    assert "Strict-Transport-Security" not in foreign_preflight.headers, (
        "foreign-origin preflight picked up HSTS, so it reached SecurityMiddleware"
    )
    assert allow_headers(foreign_preflight) == [], (
        "a non-allow-listed Origin must not receive Access-Control-Allow-* headers, "
        f"got {allow_headers(foreign_preflight)}"
    )
    assert allow_headers(allowed_preflight) != [], (
        "the same derived header set is applied to both sides so the contrast is not "
        "an artifact of how each was measured -- the allow-listed Origin came back "
        "with no Access-Control-Allow-* headers either, which means CORS is not "
        "answering here at all and the foreign-origin comparison above is vacuous"
    )


def test_prod_mantem_os_settings_de_jwt_de_que_a_indistinguibilidade_depende():
    """DW-31: os knobs de ``SIMPLE_JWT`` resolvidos pelo settings module de PRODUÇÃO.

    O colapso de "usuário apagado" e "usuário inativo" num 401 único
    (``core/authentication.py``) só significa algo enquanto três settings do
    simplejwt seguem nos defaults. ``core/tests/test_authentication.py`` pinça os
    três — mas contra ``simplejwt_settings.api_settings``, isto é, contra o settings
    module que o pytest carregou: ``config.settings.test`` local,
    ``config.settings.dev`` na CI. Nunca ``prod``.

    Hoje ``SIMPLE_JWT`` é declarado só em ``config/settings/base.py`` e todo
    ambiente o herda, então aqueles pins de fato valem. O buraco é divergência
    futura: um override só em ``prod.py`` — "invalidar tokens quando a senha muda"
    é um tweak plausível de hardening — passaria por eles verde. Este arquivo existe
    exatamente para essa classe de ponto cego (ver o docstring do módulo), e é aqui
    que o eixo de ambiente fica coberto.

    O que cada um custa se sair do default, em produção:

    * ``CHECK_USER_IS_ACTIVE=False`` — o ramo ``user_inactive`` deixa de ser
      levantado e um usuário desativado volta a receber **200** em toda rota
      autenticada. Não é canal lateral: é bypass de desativação.
    * ``CHECK_REVOKE_TOKEN=True`` — ``password_changed`` passa a ser alcançável, e
      só depois de o lookup achar a linha e ``is_active`` passar, logo divulgando
      existência de linha, sem entrar em ``_INDISTINGUISHABLE_CODES``.
    * ``USER_AUTHENTICATION_RULE`` fora do default — o refresh devolve 200 para
      desativado e 401 para apagado, reabrindo o eixo da DW-25 nessa superfície.

    Resolve pelos ``DEFAULTS`` do upstream, e não por literais: ``base.py`` não seta
    nenhum dos três, então a leitura tem de reproduzir o mesmo fallback que o
    simplejwt faria — e no dia em que o upstream mudar um default, isto fala.
    """
    from rest_framework_simplejwt.settings import DEFAULTS as SIMPLEJWT_DEFAULTS

    prod_settings = importlib.import_module("config.settings.prod")
    prod_simple_jwt = prod_settings.SIMPLE_JWT

    def resolvido(nome):
        return prod_simple_jwt.get(nome, SIMPLEJWT_DEFAULTS[nome])

    assert resolvido("CHECK_USER_IS_ACTIVE") is True, (
        "config.settings.prod resolve CHECK_USER_IS_ACTIVE fora do default True: em "
        "produção o ramo `user_inactive` do simplejwt deixa de ser levantado e um "
        "usuário desativado volta a receber 200 em toda rota autenticada. Ver o "
        "Never do intent da DW-31 e core/tests/test_authentication.py."
    )
    assert resolvido("CHECK_REVOKE_TOKEN") is False, (
        "config.settings.prod resolve CHECK_REVOKE_TOKEN fora do default False: em "
        "produção `password_changed` passa a ser alcançável e divulga existência de "
        "linha sem colapsar. Antes de ligar, decidir se ele entra em "
        "_INDISTINGUISHABLE_CODES (core/authentication.py)."
    )
    assert (
        resolvido("USER_AUTHENTICATION_RULE") == SIMPLEJWT_DEFAULTS["USER_AUTHENTICATION_RULE"]
    ), (
        "config.settings.prod resolve USER_AUTHENTICATION_RULE fora do default: é ele, "
        "e não CHECK_USER_IS_ACTIVE, que faz POST /api/accounts/token/refresh/ recusar "
        "um usuário desativado. Uma regra que aceite inativos devolve 200 no refresh do "
        "desativado e 401 no do apagado, reabrindo o eixo da DW-25 nessa superfície."
    )
