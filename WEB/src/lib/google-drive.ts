import { slugifyFileName } from './format'
import { safePrettyJson } from './format'
import { createDefaultSyncDocument } from './default-sync'
import { type ToeicWebSyncV1 } from './sync-schema'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const LIVE_FILE_NAME = 'toeic_web_sync.json'
const BACKUPS_FOLDER_NAME = 'backups'
const STORAGE_CONTEXT_KEY = 'toeic-web-v1:drive-context'
const BACKUP_INTERVAL_MS = 30 * 60 * 1000
const MAX_BACKUP_COUNT = 30

export type DriveConnectionState =
  | 'disconnected'
  | 'authorizing'
  | 'picking'
  | 'connected'
  | 'syncing'
  | 'reconnect-required'
  | 'error'

export interface StoredDriveContext {
  folderId: string
  folderName: string
  liveFileId: string
  backupsFolderId: string
  accountEmail: string | null
  lastSyncAt: string | null
  lastBackupAt: string | null
}

export type DriveSession = StoredDriveContext

export interface DriveBootstrapResult {
  session: DriveSession
  rawText: string
}

export interface DriveSyncResult {
  session: DriveSession
  syncedAt: string
  backedUpAt: string | null
}

export interface DriveSyncAdapter {
  isConfigured(): boolean
  getConfigError(): string | null
  connect(options: {
    context: StoredDriveContext | null
    interactive: boolean
    pickFolder: boolean
    seedDocument: ToeicWebSyncV1 | null
  }): Promise<DriveBootstrapResult>
  refresh(session: DriveSession): Promise<DriveBootstrapResult>
  sync(session: DriveSession, rawText: string): Promise<DriveSyncResult>
}

class DriveAdapterError extends Error {
  code: 'config' | 'auth' | 'picker' | 'invalid-context' | 'drive'
  status: number | null

  constructor(
    code: DriveAdapterError['code'],
    message: string,
    status: number | null = null,
  ) {
    super(message)
    this.name = 'DriveAdapterError'
    this.code = code
    this.status = status
  }
}

interface GoogleDriveConfig {
  clientId: string
  apiKey: string
  appId: string
}

interface TokenState {
  accessToken: string
  expiresAt: number
  accountEmail: string | null
}

interface DriveFile {
  id: string
  name: string
  modifiedTime?: string
  mimeType?: string
}

function extractPickerDocs(data: GooglePickerResponseObject) {
  const docsFromDefault = Array.isArray(data.docs) ? data.docs : null
  if (docsFromDefault) {
    return docsFromDefault
  }

  const documentsKey = window.google?.picker.Response.DOCUMENTS
  if (!documentsKey) {
    return []
  }

  const docsFromResponse = data[documentsKey]
  return Array.isArray(docsFromResponse) ? (docsFromResponse as GooglePickerDocumentObject[]) : []
}

function extractPickerAction(data: GooglePickerResponseObject) {
  if (typeof data.action === 'string') {
    return data.action
  }

  const actionKey = window.google?.picker.Response.ACTION
  const actionValue = actionKey ? data[actionKey] : null
  return typeof actionValue === 'string' ? actionValue : null
}

function extractPickerFolder(data: GooglePickerResponseObject) {
  const docs = extractPickerDocs(data)
  const firstDoc = docs[0]

  if (!firstDoc) {
    return null
  }

  const idKey = window.google?.picker.Document.ID
  const nameKey = window.google?.picker.Document.NAME
  const folderId =
    typeof firstDoc.id === 'string'
      ? firstDoc.id
      : idKey && typeof firstDoc[idKey] === 'string'
        ? (firstDoc[idKey] as string)
        : null
  const folderName =
    typeof firstDoc.name === 'string'
      ? firstDoc.name
      : nameKey && typeof firstDoc[nameKey] === 'string'
        ? (firstDoc[nameKey] as string)
        : null

  if (!folderId) {
    return null
  }

  return {
    folderId,
    folderName: folderName?.trim() ? folderName : 'Google Drive 폴더',
  }
}

