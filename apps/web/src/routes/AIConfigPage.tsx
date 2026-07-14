/**
 * AI 中台配置 (AI Platform Configuration).
 *
 * Tabbed workbench for Phase 3 Task 3.6:
 *   - 能力概览: AIConfig list with model/temperature/enabled toggles.
 *   - Prompt 模板: PromptTemplate list + "new version" action.
 *   - AI 输出审核: Pending AIOutput queue + adopt / reject (reason modal).
 *   - 调用日志: AI call log feed with model + prompt version + status.
 *
 * The page is read-heavy: every action goes through a small Modal that
 * forces the user to confirm. Adopt and Reject go through the same
 * `prisma.$transaction` + `auditTx` chain the API enforces, so the
 * audit log entry and the AIOutput status flip land atomically.
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
import { Tabs } from "../components/ui/Tabs.js";
import { pushToast } from "../components/ui/Toast.js";
import {
  adoptAIOutput,
  createPromptVersion,
  listAIConfigs,
  listAICallLogs,
  listAIOutputs,
  listPromptTemplates,
  rejectAIOutput,
  updateAIConfig,
  type AIConfigRow,
  type AIOutputRow,
  type AIOutputStatus,
  type AICallLogRow,
  type PromptTemplateRow,
} from "../lib/api/ai-config.js";
import { ApiError } from "../lib/api/client.js";

type TabKey = "configs" | "prompts" | "outputs" | "call-logs";

const TAB_LABELS: Record<TabKey, string> = {
  configs: "能力概览",
  prompts: "Prompt 模板",
  outputs: "AI 输出审核",
  "call-logs": "调用日志",
};

const STATUS_TONE: Record<
  AIOutputStatus,
  "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "violet"
> = {
  Pending: "warning",
  Adopted: "success",
  EditedAdopted: "primary",
  Rejected: "danger",
  NeedsInvestigatorConfirmation: "info",
};

const STATUS_LABEL: Record<AIOutputStatus, string> = {
  Pending: "待审",
  Adopted: "已采纳",
  EditedAdopted: "编辑采纳",
  Rejected: "已拒绝",
  NeedsInvestigatorConfirmation: "需研究者确认",
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

function confidenceTone(c: number): "danger" | "warning" | "success" {
  if (c >= 0.85) return "success";
  if (c >= 0.7) return "warning";
  return "danger";
}

export function AIConfigPage() {
  const [tab, setTab] = useState<TabKey>("configs");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI 中台配置"
        sub="能力开关、Prompt 版本、输出审核、调用日志。AI 输出永远标注「需人工复核」，不会自动成为正式记录。"
        actions={<Badge tone="ai">Phase 3 · AI</Badge>}
      />

      <Tabs
        active={tab}
        onChange={(v) => setTab(v as TabKey)}
        tabs={Object.entries(TAB_LABELS).map(([id, label]) => ({
          id,
          label,
        }))}
      />

      {tab === "configs" ? <ConfigsTab /> : null}
      {tab === "prompts" ? <PromptsTab /> : null}
      {tab === "outputs" ? <OutputsTab /> : null}
      {tab === "call-logs" ? <CallLogsTab /> : null}
    </div>
  );
}

/* ─── Configs tab ─────────────────────────────────────────── */

