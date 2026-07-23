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
