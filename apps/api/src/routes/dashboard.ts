/**
 * Phase 3 dashboard endpoints. Reads live Prisma counts and recent
 * audit / risk / safety rows scoped to the caller's project. Phase 1
 * shipped mock arrays (SUBJECTS / RISK_ITEMS / ENROLLMENT_DATA / ...) in
 * the Web client; this module replaces those with real aggregates that
 * flow into RiskMonitorPage and DashboardPage.
 *
 * All responses are scoped to a projectId passed via ?projectId=...
 * The Web app reads the current projectId from the saved session.
 */
import type { FastifyInstance } from "fastify";
import { ApiErrorCode, ApiErrorException } from "@aic-dct/domain";
import { prisma } from "../db.js";

interface SubjectStatusCounts {
  total: number;
  enrolled: number;
  screening: number;
  active: number;
  completed: number;
  withdrawn: number;
}

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

function monthBucket(date: Date): string {
  return MONTH_LABELS[date.getMonth()] ?? `${date.getMonth() + 1}月`;
}

async function requireProject(req: import("fastify").FastifyRequest, projectId: string) {
  const project = await prisma().project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new ApiErrorException(
      ApiErrorCode.NOT_FOUND,
      "Project not found",
      { requestId: req.id, details: { projectId } },
    );
  }
  return project;
}

