/**
 * 风险监查工作台 (Risk Monitor workbench).
 *
 * Lists all risk signals sorted Critical-first, lets the user filter by
 * status/level/type, and opens a side drawer with the full handling
 * history + audit trail + AI output payload.
 *
 * Lifecycle actions (assign / start / resolve / close / reject) are delegated
 * to api/risks; the server enforces the state machine + RBAC. The UI only
 * surfaces the next legal action set per status.
 *
 * Demo path: Open → Assign → Start → Resolve → Close.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "../components/ui/Drawer.js";
import { Card } from "../components/ui/Card.js";
import { Tag } from "../components/ui/Tag.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import { Input } from "../components/ui/Input.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { SectionHeader } from "../components/ui/SectionHeader.js";
import { pushToast } from "../components/ui/Toast.js";
import { AuditTrail } from "../components/ui/AuditTrail.js";
import {
  assignRisk,
  closeRisk,
  getRisk,
  listRisks,
  rejectRisk,
  resolveRisk,
  startRisk,
  type RiskDetailResponse,
  type RiskLevelValue,
  type RiskListRow,
  type RiskListResponse,
  type RiskStatusValue,
} from "../lib/api/risks.js";
import { ApiError } from "../lib/api/client.js";

const STATUS_LABEL: Record<RiskStatusValue, string> = {
  Open: "待分派",
  Assigned: "已分派",
  InProgress: "处理中",
  PendingInvestigator: "等待研究者",
  Resolved: "已解决",
  Closed: "已关闭",
  Rejected: "已驳回",
};

const STATUS_TONE: Record<
  RiskStatusValue,
  "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "violet"
> = {
  Open: "danger",
  Assigned: "warning",
  InProgress: "primary",
  PendingInvestigator: "info",
  Resolved: "info",
  Closed: "success",
  Rejected: "neutral",
};

const LEVEL_LABEL: Record<RiskLevelValue, string> = {
  Low: "低风险",
  Medium: "中风险",
  High: "高风险",
  Critical: "严重",
};

const LEVEL_TONE: Record<
  RiskLevelValue,
  "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "violet"
> = {
  Low: "neutral",
  Medium: "info",
  High: "warning",
  Critical: "danger",
};

const TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "AE未处理", label: "AE 未处理" },
  { value: "访视超窗", label: "访视超窗" },
  { value: "ePRO缺失", label: "ePRO 缺失" },
  { value: "数据质量", label: "数据质量" },
  { value: "入组缓慢", label: "入组缓慢" },
];

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

function formatRemaining(ms: number): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400e3);
  const hours = Math.floor((abs % 86400e3) / 3600e3);
  const minutes = Math.floor((abs % 3600e3) / 60e3);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}

/** Approaching/past deadline tone → used both in the row badge and in the
 *  drawer header. Mirrors the SafetyEventsPage reportDeadline logic. */
function deadlineTone(deadline: string | null): {
  tone: "ok" | "warn" | "alert" | "expired" | null;
  remainingMs: number;
} {
  if (!deadline) return { tone: null, remainingMs: 0 };
  const now = Date.now();
  const due = new Date(deadline).getTime();
  const remainingMs = due - now;
  if (remainingMs < 0) return { tone: "expired", remainingMs };
  if (remainingMs < 24 * 3600e3) return { tone: "alert", remainingMs };
  if (remainingMs < 3 * 24 * 3600e3) return { tone: "warn", remainingMs };
  return { tone: "ok", remainingMs };
}

