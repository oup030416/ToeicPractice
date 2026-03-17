export interface StoredDraftDocument {
  rawText: string
  fileName: string | null
  savedAt: string
}

const STORAGE_KEY = 'toeic-web-v1:last-sync-document'

export function loadStoredDraftDocument(): StoredDraftDocument | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored) as Partial<StoredDraftDocument>

    if (typeof parsed.rawText !== 'string') {
      return null
    }

    return {
      rawText: parsed.rawText,
      fileName: typeof parsed.fileName === 'string' ? parsed.fileName : null,
      savedAt:
        typeof parsed.savedAt === 'string'
          ? parsed.savedAt
          : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function saveStoredDraftDocument(document: StoredDraftDocument) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document))
}

export const loadStoredSyncDocument = loadStoredDraftDocument
export const saveStoredSyncDocument = saveStoredDraftDocument