function ConfigsTab() {
  const [rows, setRows] = useState<AIConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [editing, setEditing] = useState<AIConfigRow | null>(null);
  const [editForm, setEditForm] = useState({
    provider: "",
    model: "",
    temperature: 0.2,
    maxTokens: 1024,
    enabled: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listAIConfigs({ pageSize: 50 });
      setRows(resp.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "AI 配置加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startEdit(row: AIConfigRow) {
    setEditing(row);
    setEditForm({
      provider: row.provider,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.maxTokens ?? 1024,
      enabled: row.enabled,
    });
  }

  async function performSave() {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateAIConfig(editing.id, {
        provider: editForm.provider,
        model: editForm.model,
        temperature: editForm.temperature,
        maxTokens: editForm.maxTokens,
        enabled: editForm.enabled,
      });
      pushToast({
        tone: "success",
        title: "AI 配置已更新",
        description: "审计链已记录 (AIConfig.update)。",
      });
      setEditing(null);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "更新失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          能力概览（{rows.length} 条）
        </h3>
        {loading ? (
          <LoadingState label="正在加载 AI 配置..." />
        ) : error ? (
          <EmptyState title="加载失败" desc={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="暂无 AI 配置"
            desc="Sponsor / CRO PM 可在「能力概览」Tab 中维护模型 / 温度 / 开关。"
          />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">能力</th>
                  <th className="py-2 pr-3">提供方</th>
                  <th className="py-2 pr-3">模型</th>
                  <th className="py-2 pr-3">温度</th>
                  <th className="py-2 pr-3">最大 Token</th>
                  <th className="py-2 pr-3">状态</th>
                  <th className="py-2 pr-3">范围</th>
                  <th className="py-2 pr-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3 text-slate-700 font-mono text-xs">
                      {r.id.slice(0, 10)}…
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{r.provider}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.model}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {r.temperature.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {r.maxTokens ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <Tag tone={r.enabled ? "success" : "neutral"}>
                        {r.enabled ? "启用" : "停用"}
                      </Tag>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {r.projectId ? "项目级" : "全局"}
                    </td>
                    <td className="py-2 pr-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(r)}
                      >
                        编辑
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        variant="ai-confirm"
        title="编辑 AI 配置"
        body={
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Provider
              </label>
              <input
                value={editForm.provider}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, provider: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Model
              </label>
              <input
                value={editForm.model}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, model: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Temperature
                </label>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  max={2}
                  value={editForm.temperature}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      temperature: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  最大 Token
                </label>
                <input
                  type="number"
                  min={1}
                  value={editForm.maxTokens}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      maxTokens: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, enabled: e.target.checked }))
                  }
                />
                启用该能力
              </label>
            </div>
            <div className="text-xs text-slate-500">
              修改会写入 AuditEvent（动作=update，对象=AIConfig），beforeValue 保留旧配置以便回溯。
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(null)}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performSave()}
              disabled={submitting}
            >
              {submitting ? "保存中..." : "保存"}
            </Button>
          </>
        }
      />
    </>
  );
}

/* ─── Prompts tab ─────────────────────────────────────────── */

