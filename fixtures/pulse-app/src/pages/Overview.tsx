import { Button, Card } from '@pulse/ui'
import { cn } from '../lib/cn'
import { StatusBadge } from '../components/StatusBadge'

export function Overview({ tone, compact }: { tone: string; compact: boolean }) {
  return (
    <Card className={cn('p-4 bg-surface text-ink', compact && 'gap-[12px]', `bg-${tone}-500 shadow-sm`)}>
      <h2 className="text-[1.25rem] text-ink">Overview</h2>
      <div className="flex gap-2 bg-chart-1 rounded-lg">
        {/* ds-exception: EXC-001 */}
        <span className="bg-[#2e7d32]" />
        <span className="bg-blue-500 hover:bg-brand" />
      </div>
      <StatusBadge tone="danger" label="Late" />
      <Button className="mt-[13px]">Open</Button>
    </Card>
  )
}
