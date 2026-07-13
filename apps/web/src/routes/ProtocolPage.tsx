/**
 * AI 方案解析工作台 (Protocol workbench).
 *
 * Lists all ProtocolVersion rows for the current project, lets the user
 * open a side drawer with the full parse-result + AI output + audit
 * chain, and exposes the lifecycle actions (upload / parse / activate).
 *
 * Lifecycle actions are delegated to api/protocols; the server enforces
 * the state machine + RBAC. The UI only surfaces the next legal action
 * set per parseStatus. The "全部确认并生效" affordance uses the
 * protocol-activate Modal variant so the user-facing copy matches the
 * design system's high-risk confirmation template.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "../components/ui/Drawer.js";
import { Card } from "../components/ui/Card.js";
import { Tag } from "../components/ui/Tag.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import { Input } from "../components/ui/Input.js";
import { Badge, type BadgeTone } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { SectionHeader } from "../components/ui/SectionHeader.js";
import { AuditTrail } from "../components/ui/AuditTrail.js";
import { pushToast } from "../components/ui/Toast.js";
import {
  activateProtocolVersion,
  getProtocolVersion,
  listProtocolVersions,
  triggerProtocolParse,
  uploadProtocolVersion,
  type ProtocolParseStatusValue,
  type ProtocolVersionDetailResponse,
  type ProtocolVersionListResponse,
  type ProtocolVersionRow,
} from "../lib/api/protocols.js";
import { loadSession } from "../lib/session.js";
import { ApiError } from "../lib/api/client.js";

const STATUS_LABEL: Record<ProtocolParseStatusValue, string> = {
  Uploaded: "已上传",
  Parsing: "AI 解析中",
  Parsed: "已解析",
  ParseFailed: "解析失败",
  UnderReview: "人工复核中",
  Effective: "已生效",
  Superseded: "已退役",
};

const STATUS_TONE: Record<
  ProtocolParseStatusValue,
  "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "violet"
> = {
  Uploaded: "neutral",
  Parsing: "info",
  Parsed: "info",
  ParseFailed: "danger",
  UnderReview: "warning",
  Effective: "success",
  Superseded: "neutral",
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

/** Confidence bar — mirrors the AI signal badge in RiskMonitorPage. */
function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone: BadgeTone =
    pct >= 85 ? "success" : pct >= 70 ? "warning" : pct >= 55 ? "primary" : "neutral";
  return <Badge tone={tone}>{pct}%</Badge>;
}

