import type { ReactNode } from 'react'

import { cn } from '../lib/format'

interface SectionCardProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function SectionCard({
  title,
  subtitle,
  action,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6',
        className,
      )}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-mono text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  )
}
