import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, ChevronRight, ChevronDown } from "lucide-react";
import { NAV_ITEMS } from "./SideNav.js";

export interface TopBarProps {
  projectCode: string;
  userInitials: string;
  userName: string;
  onSearch?: (q: string) => void;
}

function titleForPath(pathname: string): string {
  const match = NAV_ITEMS.find((i) => pathname.startsWith(i.path));
  return match ? match.label : "AIC-DCT";
}

export function TopBar({ projectCode, userInitials, userName, onSearch }: TopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [q, setQ] = useState("");

  useEffect(() => {
    setQ("");
  }, [pathname]);

  return (
    <header
      className="bg-white border-b border-slate-200 flex items-center px-5 gap-4 flex-shrink-0 z-10"
      style={{ height: "var(--topbar-h)" }}
    >
      <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
        <span
          className="hover:text-[var(--primary)] cursor-pointer"
          onClick={() => navigate("/app/dashboard")}
        >
          {projectCode}
        </span>
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <span className="text-slate-700 font-medium truncate">
          {titleForPath(pathname)}
        </span>
      </div>
      <div className="flex-1" />
      <form
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 w-56"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch?.(q);
        }}
      >
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent text-xs text-slate-600 outline-none placeholder:text-slate-400"
          placeholder="搜索受试者、事件..."
        />
      </form>
      <button
        type="button"
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="通知"
        title="通知"
      >
        <Bell className="w-4 h-4 text-slate-500" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
      </button>
      <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          {userInitials}
        </div>
        <span className="text-xs font-medium text-slate-700">{userName}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </div>
    </header>
  );
}
