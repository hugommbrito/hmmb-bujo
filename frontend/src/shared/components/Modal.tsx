import { Dialog } from '@mui/material'
import type { DialogProps } from '@mui/material'

type ModalProps = DialogProps & {
  'aria-label': string
}

export function Modal({ children, 'aria-label': ariaLabel, slotProps, ...props }: ModalProps) {
  return (
    <Dialog
      {...props}
      slotProps={{ ...slotProps, paper: { 'aria-label': ariaLabel, ...slotProps?.paper } }}
    >
      {children}
    </Dialog>
  )
}
