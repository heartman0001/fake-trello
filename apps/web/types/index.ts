import type { User, WorkspaceMemberRole } from '@fake-trello/shared';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  owner: Pick<User, 'id' | 'name' | 'email'>;
  memberRole: WorkspaceMemberRole;
  _count: { boards: number; members: number };
}

export interface BoardSummary {
  id: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  workspaceName?: string;
  workspaceMemberRole?: WorkspaceMemberRole;
  _count?: { columns: number };
}

export interface AnalyticsDurationMetrics {
  sampleSize: number;
  averageHours: number;
  p85Hours: number;
}

export interface AnalyticsWipColumn {
  columnId: string;
  title: string;
  position: string;
  count: number;
  isInitial: boolean;
  isDone: boolean;
}

export interface AnalyticsWeek {
  weekStart: string;
  weekEnd: string;
  count: number;
}

export interface AnalyticsColumnReference {
  id: string;
  title: string;
}

export interface BoardAnalytics {
  boardId: string;
  generatedAt: string;
  leadTime: AnalyticsDurationMetrics;
  cycleTime: AnalyticsDurationMetrics;
  wip: {
    total: number;
    byColumn: AnalyticsWipColumn[];
  };
  throughput: {
    weeks: AnalyticsWeek[];
    averagePerWeek: number;
  };
  definitions: {
    initialColumn: AnalyticsColumnReference | null;
    doneColumn: AnalyticsColumnReference | null;
  };
}