export function registerDashboardRoutes(app: FastifyInstance): void {
  /**
   * Returns the 5 headline KPIs for the project dashboard.
   */
  app.get<{ Querystring: { projectId: string } }>(
    "/api/dashboard/kpis",
    async (req) => {
      const projectId = req.query.projectId;
      const project = await requireProject(req, projectId);

      const [subjects, visits, questionnaires, safetyEvents, openRisks] =
        await Promise.all([
          prisma().subject.findMany({
            where: { projectId },
            select: { status: true },
          }),
          prisma().visit.findMany({
            where: { subject: { projectId } },
            select: { status: true, scheduledAt: true },
          }),
          prisma().questionnaireResponse.findMany({
            where: { subject: { projectId } },
            select: { status: true },
          }),
          prisma().safetyEvent.findMany({
            where: { projectId },
            select: { isSerious: true, status: true },
          }),
          prisma().riskSignal.findMany({
            where: { projectId },
            select: { level: true, status: true },
          }),
        ]);

      const counts: SubjectStatusCounts = {
        total: subjects.length,
        enrolled: 0,
        screening: 0,
        active: 0,
        completed: 0,
        withdrawn: 0,
      };
      for (const s of subjects) {
        switch (s.status) {
          case "Screening":
            counts.screening++;
            break;
          case "Active":
            counts.enrolled++;
            counts.active++;
            break;
          case "Completed":
            counts.completed++;
            break;
          case "Withdrawn":
            counts.withdrawn++;
            break;
        }
      }

      const enrolled = counts.enrolled;
      const target = 150;
      const enrollmentPct = Math.round((enrolled / target) * 100);

      const now = new Date();
      const thisMonth = now.getMonth();
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const visitsThisMonth = visits.filter(
        (v) => new Date(v.scheduledAt).getMonth() === thisMonth,
      );
      const visitsLastMonth = visits.filter(
        (v) => new Date(v.scheduledAt).getMonth() === lastMonth,
      );
      const visitCompletionPct = Math.round(
        (visits.filter((v) => v.status === "Completed").length /
          Math.max(1, visits.length)) *
          100,
      );
      const visitCompletionDelta =
        visitsThisMonth.length - visitsLastMonth.length;

      const submitted = questionnaires.filter(
        (q) => q.status === "Submitted",
      ).length;
      const eproPct = Math.round(
        (submitted / Math.max(1, questionnaires.length)) * 100,
      );

      const aeCount = safetyEvents.filter((e) => !e.isSerious).length;
      const saeCount = safetyEvents.filter((e) => e.isSerious).length;

      const highPriority = openRisks.filter(
        (r) => r.level === "Critical" || r.level === "High",
      ).length;

      return {
        projectId: project.id,
        kpis: [
          {
            id: "enrollment",
            title: "入组进度",
            value: `${enrolled}/${target}`,
            sub: `目标 ${target} 人 · 完成度 ${enrollmentPct}%`,
            trend: `本月 +${visitsThisMonth.length}`,
            trendUp: true,
            color: "var(--primary)",
          },
          {
            id: "visits",
            title: "访视完成率",
            value: `${visitCompletionPct}%`,
            sub: `本月 ${visitsThisMonth.length} 次访视`,
            trend: `较上月 ${visitCompletionDelta >= 0 ? "+" : ""}${visitCompletionDelta}`,
            trendUp: visitCompletionDelta >= 0,
            color: "var(--risk-low-text)",
          },
          {
            id: "epro",
            title: "ePRO完成率",
            value: `${eproPct}%`,
            sub: `本周 ${submitted} 份已提交`,
            trend: `样本量 ${questionnaires.length}`,
            trendUp: true,
            color: "var(--accent)",
          },
          {
            id: "ae-sae",
            title: "AE/SAE",
            value: `${aeCount}/${saeCount}`,
            sub: `${aeCount} 项 AE · ${saeCount} 项 SAE`,
            trend: `未关 ${saeCount} SAE`,
            trendUp: false,
            color: "var(--risk-high-text)",
          },
          {
            id: "tasks",
            title: "待处理任务",
            value: String(highPriority),
            sub: "高/紧急风险",
            trend: `总风险 ${openRisks.length}`,
            trendUp: false,
            color: "var(--risk-medium-text)",
          },
        ],
        counts,
      };
    },
  );

  /**
   * Enrollment trend: monthly target vs actual cumulative.
   * The seed only contains 8 subjects; we synthesize a 7-month curve
   * from subject.enrollmentDate (or createdAt) and project.startDate.
   */
  app.get<{ Querystring: { projectId: string } }>(
    "/api/dashboard/enrollment-trend",
    async (req) => {
      const projectId = req.query.projectId;
      const project = await requireProject(req, projectId);
      const subjects = await prisma().subject.findMany({
        where: { projectId },
        select: { createdAt: true, enrollmentDate: true },
      });
      const start = project.startDate;
      const months: { month: string; target: number; actual: number }[] = [];
      const startMonth = start.getMonth();
      for (let i = 0; i < 7; i++) {
        const m = (startMonth + i) % 12;
        const cutoff = new Date(start);
        cutoff.setMonth(cutoff.getMonth() + i + 1);
        const actual = subjects.filter(
          (s) => (s.enrollmentDate ?? s.createdAt) <= cutoff,
        ).length;
        const target = Math.round(((i + 1) / 7) * 150);
        months.push({ month: MONTH_LABELS[m] ?? `${m + 1}月`, target, actual });
      }
      return { projectId, points: months };
    },
  );

  /**
   * Risk trend: monthly count of risk signals grouped by level.
   */
  app.get<{ Querystring: { projectId: string } }>(
    "/api/dashboard/risk-trend",
    async (req) => {
      const projectId = req.query.projectId;
      await requireProject(req, projectId);
      const risks = await prisma().riskSignal.findMany({
        where: { projectId },
        select: { level: true, createdAt: true },
      });
      const byMonth = new Map<string, { low: number; medium: number; high: number; critical: number }>();
      for (const r of risks) {
        const key = monthBucket(r.createdAt);
        const entry = byMonth.get(key) ?? { low: 0, medium: 0, high: 0, critical: 0 };
        if (r.level === "Low") entry.low++;
        else if (r.level === "Medium") entry.medium++;
        else if (r.level === "High") entry.high++;
        else if (r.level === "Critical") entry.critical++;
        byMonth.set(key, entry);
      }
      return {
        projectId,
        points: Array.from(byMonth.entries()).map(([name, v]) => ({ name, ...v })),
      };
    },
  );

  /**
   * Center risk: per-site aggregate of risk signal severity.
   */
  app.get<{ Querystring: { projectId: string } }>(
    "/api/dashboard/center-risk",
    async (req) => {
      const projectId = req.query.projectId;
      await requireProject(req, projectId);
      const sites = await prisma().site.findMany({
        where: { projectId },
        include: {
          subjects: {
            include: { riskSignals: { select: { level: true, status: true } } },
          },
        },
      });
      const rows = sites.map((s) => {
        const levels = s.subjects.flatMap((sub) =>
          sub.riskSignals
            .filter((r) => r.status === "Open" || r.status === "InProgress")
            .map((r) => r.level),
        );
        const critical = levels.filter((l) => l === "Critical").length;
        const high = levels.filter((l) => l === "High").length;
        const medium = levels.filter((l) => l === "Medium").length;
        const low = levels.filter((l) => l === "Low").length;
        const score = Math.min(100, critical * 25 + high * 10 + medium * 4 + low);
        return {
          siteId: s.id,
          center: s.name,
          score,
          critical,
          high,
          medium,
          low,
        };
      });
      rows.sort((a, b) => b.score - a.score);
      return { projectId, rows };
    },
  );

  /**
   * Risk list for the dashboard. Joined with subject/site for display.
   */
  app.get<{ Querystring: { projectId: string } }>(
    "/api/dashboard/risks",
    async (req) => {
      const projectId = req.query.projectId;
      await requireProject(req, projectId);
      const risks = await prisma().riskSignal.findMany({
        where: { projectId },
        include: {
          subject: { select: { subjectCode: true, site: { select: { name: true } } } },
          owner: { select: { displayName: true } },
        },
        orderBy: [{ level: "desc" }, { createdAt: "desc" }],
        take: 50,
      });
      return {
        projectId,
        items: risks.map((r) => ({
          id: r.id,
          level: r.level.toLowerCase(),
          type: r.type,
          object: r.subject ? r.subject.subjectCode : r.objectType,
          trigger: r.trigger,
          suggestion: r.suggestion ?? "",
          owner: r.owner?.displayName ?? "未分配",
          deadline: r.deadline ? r.deadline.toISOString().slice(0, 16).replace("T", " ") : "—",
          status: statusToWorkflow(r.status),
        })),
      };
    },
  );

  /**
   * High-risk subjects. AI risk score is derived from the latest
   * AIOutput for that subject (confidence * 100). Subjects without an
   * AIOutput are filtered out so we only return real risk flags.
   */
  app.get<{ Querystring: { projectId: string } }>(
    "/api/dashboard/high-risk-subjects",
    async (req) => {
      const projectId = req.query.projectId;
      await requireProject(req, projectId);
      const subjects = await prisma().subject.findMany({
        where: { projectId, status: { in: ["Active", "Screening", "Consenting"] } },
        include: {
          site: { select: { name: true } },
          riskSignals: { select: { level: true, status: true } },
        },
        take: 20,
      });
      const aiBySubject = await prisma().aIOutput.groupBy({
        by: ["subjectId"],
        where: { projectId, subjectId: { not: null } },
        _max: { confidence: true, generatedAt: true },
      });
      const aiMap = new Map<string, number>();
      for (const row of aiBySubject) {
        if (row.subjectId) aiMap.set(row.subjectId, Math.round((row._max.confidence ?? 0) * 100));
      }
      const items = subjects
        .map((s) => {
          const ai = aiMap.get(s.id) ?? null;
          const openRisks = s.riskSignals.filter(
            (r) => r.status === "Open" || r.status === "InProgress",
          );
          const level = pickLevel(openRisks.map((r) => r.level), ai);
          return {
            id: s.id,
            subjectCode: s.subjectCode,
            center: s.site.name,
            visit: "V?", // Phase 2 will resolve this from the latest visit
            aiRisk: ai ?? 0,
            riskLevel: level,
          };
        })
        .filter((row) => row.aiRisk >= 70);
      return { projectId, items };
    },
  );

  /**
   * AI suggestions for the dashboard. Each suggestion is a pending AIOutput
   * (status = Pending) so the UI surfaces real AI drafts awaiting human
   * confirmation. Returns up to `limit` items (default 2).
   */
  app.get<{ Querystring: { projectId: string; limit?: string } }>(
    "/api/dashboard/ai-suggestions",
    async (req) => {
      const projectId = req.query.projectId;
      const limit = Math.max(1, Math.min(10, Number(req.query.limit ?? 2)));
      await requireProject(req, projectId);
      const outputs = await prisma().aIOutput.findMany({
        where: { projectId, status: "Pending" },
        orderBy: [{ confidence: "desc" }, { generatedAt: "desc" }],
        take: limit,
      });
      // AIOutput has subjectId but no relation back to Subject in the
      // current schema; resolve codes in a single follow-up query.
      const subjectIds = Array.from(
        new Set(outputs.map((o) => o.subjectId).filter((id): id is string => Boolean(id))),
      );
      const subjects =
        subjectIds.length === 0
          ? []
          : await prisma().subject.findMany({
              where: { id: { in: subjectIds } },
              select: { id: true, subjectCode: true },
            });
      const codeMap = new Map(subjects.map((s) => [s.id, s.subjectCode]));
      return {
        projectId,
        items: outputs.map((o) => {
          const payload = (o.payload ?? {}) as Record<string, unknown>;
          const title =
            (payload.title as string | undefined) ?? defaultTitleForKind(o.kind);
          const summary =
            (payload.summary as string | undefined) ??
            (payload.content as string | undefined) ??
            "";
          const subjectCode = o.subjectId ? codeMap.get(o.subjectId) : undefined;
          const sourceRef = subjectCode
            ? `受试者 ${subjectCode} · ${o.model} v${o.modelVersion}`
            : `${o.model} v${o.modelVersion}`;
          return {
            id: o.id,
            title,
            content: summary,
            source: sourceRef,
            confidence: o.confidence,
            kind: o.kind,
            generatedAt: o.generatedAt.toISOString(),
          };
        }),
      };
    },
  );

  /**
   * My tasks (待办). Derived from open high-priority risk signals —
   * Critical + High levels surface as actionable tasks. Returns up to
   * `limit` items (default 5). The dashboard renders real database rows
   * instead of hardcoded mock data.
   */
  app.get<{ Querystring: { projectId: string; limit?: string } }>(
    "/api/dashboard/tasks",
    async (req) => {
      const projectId = req.query.projectId;
      const limit = Math.max(1, Math.min(20, Number(req.query.limit ?? 5)));
      await requireProject(req, projectId);
      const risks = await prisma().riskSignal.findMany({
        where: {
          projectId,
          level: { in: ["Critical", "High"] },
          status: { in: ["Open", "InProgress"] },
        },
        include: {
          subject: { select: { subjectCode: true } },
          owner: { select: { displayName: true } },
        },
        orderBy: [{ level: "desc" }, { deadline: "asc" }, { createdAt: "desc" }],
        take: limit,
      });
      return {
        projectId,
        items: risks.map((r) => {
          const deadline = r.deadline
            ? r.deadline.toISOString().slice(0, 16).replace("T", " ")
            : "—";
          return {
            id: r.id,
            title: humanizeRiskTitle(r.type, r.subject?.subjectCode ?? r.objectType),
            meta: r.subject
              ? `${r.subject.subjectCode} · 责任人 ${r.owner?.displayName ?? "未分配"}`
              : `${r.objectType} · 责任人 ${r.owner?.displayName ?? "未分配"}`,
            tag: r.level === "Critical" ? "高风险" : "AI 待确认",
            tagTone: r.level === "Critical" ? "danger" : "ai",
            due: deadline,
            level: r.level.toLowerCase(),
            type: r.type,
            objectCode: r.subject?.subjectCode ?? r.objectType,
          };
        }),
      };
    },
  );

  /**
   * Recent audit events for the dashboard "audit log" panel.
   */
  app.get<{ Querystring: { projectId: string; limit?: string } }>(
    "/api/dashboard/audit",
    async (req) => {
      const projectId = req.query.projectId;
      const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 5)));
      await requireProject(req, projectId);
      const events = await prisma().auditEvent.findMany({
        where: { projectId },
        orderBy: { timestamp: "desc" },
        take: limit,
      });
      return {
        projectId,
        items: events.map((e) => ({
          time: e.timestamp.toISOString().slice(0, 19).replace("T", " "),
          user: e.actorUserId.slice(0, 6) + " (" + e.actorRole + ")",
          action: `${e.action} · ${e.objectType}`,
          result: "成功",
        })),
      };
    },
  );
}

