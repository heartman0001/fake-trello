import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface DurationMetrics {
  /** Number of completed cards included in the calculation. */
  sampleSize: number;
  averageHours: number;
  p85Hours: number;
}

export type LeadTimeMetrics = DurationMetrics;
export type CycleTimeMetrics = DurationMetrics;

export interface WipColumnMetric {
  columnId: string;
  title: string;
  position: string;
  count: number;
  isInitial: boolean;
  isDone: boolean;
}

export interface WipMetrics {
  /** Active cards: everything outside the first and last columns. */
  total: number;
  byColumn: WipColumnMetric[];
}

export interface WeeklyThroughputPoint {
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** Inclusive Sunday of the week, `YYYY-MM-DD`. */
  weekEnd: string;
  count: number;
}

export interface ThroughputMetrics {
  weeks: WeeklyThroughputPoint[];
  averagePerWeek: number;
}

export interface FlowColumnReference {
  id: string;
  title: string;
}

export interface AnalyticsDefinitions {
  initialColumn: FlowColumnReference | null;
  doneColumn: FlowColumnReference | null;
}

export interface BoardAnalytics {
  boardId: string;
  generatedAt: string;
  leadTime: LeadTimeMetrics;
  cycleTime: CycleTimeMetrics;
  wip: WipMetrics;
  throughput: ThroughputMetrics;
  definitions: AnalyticsDefinitions;
}

interface ColumnSnapshotRow {
  id: string;
  title: string;
  position: string;
  cardCount: number;
  isInitial: boolean;
  isDone: boolean;
}

interface DurationRow {
  sampleSize: number;
  averageHours: number;
  p85Hours: number;
}

interface ThroughputRow {
  weekStart: string;
  weekEnd: string;
  count: number;
  averagePerWeek: number;
}

