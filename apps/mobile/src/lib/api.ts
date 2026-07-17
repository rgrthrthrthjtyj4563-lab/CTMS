import { getApiBaseUrl } from './config';
import { loadToken, clearSession } from './session';
import type { AppUser } from './session';
import type { SyncPayload } from '@clinical/domain';
import { toFormDataFile, type LocalFile } from './upload';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleUnauthorized(status: number) {
  if (status === 401) {
    await clearSession();
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await loadToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { error: { message: text || res.statusText } };
  }
  if (!res.ok) {
    await handleUnauthorized(res.status);
    const err = body.error as { message?: string; code?: string } | undefined;
    throw new ApiError(err?.message ?? res.statusText, res.status, err?.code);
  }
  return body as T;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    name: string;
    role: string;
    organization: { id: string; name: string; code: string };
  };
}

function mapUser(raw: LoginResponse['user']): AppUser {
  return {
    id: raw.id,
    phone: raw.phone,
    name: raw.name,
    role: raw.role,
    organizationId: raw.organization.id,
    organizationName: raw.organization.name,
  };
}

export interface ActionSourceRef {
  kind?: string;
  id?: string;
  excerpt?: string;
  field?: string;
  inputId?: string;
  attachmentId?: string;
}

export interface ActionItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  data: Record<string, unknown>;
  status: string;
  origin?: string;
  sources?: {
    inputIds?: string[];
    attachmentIds?: string[];
    origin?: string;
    sources?: ActionSourceRef[];
  } | ActionSourceRef[] | null;
  tagStatus?: 'draft' | 'pending' | 'risk';
  requiresIndividualConfirm?: boolean;
  items?: Array<Record<string, unknown>>;
}

export interface ActionPackResponse {
  pack: {
    id: string;
    status: string;
    visitId: string;
    itemCount: number;
    followUpQuestions?: string[];
    warnings?: string[];
  };
  items: ActionItem[];
}

export interface VisitBrief {
  visit: Record<string, unknown>;
  enrollment?: { enrolled: number; target: number; screened: number; screenFailed: number; withdrawn: number };
  openIssues?: Array<{ id: string; code?: string; title: string; due?: string; owner?: string }>;
  focusItems?: string[];
  focusAreas?: string[];
}

export interface VisitDetail {
  visit: {
    id: string;
    type: string;
    status: string;
    projectCode: string;
    siteName: string;
    siteCode: string;
    actualStartTime?: string;
    elapsedSeconds: number;
  };
  entries: Array<{
    id: string;
    time: string;
    content: string;
    status: 'done' | 'risk';
    files: string[];
  }>;
}

export interface IssueDetail {
  issue: {
    id: string;
    code: string;
    title: string;
    description: string;
    severity: string;
    severityLabel: string;
    status: string;
    source: string;
    responsiblePerson?: string;
    targetDate?: string;
    project: string;
    site: string;
  };
  evidence: Array<{ name: string; desc: string; time: string }>;
  capaCandidate: {
    status: 'CANDIDATE';
    corrective: string;
    preventive: string;
    closeCondition: string;
  };
  history: Array<{ time: string; actor: string; event: string }>;
}

export interface HoursResponse {
  summary: {
    monthTotal: number;
    monthLabel: string;
    organizationName: string;
    visitDays: number;
    travelDays: number;
    approvalStatus: string;
    todayAdded: number;
  };
  entries: Array<{
    id: string;
    date: string;
    day: string;
    desc: string;
    hours: number;
    tagStatus: string;
    tagLabel: string;
  }>;
}

export interface ActionPack {
  id: string;
  monitoringVisitId: string;
  status: string;
  summary: Record<string, unknown> | null;
  warnings: string[];
  followUpQuestions: string[];
  items: ActionItem[];
}

export interface TodoItem {
  id: string;
  title: string;
  project: string;
  due: string;
  days: number;
  urgent: boolean;
  source: string;
  issueId?: string;
  monitoringVisitId?: string;
  sourceType?: string;
  sourceId?: string;
  href?: string | null;
  assigneeName?: string;
}

export interface ReviewItem {
  id: string;
  packId: string;
  type: string;
  code: string;
  title: string;
  submitter: string;
  time: string;
  severity: string | null;
  project: string;
}

function tagStatus(type: string, status: string): 'draft' | 'pending' | 'risk' {
  if (type === 'ISSUE' || type === 'RISK_CANDIDATE' || type === 'CAPA_CANDIDATE') return 'risk';
  if (status === 'PENDING_CONFIRM' || type === 'HOURS') return 'pending';
  return 'draft';
}

