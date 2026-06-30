import { describe, it, expect, beforeEach } from 'vitest'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStorage'

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getAccessToken', () => {
    it('retorna null quando access_token não está no localStorage', () => {
      expect(getAccessToken()).toBeNull()
    })

    it('retorna o token quando access_token está no localStorage', () => {
      localStorage.setItem('access_token', 'meu-access-token')
      expect(getAccessToken()).toBe('meu-access-token')
    })
  })

  describe('getRefreshToken', () => {
    it('retorna null quando refresh_token não está no localStorage', () => {
      expect(getRefreshToken()).toBeNull()
    })

    it('retorna o token quando refresh_token está no localStorage', () => {
      localStorage.setItem('refresh_token', 'meu-refresh-token')
      expect(getRefreshToken()).toBe('meu-refresh-token')
    })
  })

  describe('setTokens', () => {
    it('persiste access_token e refresh_token no localStorage', () => {
      setTokens('novo-access', 'novo-refresh')
      expect(localStorage.getItem('access_token')).toBe('novo-access')
      expect(localStorage.getItem('refresh_token')).toBe('novo-refresh')
    })

    it('sobrescreve tokens existentes', () => {
      localStorage.setItem('access_token', 'antigo-access')
      localStorage.setItem('refresh_token', 'antigo-refresh')
      setTokens('novo-access', 'novo-refresh')
      expect(localStorage.getItem('access_token')).toBe('novo-access')
      expect(localStorage.getItem('refresh_token')).toBe('novo-refresh')
    })
  })

  describe('clearTokens', () => {
    it('remove access_token e refresh_token do localStorage', () => {
      localStorage.setItem('access_token', 'token-a')
      localStorage.setItem('refresh_token', 'token-r')
      clearTokens()
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })

    it('não lança erro quando tokens não existem', () => {
      expect(() => clearTokens()).not.toThrow()
    })
  })
})
