import { Box } from '@mui/material'

import { typography } from '../../../shared/design/tokens'

/**
 * Seam legado — **faixa editorial** no início do conteúdo (tratamento A,
 * aprovado na Story 13.0). Informa que a superfície ainda usa a versão
 * anterior.
 *
 * Contrato (rejeições explícitas do reconcile da 13.0):
 *  · não envolve o conteúdo numa moldura nova — borda só à esquerda;
 *  · não oferece toggle Legado/Moderno;
 *  · **não pode ser dispensada** (sem botão, sem `localStorage`);
 *  · não é `role="alert"` nem live region — não é erro e não pode ser
 *    anunciada a cada troca de rota. É conteúdo estático no fluxo de leitura.
 *
 * Desaparece exclusivamente quando `shellRouting.ts` marca a rota como
 * `surfaceMigrated: true`.
 *
 * Renderiza um `aside` (landmark `complementary`) porque a faixa vive FORA do
 * `<main>` da página — o shell não introduz um segundo `main`. Sem o landmark,
 * o texto do seam fica como conteúdo solto e o axe reprova a regra `region`
 * ("All page content should be contained by landmarks") nos testes de chrome.
 */
export function LegacySeamNotice() {
  return (
    <Box
      component="aside"
      data-testid="legacy-seam-notice"
      style={{
        background: 'var(--ds-info-soft)',
        color: 'var(--ds-info)',
        borderLeftWidth: 'var(--ds-legacy-seam-border-width)',
        borderLeftStyle: 'solid',
        borderLeftColor: 'var(--ds-info)',
      }}
      sx={{
        margin: 0,
        marginBottom: 'var(--ds-space-4)',
        padding: 'var(--ds-space-3)',
        ...typography.meta,
      }}
    >
      <Box component="strong" sx={{ display: 'block', color: 'var(--ds-ink)' }}>
        Esta área ainda usa a versão anterior.
      </Box>
      Você pode continuar trabalhando normalmente enquanto esta superfície é atualizada.
    </Box>
  )
}
