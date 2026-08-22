# Test Automation Summary — Story 14.8 (Recorrentes no sistema novo, M09)

## Contexto

A story chegou ao passo de QA com status `review` e a implementação (Fases A–D,
Tasks 1–11) já completa em disco, incluindo E2E próprio (`recurring-library.spec.ts`,
9 testes) e atualizações em 6 specs legados acoplados. Este passo verificou a
suíte existente contra os ACs (sem confiar nas checkboxes/claims da story),
re-executou todos os gates do zero e gerou cobertura adicional para os gaps
reais encontrados.

## Verificação da suíte existente (sem regressão)

| Gate | Resultado | Bate com o claim da story? |
|---|---|---|
| `npx vitest run` | 1748 passed / 131 arquivos | Sim |
| `npx tsc -b --noEmit` | limpo | Sim |
| `npm run lint` | limpo | Sim |
| `uv run pytest -q` | 1314 passed em 257,35s | Sim |
| `uv run ruff check .` | limpo | Sim |
| `uv run lint-imports` | 1 kept / 0 broken | Sim |
| `makemigrations --check --dry-run` | "No changes detected" | Sim |
| diff `schema.yaml`/`types.gen.ts` | vazio | Sim |
| `migrate --check` (branch Neon `e2e`) | limpo | Sim |
| Playwright, 7 specs afetados, `CI=1 --retries=0` | 36 passed / 5 failed em 41 | Sim — mesmos locators/posições da AC9 (placement legado, causa raiz alheia a esta story) |

Os 6 specs E2E alterados pelo dev-story (`archive`, `future-log-annual`,
`future-log-board`, `recurring-soft-delete`, `recurring-templates`, `shell`)
foram lidos linha a linha contra o contrato exato da AC5/AC9 — sem achado.

## Gaps encontrados e fechados

Dois comportamentos contratados por AC só tinham prova em jsdom (mutação
mockada), nunca contra o browser real / backend real — exatamente a classe de
risco que as Stories 14.6/14.7 pagaram por medir estrutura ARIA nova sem
exercitar o caminho de verdade:

1. **Falha de escrita (criar) e falha do `DELETE` nunca fecham card/dialog,
   sempre oferecem retry (AC3/AC4).** Novo teste intercepta `POST`/`DELETE`
   reais via `page.route()`, força `500` na 1ª tentativa, prova a cópia exata
   do erro e o rascunho preservado, depois deixa a 2ª tentativa passar.
2. **O `alertdialog` de exclusão nasce com foco em "Cancelar" (ação
   não-destrutiva) e devolve o foco ao acionador ao fechar, por Escape e por
   Cancelar (AC6).** Não havia nenhuma prova disso — nem unit, nem E2E. Novo
   teste com `toBeFocused()` nos dois pontos.

**Não-vacuidade provada para o teste de foco** (contrato de acessibilidade):
comentei temporariamente o `onEntered` de foco em `RecurringLibraryPage.tsx`,
rodei o teste isolado e vi **FALHAR** (`Received: inactive`); restaurei e
confirmei verde de novo. O teste de falha de escrita/DELETE é contrato
funcional (não correção nem a11y estrito) — as asserções são todas de
presença de texto/valor específico, não-vacuas por construção.

## Generated Tests

### E2E Tests

- [x] `frontend/e2e/recurring-library.spec.ts` — 2 testes novos adicionados
      (9 → 11), ambos na faixa wide:
  - `falha de escrita ao criar preserva o rascunho com retry; falha do DELETE
    mantém dialog utilizável com retry — nunca fecha em cima de um erro (AC3/AC4)`
  - `o dialog de confirmação nasce com foco em "Cancelar" (ação não-destrutiva)
    e devolve o foco ao acionador ao fechar, por Escape e por Cancelar (AC6)`

Nenhum outro arquivo E2E foi criado ou alterado por este passo — os 6 specs
legados acoplados (`archive`, `future-log-annual`, `future-log-board`,
`recurring-soft-delete`, `recurring-templates`, `shell`) já vieram corretos do
dev-story.

## Execução final

`CI=1 npx playwright test e2e/recurring-library.spec.ts --retries=0`:
**11 passed (2,3min)**, incluindo os 2 novos.

**Correção (code-review):** a tabela acima ("36 passed / 5 failed em 41") mede
o combinado dos 7 specs ANTES de os 2 testes novos entrarem em
`recurring-library.spec.ts` — nunca foi re-executada depois, o mesmo defeito de
"número de gate afirmado sem execução" que a própria story 14.8 cita como
lição das 14.3/14.6. Re-executado no HEAD final:
`CI=1 npx playwright test e2e/recurring-library.spec.ts e2e/recurring-templates.spec.ts e2e/recurring-soft-delete.spec.ts e2e/future-log-annual.spec.ts e2e/shell.spec.ts e2e/future-log-board.spec.ts e2e/archive.spec.ts --retries=0`
→ **38 passed / 5 failed em 43** (36+2 novos verdes; os 5 vermelhos continuam
nos mesmos locators/posições da AC9 — sem regressão). Este é o número final.

## Coverage

- AC1–AC9: cobertas (dev-story) + 2 lacunas de comportamento sob falha/foco
  fechadas por este passo.
- Nenhuma API/backend tocada (fora de escopo da story — M09 é 100% cliente).

## Next Steps

- Nenhum. Story permanece em `review`; recomendação: seguir para o rito de
  code-review normal do épico.
