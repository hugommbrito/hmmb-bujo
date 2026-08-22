---
title: Estado e composição do frontend
aliases:
  - Server state
  - Manifest de Collections
type: decision
status: current
source_files:
  - _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
source_updated: 2026-07-29
tags:
  - kb/decisions
  - kb/architecture
---

# Estado e composição do frontend

O frontend deriva verdade remota do TanStack Query, compõe domínios somente nas pages/app e deriva a navegação de Collections de um registro estático.

## Decisões

- Dados do servidor não são duplicados em store de cliente.
- Mutações invalidam chaves; contadores não recebem ajustes manuais espalhados.
- `userId` participa das query keys e logout limpa o cache.
- Features não se importam entre si.
- O manifest de Collections contém dados puros, sem hooks ou efeitos.
- Núcleo BuJo fica fora do manifest e não pode ser desativado.
- Home e Hoje reutilizarão um único componente de tarefas diárias.
- O novo design system coexiste por rota até a remoção do legado.

## Exceção explícita

Filhas de Custom Collections poderão usar estado do servidor confinado ao grupo dinâmico do container; isso não transforma o manifest estático em server state.

## Fontes

- `_bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md` — AD-13, AD-17, AD-21, AD-22 e AD-29.
