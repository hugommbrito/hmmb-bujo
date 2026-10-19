// ─────────────────────────────────────────────────────────────────────────────
// Leitura do envelope de erro de DOMÍNIO do backend (Story 14.11).
//
// `core/exceptions.py` uniformiza todo erro em `{ detail, fields?, code? }`. Os
// gates de ciclo (`services/cycles.py`) respondem 409 com `detail` legível em
// pt-BR e `code` = chave do gate (`previous_finalized`, `no_open_tasks`, …).
// Antes desta story as ações de ciclo engoliam o 409 e nenhum botão dizia por
// quê. `src/api/client.ts` só trata 401 (refresh de token) — todo outro status
// chega aqui como `AxiosError` intacto.
//
//   ▶ Só o 409 carrega `detail` que vale a pena mostrar como está: é o motivo
//     de domínio escrito para o usuário. Fora dele (rede, 500, 400 de
//     validação) vale o `fallback` genérico de cada chamador — um 400 de
//     campo tem `fields` e pertence a quem conhece o formulário.
// ─────────────────────────────────────────────────────────────────────────────
import { isAxiosError } from 'axios'

export interface DomainErrorBody {
  detail?: unknown
  code?: unknown
  fields?: Record<string, string[]>
}

function conflictBody(error: unknown): DomainErrorBody | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null
  const data: unknown = error.response.data
  return data !== null && typeof data === 'object' ? (data as DomainErrorBody) : null
}

/** `detail` de um 409 de domínio, ou `fallback` para qualquer outro erro. */
export function domainErrorMessage(error: unknown, fallback: string): string {
  const body = conflictBody(error)
  return typeof body?.detail === 'string' && body.detail.trim() !== '' ? body.detail : fallback
}

/** `code` de um 409 de domínio (chave do gate), ou `null`. */
export function domainErrorCode(error: unknown): string | null {
  const body = conflictBody(error)
  return typeof body?.code === 'string' ? body.code : null
}

// ─── Erro de CAMPO num 400 de validação (Story 16.2c) ────────────────────────
// O handler central responde 400 como `{detail, fields: {campo: [msg, …]}}`.
// Quem conhece o formulário lê a mensagem do SEU campo e a mostra como está;
// `domainErrorMessage` (409) fica intacto — são envelopes distintos.

function validationBody(error: unknown): DomainErrorBody | null {
  if (!isAxiosError(error) || error.response?.status !== 400) return null
  const data: unknown = error.response.data
  return data !== null && typeof data === 'object' ? (data as DomainErrorBody) : null
}

/**
 * Primeira mensagem de `fields[field]` num 400 de validação, ou `null` para
 * qualquer outro erro (409, 500, rede, 400 sem esse campo). Puro: não decide o
 * que fazer com a mensagem — o chamador escolhe mostrar e/ou suprimir o retry.
 */
export function fieldErrorMessage(error: unknown, field: string): string | null {
  const body = validationBody(error)
  const messages: unknown = body?.fields?.[field]
  const first: unknown = Array.isArray(messages) ? messages[0] : undefined
  return typeof first === 'string' && first.trim() !== '' ? first : null
}
