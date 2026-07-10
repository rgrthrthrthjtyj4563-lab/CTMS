import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { SideNav } from "./SideNav.js";
import { TopBar } from "./TopBar.js";
import type { Session } from "../../lib/session.js";
import { clearSession } from "../../lib/session.js";
import { useNavigate } from "react-router-dom";

export interface AppShellProps {
  session: Session;
  children?: ReactNode;
}

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "U";
  return trimmed.slice(0, 1);
}

export function AppShell({ session, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="flex h-screen"
      style={{ minWidth: 1280, background: "var(--background)" }}
    >
      <SideNav
        projectCode={session.projectCode}
        userInitials={initialsFromName(session.displayName)}
        userName={session.displayName}
        userRoleLabel={roleLabel(session.role)}
        onLogout={handleLogout}
        collapsed={collapsed}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          projectCode={session.projectCode}
          userInitials={initialsFromName(session.displayName)}
          userName={session.displayName}
        />
        <button
          type="button"
          className="absolute z-20 -ml-3 mt-3 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 text-xs leading-none"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
          title={collapsed ? "展开侧栏" : "折叠侧栏"}
        >
          {collapsed ? "›" : "‹"}
        </button>
        <main className="flex-1 overflow-y-auto p-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    SponsorAdmin: "申办方管理员",
    CROPM: "CRO 项目经理",
    SitePI: "主要研究者 (PI)",
    SiteCRC: "研究协调员 (CRC)",
    CRA: "临床研究助理 (CRA)",
    Auditor: "审计员",
    RegulatorReadOnly: "监管只读",
    Subject: "受试者",
    ProviderLogistics: "物流",
    ProviderNurse: "护士",
    SystemAdmin: "系统管理员",
  };
  return map[role] ?? role;
}
