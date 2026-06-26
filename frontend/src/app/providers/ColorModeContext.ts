import { createContext, useContext } from 'react'

interface ColorModeContextValue {
  mode: 'light' | 'dark'
  toggle: () => void
}

export const ColorModeContext = createContext<ColorModeContextValue>({
  mode: 'light',
  toggle: () => {},
})

export function useColorMode() {
  return useContext(ColorModeContext)
}
