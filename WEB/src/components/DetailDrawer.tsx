import { useEffect, useEffectEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '../lib/format'

interface DetailDrawerProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

export function DetailDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: DetailDrawerProps) {
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose()
    }
  })

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const listener = (event: KeyboardEvent) => handleEscape(event)
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', listener)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', listener)
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-stretch md:justify-end">
      <button
        aria-label="상세패널 닫기"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby="detail-drawer-title"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[88dvh] w-full flex-col rounded-t-[32px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)] md:h-full md:max-h-none md:w-[36rem] md:rounded-none md:rounded-l-[32px]',
        )}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <h2 id="detail-drawer-title" className="font-mono text-lg font-semibold text-slate-950">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
            ) : null}
          </div>
          <button
            aria-label="패널 닫기"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
