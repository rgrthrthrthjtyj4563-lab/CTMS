import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, Building2 } from "lucide-react";
import { Button } from "../components/ui/Button.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { apiGet, ApiError } from "../lib/api/client.js";
import { clearSession, saveSession, type Session } from "../lib/session.js";

interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  role: Session["role"];
  sites: number;
  subjects: number;
}

export function ProjectSelectionPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("aic-dct.session");
    if (raw) {
      try {
        setSession(JSON.parse(raw) as Session);
      } catch {
        clearSession();
        navigate("/login", { replace: true });
      }
    } else {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setError(null);
    apiGet<{ projects: ProjectListItem[] }>("/api/projects")
      .then((r) => {
        if (cancelled) return;
        setProjects(r.projects);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "无法加载项目列表");
        setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) return null;

  const onSelect = (p: ProjectListItem) => {
    const next: Session = { ...session, projectId: p.id, projectCode: p.code, projectName: p.name };
    saveSession(next);
    setSession(next);
    navigate("/app/dashboard", { replace: true });
  };

  const onLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", minWidth: 1280 }}
    >
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{
              background:
                "linear-gradient(135deg, var(--sidebar-primary), var(--accent))",
            }}
          >
            AIC
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 leading-tight">
              AIC-DCT
            </div>
            <div className="text-xs text-slate-400">选择项目</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="text-xs text-slate-500 mr-3">
          {session.displayName} · {session.email}
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<LogOut className="w-3.5 h-3.5" />}
          onClick={onLogout}
        >
          退出
        </Button>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        <h1 className="text-lg font-semibold text-slate-800 mb-1">选择项目</h1>
        <p className="text-xs text-slate-500 mb-6">
          你当前身份可访问以下研究项目，请选择要进入的项目工作区。
        </p>

        {error ? (
          <div
            className="text-sm text-red-700 px-4 py-3 rounded border border-red-200 bg-red-50 flex items-center gap-2"
            role="alert"
          >
            <RefreshCw className="w-4 h-4" /> {error}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => window.location.reload()}
            >
              重试
            </Button>
          </div>
        ) : null}

        {projects === null ? (
          <LoadingState label="加载项目列表..." />
        ) : projects.length === 0 ? (
          <EmptyState
            title="暂无可访问的项目"
            desc="请联系项目管理员分配项目角色"
            icon={<Building2 className="w-5 h-5" />}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="text-left bg-white rounded-lg p-5 border border-slate-200 hover:border-[var(--primary)] hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  >
                    {p.code}
                  </span>
                  <span className="text-xs text-slate-500">Phase II</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 mb-2 line-clamp-2">
                  {p.name}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span>中心 {p.sites}</span>
                  <span>受试者 {p.subjects}</span>
                  <span>角色 {p.role}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
