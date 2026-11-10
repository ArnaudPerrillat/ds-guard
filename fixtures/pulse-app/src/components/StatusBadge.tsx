import { cva } from 'class-variance-authority'

const badge = cva('inline-flex px-2 py-[2px] rounded-[6px] text-body', {
  variants: {
    tone: {
      neutral: 'bg-surface text-ink',
      danger: ['bg-[#c62828]', 'text-white'],
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function StatusBadge({ tone, label }: { tone: 'neutral' | 'danger'; label: string }) {
  return <span className={badge({ tone })}>{label}</span>
}