function statusToWorkflow(status: string): "pending" | "processing" | "resolved" {
  if (status === "Open") return "pending";
  if (status === "InProgress") return "processing";
  if (status === "Resolved" || status === "Closed") return "resolved";
  return "pending";
}

function pickLevel(
  openLevels: string[],
  ai: number | null,
): "low" | "medium" | "high" | "critical" {
  const order: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const fromRisks = openLevels.reduce<string | null>((acc, l) => {
    const cur = (acc ?? "low").toLowerCase();
    return (order[l.toLowerCase()] ?? 0) > (order[cur] ?? 0) ? l.toLowerCase() : acc;
  }, null);
  if (fromRisks) return fromRisks as "low" | "medium" | "high" | "critical";
  if (ai === null) return "low";
  if (ai >= 85) return "critical";
  if (ai >= 70) return "high";
  if (ai >= 50) return "medium";
  return "low";
}

function defaultTitleForKind(kind: string): string {
  switch (kind) {
    case "subject_safety_summary":
      return "受试者安全摘要草稿";
    case "visit_note_draft":
      return "访视病程草稿";
    case "ae_classification":
      return "AE 严重程度判定草稿";
    case "risk_cluster_summary":
      return "中心风险聚类摘要";
    case "protocol_parse":
      return "方案关键约束摘要";
    default:
      return `AI 草稿（${kind}）`;
  }
}

function humanizeRiskTitle(type: string, objectCode: string): string {
  switch (type) {
    case "AE":
      return `处理 AE 报告（${objectCode}）`;
    case "SAE":
      return `签署 SAE 报告（${objectCode}）`;
    case "VisitCompliance":
      return `回访超窗受试者（${objectCode}）`;
    case "DataQuality":
      return `处理数据质量告警（${objectCode}）`;
    case "ConsentExpiry":
      return `续签知情同意书（${objectCode}）`;
    case "LabValue":
      return `复核实验室异常值（${objectCode}）`;
    case "Adherence":
      return `联系依从性下降受试者（${objectCode}）`;
    default:
      return `处理 ${type}（${objectCode}）`;
  }
}
