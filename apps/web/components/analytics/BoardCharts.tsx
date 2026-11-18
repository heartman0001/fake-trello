'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnalyticsWeek, AnalyticsWipColumn } from '@/types';

const integerFormatter = new Intl.NumberFormat('en');
const weekLabelFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
});
const weekLongFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function formatWeekLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : weekLabelFormatter.format(date);
}

function formatWeekRange(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} – ${end}`;
  }

  return `${weekLongFormatter.format(startDate)} – ${weekLongFormatter.format(
    endDate,
  )}`;
}

function truncateLabel(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) return value;
  return `${value.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
}

interface WeeklyThroughputChartProps {
  weeks: AnalyticsWeek[];
  averagePerWeek: number;
}

export function WeeklyThroughputChart({
  weeks,
  averagePerWeek,
}: WeeklyThroughputChartProps) {
  const { ref, width } = useChartWidth();
  const height = 248;
  const total = weeks.reduce((sum, week) => sum + week.count, 0);

  if (weeks.length === 0) {
    return (
      <div className="flex h-[248px] items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 text-center text-xs leading-5 text-gray-500">
        No weekly throughput data is available for this board yet.
      </div>
    );
  }

  const margin = { top: 20, right: 8, bottom: 34, left: 38 };
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(...weeks.map((week) => week.count), 1);
  const yMax = Math.max(4, Math.ceil(maxCount / 4) * 4);
  const tickValues = Array.from({ length: 5 }, (_, index) => {
    return (yMax / 4) * index;
  });
  const slotWidth = plotWidth / weeks.length;
  const barWidth = Math.min(46, Math.max(8, slotWidth * 0.54));
  const currentWeekIndex = weeks.length - 1;

  return (
    <div ref={ref} className="w-full">
      {width === 0 ? (
        <div style={{ height }} aria-hidden="true" />
      ) : (
        <figure aria-label="Weekly throughput bar chart">
          <figcaption className="sr-only">
            Cards entering Done per week over the last {weeks.length} weeks.
            Total {integerFormatter.format(total)} cards.
          </figcaption>

          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block max-w-full overflow-visible"
            aria-hidden="true"
            focusable="false"
          >
            {tickValues.map((value) => {
              const y = margin.top + plotHeight - (value / yMax) * plotHeight;

              return (
                <g key={value}>
                  <line
                    x1={margin.left}
                    x2={margin.left + plotWidth}
                    y1={y}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />
                  <text
                    x={margin.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize={10.5}
                    fill="#64748b"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {integerFormatter.format(value)}
                  </text>
                </g>
              );
            })}

            {weeks.map((week, index) => {
              const barHeight = (week.count / yMax) * plotHeight;
              const x =
                margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
              const y = margin.top + plotHeight - barHeight;
              const isCurrentWeek = index === currentWeekIndex;
              const showLabel =
                width >= 540 ||
                index % 2 === 0 ||
                index === currentWeekIndex;

              return (
                <g key={week.weekStart}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 0)}
                    rx={4}
                    fill={isCurrentWeek ? '#1e3a8a' : '#3b82f6'}
                    className="animate-chart-bar-y"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <title>
                      {formatWeekRange(week.weekStart, week.weekEnd)}:{' '}
                      {week.count} card{week.count === 1 ? '' : 's'}
                    </title>
                  </rect>

                  {week.count > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={Math.max(margin.top + 9, y - 6)}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={600}
                      fill="#334155"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {week.count}
                    </text>
                  )}

                  {showLabel && (
                    <text
                      x={x + barWidth / 2}
                      y={height - 12}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={isCurrentWeek ? 600 : 400}
                      fill={isCurrentWeek ? '#334155' : '#64748b'}
                    >
                      {formatWeekLabel(week.weekStart)}
                    </text>
                  )}
                </g>
              );
            })}

            <line
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={margin.top + plotHeight}
              y2={margin.top + plotHeight}
              stroke="#cbd5e1"
              strokeWidth={1}
            />

            {averagePerWeek > 0 && (
              <g>
                <line
                  x1={margin.left}
                  x2={margin.left + plotWidth}
                  y1={
                    margin.top +
                    plotHeight -
                    (averagePerWeek / yMax) * plotHeight
                  }
                  y2={
                    margin.top +
                    plotHeight -
                    (averagePerWeek / yMax) * plotHeight
                  }
                  stroke="#94a3b8"
                  strokeWidth={1}
                  strokeDasharray="4 5"
                >
                  <title>
                    Eight-week average: {averagePerWeek} cards per week
                  </title>
                </line>
              </g>
            )}

            {total === 0 && (
              <>
                <text
                  x={margin.left + plotWidth / 2}
                  y={margin.top + plotHeight / 2 - 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={500}
                  fill="#334155"
                >
                  No cards entered Done
                </text>
                <text
                  x={margin.left + plotWidth / 2}
                  y={margin.top + plotHeight / 2 + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#64748b"
                >
                  in the last {weeks.length} weeks
                </text>
              </>
            )}
          </svg>

          <ul className="sr-only">
            {weeks.map((week) => (
              <li key={week.weekStart}>
                Week of {formatWeekRange(week.weekStart, week.weekEnd)}:{' '}
                {week.count} card{week.count === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        </figure>
      )}
    </div>
  );
}

interface WipByColumnChartProps {
  columns: AnalyticsWipColumn[];
}

const wipColors = {
  initial: '#64748b',
  active: '#2563eb',
  bottleneck: '#d97706',
  done: '#059669',
} as const;

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function WipByColumnChart({ columns }: WipByColumnChartProps) {
  const { ref, width } = useChartWidth();
  const rowHeight = 42;
  const height = Math.max(176, columns.length * rowHeight + 12);

  if (columns.length === 0) {
    return (
      <div className="flex h-[176px] items-center justify-center rounded-lg border border-dashed border-gray-200 px-4 text-center text-xs leading-5 text-gray-500">
        This board has no columns yet, so there is no work in progress to show.
      </div>
    );
  }

  const activeColumns = columns.filter(
    (column) => !column.isInitial && !column.isDone,
  );
  const maxActiveCount = Math.max(
    0,
    ...activeColumns.map((column) => column.count),
  );
  const bottleneckIds = new Set(
    maxActiveCount > 0
      ? activeColumns
          .filter((column) => column.count === maxActiveCount)
          .map((column) => column.columnId)
      : [],
  );
  const maxCount = Math.max(1, ...columns.map((column) => column.count));
  const labelWidth = Math.min(190, Math.max(96, width * 0.32));
  const valueWidth = 34;
  const barAreaWidth = Math.max(24, width - labelWidth - valueWidth);
  const maxCharacters = Math.max(8, Math.floor((labelWidth - 16) / 6.4));

  return (
    <div ref={ref} className="w-full">
      {width === 0 ? (
        <div style={{ height }} aria-hidden="true" />
      ) : (
        <figure aria-label="Work in progress by column bar chart">
          <figcaption className="sr-only">
            Current cards by column. Amber marks the busiest active column.
          </figcaption>

          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block max-w-full overflow-visible"
            aria-hidden="true"
            focusable="false"
          >
            {columns.map((column, index) => {
              const rowY = 6 + index * rowHeight;
              const barY = rowY + 13;
              const isBottleneck = bottleneckIds.has(column.columnId);
              const fill = column.isInitial
                ? wipColors.initial
                : column.isDone
                  ? wipColors.done
                  : isBottleneck
                    ? wipColors.bottleneck
                    : wipColors.active;
              const barWidth =
                column.count === 0
                  ? 0
                  : Math.max(4, (column.count / maxCount) * barAreaWidth);

              return (
                <g key={column.columnId}>
                  <title>
                    {column.title}: {column.count} card
                    {column.count === 1 ? '' : 's'}
                    {isBottleneck ? ' (busiest active column)' : ''}
                  </title>

                  <rect
                    x={labelWidth}
                    y={barY}
                    width={barAreaWidth}
                    height={16}
                    rx={4}
                    fill="#f1f5f9"
                  />

                  <rect
                    x={labelWidth}
                    y={barY}
                    width={barWidth}
                    height={16}
                    rx={4}
                    fill={fill}
                    className="animate-chart-bar-x"
                    style={{ animationDelay: `${index * 55}ms` }}
                  />

                  <circle cx={3.5} cy={barY + 8} r={3.5} fill={fill} />

                  <text
                    x={12}
                    y={barY + 11.5}
                    fontSize={11}
                    fontWeight={isBottleneck ? 600 : 500}
                    fill="#334155"
                  >
                    {truncateLabel(column.title, maxCharacters)}
                  </text>

                  <text
                    x={width}
                    y={barY + 11.5}
                    textAnchor="end"
                    fontSize={11}
                    fontWeight={600}
                    fill={column.count === 0 ? '#64748b' : '#334155'}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {integerFormatter.format(column.count)}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-600">
            <LegendDot color={wipColors.initial} label="First column" />
            <LegendDot color={wipColors.active} label="Active" />
            {bottleneckIds.size > 0 && (
              <LegendDot color={wipColors.bottleneck} label="Busiest active" />
            )}
            <LegendDot color={wipColors.done} label="Done" />
          </div>

          <ul className="sr-only">
            {columns.map((column) => (
              <li key={column.columnId}>
                {column.title}: {column.count} card
                {column.count === 1 ? '' : 's'}
                {bottleneckIds.has(column.columnId)
                  ? ', busiest active column'
                  : ''}
              </li>
            ))}
          </ul>
        </figure>
      )}
    </div>
  );
}
