import 'vitest'

interface CustomMatchers<R = unknown> {
  toHaveNoViolations(): R
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentação de tipo padrão (sem membros próprios por design)
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentação de tipo padrão (sem membros próprios por design)
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
