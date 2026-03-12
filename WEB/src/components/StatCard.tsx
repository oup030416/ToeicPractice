import type { ReactNode } from 'react'

import type { BadgeTone } from '../lib/sync-view-model'
import { cn } from '../lib/format'

const accentClassMap: Record<BadgeTone, string> = {
  brand: 'bg-blue-50 text-blue-900 ring-blue-100',
  accent: 'bg-amber-50 text-amber-900 ring-amber-100',
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
  danger: 'bg-rose-50 text-rose-900 ring-rose-100',
  neutral: 'bg-slate-50 text-slate-900 ring-slate-100',
}

interface StatCardProps {
  title: string
  value: string
  caption: string
  icon: ReactNode
  tone?: BadgeTone
}

export function StatCard({
  title,
  value,
  caption,
  icon,
  tone = 'neutral',
}: StatCardProps) {
  return (
    <article
      className={cn(
        'rounded-3xl p-4 ring-1 ring-inset sm:p-5',
        accentClassMap[tone],
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-current/80">{title}</p>
        <div className="rounded-2xl bg-white/80 p-2 text-current">{icon}</div>
      </div>
      <p className="font-mono text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm leading-6 text-current/75">{caption}</p>
    </article>
  )
}
