/**
 * ePRO / eCOA page. Phase 2 ships:
 *   - Template list (left pane)
 *   - Response detail form (right pane) that renders the schema as a
 *     generic form. Each item type (scale / single / multi / text /
 *     number) gets the right input element.
 *   - Save partial / Submit / Review actions.
 *
 * The page also has an inline 「新建示例模板」 admin action so the page
 * remains demoable even with an empty seed (the seed only seeds
 * AIOutput / AuditEvent; questionnaire templates are project-provided).
 */
import { Role } from "@aic-dct/domain";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Tag } from "../components/ui/Tag.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { Timeline, type TimelineItem } from "../components/ui/Timeline.js";
import { Tabs } from "../components/ui/Tabs.js";
import { pushToast } from "../components/ui/Toast.js";
import { Modal } from "../components/ui/Modal.js";
import { ApiError } from "../lib/api/client.js";
import {
  getEproResponse,
  listEproResponses,
  listEproTemplates,
  reviewEproResponse,
  saveEproResponse,
  startAssistedEproEntry,
  startEproResponse,
  saveAssistedEproEntry,
  submitAssistedEproEntry,
  submitEproResponse,
  type AssistedEntryMeta,
  type EproResponseRow,
  type EproTemplate,
  type QuestionnaireItem,
  type QuestionnaireSection,
} from "../lib/api/epro.js";
import { listSubjects } from "../lib/api/subjects.js";
import { loadSession } from "../lib/session.js";

const COLLECTION_CHANNELS = [
  { value: "Phone", label: "电话" },
  { value: "InPerson", label: "现场" },
  { value: "Video", label: "视频" },
  { value: "HomeVisit", label: "上门" },
  { value: "Other", label: "其他" },
] as const;

const QSTATUS_LABEL: Record<string, string> = {
  Scheduled: "待开始",
  InProgress: "进行中",
  Submitted: "已提交",
  Reviewed: "已审核",
  Missed: "未完成",
  Late: "逾期",
};
const QSTATUS_TONE: Record<
  string,
  "neutral" | "info" | "primary" | "success" | "warning" | "danger"
> = {
  Scheduled: "neutral",
  InProgress: "primary",
  Submitted: "warning",
  Reviewed: "success",
  Missed: "danger",
  Late: "warning",
};

function formatTime(s: string | null): string {
  if (!s) return "—";
  return s.slice(0, 19).replace("T", " ");
}