function loadConfig(): GoogleDriveConfig | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY?.trim() ?? ''
  const appId = import.meta.env.VITE_GOOGLE_APP_ID?.trim() ?? ''

  if (
    !clientId ||
    !apiKey ||
    !appId ||
    !clientId.endsWith('.apps.googleusercontent.com') ||
    !/^\d+$/.test(appId) ||
    clientId.includes('YOUR_') ||
    apiKey.includes('YOUR_') ||
    appId.includes('YOUR_')
  ) {
    return null
  }

  return { clientId, apiKey, appId }
}

function buildDriveQuery(parts: string[]) {
  return parts.join(' and ')
}

function formatBackupFileName(now: Date) {
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}_${hour}_${minute}.json`
}

function ensureTopLevelObject(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createSeedRawText(seedDocument: ToeicWebSyncV1 | null, folderName: string) {
  if (seedDocument) {
    return safePrettyJson(seedDocument)
  }

  return safePrettyJson(
    createDefaultSyncDocument(`${slugifyFileName(folderName)}-workspace`),
  )
}

function readStoredContext() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_CONTEXT_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<StoredDriveContext>
    if (
      typeof parsed.folderId !== 'string' ||
      typeof parsed.folderName !== 'string' ||
      typeof parsed.liveFileId !== 'string' ||
      typeof parsed.backupsFolderId !== 'string'
    ) {
      return null
    }

    return {
      folderId: parsed.folderId,
      folderName: parsed.folderName,
      liveFileId: parsed.liveFileId,
      backupsFolderId: parsed.backupsFolderId,
      accountEmail: typeof parsed.accountEmail === 'string' ? parsed.accountEmail : null,
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
    } satisfies StoredDriveContext
  } catch {
    return null
  }
}

function writeStoredContext(context: StoredDriveContext | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!context) {
    window.localStorage.removeItem(STORAGE_CONTEXT_KEY)
    return
  }

  window.localStorage.setItem(STORAGE_CONTEXT_KEY, JSON.stringify(context))
}

async function loadScript(src: string) {
  if (typeof document === 'undefined') {
    throw new DriveAdapterError('config', '브라우저 환경에서만 Google Drive 연동을 사용할 수 있습니다.')
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
  if (existing?.dataset.loaded === 'true') {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement('script')

    if (!existing) {
      script.src = src
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const onLoad = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    const onError = () => reject(new DriveAdapterError('config', 'Google 스크립트를 불러오지 못했습니다.'))

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
  })
}

async function waitForGoogleBaseLibraries() {
  const timeoutAt = Date.now() + 10_000

  while (Date.now() < timeoutAt) {
    if (
      window.google?.accounts.oauth2 &&
      window.gapi?.load
    ) {
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }

  throw new DriveAdapterError('config', 'Google SDK 초기화가 시간 안에 끝나지 않았습니다.')
}

async function loadGooglePickerLibrary() {
  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(
        new DriveAdapterError('config', 'Google Picker SDK 초기화가 시간 안에 끝나지 않았습니다.'),
      )
    }, 10_000)

    window.gapi?.load('picker', {
      callback: () => {
        window.clearTimeout(timeoutId)
        resolve()
      },
    })
  })

  const timeoutAt = Date.now() + 10_000

  while (Date.now() < timeoutAt) {
    if (window.google?.picker) {
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }

  throw new DriveAdapterError('config', 'Google Picker SDK가 시간 안에 준비되지 않았습니다.')
}

class BrowserGoogleDriveSyncAdapter implements DriveSyncAdapter {
  private readonly config = loadConfig()
  private loaderPromise: Promise<void> | null = null
  private tokenClient: GoogleTokenClient | null = null
  private tokenState: TokenState | null = null

  isConfigured() {
    return this.config !== null
  }

  getConfigError() {
    if (this.config) {
      return null
    }

    return 'Google Drive 설정값이 비어 있거나 형식이 올바르지 않습니다.'
  }

  async connect(options: {
    context: StoredDriveContext | null
    interactive: boolean
    pickFolder: boolean
    seedDocument: ToeicWebSyncV1 | null
  }): Promise<DriveBootstrapResult> {
    const config = this.requireConfig()
    await this.ensureLibraries()

    const token = await this.ensureAccessToken({
      interactive: options.interactive,
      loginHint: options.context?.accountEmail ?? readStoredContext()?.accountEmail ?? null,
    })

    let folderId = options.context?.folderId ?? null
    let folderName = options.context?.folderName ?? null

    if (options.pickFolder || !folderId || !folderName) {
      const picked = await this.pickFolder(token.accessToken, config)
      folderId = picked.folderId
      folderName = picked.folderName
    }

    const backupsFolder = await this.ensureFolder({
      parentId: folderId,
      name: BACKUPS_FOLDER_NAME,
      token: token.accessToken,
    })

    const seedRawText = createSeedRawText(options.seedDocument, folderName)
    const liveFile = await this.ensureLiveFile({
      folderId,
      token: token.accessToken,
      seedRawText,
    })
    const rawText = await this.readFileContent(liveFile.id, token.accessToken)

    const session: DriveSession = {
      folderId,
      folderName,
      liveFileId: liveFile.id,
      backupsFolderId: backupsFolder.id,
      accountEmail: token.accountEmail,
      lastSyncAt: new Date().toISOString(),
      lastBackupAt: options.context?.lastBackupAt ?? null,
    }

    writeStoredContext(session)
    return { session, rawText }
  }

  async refresh(session: DriveSession): Promise<DriveBootstrapResult> {
    await this.ensureLibraries()
    const token = await this.ensureAccessToken({
      interactive: false,
      loginHint: session.accountEmail,
    })

    await this.readFileMetadata(session.liveFileId, token.accessToken)
    const rawText = await this.readFileContent(session.liveFileId, token.accessToken)
    const nextSession = {
      ...session,
      accountEmail: token.accountEmail,
      lastSyncAt: new Date().toISOString(),
    }
    writeStoredContext(nextSession)
    return { session: nextSession, rawText }
  }

  async sync(session: DriveSession, rawText: string): Promise<DriveSyncResult> {
    await this.ensureLibraries()
    const token = await this.ensureAccessToken({
      interactive: false,
      loginHint: session.accountEmail,
    })

    const backups = await this.listFiles({
      query: buildDriveQuery([
        `'${session.backupsFolderId}' in parents`,
        'trashed = false',
      ]),
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
      token: token.accessToken,
    })

    let backedUpAt = session.lastBackupAt
    const latestBackupTime = backups[0]?.modifiedTime ? new Date(backups[0].modifiedTime).getTime() : null
    const now = new Date()

    if (latestBackupTime === null || now.getTime() - latestBackupTime >= BACKUP_INTERVAL_MS) {
      await this.copyFile({
        fileId: session.liveFileId,
        token: token.accessToken,
        name: formatBackupFileName(now),
        parentId: session.backupsFolderId,
      })
      backedUpAt = now.toISOString()
    }

    if (backups.length + (backedUpAt === session.lastBackupAt ? 0 : 1) > MAX_BACKUP_COUNT) {
      const refreshedBackups = await this.listFiles({
        query: buildDriveQuery([
          `'${session.backupsFolderId}' in parents`,
          'trashed = false',
        ]),
        fields: 'files(id,name,modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        token: token.accessToken,
      })

      const staleBackups = refreshedBackups.slice(MAX_BACKUP_COUNT)
      await Promise.all(
        staleBackups.map((backup) => this.deleteFile(backup.id, token.accessToken)),
      )
    }

    await this.overwriteFile(session.liveFileId, rawText, token.accessToken)
    const syncedAt = now.toISOString()
    const nextSession: DriveSession = {
      ...session,
      accountEmail: token.accountEmail,
      lastSyncAt: syncedAt,
      lastBackupAt: backedUpAt,
    }
    writeStoredContext(nextSession)

    return {
      session: nextSession,
      syncedAt,
      backedUpAt,
    }
  }

  private requireConfig() {
    if (!this.config) {
      throw new DriveAdapterError('config', this.getConfigError() ?? 'Google Drive 설정이 없습니다.')
    }

    return this.config
  }

  private async ensureLibraries() {
    if (!this.loaderPromise) {
      this.loaderPromise = (async () => {
        await loadScript('https://accounts.google.com/gsi/client')
        await loadScript('https://apis.google.com/js/api.js')
        await waitForGoogleBaseLibraries()
        await loadGooglePickerLibrary()
      })()
    }

    await this.loaderPromise
    if (!this.tokenClient) {
      const config = this.requireConfig()
      this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: DRIVE_SCOPE,
        callback: () => undefined,
      })
    }
  }

  private async ensureAccessToken(options: {
    interactive: boolean
    loginHint: string | null
  }) {
    const tokenState = this.tokenState
    if (tokenState && Date.now() < tokenState.expiresAt - 60_000) {
      return tokenState
    }

    if (!this.tokenClient) {
      await this.ensureLibraries()
    }

    return await new Promise<TokenState>((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new DriveAdapterError('config', 'Google 인증 클라이언트를 만들지 못했습니다.'))
        return
      }

      this.tokenClient.callback = async (response: GoogleTokenResponse) => {
        if (!response.access_token) {
          reject(
            new DriveAdapterError(
              'auth',
              response.error_description ?? 'Google 로그인에 실패했습니다.',
            ),
          )
          return
        }

        try {
          const accountEmail = await this.fetchAccountEmail(response.access_token)
          const nextTokenState: TokenState = {
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
            accountEmail,
          }
          this.tokenState = nextTokenState
          resolve(nextTokenState)
        } catch (error) {
          reject(error)
        }
      }

      this.tokenClient.requestAccessToken({
        prompt: options.interactive ? 'consent' : 'none',
        login_hint: options.loginHint ?? undefined,
      })
    })
  }

  private async fetchAccountEmail(accessToken: string) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        return null
      }

      const payload = (await response.json()) as { email?: unknown }
      return typeof payload.email === 'string' ? payload.email : null
    } catch {
      return null
    }
  }

  private async pickFolder(accessToken: string, config: GoogleDriveConfig) {
    await this.ensureLibraries()

    return await new Promise<{ folderId: string; folderName: string }>((resolve, reject) => {
      const view = new window.google!.picker.DocsView(window.google!.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes(DRIVE_FOLDER_MIME_TYPE)

      const picker = new window.google!.picker.PickerBuilder()
        .addView(view)
        .setDocument(window.document)
        .setOAuthToken(accessToken)
        .setDeveloperKey(config.apiKey)
        .setAppId(config.appId)
        .setOrigin(window.location.origin)
        .setCallback((data) => {
          const action = extractPickerAction(data)

          if (action === window.google!.picker.Action.CANCEL) {
            reject(new DriveAdapterError('picker', '폴더 선택이 취소되었습니다.'))
            return
          }

          const selectedFolder = extractPickerFolder(data)
          if (action !== window.google!.picker.Action.PICKED || !selectedFolder) {
            reject(new DriveAdapterError('picker', '선택한 Google Drive 폴더를 확인하지 못했습니다.'))
            return
          }

          resolve(selectedFolder)
        })
        .build()

      picker.setVisible(true)
    })
  }

  private async driveFetch<T>(input: string, init: RequestInit & { token: string }, parser: (response: Response) => Promise<T>) {
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${init.token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.tokenState = null
        throw new DriveAdapterError('auth', 'Google 로그인 세션이 만료되었습니다. 다시 연결해 주세요.', response.status)
      }

      if (response.status === 404) {
        throw new DriveAdapterError('invalid-context', '저장된 Drive 폴더 또는 파일을 찾지 못했습니다. 폴더를 다시 선택해 주세요.', response.status)
      }

      let message = 'Google Drive 요청에 실패했습니다.'
      try {
        const payload = (await response.json()) as {
          error?: { message?: string }
        }
        if (payload.error?.message) {
          message = payload.error.message
        }
      } catch {
        // no-op
      }
      throw new DriveAdapterError('drive', message, response.status)
    }

    return parser(response)
  }

  private async listFiles(options: {
    query: string
    fields: string
    orderBy?: string
    pageSize: number
    token: string
  }) {
    const params = new URLSearchParams({
      q: options.query,
      fields: options.fields,
      spaces: 'drive',
      pageSize: String(options.pageSize),
    })

    if (options.orderBy) {
      params.set('orderBy', options.orderBy)
    }

    const payload = await this.driveFetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        method: 'GET',
        token: options.token,
      },
      (response) => response.json() as Promise<{ files?: DriveFile[] }>,
    )

    return payload.files ?? []
  }

  private async ensureFolder(options: { parentId: string; name: string; token: string }) {
    const existing = await this.listFiles({
      query: buildDriveQuery([
        `'${options.parentId}' in parents`,
        `name = '${options.name}'`,
        `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
        'trashed = false',
      ]),
      fields: 'files(id,name)',
      pageSize: 10,
      token: options.token,
    })

    if (existing[0]) {
      return existing[0]
    }

    return await this.driveFetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        token: options.token,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: options.name,
          mimeType: DRIVE_FOLDER_MIME_TYPE,
          parents: [options.parentId],
        }),
      },
      (response) => response.json() as Promise<DriveFile>,
    )
  }

  private async ensureLiveFile(options: {
    folderId: string
    seedRawText: string
    token: string
  }) {
    const existing = await this.listFiles({
      query: buildDriveQuery([
        `'${options.folderId}' in parents`,
        `name = '${LIVE_FILE_NAME}'`,
        'trashed = false',
      ]),
      fields: 'files(id,name,modifiedTime,mimeType)',
      pageSize: 10,
      token: options.token,
    })

    if (existing[0]) {
      return existing[0]
    }

    const metadata = {
      name: LIVE_FILE_NAME,
      parents: [options.folderId],
      mimeType: 'application/json',
    }

    const boundary = `toeic-sync-${Math.random().toString(16).slice(2)}`
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${options.seedRawText}\r\n` +
      `--${boundary}--`

    return await this.driveFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        token: options.token,
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
      (response) => response.json() as Promise<DriveFile>,
    )
  }

  private async readFileMetadata(fileId: string, token: string) {
    return await this.driveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime,mimeType`,
      {
        method: 'GET',
        token,
      },
      (response) => response.json() as Promise<DriveFile>,
    )
  }

  private async readFileContent(fileId: string, token: string) {
    return await this.driveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        method: 'GET',
        token,
      },
      (response) => response.text(),
    )
  }

  private async overwriteFile(fileId: string, rawText: string, token: string) {
    return await this.driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        token,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: rawText,
      },
      (response) => response.json() as Promise<DriveFile>,
    )
  }

  private async copyFile(options: {
    fileId: string
    name: string
    parentId: string
    token: string
  }) {
    return await this.driveFetch(
      `https://www.googleapis.com/drive/v3/files/${options.fileId}/copy`,
      {
        method: 'POST',
        token: options.token,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: options.name,
          parents: [options.parentId],
        }),
      },
      (response) => response.json() as Promise<DriveFile>,
    )
  }

  private async deleteFile(fileId: string, token: string) {
    return await this.driveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        token,
      },
      async () => undefined,
    )
  }
}

