import { CheckCircle2, Info, TriangleAlert } from 'lucide-react'

import type { BadgeTone } from '../lib/sync-view-model'
import { cn } from '../lib/format'

export interface ToastItem {
  id: number
  title: string
  description?: string
  tone: BadgeTone
}

const toneClassMap: Record<BadgeTone, string> = {
  brand: 'border-blue-200 bg-blue-50 text-blue-950',
  accent: 'border-amber-200 bg-amber-50 text-amber-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  danger: 'border-rose-200 bg-rose-50 text-rose-950',
  neutral: 'border-slate-200 bg-white text-slate-900',
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col gap-3 sm:left-auto sm:right-6 sm:w-[24rem]">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          role={toast.tone === 'danger' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto rounded-2xl border p-4 shadow-lg shadow-slate-900/10 backdrop-blur',
            toneClassMap[toast.tone],
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {toast.tone === 'danger' ? (
                <TriangleAlert className="size-4" />
              ) : toast.tone === 'success' ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Info className="size-4" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="text-sm leading-6 opacity-80">{toast.description}</p>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
