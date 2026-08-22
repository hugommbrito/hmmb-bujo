"""Serializers do endpoint externo de captura (`POST /api/capture`, AC1/AC4).

View fina (§6.2): estes serializers só validam a **forma** do payload raso
`{type, text, value?}` e a **forma** da resposta curta `{id}`. A regra de
domínio (qual `type` cria o quê, tipo desconhecido) vive no dispatcher
(`automation.services.dispatch_capture`), não aqui.

Todos os campos são palavras únicas (`type`/`text`/`value`/`id`) → o
CamelCase parser/renderer da borda (§6.3) é no-op aqui; nenhum campo com `_`.
"""

from rest_framework import serializers


class CaptureRequestSerializer(serializers.Serializer):
    # `CharField` ABERTO, NÃO `ChoiceField`: acoplar o contrato OpenAPI à lista de
    # tipos faria cada tipo novo mudar o enum no schema.yaml/types.gen.ts. O
    # campo aberto + dispatcher por `match` (AC4) mantém o contrato estável; a
    # mensagem 400 de tipo desconhecido vem do dispatcher, não daqui. (Ver Dev
    # Notes › "Por que `type` é `CharField` e não `ChoiceField`".)
    type = serializers.CharField()  # obrigatório, não-vazio (allow_blank=False default)
    # `text` → `BrainDumpItem.title` (max_length=500). Obrigatório e não-branco.
    text = serializers.CharField(max_length=500)
    # `value` é RESERVADO para tipos futuros — sem consumidor na captura de
    # braindump (mesma disciplina de campo reservado das Stories 12.3/12.4).
    value = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class CaptureResponseSerializer(serializers.Serializer):
    # Corpo curto do 201 (AD-19 "resposta curta"): só o id do item criado, para
    # o atalho iOS confirmar a captura.
    id = serializers.UUIDField(read_only=True)


# --- Resumo do dia (`GET /api/summary/today`, Story 12.6, AC1/AC2) ------------
#
# Serializers de RESPOSTA (só `to_representation`, todos `read_only`): tipam o
# contrato OpenAPI e serializam os dados brutos de `build_today_summary`.
#
# CamelCase na borda (§6.3) ENTRA EM JOGO aqui (≠ 12.5, cujos campos eram
# palavras únicas): o `CamelCaseJSONRenderer` cameliza RECURSIVAMENTE toda a
# resposta no render do corpo HTTP — os nomes snake_case abaixo viram camelCase
# no JSON e no `schema.yaml`/`types.gen.ts`: `pending_tasks`→`pendingTasks`,
# `last_journal_entry`→`lastJournalEntry`. `response.data` (pré-render) continua
# snake_case (precedente testado da Story 12.2).


class SummaryTaskSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)


class SummaryHabitsGroupSerializer(serializers.Serializer):
    # Casa o shape de `_grouped_completeness` (`{id, name, completion}`).
    # `HabitGroup` herda `id` UUID de `TenantModel`; `completion` é int (percentual).
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    completion = serializers.IntegerField(read_only=True)


class SummaryHabitsSerializer(serializers.Serializer):
    total = serializers.IntegerField(read_only=True)
    groups = SummaryHabitsGroupSerializer(many=True, read_only=True)


class SummaryJournalEntrySerializer(serializers.Serializer):
    text = serializers.CharField(read_only=True)
    date = serializers.DateField(read_only=True)


class SummaryResponseSerializer(serializers.Serializer):
    date = serializers.DateField(read_only=True)
    pending_tasks = SummaryTaskSerializer(many=True, read_only=True)
    habits = SummaryHabitsSerializer(read_only=True)
    # `allow_null=True`: quando não há reflexão, `build_today_summary` devolve
    # `None` e a borda renderiza `lastJournalEntry: null` (marca o campo como
    # nullable no OpenAPI).
    last_journal_entry = SummaryJournalEntrySerializer(read_only=True, allow_null=True)
