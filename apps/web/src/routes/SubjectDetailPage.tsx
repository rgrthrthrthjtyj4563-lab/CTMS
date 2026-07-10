/**
 * Subject detail page. Tabs: 概览 / 访视 / 风险 / 知情 / 操作日志.
 *
 * - 身份信息（姓名 / 身份证 / 电话）默认对 PII 角色 mask，PI/CRC/Sponsor
 *   可点"查看完整身份"主动解锁（GET /identity/full，server-side 再次
 *   校验角色，越权即 403）。
 * - 状态迁移 + 脱落：调 PATCH /status 与 POST /withdraw，server-side
 *   走 lifecycle guard，写入审计日志。
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Tag } from "../components/ui/Tag.js";
import { Tabs } from "../components/ui/Tabs.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { Timeline, type TimelineItem } from "../components/ui/Timeline.js";
import { pushToast } from "../components/ui/Toast.js";
import { Modal } from "../components/ui/Modal.js";
import { ApiError } from "../lib/api/client.js";
import {
  getSubject,
  getSubjectIdentity,
  transitionSubject,
  withdrawSubject,
  type SubjectDetail,
  type SubjectIdentity,
} from "../lib/api/subjects.js";
import { RISK_VISUAL } from "../domain/types.js";

const SUBJECT_STATUS_LABEL: Record<string, string> = {
  PreScreening: "预筛",
  Consenting: "知情中",
  Screening: "筛查",
  Enrolled: "已入组",
  Active: "治疗中",
  Completed: "已完成",
  Withdrawn: "已脱落",
  ScreenFailed: "筛查失败",
};
const SUBJECT_STATUS_TONE: Record<string, "info" | "primary" | "success" | "warning" | "danger" | "violet" | "neutral"> = {
  PreScreening: "neutral",
  Consenting: "info",
  Screening: "info",
  Enrolled: "primary",
  Active: "success",
  Completed: "violet",
  Withdrawn: "danger",
  ScreenFailed: "warning",
};
const VISIT_STATUS_LABEL: Record<string, string> = {
  NotStarted: "未开始",
  Scheduled: "已排程",
  InProgress: "进行中",
  SubmittedForPI: "待 PI 审核",
  Completed: "已完成",
  Missed: "未到访",
  OutOfWindow: "超窗",
  Deviation: "方案偏离",
};

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  return s.slice(0, 19).replace("T", " ");
}

function toRiskLevel(level: string): "low" | "medium" | "high" | "critical" {
  const l = level.toLowerCase();
  if (l === "critical") return "critical";
  if (l === "high") return "high";
  if (l === "medium") return "medium";
  return "low";
}

export function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SubjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<SubjectIdentity | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "visits" | "risks" | "consents" | "log">(
    "overview",
  );
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  const reload = async () => {
    if (!subjectId) return;
    setError(null);
    try {
      const d = await getSubject(subjectId);
      setData(d);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    void reload();

  }, [subjectId]);

  const handleUnmask = async () => {
    if (!subjectId) return;
    setIdentityError(null);
    setIdentityLoading(true);
    try {
      const id = await getSubjectIdentity(subjectId);
      setIdentity(id);
    } catch (e) {
      setIdentityError(e instanceof ApiError ? e.message : "无法查看完整身份");
    } finally {
      setIdentityLoading(false);
    }
  };

  const handleTransition = async (to: string) => {
    if (!subjectId) return;
    setTransitioning(true);
    try {
      await transitionSubject(subjectId, to);
      pushToast({ tone: "success", title: `已更新为 ${SUBJECT_STATUS_LABEL[to] ?? to}` });
      await reload();
    } catch (e) {
      pushToast({
        tone: "error",
        title: "状态变更失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setTransitioning(false);
    }
  };

  const handleWithdraw = async () => {
    if (!subjectId || !withdrawReason.trim()) return;
    try {
      await withdrawSubject(subjectId, withdrawReason.trim());
      pushToast({ tone: "warning", title: "受试者已脱落" });
      setWithdrawOpen(false);
      setWithdrawReason("");
      await reload();
    } catch (e) {
      pushToast({
        tone: "error",
        title: "脱落失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    }
  };

  if (error) {
    return (
      <EmptyState
        title="无法加载受试者详情"
        desc={error}
        action={
          <Button size="sm" onClick={() => navigate("/app/subjects")}>
            返回列表
          </Button>
        }
      />
    );
  }
  if (!data) return <LoadingState label="正在加载受试者..." />;
  const s = data.subject;
  const currentStatus = s.status;

  // Suggest next legal transitions based on the table in @aic-dct/domain.
  // Show every domain-defined transition; the server's lifecycle guard
  // will reject the illegal ones with 422.
  const TRANSITION_OPTIONS: Array<{ to: string; label: string; tone: "primary" | "danger" }> = [
    { to: "PreScreening", label: "→ 预筛", tone: "primary" },
    { to: "Consenting", label: "→ 知情中", tone: "primary" },
    { to: "Screening", label: "→ 筛查", tone: "primary" },
    { to: "Enrolled", label: "→ 入组", tone: "primary" },
    { to: "Active", label: "→ 治疗中", tone: "primary" },
    { to: "Completed", label: "→ 完成", tone: "primary" },
    { to: "ScreenFailed", label: "→ 筛查失败", tone: "primary" },
  ];

  const visitTimeline: TimelineItem[] = data.visits.map((v) => ({
    time: v.scheduledAt,
    title: `${v.visitCode} · ${VISIT_STATUS_LABEL[v.status] ?? v.status}`,
    description: v.isRemote ? "远程访视" : "中心访视",
    tone: v.status === "Completed" ? "success" : v.status === "Missed" ? "danger" : "primary",
  }));

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate("/app/subjects")}
          aria-label="返回受试者列表"
        >
          ‹ 返回
        </Button>
        <h1 className="text-xl font-semibold text-slate-800 font-mono">
          {s.subjectCode}
        </h1>
        <Tag tone={SUBJECT_STATUS_TONE[currentStatus] ?? "neutral"}>
          {SUBJECT_STATUS_LABEL[currentStatus] ?? currentStatus}
        </Tag>
        {s.initials ? <Tag tone="neutral">缩写 {s.initials}</Tag> : null}
        <span className="text-xs text-slate-500 ml-auto">
          {s.siteName} · {s.owner ?? "未指派"}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">身份信息</h2>
            {data.unmaskAllowed ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnmask}
                disabled={identityLoading}
              >
                {identityLoading
                  ? "加载中..."
                  : identity
                    ? "已解锁 · 重新查看"
                    : "查看完整身份"}
              </Button>
            ) : (
              <Tag tone="warning">当前角色不可查看 PII</Tag>
            )}
          </div>
          {identity ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-500">姓名</dt>
                <dd className="text-slate-800 font-medium">
                  {identity.fullName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">身份证号</dt>
                <dd className="text-slate-800 font-mono">
                  {identity.nationalId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">电话</dt>
                <dd className="text-slate-800 font-mono">
                  {identity.phone ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">邮箱</dt>
                <dd className="text-slate-800">{identity.email ?? "—"}</dd>
              </div>
              {identity.address ? (
                <div className="col-span-2">
                  <dt className="text-slate-500">地址</dt>
                  <dd className="text-slate-800">{identity.address}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-xs text-slate-500">
              默认仅显示受试者编号 + 缩写。点击"查看完整身份"会写入一条审计记录。
              {identityError ? (
                <span className="text-red-600 block mt-1">{identityError}</span>
              ) : null}
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">状态与操作</h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">年龄/性别</span>
              <span className="text-slate-800">
                {s.ageBand ?? "—"}
                {s.sex ? ` · ${s.sex === "Male" ? "男" : s.sex === "Female" ? "女" : s.sex}` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">入组日期</span>
              <span className="text-slate-800">
                {s.enrollmentDate ? s.enrollmentDate.slice(0, 10) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">访视数</span>
              <span className="text-slate-800">{data.counts.visits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">开放风险</span>
              <span className="text-slate-800">{data.counts.openRisks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">AE/SAE</span>
              <span className="text-slate-800">{data.counts.aes}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="text-[11px] text-slate-500">状态迁移</div>
            <div className="flex flex-wrap gap-1.5">
              {TRANSITION_OPTIONS.map((opt) => (
                <Button
                  key={opt.to}
                  size="sm"
                  variant={opt.tone === "danger" ? "danger" : "outline"}
                  disabled={opt.to === currentStatus || transitioning}
                  onClick={() => handleTransition(opt.to)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="danger"
              className="w-full mt-2"
              onClick={() => setWithdrawOpen(true)}
              disabled={currentStatus === "Withdrawn" || currentStatus === "Completed"}
            >
              脱落该受试者
            </Button>
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "概览" },
          { id: "visits", label: `访视 (${data.visits.length})`, count: data.visits.length },
          { id: "risks", label: `风险 (${data.risks.length})`, count: data.risks.length },
          { id: "consents", label: `知情 (${data.consents.length})`, count: data.consents.length },
          { id: "log", label: "操作日志" },
        ]}
        active={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {tab === "overview" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">最近访视</h2>
          <Timeline items={visitTimeline.slice(0, 5)} emptyText="暂无访视记录" />
        </Card>
      ) : null}

      {tab === "visits" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">访视记录</h2>
          {data.visits.length === 0 ? (
            <EmptyState title="暂无访视" desc="尚未排程任何访视。" />
          ) : (
            <Timeline items={visitTimeline} />
          )}
        </Card>
      ) : null}

      {tab === "risks" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">风险信号</h2>
          {data.risks.length === 0 ? (
            <EmptyState title="无开放风险" />
          ) : (
            <ul className="space-y-2">
              {data.risks.map((r) => {
                const lvl = toRiskLevel(r.level);
                const v = RISK_VISUAL[lvl];
                return (
                  <li
                    key={r.id}
                    className="rounded border p-3 text-xs"
                    style={{ background: v.bg, borderColor: v.border, color: v.text }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        {r.type} · {r.level}
                      </div>
                      <span className="text-[10px]">{formatDate(r.createdAt)}</span>
                    </div>
                    <div className="text-slate-700 mt-1">{r.trigger}</div>
                    {r.suggestion ? (
                      <div className="text-slate-600 mt-1">
                        <span className="font-medium">建议：</span>
                        {r.suggestion}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "consents" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">知情同意</h2>
          {data.consents.length === 0 ? (
            <EmptyState title="尚无知情同意书" desc="可在 Phase 2.2 知情流程中签署。" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.consents.map((c) => (
                <li key={c.id} className="py-2.5 flex items-center gap-3 text-xs">
                  <span className="font-medium text-slate-800">{c.documentTitle}</span>
                  <Tag tone="neutral">v{c.version}</Tag>
                  <span className="ml-auto text-slate-500">
                    {formatDate(c.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "log" ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">操作日志</h2>
          <p className="text-xs text-slate-500">
            该受试者的全部状态变更、PII 查看、脱落原因均会记录到审计日志（{`/api/dashboard/audit?objectId=${s.id}`}）。
          </p>
        </Card>
      ) : null}

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        variant="delete-confirm"
        title="脱落受试者"
        body={
          <>
            <p className="text-xs text-slate-600 mb-2">
              脱落将写入审计日志，且不可逆。请填写原因（必填）。
            </p>
            <textarea
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              className="w-full h-24 px-2.5 py-2 text-xs border border-slate-200 rounded resize-none"
              placeholder="例如：受试者撤回知情同意 / 出现 SAE 无法继续"
            />
          </>
        }
        onConfirm={handleWithdraw}
      />
    </div>
  );
}
