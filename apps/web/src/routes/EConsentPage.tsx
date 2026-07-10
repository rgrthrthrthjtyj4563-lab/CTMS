/**
 * eConsent workflow page. Two panes:
 *   - Left: list of consent tasks in the project (filterable by status)
 *   - Right: detail of the selected task with a 6-step lifecycle
 *     Timeline (NotStarted → Reading → ComprehensionPending → SubjectSigned
 *     → InvestigatorSigned → Completed).
 *
 * Server-enforced rules (mirrored in UI for clarity, not authority):
 *   - Comprehension score < 60% sends the subject back to Reading.
 *   - Subject signs first; only then can the investigator sign.
 *   - Withdrawal is allowed from any non-terminal state with a reason.
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Tag } from "../components/ui/Tag.js";
import { Timeline, type TimelineItem } from "../components/ui/Timeline.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { Modal } from "../components/ui/Modal.js";
import { pushToast } from "../components/ui/Toast.js";
import { ApiError } from "../lib/api/client.js";
import {
  getConsentTask,
  listConsentTasks,
  signConsent,
  startConsent,
  submitComprehension,
  withdrawConsent,
  type ConsentListRow,
  type ConsentTaskDetail,
} from "../lib/api/consent.js";
import { useNavigate, useSearchParams } from "react-router-dom";

const CONSENT_STATUS_LABEL: Record<string, string> = {
  NotStarted: "未开始",
  Reading: "阅读中",
  ComprehensionPending: "理解题待做",
  SubjectSigned: "受试者已签",
  InvestigatorSigned: "研究者已签",
  Completed: "已完成",
  ReConsentRequired: "需重签",
  Withdrawn: "已撤回",
};

const CONSENT_STATUS_TONE: Record<
  string,
  "neutral" | "info" | "warning" | "success" | "danger" | "primary"
> = {
  NotStarted: "neutral",
  Reading: "info",
  ComprehensionPending: "warning",
  SubjectSigned: "primary",
  InvestigatorSigned: "primary",
  Completed: "success",
  ReConsentRequired: "warning",
  Withdrawn: "danger",
};

const COMPREHENSION_QUESTIONS = [
  "我理解参与本临床试验是完全自愿的，可在任何时候退出而不会受到任何不利影响。",
  "我理解本研究的主要目的、可能的风险和预期获益。",
  "我了解将按方案要求进行访视、检查和用药。",
  "我理解我的个人数据将按适用法规进行保密处理。",
  "我已知晓出现不良事件时应如何联系研究团队。",
];

export function EConsentPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedId = params.get("task");
  const [rows, setRows] = useState<ConsentListRow[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsentTaskDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [comprehensionAnswers, setComprehensionAnswers] = useState<
    Record<number, "yes" | "no" | null>
  >({});
  const [signOpen, setSignOpen] = useState<"subject" | "investigator" | null>(
    null,
  );
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [signerName, setSignerName] = useState("");

  const reloadList = async () => {
    setRowsError(null);
    try {
      const res = await listConsentTasks({ pageSize: 50 });
      setRows(res.items);
    } catch (e) {
      setRowsError(e instanceof ApiError ? e.message : "加载失败");
    }
  };

  const reloadDetail = async (id: string) => {
    setDetailError(null);
    try {
      const d = await getConsentTask(id);
      setDetail(d);
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    void reloadList();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void reloadDetail(selectedId);
  }, [selectedId]);

  const handleStart = async () => {
    if (!detail) return;
    try {
      await startConsent(detail.task.id);
      pushToast({ tone: "success", title: "已进入阅读状态" });
      await Promise.all([reloadDetail(detail.task.id), reloadList()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "无法开始",
        description: e instanceof ApiError ? e.message : undefined,
      });
    }
  };

  const handleComprehension = async () => {
    if (!detail) return;
    const yesCount = COMPREHENSION_QUESTIONS.reduce(
      (acc, _q, i) => acc + (comprehensionAnswers[i] === "yes" ? 1 : 0),
      0,
    );
    try {
      const res = await submitComprehension(
        detail.task.id,
        yesCount,
        COMPREHENSION_QUESTIONS.length,
      );
      if (res.passed) {
        pushToast({
          tone: "success",
          title: `理解题通过（${(res.percent * 100).toFixed(0)}%）`,
        });
      } else {
        pushToast({
          tone: "warning",
          title: `理解题未通过（${(res.percent * 100).toFixed(0)}%），请重新阅读`,
        });
      }
      setComprehensionAnswers({});
      await Promise.all([reloadDetail(detail.task.id), reloadList()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "提交理解题失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    }
  };

  const handleSign = async () => {
    if (!detail || !signOpen || !signerName.trim()) return;
    try {
      const role = signOpen === "subject" ? "Subject" : "Investigator";
      await signConsent(
        detail.task.id,
        role,
        "ESign",
        `${role}:${signerName.trim()}:${Date.now()}`,
      );
      pushToast({ tone: "success", title: "签名已记录" });
      setSignOpen(null);
      setSignerName("");
      await Promise.all([reloadDetail(detail.task.id), reloadList()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "签名失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    }
  };

  const handleWithdraw = async () => {
    if (!detail || !withdrawReason.trim()) return;
    try {
      await withdrawConsent(detail.task.id, withdrawReason.trim());
      pushToast({ tone: "warning", title: "知情已撤回" });
      setWithdrawOpen(false);
      setWithdrawReason("");
      await Promise.all([reloadDetail(detail.task.id), reloadList()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "撤回失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    }
  };

  const detailTimeline: TimelineItem[] = useMemo(() => {
    if (!detail) return [];
    const events: TimelineItem[] = [
      { time: detail.task.updatedAt, title: "创建知情任务", tone: "default" },
    ];
    if (detail.task.startedAt) {
      events.push({
        time: detail.task.startedAt,
        title: "受试者开始阅读",
        tone: "primary",
      });
    }
    if (detail.task.comprehensionScore !== null) {
      events.push({
        time: detail.task.updatedAt,
        title: `理解题得分 ${(detail.task.comprehensionScore * 100).toFixed(0)}%`,
        tone:
          detail.task.comprehensionScore >= 0.6 ? "success" : "warning",
      });
    }
    for (const s of detail.signatures) {
      events.push({
        time: s.signedAt,
        title: `${s.signerRole} 签名（${s.method}）`,
        meta: s.ipAddress ? `IP ${s.ipAddress}` : undefined,
        tone:
          s.signerRole === "Subject"
            ? "primary"
            : s.signerRole === "Investigator"
              ? "ai"
              : "default",
      });
    }
    if (detail.task.status === "Completed") {
      events.push({
        time: detail.task.completedAt ?? detail.task.updatedAt,
        title: "知情流程完成",
        tone: "success",
      });
    } else if (detail.task.status === "Withdrawn") {
      events.push({
        time: detail.task.updatedAt,
        title: "已撤回知情",
        tone: "danger",
      });
    }
    return events;
  }, [detail]);

  const status = detail?.task.status ?? "";
  const canStart = status === "NotStarted";
  const canTakeComprehension = status === "Reading";
  const subjectSigned = detail?.signatures.some((s) => s.signerRole === "Subject") ?? false;
  const investigatorSigned = detail?.signatures.some((s) => s.signerRole === "Investigator") ?? false;
  const canSignSubject = status === "ComprehensionPending" && !subjectSigned;
  const canSignInvestigator =
    status === "SubjectSigned" && !investigatorSigned;
  const isTerminal = status === "Completed" || status === "Withdrawn";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-800">电子知情</h1>
        <p className="text-xs text-slate-500 mt-1">
          阅读 → 理解题 → 受试者签 → 研究者签 → 完成。每一步都会写入审计日志，可被 AI 监管抽取。
        </p>
      </header>
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            知情任务列表
          </h2>
          {rowsError ? (
            <EmptyState title="加载失败" desc={rowsError} />
          ) : rows === null ? (
            <LoadingState label="加载中..." />
          ) : rows.length === 0 ? (
            <EmptyState title="暂无知情任务" />
          ) : (
            <ul className="space-y-1.5 max-h-[70vh] overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set("task", r.id);
                      setParams(next);
                    }}
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
                      <Tag tone={CONSENT_STATUS_TONE[r.status] ?? "neutral"} size="sm">
                        {CONSENT_STATUS_LABEL[r.status] ?? r.status}
                      </Tag>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {r.documentTitle} v{r.documentVersion}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="col-span-2">
          {!selectedId ? (
            <EmptyState title="选择左侧的知情任务查看详情" />
          ) : detailError ? (
            <EmptyState
              title="无法加载知情任务"
              desc={detailError}
              action={
                <Button
                  size="sm"
                  onClick={() => navigate("/app/subjects")}
                  variant="outline"
                >
                  返回
                </Button>
              }
            />
          ) : !detail ? (
            <LoadingState label="加载知情详情..." />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {detail.document.title}
                  </h2>
                  <div className="text-xs text-slate-500 mt-1">
                    v{detail.document.version} ·{" "}
                    受试者{" "}
                    <span className="font-mono text-slate-700">
                      {detail.task.subjectCode}
                    </span>{" "}
                    · 生效自 {detail.document.effectiveFrom.slice(0, 10)}
                  </div>
                </div>
                <Tag tone={CONSENT_STATUS_TONE[status] ?? "neutral"}>
                  {CONSENT_STATUS_LABEL[status] ?? status}
                </Tag>
              </div>

              <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-700 mb-1">
                  知情文档
                </div>
                <a
                  href={detail.document.documentUrl}
                  className="text-[var(--primary)] underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {detail.document.documentUrl}
                </a>
                <p className="mt-1.5">
                  请受试者仔细阅读，并完成 5 道理解题。得分 ≥ 60% 才能进入签名环节。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleStart}
                  disabled={!canStart}
                >
                  {canStart ? "开始阅读" : status === "NotStarted" ? "等待开始" : "已开始"}
                </Button>
                {canTakeComprehension ? (
                  <Button
                    size="sm"
                    variant="ai"
                    onClick={handleComprehension}
                    disabled={Object.keys(comprehensionAnswers).length < COMPREHENSION_QUESTIONS.length}
                  >
                    提交理解题
                  </Button>
                ) : null}
                {canSignSubject ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setSignOpen("subject")}
                  >
                    受试者签字
                  </Button>
                ) : null}
                {canSignInvestigator ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setSignOpen("investigator")}
                  >
                    研究者签字
                  </Button>
                ) : null}
                {!isTerminal ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setWithdrawOpen(true)}
                  >
                    撤回知情
                  </Button>
                ) : null}
              </div>

              {canTakeComprehension ? (
                <div className="rounded border border-slate-100 p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    理解题（全部作答后可提交）
                  </h3>
                  {COMPREHENSION_QUESTIONS.map((q, i) => (
                    <div key={i} className="text-xs">
                      <div className="text-slate-700">
                        {i + 1}. {q}
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {(["yes", "no"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() =>
                              setComprehensionAnswers((p) => ({ ...p, [i]: v }))
                            }
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              comprehensionAnswers[i] === v
                                ? v === "yes"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {v === "yes" ? "理解" : "不理解"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

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

      <Modal
        open={signOpen !== null}
        onClose={() => {
          setSignOpen(null);
          setSignerName("");
        }}
        variant={signOpen === "investigator" ? "ai-confirm" : "confirm"}
        title={signOpen === "subject" ? "受试者电子签名" : "研究者电子签名"}
        body={
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              请输入签名人姓名（本次操作将记入审计日志）。
            </p>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
              placeholder="签名人姓名"
            />
            <p className="text-[11px] text-slate-400">
              签名方法：E-Sign（电子签名）；实际项目可切换为 WetInk / Biometric。
            </p>
          </div>
        }
        onConfirm={handleSign}
      />

      <Modal
        open={withdrawOpen}
        onClose={() => {
          setWithdrawOpen(false);
          setWithdrawReason("");
        }}
        variant="delete-confirm"
        title="撤回知情同意"
        body={
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              撤回将终止该知情流程，且不可逆。请填写原因（必填）。
            </p>
            <textarea
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              className="w-full h-20 px-2.5 py-2 text-xs border border-slate-200 rounded resize-none"
              placeholder="例如：受试者主动撤回"
            />
          </div>
        }
        onConfirm={handleWithdraw}
      />
    </div>
  );
}
