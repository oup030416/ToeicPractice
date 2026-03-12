import { useMemo, useState } from 'react'

import { deleteValueAtPath, getValueAtPath, setValueAtPath } from '../lib/editor-state'
import { EmptyMessage } from './DashboardBlocks'
import type { CommitMessage } from './detail-editor-types'
import { asArray, asRecord, readString } from './editor-utils'
import { EditorSection, SectionActionRow, inputClass } from './editor-shared'

export function LookupsEditor({
  draft,
  onCommitDraftChange,
}: {
  draft: unknown
  onCommitDraftChange: (nextPresent: unknown, message: CommitMessage) => void
}) {
  const [sectionKey, setSectionKey] = useState('parts')

  const sections = useMemo(
    () => [
      { key: 'parts', title: 'parts', path: ['lookups', 'parts'] as const },
      {
        key: 'question_types',
        title: 'question_types',
        path: ['lookups', 'question_types'] as const,
      },
      { key: 'skill_tags', title: 'skill_tags', path: ['lookups', 'skill_tags'] as const },
      {
        key: 'vocab_domains',
        title: 'vocab_domains',
        path: ['lookups', 'vocab_domains'] as const,
      },
      {
        key: 'document_genres',
        title: 'document_genres',
        path: ['lookups', 'document_genres'] as const,
      },
      { key: 'error_types', title: 'error_types', path: ['lookups', 'error_types'] as const },
      {
        key: 'review_states',
        title: 'review_states',
        path: ['lookups', 'review_states'] as const,
      },
      {
        key: 'recommendation_strengths',
        title: 'recommendation_strengths',
        path: ['lookups', 'recommendation_strengths'] as const,
      },
    ],
    [],
  )

  const selectedSection = sections.find((section) => section.key === sectionKey) ?? sections[0]
  const selectedValue = getValueAtPath(draft, [...selectedSection.path])

  return (
    <EditorSection
      description="개별 항목 수정/삭제 후 적용하거나, 섹션 전체를 삭제할 수 있습니다."
      title="lookups 편집"
    >
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            className={`rounded-2xl border px-3 py-2 text-sm font-medium ${
              section.key === sectionKey
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-800'
            }`}
            key={section.key}
            onClick={() => setSectionKey(section.key)}
            type="button"
          >
            {section.title}
          </button>
        ))}
      </div>
      <LookupsSectionEditor
        draft={draft}
        key={`${sectionKey}-${JSON.stringify(selectedValue)}`}
        onCommitDraftChange={onCommitDraftChange}
        selectedSection={selectedSection}
        selectedValue={selectedValue}
      />
    </EditorSection>
  )
}

function LookupsSectionEditor({
  draft,
  selectedSection,
  selectedValue,
  onCommitDraftChange,
}: {
  draft: unknown
  selectedSection: {
    key: string
    title: string
    path: readonly ['lookups', string]
  }
  selectedValue: unknown
  onCommitDraftChange: (nextPresent: unknown, message: CommitMessage) => void
}) {
  const [listDraft, setListDraft] = useState<string[]>(asArray(selectedValue).map(readString))
  const [questionTypeDraft, setQuestionTypeDraft] = useState<Record<string, string[]>>({
    'Part 5': asArray(asRecord(selectedValue)['Part 5']).map(readString),
    'Part 6': asArray(asRecord(selectedValue)['Part 6']).map(readString),
    'Part 7': asArray(asRecord(selectedValue)['Part 7']).map(readString),
  })

  function applyCurrentSection() {
    if (selectedSection.key === 'question_types') {
      onCommitDraftChange(
        setValueAtPath(draft, [...selectedSection.path], questionTypeDraft),
        {
          title: 'question_types를 적용했습니다.',
          description: '파트별 문제 유형 배열을 반영했습니다.',
          nextPanel: { type: 'lookups' },
        },
      )
      return
    }

    onCommitDraftChange(setValueAtPath(draft, [...selectedSection.path], listDraft), {
      title: `${selectedSection.key}를 적용했습니다.`,
      description: '선택한 분류 배열을 드래프트에 반영했습니다.',
      nextPanel: { type: 'lookups' },
    })
  }

  function deleteCurrentSection() {
    onCommitDraftChange(deleteValueAtPath(draft, [...selectedSection.path]), {
      actionType: 'delete_node',
      title: `${selectedSection.key}를 삭제했습니다.`,
      description: '선택한 분류 섹션을 드래프트에서 제거했습니다.',
      nextPanel: { type: 'lookups' },
    })
  }

  return (
    <>
      {selectedSection.key === 'question_types' ? (
        <div className="space-y-4">
          {(['Part 5', 'Part 6', 'Part 7'] as const).map((part) => (
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4" key={part}>
              <p className="font-medium text-slate-900">{part}</p>
              <div className="space-y-3">
                {questionTypeDraft[part].length > 0 ? (
                  questionTypeDraft[part].map((item, index) => (
                    <div className="flex gap-3" key={`${part}-${index}`}>
                      <input
                        className={`${inputClass} mt-0`}
                        onChange={(event) =>
                          setQuestionTypeDraft((current) => ({
                            ...current,
                            [part]: current[part].map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry,
                            ),
                          }))
                        }
                        value={item}
                      />
                      <button
                        className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        onClick={() =>
                          setQuestionTypeDraft((current) => ({
                            ...current,
                            [part]: current[part].filter((_, entryIndex) => entryIndex !== index),
                          }))
                        }
                        type="button"
                      >
                        삭제
                      </button>
                    </div>
                  ))
                ) : (
                  <EmptyMessage text="항목이 없습니다." />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {listDraft.length > 0 ? (
            listDraft.map((item, index) => (
              <div className="flex gap-3" key={`${selectedSection.key}-${index}`}>
                <input
                  className={`${inputClass} mt-0`}
                  onChange={(event) =>
                    setListDraft((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? event.target.value : entry,
                      ),
                    )
                  }
                  value={item}
                />
                <button
                  className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  onClick={() =>
                    setListDraft((current) =>
                      current.filter((_, entryIndex) => entryIndex !== index),
                    )
                  }
                  type="button"
                >
                  삭제
                </button>
              </div>
            ))
          ) : (
            <EmptyMessage text="이 섹션에는 현재 항목이 없습니다." />
          )}
        </div>
      )}

      <SectionActionRow
        dangerLabel="섹션 삭제"
        onDanger={deleteCurrentSection}
        onPrimary={applyCurrentSection}
        primaryLabel="선택 섹션 적용"
      />
    </>
  )
}
