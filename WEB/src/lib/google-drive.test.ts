import { describe, expect, it } from 'vitest'

import { extractDriveFolderIdFromInput } from './google-drive'

describe('extractDriveFolderIdFromInput', () => {
  it('extracts a folder id from a Google Drive folder URL', () => {
    expect(
      extractDriveFolderIdFromInput(
        'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz12345?usp=sharing',
      ),
    ).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz12345')
  })

  it('returns a raw folder id when only the id is provided', () => {
    expect(extractDriveFolderIdFromInput('1AbCdEfGhIjKlMnOpQrStUvWxYz12345')).toBe(
      '1AbCdEfGhIjKlMnOpQrStUvWxYz12345',
    )
  })

  it('rejects invalid text', () => {
    expect(extractDriveFolderIdFromInput('not-a-drive-folder')).toBeNull()
  })
})
