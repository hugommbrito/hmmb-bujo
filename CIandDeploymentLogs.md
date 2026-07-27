# Github CI
2026-07-03T02:15:00.4136730Z Current runner version: '2.335.1'
2026-07-03T02:15:00.4161022Z ##[group]Runner Image Provisioner
2026-07-03T02:15:00.4161858Z Hosted Compute Agent
2026-07-03T02:15:00.4162525Z Version: 20260624.560
2026-07-03T02:15:00.4163182Z Commit: 925d229a51159bc391ae97e54a2dd1fe20af789d
2026-07-03T02:15:00.4164221Z Build Date: 2026-06-24T18:26:47Z
2026-07-03T02:15:00.4164906Z Worker ID: {fd218953-7f48-4e6d-b5a5-ca4674f78a31}
2026-07-03T02:15:00.4165588Z Azure Region: northcentralus
2026-07-03T02:15:00.4166655Z ##[endgroup]
2026-07-03T02:15:00.4168150Z ##[group]Operating System
2026-07-03T02:15:00.4168860Z Ubuntu
2026-07-03T02:15:00.4169345Z 24.04.4
2026-07-03T02:15:00.4170207Z LTS
2026-07-03T02:15:00.4170770Z ##[endgroup]
2026-07-03T02:15:00.4171459Z ##[group]Runner Image
2026-07-03T02:15:00.4172048Z Image: ubuntu-24.04
2026-07-03T02:15:00.4172638Z Version: 20260628.225.1
2026-07-03T02:15:00.4173882Z Included Software: https://github.com/actions/runner-images/blob/ubuntu24/20260628.225/images/ubuntu/Ubuntu2404-Readme.md
2026-07-03T02:15:00.4175572Z Image Release: https://github.com/actions/runner-images/releases/tag/ubuntu24%2F20260628.225
2026-07-03T02:15:00.4176472Z ##[endgroup]
2026-07-03T02:15:00.4177739Z ##[group]GITHUB_TOKEN Permissions
2026-07-03T02:15:00.4180011Z Contents: read
2026-07-03T02:15:00.4180719Z Metadata: read
2026-07-03T02:15:00.4181308Z Packages: read
2026-07-03T02:15:00.4181898Z ##[endgroup]
2026-07-03T02:15:00.4183916Z Secret source: Actions
2026-07-03T02:15:00.4184929Z Prepare workflow directory
2026-07-03T02:15:00.4636905Z Prepare all required actions
2026-07-03T02:15:00.4676745Z Getting action download info
2026-07-03T02:15:00.7042409Z Download action repository 'actions/checkout@v4' (SHA:34e114876b0b11c390a56381ad16ebd13914f8d5)
2026-07-03T02:15:00.8076389Z Download action repository 'astral-sh/setup-uv@v6' (SHA:d0cc045d04ccac9d8b7881df0226f9e82c39688e)
2026-07-03T02:15:01.2834820Z Download action repository 'actions/setup-node@v4' (SHA:49933ea5288caeca8642d1e84afbd3f7d6820020)
2026-07-03T02:15:01.5021084Z Complete job name: Backend (ruff + pytest)
2026-07-03T02:15:01.5565468Z ##[group]Checking docker version
2026-07-03T02:15:01.5578590Z ##[command]/usr/bin/docker version --format '{{.Server.APIVersion}}'
2026-07-03T02:15:01.6499600Z '1.48'
2026-07-03T02:15:01.6512820Z Docker daemon API version: '1.48'
2026-07-03T02:15:01.6513655Z ##[command]/usr/bin/docker version --format '{{.Client.APIVersion}}'
2026-07-03T02:15:01.6671632Z '1.48'
2026-07-03T02:15:01.6683879Z Docker client API version: '1.48'
2026-07-03T02:15:01.6689000Z ##[endgroup]
2026-07-03T02:15:01.6692426Z ##[group]Clean up resources from previous jobs
2026-07-03T02:15:01.6698153Z ##[command]/usr/bin/docker ps --all --quiet --no-trunc --filter "label=dd00b7"
2026-07-03T02:15:01.6834248Z ##[command]/usr/bin/docker network prune --force --filter "label=dd00b7"
2026-07-03T02:15:01.6955592Z ##[endgroup]
2026-07-03T02:15:01.6956163Z ##[group]Create local container network
2026-07-03T02:15:01.6967191Z ##[command]/usr/bin/docker network create --label dd00b7 github_network_c333d36071fc4676a41f442fcd281473
2026-07-03T02:15:01.7493790Z ab7ad73402de86022fc7592474ec1d5c1d70456a359cec7aa420b8f98ff9dc2e
2026-07-03T02:15:01.7513339Z ##[endgroup]
2026-07-03T02:15:01.7538280Z ##[group]Starting postgres service container
2026-07-03T02:15:01.7560199Z ##[command]/usr/bin/docker pull postgres:16
2026-07-03T02:15:02.1717054Z 16: Pulling from library/postgres
2026-07-03T02:15:02.3081644Z e95a6c7ea7d4: Pulling fs layer
2026-07-03T02:15:02.3083924Z da037c8341f5: Pulling fs layer
2026-07-03T02:15:02.3085816Z 54771d3c89de: Pulling fs layer
2026-07-03T02:15:02.3087678Z 926efa22a589: Pulling fs layer
2026-07-03T02:15:02.3089661Z 7fc7d55cf27e: Pulling fs layer
2026-07-03T02:15:02.3091534Z 61c89bffdf6a: Pulling fs layer
2026-07-03T02:15:02.3092762Z 18b8094b0912: Pulling fs layer
2026-07-03T02:15:02.3094381Z b45131cbfacd: Pulling fs layer
2026-07-03T02:15:02.3096049Z b181572fe06f: Pulling fs layer
2026-07-03T02:15:02.3097561Z 9388bc0a8098: Pulling fs layer
2026-07-03T02:15:02.3099322Z 6c05417960f5: Pulling fs layer
2026-07-03T02:15:02.3100782Z 6b52d0175b81: Pulling fs layer
2026-07-03T02:15:02.3101761Z 71d757e66b8c: Pulling fs layer
2026-07-03T02:15:02.3102649Z 1241050b0b0f: Pulling fs layer
2026-07-03T02:15:02.3103822Z b45131cbfacd: Waiting
2026-07-03T02:15:02.3104893Z 6b52d0175b81: Waiting
2026-07-03T02:15:02.3106044Z 71d757e66b8c: Waiting
2026-07-03T02:15:02.3107660Z 1241050b0b0f: Waiting
2026-07-03T02:15:02.3109246Z b181572fe06f: Waiting
2026-07-03T02:15:02.3111001Z 9388bc0a8098: Waiting
2026-07-03T02:15:02.3112574Z 6c05417960f5: Waiting
2026-07-03T02:15:02.3114038Z 926efa22a589: Waiting
2026-07-03T02:15:02.3115208Z 7fc7d55cf27e: Waiting
2026-07-03T02:15:02.3116328Z 61c89bffdf6a: Waiting
2026-07-03T02:15:02.3117425Z 18b8094b0912: Waiting
2026-07-03T02:15:02.5972206Z da037c8341f5: Verifying Checksum
2026-07-03T02:15:02.5975544Z da037c8341f5: Download complete
2026-07-03T02:15:02.6315048Z 54771d3c89de: Verifying Checksum
2026-07-03T02:15:02.6318955Z 54771d3c89de: Download complete
2026-07-03T02:15:02.6913271Z 926efa22a589: Verifying Checksum
2026-07-03T02:15:02.6915115Z 926efa22a589: Download complete
2026-07-03T02:15:02.6968368Z e95a6c7ea7d4: Verifying Checksum
2026-07-03T02:15:02.6970762Z e95a6c7ea7d4: Download complete
2026-07-03T02:15:02.7486694Z 7fc7d55cf27e: Verifying Checksum
2026-07-03T02:15:02.7488757Z 7fc7d55cf27e: Download complete
2026-07-03T02:15:02.7699252Z 18b8094b0912: Verifying Checksum
2026-07-03T02:15:02.7703251Z 18b8094b0912: Download complete
2026-07-03T02:15:02.7898477Z 61c89bffdf6a: Verifying Checksum
2026-07-03T02:15:02.7900760Z 61c89bffdf6a: Download complete
2026-07-03T02:15:02.8306346Z b45131cbfacd: Verifying Checksum
2026-07-03T02:15:02.8311428Z b45131cbfacd: Download complete
2026-07-03T02:15:02.8591870Z 9388bc0a8098: Verifying Checksum
2026-07-03T02:15:02.8594195Z 9388bc0a8098: Download complete
2026-07-03T02:15:02.9062221Z 6c05417960f5: Verifying Checksum
2026-07-03T02:15:02.9064363Z 6c05417960f5: Download complete
2026-07-03T02:15:02.9347506Z 6b52d0175b81: Verifying Checksum
2026-07-03T02:15:02.9361760Z 6b52d0175b81: Download complete
2026-07-03T02:15:02.9820428Z 71d757e66b8c: Verifying Checksum
2026-07-03T02:15:02.9824811Z 71d757e66b8c: Download complete
2026-07-03T02:15:03.0113769Z 1241050b0b0f: Download complete
2026-07-03T02:15:03.2690189Z b181572fe06f: Verifying Checksum
2026-07-03T02:15:03.2709018Z b181572fe06f: Download complete
2026-07-03T02:15:03.9725347Z e95a6c7ea7d4: Pull complete
2026-07-03T02:15:04.4358960Z da037c8341f5: Pull complete
2026-07-03T02:15:04.6297037Z 54771d3c89de: Pull complete
2026-07-03T02:15:04.6728125Z 926efa22a589: Pull complete
2026-07-03T02:15:04.9830027Z 7fc7d55cf27e: Pull complete
2026-07-03T02:15:05.0764229Z 61c89bffdf6a: Pull complete
2026-07-03T02:15:05.0863273Z 18b8094b0912: Pull complete
2026-07-03T02:15:05.0979001Z b45131cbfacd: Pull complete
2026-07-03T02:15:08.1244965Z b181572fe06f: Pull complete
2026-07-03T02:15:08.1396873Z 9388bc0a8098: Pull complete
2026-07-03T02:15:08.1507233Z 6c05417960f5: Pull complete
2026-07-03T02:15:08.1622298Z 6b52d0175b81: Pull complete
2026-07-03T02:15:08.1735336Z 71d757e66b8c: Pull complete
2026-07-03T02:15:08.1836531Z 1241050b0b0f: Pull complete
2026-07-03T02:15:08.1878994Z Digest: sha256:fe03a7605299a34ddf5e4f285dff78c3d7190a576b3c6b46f2fcff69f4bffd54
2026-07-03T02:15:08.1897620Z Status: Downloaded newer image for postgres:16
2026-07-03T02:15:08.1904369Z docker.io/library/postgres:16
2026-07-03T02:15:08.1965387Z ##[command]/usr/bin/docker create --name d27a81e5c67f4cccb3dc700ff81b25b4_postgres16_0673a7 --label dd00b7 --network github_network_c333d36071fc4676a41f442fcd281473 --network-alias postgres -p 5432:5432 --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5 -e "POSTGRES_USER=postgres" -e "POSTGRES_PASSWORD=postgres" -e "POSTGRES_DB=hmmb_ci" -e GITHUB_ACTIONS=true -e CI=true postgres:16
2026-07-03T02:15:08.2229454Z e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:08.2250116Z ##[command]/usr/bin/docker start e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:08.5608112Z e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:08.5648921Z ##[command]/usr/bin/docker ps --all --filter id=e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e --filter status=running --no-trunc --format "{{.ID}} {{.Status}}"
2026-07-03T02:15:08.5791178Z e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e Up Less than a second (health: starting)
2026-07-03T02:15:08.5815093Z ##[command]/usr/bin/docker port e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:08.5948666Z 5432/tcp -> 0.0.0.0:5432
2026-07-03T02:15:08.5950631Z 5432/tcp -> [::]:5432
2026-07-03T02:15:08.5995076Z ##[endgroup]
2026-07-03T02:15:08.6003764Z ##[group]Waiting for all services to be ready
2026-07-03T02:15:08.6018521Z ##[command]/usr/bin/docker inspect --format="{{if .Config.Healthcheck}}{{print .State.Health.Status}}{{end}}" e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:08.6155133Z starting
2026-07-03T02:15:08.6178437Z postgres service is starting, waiting 2 seconds before checking again.
2026-07-03T02:15:10.6176146Z ##[command]/usr/bin/docker inspect --format="{{if .Config.Healthcheck}}{{print .State.Health.Status}}{{end}}" e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:10.6299569Z starting
2026-07-03T02:15:10.6312082Z postgres service is starting, waiting 4 seconds before checking again.
2026-07-03T02:15:14.7381217Z ##[command]/usr/bin/docker inspect --format="{{if .Config.Healthcheck}}{{print .State.Health.Status}}{{end}}" e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:14.7503525Z starting
2026-07-03T02:15:14.7515894Z postgres service is starting, waiting 7 seconds before checking again.
2026-07-03T02:15:21.9025277Z ##[command]/usr/bin/docker inspect --format="{{if .Config.Healthcheck}}{{print .State.Health.Status}}{{end}}" e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:21.9142757Z healthy
2026-07-03T02:15:21.9158653Z postgres service is healthy.
2026-07-03T02:15:21.9159497Z ##[endgroup]
2026-07-03T02:15:21.9505816Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-07-03T02:15:21.9513864Z ##[group]Run actions/checkout@v4
2026-07-03T02:15:21.9514292Z with:
2026-07-03T02:15:21.9514506Z   repository: hugommbrito/hmmb-bujo
2026-07-03T02:15:21.9517273Z   token: ***
2026-07-03T02:15:21.9517467Z   ssh-strict: true
2026-07-03T02:15:21.9517663Z   ssh-user: git
2026-07-03T02:15:21.9517860Z   persist-credentials: true
2026-07-03T02:15:21.9518088Z   clean: true
2026-07-03T02:15:21.9518287Z   sparse-checkout-cone-mode: true
2026-07-03T02:15:21.9518529Z   fetch-depth: 1
2026-07-03T02:15:21.9518731Z   fetch-tags: false
2026-07-03T02:15:21.9518921Z   show-progress: true
2026-07-03T02:15:21.9519122Z   lfs: false
2026-07-03T02:15:21.9519335Z   submodules: false
2026-07-03T02:15:21.9519532Z   set-safe-directory: true
2026-07-03T02:15:21.9520190Z env:
2026-07-03T02:15:21.9520406Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:21.9520741Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:21.9521055Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:21.9521503Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:21.9521769Z ##[endgroup]
2026-07-03T02:15:22.0478498Z Syncing repository: hugommbrito/hmmb-bujo
2026-07-03T02:15:22.0480117Z ##[group]Getting Git version info
2026-07-03T02:15:22.0480551Z Working directory is '/home/runner/work/hmmb-bujo/hmmb-bujo'
2026-07-03T02:15:22.0481110Z [command]/usr/bin/git version
2026-07-03T02:15:22.0547660Z git version 2.54.0
2026-07-03T02:15:22.0569581Z ##[endgroup]
2026-07-03T02:15:22.0583020Z Temporarily overriding HOME='/home/runner/work/_temp/f21f5da3-c046-4a20-a99b-0b4b7ac75495' before making global git config changes
2026-07-03T02:15:22.0584616Z Adding repository directory to the temporary git global config as a safe directory
2026-07-03T02:15:22.0589900Z [command]/usr/bin/git config --global --add safe.directory /home/runner/work/hmmb-bujo/hmmb-bujo
2026-07-03T02:15:22.0634012Z Deleting the contents of '/home/runner/work/hmmb-bujo/hmmb-bujo'
2026-07-03T02:15:22.0637713Z ##[group]Initializing the repository
2026-07-03T02:15:22.0642118Z [command]/usr/bin/git init /home/runner/work/hmmb-bujo/hmmb-bujo
2026-07-03T02:15:22.0745147Z hint: Using 'master' as the name for the initial branch. This default branch name
2026-07-03T02:15:22.0746073Z hint: will change to "main" in Git 3.0. To configure the initial branch name
2026-07-03T02:15:22.0746721Z hint: to use in all of your new repositories, which will suppress this warning,
2026-07-03T02:15:22.0747124Z hint: call:
2026-07-03T02:15:22.0747306Z hint:
2026-07-03T02:15:22.0747608Z hint: 	git config --global init.defaultBranch <name>
2026-07-03T02:15:22.0747935Z hint:
2026-07-03T02:15:22.0748244Z hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
2026-07-03T02:15:22.0748876Z hint: 'development'. The just-created branch can be renamed via this command:
2026-07-03T02:15:22.0749250Z hint:
2026-07-03T02:15:22.0749442Z hint: 	git branch -m <name>
2026-07-03T02:15:22.0750118Z hint:
2026-07-03T02:15:22.0750740Z hint: Disable this message with "git config set advice.defaultBranchName false"
2026-07-03T02:15:22.0752012Z Initialized empty Git repository in /home/runner/work/hmmb-bujo/hmmb-bujo/.git/
2026-07-03T02:15:22.0763192Z [command]/usr/bin/git remote add origin https://github.com/hugommbrito/hmmb-bujo
2026-07-03T02:15:22.0835296Z ##[endgroup]
2026-07-03T02:15:22.0835971Z ##[group]Disabling automatic garbage collection
2026-07-03T02:15:22.0840156Z [command]/usr/bin/git config --local gc.auto 0
2026-07-03T02:15:22.0868331Z ##[endgroup]
2026-07-03T02:15:22.0868794Z ##[group]Setting up auth
2026-07-03T02:15:22.0876556Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-07-03T02:15:22.0908101Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-07-03T02:15:22.1252583Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
2026-07-03T02:15:22.1282345Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
2026-07-03T02:15:22.1496591Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-07-03T02:15:22.1526749Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-07-03T02:15:22.1744757Z [command]/usr/bin/git config --local http.https://github.com/.extraheader AUTHORIZATION: basic ***
2026-07-03T02:15:22.1778171Z ##[endgroup]
2026-07-03T02:15:22.1778643Z ##[group]Fetching the repository
2026-07-03T02:15:22.1787498Z [command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin +2541277f06c1b7649be6049271f3856d582f3f39:refs/remotes/origin/main
2026-07-03T02:15:22.6099546Z From https://github.com/hugommbrito/hmmb-bujo
2026-07-03T02:15:22.6100578Z  * [new ref]         2541277f06c1b7649be6049271f3856d582f3f39 -> origin/main
2026-07-03T02:15:22.6131704Z ##[endgroup]
2026-07-03T02:15:22.6132298Z ##[group]Determining the checkout info
2026-07-03T02:15:22.6134030Z ##[endgroup]
2026-07-03T02:15:22.6139381Z [command]/usr/bin/git sparse-checkout disable
2026-07-03T02:15:22.6180777Z [command]/usr/bin/git config --local --unset-all extensions.worktreeConfig
2026-07-03T02:15:22.6205745Z ##[group]Checking out the ref
2026-07-03T02:15:22.6209936Z [command]/usr/bin/git checkout --progress --force -B main refs/remotes/origin/main
2026-07-03T02:15:22.7048832Z Switched to a new branch 'main'
2026-07-03T02:15:22.7051359Z branch 'main' set up to track 'origin/main'.
2026-07-03T02:15:22.7058175Z ##[endgroup]
2026-07-03T02:15:22.7108583Z [command]/usr/bin/git log -1 --format=%H
2026-07-03T02:15:22.7131001Z 2541277f06c1b7649be6049271f3856d582f3f39
2026-07-03T02:15:22.7353398Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-07-03T02:15:22.7355012Z ##[group]Run astral-sh/setup-uv@v6
2026-07-03T02:15:22.7355261Z with:
2026-07-03T02:15:22.7355449Z   enable-cache: true
2026-07-03T02:15:22.7355671Z   activate-environment: false
2026-07-03T02:15:22.7355977Z   working-directory: /home/runner/work/hmmb-bujo/hmmb-bujo
2026-07-03T02:15:22.7356335Z   server-url: https://github.com
2026-07-03T02:15:22.7359055Z   github-token: ***
2026-07-03T02:15:22.7359620Z   cache-dependency-glob: **/*requirements*.txt
**/*requirements*.in
**/*constraints*.txt
**/*constraints*.in
**/pyproject.toml
**/uv.lock
**/*.py.lock

2026-07-03T02:15:22.7360569Z   restore-cache: true
2026-07-03T02:15:22.7360811Z   save-cache: true
2026-07-03T02:15:22.7361006Z   prune-cache: true
2026-07-03T02:15:22.7361222Z   ignore-nothing-to-cache: false
2026-07-03T02:15:22.7361479Z   ignore-empty-workdir: false
2026-07-03T02:15:22.7361721Z   add-problem-matchers: true
2026-07-03T02:15:22.7361940Z env:
2026-07-03T02:15:22.7362146Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:22.7362472Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:22.7362774Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:22.7363168Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:22.7363423Z ##[endgroup]
2026-07-03T02:15:22.9141201Z (node:2668) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
2026-07-03T02:15:22.9142538Z (Use `node --trace-deprecation ...` to show where the warning was created)
2026-07-03T02:15:22.9294462Z Trying to find version for uv in: /home/runner/work/hmmb-bujo/hmmb-bujo/uv.toml
2026-07-03T02:15:22.9295941Z Could not find file: /home/runner/work/hmmb-bujo/hmmb-bujo/uv.toml
2026-07-03T02:15:22.9296669Z Trying to find version for uv in: /home/runner/work/hmmb-bujo/hmmb-bujo/pyproject.toml
2026-07-03T02:15:22.9297266Z Could not find file: /home/runner/work/hmmb-bujo/hmmb-bujo/pyproject.toml
2026-07-03T02:15:22.9297790Z Could not determine uv version from uv.toml or pyproject.toml. Falling back to latest.
2026-07-03T02:15:22.9298938Z Getting latest version from GitHub API...
2026-07-03T02:15:23.2170517Z manifest-file not provided, reading from local file.
2026-07-03T02:15:23.2225500Z manifest-file does not contain version 0.11.26, arch x86_64, platform unknown-linux-gnu. Falling back to GitHub releases.
2026-07-03T02:15:23.2227116Z Downloading uv from "https://github.com/astral-sh/uv/releases/download/0.11.26/uv-x86_64-unknown-linux-gnu.tar.gz" ...
2026-07-03T02:15:23.5133466Z [command]/usr/bin/tar xz --warning=no-unknown-keyword --overwrite -C /home/runner/work/_temp/1f7fec2d-ae0a-489c-8281-276a4ed1f834 -f /home/runner/work/_temp/4ced2892-a79b-4503-abc0-e6471dba9991
2026-07-03T02:15:24.0004257Z Added /home/runner/.local/bin to the path
2026-07-03T02:15:24.0007569Z Added /opt/hostedtoolcache/uv/0.11.26/x86_64 to the path
2026-07-03T02:15:24.0048168Z Set UV_CACHE_DIR to /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:24.0048571Z Successfully installed uv version 0.11.26
2026-07-03T02:15:24.0050549Z Searching files using cache dependency glob: /home/runner/work/hmmb-bujo/hmmb-bujo/**/*requirements*.txt,/home/runner/work/hmmb-bujo/hmmb-bujo/**/*requirements*.in,/home/runner/work/hmmb-bujo/hmmb-bujo/**/*constraints*.txt,/home/runner/work/hmmb-bujo/hmmb-bujo/**/*constraints*.in,/home/runner/work/hmmb-bujo/hmmb-bujo/**/pyproject.toml,/home/runner/work/hmmb-bujo/hmmb-bujo/**/uv.lock,/home/runner/work/hmmb-bujo/hmmb-bujo/**/*.py.lock
2026-07-03T02:15:24.0810080Z /home/runner/work/hmmb-bujo/hmmb-bujo/.agents/skills/bmad-story-automator/pyproject.toml
2026-07-03T02:15:24.1617297Z /home/runner/work/hmmb-bujo/hmmb-bujo/.claude/skills/bmad-story-automator/pyproject.toml
2026-07-03T02:15:24.2081091Z /home/runner/work/hmmb-bujo/hmmb-bujo/backend/pyproject.toml
2026-07-03T02:15:24.2090141Z /home/runner/work/hmmb-bujo/hmmb-bujo/backend/uv.lock
2026-07-03T02:15:24.2203588Z Found 4 files to hash.
2026-07-03T02:15:24.2922243Z Trying to restore uv cache from GitHub Actions cache with key: setup-uv-1-x86_64-unknown-linux-gnu-3.12.3-pruned-65b7d067aea2f6c99ab61212acef7d1015ab7e8cea8c2ecb916c535f9ad576e9
2026-07-03T02:15:24.3728944Z No GitHub Actions cache found for key: setup-uv-1-x86_64-unknown-linux-gnu-3.12.3-pruned-65b7d067aea2f6c99ab61212acef7d1015ab7e8cea8c2ecb916c535f9ad576e9
2026-07-03T02:15:24.3882087Z ##[group]Run uv sync --frozen
2026-07-03T02:15:24.3882413Z [36;1muv sync --frozen[0m
2026-07-03T02:15:24.3920301Z shell: /usr/bin/bash -e {0}
2026-07-03T02:15:24.3920558Z env:
2026-07-03T02:15:24.3920781Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:24.3921137Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:24.3921455Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:24.3921972Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:24.3922294Z   UV_CACHE_DIR: /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:24.3922594Z ##[endgroup]
2026-07-03T02:15:24.4545056Z Using CPython 3.12.3 interpreter at: /usr/bin/python3
2026-07-03T02:15:24.4545773Z Creating virtual environment at: .venv
2026-07-03T02:15:24.5246783Z Downloading faker (1.9MiB)
2026-07-03T02:15:24.5412248Z Downloading grimp (2.2MiB)
2026-07-03T02:15:24.5414425Z Downloading pygments (1.2MiB)
2026-07-03T02:15:24.5418287Z Downloading psycopg-binary (4.9MiB)
2026-07-03T02:15:24.5423191Z Downloading ruff (11.0MiB)
2026-07-03T02:15:24.5429756Z Downloading django (7.9MiB)
2026-07-03T02:15:24.6387891Z    Building djangorestframework-camel-case==1.4.2
2026-07-03T02:15:24.7801268Z  Downloaded grimp
2026-07-03T02:15:24.9045342Z  Downloaded psycopg-binary
2026-07-03T02:15:24.9071149Z  Downloaded ruff
2026-07-03T02:15:24.9538843Z  Downloaded pygments
2026-07-03T02:15:25.1137066Z  Downloaded faker
2026-07-03T02:15:25.6441392Z  Downloaded django
2026-07-03T02:15:25.6939320Z       Built djangorestframework-camel-case==1.4.2
2026-07-03T02:15:25.6951385Z Prepared 39 packages in 1.23s
2026-07-03T02:15:25.9390913Z Installed 39 packages in 243ms
2026-07-03T02:15:25.9391565Z  + asgiref==3.11.1
2026-07-03T02:15:25.9392462Z  + attrs==26.1.0
2026-07-03T02:15:25.9392927Z  + click==8.4.2
2026-07-03T02:15:25.9393559Z  + django==5.2.15
2026-07-03T02:15:25.9394002Z  + django-cors-headers==4.9.0
2026-07-03T02:15:25.9394458Z  + django-environ==0.14.0
2026-07-03T02:15:25.9394867Z  + django-filter==24.3
2026-07-03T02:15:25.9395303Z  + djangorestframework==3.17.1
2026-07-03T02:15:25.9395808Z  + djangorestframework-camel-case==1.4.2
2026-07-03T02:15:25.9396362Z  + djangorestframework-simplejwt==5.5.1
2026-07-03T02:15:25.9396860Z  + drf-spectacular==0.29.0
2026-07-03T02:15:25.9397285Z  + factory-boy==3.3.3
2026-07-03T02:15:25.9397636Z  + faker==40.23.0
2026-07-03T02:15:25.9397962Z  + grimp==3.14
2026-07-03T02:15:25.9398295Z  + gunicorn==26.0.0
2026-07-03T02:15:25.9398671Z  + import-linter==2.12
2026-07-03T02:15:25.9399052Z  + inflection==0.5.1
2026-07-03T02:15:25.9399402Z  + iniconfig==2.3.0
2026-07-03T02:15:25.9399953Z  + jsonschema==4.26.0
2026-07-03T02:15:25.9400394Z  + jsonschema-specifications==2025.9.1
2026-07-03T02:15:25.9400876Z  + markdown-it-py==4.2.0
2026-07-03T02:15:25.9401254Z  + mdurl==0.1.2
2026-07-03T02:15:25.9401598Z  + packaging==26.2
2026-07-03T02:15:25.9401951Z  + pluggy==1.6.0
2026-07-03T02:15:25.9402290Z  + psycopg==3.3.4
2026-07-03T02:15:25.9402704Z  + psycopg-binary==3.3.4
2026-07-03T02:15:25.9403482Z  + pygments==2.20.0
2026-07-03T02:15:25.9403833Z  + pyjwt==2.13.0
2026-07-03T02:15:25.9404160Z  + pytest==9.1.1
2026-07-03T02:15:25.9404512Z  + pytest-django==4.12.0
2026-07-03T02:15:25.9404920Z  + pyyaml==6.0.3
2026-07-03T02:15:25.9405146Z  + referencing==0.37.0
2026-07-03T02:15:25.9405345Z  + rich==15.0.0
2026-07-03T02:15:25.9405542Z  + rpds-py==2026.5.1
2026-07-03T02:15:25.9405741Z  + ruff==0.15.18
2026-07-03T02:15:25.9405978Z  + sqlparse==0.5.5
2026-07-03T02:15:25.9406245Z  + typing-extensions==4.15.0
2026-07-03T02:15:25.9406488Z  + uritemplate==4.2.0
2026-07-03T02:15:25.9406716Z  + whitenoise==6.12.0
2026-07-03T02:15:25.9581315Z ##[group]Run uv run ruff check .
2026-07-03T02:15:25.9581649Z [36;1muv run ruff check .[0m
2026-07-03T02:15:25.9612970Z shell: /usr/bin/bash -e {0}
2026-07-03T02:15:25.9613213Z env:
2026-07-03T02:15:25.9613429Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:25.9613771Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:25.9614115Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:25.9614610Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:25.9614943Z   UV_CACHE_DIR: /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:25.9615245Z ##[endgroup]
2026-07-03T02:15:26.0333105Z All checks passed!
2026-07-03T02:15:26.0376551Z ##[group]Run uv run lint-imports
2026-07-03T02:15:26.0376850Z [36;1muv run lint-imports[0m
2026-07-03T02:15:26.0407589Z shell: /usr/bin/bash -e {0}
2026-07-03T02:15:26.0407832Z env:
2026-07-03T02:15:26.0408058Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:26.0408401Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:26.0408720Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:26.0409227Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:26.0409554Z   UV_CACHE_DIR: /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:26.0410155Z ##[endgroup]
2026-07-03T02:15:26.3232897Z 
2026-07-03T02:15:26.3233750Z ╔══╗─────────▶╔╗ ╔╗      ╔╗◀───┐
2026-07-03T02:15:26.3234414Z ╚╣╠╝◀─────┐  ╔╝╚╗║║────▶╔╝╚╗   │
2026-07-03T02:15:26.3234957Z  ║║   ╔══╦══╦╩╗╔╝║║  ╔╦═╩╗╔╝╔═╦══╗
2026-07-03T02:15:26.3235509Z  ║║╔══╣╔╗║╔╗║╔╣║ ║║ ╔╬╣╔╗║║ ║│║╔═╝
2026-07-03T02:15:26.3236060Z ╔╣╠╣║║║╚╝║╚╝║║║╚╗║╚═╝║║║║║╚╗║═╣║
2026-07-03T02:15:26.3236673Z ╚══╩╩╩╣╔═╩══╩╝╚═╝╚═══╩╩╝╚╩═╩╩═╩╝
2026-07-03T02:15:26.3237177Z   └──▶║║                    ▲ 
2026-07-03T02:15:26.3237675Z       ╚╝────────────────────┘
2026-07-03T02:15:26.3237942Z 
2026-07-03T02:15:26.3684945Z 
2026-07-03T02:15:26.3688190Z ---------
2026-07-03T02:15:26.3690656Z Contracts
2026-07-03T02:15:26.3692901Z ---------
2026-07-03T02:15:26.3694394Z 
2026-07-03T02:15:26.3696968Z Analyzed 66 files, 110 dependencies.
2026-07-03T02:15:26.3699085Z ------------------------------------
2026-07-03T02:15:26.3700652Z 
2026-07-03T02:15:26.3707559Z core must not import domain apps (port rule) KEPT
2026-07-03T02:15:26.3708038Z 
2026-07-03T02:15:26.3710411Z Contracts: 1 kept, 0 broken.
2026-07-03T02:15:26.3918373Z ##[group]Run uv run pytest
2026-07-03T02:15:26.3918876Z [36;1muv run pytest[0m
2026-07-03T02:15:26.3949966Z shell: /usr/bin/bash -e {0}
2026-07-03T02:15:26.3950222Z env:
2026-07-03T02:15:26.3950450Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:26.3950797Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:26.3951122Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:26.3951747Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:26.3952076Z   UV_CACHE_DIR: /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:26.3952378Z ##[endgroup]
2026-07-03T02:15:28.5674066Z ============================= test session starts ==============================
2026-07-03T02:15:28.5674751Z platform linux -- Python 3.12.3, pytest-9.1.1, pluggy-1.6.0
2026-07-03T02:15:28.5675393Z django: version: 5.2.15, settings: config.settings.dev (from env)
2026-07-03T02:15:28.5676010Z rootdir: /home/runner/work/hmmb-bujo/hmmb-bujo/backend
2026-07-03T02:15:28.5676691Z configfile: pyproject.toml
2026-07-03T02:15:28.5677034Z testpaths: .
2026-07-03T02:15:28.5677635Z plugins: django-4.12.0, Faker-40.23.0
2026-07-03T02:15:28.5678024Z collected 79 items
2026-07-03T02:15:28.5678204Z 
2026-07-03T02:15:31.6789055Z accounts/tests/test_isolation.py ....                                    [  5%]
2026-07-03T02:15:34.0319629Z accounts/tests/test_models.py ........                                   [ 15%]
2026-07-03T02:15:39.3466522Z accounts/tests/test_views.py ..............                              [ 32%]
2026-07-03T02:15:39.3966656Z core/tests/test_api_contract.py ...........                              [ 46%]
2026-07-03T02:15:39.4531723Z core/tests/test_calendar.py .....................                        [ 73%]
2026-07-03T02:15:39.4695965Z core/tests/test_exceptions.py ......                                     [ 81%]
2026-07-03T02:15:39.7841115Z core/tests/test_guardrails.py ..                                         [ 83%]
2026-07-03T02:15:39.7880587Z core/tests/test_health.py .                                              [ 84%]
2026-07-03T02:15:41.3442579Z core/tests/test_isolation.py .....                                       [ 91%]
2026-07-03T02:15:41.3521710Z core/tests/test_middleware.py ...                                        [ 94%]
2026-07-03T02:15:41.4451849Z core/tests/test_services.py ....                                         [100%]
2026-07-03T02:15:41.4452244Z 
2026-07-03T02:15:41.4452429Z ============================= 79 passed in 12.99s ==============================
2026-07-03T02:15:41.5488811Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-07-03T02:15:41.5490294Z ##[group]Run actions/setup-node@v4
2026-07-03T02:15:41.5490548Z with:
2026-07-03T02:15:41.5490732Z   node-version: 22
2026-07-03T02:15:41.5490936Z   always-auth: false
2026-07-03T02:15:41.5491166Z   check-latest: false
2026-07-03T02:15:41.5493815Z   token: ***
2026-07-03T02:15:41.5494003Z env:
2026-07-03T02:15:41.5494217Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:41.5494556Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:41.5494867Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:41.5495259Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:41.5495623Z   UV_CACHE_DIR: /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:41.5495925Z ##[endgroup]
2026-07-03T02:15:41.6903001Z Found in cache @ /opt/hostedtoolcache/node/22.23.1/x64
2026-07-03T02:15:41.6907771Z (node:2825) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
2026-07-03T02:15:41.6908660Z (Use `node --trace-deprecation ...` to show where the warning was created)
2026-07-03T02:15:41.6912186Z ##[group]Environment details
2026-07-03T02:15:42.0891598Z node: v22.23.1
2026-07-03T02:15:42.0892084Z npm: 10.9.8
2026-07-03T02:15:42.0892479Z yarn: 1.22.22
2026-07-03T02:15:42.0893158Z ##[endgroup]
2026-07-03T02:15:42.1005073Z ##[group]Run uv run python manage.py spectacular --file ../schema.yaml
2026-07-03T02:15:42.1005598Z [36;1muv run python manage.py spectacular --file ../schema.yaml[0m
2026-07-03T02:15:42.1042097Z shell: /usr/bin/bash -e {0}
2026-07-03T02:15:42.1042342Z env:
2026-07-03T02:15:42.1042560Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:42.1042915Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:42.1043233Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:42.1043729Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:42.1044057Z   UV_CACHE_DIR: /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:42.1044360Z ##[endgroup]
2026-07-03T02:15:42.6093037Z /home/runner/work/hmmb-bujo/hmmb-bujo/backend/accounts/views.py: Error [signup]: unable to guess serializer. This is graceful fallback handling for APIViews. Consider using GenericAPIView as view base class, if view is under your control. Either way you may want to add a serializer_class (or method). Ignoring view for now.
2026-07-03T02:15:42.6227788Z 
2026-07-03T02:15:42.6228211Z Schema generation summary:
2026-07-03T02:15:42.6228832Z Warnings: 0 (0 unique)
2026-07-03T02:15:42.6229348Z Errors:   4 (1 unique)
2026-07-03T02:15:42.6229892Z 
2026-07-03T02:15:42.6906484Z ##[group]Run npx --yes openapi-typescript@^7 schema.yaml -o /tmp/types.gen.ts
2026-07-03T02:15:42.6907085Z [36;1mnpx --yes openapi-typescript@^7 schema.yaml -o /tmp/types.gen.ts[0m
2026-07-03T02:15:42.6907549Z [36;1mdiff frontend/src/api/types.gen.ts /tmp/types.gen.ts \[0m
2026-07-03T02:15:42.6908216Z [36;1m  || (echo "❌ frontend/src/api/types.gen.ts divergiu do schema — rode 'npm run generate-types' em frontend/ e commite" && exit 1)[0m
2026-07-03T02:15:42.6941397Z shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}
2026-07-03T02:15:42.6941731Z env:
2026-07-03T02:15:42.6941948Z   DJANGO_SETTINGS_MODULE: config.settings.dev
2026-07-03T02:15:42.6942284Z   SECRET_KEY: ci-dummy-secret-not-for-production
2026-07-03T02:15:42.6942628Z   ALLOWED_HOSTS: localhost,127.0.0.1
2026-07-03T02:15:42.6943181Z   DATABASE_URL: ***localhost:5432/hmmb_ci
2026-07-03T02:15:42.6943511Z   UV_CACHE_DIR: /home/runner/work/_temp/setup-uv-cache
2026-07-03T02:15:42.6943809Z ##[endgroup]
2026-07-03T02:15:46.1582790Z ✨ openapi-typescript 7.13.0
2026-07-03T02:15:46.1875780Z 🚀 schema.yaml → /tmp/types.gen.ts [32ms]
2026-07-03T02:15:46.2683494Z 6c6,63
2026-07-03T02:15:46.2684139Z < export type paths = Record<string, never>;
2026-07-03T02:15:46.2684716Z ---
2026-07-03T02:15:46.2685109Z > export interface paths {
2026-07-03T02:15:46.2685643Z >     "/api/accounts/signup/": {
2026-07-03T02:15:46.2686119Z >         parameters: {
2026-07-03T02:15:46.2686540Z >             query?: never;
2026-07-03T02:15:46.2686987Z >             header?: never;
2026-07-03T02:15:46.2687434Z >             path?: never;
2026-07-03T02:15:46.2687855Z >             cookie?: never;
2026-07-03T02:15:46.2688233Z >         };
2026-07-03T02:15:46.2688617Z >         get?: never;
2026-07-03T02:15:46.2689001Z >         put?: never;
2026-07-03T02:15:46.2689536Z >         post: operations["accounts_signup_create"];
2026-07-03T02:15:46.2690391Z >         delete?: never;
2026-07-03T02:15:46.2690771Z >         options?: never;
2026-07-03T02:15:46.2691193Z >         head?: never;
2026-07-03T02:15:46.2691587Z >         patch?: never;
2026-07-03T02:15:46.2691983Z >         trace?: never;
2026-07-03T02:15:46.2692326Z >     };
2026-07-03T02:15:46.2692718Z >     "/api/accounts/token/": {
2026-07-03T02:15:46.2693154Z >         parameters: {
2026-07-03T02:15:46.2693563Z >             query?: never;
2026-07-03T02:15:46.2693995Z >             header?: never;
2026-07-03T02:15:46.2694414Z >             path?: never;
2026-07-03T02:15:46.2694811Z >             cookie?: never;
2026-07-03T02:15:46.2695167Z >         };
2026-07-03T02:15:46.2695616Z >         get?: never;
2026-07-03T02:15:46.2696032Z >         put?: never;
2026-07-03T02:15:46.2696415Z >         /**
2026-07-03T02:15:46.2697322Z >          * @description Takes a set of user credentials and returns an access and refresh JSON web
2026-07-03T02:15:46.2698536Z >          *     token pair to prove the authentication of those credentials.
2026-07-03T02:15:46.2699203Z >          */
2026-07-03T02:15:46.2700031Z >         post: operations["accounts_token_create"];
2026-07-03T02:15:46.2700659Z >         delete?: never;
2026-07-03T02:15:46.2701112Z >         options?: never;
2026-07-03T02:15:46.2701566Z >         head?: never;
2026-07-03T02:15:46.2701991Z >         patch?: never;
2026-07-03T02:15:46.2702433Z >         trace?: never;
2026-07-03T02:15:46.2702806Z >     };
2026-07-03T02:15:46.2703246Z >     "/api/accounts/token/refresh/": {
2026-07-03T02:15:46.2703767Z >         parameters: {
2026-07-03T02:15:46.2704199Z >             query?: never;
2026-07-03T02:15:46.2704643Z >             header?: never;
2026-07-03T02:15:46.2705078Z >             path?: never;
2026-07-03T02:15:46.2705514Z >             cookie?: never;
2026-07-03T02:15:46.2706193Z >         };
2026-07-03T02:15:46.2706553Z >         get?: never;
2026-07-03T02:15:46.2706954Z >         put?: never;
2026-07-03T02:15:46.2707319Z >         /**
2026-07-03T02:15:46.2708454Z >          * @description Takes a refresh type JSON web token and returns an access type JSON web
2026-07-03T02:15:46.2709436Z >          *     token if the refresh token is valid.
2026-07-03T02:15:46.2710283Z >          */
2026-07-03T02:15:46.2710881Z >         post: operations["accounts_token_refresh_create"];
2026-07-03T02:15:46.2711470Z >         delete?: never;
2026-07-03T02:15:46.2711922Z >         options?: never;
2026-07-03T02:15:46.2712357Z >         head?: never;
2026-07-03T02:15:46.2712780Z >         patch?: never;
2026-07-03T02:15:46.2713212Z >         trace?: never;
2026-07-03T02:15:46.2713598Z >     };
2026-07-03T02:15:46.2713922Z > }
2026-07-03T02:15:46.2714226Z 9c66,77
2026-07-03T02:15:46.2714577Z <     schemas: never;
2026-07-03T02:15:46.2714951Z ---
2026-07-03T02:15:46.2715302Z >     schemas: {
2026-07-03T02:15:46.2715752Z >         TokenObtainPair: {
2026-07-03T02:15:46.2716231Z >             email: string;
2026-07-03T02:15:46.2716767Z >             password: string;
2026-07-03T02:15:46.2717340Z >             readonly access: string;
2026-07-03T02:15:46.2718003Z >             readonly refresh: string;
2026-07-03T02:15:46.2718460Z >         };
2026-07-03T02:15:46.2718835Z >         TokenRefresh: {
2026-07-03T02:15:46.2730444Z >             readonly access: string;
2026-07-03T02:15:46.2731214Z >             refresh: string;
2026-07-03T02:15:46.2731681Z >         };
2026-07-03T02:15:46.2732026Z >     };
2026-07-03T02:15:46.2732360Z 17c85,150
2026-07-03T02:15:46.2732903Z < export type operations = Record<string, never>;
2026-07-03T02:15:46.2733464Z ---
2026-07-03T02:15:46.2733906Z > export interface operations {
2026-07-03T02:15:46.2734469Z >     accounts_signup_create: {
2026-07-03T02:15:46.2734983Z >         parameters: {
2026-07-03T02:15:46.2735441Z >             query?: never;
2026-07-03T02:15:46.2735923Z >             header?: never;
2026-07-03T02:15:46.2736411Z >             path?: never;
2026-07-03T02:15:46.2736881Z >             cookie?: never;
2026-07-03T02:15:46.2737298Z >         };
2026-07-03T02:15:46.2737729Z >         requestBody?: never;
2026-07-03T02:15:46.2738201Z >         responses: {
2026-07-03T02:15:46.2738767Z >             /** @description No response body */
2026-07-03T02:15:46.2739308Z >             200: {
2026-07-03T02:15:46.2740057Z >                 headers: {
2026-07-03T02:15:46.2740655Z >                     [name: string]: unknown;
2026-07-03T02:15:46.2741174Z >                 };
2026-07-03T02:15:46.2741626Z >                 content?: never;
2026-07-03T02:15:46.2742072Z >             };
2026-07-03T02:15:46.2742420Z >         };
2026-07-03T02:15:46.2742747Z >     };
2026-07-03T02:15:46.2743167Z >     accounts_token_create: {
2026-07-03T02:15:46.2743645Z >         parameters: {
2026-07-03T02:15:46.2744088Z >             query?: never;
2026-07-03T02:15:46.2744567Z >             header?: never;
2026-07-03T02:15:46.2745064Z >             path?: never;
2026-07-03T02:15:46.2745529Z >             cookie?: never;
2026-07-03T02:15:46.2745941Z >         };
2026-07-03T02:15:46.2746330Z >         requestBody: {
2026-07-03T02:15:46.2746750Z >             content: {
2026-07-03T02:15:46.2747520Z >                 "application/json": components["schemas"]["TokenObtainPair"];
2026-07-03T02:15:46.2748180Z >             };
2026-07-03T02:15:46.2748509Z >         };
2026-07-03T02:15:46.2748870Z >         responses: {
2026-07-03T02:15:46.2749267Z >             200: {
2026-07-03T02:15:46.2749663Z >                 headers: {
2026-07-03T02:15:46.2750482Z >                     [name: string]: unknown;
2026-07-03T02:15:46.2750981Z >                 };
2026-07-03T02:15:46.2751374Z >                 content: {
2026-07-03T02:15:46.2752152Z >                     "application/json": components["schemas"]["TokenObtainPair"];
2026-07-03T02:15:46.2752850Z >                 };
2026-07-03T02:15:46.2753488Z >             };
2026-07-03T02:15:46.2753891Z >         };
2026-07-03T02:15:46.2754234Z >     };
2026-07-03T02:15:46.2754691Z >     accounts_token_refresh_create: {
2026-07-03T02:15:46.2755230Z >         parameters: {
2026-07-03T02:15:46.2755672Z >             query?: never;
2026-07-03T02:15:46.2756392Z >             header?: never;
2026-07-03T02:15:46.2756892Z >             path?: never;
2026-07-03T02:15:46.2757351Z >             cookie?: never;
2026-07-03T02:15:46.2757766Z >         };
2026-07-03T02:15:46.2758143Z >         requestBody: {
2026-07-03T02:15:46.2758573Z >             content: {
2026-07-03T02:15:46.2759316Z >                 "application/json": components["schemas"]["TokenRefresh"];
2026-07-03T02:15:46.2760269Z >             };
2026-07-03T02:15:46.2760634Z >         };
2026-07-03T02:15:46.2761019Z >         responses: {
2026-07-03T02:15:46.2761437Z >             200: {
2026-07-03T02:15:46.2761857Z >                 headers: {
2026-07-03T02:15:46.2762426Z >                     [name: string]: unknown;
2026-07-03T02:15:46.2762967Z >                 };
2026-07-03T02:15:46.2763383Z >                 content: {
2026-07-03T02:15:46.2764125Z >                     "application/json": components["schemas"]["TokenRefresh"];
2026-07-03T02:15:46.2764793Z >                 };
2026-07-03T02:15:46.2765145Z >             };
2026-07-03T02:15:46.2765470Z >         };
2026-07-03T02:15:46.2765772Z >     };
2026-07-03T02:15:46.2766068Z > }
2026-07-03T02:15:46.2767349Z ❌ frontend/src/api/types.gen.ts divergiu do schema — rode 'npm run generate-types' em frontend/ e commite
2026-07-03T02:15:46.2778160Z ##[error]Process completed with exit code 1.
2026-07-03T02:15:46.2888329Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
2026-07-03T02:15:46.2889585Z Post job cleanup.
2026-07-03T02:15:46.3699602Z [command]/usr/bin/git version
2026-07-03T02:15:46.3736786Z git version 2.54.0
2026-07-03T02:15:46.3808043Z Temporarily overriding HOME='/home/runner/work/_temp/655b5943-e4b3-477b-aec3-9704f33fdb15' before making global git config changes
2026-07-03T02:15:46.3809054Z Adding repository directory to the temporary git global config as a safe directory
2026-07-03T02:15:46.3813376Z [command]/usr/bin/git config --global --add safe.directory /home/runner/work/hmmb-bujo/hmmb-bujo
2026-07-03T02:15:46.3849508Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-07-03T02:15:46.3884620Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-07-03T02:15:46.4115747Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
2026-07-03T02:15:46.4140457Z http.https://github.com/.extraheader
2026-07-03T02:15:46.4152336Z [command]/usr/bin/git config --local --unset-all http.https://github.com/.extraheader
2026-07-03T02:15:46.4183393Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
2026-07-03T02:15:46.4410616Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-07-03T02:15:46.4442227Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-07-03T02:15:46.4774127Z Print service container logs: d27a81e5c67f4cccb3dc700ff81b25b4_postgres16_0673a7
2026-07-03T02:15:46.4779069Z ##[command]/usr/bin/docker logs --details e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:46.4904569Z  initdb: warning: enabling "trust" authentication for local connections
2026-07-03T02:15:46.4905929Z  The files belonging to this database system will be owned by user "postgres".
2026-07-03T02:15:46.4906859Z  initdb: hint: You can change this by editing pg_hba.conf or using the option -A, or --auth-local and --auth-host, the next time you run initdb.
2026-07-03T02:15:46.4907840Z  2026-07-03 02:15:09.488 UTC [1] LOG:  starting PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
2026-07-03T02:15:46.4908574Z  2026-07-03 02:15:09.488 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
2026-07-03T02:15:46.4909121Z  2026-07-03 02:15:09.488 UTC [1] LOG:  listening on IPv6 address "::", port 5432
2026-07-03T02:15:46.4909956Z  2026-07-03 02:15:09.489 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
2026-07-03T02:15:46.4910657Z  2026-07-03 02:15:09.492 UTC [64] LOG:  database system was shut down at 2026-07-03 02:15:09 UTC
2026-07-03T02:15:46.4911197Z  2026-07-03 02:15:09.496 UTC [1] LOG:  database system is ready to accept connections
2026-07-03T02:15:46.4911673Z  2026-07-03 02:15:18.618 UTC [75] FATAL:  role "root" does not exist
2026-07-03T02:15:46.4912105Z  2026-07-03 02:15:28.686 UTC [84] FATAL:  role "root" does not exist
2026-07-03T02:15:46.4912644Z  2026-07-03 02:15:32.264 UTC [85] ERROR:  duplicate key value violates unique constraint "accounts_user_email_key"
2026-07-03T02:15:46.4913241Z  2026-07-03 02:15:32.264 UTC [85] DETAIL:  Key (email)=(user7@test.com) already exists.
2026-07-03T02:15:46.4914862Z  2026-07-03 02:15:32.264 UTC [85] STATEMENT:  INSERT INTO "accounts_user" ("password", "last_login", "is_superuser", "id", "email", "timezone", "is_active", "is_staff", "date_joined") VALUES ('', NULL, false, 'a96e68a6a87246d3974f11dc2e53112a'::uuid, 'user7@test.com', 'America/Sao_Paulo', true, false, '2026-07-03 02:15:32.264527+00:00'::timestamptz)
2026-07-03T02:15:46.4916724Z  2026-07-03 02:15:38.755 UTC [93] FATAL:  role "root" does not exist
2026-07-03T02:15:46.4917178Z  2026-07-03 02:15:41.373 UTC [62] LOG:  checkpoint starting: immediate force wait
2026-07-03T02:15:46.4918299Z  2026-07-03 02:15:41.387 UTC [62] LOG:  checkpoint complete: wrote 45 buffers (0.3%); 1 WAL file(s) added, 0 removed, 0 recycled; write=0.002 s, sync=0.003 s, total=0.015 s; sync files=14, longest=0.003 s, average=0.001 s; distance=4940 kB, estimate=4940 kB; lsn=0/1DF2498, redo lsn=0/1DF2460
2026-07-03T02:15:46.4919336Z  This user must also own the server process.
2026-07-03T02:15:46.4919611Z  
2026-07-03T02:15:46.4920144Z  The database cluster will be initialized with locale "en_US.utf8".
2026-07-03T02:15:46.4920591Z  The default database encoding has accordingly been set to "UTF8".
2026-07-03T02:15:46.4921009Z  The default text search configuration will be set to "english".
2026-07-03T02:15:46.4921333Z  
2026-07-03T02:15:46.4921521Z  Data page checksums are disabled.
2026-07-03T02:15:46.4921755Z  
2026-07-03T02:15:46.4922043Z  fixing permissions on existing directory /var/lib/postgresql/data ... ok
2026-07-03T02:15:46.4922441Z  creating subdirectories ... ok
2026-07-03T02:15:46.4922753Z  selecting dynamic shared memory implementation ... posix
2026-07-03T02:15:46.4923104Z  selecting default max_connections ... 100
2026-07-03T02:15:46.4923395Z  selecting default shared_buffers ... 128MB
2026-07-03T02:15:46.4923680Z  selecting default time zone ... Etc/UTC
2026-07-03T02:15:46.4923956Z  creating configuration files ... ok
2026-07-03T02:15:46.4924221Z  running bootstrap script ... ok
2026-07-03T02:15:46.4924507Z  performing post-bootstrap initialization ... ok
2026-07-03T02:15:46.4924808Z  syncing data to disk ... ok
2026-07-03T02:15:46.4925045Z  
2026-07-03T02:15:46.4925465Z  
2026-07-03T02:15:46.4925710Z  Success. You can now start the database server using:
2026-07-03T02:15:46.4926011Z  
2026-07-03T02:15:46.4926250Z      pg_ctl -D /var/lib/postgresql/data -l logfile start
2026-07-03T02:15:46.4926552Z  
2026-07-03T02:15:46.4927203Z  waiting for server to start....2026-07-03 02:15:09.186 UTC [48] LOG:  starting PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
2026-07-03T02:15:46.4928223Z  2026-07-03 02:15:09.187 UTC [48] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
2026-07-03T02:15:46.4928795Z  2026-07-03 02:15:09.190 UTC [51] LOG:  database system was shut down at 2026-07-03 02:15:09 UTC
2026-07-03T02:15:46.4929308Z  2026-07-03 02:15:09.193 UTC [48] LOG:  database system is ready to accept connections
2026-07-03T02:15:46.4930498Z   done
2026-07-03T02:15:46.4930846Z  server started
2026-07-03T02:15:46.4931173Z  CREATE DATABASE
2026-07-03T02:15:46.4931482Z  
2026-07-03T02:15:46.4931747Z  
2026-07-03T02:15:46.4932153Z  /usr/local/bin/docker-entrypoint.sh: ignoring /docker-entrypoint-initdb.d/*
2026-07-03T02:15:46.4932567Z  
2026-07-03T02:15:46.4932823Z  2026-07-03 02:15:09.370 UTC [48] LOG:  received fast shutdown request
2026-07-03T02:15:46.4933365Z  waiting for server to shut down....2026-07-03 02:15:09.370 UTC [48] LOG:  aborting any active transactions
2026-07-03T02:15:46.4934094Z  2026-07-03 02:15:09.372 UTC [48] LOG:  background worker "logical replication launcher" (PID 54) exited with exit code 1
2026-07-03T02:15:46.4934644Z  2026-07-03 02:15:09.372 UTC [49] LOG:  shutting down
2026-07-03T02:15:46.4935036Z  2026-07-03 02:15:09.373 UTC [49] LOG:  checkpoint starting: shutdown immediate
2026-07-03T02:15:46.4936134Z  2026-07-03 02:15:09.388 UTC [49] LOG:  checkpoint complete: wrote 926 buffers (5.7%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.012 s, sync=0.003 s, total=0.017 s; sync files=301, longest=0.002 s, average=0.001 s; distance=4273 kB, estimate=4273 kB; lsn=0/191F0E8, redo lsn=0/191F0E8
2026-07-03T02:15:46.4937210Z  2026-07-03 02:15:09.395 UTC [48] LOG:  database system is shut down
2026-07-03T02:15:46.4937542Z   done
2026-07-03T02:15:46.4937721Z  server stopped
2026-07-03T02:15:46.4937913Z  
2026-07-03T02:15:46.4938155Z  PostgreSQL init process complete; ready for start up.
2026-07-03T02:15:46.4938451Z  
2026-07-03T02:15:46.4944868Z Stop and remove container: d27a81e5c67f4cccb3dc700ff81b25b4_postgres16_0673a7
2026-07-03T02:15:46.4950215Z ##[command]/usr/bin/docker rm --force e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:46.8624628Z e7d9982839b951268bbaf7322d112a084864958b2cde157946e84dee5080917e
2026-07-03T02:15:46.8657693Z Remove container network: github_network_c333d36071fc4676a41f442fcd281473
2026-07-03T02:15:46.8663948Z ##[command]/usr/bin/docker network rm github_network_c333d36071fc4676a41f442fcd281473
2026-07-03T02:15:46.9623660Z github_network_c333d36071fc4676a41f442fcd281473
2026-07-03T02:15:46.9694343Z Cleaning up orphan processes
2026-07-03T02:15:47.0036316Z ##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4, astral-sh/setup-uv@v6. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

# Railway Build Logs
You reached the start of the range
Jul 3, 2026, 11:57 AM
scheduling build on Metal builder "builder-ptwxfi"
fetched snapshot sha256:01afa0e25e1e8d52303d86f975f58a877c6adfd1e1770ca1d928914d515a0c7b (2.1 MB bytes)
fetching snapshot
2 MB
583ms
unpacking archive
8.1 MB
52ms
using build driver railpack-v0.30.0
                   
╭─────────────────╮
│ Railpack 0.30.0 │
╰─────────────────╯
 
  ↳ Detected Python
  ↳ Using uv
  ↳ Using Django app: config.wsgi
            
  Packages  
  ──────────
  python  │  3.13.14  │  railpack default (3.13)
  uv      │  0.11.22  │  railpack default (latest)
            
  Steps     
  ──────────
  ▸ install
    $ uv sync --locked --no-dev --no-install-project
         
  ▸ build
    $ uv sync --locked --no-dev --no-editable
            
  Deploy    
  ──────────
    $ python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --access-logfile -
 

load build definition from ./railpack-plan.json
0ms

copy /mise/shims, /usr/local/bin/mise, /etc/mise/config.toml, /root/.local/state/mise, /mise/installs cached
26ms

install mise packages: python, uv cached
0ms

copy /app, /app/.venv cached
0ms

uv sync --locked --no-dev --no-editable cached
0ms

copy / /app cached
0ms

uv sync --locked --no-dev --no-install-project cached
0ms

copy uv.lock, pyproject.toml cached
0ms

exporting to docker image format
785ms
containerimage.descriptor: eyJtZWRpYVR5cGUiOiJhcHBsaWNhdGlvbi92bmQub2NpLmltYWdlLm1hbmlmZXN0LnYxK2pzb24iLCJkaWdlc3QiOiJzaGEyNTY6ZjEyYTAyZWM3ZDhmNzdkNDgwMGM1MmVmMWYwYmQxMzkzOTYxMGNlNzM5ZWRlMDczY2ZhMDQ1ZDhiZTEwNGMyMiIsInNpemUiOjIwMDcsImFubm90YXRpb25zIjp7Im9yZy5vcGVuY29udGFpbmVycy5pbWFnZS5jcmVhdGVkIjoiMjAyNi0wNy0wM1QxNTowMjoxOVoifSwicGxhdGZvcm0iOnsiYXJjaGl0ZWN0dXJlIjoiYW1kNjQiLCJvcyI6ImxpbnV4In19
containerimage.config.digest: sha256:0fa6d58f46c77aa20f17e06d794729d4fd75ea293cdb659f7e9cbb7fa528f60b
containerimage.digest: sha256:f12a02ec7d8f77d4800c52ef1f0bd13939610ce739ede073cfa045d8be104c22
image push
145.9 MB
3.0s
 
====================
Starting Healthcheck
====================
Path: /api/health/
Retry window: 1m40s
 
Attempt #1 failed with service unavailable. Continuing to retry for 1m29s
Attempt #2 failed with service unavailable. Continuing to retry for 1m18s
Attempt #3 failed with service unavailable. Continuing to retry for 1m6s
Attempt #4 failed with service unavailable. Continuing to retry for 52s
Attempt #5 failed with service unavailable. Continuing to retry for 34s
Attempt #6 failed with service unavailable. Continuing to retry for 8s
 
1/1 replicas never became healthy!

Healthcheck failed!

You reached the end of the range
Jul 3, 2026, 12:09 PM

# Railway Deployment Logs
You reached the start of the range
Jul 3, 2026, 12:02 PM
{"message":"Starting Container","severity":"info","attributes":{"level":"info"},"timestamp":"2026-07-03T15:02:32.991117109Z"}
{"message":"SystemCheckError: System check identified some issues:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:34.818753785Z"}
{"message":"","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:34.818761534Z"}
{"message":"ERRORS:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:34.818766945Z"}
{"message":"?: (corsheaders.E014) Origin 'https://hmmb-bujo-web-production.up.railway.app/' in CORS_ALLOWED_ORIGINS should not have path","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:34.818771252Z"}
{"message":"SystemCheckError: System check identified some issues:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:36.140687709Z"}
{"message":"","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:36.140692402Z"}
{"message":"ERRORS:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:36.140697037Z"}
{"message":"?: (corsheaders.E014) Origin 'https://hmmb-bujo-web-production.up.railway.app/' in CORS_ALLOWED_ORIGINS should not have path","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:36.140701291Z"}
{"message":"SystemCheckError: System check identified some issues:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:38.349928327Z"}
{"message":"","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:38.349934388Z"}
{"message":"ERRORS:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:38.349940422Z"}
{"message":"?: (corsheaders.E014) Origin 'https://hmmb-bujo-web-production.up.railway.app/' in CORS_ALLOWED_ORIGINS should not have path","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:38.349945690Z"}
{"message":"SystemCheckError: System check identified some issues:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:40.866540386Z"}
{"message":"","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:40.866597247Z"}
{"message":"ERRORS:","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:40.866603612Z"}
{"message":"?: (corsheaders.E014) Origin 'https://hmmb-bujo-web-production.up.railway.app/' in CORS_ALLOWED_ORIGINS should not have path","severity":"error","attributes":{"level":"error"},"timestamp":"2026-07-03T15:02:40.866607478Z"}
You reached the end of the range
Jul 3, 2026, 12:04 PM

# Railway Network Flow Logs
You reached the start of the range
Jul 3, 2026, 12:02 PM
udp
fe80::a0bb:1bff:fe5c:c545:5355
ff02::1:3:5355
Internet
384 B
0ms
OK
unknown
fe80::a0bb:1bff:fe5c:c545:0
ff02::16:0
Internet
400 B
0ms
OK
tcp
fd12:0:8:0:5000:36:8000:1:33627
fd12:5271:7e11:1:5000:36:1b5c:c545:8080
Service
94 B
0ms
OK
tcp
10.220.197.69:8080
100.64.0.2:33627
Internet
54 B
0ms
OK
udp
fe80::a0bb:1bff:fe5c:c545:5355
ff02::1:3:5355
Internet
384 B
0ms
OK
unknown
fe80::a0bb:1bff:fe5c:c545:0
ff02::16:0
Internet
400 B
0ms
OK