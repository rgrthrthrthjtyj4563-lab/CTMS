/** Monitoring visit types */
export type MonitoringVisitType = 'SIV' | 'IMV' | 'COV';

export type MonitoringVisitStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'PENDING_WRAP_UP'
  | 'PENDING_CRA_CONFIRM'
  | 'PENDING_PM_REVIEW'
  | 'PM_RETURNED'
  | 'PENDING_QA_REVIEW'
  | 'APPROVED'
  | 'CANCELLED';

export type UserRole = 'CRA' | 'PM' | 'QA' | 'ADMIN';

export type ActionPackStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'PENDING_CONFIRM'
  | 'PARTIALLY_CONFIRMED'
  | 'CONFIRMED'
  | 'SUBMITTED'
  | 'FAILED';

export type ActionItemType =
  | 'MONITORING_VISIT_RECORD'
  | 'HOURS'
  | 'ISSUE'
  | 'RISK_CANDIDATE'
  | 'CAPA_CANDIDATE'
  | 'TASK'
  | 'EVIDENCE'
  | 'REPORT_DRAFT'
  | 'FOLLOW_UP_ITEM';

export type ActionItemStatus =
  | 'SUGGESTED'
  | 'EDITED'
  | 'PENDING_CONFIRM'
  | 'CONFIRMED'
  | 'SAVED'
  | 'SAVE_FAILED'
  | 'PENDING_REVIEW'
  | 'RETURNED'
  | 'APPROVED'
  | 'CORRECTED'
  | 'DELETED';

export type IssueStatus =
  | 'DRAFT_CANDIDATE'
  | 'CRA_CONFIRMED'
  | 'PENDING_PM_REVIEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PENDING_VERIFICATION'
  | 'CLOSED'
  | 'CANCELLED';

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IssueCategory =
  | 'DOCUMENTATION'
  | 'DRUG_ACCOUNTABILITY'
  | 'INFORMED_CONSENT'
  | 'PROTOCOL_DEVIATION'
  | 'SAFETY'
  | 'DATA_QUALITY'
  | 'REGULATORY'
  | 'OTHER';

export type HoursWorkType =
  | 'ON_SITE_MONITORING'
  | 'VISIT_PREPARATION'
  | 'REPORT_WRITING'
  | 'SITE_COMMUNICATION'
  | 'STARTUP'
  | 'TRAVEL'
  | 'OTHER';

export type HoursStatus =
  | 'DRAFT_CANDIDATE'
  | 'CRA_CONFIRMED'
  | 'PENDING_PM_REVIEW'
  | 'APPROVED'
  | 'RETURNED';

export type InputType = 'TEXT' | 'VOICE' | 'IMAGE' | 'FILE';

export type InputStatus =
  | 'EDITING'
  | 'UPLOADING'
  | 'OFFLINE_SAVED'
  | 'AI_PROCESSING'
  | 'NEEDS_SUPPLEMENT'
  | 'PENDING_CONFIRM'
  | 'PARTIALLY_CONFIRMED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABANDONED';

export type TodoGroup =
  | 'NOW'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'PENDING_MY_CONFIRM'
  | 'PENDING_MY_REVIEW'
  | 'WAITING_OTHERS';

export type ReviewDecision = 'APPROVE' | 'RETURN' | 'ESCALATE_QA';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

/** Action pack summary for UI */
export interface ActionPackSummary {
  projectId: string;
  projectName: string;
  siteId: string;
  siteName: string;
  visitType: MonitoringVisitType;
  visitDate: string;
  totalActions: number;
  pendingConfirm: number;
  missingOrConflict: number;
  riskOrEscalationCandidates: number;
  hasBlockingItems: boolean;
}

/** How an action item was produced */
export type ActionOrigin = 'MODEL' | 'RULE' | 'MANUAL';

/** Single action item in an action pack */
export interface ActionItemPayload {
  type: ActionItemType;
  title: string;
  description?: string;
  data: Record<string, unknown>;
  sourceInputIds?: string[];
  sourceAttachmentIds?: string[];
  /** Structured sources with excerpts for UI audit trail */
  sources?: ActionSource[];
  /** MODEL = LLM, RULE = rule fallback, MANUAL = user-added */
  origin?: ActionOrigin;
  requiresIndividualConfirm?: boolean;
  blockingReason?: string;
}

/** AI-generated action pack structure */
export interface GeneratedActionPack {
  summary: ActionPackSummary;
  actions: ActionItemPayload[];
  followUpQuestions?: string[];
  warnings?: string[];
  sources?: ActionSource[];
}

