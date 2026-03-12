import type { ReactNode } from 'react'

import type { BadgeTone } from '../lib/sync-view-model'
import { cn } from '../lib/format'

const toneClassMap: Record<BadgeTone, string> = {
  brand: 'bg-blue-100 text-blue-800 ring-blue-200',
  accent: 'bg-amber-100 text-amber-900 ring-amber-200',
  success: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  danger: 'bg-rose-100 text-rose-900 ring-rose-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
}

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        toneClassMap[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
