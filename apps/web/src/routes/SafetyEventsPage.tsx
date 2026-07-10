/**
 * AE/SAE safety events list page.
 *
 * Replaces the Phase 2 placeholder. Backed by GET /api/safety/events.
 * Filtering by status / severity is reflected in the URL query so the
 * table is deep-linkable from the AE/SAE risk cards on the dashboard.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tag } from "../components/ui/Tag.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import {
  DataTable,
  type DataTableColumn,
} from "../components/ui/DataTable.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { pushToast } from "../components/ui/Toast.js";
import {
  createSafetyEvent,
  listSafetyEvents,
  type SafetyEventListResponse,
  type SafetyEventListRow,
  type SafetyEventStatusValue,
} from "../lib/api/safety.js";
import { listSubjects, type SubjectListRow } from "../lib/api/subjects.js";
import { ApiError } from "../lib/api/client.js";

const STATUS_LABEL: Record<SafetyEventStatusValue, string> = {
  Draft: "草稿",
  InvestigatorReview: "研究者审核",
  ConfirmedAE: "AE 已确认",
  ConfirmedSAE: "SAE 已确认",
  Reported: "已上报",
  FollowUp: "随访中",
  Closed: "已关闭",
};

const STATUS_TONE: Record<
  SafetyEventStatusValue,
  "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "violet"
> = {
  Draft: "neutral",
  InvestigatorReview: "info",
  ConfirmedAE: "warning",
  ConfirmedSAE: "danger",
  Reported: "violet",
  FollowUp: "primary",
  Closed: "success",
};

const SEVERITY_TONE: Record<
  "Low" | "Medium" | "High" | "Critical",
  "neutral" | "info" | "primary" | "success" | "warning" | "danger"
> = {
  Low: "neutral",
  Medium: "info",
  High: "warning",
  Critical: "danger",
};

const SEVERITY_LABEL: Record<string, string> = {
  Low: "轻度",
  Medium: "中度",
  High: "重度",
  Critical: "危及生命",
};

/**
 * Returns true when the event must be reported to IRB / NMPA within 24h
 * of onset (the canonical SAE reporting window). Counts from onsetAt.
 */
function reportDeadline(
  onsetAt: string,
  isSerious: boolean,
  status: SafetyEventStatusValue,
): { remainingMs: number; tone: "ok" | "warn" | "alert" | "expired" | null } {
  if (!isSerious || status === "Reported" || status === "Closed") return { remainingMs: 0, tone: null };
  const elapsed = Date.now() - new Date(onsetAt).getTime();
  const deadline = 24 * 60 * 60 * 1000;
  const remaining = deadline - elapsed;
  if (remaining <= 0) return { remainingMs: remaining, tone: "expired" };
  if (remaining < 60 * 60 * 1000) return { remainingMs: remaining, tone: "alert" };
  if (remaining < 24 * 60 * 60 * 1000) return { remainingMs: remaining, tone: "warn" };
  return { remainingMs: remaining, tone: "ok" };
}

function formatRemaining(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  return `${sign}${h}h${m}m`;
}

