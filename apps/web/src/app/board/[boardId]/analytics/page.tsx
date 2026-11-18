'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  Gauge,
  Layers3,
  RefreshCw,
  Timer,
} from 'lucide-react';
import {
  WeeklyThroughputChart,
  WipByColumnChart,
} from '@/components/analytics/BoardCharts';
import { useBoard, useBoardAnalytics } from '@/hooks/useBoardQueries';
import type { AnalyticsDurationMetrics } from '@/types';

const integerFormatter = new Intl.NumberFormat('en');
const decimalFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 1,
});
const snapshotFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatHours(hours: number) {
  if (!Number.isFinite(hours)) return '—';
  if (hours > 0 && hours < 0.1) return '<0.1h';
  return `${decimalFormatter.format(hours)}h`;
}

function formatSnapshot(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : snapshotFormatter.format(date);
}

function sampleFootnote(metrics: AnalyticsDurationMetrics) {
  if (metrics.sampleSize === 0) {
    return 'No completed cards in this sample yet.';
  }

  return `Based on ${integerFormatter.format(metrics.sampleSize)} completed card${
    metrics.sampleSize === 1 ? '' : 's'
  }.`;
}

const metricTones = {
  blue: 'bg-blue-50 text-blue-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-700',
} as const;

function MetricCard({
  label,
  value,
  unit,
  description,
  footnote,
  icon,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  description: string;
  footnote: string;
  icon: ReactNode;
  tone: keyof typeof metricTones;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </h3>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${metricTones[tone]}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-gray-500">{unit}</span>
        )}
      </p>

      <p className="mt-2 text-xs leading-5 text-gray-600">{description}</p>
      <p className="mt-auto pt-3 text-[11px] leading-4 text-gray-500">
        {footnote}
      </p>
    </article>
  );
}

