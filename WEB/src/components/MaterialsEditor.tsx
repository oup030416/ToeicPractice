import { useEffect, useState } from 'react'

import { deleteValueAtPath, getValueAtPath, setValueAtPath } from '../lib/editor-state'
import { Badge } from './Badge'
import { EmptyMessage } from './DashboardBlocks'
import type { CommitMessage } from './detail-editor-types'
import { asArray, asRecord, parseJsonInput, readString } from './editor-utils'
import { EditorSection, Field, JsonArea, SectionActionRow } from './editor-shared'

export function MaterialsEditor({
  draft,
  onCommitDraftChange,
}: {
  draft: unknown
  onCommitDraftChange: (nextPresent: unknown, message: CommitMessage) => void
}) {
  const officialSets = asArray(getValueAtPath(draft, ['materials', 'official_sets']))
  const drillSets = asArray(getValueAtPath(draft, ['materials', 'drill_sets']))

  const [selection, setSelection] = useState<{
    group: 'official_sets' | 'drill_sets'
    index: number
  } | null>(
    officialSets.length > 0
      ? { group: 'official_sets', index: 0 }
      : drillSets.length > 0
        ? { group: 'drill_sets', index: 0 }
        : null,
  )
  const [scalarForm, setScalarForm] = useState<Record<string, string>>({})
  const [jsonFields, setJsonFields] = useState<Record<string, string>>({})
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (selection?.group === 'official_sets' && officialSets[selection.index]) {
      return
    }

    if (selection?.group === 'drill_sets' && drillSets[selection.index]) {
      return
    }

    if (officialSets.length > 0) {
      setSelection({ group: 'official_sets', index: 0 })
      return
    }

    if (drillSets.length > 0) {
      setSelection({ group: 'drill_sets', index: 0 })
      return
    }

    setSelection(null)
  }, [officialSets.length, drillSets.length, selection?.group, selection?.index])

  const selectedItem =
    selection?.group === 'official_sets'
      ? officialSets[selection.index]
      : selection?.group === 'drill_sets'
        ? drillSets[selection.index]
        : null
  const selectedRecord = asRecord(selectedItem)

  useEffect(() => {
    if (!selection || !selectedItem) {
      setScalarForm({})
      setJsonFields({})
      setJsonError(null)
      return
    }

    if (selection.group === 'official_sets') {
      setScalarForm({
        set_id: readString(selectedRecord.set_id),
        title: readString(selectedRecord.title),
        source_anchor: readString(selectedRecord.source_anchor),
        source_type: readString(selectedRecord.source_type),
        region: readString(selectedRecord.region),
        part: readString(selectedRecord.part),
        document_genre: readString(selectedRecord.document_genre),
        imported_at: readString(selectedRecord.imported_at),
        notes: readString(selectedRecord.notes),
      })
      setJsonFields({
        passages: JSON.stringify(selectedRecord.passages ?? [], null, 2),
        items: JSON.stringify(selectedRecord.items ?? [], null, 2),
      })
      setJsonError(null)
      return
    }

    setScalarForm({
      set_id: readString(selectedRecord.set_id),
      title: readString(selectedRecord.title),
      source_anchor: readString(selectedRecord.source_anchor),
      generation_mode: readString(selectedRecord.generation_mode),
      target_part: readString(selectedRecord.target_part),
      target_skill: readString(selectedRecord.target_skill),
      difficulty: readString(selectedRecord.difficulty),
      review_status: readString(selectedRecord.review_status),
      published_at: readString(selectedRecord.published_at),
    })
    setJsonFields({
      items: JSON.stringify(selectedRecord.items ?? [], null, 2),
      answer_key: JSON.stringify(selectedRecord.answer_key ?? {}, null, 2),
      rationale: JSON.stringify(selectedRecord.rationale ?? {}, null, 2),
    })
    setJsonError(null)
  }, [selection?.group, selection?.index, JSON.stringify(selectedItem)])

  function handleApply() {
    if (!selection) {
      return
    }

    let nextItem: unknown = selectedItem ?? {}

    for (const [key, value] of Object.entries(scalarForm)) {
      nextItem = value.trim()
        ? setValueAtPath(nextItem, [key], value.trim())
        : deleteValueAtPath(nextItem, [key])
    }

    for (const [key, value] of Object.entries(jsonFields)) {
      const parsed = parseJsonInput(value)

      if (!parsed.success) {
        setJsonError(`${key} JSON 문법이 올바르지 않습니다.`)
        return
      }

      nextItem = setValueAtPath(nextItem, [key], parsed.value)
    }

    setJsonError(null)
    onCommitDraftChange(
      setValueAtPath(draft, ['materials', selection.group, selection.index], nextItem),
      {
        title: '자료를 적용했습니다.',
        description: '선택한 세트 변경을 드래프트에 반영했습니다.',
        nextPanel: { type: 'materials' },
      },
    )
  }

  function handleDelete() {
    if (!selection) {
      return
    }

    onCommitDraftChange(
      deleteValueAtPath(draft, ['materials', selection.group, selection.index]),
      {
        actionType: 'delete_node',
        title: '자료를 삭제했습니다.',
        description: '선택한 세트를 드래프트에서 제거했습니다.',
        nextPanel: { type: 'materials' },
      },
    )
  }

  return (
    <div className="space-y-5">
      <EditorSection
        description="공식 세트와 드릴 세트를 선택해 수정하거나 삭제할 수 있습니다."
        title="materials 편집"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700">공식 세트</p>
              <Badge>{officialSets.length}</Badge>
            </div>
            {officialSets.length > 0 ? (
              officialSets.map((item, index) => (
                <button
                  className={`w-full rounded-3xl border p-4 text-left ${
                    selection?.group === 'official_sets' && selection.index === index
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                  key={`official-${index}`}
                  onClick={() => setSelection({ group: 'official_sets', index })}
                  type="button"
                >
                  <p className="font-medium text-slate-900">
                    {readString(asRecord(item).title) || '제목 없음'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {readString(asRecord(item).set_id)}
                  </p>
                </button>
              ))
            ) : (
              <EmptyMessage text="공식 세트가 없습니다." />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700">드릴 세트</p>
              <Badge>{drillSets.length}</Badge>
            </div>
            {drillSets.length > 0 ? (
              drillSets.map((item, index) => (
                <button
                  className={`w-full rounded-3xl border p-4 text-left ${
                    selection?.group === 'drill_sets' && selection.index === index
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                  key={`drill-${index}`}
                  onClick={() => setSelection({ group: 'drill_sets', index })}
                  type="button"
                >
                  <p className="font-medium text-slate-900">
                    {readString(asRecord(item).title) || '제목 없음'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {readString(asRecord(item).set_id)}
                  </p>
                </button>
              ))
            ) : (
              <EmptyMessage text="드릴 세트가 없습니다." />
            )}
          </div>
        </div>
      </EditorSection>

      {selection && selectedItem ? (
        <EditorSection title="선택한 자료 편집">
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(scalarForm).map(([key, value]) => (
              <Field
                key={key}
                label={key}
                onChange={(nextValue) =>
                  setScalarForm((current) => ({ ...current, [key]: nextValue }))
                }
                value={value}
              />
            ))}
          </div>
          <div className="space-y-4">
            {Object.entries(jsonFields).map(([key, value]) => (
              <JsonArea
                key={key}
                label={key}
                onChange={(nextValue) =>
                  setJsonFields((current) => ({ ...current, [key]: nextValue }))
                }
                value={value}
              />
            ))}
          </div>
          {jsonError ? <p className="text-sm text-rose-700">{jsonError}</p> : null}
          <SectionActionRow
            dangerLabel="이 자료 삭제"
            onDanger={handleDelete}
            onPrimary={handleApply}
            primaryLabel="자료 적용"
          />
        </EditorSection>
      ) : (
        <EmptyMessage text="편집할 자료를 먼저 선택해 주세요." />
      )}
    </div>
  )
}