function enrichActionItem(item: ActionItem): ActionItem & { tagStatus: 'draft' | 'pending' | 'risk' } {
  const data = item.data ?? {};
  const sourcesObj = item.sources as { origin?: string } | null | undefined;
  return {
    ...item,
    origin: item.origin ?? sourcesObj?.origin ?? 'RULE',
    tagStatus: tagStatus(item.type, item.status),
    items: Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : undefined,
  };
}

export const api = {
  login: async (phone: string, password: string) => {
    const res = await request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    return { token: res.token, user: mapUser(res.user) };
  },

  session: async () => {
    const res = await request<{ user: LoginResponse['user'] }>('/api/auth/me');
    return { user: mapUser(res.user) };
  },

  projects: async () => {
    const wb = await request<{
      assignments: Array<{
        projectId: string;
        projectCode: string;
        projectName: string;
        siteId?: string;
        siteName?: string;
        siteCode?: string;
      }>;
    }>('/api/workbench');
    const projects: Array<{
      id: string;
      code: string;
      name: string;
      sites: Array<{ id: string; code: string; name: string }>;
    }> = [];
    for (const a of wb.assignments) {
      let p = projects.find((x) => x.id === a.projectId);
      if (!p) {
        p = { id: a.projectId, code: a.projectCode, name: a.projectName, sites: [] };
        projects.push(p);
      }
      if (a.siteId && a.siteName && !p.sites.some((s) => s.id === a.siteId)) {
        p.sites.push({ id: a.siteId, code: a.siteCode ?? '', name: a.siteName });
      }
    }
    return { projects };
  },

  updateContext: (projectId: string, siteId?: string) =>
    request<{
      context: {
        organizationName?: string;
        projectId?: string;
        projectCode?: string;
        projectName?: string;
        siteId?: string;
        siteName?: string;
        siteCode?: string;
      };
    }>('/api/workbench/context', {
      method: 'PATCH',
      body: JSON.stringify({ projectId, siteId }),
    }),

  workbench: () =>
    request<{
      context: {
        organizationName?: string;
        projectId?: string;
        projectCode?: string;
        projectName?: string;
        siteId?: string;
        siteName?: string;
        siteCode?: string;
        activeMonitoringVisitId?: string;
      };
      highlights: Array<{
        id: string;
        type: string;
        title: string;
        subtitle?: string;
        dueDate?: string;
      }>;
      plannedVisits: Array<{
        id: string;
        type: string;
        status: string;
        project: { code: string };
        site: { name: string; code: string };
        plannedDate: string;
      }>;
      assignments: Array<{
        projectId: string;
        projectCode: string;
        projectName: string;
        siteId?: string;
        siteName?: string;
        siteCode?: string;
      }>;
      timeline: Array<{ id: string; type: string; content: string; createdAt: string }>;
      noVisitReason?: string | null;
      aiSuggestion?: { content: string; source: string } | null;
      activeVisit?: { id: string; status: string } | null;
    }>('/api/workbench'),

  visitBrief: (visitId: string) =>
    request<{
      brief: {
        visit: Record<string, unknown>;
        enrollmentSummary: Record<string, unknown>;
        openIssues: Array<{ id: string; title: string; targetDate?: string; responsiblePerson?: string }>;
        focusAreas: string[];
      };
    }>(`/api/monitoring-visits/${visitId}/brief`),

  visitDetail: (visitId: string) =>
    request<{
      visit: {
        id: string;
        type: string;
        status: string;
        actualStartTime?: string;
        actualEndTime?: string | null;
        durationMinutes?: number | null;
        workSummary?: string | null;
        project: { code: string };
        site: { name: string; code: string };
        inputs: Array<{
          id: string;
          content: string;
          transcript?: string;
          createdAt: string;
          version?: number;
          isVoided?: boolean;
        }>;
        activities?: Array<{
          id: string;
          activityType: string;
          title: string;
          status: string;
          note?: string | null;
        }>;
      };
    }>(`/api/monitoring-visits/${visitId}`),

  startVisit: (visitId: string) =>
    request<{ visit: { id: string; status: string; actualStartTime?: string } }>(
      `/api/monitoring-visits/${visitId}/start`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  addVisitInput: (visitId: string, data: { type: string; content: string; transcript?: string; clientInputId?: string }) =>
    request<{ input: { id: string }; idempotent?: boolean }>(`/api/monitoring-visits/${visitId}/inputs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateVisitInput: (visitId: string, inputId: string, content: string, reason: string) =>
    request<{ input: { id: string; version: number } }>(
      `/api/monitoring-visits/${visitId}/inputs/${inputId}`,
      { method: 'PATCH', body: JSON.stringify({ content, reason }) },
    ),

  voidVisitInput: (visitId: string, inputId: string, reason: string) =>
    request<{ input: { id: string; isVoided?: boolean; status?: string }; idempotent?: boolean }>(
      `/api/monitoring-visits/${visitId}/inputs/${inputId}/void`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),

  visitActivities: (visitId: string) =>
    request<{
      activities: Array<{
        id: string;
        activityType: string;
        title: string;
        status: string;
        note?: string | null;
      }>;
    }>(`/api/monitoring-visits/${visitId}/activities`),

  updateVisitActivity: (
    visitId: string,
    activityId: string,
    data: { status?: string; note?: string },
  ) =>
    request<{ activity: { id: string; status: string } }>(
      `/api/monitoring-visits/${visitId}/activities/${activityId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    ),

  /** Preferred: idempotent end + single action pack */
  completeVisit: (visitId: string, actualEndTime?: string) =>
    request<{
      visit: { id: string; status: string; actualEndTime?: string | null };
      actionPack: ActionPack | null;
      idempotent: boolean;
    }>(`/api/monitoring-visits/${visitId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        actualEndTime: actualEndTime ?? new Date().toISOString(),
      }),
    }),

  patchVisit: (
    visitId: string,
    data: { actualStartTime?: string; actualEndTime?: string; workSummary?: string },
  ) =>
    request<{
      visit: {
        id: string;
        status: string;
        actualStartTime?: string | null;
        actualEndTime?: string | null;
        durationMinutes?: number | null;
      };
    }>(`/api/monitoring-visits/${visitId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  endVisit: (visitId: string) =>
    request<{ visit: { id: string; status: string }; idempotent?: boolean; actionPackId?: string | null }>(
      `/api/monitoring-visits/${visitId}/end`,
      { method: 'POST', body: JSON.stringify({ actualEndTime: new Date().toISOString() }) },
    ),

  generateActionPack: (visitId: string) =>
    request<{ actionPack: ActionPack; idempotent?: boolean }>('/api/action-packs/generate', {
      method: 'POST',
      body: JSON.stringify({ visitId }),
    }),

  actionPack: async (packId: string) => {
    const res = await request<{ actionPack: ActionPack }>(`/api/action-packs/${packId}`);
    return {
      pack: {
        id: res.actionPack.id,
        status: res.actionPack.status,
        visitId: res.actionPack.monitoringVisitId,
        itemCount: res.actionPack.items.length,
        followUpQuestions: res.actionPack.followUpQuestions,
        warnings: res.actionPack.warnings,
      },
      items: res.actionPack.items.map(enrichActionItem),
    };
  },

  updateActionItem: (
    packId: string,
    itemId: string,
    patch: Record<string, unknown> & { description?: string; title?: string },
  ) =>
    request(`/api/action-packs/${packId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: patch,
        description: patch.description,
        title: patch.title,
      }),
    }),

  confirmActionPack: async (packId: string, confirmedItemIds: string[], skippedItemIds: string[] = []) => {
    for (const itemId of skippedItemIds) {
      await request(`/api/action-packs/${packId}/items/${itemId}`, { method: 'DELETE' });
    }
    for (const itemId of confirmedItemIds) {
      await request(`/api/action-packs/${packId}/items/${itemId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    }
    await request(`/api/action-packs/${packId}/submit`, { method: 'POST', body: JSON.stringify({}) });
    return { confirmed: confirmedItemIds.length, skipped: skippedItemIds.length };
  },

  todos: async (opts?: { scope?: 'self' | 'team' }) => {
    const q = opts?.scope ? `?scope=${opts.scope}` : '';
    const res = await request<{
      todos: Array<{
        id: string;
        title: string;
        dueDate?: string;
        sourceType?: string;
        sourceId?: string;
        issueId?: string;
        monitoringVisitId?: string;
        projectId?: string;
        siteId?: string;
        href?: string | null;
        assignee?: { id: string; name: string; role: string };
      }>;
      counts: { total: number; overdue: number; dueToday: number };
      scope?: string;
    }>(`/api/todos${q}`);

    const now = Date.now();
    const items: TodoItem[] = res.todos.map((t) => {
      const due = t.dueDate ? new Date(t.dueDate) : null;
      const daysLeft = due ? Math.ceil((due.getTime() - now) / 86400000) : 7;
      return {
        id: t.id,
        title: t.title,
        project: t.assignee?.name ? `${t.assignee.name} · ${t.assignee.role}` : '',
        due: due ? `${due.getMonth() + 1}-${due.getDate()}` : '',
        days: daysLeft,
        urgent: daysLeft <= 2,
        source: t.sourceType ?? 'IMV',
        issueId: t.issueId,
        monitoringVisitId: t.monitoringVisitId,
        sourceType: t.sourceType,
        sourceId: t.sourceId,
        href: t.href,
        assigneeName: t.assignee?.name,
      };
    });

    return {
      items,
      counts: { mine: items.length, all: res.counts.total },
      scope: res.scope ?? 'self',
    };
  },

  issue: async (issueId: string) => {
    const res = await request<{
      issue: {
        id: string;
        title: string;
        description: string;
        severity: string;
        category: string;
        status: string;
        responsiblePerson?: string;
        targetDate?: string;
        project: { code: string };
        site: { name: string; code: string };
        monitoringVisit?: { plannedDate: string };
      };
      attachments: Array<{ id: string; fileName: string; createdAt: string }>;
      capaCandidate: {
        status: 'CANDIDATE';
        corrective: string;
        preventive: string;
        closeCondition: string;
      } | null;
      auditTrail: Array<{ createdAt: string; type: string; user?: { name: string } }>;
    }>(`/api/issues/${issueId}`);

    const severityLabel: Record<string, string> = {
      LOW: '轻微', MEDIUM: '次要', HIGH: '主要', CRITICAL: '严重',
    };

    return {
      issue: {
        id: res.issue.id,
        code: `IS-${res.issue.id.slice(-6).toUpperCase()}`,
        title: res.issue.title,
        description: res.issue.description,
        severity: res.issue.severity,
        severityLabel: severityLabel[res.issue.severity] ?? res.issue.severity,
        status: res.issue.status,
        source: res.issue.monitoringVisit
          ? `IMV · ${res.issue.monitoringVisit.plannedDate.split('T')[0]}`
          : '手动创建',
        responsiblePerson: res.issue.responsiblePerson,
        targetDate: res.issue.targetDate,
        project: res.issue.project.code,
        site: `${res.issue.site.name} ${res.issue.site.code}`,
      },
      evidence: res.attachments.map((a) => ({
        name: a.fileName,
        desc: a.fileName,
        time: new Date(a.createdAt).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
      capaCandidate: res.capaCandidate ?? {
        status: 'CANDIDATE' as const,
        corrective: '',
        preventive: '',
        closeCondition: '',
      },
      history: res.auditTrail.map((h) => ({
        time: new Date(h.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        actor: h.user?.name ?? '系统自动',
        event: h.type,
      })),
    };
  },

  submitIssueReview: (issueId: string, status: string) =>
    request<{ issue: { status: string } }>(`/api/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: status === 'CLOSED' ? 'CLOSED' : 'PENDING_VERIFICATION',
      }),
    }),

  hours: async (opts?: { month?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (opts?.month) params.set('month', opts.month);
    if (opts?.status) params.set('status', opts.status);
    const q = params.toString() ? `?${params.toString()}` : '';

    const res = await request<{
      records: Array<{
        id: string;
        date: string;
        workType: string;
        durationHours: number;
        description: string;
        status: string;
        site?: { name: string };
        project?: { code: string };
        monitoringVisit?: { id: string; type: string } | null;
      }>;
      summary: {
        totalHours: number;
        recordCount: number;
        pendingConfirm: number;
        month?: string | null;
      };
    }>(`/api/hours${q}`);

    const now = new Date();
    const [y, m] = opts?.month
      ? opts.month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const statusMap: Record<string, { tagStatus: string; tagLabel: string }> = {
      APPROVED: { tagStatus: 'done', tagLabel: '已审批' },
      PENDING_PM_REVIEW: { tagStatus: 'pending', tagLabel: '待审批' },
      CRA_CONFIRMED: { tagStatus: 'pending', tagLabel: '已确认' },
      DRAFT_CANDIDATE: { tagStatus: 'pending', tagLabel: '待确认' },
      RETURNED: { tagStatus: 'risk', tagLabel: '已退回' },
    };

    return {
      summary: {
        monthTotal: res.summary.totalHours,
        monthLabel: `${y}年${m}月`,
        organizationName: '',
        visitDays: res.records.filter((r) => r.workType === 'ON_SITE_MONITORING').length,
        travelDays: res.records.filter((r) => r.workType === 'TRAVEL').length,
        approvalStatus: res.summary.pendingConfirm > 0 ? '有待确认' : '已同步',
        todayAdded: 0,
      },
      entries: res.records.map((r) => {
        const d = new Date(r.date);
        const tag = statusMap[r.status] ?? { tagStatus: 'info', tagLabel: r.status };
        return {
          id: r.id,
          date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          day: weekdays[d.getDay()],
          desc: `${r.workType === 'ON_SITE_MONITORING' ? 'IMV' : r.workType} · ${r.site?.name ?? r.project?.code ?? ''}`.trim(),
          hours: r.durationHours,
          tagStatus: tag.tagStatus,
          tagLabel: tag.tagLabel,
        };
      }),
    };
  },

  reviewsPending: async () => {
    const res = await request<{
      reviews: Array<{
        id: string;
        type: string;
        submittedAt?: string;
        visit?: {
          project: { code: string };
          site: { name: string; code: string };
          cra: { name: string };
          type: string;
        };
        itemCount?: number;
      }>;
    }>('/api/reviews/pending');

    const items: ReviewItem[] = res.reviews.map((r) => ({
      id: r.id,
      packId: r.id,
      type: r.type === 'ACTION_PACK' ? '工作包' : 'QA升级',
      code: r.id.slice(-8).toUpperCase(),
      title: r.visit ? `${r.visit.type} 工作包 (${r.itemCount ?? 0}项)` : r.type,
      submitter: r.visit?.cra?.name ? `${r.visit.cra.name} CRA` : '',
      time: r.submittedAt?.slice(5, 16).replace('T', ' ') ?? '',
      severity: null,
      project: r.visit ? `${r.visit.project.code} · ${r.visit.site.name}${r.visit.site.code}` : '',
    }));

    return { items, doneCount: 0 };
  },

  reviewDecide: (packId: string, decision: 'APPROVE' | 'RETURN' | 'ESCALATE_QA', comment?: string) =>
    request(`/api/reviews/action-packs/${packId}`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    }),

  syncStatus: () =>
    request<{ pendingDrafts: number; pendingInputs: number; needsSync: boolean }>('/api/sync/status'),

  sync: (payload: SyncPayload) =>
    request<{
      status: string;
      syncedInputs: number;
      conflicts?: Array<Record<string, unknown>>;
    }>('/api/sync', { method: 'POST', body: JSON.stringify(payload) }),

  uploadAttachment: async (
    visitId: string,
    file: LocalFile,
    opts?: { clientAttachmentId?: string; purpose?: string; note?: string },
  ) => {
    const token = await loadToken();
    const form = new FormData();
    form.append('monitoringVisitId', visitId);
    if (opts?.clientAttachmentId) form.append('clientAttachmentId', opts.clientAttachmentId);
    if (opts?.purpose) form.append('purpose', opts.purpose);
    if (opts?.note) form.append('note', opts.note);
    const part = await toFormDataFile(file);
    form.append('file', part as Blob);

    const res = await fetch(`${getApiBaseUrl()}/api/attachments/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) {
      await handleUnauthorized(res.status);
      const err = body.error as { message?: string } | undefined;
      throw new ApiError(err?.message ?? res.statusText, res.status);
    }
    return body as {
      attachment: {
        id: string;
        fileName: string;
        sensitiveFlag: boolean;
        url: string;
        purpose?: string | null;
        fileType?: string | null;
      };
      idempotent?: boolean;
    };
  },

  listAttachments: (visitId: string) =>
    request<{
      attachments: Array<{
        id: string;
        fileName: string;
        mimeType: string;
        fileType?: string | null;
        url: string;
        createdAt: string;
      }>;
    }>(`/api/attachments/visit/${visitId}`),

  updateAttachment: (id: string, data: { purpose?: string; confirmed?: boolean; note?: string }) =>
    request<{ attachment: { id: string; fileType?: string | null } }>(`/api/attachments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAttachment: (id: string) =>
    request<{ deleted: boolean }>(`/api/attachments/${id}`, { method: 'DELETE' }),

  transcribeVoice: async (file: LocalFile | string) => {
    const token = await loadToken();
    const form = new FormData();
    const local: LocalFile =
      typeof file === 'string'
        ? { uri: file, name: 'recording.m4a', mimeType: 'audio/m4a' }
        : {
            uri: file.uri,
            name: file.name || 'recording.webm',
            mimeType: file.mimeType || file.blob?.type || 'audio/webm',
            blob: file.blob,
          };
    const part = await toFormDataFile(local);
    form.append('file', part as Blob);

    const res = await fetch(`${getApiBaseUrl()}/api/voice/transcribe`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) {
      await handleUnauthorized(res.status);
      const err = body.error as { message?: string } | undefined;
      throw new ApiError(err?.message ?? res.statusText, res.status);
    }
    return body as { transcript: string; source: string; sensitiveHints?: string[] };
  },
};