function AnalyticsHeader({
  boardId,
  boardTitle,
  snapshot,
}: {
  boardId: string;
  boardTitle?: string;
  snapshot?: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href={`/board/${boardId}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-3"
          aria-label="Back to Kanban board"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Kanban board</span>
        </Link>

        <div
          className="mx-1 hidden h-6 w-px bg-gray-200 sm:block"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-gray-900">
            Board analytics
          </h1>
          <p className="truncate text-xs text-gray-500">
            {boardTitle ?? 'Flow metrics for this board'}
          </p>
        </div>

        {snapshot && (
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-gray-500 md:flex">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Snapshot {snapshot}
          </span>
        )}
      </div>
    </header>
  );
}

function AnalyticsSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-gray-200" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-40 animate-pulse rounded-xl bg-gray-200"
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-gray-200" />
        <div className="h-80 animate-pulse rounded-xl bg-gray-200" />
      </div>

      <p className="sr-only" role="status">
        Loading board analytics…
      </p>
    </main>
  );
}

export default function BoardAnalyticsPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;

  const analyticsQuery = useBoardAnalytics(boardId);
  const boardQuery = useBoard(boardId);
  const analytics = analyticsQuery.data;
  const boardTitle = boardQuery.data?.title;

  if (analyticsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AnalyticsHeader boardId={boardId} boardTitle={boardTitle} />
        <AnalyticsSkeleton />
      </div>
    );
  }

  if (analyticsQuery.isError || !analytics) {
    const message =
      analyticsQuery.error instanceof Error
        ? analyticsQuery.error.message
        : 'The analytics service did not return a response for this board.';

    return (
      <div className="min-h-screen bg-gray-50">
        <AnalyticsHeader boardId={boardId} boardTitle={boardTitle} />
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full rounded-xl border border-gray-200 bg-white p-8 text-center">
            <AlertCircle
              className="mx-auto h-8 w-8 text-amber-600"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-lg font-semibold text-gray-900">
              Analytics unavailable
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-600">
              {message}
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void analyticsQuery.refetch()}
                disabled={analyticsQuery.isFetching}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-gray-400"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    analyticsQuery.isFetching ? 'animate-spin' : ''
                  }`}
                  aria-hidden="true"
                />
                Try again
              </button>
              <Link
                href={`/board/${boardId}`}
                className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Back to board
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const totalThroughput = analytics.throughput.weeks.reduce(
    (sum, week) => sum + week.count,
    0,
  );
  const activeColumns = analytics.wip.byColumn.filter(
    (column) => !column.isInitial && !column.isDone,
  );
  const cycle = analytics.cycleTime;
  const lead = analytics.leadTime;

  return (
    <div className="min-h-screen bg-gray-50">
      <AnalyticsHeader
        boardId={boardId}
        boardTitle={boardTitle}
        snapshot={formatSnapshot(analytics.generatedAt)}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-gray-900">
          Flow performance
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          A snapshot of how work moves from creation to Done. Flow times are in
          hours; throughput covers the last eight weeks.
        </p>

        <section aria-labelledby="metrics-heading" className="mt-6">
          <h2 id="metrics-heading" className="sr-only">
            Key flow metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Avg cycle time"
              value={cycle.sampleSize > 0 ? formatHours(cycle.averageHours) : '—'}
              description="Average time from leaving the first column to reaching Done."
              footnote={sampleFootnote(cycle)}
              tone="blue"
              icon={<Timer className="h-4 w-4" />}
            />
            <MetricCard
              label="p85 cycle time"
              value={cycle.sampleSize > 0 ? formatHours(cycle.p85Hours) : '—'}
              description="85% of completed cards reached Done within this cycle time."
              footnote={sampleFootnote(cycle)}
              tone="indigo"
              icon={<Gauge className="h-4 w-4" />}
            />
            <MetricCard
              label="Avg lead time"
              value={lead.sampleSize > 0 ? formatHours(lead.averageHours) : '—'}
              description="Average time from card creation to first reaching Done."
              footnote={sampleFootnote(lead)}
              tone="slate"
              icon={<Clock3 className="h-4 w-4" />}
            />
            <MetricCard
              label="Current WIP"
              value={integerFormatter.format(analytics.wip.total)}
              unit="cards"
              description="Cards currently between the first and Done columns."
              footnote={
                activeColumns.length > 0
                  ? `Across ${activeColumns.length} active column${
                      activeColumns.length === 1 ? '' : 's'
                    }.`
                  : 'No active columns on this board.'
              }
              tone="amber"
              icon={<Layers3 className="h-4 w-4" />}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section
            aria-labelledby="throughput-heading"
            className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="throughput-heading"
                  className="text-base font-semibold tracking-tight text-gray-900"
                >
                  Weekly throughput
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Cards entering Done per week
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 tabular-nums">
                {integerFormatter.format(totalThroughput)} card
                {totalThroughput === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-4">
              <WeeklyThroughputChart
                weeks={analytics.throughput.weeks}
                averagePerWeek={analytics.throughput.averagePerWeek}
              />
            </div>

            <p className="mt-3 text-[11px] leading-5 text-gray-500">
              {analytics.throughput.averagePerWeek > 0 ? (
                <>
                  The darker bar is the current week. The dashed line marks the
                  eight-week average of{' '}
                  <span className="font-medium text-gray-700 tabular-nums">
                    {decimalFormatter.format(
                      analytics.throughput.averagePerWeek,
                    )}
                  </span>{' '}
                  cards per week.
                </>
              ) : (
                'The darker bar is the current week. No cards entered Done in this window.'
              )}
            </p>
          </section>

          <section
            aria-labelledby="wip-heading"
            className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="wip-heading"
                  className="text-base font-semibold tracking-tight text-gray-900"
                >
                  Work in progress by column
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Current cards across the workflow
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 tabular-nums">
                {integerFormatter.format(analytics.wip.total)} active
              </span>
            </div>

            <div className="mt-4">
              <WipByColumnChart columns={analytics.wip.byColumn} />
            </div>

            <p className="mt-3 text-[11px] leading-5 text-gray-500">
              Counts include every column; Current WIP excludes the first and
              Done columns.
              {activeColumns.some((column) => column.count > 0)
                ? ' Amber marks the busiest active column.'
                : ''}
            </p>
          </section>
        </div>

        <p className="mt-8 border-t border-gray-200 pt-4 text-[11px] leading-5 text-gray-500">
          Done is the board&apos;s last column. Lead time starts at card
          creation, cycle time starts when a card leaves the first column, and
          throughput counts each card&apos;s first arrival in Done.
        </p>
      </main>
    </div>
  );
}