export interface ActionSource {
  inputId?: string;
  attachmentId?: string;
  excerpt: string;
  field?: string;
}

/** Monitoring visit record candidate */
export interface MonitoringVisitRecordData {
  actualStartTime: string;
  actualEndTime: string;
  subjectsReviewed?: number;
  sitePersonnel?: string[];
  workSummary: string;
  findings?: string[];
}

/** Hours candidate */
export interface HoursRecordData {
  date: string;
  workType: HoursWorkType;
  startTime?: string;
  endTime?: string;
  durationHours: number;
  description: string;
  projectId: string;
  siteId?: string;
  monitoringVisitId?: string;
}

/** Issue candidate */
export interface IssueRecordData {
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
  subjectId?: string;
  responsiblePerson?: string;
  targetDate?: string;
  requiredEvidence?: string;
  projectId: string;
  siteId: string;
  monitoringVisitId?: string;
}

/** Risk candidate */
export interface RiskCandidateData {
  title: string;
  description: string;
  rationale: string;
  relatedIssueTitles?: string[];
  severity: IssueSeverity;
}

/** CAPA candidate */
export interface CapaCandidateData {
  triggerReason: string;
  relatedIssueTitles?: string[];
  rootCauseHypothesis: string;
  correctiveAction: string;
  preventiveAction: string;
  suggestedOwner?: string;
  suggestedDueDate?: string;
}

/** Task / follow-up */
export interface TaskRecordData {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  relatedIssueTitle?: string;
  monitoringVisitId?: string;
}

/** Evidence association */
export interface EvidenceRecordData {
  attachmentId: string;
  fileName: string;
  fileType?: string;
  suggestedCategory?: string;
  relatedTo?: string;
  sensitiveInfoDetected?: boolean;
}

/** Report draft section */
export interface ReportDraftSection {
  sectionKey: string;
  title: string;
  content: string;
  sourceExcerpts?: string[];
  status: 'DRAFT' | 'NEEDS_SUPPLEMENT';
}

export interface ReportDraftData {
  title: string;
  sections: ReportDraftSection[];
}

/** Follow-up letter item */
export interface FollowUpItemData {
  item: string;
  responsiblePerson: string;
  dueDate: string;
  requiredEvidence?: string;
  relatedIssueTitle?: string;
  suggestedWording?: string;
}

/** Workbench context */
export interface WorkbenchContext {
  organizationId: string;
  organizationName: string;
  projectId?: string;
  projectName?: string;
  siteId?: string;
  siteName?: string;
  activeMonitoringVisitId?: string;
}

/** Workbench highlights */
export interface WorkbenchHighlight {
  id: string;
  type: 'PLANNED_VISIT' | 'ACTIVE_VISIT' | 'PENDING_ACTION_PACK' | 'DUE_ISSUE' | 'PM_RETURN' | 'UNCONFIRMED_HOURS';
  title: string;
  subtitle?: string;
  priority: number;
  actionUrl?: string;
  dueDate?: string;
}

/** Audit event types */
export type AuditEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'INPUT_CREATED'
  | 'INPUT_UPDATED'
  | 'INPUT_EDITED'
  | 'INPUT_VOIDED'
  | 'AI_GENERATED'
  | 'AI_GENERATED_IDEMPOTENT'
  | 'ACTION_CONFIRMED'
  | 'ACTION_DELETED'
  | 'ACTION_EDITED'
  | 'VISIT_STARTED'
  | 'VISIT_ENDED'
  | 'VISIT_ENDED_IDEMPOTENT'
  | 'ACTIVITY_UPDATED'
  | 'PACK_SUBMITTED'
  | 'PM_REVIEW'
  | 'QA_REVIEW'
  | 'SYNC'
  | 'ATTACHMENT_UPLOADED'
  | 'VOICE_TRANSCRIBED';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  userId: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

/** Offline sync payload */
export interface SyncPayload {
  clientId: string;
  lastSyncedAt?: string;
  inputs?: Array<{
    clientInputId: string;
    monitoringVisitId: string;
    type: InputType;
    content: string;
    createdAt: string;
  }>;
  attachments?: Array<{
    clientAttachmentId: string;
    monitoringVisitId: string;
    fileName: string;
    mimeType: string;
    createdAt: string;
  }>;
}

export interface SyncResult {
  status: SyncStatus;
  syncedInputs: number;
  syncedAttachments: number;
  conflicts?: Array<{
    entityType: string;
    entityId: string;
    serverVersion: Record<string, unknown>;
    clientVersion: Record<string, unknown>;
  }>;
  errors?: string[];
}

/** API response wrappers */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}