export function RiskMonitorPage() {
  const [rows, setRows] = useState<RiskListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<RiskStatusValue | "">("");
  const [levelFilter, setLevelFilter] = useState<RiskLevelValue | "">("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RiskDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Why-must-this-be-served modal: enforces reason on close/reject for
  // high/critical levels and (defense-in-depth) on every close/reject call.
  // Start has no modal (no body); it posts immediately via performStart.
  const [reasonModal, setReasonModal] = useState<{
    mode: "resolve" | "close" | "reject" | "assign";
    reasonRequired: boolean;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp: RiskListResponse = await listRisks({
        status: statusFilter || undefined,
        level: levelFilter || undefined,
        type: typeFilter || undefined,
        pageSize: 50,
      });
      setRows(resp.items);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "风险列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, levelFilter, typeFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await getRisk(id);
      setDetail(d);
    } catch (e) {
      setDetail(null);
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "无法加载风险详情",
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

  async function performStart() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await startRisk(selectedId);
      pushToast({ tone: "success", title: "已开始处理" });
      await openDetail(selectedId);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "开始处理失败",
          description: e.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function performAction() {
    if (!reasonModal || !selectedId) return;
    setSubmitting(true);
    try {
      switch (reasonModal.mode) {
        case "assign":
          if (!assignOwnerId.trim()) {
            pushToast({
              tone: "error",
              title: "请输入被分派者 ID",
            });
            setSubmitting(false);
            return;
          }
          await assignRisk(selectedId, assignOwnerId.trim());
          break;
        case "resolve":
          await resolveRisk(selectedId, reasonText.trim() || undefined);
          break;
        case "close":
          await closeRisk(selectedId, reasonText.trim());
          break;
        case "reject":
          await rejectRisk(selectedId, reasonText.trim());
          break;
      }
      pushToast({ tone: "success", title: "风险状态已更新" });
      setReasonModal(null);
      setReasonText("");
      setAssignOwnerId("");
      await openDetail(selectedId);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "状态流转失败",
          description: e.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const openModal = (
    mode: "assign" | "resolve" | "close" | "reject",
    reasonRequired: boolean,
  ) => {
    setReasonText("");
    setAssignOwnerId(detail?.risk.ownerUserId ?? "");
    setReasonModal({ mode, reasonRequired });
  };

  const summary = useMemo(() => {
    const byStatus: Partial<Record<RiskStatusValue, number>> = {};
    let byCritical = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.level === "Critical") byCritical += 1;
    }
    return { byStatus, byCritical };
  }, [rows]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI 风险监查工作台"
        sub={`项目级风险信号统一监控。当前 ${total} 条，Critical ${summary.byCritical} 条。`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">工作栏</h3>
          <div className="space-y-2">
            {(
              Object.entries(summary.byStatus) as Array<[RiskStatusValue, number]>
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
                  setStatusFilter(e.target.value as RiskStatusValue | "")
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                <option value="">全部状态</option>
                {(Object.keys(STATUS_LABEL) as RiskStatusValue[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">等级</label>
              <select
                value={levelFilter}
                onChange={(e) =>
                  setLevelFilter(e.target.value as RiskLevelValue | "")
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                <option value="">全部等级</option>
                {(Object.keys(LEVEL_LABEL) as RiskLevelValue[]).map((k) => (
                  <option key={k} value={k}>
                    {`${LEVEL_LABEL[k]} (${k})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">类型</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
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
              高/严重等级（High / Critical）的 Close 与 Reject
              操作必须填写原因——审计链会在 audit 表里留下原因条目。
            </p>
            <p>
              Assign 操作将状态推进到「已分派」并写入新的 owner；建议
              site 研究者或监查员作为 owner。Owner 再点「开始处理」进入
              InProgress，之后才可「解决」。关闭（Close）仅 CROPM。
            </p>
          </div>
        </Card>
      </div>

      {loading ? (
        <LoadingState label="正在加载风险列表..." />
      ) : error ? (
        <EmptyState title="加载失败" desc={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无风险信号"
          desc="当前过滤器下没有命中；AI 调度器会持续扫描数据并产生新的风险条目。"
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              风险列表（{total} 条）
            </h3>
            <Badge tone="primary">按 Critical → deadline 排序</Badge>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">等级</th>
                  <th className="py-2 pr-3">类型</th>
                  <th className="py-2 pr-3">触发说明</th>
                  <th className="py-2 pr-3">受试者</th>
                  <th className="py-2 pr-3">状态</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">截止</th>
                  <th className="py-2 pr-3">处理次数</th>
                  <th className="py-2 pr-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const dl = deadlineTone(r.deadline);
                  return (
                    <tr
                      key={r.id}
                      className="border-b last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="py-2 pr-3">
                        <Tag tone={LEVEL_TONE[r.level]}>{LEVEL_LABEL[r.level]}</Tag>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{r.type}</td>
                      <td
                        className="py-2 pr-3 text-slate-700 max-w-[260px] truncate"
                        title={r.trigger}
                      >
                        {r.trigger}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {r.subjectCode ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Tag tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Tag>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{r.owner ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs">
                        {dl.tone ? (
                          <span
                            style={{
                              color:
                                dl.tone === "expired" || dl.tone === "alert"
                                  ? "var(--risk-critical-text)"
                                  : dl.tone === "warn"
                                    ? "var(--risk-high-text)"
                                    : "var(--risk-medium-text)",
                            }}
                          >
                            {dl.tone === "expired"
                              ? `已超期 ${formatRemaining(dl.remainingMs)}`
                              : `${formatDate(r.deadline)}\n剩 ${formatRemaining(dl.remainingMs)}`}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{r.handlingCount}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Drawer — risk detail + lifecycle actions */}
      <Drawer
        open={selectedId !== null}
        onClose={closeDetail}
        title={
          detail
            ? `${detail.risk.type} · ${detail.risk.subjectCode ?? "—"}`
            : "风险详情"
        }
        width={720}
      >
        {selectedId === null ? null : detailLoading ? (
          <LoadingState label="正在加载风险详情..." />
        ) : detail === null ? (
          <EmptyState title="无法加载详情" desc="请稍后重试" />
        ) : (
          <div className="space-y-5">
            <header className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag tone={LEVEL_TONE[detail.risk.level]}>
                  {LEVEL_LABEL[detail.risk.level]}
                </Tag>
                <Tag tone={STATUS_TONE[detail.risk.status]}>
                  {STATUS_LABEL[detail.risk.status]}
                </Tag>
                {detail.risk.owner ? (
                  <Tag tone="neutral">Owner · {detail.risk.owner}</Tag>
                ) : (
                  <Tag tone="neutral">未分派</Tag>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {detail.risk.trigger}
              </p>
              {detail.risk.suggestion ? (
                <p className="text-xs text-slate-500 leading-relaxed border-l-2 border-blue-200 pl-3">
                  AI 建议 · {detail.risk.suggestion}
                </p>
              ) : null}
              <DeadlineRibbon deadline={detail.risk.deadline} />
            </header>

            {/* AI output panel: rendered as a compact JSON window so the
              monitor can inspect model confidence + payload. */}
            {detail.aiOutput ? (
              <section>
                <SectionHeader
                title="AI 输出"
                sub={`${detail.aiOutput.kind} · ${detail.aiOutput.model ?? "Unknown"} · v${detail.aiOutput.modelVersion ?? "—"}`}
              />
                <Card>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Field label="置信度" value={`${(detail.aiOutput.confidence * 100).toFixed(1)}% · ${detail.aiOutput.confidenceLevel ?? ""}`} />
                    <Field label="状态" value={detail.aiOutput.status} />
                    <Field label="生成时间" value={formatDate(detail.aiOutput.generatedAt)} />
                    <Field label="确认人" value={detail.aiOutput.confirmedByUserId ?? "未确认"} />
                  </div>
                  {detail.aiOutput.notes ? (
                    <div className="mt-3 text-xs text-slate-500">{detail.aiOutput.notes}</div>
                  ) : null}
                  <pre className="mt-3 text-[11px] bg-slate-50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(detail.aiOutput.payload, null, 2)}
                  </pre>
                </Card>
              </section>
            ) : null}

            {/* Lifecycle actions: gate on status.
                Open → 分派/驳回; Assigned → 开始处理/分派/驳回;
                InProgress|PendingInvestigator → 解决; Resolved → 关闭. */}
            <section>
              <SectionHeader title="生命周期操作" />
              <div className="flex flex-wrap gap-2">
                {(detail.risk.status === "Open" ||
                  detail.risk.status === "Assigned") && (
                  <Button
                    size="sm"
                    onClick={() => openModal("assign", false)}
                    disabled={submitting}
                  >
                    分派
                  </Button>
                )}
                {detail.risk.status === "Assigned" && (
                  <Button
                    size="sm"
                    onClick={() => void performStart()}
                    disabled={submitting}
                  >
                    开始处理
                  </Button>
                )}
                {(detail.risk.status === "InProgress" ||
                  detail.risk.status === "PendingInvestigator") && (
                  <Button
                    size="sm"
                    onClick={() => openModal("resolve", false)}
                    disabled={submitting}
                  >
                    解决
                  </Button>
                )}
                {detail.risk.status === "Resolved" && (
                  <Button
                    size="sm"
                    onClick={() => openModal("close", true)}
                    disabled={submitting}
                  >
                    关闭
                  </Button>
                )}
                {(detail.risk.status === "Open" ||
                  detail.risk.status === "Assigned") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openModal("reject", true)}
                    disabled={submitting}
                  >
                    驳回
                  </Button>
                )}
              </div>
            </section>

            <section>
              <SectionHeader title="处理履历" sub="RiskHandlingRecord：业务侧操作历史" />
              {detail.handling.length === 0 ? (
                <div className="text-xs text-slate-400">暂无处理记录</div>
              ) : (
                <ol className="space-y-2">
                  {detail.handling.map((h) => (
                    <li
                      key={h.id}
                      className="text-xs text-slate-700 border-l-2 border-blue-200 pl-3 py-1"
                    >
                      <div className="font-medium text-slate-800">
                        {h.action === "assign"
                          ? "分派"
                          : h.action === "start"
                            ? "开始处理"
                            : h.action === "resolve"
                              ? "解决"
                              : h.action === "close"
                                ? "关闭"
                                : "驳回"}
                        {" · "}
                        {h.actorName}（{h.actorRole}）
                      </div>
                      <div className="text-slate-500">
                        {STATUS_LABEL[h.fromStatus]} → {STATUS_LABEL[h.toStatus]} · {formatDate(h.at)}
                      </div>
                      {h.reason ? (
                        <div className="text-slate-600 mt-0.5">原因 · {h.reason}</div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <SectionHeader
                title="审计链"
                sub="AuditEvent：仅追加、不可篡改，用于合规与稽查追溯"
              />
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

      {/* Action modal: holds owner (assign) or reason (resolve / close / reject). */}
      <Modal
        open={reasonModal !== null}
        onClose={() => {
          setReasonModal(null);
          setReasonText("");
        }}
        variant="confirm"
        title={
          reasonModal?.mode === "assign"
            ? "分派风险"
            : reasonModal?.mode === "resolve"
              ? "解决风险"
              : reasonModal?.mode === "close"
                ? "关闭风险"
                : reasonModal?.mode === "reject"
                  ? "驳回风险"
                  : "操作确认"
        }
        body={
          reasonModal ? (
            <div className="space-y-3">
              {reasonModal.mode === "assign" ? (
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    被分派者用户 ID
                    <span className="text-red-600 ml-0.5">*</span>
                  </label>
                  <Input
                    placeholder="例：usr_pi_001"
                    value={assignOwnerId}
                    onChange={(e) => setAssignOwnerId(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    原因
                    {reasonModal.reasonRequired ? (
                      <span className="text-red-600 ml-0.5">*</span>
                    ) : null}
                  </label>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    rows={4}
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder={
                      reasonModal.reasonRequired
                        ? "高 / 严重等级必须留下原因..."
                        : "可选：说明处理方式 / 与受试者的沟通要点..."
                    }
                  />
                </div>
              )}
            </div>
          ) : null
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReasonModal(null);
                setReasonText("");
              }}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performAction()}
              disabled={
                submitting ||
                !!(reasonModal && reasonModal.reasonRequired && !reasonText.trim()) ||
                !!(reasonModal?.mode === "assign" && !assignOwnerId.trim())
              }
            >
              {submitting ? "提交中..." : "确认"}
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

function DeadlineRibbon({ deadline }: { deadline: string | null }) {
  const dl = deadlineTone(deadline);
  if (!dl.tone) return null;
  return (
    <div className="text-xs">
      <span className="text-slate-500">截止 · </span>
      <span
        style={{
          color:
            dl.tone === "expired" || dl.tone === "alert"
              ? "var(--risk-critical-text)"
              : dl.tone === "warn"
                ? "var(--risk-high-text)"
                : "var(--risk-medium-text)",
        }}
      >
        {dl.tone === "expired"
          ? `已超期 ${formatRemaining(dl.remainingMs)}`
          : `${formatDate(deadline)} · 剩 ${formatRemaining(dl.remainingMs)}`}
      </span>
    </div>
  );
}
