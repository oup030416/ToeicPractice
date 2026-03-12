import type { ReactNode } from 'react'

export const inputClass =
  'mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

export const areaClass =
  'mt-2 min-h-32 w-full rounded-3xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

export function EditorSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="space-y-1">
        <h3 className="font-medium text-slate-950">{title}</h3>
        {description ? (
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  )
}

export function JsonArea({
  label,
  value,
  onChange,
  help,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  help?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className={areaClass}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {help ? <p className="mt-2 text-xs leading-5 text-slate-500">{help}</p> : null}
    </label>
  )
}

export function SectionActionRow({
  primaryLabel,
  onPrimary,
  dangerLabel,
  onDanger,
}: {
  primaryLabel: string
  onPrimary: () => void
  dangerLabel?: string
  onDanger?: () => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
        onClick={onPrimary}
        type="button"
      >
        {primaryLabel}
      </button>
      {dangerLabel && onDanger ? (
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          onClick={onDanger}
          type="button"
        >
          {dangerLabel}
        </button>
      ) : null}
    </div>
  )
}