export function SafetyEventsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as SafetyEventStatusValue | "";
  const severity = (params.get("severity") ?? "") as
    | "Low" | "Medium" | "High" | "Critical" | "";

  const [data, setData] = useState<SafetyEventListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listSafetyEvents({
      page: 1,
      pageSize: 100,
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
    })
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [status, severity]);

  const columns: DataTableColumn<SafetyEventListRow>[] = useMemo(
    () => [
      {
        key: "subjectCode",
        label: "受试者",
        width: "120px",
        render: (r) => (
          <span className="font-mono font-medium text-slate-800">
            {r.subjectCode}
          </span>
        ),
      },
      {
        key: "type",
        label: "类型",
        width: "60px",
        render: (r) => (
          <Tag tone={r.isSerious ? "danger" : "warning"}>
            {r.isSerious ? "SAE" : "AE"}
          </Tag>
        ),
      },
      {
        key: "severity",
        label: "严重程度",
        width: "100px",
        render: (r) => (
          <Tag tone={SEVERITY_TONE[r.severity] ?? "neutral"}>
            {SEVERITY_LABEL[r.severity] ?? r.severity}
          </Tag>
        ),
      },
      {
        key: "status",
        label: "状态",
        width: "120px",
        render: (r) => (
          <Tag tone={STATUS_TONE[r.status] ?? "neutral"}>
            {STATUS_LABEL[r.status] ?? r.status}
          </Tag>
        ),
      },
      {
        key: "reportTimer",
        label: "SAE 报告倒计时",
        width: "140px",
        render: (r) => {
          const d = reportDeadline(r.onsetAt, r.isSerious, r.status);
          if (!d.tone) return <span className="text-xs text-slate-400">—</span>;
          const tone = d.tone;
          const label =
            tone === "expired"
              ? `已超期 ${formatRemaining(d.remainingMs)}`
              : `剩 ${formatRemaining(d.remainingMs)}`;
          const color =
            tone === "expired"
              ? "var(--risk-critical-text)"
              : tone === "alert"
                ? "var(--risk-critical-text)"
                : tone === "warn"
                  ? "var(--risk-high-text)"
                  : "var(--risk-medium-text)";
          return (
            <span className="text-xs font-medium" style={{ color }}>
              {label}
            </span>
          );
        },
      },
      {
        key: "onsetAt",
        label: "发生时间",
        width: "160px",
        render: (r) => r.onsetAt.slice(0, 16).replace("T", " "),
      },
      { key: "createdBy", label: "记录人", width: "120px" },
      {
        key: "description",
        label: "事件描述",
        render: (r) => (
          <span className="line-clamp-2 text-xs text-slate-600">
            {r.description}
          </span>
        ),
      },
    ],
    [],
  );

  /* ─── Create modal state ─────────────────────────────── */
  const [createOpen, setCreateOpen] = useState(false);
  const [subjects, setSubjects] = useState<SubjectListRow[]>([]);
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formOnsetAt, setFormOnsetAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [formSeverity, setFormSeverity] = useState<
    "Low" | "Medium" | "High" | "Critical"
  >("Medium");
  const [formSerious, setFormSerious] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openCreate = async () => {
    setCreateOpen(true);
    try {
      const res = await listSubjects({ pageSize: 50 });
      setSubjects(res.items);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "加载受试者失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    }
  };

  const submitCreate = async () => {
    if (!formSubjectId || !formDescription.trim()) {
      pushToast({ tone: "error", title: "请填写受试者与描述" });
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSafetyEvent({
        subjectId: formSubjectId,
        onsetAt: new Date(formOnsetAt).toISOString(),
        description: formDescription.trim(),
        severity: formSeverity,
        isSerious: formSerious,
      });
      pushToast({ tone: "success", title: "AE 已记录为草稿" });
      setCreateOpen(false);
      // Refresh, then jump to the new event's detail page.
      const res = await listSafetyEvents({ pageSize: 100 });
      setData(res);
      navigate(`/app/ae-sae/${created.id}`);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "保存失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            AE / SAE 安全事件
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            所有不良事件(AE)与严重不良事件(SAE)的全生命周期记录，含 PI
            确认、监管上报与随访关闭。SAE 上报窗口 24h 内，逾期系统会高亮显示。
          </p>
        </div>
        <Button onClick={openCreate}>新建 AE</Button>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex flex-wrap gap-1">
            {[
              { value: "", label: "全部状态" },
              { value: "Draft", label: "草稿" },
              { value: "ConfirmedAE", label: "AE 已确认" },
              { value: "ConfirmedSAE", label: "SAE 已确认" },
              { value: "Reported", label: "已上报" },
              { value: "FollowUp", label: "随访中" },
              { value: "Closed", label: "已关闭" },
            ].map((s) => (
              <button
                key={s.value || "all-status"}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (s.value) next.set("status", s.value);
                  else next.delete("status");
                  setParams(next);
                }}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  status === s.value
                    ? "bg-[var(--primary)] text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-3 flex flex-wrap gap-1">
            {[
              { value: "", label: "全部严重度" },
              { value: "Low", label: "轻度" },
              { value: "Medium", label: "中度" },
              { value: "High", label: "重度" },
              { value: "Critical", label: "危及生命" },
            ].map((s) => (
              <button
                key={s.value || "all-severity"}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (s.value) next.set("severity", s.value);
                  else next.delete("severity");
                  setParams(next);
                }}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  severity === s.value
                    ? "bg-slate-700 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-xs text-slate-500">
            {data ? `共 ${data.total} 条` : "加载中"}
          </div>
        </div>
        {error ? (
          <EmptyState
            title="无法加载安全事件"
            desc={error}
            action={
              <Button size="sm" onClick={() => window.location.reload()}>
                重试
              </Button>
            }
          />
        ) : data === null ? (
          <LoadingState label="正在加载安全事件..." />
        ) : (
          <DataTable
            columns={columns}
            data={data.items}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/app/ae-sae/${r.id}`)}
            emptyLabel="该项目暂无安全事件"
          />
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        variant="confirm"
        title="记录新的 AE"
        confirmLabel="保存草稿"
        onConfirm={submitCreate}
        body={
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1">受试者</label>
              <select
                value={formSubjectId}
                onChange={(e) => setFormSubjectId(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
              >
                <option value="">请选择受试者</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subjectCode} · {s.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">发生时间</label>
                <input
                  type="datetime-local"
                  value={formOnsetAt}
                  onChange={(e) => setFormOnsetAt(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">严重程度</label>
                <select
                  value={formSeverity}
                  onChange={(e) =>
                    setFormSeverity(
                      e.target.value as
                        | "Low"
                        | "Medium"
                        | "High"
                        | "Critical",
                    )
                  }
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                >
                  <option value="Low">轻度</option>
                  <option value="Medium">中度</option>
                  <option value="High">重度</option>
                  <option value="Critical">危及生命</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="serious"
                type="checkbox"
                checked={formSerious}
                onChange={(e) => setFormSerious(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="serious" className="text-slate-700">
                标记为 SAE（需在 24h 内上报给监管/IRB）
              </label>
            </div>
            <div>
              <label className="block text-slate-600 mb-1">事件描述</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="例如：受试者出现 2 级中性粒细胞减少，伴发热 38.5℃。"
                className="w-full h-24 px-2.5 py-2 border border-slate-200 rounded text-xs resize-none"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              草稿状态可在 PI 审核（确认）后转为 AE/SAE，
              {submitting ? "正在保存..." : null}
            </p>
          </div>
        }
      />
    </div>
  );
}

void pushToast;