export function ProtocolPage() {
  const [rows, setRows] = useState<ProtocolVersionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProtocolParseStatusValue | "">("");

  // Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProtocolVersionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Activate modal (uses the protocol-activate variant)
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateReason, setActivateReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp: ProtocolVersionListResponse = await listProtocolVersions({
        parseStatus: statusFilter || undefined,
        pageSize: 50,
      });
      setRows(resp.items);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "方案列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await getProtocolVersion(id);
      setDetail(d);
    } catch (e) {
      setDetail(null);
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "无法加载方案详情",
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

  async function performUpload() {
    const session = loadSession();
    if (!session) {
      pushToast({ tone: "error", title: "请先登录" });
      return;
    }
    if (!uploadVersion.trim() || !uploadUrl.trim()) {
      pushToast({ tone: "error", title: "请填写版本号与文件链接" });
      return;
    }
    setSubmitting(true);
    try {
      const row = await uploadProtocolVersion({
        projectId: session.projectId,
        version: uploadVersion.trim(),
        documentUrl: uploadUrl.trim(),
      });
      pushToast({ tone: "success", title: `已上传方案 ${row.version}` });
      setUploadOpen(false);
      setUploadVersion("");
      setUploadUrl("");
      await refresh();
      void openDetail(row.id);
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "上传失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function performParse() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const result = await triggerProtocolParse(selectedId);
      pushToast({
        tone: "success",
        title: "已触发 AI 解析",
        description: `当前状态：${STATUS_LABEL[result.parseStatus]}`,
      });
      await openDetail(selectedId);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "触发解析失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function performActivate() {
    if (!selectedId) return;
    if (!activateReason.trim()) {
      pushToast({ tone: "error", title: "请填写生效原因" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await activateProtocolVersion(selectedId, activateReason.trim());
      pushToast({
        tone: "success",
        title: `方案 ${result.id.slice(0, 8)} 已生效`,
        description: result.supersededPriorId
          ? `已退役上一个版本（${result.supersededPriorId.slice(0, 8)}）。`
          : "项目首个生效方案。",
      });
      setActivateOpen(false);
      setActivateReason("");
      await openDetail(selectedId);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "激活失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const byStatus = useMemo(() => {
    const acc: Partial<Record<ProtocolParseStatusValue, number>> = {};
    for (const r of rows) acc[r.parseStatus] = (acc[r.parseStatus] ?? 0) + 1;
    return acc;
  }, [rows]);

  const latestParseResult = detail?.parseResults[0];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI 方案解析工作台"
        sub={`当前项目共 ${total} 份方案版本，AI 已完成 ${byStatus.Parsed ?? 0} 份解析。`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">状态分布</h3>
          <div className="space-y-2">
            {(Object.entries(byStatus) as Array<[ProtocolParseStatusValue, number]>)
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
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 block">
              解析状态
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ProtocolParseStatusValue | "")
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
            >
              <option value="">全部状态</option>
              {(Object.keys(STATUS_LABEL) as ProtocolParseStatusValue[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">说明</h3>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              上传新版本后由 worker 内置的 Mock Provider
              自动解析，生成入排标准、访视计划、安全风险点。
            </p>
            <p>
              人工确认无误后点「确认生效」即升级为 Effective，
              当前生效版本会自动进入 Superseded 状态（不可逆）。
            </p>
          </div>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => setUploadOpen(true)}
          >
            上传新版本
          </Button>
        </Card>
      </div>

      {loading ? (
        <LoadingState label="正在加载方案列表..." />
      ) : error ? (
        <EmptyState title="加载失败" desc={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无方案版本"
          desc="点击右上角「上传新版本」开始。"
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              方案版本（{total} 份）
            </h3>
            <Badge tone="primary">按上传时间倒序</Badge>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">版本号</th>
                  <th className="py-2 pr-3">解析状态</th>
                  <th className="py-2 pr-3">生效时间</th>
                  <th className="py-2 pr-3">退役时间</th>
                  <th className="py-2 pr-3">上传时间</th>
                  <th className="py-2 pr-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3 text-slate-700 font-mono">
                      {r.version}
                    </td>
                    <td className="py-2 pr-3">
                      <Tag tone={STATUS_TONE[r.parseStatus]}>
                        {STATUS_LABEL[r.parseStatus]}
                      </Tag>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {formatDate(r.effectiveFrom)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {formatDate(r.supersededAt)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {formatDate(r.uploadedAt)}
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

      {/* Drawer — version detail + lifecycle actions */}
      <Drawer
        open={selectedId !== null}
        onClose={closeDetail}
        title={
          detail
            ? `方案 ${detail.version.version} · ${STATUS_LABEL[detail.version.parseStatus]}`
            : "方案详情"
        }
        width={720}
      >
        {selectedId === null ? null : detailLoading ? (
          <LoadingState label="正在加载方案详情..." />
        ) : detail === null ? (
          <EmptyState title="无法加载详情" desc="请稍后重试" />
        ) : (
          <div className="space-y-5">
            <header className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag tone={STATUS_TONE[detail.version.parseStatus]}>
                  {STATUS_LABEL[detail.version.parseStatus]}
                </Tag>
                <Tag tone="neutral">版本 · {detail.version.version}</Tag>
                {detail.version.effectiveFrom ? (
                  <Tag tone="success">
                    生效于 {formatDate(detail.version.effectiveFrom)}
                  </Tag>
                ) : null}
              </div>
              <a
                href={detail.version.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 break-all"
              >
                {detail.version.documentUrl}
              </a>
            </header>

            {latestParseResult ? (
              <section>
                <SectionHeader
                  title="AI 解析结果"
                  sub={`最近一次：${formatDate(latestParseResult.generatedAt)} · 人工确认状态：${latestParseResult.status}`}
                />
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-slate-500">
                      模型 · {latestParseResult.aiOutput?.model ?? "—"} v
                      {latestParseResult.aiOutput?.modelVersion ?? "—"}
                    </div>
                    <ConfidenceBadge value={latestParseResult.confidence} />
                  </div>
                  {latestParseResult.fields.summary ? (
                    <p className="text-sm text-slate-700 leading-relaxed border-l-2 border-blue-200 pl-3">
                      {latestParseResult.fields.summary}
                    </p>
                  ) : null}

                  {latestParseResult.fields.eligibility?.length ? (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-700 mb-1">
                        入排标准（AI 抽取 · 待人工复核）
                      </div>
                      <ul className="text-xs text-slate-600 list-disc pl-5 space-y-0.5">
                        {latestParseResult.fields.eligibility.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {latestParseResult.fields.visits?.length ? (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-700 mb-1">
                        访视计划
                      </div>
                      <table className="w-full text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="text-left py-1">编号</th>
                            <th className="text-left py-1">名称</th>
                            <th className="text-left py-1">D 偏移</th>
                          </tr>
                        </thead>
                        <tbody>
                          {latestParseResult.fields.visits.map((v) => (
                            <tr key={v.code} className="border-t border-slate-100">
                              <td className="py-1 font-mono">{v.code}</td>
                              <td className="py-1">{v.label}</td>
                              <td className="py-1">D{v.dayOffset}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {latestParseResult.fields.safetyPoints?.length ? (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-700 mb-1">
                        安全风险点
                      </div>
                      <ul className="text-xs text-slate-600 list-disc pl-5 space-y-0.5">
                        {latestParseResult.fields.safetyPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <details className="mt-3">
                    <summary className="text-xs text-slate-500 cursor-pointer">
                      查看完整 AI 负载（JSON）
                    </summary>
                    <pre className="mt-2 text-[11px] bg-slate-50 p-2 rounded overflow-auto max-h-48">
                      {JSON.stringify(latestParseResult.fields, null, 2)}
                    </pre>
                  </details>
                </Card>
              </section>
            ) : null}

            {/* Lifecycle actions: gated on parseStatus. */}
            <section>
              <SectionHeader title="生命周期操作" />
              <div className="flex flex-wrap gap-2">
                {detail.version.parseStatus === "Uploaded" ? (
                  <Button
                    size="sm"
                    onClick={() => void performParse()}
                    disabled={submitting}
                  >
                    触发 AI 解析
                  </Button>
                ) : null}
                {detail.version.parseStatus === "UnderReview" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setActivateReason("");
                      setActivateOpen(true);
                    }}
                    disabled={submitting}
                  >
                    确认并生效
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void openDetail(detail.version.id)}
                  disabled={submitting}
                >
                  刷新
                </Button>
              </div>
            </section>

            <section>
              <SectionHeader title="审计链" sub="AuditEvent：方案变更全留痕" />
              {detail.auditTrail.length === 0 ? (
                <div className="text-xs text-slate-400">暂无审计记录</div>
              ) : (
                <AuditTrail
                  items={detail.auditTrail.map((a) => ({
                    time: a.timestamp,
                    user: `${a.actorRole} · ${a.actorUserId}`,
                    action: a.action,
                    result: "成功",
                  }))}
                />
              )}
            </section>
          </div>
        )}
      </Drawer>

      {/* Upload modal — uses the shared confirm variant. */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        variant="confirm"
        title="上传新方案版本"
        body={
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                版本号
              </label>
              <Input
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="例如 v3.0"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                文档链接
              </label>
              <Input
                value={uploadUrl}
                onChange={(e) => setUploadUrl(e.target.value)}
                placeholder="https://files.example.test/protocol.pdf"
                disabled={submitting}
              />
            </div>
            <p className="text-xs text-slate-500">
              上传后状态为「已上传」，需要主动触发 AI 解析进入 Parsing。
              解析由 worker 每 5 分钟扫描一次。
            </p>
          </div>
        }
        confirmLabel="上传"
        onConfirm={() => void performUpload()}
      />

      {/* Activate modal — uses the protocol-activate variant so the user sees
        the high-risk copy + confirm/cancel footer. */}
      <Modal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        variant="protocol-activate"
        title="确认方案生效"
        body={
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              一旦生效，当前正在生效的方案版本会自动进入 Superseded
              状态并不可逆。请填写本次激活原因（必填，审计链会留痕）。
            </p>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                激活原因
              </label>
              <textarea
                value={activateReason}
                onChange={(e) => setActivateReason(e.target.value)}
                rows={3}
                placeholder="例如：v3.0 经 IRB 审核通过，原 v2.0 退役。"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                disabled={submitting}
              />
            </div>
          </div>
        }
        confirmLabel="确认生效"
        onConfirm={() => void performActivate()}
      />
    </div>
  );
}