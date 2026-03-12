import { useEffect, useState } from 'react'

import { deleteValueAtPath, getValueAtPath, setValueAtPath } from '../lib/editor-state'
import { asRecord, readString } from './editor-utils'
import { EditorSection, Field, SectionActionRow } from './editor-shared'
import type { CommitMessage } from './detail-editor-types'

export function MetaEditor({
  draft,
  onCommitDraftChange,
}: {
  draft: unknown
  onCommitDraftChange: (nextPresent: unknown, message: CommitMessage) => void
}) {
  const meta = asRecord(getValueAtPath(draft, ['meta']))
  const [form, setForm] = useState({
    workspace_id: readString(meta.workspace_id),
    schema_version: readString(meta.schema_version),
    scope: readString(meta.scope),
    revision: readString(meta.revision),
    previous_revision: readString(meta.previous_revision),
    exported_at: readString(meta.exported_at),
    exported_by: readString(meta.exported_by),
    event_count: readString(meta.event_count),
    materials_revision: readString(meta.materials_revision),
  })

  useEffect(() => {
    setForm({
      workspace_id: readString(meta.workspace_id),
      schema_version: readString(meta.schema_version),
      scope: readString(meta.scope),
      revision: readString(meta.revision),
      previous_revision: readString(meta.previous_revision),
      exported_at: readString(meta.exported_at),
      exported_by: readString(meta.exported_by),
      event_count: readString(meta.event_count),
      materials_revision: readString(meta.materials_revision),
    })
  }, [JSON.stringify(meta)])

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleApply() {
    let nextPresent = draft

    for (const key of Object.keys(form) as Array<keyof typeof form>) {
      const value = form[key].trim()

      if (!value) {
        nextPresent = deleteValueAtPath(nextPresent, ['meta', key])
        continue
      }

      if (['revision', 'previous_revision', 'event_count', 'materials_revision'].includes(key)) {
        nextPresent = setValueAtPath(nextPresent, ['meta', key], Number(value))
        continue
      }

      nextPresent = setValueAtPath(nextPresent, ['meta', key], value)
    }

    onCommitDraftChange(nextPresent, {
      title: 'meta를 적용했습니다.',
      description: '기본 정보 필드를 드래프트에 반영했습니다.',
      nextPanel: { type: 'meta' },
    })
  }

  function handleDeleteField(key: keyof typeof form) {
    onCommitDraftChange(deleteValueAtPath(draft, ['meta', key]), {
      actionType: 'delete_node',
      title: 'meta 필드를 삭제했습니다.',
      description: `${key} 키를 드래프트에서 제거했습니다.`,
      nextPanel: { type: 'meta' },
    })
  }

  const metaFields = [
    ['workspace_id', '워크스페이스 ID'],
    ['schema_version', '스키마 버전'],
    ['scope', '범위'],
    ['revision', '리비전'],
    ['previous_revision', '이전 리비전'],
    ['exported_at', '내보낸 시각'],
    ['exported_by', '내보낸 주체'],
    ['event_count', '이벤트 수'],
    ['materials_revision', '자료 리비전'],
  ] as const

  return (
    <EditorSection
      description="필드를 비우거나 삭제하면 차단 오류가 생길 수 있지만, 로컬 드래프트 편집은 계속할 수 있습니다."
      title="meta 편집"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {metaFields.map(([key, label]) => (
          <div className="space-y-2" key={key}>
            <Field
              label={`${label} (${key})`}
              onChange={(value) => updateField(key, value)}
              type={
                ['revision', 'previous_revision', 'event_count', 'materials_revision'].includes(
                  key,
                )
                  ? 'number'
                  : 'text'
              }
              value={form[key]}
            />
            <button
              className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-rose-300 hover:text-rose-700"
              onClick={() => handleDeleteField(key)}
              type="button"
            >
              이 필드 삭제
            </button>
          </div>
        ))}
      </div>
      <SectionActionRow onPrimary={handleApply} primaryLabel="meta 적용" />
    </EditorSection>
  )
}
