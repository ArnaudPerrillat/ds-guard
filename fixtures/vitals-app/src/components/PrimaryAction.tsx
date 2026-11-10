import { forwardRef } from 'react'
import { Button, type ButtonProps } from '@vitals/ui'

/** In-house wrapper: always a primary button. */
export const PrimaryAction = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => <Button ref={ref} variant="primary" {...props} />)