function PromptsTab() {
  const [rows, setRows] = useState<PromptTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-version modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    body: "",
    variables: "",
    outputKind: "RiskSignal",
    version: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listPromptTemplates();
      setRows(resp.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Prompt 模板加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function performCreate() {
    setSubmitting(true);
    try {
      const variables = form.variables
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await createPromptVersion({
        code: form.code,
        body: form.body,
        variables,
        outputKind: form.outputKind,
        version: form.version || undefined,
      });
      pushToast({
        tone: "success",
        title: "Prompt 新版本已创建",
        description: "审计链已记录，existing 版本不可变。",
      });
      setOpen(false);
      setForm({
        code: "",
        body: "",
        variables: "",
        outputKind: "RiskSignal",
        version: "",
      });
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "创建失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, PromptTemplateRow[]>();
    for (const r of rows) {
      const arr = map.get(r.code) ?? [];
      arr.push(r);
      map.set(r.code, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Prompt 模板（{rows.length} 条，按 code 分组）
          </h3>
          <Button size="sm" onClick={() => setOpen(true)}>
            新建版本
          </Button>
        </div>
        {loading ? (
          <LoadingState label="正在加载 Prompt 模板..." />
        ) : error ? (
          <EmptyState title="加载失败" desc={error} />
        ) : grouped.length === 0 ? (
          <EmptyState
            title="暂无 Prompt 模板"
            desc="点击右上角「新建版本」开始维护。"
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([code, versions]) => (
              <div key={code} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Tag tone="primary">{code}</Tag>
                  <span className="text-xs text-slate-500">
                    {versions.length} 个版本
                  </span>
                </div>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b">
                        <th className="py-2 pr-3">版本</th>
                        <th className="py-2 pr-3">输出类型</th>
                        <th className="py-2 pr-3">变量</th>
                        <th className="py-2 pr-3">创建时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr
                          key={v.id}
                          className="border-b last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="py-2 pr-3 text-slate-700 font-mono text-xs">
                            {v.version}
                          </td>
                          <td className="py-2 pr-3 text-slate-700">
                            {v.outputKind}
                          </td>
                          <td className="py-2 pr-3 text-xs text-slate-600">
                            {Array.isArray(v.variables)
                              ? (v.variables as string[]).join(", ")
                              : "—"}
                          </td>
                          <td className="py-2 pr-3 text-xs text-slate-600">
                            {formatDate(v.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        variant="ai-confirm"
        title="创建 Prompt 新版本"
        body={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Code
                  <span className="text-red-600 ml-0.5">*</span>
                </label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="例：risk-signal-v1"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  版本（留空自动递增）
                </label>
                <input
                  value={form.version}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, version: e.target.value }))
                  }
                  placeholder="例：2.0.0"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                输出类型
                <span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                value={form.outputKind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outputKind: e.target.value }))
                }
                placeholder="RiskSignal / ProtocolParse / ReportDraft ..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                变量（逗号分隔）
              </label>
              <input
                value={form.variables}
                onChange={(e) =>
                  setForm((f) => ({ ...f, variables: e.target.value }))
                }
                placeholder="例：subjectTimeline, priorAEs"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Prompt 模板
                <span className="text-red-600 ml-0.5">*</span>
              </label>
              <textarea
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={6}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                placeholder={"例：Analyze the subject timeline and return risk signals..."}
              />
            </div>
            <div className="text-xs text-slate-500">
              新建版本不可变；现存版本通过 (code, version) 唯一约束保持历史。
            </div>
          </div>
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performCreate()}
              disabled={submitting || !form.code || !form.body || !form.outputKind}
            >
              {submitting ? "提交中..." : "创建新版本"}
            </Button>
          </>
        }
      />
    </>
  );
}

/* ─── Outputs review tab ──────────────────────────────────── */

function OutputsTab() {
  const [rows, setRows] = useState<AIOutputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Adopt / reject modal state
  const [action, setAction] = useState<{
    kind: "adopt" | "reject";
    output: AIOutputRow;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [adoptNotes, setAdoptNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listAIOutputs({ pageSize: 50, status: "Pending" });
      setRows(resp.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "AI 输出加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function performAction() {
    if (!action) return;
    if (action.kind === "reject" && !rejectReason.trim()) {
      pushToast({ tone: "error", title: "请填写拒绝原因" });
      return;
    }
    setSubmitting(true);
    try {
      if (action.kind === "adopt") {
        await adoptAIOutput(action.output.id, adoptNotes || undefined);
        pushToast({
          tone: "success",
          title: "已采纳",
          description: "AI 输出进入 Adopted 状态，审计链已记录。",
        });
      } else {
        await rejectAIOutput(
          action.output.id,
          rejectReason.trim(),
          adoptNotes || undefined,
        );
        pushToast({
          tone: "success",
          title: "已拒绝",
          description: "审计链已记录拒绝原因。",
        });
      }
      setAction(null);
      setRejectReason("");
      setAdoptNotes("");
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "操作失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            待审 AI 输出（{rows.length} 条）
          </h3>
          <Badge tone="warning">需人工确认 · AI 不会自动落地</Badge>
        </div>
        {loading ? (
          <LoadingState label="正在加载 AI 输出..." />
        ) : error ? (
          <EmptyState title="加载失败" desc={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="暂无待审输出"
            desc="AI 建议都会进入此队列；采纳或拒绝后写入审计链。"
          />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-slate-200 p-3 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <Tag tone="primary">{r.kind}</Tag>
                  <Tag tone={confidenceTone(r.confidence)}>
                    {r.confidenceLevel} · {(r.confidence * 100).toFixed(1)}%
                  </Tag>
                  <Tag tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Tag>
                  <span className="text-slate-500">
                    模型 {r.model} · v{r.modelVersion}
                  </span>
                  {r.promptTemplateCode ? (
                    <span className="text-slate-500">
                      Prompt {r.promptTemplateCode}@{r.promptVersion}
                    </span>
                  ) : null}
                  <span className="text-slate-400 ml-auto">
                    {formatDate(r.generatedAt)}
                  </span>
                </div>
                <pre className="text-[11px] bg-slate-50 p-2 rounded overflow-auto max-h-32 font-mono text-slate-700">
                  {JSON.stringify(r.payload, null, 2)}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      setAction({ kind: "adopt", output: r })
                    }
                    disabled={r.status !== "Pending"}
                  >
                    采纳
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setAction({ kind: "reject", output: r })
                    }
                    disabled={r.status !== "Pending"}
                  >
                    拒绝
                  </Button>
                  {r.status !== "Pending" ? (
                    <span className="text-xs text-slate-500 py-1.5">
                      状态已变更，不可再次操作。
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={action !== null}
        onClose={() => {
          setAction(null);
          setRejectReason("");
          setAdoptNotes("");
        }}
        variant={action?.kind === "reject" ? "export-confirm" : "ai-confirm"}
        title={
          action?.kind === "adopt"
            ? "采纳 AI 输出"
            : "拒绝 AI 输出"
        }
        body={
          <div className="space-y-3">
            {action ? (
              <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">类型：</span>
                  <span className="text-slate-800">{action.output.kind}</span>
                </div>
                <div>
                  <span className="text-slate-500">置信度：</span>
                  <span className="text-slate-800">
                    {action.output.confidenceLevel} ·{" "}
                    {(action.output.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">模型：</span>
                  <span className="text-slate-800">
                    {action.output.model} v{action.output.modelVersion}
                  </span>
                </div>
                {action.output.promptTemplateCode ? (
                  <div>
                    <span className="text-slate-500">Prompt：</span>
                    <span className="text-slate-800">
                      {action.output.promptTemplateCode}@
                      {action.output.promptVersion}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                备注（可选）
              </label>
              <textarea
                value={adoptNotes}
                onChange={(e) => setAdoptNotes(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="例：AI 建议合理，已与受试者核对。"
              />
            </div>
            {action?.kind === "reject" ? (
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  拒绝原因
                  <span className="text-red-600 ml-0.5">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="例：置信度过低，需研究者现场复核。"
                />
                <div className="text-xs text-slate-500 mt-1">
                  拒绝原因必填，会写入审计链。
                </div>
              </div>
            ) : null}
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAction(null);
                setRejectReason("");
                setAdoptNotes("");
              }}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performAction()}
              disabled={
                submitting ||
                (action?.kind === "reject" && !rejectReason.trim())
              }
            >
              {submitting
                ? "提交中..."
                : action?.kind === "adopt"
                  ? "确认采纳"
                  : "确认拒绝"}
            </Button>
          </>
        }
      />
    </>
  );
}

/* ─── Call logs tab ───────────────────────────────────────── */

function CallLogsTab() {
  const [rows, setRows] = useState<AICallLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modelFilter, setModelFilter] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listAICallLogs({
        pageSize: 100,
        model: modelFilter || undefined,
      });
      setRows(resp.items);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "调用日志加载失败");
    } finally {
      setLoading(false);
    }
  }, [modelFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">
          AI 调用日志（{total} 条）
        </h3>
        <div className="flex items-center gap-2">
          <input
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            placeholder="按模型过滤"
            className="w-48 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
          />
        </div>
      </div>
      {loading ? (
        <LoadingState label="正在加载调用日志..." />
      ) : error ? (
        <EmptyState title="加载失败" desc={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="暂无调用日志" desc="工作流触发 AI 调用后会出现在此处。" />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="py-2 pr-3">时间</th>
                <th className="py-2 pr-3">模块</th>
                <th className="py-2 pr-3">调用者</th>
                <th className="py-2 pr-3">模型</th>
                <th className="py-2 pr-3">Prompt 版本</th>
                <th className="py-2 pr-3">输入哈希</th>
                <th className="py-2 pr-3">状态码</th>
                <th className="py-2 pr-3">AI 输出</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-b-0 hover:bg-slate-50"
                >
                  <td className="py-2 pr-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                    {formatDate(r.startedAt)}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <Tag tone="primary">{r.module}</Tag>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600">
                    {r.caller}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600 font-mono">
                    {r.model}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600">
                    {r.promptTemplateCode
                      ? `${r.promptTemplateCode}@${r.promptVersion}`
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600 font-mono">
                    {r.inputHash.slice(0, 16)}…
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {r.statusCode === 200 ? (
                      <Tag tone="success">{r.statusCode}</Tag>
                    ) : (
                      <Tag tone="danger">{r.statusCode ?? "—"}</Tag>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {r.aiOutputId ? (
                      <div className="space-y-1">
                        <div className="text-slate-600 font-mono">
                          {r.aiOutputId.slice(0, 10)}…
                        </div>
                        {r.aiOutputStatus ? (
                          <Tag
                            tone={
                              r.aiOutputStatus === "Adopted"
                                ? "success"
                                : r.aiOutputStatus === "Rejected"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {r.aiOutputStatus}
                          </Tag>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
