/**
 * 报告中心 (Report Center).
 *
 * Lists AI-drafted reports, lets the user filter by status / type, opens
 * a side drawer with the full source snapshot, AI payload, and audit
 * trail. Generate / Confirm / Export are surfaced per status; the server
 * enforces the state machine + RBAC. The UI only shows the next legal
 * action set per row.
 *
 * Demo path: generate → (worker flips to Draft) → confirm → export.
 *
 * Status badges always show the AI 草稿 label on a Draft row so the
 * user is never confused about the source. Confirmation is a one-click
 * action: the API walks Draft → UnderReview → Confirmed atomically.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { Tag } from "../components/ui/Tag.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { SectionHeader } from "../components/ui/SectionHeader.js";
import { Drawer } from "../components/ui/Drawer.js";
import { pushToast } from "../components/ui/Toast.js";
import { AuditTrail } from "../components/ui/AuditTrail.js";
import {
  confirmReport,
  exportReport,
  generateReport,
  getReport,
  listReports,
  type ReportDetailResponse,
  type ReportFormatValue,
  type ReportListRow,
  type ReportListResponse,
  type ReportStatusValue,
  type ReportTypeValue,
} from "../lib/api/reports.js";
import { ApiError } from "../lib/api/client.js";

const STATUS_LABEL: Record<ReportStatusValue, string> = {
  Generating: "生成中",
  Draft: "AI 草稿",
  UnderReview: "待审阅",
  Confirmed: "已确认",
  Exported: "已导出",
  Failed: "生成失败",
};

const STATUS_TONE: Record<
  ReportStatusValue,
  "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "violet"
> = {
  Generating: "info",
  Draft: "violet",
  UnderReview: "primary",
  Confirmed: "success",
  Exported: "neutral",
  Failed: "danger",
};

const TYPE_LABEL: Record<ReportTypeValue, string> = {
  Interim: "项目报告（中期）",
  Final: "项目报告（终期）",
  Safety: "安全专题",
  Custom: "自定义",
};

const TYPE_OPTIONS: ReadonlyArray<{ value: ReportTypeValue; label: string }> = [
  { value: "Interim", label: TYPE_LABEL.Interim },
  { value: "Final", label: TYPE_LABEL.Final },
  { value: "Safety", label: TYPE_LABEL.Safety },
  { value: "Custom", label: TYPE_LABEL.Custom },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: ReportStatusValue; label: string }> = (
  Object.keys(STATUS_LABEL) as ReportStatusValue[]
).map((k) => ({ value: k, label: STATUS_LABEL[k] }));

const FORMAT_OPTIONS: ReadonlyArray<{ value: ReportFormatValue; label: string }> = [
  { value: "PDF", label: "PDF" },
  { value: "CSV", label: "CSV" },
  { value: "XLSX", label: "Excel (XLSX)" },
  { value: "JSON", label: "JSON" },
];

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

export function ReportsPage() {
  const [rows, setRows] = useState<ReportListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReportStatusValue | "">("");
  const [typeFilter, setTypeFilter] = useState<ReportTypeValue | "">("");
  const [generatingType, setGeneratingType] = useState<ReportTypeValue>("Interim");

  // Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Generate modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  // Export modal — requires reason (audit chain needs non-empty text)
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const [exportFormat, setExportFormat] = useState<ReportFormatValue>("PDF");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp: ReportListResponse = await listReports({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        pageSize: 50,
      });
      setRows(resp.items);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "报告列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await getReport(id);
      setDetail(d);
    } catch (e) {
      setDetail(null);
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "无法加载报告详情",
          description: e.message,
        });
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  async function performGenerate() {
    setSubmitting(true);
    try {
      const created = await generateReport({ type: generatingType });
      pushToast({
        tone: "success",
        title: "已提交生成任务",
        description: `${TYPE_LABEL[generatingType]} · ${created.id}，稍候自动生成 AI 草稿。`,
      });
      setGenerateModalOpen(false);
      await openDetail(created.id);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "生成失败",
          description: e.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function performConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await confirmReport(selectedId);
      pushToast({ tone: "success", title: "报告已确认" });
      await openDetail(selectedId);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "确认失败",
          description: e.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function performExport() {
    if (!selectedId) return;
    if (!exportReason.trim()) {
      pushToast({ tone: "error", title: "请填写导出原因" });
      return;
    }
    setSubmitting(true);
    try {
      await exportReport(selectedId, exportReason.trim(), exportFormat);
      pushToast({
        tone: "success",
        title: "报告已导出",
        description: `格式：${exportFormat}，审计链已记录。`,
      });
      setExportModalOpen(false);
      setExportReason("");
      setExportFormat("PDF");
      await openDetail(selectedId);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "导出失败",
          description: e.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(() => {
    const byStatus: Partial<Record<ReportStatusValue, number>> = {};
    let aiDraft = 0;
    let confirmed = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status === "Draft" || r.status === "UnderReview") aiDraft += 1;
      if (r.status === "Confirmed" || r.status === "Exported") confirmed += 1;
    }
    return { byStatus, aiDraft, confirmed };
  }, [rows]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="报告中心"
        sub="项目级 AI 报告统一管理：草稿生成、确认、导出全流程留痕。"
        actions={
          <Button
            size="sm"
            onClick={() => setGenerateModalOpen(true)}
            disabled={submitting}
          >
            立即生成报告
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">状态分布</h3>
          <div className="space-y-2">
            {(
              Object.entries(summary.byStatus) as Array<[ReportStatusValue, number]>
            )
              .sort((a, b) => b[1] - a[1])
              .map(([status, n]) => (
                <div
                  key={status}
                  className="flex items-center justify-between text-sm"
                >
                  <Tag tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Tag>
                  <span className="text-slate-700">{n}</span>
                </div>
              ))}
            {rows.length === 0 ? (
              <div className="text-xs text-slate-400">暂无数据</div>
            ) : null}
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
              AI 待审 {summary.aiDraft} 条 · 已确认 / 已导出 {summary.confirmed} 条
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">过滤器</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">状态</label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ReportStatusValue | "")
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                <option value="">全部状态</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">类型</label>
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as ReportTypeValue | "")
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                <option value="">全部类型</option>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">说明</h3>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              AI 草稿必须经研究者或运营经理确认（人工点击「确认」）后才能
              正式归档；导出动作会写入 ExportRecord 审计表，导出原因必填。
            </p>
            <p>
              所有状态变更会写入 AuditEvent，与 AI 输出的 prompt /
              置信度共同形成 21 CFR Part 11 合规链。
            </p>
          </div>
        </Card>
      </div>

      {loading ? (
        <LoadingState label="正在加载报告列表..." />
      ) : error ? (
        <EmptyState title="加载失败" desc={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无报告"
          desc="点击右上角「立即生成报告」开始一次 AI 草稿生成。"
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              报告列表（{total} 条）
            </h3>
            <Badge tone="ai">AI 草稿均标注「需人工复核」</Badge>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">类型</th>
                  <th className="py-2 pr-3">状态</th>
                  <th className="py-2 pr-3">生成时间</th>
                  <th className="py-2 pr-3">确认时间</th>
                  <th className="py-2 pr-3">导出时间</th>
                  <th className="py-2 pr-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3 text-slate-700">
                      {TYPE_LABEL[r.type as ReportTypeValue] ?? r.type}
                    </td>
                    <td className="py-2 pr-3">
                      <Tag tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Tag>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {formatDate(r.generatedAt)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {formatDate(r.confirmedAt)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {formatDate(r.exportedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void openDetail(r.id)}
                      >
                        详情
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Drawer — report detail + lifecycle actions */}
      <Drawer
        open={selectedId !== null}
        onClose={closeDetail}
        title={
          detail
            ? `${TYPE_LABEL[detail.report.type as ReportTypeValue] ?? detail.report.type} · ${detail.report.id.slice(0, 8)}`
            : "报告详情"
        }
        width={720}
      >
        {selectedId === null ? null : detailLoading ? (
          <LoadingState label="正在加载报告详情..." />
        ) : detail === null ? (
          <EmptyState title="无法加载详情" desc="请稍后重试" />
        ) : (
          <div className="space-y-5">
            <header className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag tone={STATUS_TONE[detail.report.status]}>
                  {STATUS_LABEL[detail.report.status]}
                </Tag>
                {detail.report.status === "Draft" ||
                detail.report.status === "UnderReview" ? (
                  <Badge tone="ai">AI 草稿 · 需人工复核</Badge>
                ) : null}
                {detail.report.status === "Confirmed" ? (
                  <Badge tone="success">已确认，可导出</Badge>
                ) : null}
                {detail.report.status === "Exported" ? (
                  <Badge tone="neutral">已归档</Badge>
                ) : null}
              </div>
              <div className="text-xs text-slate-500">
                生成 {formatDate(detail.report.generatedAt)} · 确认 {formatDate(detail.report.confirmedAt)} · 导出 {formatDate(detail.report.exportedAt)}
              </div>
            </header>

            {/* AI snapshot: rendered as a compact card so the user can
                inspect the model confidence + payload before confirming. */}
            {detail.aiOutput ? (
              <section>
                <SectionHeader
                  title="AI 草稿"
                  sub={`${detail.aiOutput.kind} · ${detail.aiOutput.model ?? "Unknown"} · v${detail.aiOutput.modelVersion ?? "—"}`}
                />
                <Card>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Field
                      label="置信度"
                      value={`${(detail.aiOutput.confidence * 100).toFixed(1)}% · ${detail.aiOutput.confidenceLevel ?? ""}`}
                    />
                    <Field label="状态" value={detail.aiOutput.status} />
                    <Field
                      label="生成时间"
                      value={formatDate(detail.aiOutput.generatedAt)}
                    />
                    <Field
                      label="确认人"
                      value={detail.aiOutput.confirmedByUserId ?? "未确认"}
                    />
                  </div>
                  {detail.aiOutput.notes ? (
                    <div className="mt-3 text-xs text-slate-500">
                      {detail.aiOutput.notes}
                    </div>
                  ) : null}
                  <div className="mt-3 text-xs text-slate-700 leading-relaxed">
                    {renderSummary(detail.aiOutput.payload)}
                  </div>
                  <pre className="mt-3 text-[11px] bg-slate-50 p-2 rounded overflow-auto max-h-48">
                    {JSON.stringify(detail.aiOutput.payload, null, 2)}
                  </pre>
                </Card>
              </section>
            ) : (
              <section>
                <SectionHeader title="AI 草稿" sub="尚无 AI 输出" />
                <Card>
                  <div className="text-xs text-slate-500">
                    报告未生成 AI 输出（可能仍在生成中或生成失败）。
                  </div>
                </Card>
              </section>
            )}

            {detail.exportRecord ? (
              <section>
                <SectionHeader title="导出记录" sub="ExportRecord" />
                <Card>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Field label="格式" value={detail.exportRecord.format} />
                    <Field
                      label="导出时间"
                      value={formatDate(detail.exportRecord.exportedAt)}
                    />
                    <Field
                      label="导出人"
                      value={detail.exportRecord.exportedByUserId}
                    />
                    <Field label="原因" value={detail.exportRecord.reason} />
                  </div>
                </Card>
              </section>
            ) : null}

            {/* Lifecycle actions: gate on status.
                Draft|UnderReview → 确认; Confirmed → 导出; otherwise read-only. */}
            <section>
              <SectionHeader title="生命周期操作" />
              <div className="flex flex-wrap gap-2">
                {(detail.report.status === "Draft" ||
                  detail.report.status === "UnderReview") && (
                  <Button
                    size="sm"
                    onClick={() => void performConfirm()}
                    disabled={submitting}
                  >
                    人工确认
                  </Button>
                )}
                {detail.report.status === "Confirmed" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setExportReason("");
                      setExportFormat("PDF");
                      setExportModalOpen(true);
                    }}
                    disabled={submitting}
                  >
                    导出
                  </Button>
                )}
                {detail.report.status === "Exported" ? (
                  <div className="text-xs text-slate-500 py-1.5">
                    该报告已归档，不可再次导出。
                  </div>
                ) : null}
                {detail.report.status === "Generating" ? (
                  <div className="text-xs text-slate-500 py-1.5">
                    正在生成 AI 草稿，请稍候...
                  </div>
                ) : null}
                {detail.report.status === "Failed" ? (
                  <div className="text-xs text-slate-500 py-1.5">
                    草稿生成失败，请删除或重新提交。
                  </div>
                ) : null}
              </div>
            </section>

            <section>
              <SectionHeader title="审计链" sub="AuditEvent：仅追加、不可篡改" />
              <AuditTrail
                items={detail.auditTrail.map((a) => ({
                  time: a.timestamp,
                  user: `${a.actorRole} · ${a.actorUserId}`,
                  action: a.action,
                  result: "成功",
                }))}
              />
            </section>
          </div>
        )}
      </Drawer>

      {/* Generate modal: pick type; the worker will draft a snapshot. */}
      <Modal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        variant="ai-confirm"
        title="生成 AI 报告草稿"
        body={
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                报告类型
              </label>
              <select
                value={generatingType}
                onChange={(e) => setGeneratingType(e.target.value as ReportTypeValue)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              AI 会基于项目当前受试者 / 安全 / 风险快照生成草稿，输出始终标注「AI 草稿」，需人工确认后方可正式归档。
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGenerateModalOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performGenerate()}
              disabled={submitting}
            >
              {submitting ? "提交中..." : "立即生成"}
            </Button>
          </>
        }
      />

      {/* Export modal: must provide a reason (audit chain requirement). */}
      <Modal
        open={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportReason("");
        }}
        variant="export-confirm"
        title="导出报告"
        body={
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                格式
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ReportFormatValue)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                导出原因
                <span className="text-red-600 ml-0.5">*</span>
              </label>
              <textarea
                value={exportReason}
                onChange={(e) => setExportReason(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="例：提交伦理委员会审查 / 提交给申办方"
              />
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExportModalOpen(false);
                setExportReason("");
              }}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performExport()}
              disabled={submitting || !exportReason.trim()}
            >
              {submitting ? "提交中..." : "确认导出"}
            </Button>
          </>
        }
      />
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-800">{value ?? "—"}</div>
    </div>
  );
}

/**
 * Extract the human-readable AI summary line from the snapshot payload.
 * Returns null if the payload is missing or in an unexpected shape so
 * the UI degrades to the JSON view without breaking.
 */
function renderSummary(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const aiSummary = (payload as { aiSummary?: unknown }).aiSummary;
  if (typeof aiSummary === "string" && aiSummary.length > 0) {
    return aiSummary;
  }
  return null;
}
