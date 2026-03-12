import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '없음'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '없음'
  }

  return value.toLocaleString('ko-KR')
}

export function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '없음'
  }

  return `${Math.round(value)}%`
}

export function safePrettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return 'JSON 문자열로 변환할 수 없습니다.'
  }
}

export function slugifyFileName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'toeic-web-sync'
}

export function toKoreanList(values: string[], limit = 3) {
  const picked = values.slice(0, limit)

  if (picked.length === 0) {
    return '없음'
  }

  return picked.join(' · ')
}
