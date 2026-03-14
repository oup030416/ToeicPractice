/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_GOOGLE_API_KEY?: string
  readonly VITE_GOOGLE_APP_ID?: string
}

declare global {
  interface Window {
    google?: GoogleNamespace
    gapi?: GapiNamespace
  }

  interface GoogleTokenResponse {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  interface GoogleTokenClient {
    callback: ((response: GoogleTokenResponse) => void) | null
    requestAccessToken(options: {
      prompt?: string
      login_hint?: string
    }): void
  }

  interface GooglePickerDocumentObject {
    id?: string
    name?: string
    mimeType?: string
  }

  interface GooglePickerResponseObject {
    action?: string
    docs?: GooglePickerDocumentObject[]
  }

  interface GooglePickerDocsView {
    setIncludeFolders(includeFolders: boolean): GooglePickerDocsView
    setSelectFolderEnabled(selectable: boolean): GooglePickerDocsView
    setMimeTypes(mimeTypes: string): GooglePickerDocsView
  }

  interface GooglePickerBuilder {
    addView(view: GooglePickerDocsView): GooglePickerBuilder
    setOAuthToken(token: string): GooglePickerBuilder
    setDeveloperKey(apiKey: string): GooglePickerBuilder
    setAppId(appId: string): GooglePickerBuilder
    setCallback(callback: (data: GooglePickerResponseObject) => void): GooglePickerBuilder
    build(): {
      setVisible(visible: boolean): void
    }
  }

  interface GoogleNamespace {
    accounts: {
      oauth2: {
        initTokenClient(options: {
          client_id: string
          scope: string
          callback: (response: GoogleTokenResponse) => void
        }): GoogleTokenClient
      }
    }
    picker: {
      Action: {
        PICKED: string
        CANCEL: string
      }
      DocsView: new (viewId: string) => GooglePickerDocsView
      PickerBuilder: new () => GooglePickerBuilder
      ViewId: {
        FOLDERS: string
      }
    }
  }

  interface GapiNamespace {
    load(api: string, callback: { callback: () => void }): void
  }
}

export {}