/**
 * Board flow analytics computed entirely in PostgreSQL.
 *
 * Convention: the last column by fractional position is treated as "Done"
 * and the first column as the start of the active workflow. Movement history
 * comes from `activity_logs` CARD_MOVED entries; only the first transition
 * into Done per card is used, so a card that is reopened and completed again
 * is counted once instead of inflating throughput.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBoardAnalytics(boardId: string): Promise<BoardAnalytics> {
    const [columns, leadTime, cycleTime, throughput] = await Promise.all([
      this.loadColumnSnapshot(boardId),
      this.loadLeadTime(boardId),
      this.loadCycleTime(boardId),
      this.loadWeeklyThroughput(boardId),
    ]);

    const initialColumn = columns.find((column) => column.isInitial);
    const doneColumn = columns.find((column) => column.isDone);

    return {
      boardId,
      generatedAt: new Date().toISOString(),
      leadTime,
      cycleTime,
      wip: {
        total: columns
          .filter((column) => !column.isInitial && !column.isDone)
          .reduce((sum, column) => sum + column.cardCount, 0),
        byColumn: columns.map((column) => ({
          columnId: column.id,
          title: column.title,
          position: column.position,
          count: column.cardCount,
          isInitial: column.isInitial,
          isDone: column.isDone,
        })),
      },
      throughput,
      definitions: {
        initialColumn: initialColumn
          ? { id: initialColumn.id, title: initialColumn.title }
          : null,
        doneColumn: doneColumn
          ? { id: doneColumn.id, title: doneColumn.title }
          : null,
      },
    };
  }

  private async loadColumnSnapshot(
    boardId: string,
  ): Promise<ColumnSnapshotRow[]> {
    return this.prisma.$queryRaw<ColumnSnapshotRow[]>`
      WITH column_counts AS (
        SELECT
          c.id,
          c.title,
          c.position,
          COUNT(card.id)::int AS "cardCount"
        FROM columns c
        LEFT JOIN cards card ON card."columnId" = c.id
        WHERE c."boardId" = ${boardId}
        GROUP BY c.id, c.title, c.position
      ),
      ranked_columns AS (
        SELECT
          cc.*,
          (
            ROW_NUMBER() OVER (
              ORDER BY cc.position ASC, cc.id ASC
            )
          )::int AS "initialRank",
          (
            ROW_NUMBER() OVER (
              ORDER BY cc.position DESC, cc.id DESC
            )
          )::int AS "doneRank"
        FROM column_counts cc
      )
      SELECT
        id,
        title,
        position,
        "cardCount",
        ("initialRank" = 1) AS "isInitial",
        ("doneRank" = 1) AS "isDone"
      FROM ranked_columns
      ORDER BY position ASC, id ASC
    `;
  }

  private async loadLeadTime(boardId: string): Promise<LeadTimeMetrics> {
    const rows = await this.prisma.$queryRaw<DurationRow[]>`
      WITH done_column AS (
        SELECT id
        FROM columns
        WHERE "boardId" = ${boardId}
        ORDER BY position DESC, id DESC
        LIMIT 1
      ),
      done_entries AS (
        SELECT
          al.metadata->>'cardId' AS card_id,
          al."createdAt" AS entered_at,
          ROW_NUMBER() OVER (
            PARTITION BY al.metadata->>'cardId'
            ORDER BY al."createdAt" ASC, al.id ASC
          ) AS entry_rank
        FROM activity_logs al
        JOIN done_column dc
          ON al.metadata->>'toColumnId' = dc.id
        WHERE al."boardId" = ${boardId}
          AND al.type = 'CARD_MOVED'
          AND al.metadata->>'cardId' IS NOT NULL
          AND al.metadata->>'fromColumnId'
              <> al.metadata->>'toColumnId'
      ),
      first_done AS (
        SELECT card_id, entered_at
        FROM done_entries
        WHERE entry_rank = 1
      ),
      durations AS (
        SELECT
          EXTRACT(
            EPOCH FROM (fd.entered_at - card."createdAt")
          ) / 3600.0 AS hours
        FROM first_done fd
        JOIN cards card ON card.id = fd.card_id
        JOIN columns col
          ON col.id = card."columnId"
         AND col."boardId" = ${boardId}
        WHERE fd.entered_at >= card."createdAt"
      )
      SELECT
        COUNT(*)::int AS "sampleSize",
        COALESCE(
          ROUND(AVG(hours)::numeric, 2),
          0
        )::float8 AS "averageHours",
        COALESCE(
          ROUND(
            (percentile_cont(0.85) WITHIN GROUP (ORDER BY hours))::numeric,
            2
          ),
          0
        )::float8 AS "p85Hours"
      FROM durations
    `;

    return this.toDurationMetrics(rows[0]);
  }

  private async loadCycleTime(boardId: string): Promise<CycleTimeMetrics> {
    const rows = await this.prisma.$queryRaw<DurationRow[]>`
      WITH board_columns AS (
        SELECT id, position
        FROM columns
        WHERE "boardId" = ${boardId}
      ),
      first_column AS (
        SELECT id
        FROM board_columns
        ORDER BY position ASC, id ASC
        LIMIT 1
      ),
      done_column AS (
        SELECT id
        FROM board_columns
        ORDER BY position DESC, id DESC
        LIMIT 1
      ),
      movements AS (
        SELECT
          al.id,
          al.metadata->>'cardId' AS card_id,
          al.metadata->>'fromColumnId' AS from_column_id,
          al.metadata->>'toColumnId' AS to_column_id,
          al."createdAt" AS moved_at
        FROM activity_logs al
        WHERE al."boardId" = ${boardId}
          AND al.type = 'CARD_MOVED'
          AND al.metadata->>'cardId' IS NOT NULL
          AND al.metadata->>'fromColumnId'
              <> al.metadata->>'toColumnId'
      ),
      event_facts AS (
        SELECT
          m.card_id,
          m.id,
          m.to_column_id,
          m.moved_at,
          MIN(m.moved_at) FILTER (
            WHERE m.from_column_id = (SELECT id FROM first_column)
          ) OVER (PARTITION BY m.card_id) AS left_first_at
        FROM movements m
      ),
      first_leaves AS (
        SELECT DISTINCT card_id, left_first_at
        FROM event_facts
        WHERE left_first_at IS NOT NULL
      ),
      done_after_leave AS (
        SELECT DISTINCT ON (ef.card_id)
          ef.card_id,
          ef.moved_at AS done_at
        FROM event_facts ef
        JOIN first_leaves fl ON fl.card_id = ef.card_id
        WHERE ef.to_column_id = (SELECT id FROM done_column)
          AND ef.moved_at >= fl.left_first_at
        ORDER BY ef.card_id, ef.moved_at ASC, ef.id ASC
      ),
      durations AS (
        SELECT
          EXTRACT(
            EPOCH FROM (dl.done_at - fl.left_first_at)
          ) / 3600.0 AS hours
        FROM done_after_leave dl
        JOIN first_leaves fl ON fl.card_id = dl.card_id
        JOIN cards card ON card.id = dl.card_id
        JOIN columns col
          ON col.id = card."columnId"
         AND col."boardId" = ${boardId}
      )
      SELECT
        COUNT(*)::int AS "sampleSize",
        COALESCE(
          ROUND(AVG(hours)::numeric, 2),
          0
        )::float8 AS "averageHours",
        COALESCE(
          ROUND(
            (percentile_cont(0.85) WITHIN GROUP (ORDER BY hours))::numeric,
            2
          ),
          0
        )::float8 AS "p85Hours"
      FROM durations
    `;

    return this.toDurationMetrics(rows[0]);
  }

  private async loadWeeklyThroughput(
    boardId: string,
  ): Promise<ThroughputMetrics> {
    const rows = await this.prisma.$queryRaw<ThroughputRow[]>`
      WITH done_column AS (
        SELECT id
        FROM columns
        WHERE "boardId" = ${boardId}
        ORDER BY position DESC, id DESC
        LIMIT 1
      ),
      done_entries AS (
        SELECT
          al.metadata->>'cardId' AS card_id,
          al."createdAt" AS entered_at,
          ROW_NUMBER() OVER (
            PARTITION BY al.metadata->>'cardId'
            ORDER BY al."createdAt" ASC, al.id ASC
          ) AS entry_rank
        FROM activity_logs al
        JOIN done_column dc
          ON al.metadata->>'toColumnId' = dc.id
        WHERE al."boardId" = ${boardId}
          AND al.type = 'CARD_MOVED'
          AND al.metadata->>'cardId' IS NOT NULL
          AND al.metadata->>'fromColumnId'
              <> al.metadata->>'toColumnId'
      ),
      first_done AS (
        SELECT card_id, entered_at
        FROM done_entries
        WHERE entry_rank = 1
      ),
      weeks AS (
        SELECT generate_series(
          date_trunc('week', now()) - interval '7 weeks',
          date_trunc('week', now()),
          interval '1 week'
        ) AS week_start
      ),
      weekly AS (
        SELECT
          w.week_start,
          COUNT(fd.card_id)::int AS count
        FROM weeks w
        LEFT JOIN first_done fd
          ON fd.entered_at >= w.week_start
         AND fd.entered_at < w.week_start + interval '1 week'
        GROUP BY w.week_start
      )
      SELECT
        to_char(week_start, 'YYYY-MM-DD') AS "weekStart",
        to_char(
          week_start + interval '6 days',
          'YYYY-MM-DD'
        ) AS "weekEnd",
        count,
        COALESCE(
          ROUND((AVG(count) OVER ())::numeric, 2),
          0
        )::float8 AS "averagePerWeek"
      FROM weekly
      ORDER BY week_start ASC
    `;

    return {
      weeks: rows.map((row) => ({
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
        count: row.count,
      })),
      averagePerWeek: rows[0]?.averagePerWeek ?? 0,
    };
  }

  private toDurationMetrics(row: DurationRow | undefined): DurationMetrics {
    return {
      sampleSize: row?.sampleSize ?? 0,
      averageHours: row?.averageHours ?? 0,
      p85Hours: row?.p85Hours ?? 0,
    };
  }
}
