/**
 * Safety event detail page. Loads GET /api/safety/events/:eventId and
 * exposes the full lifecycle actions per the current server-side
 * status (lifecycle is enforced by the server; the UI just calls the
 * matching endpoint and surfaces the next legal action set).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tag } from "../components/ui/Tag.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Tabs } from "../components/ui/Tabs.js";
import { Modal } from "../components/ui/Modal.js";
import { Timeline, type TimelineItem } from "../components/ui/Timeline.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { pushToast } from "../components/ui/Toast.js";
import {
  closeSafetyEvent,
  confirmSafetyEvent,
  getSafetyEvent,
  recordSafetyFollowUp,
  reportSafetyEvent,
  type SafetyEventDetail,
  type SafetyEventStatusValue,
} from "../lib/api/safety.js";
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

const SEVERITY_LABEL: Record<string, string> = {
  Low: "轻度",
  Medium: "中度",
  High: "重度",
  Critical: "危及生命",
};

function formatDate(s: string): string {
  if (!s) return "—";
  return s.slice(0, 19).replace("T", " ");
}

function auditToTimeline(
  auditTrail: SafetyEventDetail["auditTrail"],
): TimelineItem[] {
  return auditTrail.map((a) => {
    const before = a.beforeValue as { status?: string } | null;
    const after = a.afterValue as { status?: string; regulator?: string | null } | null;
    const reasonSuffix = a.reason ? ` · 原因：${a.reason}` : "";
    const transition = before?.status && after?.status
      ? `${before.status} → ${after.status}`
      : after?.status
        ? `→ ${after.status}`
        : a.action;
    const regulator = after?.regulator ? ` · 上报至 ${after.regulator}` : "";
    return {
      time: a.timestamp,
      title: `${a.actorRole} · ${a.action}`,
      description: `${transition}${regulator}${reasonSuffix}`,
      tone:
        a.action === "close"
          ? "success"
          : a.action === "report"
            ? "danger"
            : a.action === "confirm"
              ? "warning"
              : "default",
    };
  });
}

export function SafetyEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SafetyEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "followups" | "audit">(
    "overview",
  );
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!eventId) return;
    setError(null);
    try {
      const d = await getSafetyEvent(eventId);
      setData(d);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    void reload();
  }, [eventId]);

  /* ─── Modal state ─────────────────────────────────────── */
  const [confirmModal, setConfirmModal] = useState<
    "AE" | "SAE" | null
  >(null);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportRegulator, setReportRegulator] = useState("");
  const [followUpModal, setFollowUpModal] = useState(false);
  const [followUpOutcome, setFollowUpOutcome] = useState("");
  const [closeModal, setCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const auditTimeline = useMemo<TimelineItem[]>(
    () => (data ? auditToTimeline(data.auditTrail) : []),
    [data],
  );
  const followUpTimeline = useMemo<TimelineItem[]>(
    () =>
      (data?.followUps ?? []).map((f) => ({
        time: f.followUpAt,
        title: f.recordedBy,
        description: f.outcome,
        tone: "primary" as const,
      })),
    [data],
  );

  if (error) {
    return (
      <EmptyState
        title="无法加载安全事件详情"
        desc={error}
        action={
          <Button size="sm" onClick={() => navigate("/app/ae-sae")}>
            返回列表
          </Button>
        }
      />
    );
  }
  if (!data || !eventId) return <LoadingState label="正在加载安全事件..." />;
  const e = data.event;

  const status = e.status;

  /* ─── Action handlers ─────────────────────────────────── */
  const handleConfirm = async (outcome: "ConfirmedAE" | "ConfirmedSAE") => {
    setBusy(true);
    try {
      await confirmSafetyEvent(eventId!, outcome);
      pushToast({ tone: "success", title: "已确认" });
      setConfirmModal(null);
      await reload();
    } catch (err) {
      pushToast({
        tone: "error",
        title: "确认失败",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) {
      pushToast({ tone: "error", title: "请填写上报原因" });
      return;
    }
    setBusy(true);
    try {
      await reportSafetyEvent(
        eventId!,
        reportReason.trim(),
        reportRegulator.trim() || undefined,
      );
      pushToast({ tone: "success", title: "SAE 已上报" });
      setReportModal(false);
      setReportReason("");
      setReportRegulator("");
      await reload();
    } catch (err) {
      pushToast({
        tone: "error",
        title: "上报失败",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpOutcome.trim()) {
      pushToast({ tone: "error", title: "请填写随访记录" });
      return;
    }
    setBusy(true);
    try {
      await recordSafetyFollowUp(eventId!, followUpOutcome.trim());
      pushToast({ tone: "success", title: "随访记录已保存" });
      setFollowUpModal(false);
      setFollowUpOutcome("");
      await reload();
    } catch (err) {
      pushToast({
        tone: "error",
        title: "随访保存失败",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!closeReason.trim()) {
      pushToast({ tone: "error", title: "请填写关闭原因" });
      return;
    }
    setBusy(true);
    try {
      await closeSafetyEvent(eventId!, closeReason.trim());
      pushToast({ tone: "success", title: "事件已关闭" });
      setCloseModal(false);
      setCloseReason("");
      await reload();
    } catch (err) {
      pushToast({
        tone: "error",
        title: "关闭失败",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate("/app/ae-sae")}
          aria-label="返回列表"
        >
          ‹ 返回
        </Button>
        <h1 className="text-xl font-semibold text-slate-800 font-mono">
          {e.subjectCode}
        </h1>
        <Tag tone={e.isSerious ? "danger" : "warning"}>
          {e.isSerious ? "SAE" : "AE"}
        </Tag>
        <Tag tone={STATUS_TONE[status] ?? "neutral"}>
          {STATUS_LABEL[status] ?? status}
        </Tag>
        <Tag tone="neutral">
          {SEVERITY_LABEL[e.severity] ?? e.severity}
        </Tag>
        {e.aiSuggested ? <Tag tone="ai">AI 标记</Tag> : null}
        <span className="text-xs text-slate-500 ml-auto">
          {e.createdBy ?? "—"} · {formatDate(e.createdAt)}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">事件摘要</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-slate-500">受试者</div>
              <div className="font-mono text-slate-800 font-medium">
                {e.subjectCode}
              </div>
            </div>
            <div>
              <div className="text-slate-500">发生时间</div>
              <div className="text-slate-800">{formatDate(e.onsetAt)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-slate-500">事件描述</div>
              <div className="text-slate-800 mt-1">{e.description}</div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            操作（按当前状态）
          </h2>
          <div className="space-y-2">
            {status === "Draft" ? (
              <>
                <div className="text-[11px] text-slate-500">
                  PI 审核后转为：
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmModal("AE")}
                    disabled={busy}
                  >
                    确认为 AE
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmModal("SAE")}
                    disabled={busy}
                  >
                    确认为 SAE
                  </Button>
                </div>
              </>
            ) : null}

            {status === "ConfirmedSAE" ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setReportModal(true)}
                disabled={busy}
              >
                上报至 IRB / 监管
              </Button>
            ) : null}

            {status === "ConfirmedAE" ||
            status === "ConfirmedSAE" ||
            status === "Reported" ||
            status === "FollowUp" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFollowUpModal(true)}
                  disabled={busy}
                >
                  记录随访
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCloseModal(true)}
                  disabled={busy}
                >
                  关闭事件
                </Button>
              </>
            ) : null}

            {status === "Closed" ? (
              <p className="text-xs text-slate-500">事件已关闭。</p>
            ) : null}

            {!e.isSerious &&
            (status === "ConfirmedAE" || status === "FollowUp") ? (
              <p className="text-[11px] text-slate-400">
                AE（非 SAE）无需上报监管。
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "概述" },
          { id: "followups", label: `随访 (${data.followUps.length})`, count: data.followUps.length },
          { id: "audit", label: `审计 (${data.auditTrail.length})`, count: data.auditTrail.length },
        ]}
        active={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {tab === "overview" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">最近审计事件</h2>
          <Timeline items={auditTimeline.slice(0, 5)} emptyText="暂无审计记录" />
        </Card>
      ) : null}

      {tab === "followups" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">随访记录</h2>
          {followUpTimeline.length === 0 ? (
            <EmptyState title="暂无随访记录" desc={'点击“记录随访”添加。'} />
          ) : (
            <Timeline items={followUpTimeline} />
          )}
        </Card>
      ) : null}

      {tab === "audit" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">审计链</h2>
          <Timeline items={auditTimeline} />
        </Card>
      ) : null}

      {/* Confirm (AE / SAE) modal */}
      <Modal
        open={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        variant="high-risk-confirm"
        title={`确认为 ${confirmModal === "SAE" ? "SAE" : "AE"}`}
        confirmLabel="确认提交"
        onConfirm={() =>
          confirmModal ? handleConfirm(confirmModal === "SAE" ? "ConfirmedSAE" : "ConfirmedAE") : undefined
        }
        body={
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              将草稿转为
              <strong>
                {confirmModal === "SAE" ? " ConfirmedSAE" : " ConfirmedAE"}
              </strong>
              。
              {confirmModal === "SAE"
                ? " SAE 触发 24h 上报倒计时，必须由 PI 报送给 IRB / 监管。"
                : " AE 仅记录与随访，无需上报监管。"}
            </p>
            <p>本次确认将写入审计链。</p>
          </div>
        }
      />

      {/* Report modal */}
      <Modal
        open={reportModal}
        onClose={() => setReportModal(false)}
        variant="high-risk-confirm"
        title="上报 SAE"
        confirmLabel="确认上报"
        onConfirm={handleReport}
        body={
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              SAE 上报是 critical 操作，需在审计日志中记录 reason 与上报机构。
            </p>
            <div>
              <label className="block text-slate-600 mb-1">上报原因（必填）</label>
              <textarea
                value={reportReason}
                onChange={(ev) => setReportReason(ev.target.value)}
                placeholder="例如：受试者出现 3 级发热性中性粒细胞减少，符合 SAE 定义。"
                className="w-full h-24 px-2.5 py-2 border border-slate-200 rounded text-xs resize-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">
                接收监管 / IRB（可选）
              </label>
              <input
                value={reportRegulator}
                onChange={(ev) => setReportRegulator(ev.target.value)}
                placeholder="例如：NMPA / IRB / FDA"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
              />
            </div>
          </div>
        }
      />

      {/* Follow-up modal */}
      <Modal
        open={followUpModal}
        onClose={() => setFollowUpModal(false)}
        variant="confirm"
        title="记录随访"
        confirmLabel="保存随访"
        onConfirm={handleFollowUp}
        body={
          <div className="text-xs">
            <label className="block text-slate-600 mb-1">随访记录</label>
            <textarea
              value={followUpOutcome}
              onChange={(ev) => setFollowUpOutcome(ev.target.value)}
              placeholder="例如：体温恢复，症状减轻，继续观察。"
              className="w-full h-24 px-2.5 py-2 border border-slate-200 rounded text-xs resize-none"
            />
          </div>
        }
      />

      {/* Close modal */}
      <Modal
        open={closeModal}
        onClose={() => setCloseModal(false)}
        variant="close-alert"
        title="关闭事件"
        confirmLabel="确认关闭"
        onConfirm={handleClose}
        body={
          <div className="text-xs space-y-2">
            <p className="text-slate-600">
              关闭为终态操作。关闭原因将写入审计链。
            </p>
            <label className="block text-slate-600 mb-1">关闭原因（必填）</label>
            <textarea
              value={closeReason}
              onChange={(ev) => setCloseReason(ev.target.value)}
              placeholder="例如：症状完全缓解，已恢复至基线。"
              className="w-full h-24 px-2.5 py-2 border border-slate-200 rounded text-xs resize-none"
            />
          </div>
        }
      />
    </div>
  );
}
