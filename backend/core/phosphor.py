"""Catálogo de nomes de glifo do Phosphor — autoridade de validação de ``icon_key``.

Story 16.2. ``icon_key`` guarda **o nome do glifo** (nunca componente React nem
path SVG), em kebab-case (``address-book``), e o catálogo é **aberto**: os ~1.5k
nomes da versão instalada de ``@phosphor-icons/react``. Aberto não é texto livre
— a fonte única de nomes válidos é o pacote, e a validação da chave é
**obrigação de servidor** (EXPERIENCE.md §Pictogramas de hábitos e saúde).

Por que um JSON commitado: o pacote só existe em ``frontend/node_modules/`` e o
backend roda em produção sem ``node_modules``. O artefato é gerado por
``scripts/gen_phosphor_catalog.mjs`` e um gate de CI regenera + ``diff``a contra
o commitado, do mesmo jeito que ``schema.yaml``/``types.gen.ts``.

Molde de ``accounts/serializers.py:8`` (``available_timezones()``): catálogo
grande carregado **uma vez no import**, num ``frozenset``, e consultado por
pertinência — nunca um ``ChoiceField``, que despejaria um enum de 1512 valores
no contrato OpenAPI (mesmo motivo do ``CharField`` em
``habits/serializers.py:HabitChangeSerializer``).

Vive em ``core/`` porque dois apps de domínio o consomem (``habits`` e
``health``); ler o JSON por caminho de arquivo **não** é um import de
``habits``, então a port rule (§7.2, import-linter) segue intacta.
"""

import json
import re
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from rest_framework import serializers

# O artefato mora junto do app que o gerou primeiro (``habits``); ``core`` o lê
# como DADO, por caminho — sem importar o pacote ``habits``.
_CATALOG_PATH = Path(__file__).resolve().parent.parent / "habits" / "phosphor_catalog.json"

# Só kebab-case estrito: minúsculas separadas por hífen simples. Rejeita
# PascalCase (``AddressBook``), snake_case, hífen duplo e hífen nas pontas
# ANTES da consulta ao catálogo — o formato é parte do contrato, não só a
# existência (a I/O Matrix pede 400 para ``"AddressBook"``).
# `\Z` e não `$`: `$` casa TAMBÉM antes de um \n final, então "barbell\n"
# passaria na checagem de forma (a pertinência ao catálogo ainda o barraria,
# mas a regra de formato deve valer sozinha).
_KEBAB_CASE = re.compile(r"^[a-z]+(?:-[a-z]+)*\Z")


# Artefato ausente/corrompido derruba o processo no import. Melhor uma
# mensagem que nomeia o arquivo e o conserto do que um FileNotFoundError
# ou JSONDecodeError cru no boot do gunicorn.
try:
    _CATALOG = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    _NAMES = _CATALOG["names"]
    _VERSION = _CATALOG["version"]
except (OSError, ValueError, KeyError) as exc:
    raise ImproperlyConfigured(
        f"Catálogo Phosphor ausente ou inválido em {_CATALOG_PATH}. "
        "Rode `node scripts/gen_phosphor_catalog.mjs` na raiz e commite."
    ) from exc

#: Nomes válidos da versão instalada do Phosphor (kebab-case), carregados no import.
ICON_KEYS: frozenset[str] = frozenset(_NAMES)

#: Versão do pacote de onde o catálogo foi gerado (diagnóstico).
PHOSPHOR_VERSION: str = _VERSION


def is_kebab_case(value: str) -> bool:
    """``True`` se ``value`` respeita a grafia kebab-case do catálogo."""
    return bool(_KEBAB_CASE.match(value))


def is_valid_icon_key(value: str) -> bool:
    """``True`` se ``value`` é um nome de glifo existente, em kebab-case.

    Duas condições, não uma: a grafia (kebab-case) e a existência no catálogo.
    Na prática a segunda implica a primeira — todo nome do catálogo é kebab —,
    mas manter a checagem de forma explícita documenta que PascalCase é
    rejeitado por regra de contrato e não por acidente de conteúdo.
    """
    return isinstance(value, str) and is_kebab_case(value) and value in ICON_KEYS


def validate_icon_key(value):
    """Validador de serializer para ``icon_key`` — 400 em chave inexistente.

    ``None`` passa (limpar o pictograma é legítimo). Qualquer outro valor tem de
    ser um nome de glifo existente **em kebab-case**; PascalCase (``AddressBook``,
    o export do pacote) é rejeitado de propósito — o wire carrega o nome público
    do Phosphor, e a conversão para o export é responsabilidade do frontend.

    Mora aqui, e não numa camada de serviço, porque a AC pede **400**: todo
    ``DomainError`` de service vira 409 (``core/exceptions.py``). Mesma
    duplicação deliberada de camada que ``health/services.py`` já documenta para
    a regra de enum. Compartilhado por ``habits`` e ``health`` — uma única
    definição da regra, um único texto de erro.
    """
    if value is None:
        return None
    if not is_valid_icon_key(value):
        raise serializers.ValidationError(
            f"Pictograma inexistente no catálogo Phosphor {PHOSPHOR_VERSION}. "
            "Use o nome do glifo em kebab-case (ex.: 'address-book')."
        )
    return value
