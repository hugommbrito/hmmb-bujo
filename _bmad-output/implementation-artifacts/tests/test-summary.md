# Sumário de Automação de Testes — Story 1.4

**Data:** 2026-06-26
**Story:** 1.4 — Contrato de API e padrões da camada de serviço
**Suite base:** 46 testes (Stories 1.1–1.3)
**Suite final:** 53 testes (+7 gaps cobertos)

---

## Testes Gerados

### Testes de API — `backend/core/tests/test_api_contract.py`

| Teste | AC | Resultado |
|---|---|---|
| `test_camelcase_renderer_converte_snake_case` | AC2 | ✅ pré-existente |
| `test_jsonb_dynamic_keys_sobrevivem_ao_roundtrip` | AC2 | ✅ pré-existente |
| `test_jsonb_ignore_fields_configurado_no_renderer` | AC2 | ✅ pré-existente |
| `test_schema_endpoint_retorna_200` | AC1 | ✅ pré-existente |
| `test_schema_titulo_e_versao_corretos` | AC1 | ✅ **novo** |
| `test_health_excluido_do_schema` | AC1 | ✅ **novo** |
| `test_camelcase_parser_converte_para_snake_case` | AC2 | ✅ **novo** |
| `test_core_pagination_atributos` | AC3 | ✅ **novo** |
| `test_paginacao_shape_padrao` | AC3 | ✅ **novo** |
| `test_paginacao_class_e_page_size_configurados` | AC3 | ✅ **novo** |
| `test_filter_backends_configurados` | AC3 | ✅ **novo** |

### Testes de Serviço — `backend/core/tests/test_services.py`

| Teste | AC | Resultado |
|---|---|---|
| `test_service_exige_keyword_args` | AC3 | ✅ pré-existente |
| `test_service_levanta_domain_error_para_user_none` | AC3 | ✅ pré-existente |
| `test_service_levanta_domain_error_para_name_vazio` | AC3 | ✅ pré-existente |
| `test_service_happy_path` | AC3 | ✅ pré-existente |

---

## Gaps Descobertos e Fechados

| AC | Gap | Teste adicionado |
|---|---|---|
| AC1 | `SPECTACULAR_SETTINGS` (title/version) não validado | `test_schema_titulo_e_versao_corretos` |
| AC1 | `@extend_schema(exclude=True)` no health não verificado | `test_health_excluido_do_schema` |
| AC2 | `CamelCaseJSONParser` (body camelCase→snake_case) sem teste | `test_camelcase_parser_converte_para_snake_case` |
| AC3 | `CorePagination` atributos não testados diretamente | `test_core_pagination_atributos` |
| AC3 | Shape de paginação `{count, next, previous, results}` | `test_paginacao_shape_padrao` |
| AC3 | `DEFAULT_PAGINATION_CLASS` e `PAGE_SIZE` nos settings | `test_paginacao_class_e_page_size_configurados` |
| AC3 | `DEFAULT_FILTER_BACKENDS` (DjangoFilterBackend + OrderingFilter) | `test_filter_backends_configurados` |

---

## Cobertura por AC

| AC | Descrição | Cobertura |
|---|---|---|
| AC1 | Schema OpenAPI, endpoint `/api/schema/`, title/version, health excluído | ✅ 4/4 |
| AC2 | CamelCase renderer + parser, JSONB round-trip, ignore_fields configurado | ✅ 4/4 |
| AC3 | CorePagination atributos + shape, settings configurados, filtros, serviço canônico | ✅ 7/7 |

---

## Resultados Finais

```
53 passed in 1.15s
ruff check: All checks passed
lint-imports: 1 kept, 0 broken
```

## Próximos Passos

- Testes de integração com endpoints reais quando endpoints de domínio existirem (Story 2.1+)
- Testar parser JSONB round-trip via HTTP quando houver endpoint com campo `values` (Story 2.x)
