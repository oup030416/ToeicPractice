import {
  BrainCircuit,
  ChartColumn,
  Clock3,
  Database,
  Download,
  Files,
  LayoutDashboard,
  ListTree,
  ShieldCheck,
  Target,
  Upload,
} from 'lucide-react'

import type { LoadedDocument } from '../App'
import { Badge } from './Badge'
import {
  ActionTile,
  CountList,
  EmptyMessage,
  InfoRow,
  MiniPanel,
  SubList,
} from './DashboardBlocks'
import { SectionCard } from './SectionCard'
import { StatCard } from './StatCard'
import { formatDateTime, formatNumber, formatPercent } from '../lib/format'
import type { BadgeTone } from '../lib/sync-view-model'

function toneForStrength(value: string): BadgeTone {
  if (value === 'critical') {
    return 'danger'
  }

  if (value === 'high') {
    return 'accent'
  }

  if (value === 'medium') {
    return 'brand'
  }

  return 'neutral'
}

function validationTone(loadedDocument: LoadedDocument) {
  const { validation } = loadedDocument.viewModel

  if (validation.errors.length > 0) {
    return 'danger' as const
  }

  if (validation.warnings.length > 0) {
    return 'accent' as const
  }

  return 'success' as const
}

export function DashboardSections({
  loadedDocument,
  onOpenEvent,
  onOpenEvents,
  onOpenLookups,
  onOpenMaterials,
  onOpenRaw,
}: {
  loadedDocument: LoadedDocument
  onOpenEvent: (eventId: string) => void
  onOpenEvents: () => void
  onOpenLookups: () => void
  onOpenMaterials: () => void
  onOpenRaw: () => void
}) {
  const viewModel = loadedDocument.viewModel
  const integrityTone = validationTone(loadedDocument)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          subtitle="업로드, localStorage 복원, 리비전, 이벤트 수를 한눈에 확인합니다."
          title="로드 상태"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              caption={`meta.event_count ${viewModel.eventCountMatches ? '일치' : '불일치'}`}
              icon={<LayoutDashboard className="size-5" />}
              title="리비전"
              tone="brand"
              value={String(viewModel.meta.revision)}
            />
            <StatCard
              caption={`실제 이벤트 ${formatNumber(loadedDocument.syncData.events.length)}개`}
              icon={<Files className="size-5" />}
              title="이벤트 수"
              tone={viewModel.eventCountMatches ? 'success' : 'danger'}
              value={formatNumber(viewModel.meta.event_count)}
            />
            <StatCard
              caption={`공식 ${viewModel.materialsSummary.officialCount} / 드릴 ${viewModel.materialsSummary.drillCount}`}
              icon={<Database className="size-5" />}
              title="자료 수"
              tone="accent"
              value={formatNumber(
                viewModel.materialsSummary.officialCount +
                  viewModel.materialsSummary.drillCount,
              )}
            />
            <StatCard
              caption={
                loadedDocument.source === 'restore'
                  ? '브라우저 저장본 자동 복원'
                  : '직접 업로드 기준'
              }
              icon={<Clock3 className="size-5" />}
              title="불러온 시각"
              tone="neutral"
              value={formatDateTime(loadedDocument.savedAt)}
            />
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoRow label="워크스페이스 ID" value={viewModel.meta.workspace_id} />
            <InfoRow label="스키마 버전 (schema_version)" value={viewModel.meta.schema_version} />
            <InfoRow label="범위 (scope)" value={viewModel.meta.scope} />
            <InfoRow label="내보낸 주체 (exported_by)" value={viewModel.meta.exported_by} />
            <InfoRow label="내보낸 시각 (exported_at)" value={formatDateTime(viewModel.meta.exported_at)} />
            <InfoRow
              label="자료 리비전 (materials_revision)"
              value={String(viewModel.meta.materials_revision)}
            />
            <InfoRow label="최근 세션" value={viewModel.recentSession} />
            <InfoRow label="최근 시도" value={viewModel.recentAttempt} />
          </dl>
        </SectionCard>

        <SectionCard
          action={
            <button
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-800"
              onClick={onOpenRaw}
              type="button"
            >
              원본 JSON 보기
            </button>
          }
          subtitle="최신 recommendation.published 이벤트 기준"
          title="최신 추천"
        >
          {viewModel.latestRecommendations.length > 0 ? (
            <div className="space-y-4">
              {viewModel.latestRecommendations.map((recommendation) => (
                <article
                  key={`${recommendation.slot}-${recommendation.what}`}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{recommendation.slot}</Badge>
                    <Badge tone={toneForStrength(recommendation.strength)}>
                      {recommendation.strength}
                    </Badge>
                  </div>
                  <h3 className="text-base font-semibold text-slate-950">
                    {recommendation.what}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {recommendation.why}
                  </p>
                  <p className="mt-3 text-xs font-medium tracking-[0.12em] text-slate-500">
                    근거: {recommendation.evidence}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyMessage text="아직 recommendation.published 이벤트가 없습니다." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          subtitle="dashboard.published와 rc_weakness.recomputed 기준으로 묶어 보여줍니다."
          title="RC 집중 현황"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-[0.16em] text-slate-500">
                대시보드 집중 항목
              </h3>
              {viewModel.dashboardFocus.length > 0 ? (
                viewModel.dashboardFocus.map((focus) => (
                  <article
                    key={`${focus.part}-${focus.reason}`}
                    className="rounded-3xl border border-slate-200 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{focus.part}</Badge>
                      <Badge tone={toneForStrength(focus.strength)}>
                        {focus.strength}
                      </Badge>
                    </div>
                    <p className="font-medium text-slate-900">{focus.status}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {focus.reason}
                    </p>
                  </article>
                ))
              ) : (
                <EmptyMessage text="아직 dashboard.published 이벤트가 없습니다." />
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-[0.16em] text-slate-500">
                상위 약점
              </h3>
              {viewModel.topWeaknesses.length > 0 ? (
                viewModel.topWeaknesses.map((weakness) => (
                  <article
                    key={`${weakness.part}-${weakness.skillTag}-${weakness.vocabDomain}`}
                    className="rounded-3xl border border-slate-200 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{weakness.part}</Badge>
                      <Badge tone={weakness.status === '활성' ? 'danger' : 'neutral'}>
                        {weakness.status}
                      </Badge>
                    </div>
                    <p className="font-medium text-slate-900">{weakness.skillTag}</p>
                    <p className="mt-1 text-sm text-slate-600">{weakness.vocabDomain}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>우선순위 {weakness.priorityScore}</span>
                      <span>정답률 {formatPercent(weakness.accuracy)}</span>
                      <span>반복 혼동 {formatNumber(weakness.repeatConfusionCount)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyMessage text="아직 rc_weakness.recomputed 이벤트가 없습니다." />
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <SubList
              emptyText="반복 혼동 기록이 없습니다."
              items={viewModel.repeatedConfusions}
              title="반복 혼동"
            />
            <SubList
              emptyText="개선 신호 기록이 없습니다."
              items={viewModel.recentImprovementSignals}
              title="최근 개선 신호"
            />
          </div>
        </SectionCard>

        <SectionCard
          subtitle="중요도가 낮은 데이터는 상세패널 뒤로 숨기고, 무결성 신호만 먼저 보여줍니다."
          title="세트 · 분류표 · 무결성"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionTile
              description={`공식 ${viewModel.materialsSummary.officialCount}세트, 드릴 ${viewModel.materialsSummary.drillCount}세트`}
              icon={<Database className="size-5" />}
              onClick={onOpenMaterials}
              title="자료 상세"
            />
            <ActionTile
              description={`${formatNumber(viewModel.lookupSummary.reduce((sum, item) => sum + item.count, 0))}개 분류 항목`}
              icon={<ListTree className="size-5" />}
              onClick={onOpenLookups}
              title="분류표 보기"
            />
            <ActionTile
              description={`${formatNumber(viewModel.allEvents.length)}개 이벤트 전체 열람`}
              icon={<Files className="size-5" />}
              onClick={onOpenEvents}
              title="전체 이벤트"
            />
            <ActionTile
              description="알 수 없는 미래 이벤트를 포함한 전체 원문 확인"
              icon={<Database className="size-5" />}
              onClick={onOpenRaw}
              title="원본 JSON"
            />
          </div>

          <div className="mt-5 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-700" />
                <p className="font-medium text-slate-900">무결성 체크</p>
              </div>
              <Badge tone={integrityTone}>
                {viewModel.validation.errors.length > 0
                  ? '차단 오류'
                  : viewModel.validation.warnings.length > 0
                    ? '경고 있음'
                    : '정상'}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow
                label="차단 오류"
                value={formatNumber(viewModel.validation.errors.length)}
              />
              <InfoRow
                label="경고"
                value={formatNumber(viewModel.validation.warnings.length)}
              />
              <InfoRow
                label="stale 여부"
                value={viewModel.validation.isStale ? '예' : '아니오'}
              />
              <InfoRow
                label="알 수 없는 이벤트"
                value={viewModel.validation.hasUnknownEvent ? '있음' : '없음'}
              />
              <InfoRow
                label="soft limit"
                value={viewModel.validation.exceedsSoftLimit ? '초과' : '정상'}
              />
              <InfoRow
                label="파일 크기 (byte)"
                value={formatNumber(viewModel.validation.fileSizeBytes)}
              />
            </div>

            <ul className="space-y-2 text-sm leading-6 text-slate-700">
              <li>
                meta.event_count: {formatNumber(viewModel.meta.event_count)} / 실제
                events.length: {formatNumber(loadedDocument.syncData.events.length)}
              </li>
              <li>
                차이: {viewModel.eventCountDelta >= 0 ? '+' : ''}
                {formatNumber(viewModel.eventCountDelta)}
              </li>
              <li>
                마지막 sync.accepted:{' '}
                {viewModel.lastAcceptedRevision
                  ? `revision ${viewModel.lastAcceptedRevision}`
                  : '없음'}
              </li>
              <li>
                승인 사유:{' '}
                {viewModel.lastAcceptedReason ?? 'sync.accepted payload가 아직 없습니다.'}
              </li>
            </ul>

            {viewModel.validation.warnings.length > 0 ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-amber-950">
                  허용 경고 {formatNumber(viewModel.validation.warnings.length)}건
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
                  {viewModel.validation.warnings.map((issue) => (
                    <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <SectionCard
          subtitle="최근 이벤트 6개만 첫 화면에 노출합니다."
          title="최근 이벤트 타임라인"
        >
          <div className="space-y-3">
            {viewModel.recentEvents.map((event) => (
              <button
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-300 hover:bg-blue-50"
                key={event.id}
                onClick={() => onOpenEvent(event.id)}
                type="button"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={event.tone}>{event.eventType}</Badge>
                  <Badge>{event.actor}</Badge>
                  <span className="text-xs font-medium tracking-[0.12em] text-slate-500">
                    {formatDateTime(event.timestamp)}
                  </span>
                </div>
                <p className="font-medium text-slate-950">{event.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{event.description}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          subtitle="핵심 집계만 첫 화면에 두고, 세부 내역은 버튼 뒤로 보냅니다."
          title="집계 스냅샷"
        >
          <div className="space-y-5">
            <MiniPanel icon={<Target className="size-4" />} title="추천 강도 분포">
              <CountList
                emptyText="추천 강도 데이터가 없습니다."
                items={viewModel.recommendationStrengthCounts}
              />
            </MiniPanel>
            <MiniPanel icon={<ChartColumn className="size-4" />} title="이벤트 유형">
              <CountList
                emptyText="이벤트 집계가 없습니다."
                items={viewModel.eventTypeCounts}
              />
            </MiniPanel>
            <MiniPanel icon={<BrainCircuit className="size-4" />} title="상위 스킬 태그">
              <CountList
                emptyText="스킬 태그 데이터가 없습니다."
                items={viewModel.skillCounts}
              />
            </MiniPanel>
            <MiniPanel icon={<Database className="size-4" />} title="상위 어휘 도메인">
              <CountList
                emptyText="어휘 도메인 데이터가 없습니다."
                items={viewModel.vocabDomainCounts}
              />
            </MiniPanel>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export function EmptyDashboardState() {
  return (
    <SectionCard
      subtitle="현재 프로젝트의 `sync/toeic_web_sync.json`을 업로드하거나, 이전 브라우저 저장본이 있으면 자동 복원됩니다."
      title="JSON 업로드로 시작"
    >
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-dashed border-blue-200 bg-blue-50/60 p-5">
          <p className="font-medium text-slate-900">
            이 대시보드는 업로드된 교환 파일만 읽습니다.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <li>meta, lookups, materials, events 네 블록을 검증합니다.</li>
            <li>권장 입력 파일: `sync/toeic_web_sync.json`</li>
            <li>불러온 데이터는 브라우저 localStorage에 최근 1개만 저장합니다.</li>
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            caption="사용자 업로드 후 즉시 대시보드를 생성합니다."
            icon={<Upload className="size-5" />}
            title="입력"
            tone="brand"
            value="JSON"
          />
          <StatCard
            caption="다운로드 시 외부 포맷을 그대로 유지합니다."
            icon={<Download className="size-5" />}
            title="출력"
            tone="success"
            value="원본 보존"
          />
        </div>
      </div>
    </SectionCard>
  )
}
