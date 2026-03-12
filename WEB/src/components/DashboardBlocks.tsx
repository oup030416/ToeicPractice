import { ChevronRight, Database } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from './Badge'
import { cn, formatNumber, safePrettyJson } from '../lib/format'
import type { BadgeTone, CountSummary, MaterialSummaryCard } from '../lib/sync-view-model'

function countBarWidth(items: CountSummary[], value: number) {
  const max = items[0]?.count ?? value

  if (max === 0) {
    return '0%'
  }

  return `${Math.max(18, Math.round((value / max) * 100))}%`
}

function countTone(index: number): BadgeTone {
  if (index === 0) {
    return 'brand'
  }

  if (index === 1) {
    return 'accent'
  }

  return 'neutral'
}

export function CountList({
  items,
  emptyText,
}: {
  items: CountSummary[]
  emptyText: string
}) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-slate-500">{emptyText}</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.key} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{item.key}</span>
            <Badge tone={countTone(index)}>{formatNumber(item.count)}</Badge>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: countBarWidth(items, item.count) }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ActionTile({
  icon,
  title,
  description,
  onClick,
  disabled = false,
}: {
  icon: ReactNode
  title: string
  description: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={cn(
        'group flex min-h-28 flex-col items-start justify-between rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-300 hover:bg-blue-50',
        disabled && 'cursor-not-allowed opacity-50 hover:border-slate-200 hover:bg-slate-50',
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="rounded-2xl bg-white p-2 text-blue-800 shadow-sm">{icon}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-900">{title}</p>
          <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
        </div>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </button>
  )
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 break-all text-sm leading-6 text-slate-900">{value}</dd>
    </div>
  )
}

export function MiniPanel({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-2xl bg-white p-2 text-blue-800 shadow-sm">{icon}</div>
        <h3 className="font-medium text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export function SubList({
  title,
  items,
  emptyText,
}: {
  title: string
  items: string[]
  emptyText: string
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          {items.map((item) => (
            <li key={`${title}-${item}`} className="rounded-2xl bg-white px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500">{emptyText}</p>
      )}
    </section>
  )
}

export function MaterialSection({
  title,
  cards,
  emptyText,
}: {
  title: string
  cards: MaterialSummaryCard[]
  emptyText: string
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-blue-800" />
        <h3 className="font-medium text-slate-900">{title}</h3>
      </div>
      {cards.length > 0 ? (
        cards.map((card) => (
          <details
            className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
            key={card.id}
          >
            <summary className="cursor-pointer list-none space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{card.part}</Badge>
                <Badge>{card.sourceLabel}</Badge>
              </div>
              <p className="font-medium text-slate-950">{card.title}</p>
              <p className="text-sm leading-6 text-slate-600">{card.anchor}</p>
            </summary>
            <pre className="mt-4 overflow-auto rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              {safePrettyJson(card.raw)}
            </pre>
          </details>
        ))
      ) : (
        <EmptyMessage text={emptyText} />
      )}
    </section>
  )
}

export function EmptyMessage({ text }: { text: string }) {
  return <p className="text-sm leading-6 text-slate-500">{text}</p>
}
