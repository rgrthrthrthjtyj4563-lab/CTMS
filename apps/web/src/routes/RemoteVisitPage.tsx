/**
 * Remote visit page. Lists today's visits, opens a detail panel with:
 *   - Subject + visit metadata
 *   - Device / task checklist (ECG, blood pressure, SpO2, body weight)
 *   - Video session panel (start / end remote)
 *   - Lifecycle actions (start, submit-for-pi, complete, mark deviation)
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Tag } from "../components/ui/Tag.js";
import { Tabs } from "../components/ui/Tabs.js";
import { Timeline, type TimelineItem } from "../components/ui/Timeline.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { pushToast } from "../components/ui/Toast.js";
import { ApiError } from "../lib/api/client.js";
import {
  getVisit,
  listVisits,
  startRemoteVisit,
  toggleVisitTask,
  transitionVisit,
  type VisitListRow,
  type VisitTask,
} from "../lib/api/visits.js";

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

const VISIT_STATUS_TONE: Record<string, "neutral" | "info" | "primary" | "success" | "warning" | "danger"> = {
  NotStarted: "neutral",
  Scheduled: "info",
  InProgress: "primary",
  SubmittedForPI: "warning",
  Completed: "success",
  Missed: "danger",
  OutOfWindow: "warning",
  Deviation: "warning",
};

function formatDateTime(s: string | null): string {
  if (!s) return "—";
  return s.slice(0, 19).replace("T", " ");
}

export function RemoteVisitPage() {
  const [rows, setRows] = useState<VisitListRow[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"devices" | "log">("devices");
  const [tasks, setTasks] = useState<VisitTask[]>([]);
  const [visitMeta, setVisitMeta] = useState<{
    subjectCode: string;
    visitCode: string;
    status: string;
    scheduledAt: string;
    windowStart: string;
    windowEnd: string;
  } | null>(null);
  const [remote, setRemote] = useState<{
    startedAt: string;
    endedAt: string | null;
    videoProvider: string | null;
    videoSessionId: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const reloadList = async () => {
    setRowsError(null);
    try {
      const res = await listVisits();
      setRows(res.items);
      if (!selectedId && res.items.length > 0) {
        const next =
          res.items.find((v) => v.isRemote) ?? res.items[0];
        setSelectedId(next.id);
      }
    } catch (e) {
      setRowsError(e instanceof ApiError ? e.message : "加载失败");
    }
  };

  const reloadDetail = async (id: string) => {
    setActionError(null);
    try {
      const d = await getVisit(id);
      setTasks(d.tasks);
      setVisitMeta({
        subjectCode: d.visit.subjectCode,
        visitCode: d.visit.visitCode,
        status: d.visit.status,
        scheduledAt: d.visit.scheduledAt,
        windowStart: d.visit.windowStart,
        windowEnd: d.visit.windowEnd,
      });
      setRemote(d.remote);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "加载详情失败");
    }
  };

  useEffect(() => {
    void reloadList();
  }, []);

  useEffect(() => {
    if (selectedId) void reloadDetail(selectedId);
  }, [selectedId]);

  const handleTransition = async (to: string) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await transitionVisit(selectedId, to);
      pushToast({ tone: "success", title: `已更新为 ${VISIT_STATUS_LABEL[to] ?? to}` });
      await Promise.all([reloadDetail(selectedId), reloadList()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "状态变更失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStartRemote = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      // Synthesized provider/session id. Real implementation will pick
      // a telemedicine provider (Twilio / Agora / Tencent TRTC) and
      // persist the real session id returned by their SDK.
      const sessionId = `demo-${Date.now().toString(36)}`;
      await startRemoteVisit(selectedId, "WebRTC-Mock", sessionId);
      pushToast({ tone: "success", title: "远程视频已建立" });
      await Promise.all([reloadDetail(selectedId), reloadList()]);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "无法建立远程视频",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTask = async (task: VisitTask) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await toggleVisitTask(selectedId, task.id, !task.completed);
      await reloadDetail(selectedId);
    } catch (e) {
      pushToast({
        tone: "error",
        title: "更新任务失败",
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const status = visitMeta?.status ?? "";
  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;

  const deviceTimeline: TimelineItem[] = useMemo(() => {
    if (!visitMeta) return [];
    return [
      {
        time: visitMeta.scheduledAt,
        title: `计划访视 ${visitMeta.visitCode}`,
        description: `窗口：${formatDateTime(visitMeta.windowStart)} → ${formatDateTime(visitMeta.windowEnd)}`,
        tone: "default",
      },
      ...tasks.map((t) => ({
        time: t.completedAt ?? visitMeta.scheduledAt,
        title: `${t.code} · ${t.description}`,
        description: t.completed ? "已完成" : "待执行",
        tone: t.completed ? ("success" as const) : ("warning" as const),
      })),
      ...(remote
        ? [
            {
              time: remote.startedAt,
              title: `远程视频 ${remote.videoProvider ?? ""}`,
              meta: remote.videoSessionId ?? undefined,
              tone: "primary" as const,
            },
          ]
        : []),
    ];
  }, [visitMeta, tasks, remote]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-800">远程访视</h1>
        <p className="text-xs text-slate-500 mt-1">
          视频问诊 + 设备数据（ECG / 血压 / SpO2 / 体重）。每次状态变更与设备勾选都会写入审计日志。
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">访视列表</h2>
          {rowsError ? (
            <EmptyState title="加载失败" desc={rowsError} />
          ) : rows === null ? (
            <LoadingState label="加载中..." />
          ) : rows.length === 0 ? (
            <EmptyState title="暂无访视" desc="请先在受试者管理中排程。" />
          ) : (
            <ul className="space-y-1.5 max-h-[70vh] overflow-y-auto">
              {rows.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedId === v.id
                        ? "border-[var(--primary)] bg-blue-50"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-800">
                        {v.subjectCode} · {v.visitCode}
                      </span>
                      {v.isRemote ? <Tag tone="ai" size="sm">远程</Tag> : null}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatDateTime(v.scheduledAt)} ·{" "}
                      <Tag tone={VISIT_STATUS_TONE[v.status] ?? "neutral"} size="sm">
                        {VISIT_STATUS_LABEL[v.status] ?? v.status}
                      </Tag>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      任务 {v.taskDone}/{v.taskCount}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="col-span-2">
          {!selectedId ? (
            <EmptyState title="选择左侧的访视查看详情" />
          ) : actionError ? (
            <EmptyState title="加载失败" desc={actionError} />
          ) : !visitMeta ? (
            <LoadingState label="加载访视详情..." />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {visitMeta.visitCode} ·{" "}
                    <span className="font-mono">{visitMeta.subjectCode}</span>
                  </h2>
                  <div className="text-xs text-slate-500 mt-1">
                    计划 {formatDateTime(visitMeta.scheduledAt)} · 窗口{" "}
                    {formatDateTime(visitMeta.windowStart)} →{" "}
                    {formatDateTime(visitMeta.windowEnd)}
                  </div>
                </div>
                <Tag tone={VISIT_STATUS_TONE[status] ?? "neutral"}>
                  {VISIT_STATUS_LABEL[status] ?? status}
                </Tag>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="!p-3">
                  <div className="text-[11px] text-slate-500">任务完成度</div>
                  <div className="text-2xl font-semibold text-slate-800 mt-1">
                    {completedTasks}
                    <span className="text-sm text-slate-500">/{totalTasks}</span>
                  </div>
                </Card>
                <Card className="!p-3">
                  <div className="text-[11px] text-slate-500">远程视频</div>
                  <div className="text-sm font-medium text-slate-800 mt-1">
                    {remote
                      ? remote.endedAt
                        ? "已结束"
                        : "进行中"
                      : "未开始"}
                  </div>
                  {remote?.videoSessionId ? (
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {remote.videoSessionId}
                    </div>
                  ) : null}
                </Card>
              </div>

              <div className="flex flex-wrap gap-2">
                {status === "Scheduled" ? (
                  <Button size="sm" onClick={() => handleTransition("InProgress")} disabled={busy}>
                    开始访视
                  </Button>
                ) : null}
                {status === "InProgress" ? (
                  <>
                    <Button size="sm" onClick={() => handleTransition("SubmittedForPI")} disabled={busy}>
                      提交 PI 审核
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTransition("Deviation")}
                      disabled={busy}
                    >
                      标记方案偏离
                    </Button>
                  </>
                ) : null}
                {status === "SubmittedForPI" ? (
                  <Button size="sm" onClick={() => handleTransition("Completed")} disabled={busy}>
                    PI 确认完成
                  </Button>
                ) : null}
                {!remote ? (
                  <Button size="sm" variant="ai" onClick={handleStartRemote} disabled={busy}>
                    建立远程视频
                  </Button>
                ) : !remote.endedAt ? (
                  <Tag tone="primary">视频通话进行中</Tag>
                ) : null}
              </div>

              <Tabs
                tabs={[
                  { id: "devices", label: "设备/任务" },
                  { id: "log", label: "流程记录" },
                ]}
                active={tab}
                onChange={(v) => setTab(v as typeof tab)}
              />

              {tab === "devices" ? (
                <div>
                  {tasks.length === 0 ? (
                    <EmptyState
                      title="该访视暂无设备/任务"
                      desc="可在排程时由 PI 添加 ECG / 血压 / SpO2 / 体重 等检查项。"
                    />
                  ) : (
                    <ul className="space-y-1.5">
                      {tasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-2 p-2 rounded border border-slate-100"
                        >
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => handleToggleTask(t)}
                            disabled={busy}
                            className="w-4 h-4 rounded text-[var(--primary)]"
                          />
                          <div className="flex-1">
                            <div className="text-xs font-medium text-slate-800">
                              {t.code} · {t.description}
                            </div>
                            {t.completedAt ? (
                              <div className="text-[10px] text-slate-400">
                                完成于 {formatDateTime(t.completedAt)}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Timeline items={deviceTimeline} />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
