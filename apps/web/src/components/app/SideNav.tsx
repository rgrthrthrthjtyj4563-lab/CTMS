import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Brain,
  Users,
  FileText,
  Video,
  ClipboardList,
  AlertTriangle,
  Shield,
  Package,
  BarChart2,
  FolderOpen,
  Cpu,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  aiFlag?: boolean;
  /** Phase marker shown as a small badge. */
  phase?: "Phase 2" | "Phase 3" | "Phase 4";
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: "dashboard", label: "项目驾驶舱", path: "/app/dashboard", icon: LayoutDashboard },
  { id: "protocol", label: "AI 方案解析", path: "/app/protocol", icon: Brain, aiFlag: true, phase: "Phase 3" },
  { id: "subjects", label: "受试者管理", path: "/app/subjects", icon: Users },
  { id: "econsent", label: "电子知情", path: "/app/econsent", icon: FileText },
  { id: "remote-visit", label: "远程访视", path: "/app/remote-visit", icon: Video },
  { id: "epro", label: "ePRO / eCOA", path: "/app/epro", icon: ClipboardList },
  { id: "ae-sae", label: "AE/SAE 安全事件", path: "/app/ae-sae", icon: AlertTriangle },
  { id: "risk-monitor", label: "AI 风险监查", path: "/app/risk-monitor", icon: Shield, aiFlag: true, phase: "Phase 3" },
  { id: "drugs", label: "药品与样本", path: "/app/drugs", icon: Package, phase: "Phase 2" },
  { id: "reports", label: "报告中心", path: "/app/reports", icon: BarChart2, phase: "Phase 3" },
  { id: "documents", label: "文档与稽查", path: "/app/documents", icon: FolderOpen, phase: "Phase 2" },
  { id: "ai-config", label: "AI 中台配置", path: "/app/ai-config", icon: Cpu, aiFlag: true, phase: "Phase 3" },
  { id: "settings", label: "系统设置", path: "/app/settings", icon: Settings, phase: "Phase 4" },
];

export interface SideNavProps {
  projectCode: string;
  userInitials: string;
  userName: string;
  userRoleLabel: string;
  onLogout: () => void;
  collapsed?: boolean;
}

export function SideNav({
  projectCode,
  userInitials,
  userName,
  userRoleLabel,
  onLogout,
  collapsed = false,
}: SideNavProps) {
  return (
    <aside
      className={cn(
        "h-full flex flex-col flex-shrink-0 overflow-y-auto transition-[width]",
        collapsed ? "w-16" : "w-60",
      )}
      style={{ background: "var(--sidebar)" }}
    >
      <div
        className="px-4 py-4 border-b flex items-center gap-2.5"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar-primary), var(--accent))",
          }}
        >
          AIC
        </div>
        {!collapsed ? (
          <div>
            <div className="text-sm font-semibold text-white leading-tight">
              AIC-DCT
            </div>
            <div
              className="text-xs leading-tight"
              style={{ color: "var(--sidebar-foreground)", opacity: 0.7 }}
            >
              远程临床试验系统
            </div>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div
          className="px-3 pt-4 pb-1.5 text-xs font-semibold tracking-wider"
          style={{ color: "#334155" }}
        >
          {projectCode} 项目
        </div>
      ) : null}

      <nav className="flex-1 px-2 pb-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                  isActive ? "" : "hover:bg-white/5",
                )
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: "rgba(59,139,245,0.15)",
                      color: "var(--sidebar-primary)",
                    }
                  : { color: "#94a3b8" }
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed ? (
                <>
                  <span className="text-xs font-medium">{item.label}</span>
                  {item.aiFlag ? (
                    <span
                      className="px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(107,82,217,0.3)",
                        color: "#A78BFA",
                        fontSize: "10px",
                      }}
                    >
                      AI
                    </span>
                  ) : null}
                  {item.phase ? (
                    <span
                      className="px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: "rgba(148,163,184,0.18)",
                        color: "#94a3b8",
                        fontSize: "9px",
                        letterSpacing: "0.02em",
                      }}
                      title={`${item.label} 在 ${item.phase} 启用`}
                    >
                      {item.phase}
                    </span>
                  ) : null}
                </>
              ) : item.phase ? (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#475569" }}
                  title={`${item.label} 在 ${item.phase} 启用`}
                />
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div
        className="px-4 py-3 border-t"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userInitials}
          </div>
          {!collapsed ? (
            <>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-300 truncate">
                  {userName}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {userRoleLabel}
                </div>
              </div>
              <button
                type="button"
                className="ml-auto text-slate-500 hover:text-slate-300"
                onClick={onLogout}
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