export function EproPage() {
  const session = useMemo(() => loadSession(), []);
  const isCrc = session?.role === Role.SiteCRC;
  const [tab, setTab] = useState<"responses" | "templates">("responses");
  const [templates, setTemplates] = useState<EproTemplate[] | null>(null);
  const [responses, setResponses] = useState<EproResponseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    status: string;
    responses: Record<string, unknown>;
    templateSchema: { sections: QuestionnaireSection[] } | null;
    templateName: string;
    templateVersion: string;
    subjectCode: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    entryChannel: string | null;
    assistedEntry: AssistedEntryMeta | null;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [assistedEntryId, setAssistedEntryId] = useState<string | null>(null);
  const [assistedStartReason, setAssistedStartReason] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [startSubjectId, setStartSubjectId] = useState("");
  const [startTemplateId, setStartTemplateId] = useState("");
  const [startCollectionChannel, setStartCollectionChannel] = useState("Phone");
  const [startSubjectOptions, setStartSubjectOptions] = useState<
    { id: string; subjectCode: string }[]
  >([]);

  const reloadTemplates = async () => {
    try {
      const res = await listEproTemplates();
      setTemplates(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载模板失败");
    }
  };

  const reloadResponses = async () => {
    try {
      const res = await listEproResponses();
      setResponses(res.items);
      if (!selectedId && res.items.length > 0) {
        setSelectedId(res.items[0].id);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载问卷失败");
    }
  };

  const reloadDetail = async (id: string) => {
    setError(null);
    try {
      const d = await getEproResponse(id);
      setDetail({
        status: d.response.status,
        responses: d.response.responses,
        templateSchema: d.template?.schema ?? null,
        templateName: d.template?.name ?? "—",
        templateVersion: d.template?.version ?? "—",
        subjectCode: d.subject.subjectCode,
        submittedAt: d.response.submittedAt,
        reviewedAt: d.response.reviewedAt,
        entryChannel: d.response.entryChannel ?? null,
        assistedEntry: d.assistedEntry ?? null,
      });
      setAssistedEntryId(d.assistedEntry?.id ?? null);
      setAnswers(d.response.responses);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载详情失败");
    }
  };

  useEffect(() => {
    void reloadTemplates();
    void reloadResponses();
  }, []);

  useEffect(() => {
    if (selectedId) void reloadDetail(selectedId);
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      if (assistedEntryId) {
        await saveAssistedEproEntry(assistedEntryId, answers);
      } else {
        await saveEproResponse(selectedId, answers);
      }
      pushToast({ tone: "success", title: "已保存" });
      await Promise.all([reloadDetail(selectedId), reloadResponses()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "保存失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      if (assistedEntryId) {
        const reason = assistedStartReason || detail?.assistedEntry?.reason;
        if (!reason) {
          pushToast({ tone: "error", title: "CRC 代录提交需要代录原因" });
          return;
        }
        await submitAssistedEproEntry(assistedEntryId, answers, reason);
      } else {
        await submitEproResponse(selectedId, answers);
      }
      pushToast({ tone: "success", title: "已提交问卷" });
      await Promise.all([reloadDetail(selectedId), reloadResponses()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "提交失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await reviewEproResponse(selectedId);
      pushToast({ tone: "success", title: "已审核" });
      await Promise.all([reloadDetail(selectedId), reloadResponses()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "审核失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const openStartDialog = async () => {
    setStartOpen(true);
    if (startSubjectOptions.length === 0) {
      try {
        const res = await listSubjects({ pageSize: 50 });
        setStartSubjectOptions(
          res.items.map((s) => ({ id: s.id, subjectCode: s.subjectCode })),
        );
      } catch {
        /* swallow */
      }
    }
  };

  const handleStart = async () => {
    if (!startSubjectId || !startTemplateId) return;
    if (isCrc && !assistedStartReason.trim()) {
      pushToast({ tone: "error", title: "请填写 CRC 代录原因" });
      return;
    }
    setBusy(true);
    try {
      const r = isCrc
        ? await startAssistedEproEntry({
            subjectId: startSubjectId,
            questionnaireTemplateId: startTemplateId,
            reason: assistedStartReason.trim(),
            collectionChannel: startCollectionChannel,
          })
        : await startEproResponse(startSubjectId, startTemplateId);
      pushToast({
        tone: "success",
        title: isCrc ? "CRC 代录任务已创建" : "问卷任务已创建",
      });
      setStartOpen(false);
      setStartSubjectId("");
      setStartTemplateId("");
      if (isCrc && "assistedEntryId" in r) {
        setAssistedEntryId(r.assistedEntryId);
      }
      await reloadResponses();
      setSelectedId("responseId" in r ? r.responseId : r.id);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "创建失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  // (No "demo template" affordance — templates are project-owned and
  // must be provisioned via QuestionnaireTemplate SQL. Empty state on
  // the templates tab guides the operator.)

  const detailTimeline: TimelineItem[] = useMemo(() => {
    if (!detail) return [];
    return [
      {
        time: detail.submittedAt ?? "—",
        title: "受试者提交问卷",
        description: detail.submittedAt ? formatTime(detail.submittedAt) : "尚未提交",
        tone: detail.submittedAt ? "success" : "warning",
      },
      {
        time: detail.reviewedAt ?? "—",
        title: "PI/CRC 审核",
        description: detail.reviewedAt ? formatTime(detail.reviewedAt) : "待审核",
        tone: detail.reviewedAt ? "success" : "default",
      },
    ];
  }, [detail]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">ePRO / eCOA</h1>
          <p className="text-xs text-slate-500 mt-1">
            受试者自报告结局。问卷 schema 由项目在 QuestionnaireTemplate 中定义（JSON），客户端按 schema 动态渲染表单。
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openStartDialog}>
            {isCrc ? "CRC 代录" : "新建问卷任务"}
          </Button>
        </div>
      </header>

      <Tabs
        tabs={[
          { id: "responses", label: `问卷任务 (${responses?.length ?? 0})` },
          { id: "templates", label: `模板 (${templates?.length ?? 0})` },
        ]}
        active={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {error ? (
        <EmptyState title="数据加载出错" desc={error} />
      ) : tab === "templates" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            问卷模板
          </h2>
          {templates === null ? (
            <LoadingState label="加载模板..." />
          ) : templates.length === 0 ? (
            <EmptyState
              title="项目下暂无问卷模板"
              desc={"可使用右上角「写入示例模板」按钮快速体验表单渲染；正式场景由项目管理员通过 SQL 导入 QuestionnaireTemplate。"}
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="p-3 rounded border border-slate-100 bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">
                      {t.name}
                    </span>
                    <Tag tone="neutral">v{t.version}</Tag>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {t.code}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {t.itemCount} 个题项
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-1">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              问卷任务
            </h2>
            {responses === null ? (
              <LoadingState label="加载中..." />
            ) : responses.length === 0 ? (
              <EmptyState
                title="暂无问卷任务"
                desc={"点击右上角「新建问卷任务」选择受试者与模板。"}
              />
            ) : (
              <ul className="space-y-1.5 max-h-[70vh] overflow-y-auto">
                {responses.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left p-2 rounded border transition-colors ${
                        selectedId === r.id
                          ? "border-[var(--primary)] bg-blue-50"
                          : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-800">
                          {r.subjectCode}
                        </span>
                        <Tag tone={QSTATUS_TONE[r.status] ?? "neutral"} size="sm">
                          {QSTATUS_LABEL[r.status] ?? r.status}
                        </Tag>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {r.templateName} v{r.templateVersion}
                        {r.entryChannel === "SubjectSelfReport" ? (
                          <span className="ml-1 text-emerald-700">· 受试者源数据</span>
                        ) : r.entryChannel === "AssistedEntry" ? (
                          <span className="ml-1 text-amber-700">· CRC 代录</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="col-span-2">
            {!selectedId ? (
              <EmptyState title="选择左侧的问卷任务查看详情" />
            ) : !detail ? (
              <LoadingState label="加载详情..." />
            ) : !detail.templateSchema ? (
              <EmptyState
                title="模板不存在或已被删除"
                desc="无法展示问卷表单。请联系项目管理员确认 QuestionnaireTemplate。"
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">
                      {detail.templateName}{" "}
                      <span className="text-xs text-slate-400">
                        v{detail.templateVersion}
                      </span>
                    </h2>
                    <div className="text-xs text-slate-500 mt-1">
                      受试者{" "}
                      <span className="font-mono">{detail.subjectCode}</span>
                    </div>
                  </div>
                  <Tag tone={QSTATUS_TONE[detail.status] ?? "neutral"}>
                    {QSTATUS_LABEL[detail.status] ?? detail.status}
                  </Tag>
                </div>

                {detail.entryChannel === "SubjectSelfReport" ? (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5">
                    本条为受试者 App 源数据，后台仅可监查与审核，不能修改或代提交原始作答。
                  </p>
                ) : null}
                {detail.assistedEntry ? (
                  <div className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 space-y-1">
                    <p>
                      <strong>CRC 代录</strong>（非受试者 App 自填）· 采集渠道：
                      {detail.assistedEntry.collectionChannel} · 记录人：
                      {detail.assistedEntry.recorder?.displayName ?? "—"}
                    </p>
                    <p>代录原因：{detail.assistedEntry.reason}</p>
                    {detail.assistedEntry.corrections.length > 0 ? (
                      <p>更正记录：{detail.assistedEntry.corrections.length} 条（见审计链）</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {detail.entryChannel !== "SubjectSelfReport" &&
                  (detail.status === "Scheduled" ||
                    detail.status === "InProgress" ||
                    detail.status === "Late") ? (
                    <>
                      <Button size="sm" onClick={handleSave} disabled={busy}>
                        保存草稿
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={busy}
                      >
                        提交问卷
                      </Button>
                    </>
                  ) : null}
                  {detail.status === "Submitted" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleReview}
                      disabled={busy}
                    >
                      PI/CRC 审核通过
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {detail.templateSchema.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="rounded border border-slate-100 p-3"
                    >
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        {sec.title}
                      </h3>
                      <div className="space-y-2">
                        {sec.items.map((item) => (
                          <ItemField
                            key={item.id}
                            item={item}
                            value={answers[item.id]}
                            disabled={
                              detail.entryChannel === "SubjectSelfReport" ||
                              detail.status === "Submitted" ||
                              detail.status === "Reviewed"
                            }
                            onChange={(v) =>
                              setAnswers((p) => ({ ...p, [item.id]: v }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    流程记录
                  </h3>
                  <Timeline items={detailTimeline} />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        variant="confirm"
        title={isCrc ? "CRC 代录（非受试者 App 自填）" : "新建问卷任务"}
        body={
          <div className="space-y-2">
            {isCrc ? (
              <>
                <label className="block text-xs text-slate-600">
                  代录原因（必填）
                  <textarea
                    rows={2}
                    value={assistedStartReason}
                    onChange={(e) => setAssistedStartReason(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
                    placeholder="例：受试者电话口述，无法自行操作 App"
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  采集渠道
                  <select
                    value={startCollectionChannel}
                    onChange={(e) => setStartCollectionChannel(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
                  >
                    {COLLECTION_CHANNELS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <label className="block text-xs text-slate-600">
              受试者
              <select
                value={startSubjectId}
                onChange={(e) => setStartSubjectId(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
              >
                <option value="">请选择</option>
                {startSubjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subjectCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              问卷模板
              <select
                value={startTemplateId}
                onChange={(e) => setStartTemplateId(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
              >
                <option value="">请选择</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} v{t.version}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        onConfirm={handleStart}
      />
    </div>
  );
}

function ItemField({
  item,
  value,
  onChange,
  disabled,
}: {
  item: QuestionnaireItem;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
}) {
  const baseInput =
    "w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white disabled:bg-slate-50 disabled:text-slate-500";
  return (
    <label className="block">
      <div className="text-xs text-slate-700 mb-1">
        {item.prompt}
        {item.required ? <span className="text-red-500 ml-1">*</span> : null}
        {item.unit ? (
          <span className="text-slate-400 ml-1">({item.unit})</span>
        ) : null}
      </div>
      {item.type === "scale" ? (
        <input
          type="range"
          min={item.min ?? 0}
          max={item.max ?? 10}
          value={typeof value === "number" ? value : (item.min ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full"
        />
      ) : item.type === "number" ? (
        <input
          type="number"
          min={item.min}
          max={item.max}
          value={typeof value === "number" ? value : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          disabled={disabled}
          className={baseInput}
        />
      ) : item.type === "text" ? (
        <textarea
          rows={2}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInput}
        />
      ) : item.type === "single" ? (
        <div className="flex flex-wrap gap-1.5">
          {(item.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={`px-2.5 py-1 text-xs rounded border ${
                value === opt
                  ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)]"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : item.type === "multi" ? (
        <div className="flex flex-wrap gap-1.5">
          {(item.options ?? []).map((opt) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const on = arr.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    on ? arr.filter((v) => v !== opt) : [...arr, opt],
                  )
                }
                className={`px-2.5 py-1 text-xs rounded border ${
                  on
                    ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)]"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <span className="text-xs text-slate-400">未支持的题型：{item.type}</span>
      )}
    </label>
  );
}