export function createGoogleDriveSyncAdapter(): DriveSyncAdapter {
  return new BrowserGoogleDriveSyncAdapter()
}

export function isDriveAdapterError(value: unknown): value is DriveAdapterError {
  return value instanceof DriveAdapterError
}

export function toDriveErrorMessage(error: unknown) {
  if (isDriveAdapterError(error)) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Google Drive 처리 중 알 수 없는 오류가 발생했습니다.'
}

export function isReconnectRequiredError(error: unknown) {
  return isDriveAdapterError(error) && error.code === 'auth'
}

export function isInvalidDriveContextError(error: unknown) {
  return isDriveAdapterError(error) && error.code === 'invalid-context'
}

export function loadStoredDriveContext() {
  return readStoredContext()
}

export function saveStoredDriveContext(context: StoredDriveContext) {
  writeStoredContext(context)
}

export function clearStoredDriveContext() {
  writeStoredContext(null)
}

export function parseDriveDocumentText(rawText: string) {
  try {
    const parsed = JSON.parse(rawText) as unknown
    if (!ensureTopLevelObject(parsed)) {
      throw new Error('Google Drive 파일의 최상위 JSON 구조가 객체가 아닙니다.')
    }
    return {
      success: true as const,
      data: parsed,
    }
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error && error.message
          ? error.message
          : 'Google Drive 파일을 JSON으로 읽지 못했습니다.',
    }
  }
}
