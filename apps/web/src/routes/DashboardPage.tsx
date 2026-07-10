import {
  Users,
  Activity,
  ClipboardList,
  AlertTriangle,
  CheckSquare,
  Play,
  Pause,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { KpiCard } from "../components/domain/KpiCard.js";
import { RiskCard, type RiskCardItem } from "../components/domain/RiskCard.js";
import { AISuggestionCard } from "../components/domain/AISuggestionCard.js";
import { SectionHeader } from "../components/ui/SectionHeader.js";
import { Card } from "../components/ui/Card.js";
import { Modal } from "../components/ui/Modal.js";
import { Drawer } from "../components/ui/Drawer.js";
import { Button } from "../components/ui/Button.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { AuditTrail, type AuditEntry } from "../components/ui/AuditTrail.js";
import { InfoRow } from "../components/ui/InfoRow.js";
import { Tag } from "../components/ui/Tag.js";
import { RiskTag } from "../components/domain/RiskTag.js";
import { apiGet, ApiError } from "../lib/api/client.js";
import { loadSession } from "../lib/session.js";
import { pushToast } from "../components/ui/Toast.js";
import {
  type RiskLevel,
} from "../domain/types.js";
import { RISK_VISUAL } from "../domain/types.js";

interface KpiItem {
  id: string;
  title: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  color: string;
}

interface TrendPoint {
  month?: string;
  name?: string;
  target?: number;
  actual?: number;
  low?: number;
  medium?: number;
  high?: number;
  critical?: number;
}

interface CenterRow {
  siteId: string;
  center: string;
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface SubjectRow {
  id: string;
  subjectCode: string;
  center: string;
  visit: string;
  aiRisk: number;
  riskLevel: RiskLevel;
}

interface AiSuggestion {
  id: string;
  title: string;
  content: string;
  source: string;
  confidence: number;
  kind: string;
  generatedAt: string;
}

interface TaskRow {
  id: string;
  title: string;
  meta: string;
  tag: string;
  tagTone: "ai" | "danger" | "info";
  due: string;
  level: string;
  type: string;
  objectCode: string;
}

function tagForLevel(level: RiskLevel) {
  return <RiskTag level={level} />;
}
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} 天前`;
}
export function DashboardPage() {
  const navigate = useNavigate();
  const session = useMemo(() => loadSession(), []);
  const [kpis, setKpis] = useState<KpiItem[] | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [riskTrend, setRiskTrend] = useState<TrendPoint[] | null>(null);
  const [centers, setCenters] = useState<CenterRow[] | null>(null);
  const [risks, setRisks] = useState<RiskCardItem[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [aiList, setAiList] = useState<AiSuggestion[] | null>(null);
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedRisk, setSelectedRisk] = useState<RiskCardItem | null>(null);
  const [riskDrawerOpen, setRiskDrawerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    const projectId = session.projectId;
    let cancelled = false;
    setError(null);

    const fetcher = async <T,>(path: string) => apiGet<T>(`${path}?projectId=${projectId}`);

    Promise.all([
      fetcher<{ kpis: KpiItem[] }>("/api/dashboard/kpis"),
      fetcher<{ points: TrendPoint[] }>("/api/dashboard/enrollment-trend"),
      fetcher<{ points: TrendPoint[] }>("/api/dashboard/risk-trend"),
      fetcher<{ rows: CenterRow[] }>("/api/dashboard/center-risk"),
      fetcher<{ items: RiskCardItem[] }>("/api/dashboard/risks"),
      fetcher<{ items: SubjectRow[] }>("/api/dashboard/high-risk-subjects"),
      fetcher<{ items: AuditEntry[] }>("/api/dashboard/audit?limit=5"),
      fetcher<{ items: AiSuggestion[] }>("/api/dashboard/ai-suggestions?limit=2"),
      fetcher<{ items: TaskRow[] }>("/api/dashboard/tasks?limit=5"),
    ])
      .then(([k, t, r, c, ri, s, a, ai, tk]) => {
        if (cancelled) return;
        setKpis(k.kpis);
        setTrend(t.points);
        setRiskTrend(r.points);
        setCenters(c.rows);
        setRisks(ri.items);
        setSubjects(s.items);
        setAudit(a.items);
        setAiList(ai.items);
        setTasks(tk.items);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "数据加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, session]);

  if (!session) return null;
  if (error) {
    return (
      <EmptyState
        title="无法加载驾驶舱"
        desc={error}
        action={
          <Button size="sm" onClick={() => window.location.reload()}>
            重试
          </Button>
        }
      />
    );
  }
  if (kpis === null || trend === null || riskTrend === null || aiList === null || tasks === null) {
    return <LoadingState label="正在加载项目驾驶舱..." />;
  }

  const visitCompletion = kpis.find((k) => k.id === "visits");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">项目驾驶舱</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {session.projectCode} · {session.projectName} · 项目视图
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tag tone="primary" size="md">Phase II</Tag>
          <Tag tone="info" size="md">AI 监查开启</Tag>
          <Button variant="outline" size="sm">
            {visitCompletion?.value} 访视完成
          </Button>
          <Button variant="primary" size="sm" icon={<ChevronRight className="w-3.5 h-3.5" />}>
            查看完整报告
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map((k) => (
          <KpiCard
            key={k.id}
            title={k.title}
            value={k.value}
            sub={k.sub}
            trend={k.trend}
            trendUp={k.trendUp}
            color={k.color}
            icon={iconForKpi(k.id)}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionHeader
            title="入组趋势"
            sub="目标 vs 实际（最近 7 个月）"
            actions={
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded" style={{ background: "var(--primary)" }} />
                  实际入组
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded" style={{ background: "#94a3b8" }} />
                  目标
                </span>
              </div>
            }
          />
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="风险等级趋势"
            sub="按月统计各等级 AI 风险信号"
            actions={
              <div className="flex items-center gap-2 text-xs">
                <Tag size="sm" tone="success">低</Tag>
                <Tag size="sm" tone="warning">中</Tag>
                <Tag size="sm" tone="danger">高</Tag>
                <Tag size="sm" tone="violet">紧急</Tag>
              </div>
            }
          />
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskTrend}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="low" stackId="risk" fill={RISK_VISUAL.low.dot} />
                <Bar dataKey="medium" stackId="risk" fill={RISK_VISUAL.medium.dot} />
                <Bar dataKey="high" stackId="risk" fill={RISK_VISUAL.high.dot} />
                <Bar dataKey="critical" stackId="risk" fill={RISK_VISUAL.critical.dot} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* AI suggestion + Center risk */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-3">
          {aiList.length === 0 ? (
            <Card>
              <EmptyState title="暂无 AI 草稿待确认" desc="所有 Pending AIOutput 已处理。" />
            </Card>
          ) : (
            aiList.map((ai) => (
              <AISuggestionCard
                key={ai.id}
                title={ai.title}
                content={ai.content || "（AI 草稿无摘要内容）"}
                source={ai.source}
                generatedAt={formatRelativeTime(ai.generatedAt)}
                onConfirm={() => setAiOpen(true)}
              />
            ))
          )}
        </div>
        <Card>
          <SectionHeader title="中心风险" sub="按风险评分排序" />
          <div className="space-y-3">
            {centers === null
              ? <LoadingState label="加载中心风险" className="!py-8" />
              : centers.slice(0, 5).map((c) => (
                  <div key={c.siteId} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">
                        {c.center}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        紧急 {c.critical} · 高 {c.high} · 中 {c.medium} · 低 {c.low}
                      </div>
                    </div>
                    <div className="w-24">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${c.score}%`,
                              background:
                                c.score >= 70
                                  ? "var(--risk-critical-text)"
                                  : c.score >= 40
                                    ? "var(--risk-high-text)"
                                    : "var(--risk-medium-text)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600 w-6 text-right">
                          {c.score}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </Card>
      </div>

      {/* High-risk subjects + Risk list */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <SectionHeader
            title="高风险受试者"
            sub="AI 风险分 ≥ 70"
            actions={
              <Button variant="ghost" size="sm">
                查看全部
              </Button>
            }
          />
          {subjects === null ? (
            <LoadingState className="!py-8" />
          ) : subjects.length === 0 ? (
            <EmptyState title="暂无高风险受试者" />
          ) : (
            <div className="space-y-2">
              {subjects.slice(0, 5).map((s) => {
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 py-1.5 border-b border-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-700">
                          {s.subjectCode}
                        </span>
                        {tagForLevel(s.riskLevel)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {s.center} · {s.visit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-sm font-bold"
                        style={{ color: s.aiRisk >= 85 ? "var(--risk-critical-text)" : "var(--risk-high-text)" }}
                      >
                        {s.aiRisk}
                      </div>
                      <div className="text-[10px] text-slate-400">AI 风险分</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="col-span-2">
          <SectionHeader
            title="待处理风险"
            sub="按风险等级排序"
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate("/app/risk-monitor")}>
                进入风险监查
              </Button>
            }
          />
          {risks === null ? (
            <LoadingState className="!py-8" />
          ) : risks.length === 0 ? (
            <EmptyState title="暂无待处理风险" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {risks.slice(0, 4).map((r) => (
                <RiskCard
                  key={r.id}
                  item={r}
                  onAction={(item) => {
                    setSelectedRisk(item);
                    setRiskDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My tasks + Audit */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <SectionHeader
            title="我的待办"
            sub="今日优先处理"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" icon={<Play className="w-3 h-3" />}>
                  开始
                </Button>
                <Button variant="ghost" size="sm" icon={<Pause className="w-3 h-3" />}>
                  稍后
                </Button>
              </div>
            }
          />
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <Card>
                <EmptyState title="暂无待办" desc="当前没有高/紧急风险信号需要处理。" />
              </Card>
            ) : (
              tasks.map((t) => (
                <Card key={t.id} className="!p-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-[var(--primary)] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      {t.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.meta}</div>
                  </div>
                  <Tag tone={t.tagTone}>{t.tag}</Tag>
                  <span className="text-xs text-slate-400 w-24 text-right">{t.due}</span>
                </Card>
              ))
            )}
          </div>
        </div>

        <Card>
          <SectionHeader title="审计日志" sub="最近 5 条" />
          {audit === null ? (
            <LoadingState className="!py-8" />
          ) : (
            <AuditTrail items={audit} emptyLabel="暂无审计记录" />
          )}
        </Card>
      </div>

      {/* Drawers & Modals */}
      <Drawer
        open={riskDrawerOpen}
        onClose={() => setRiskDrawerOpen(false)}
        title="风险详情"
        width={480}
      >
        {selectedRisk ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RiskTag level={selectedRisk.level} size="md" />
              <span className="text-sm font-semibold text-slate-700">
                {selectedRisk.type}
              </span>
            </div>
            <InfoRow label="受试者" value={selectedRisk.object} mono />
            <InfoRow label="触发条件" value={selectedRisk.trigger} />
            <InfoRow label="AI 建议" value={selectedRisk.suggestion} />
            <InfoRow label="责任人" value={selectedRisk.owner} />
            <InfoRow label="截止时间" value={selectedRisk.deadline} />
            <div className="flex items-center gap-2 pt-4">
              <Button variant="primary" size="sm" className="flex-1 justify-center">
                确认处理
              </Button>
              <Button variant="outline" size="sm" className="flex-1 justify-center">
                转交
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        variant="ai-confirm"
        body={
          <div className="text-sm text-slate-700 space-y-3">
            <p>
              确认后将采用 AI 生成的受试者 V2 病程摘要，并自动追加到 eSource
              与稽查文档；AI 草稿来源与置信度将保留作为元数据。
            </p>
            <div
              className="text-xs px-2.5 py-2 rounded"
              style={{ background: "var(--secondary)", color: "var(--primary)" }}
            >
              本次操作将以 <span className="font-medium">{session.displayName}</span>{" "}
              的名义记录；请在记录前再次检查关键临床数据。
            </div>
          </div>
        }
        onConfirm={() => {
          pushToast({
            tone: "success",
            title: "AI 草稿已采用",
            description: "已追加到受试者 003 的 eSource",
          });
        }}
      />
    </div>
  );
}

function iconForKpi(id: string) {
  switch (id) {
    case "enrollment":
      return <Users className="w-4 h-4" />;
    case "visits":
      return <Activity className="w-4 h-4" />;
    case "epro":
      return <ClipboardList className="w-4 h-4" />;
    case "ae-sae":
      return <AlertTriangle className="w-4 h-4" />;
    case "tasks":
      return <CheckSquare className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
}
