/**
 * 文档与稽查 / 审计日志.
 *
 * Lists the project's audit events (append-only log) and surfaces
 * filter + export controls. The export action requires a reason and
 * creates both an ExportRecord (objectType=AuditExport) and a
 * critical AuditEvent with reason. 21 CFR Part 11: the chain is
 * reconstructible from the API alone.
 */
import { useCallback, useEffect, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { Tag } from "../components/ui/Tag.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { SectionHeader } from "../components/ui/SectionHeader.js";
import { Badge } from "../components/ui/Badge.js";
import { pushToast } from "../components/ui/Toast.js";
import {
  createAuditExport,
  listAuditEvents,
  listAuditExports,
  type AuditEvent,
  type AuditEventListResponse,
  type AuditExportRecord,
  type AuditFormat,
  type ListAuditEventsParams,
} from "../lib/api/audit.js";
import { ApiError } from "../lib/api/client.js";

const OBJECT_TYPES: ReadonlyArray<string> = [
  "Subject",
  "Consent",
  "Visit",
  "SafetyEvent",
  "RiskSignal",
  "ReportDraft",
  "Document",
  "AIConfig",
  "AIOutput",
  "AuditExport",
];

const FORMAT_OPTIONS: ReadonlyArray<{ value: AuditFormat; label: string }> = [
  { value: "PDF", label: "PDF" },
  { value: "CSV", label: "CSV" },
  { value: "XLSX", label: "Excel (XLSX)" },
  { value: "JSON", label: "JSON" },
];

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

export function DocumentsAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [objectTypeFilter, setObjectTypeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const [exports, setExports] = useState<AuditExportRecord[]>([]);
  const [exportsLoading, setExportsLoading] = useState(true);

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const [exportFormat, setExportFormat] = useState<AuditFormat>("PDF");
  const [exportObjectType, setExportObjectType] = useState("");
  const [exportActor, setExportActor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: ListAuditEventsParams = { pageSize: 100 };
    if (objectTypeFilter) params.objectType = objectTypeFilter;
    if (actionFilter) params.action = actionFilter;
    try {
      const resp: AuditEventListResponse = await listAuditEvents(params);
      setEvents(resp.items);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "审计事件加载失败");
    } finally {
      setLoading(false);
    }
  }, [objectTypeFilter, actionFilter]);

  const refreshExports = useCallback(async () => {
    setExportsLoading(true);
    try {
      const resp = await listAuditExports();
      setExports(resp.items);
    } catch {
      // AuditRead may not be granted (e.g. Subject). Surface as 403 toast.
      setExports([]);
    } finally {
      setExportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshExports();
  }, [refresh, refreshExports]);

  async function performExport() {
    if (!exportReason.trim()) {
      pushToast({ tone: "error", title: "请填写导出原因" });
      return;
    }
    setSubmitting(true);
    try {
      const filters: ListAuditEventsParams = {};
      if (exportObjectType) filters.objectType = exportObjectType;
      if (exportActor) filters.actorUserId = exportActor;
      await createAuditExport({
        reason: exportReason.trim(),
        format: exportFormat,
        filters,
      });
      pushToast({
        tone: "success",
        title: "审计导出已创建",
        description: `格式：${exportFormat}，审计链已记录。`,
      });
      setExportOpen(false);
      setExportReason("");
      setExportFormat("PDF");
      setExportObjectType("");
      setExportActor("");
      await refreshExports();
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "导出失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="审计日志"
        sub="审计事件（AuditEvent）仅追加、不可篡改；导出动作需填写原因并写入 ExportRecord。"
        actions={
          <Button
            size="sm"
            onClick={() => setExportOpen(true)}
            disabled={submitting}
          >
            导出审计
          </Button>
        }
      />

      <Card>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">过滤器</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              对象类型
            </label>
            <select
              value={objectTypeFilter}
              onChange={(e) => setObjectTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
            >
              <option value="">全部对象</option>
              {OBJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              动作
            </label>
            <input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="例：confirm / export / status-change"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            事件流（{total} 条）
          </h3>
          <Badge tone="ai">21 CFR Part 11 — 不可篡改</Badge>
        </div>
        {loading ? (
          <LoadingState label="正在加载审计事件..." />
        ) : error ? (
          <EmptyState title="加载失败" desc={error} />
        ) : events.length === 0 ? (
          <EmptyState title="暂无审计事件" desc="请调整过滤器或上传新文档后再查" />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">时间</th>
                  <th className="py-2 pr-3">操作人</th>
                  <th className="py-2 pr-3">对象</th>
                  <th className="py-2 pr-3">动作</th>
                  <th className="py-2 pr-3">原因</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: AuditEvent) => (
                  <tr
                    key={e.id}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(e.timestamp)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">
                        {e.actorRole}
                      </div>
                      <div className="text-slate-500">{e.actorUserId}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <Tag tone="neutral">{e.objectType}</Tag>
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        {e.objectId.slice(0, 12)}…
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <Tag tone="primary">{e.action}</Tag>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600 max-w-xs">
                      {e.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          历史导出（{exports.length} 条）
        </h3>
        {exportsLoading ? (
          <LoadingState label="正在加载导出记录..." />
        ) : exports.length === 0 ? (
          <div className="text-xs text-slate-500">尚未创建过审计导出</div>
        ) : (
          <div className="space-y-2">
            {exports.map((e: AuditExportRecord) => (
              <div
                key={e.id}
                className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs py-2 border-b last:border-b-0"
              >
                <Field label="格式" value={e.format} />
                <Field label="原因" value={e.reason} />
                <Field label="导出人" value={e.exportedByUserId} />
                <Field label="导出时间" value={formatDate(e.exportedAt)} />
                <Field label="ID" value={e.id.slice(0, 8)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        variant="export-confirm"
        title="导出审计日志"
        body={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  格式
                </label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as AuditFormat)}
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
                  对象类型过滤
                </label>
                <select
                  value={exportObjectType}
                  onChange={(e) => setExportObjectType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                >
                  <option value="">全部</option>
                  {OBJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                操作人过滤（可选 userId）
              </label>
              <input
                value={exportActor}
                onChange={(e) => setExportActor(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              />
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
                placeholder="例：提交给 FDA 现场核查"
              />
            </div>
            <div className="text-xs text-slate-500">
              导出动作会同时写入 ExportRecord（对象类型=AuditExport）和 AuditEvent（动作=export，原因=上一步填写的内容）。
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(false)}
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
      <div className="text-slate-800 break-all">{value ?? "—"}</div>
    </div>
  );
}
