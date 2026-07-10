/**
 * Subject list page. Phase 2 ships a real list backed by /api/subjects
 * (replaces the Phase 1 placeholder). Filters call the server with
 * the same query params so deep-link via query string is preserved.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tag } from "../components/ui/Tag.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { pushToast } from "../components/ui/Toast.js";
import {
  listSubjects,
  type SubjectListResponse,
  type SubjectListRow,
} from "../lib/api/subjects.js";
import { ApiError } from "../lib/api/client.js";

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

export function SubjectsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const search = params.get("search") ?? "";

  const [data, setData] = useState<SubjectListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listSubjects({
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
      page: 1,
      pageSize: 50,
    })
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [status, search]);

  const columns: DataTableColumn<SubjectListRow>[] = useMemo(
    () => [
      {
        key: "subjectCode",
        label: "受试者编号",
        width: "160px",
        render: (r) => (
          <span className="font-mono font-medium text-slate-800">
            {r.subjectCode}
          </span>
        ),
      },
      {
        key: "initials",
        label: "缩写",
        width: "60px",
        render: (r) => r.initials ?? "—",
      },
      { key: "siteCode", label: "中心", width: "100px" },
      { key: "siteName", label: "中心名称" },
      {
        key: "status",
        label: "状态",
        width: "100px",
        render: (r) => (
          <Tag tone={SUBJECT_STATUS_TONE[r.status] ?? "neutral"}>
            {SUBJECT_STATUS_LABEL[r.status] ?? r.status}
          </Tag>
        ),
      },
      {
        key: "ageBand",
        label: "年龄/性别",
        width: "100px",
        render: (r) =>
          r.ageBand ? `${r.ageBand} · ${r.sex === "Male" ? "男" : r.sex === "Female" ? "女" : r.sex ?? ""}` : "—",
      },
      {
        key: "enrollmentDate",
        label: "入组日期",
        width: "120px",
        render: (r) => (r.enrollmentDate ? r.enrollmentDate.slice(0, 10) : "—"),
      },
      { key: "owner", label: "负责人", width: "140px" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">受试者管理</h1>
          <p className="text-xs text-slate-500 mt-1">
            当前项目下的全部受试者，状态变更与知情同意会同步写入审计日志。
          </p>
        </div>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = new URLSearchParams(params);
                if (e.currentTarget.value) next.set("search", e.currentTarget.value);
                else next.delete("search");
                setParams(next);
              }
            }}
            placeholder="搜索编号 / 缩写"
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded w-56"
          />
          <div className="flex flex-wrap gap-1">
            {[
              { value: "", label: "全部" },
              { value: "PreScreening", label: "预筛" },
              { value: "Consenting", label: "知情中" },
              { value: "Screening", label: "筛查" },
              { value: "Enrolled", label: "已入组" },
              { value: "Active", label: "治疗中" },
              { value: "Completed", label: "已完成" },
              { value: "Withdrawn", label: "已脱落" },
              { value: "ScreenFailed", label: "筛查失败" },
            ].map((s) => (
              <button
                key={s.value || "all"}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (s.value) next.set("status", s.value);
                  else next.delete("status");
                  setParams(next);
                }}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  status === s.value
                    ? "bg-[var(--primary)] text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-xs text-slate-500">
            {data ? `共 ${data.total} 人` : "加载中"}
          </div>
        </div>
        {error ? (
          <EmptyState
            title="无法加载受试者"
            desc={error}
            action={
              <Button size="sm" onClick={() => window.location.reload()}>
                重试
              </Button>
            }
          />
        ) : data === null ? (
          <LoadingState label="正在加载受试者..." />
        ) : (
          <DataTable
            columns={columns}
            data={data.items}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/app/subjects/${r.id}`)}
            emptyLabel="该项目暂无受试者"
            rowAccent={(r) =>
              r.status === "Withdrawn"
                ? "var(--risk-critical-text)"
                : r.status === "Active"
                  ? "var(--risk-low-text)"
                  : undefined
            }
          />
        )}
      </Card>
    </div>
  );
}

// Re-export so unrelated callers can grab a stable subject code formatter.
export function formatSubjectCode(code: string): string {
  return code;
}

// suppress unused-warning: keep the helper around for future screens
void pushToast;
