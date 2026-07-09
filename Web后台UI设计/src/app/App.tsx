import { useState } from "react";
import {
  LayoutDashboard, Brain, Users, FileText, Video, ClipboardList,
  AlertTriangle, Shield, Package, BarChart2, FolderOpen, Cpu,
  Settings, Bell, Search, ChevronRight, ChevronDown, CheckCircle,
  XCircle, Clock, AlertCircle, Eye, Download, Plus, Filter,
  MoreVertical, Zap, TrendingUp, TrendingDown, Calendar, X, Check,
  Edit, Info, LogOut, Truck, Activity, User, Lock, Building2,
  RefreshCw, ArrowRight, Loader2, FileCheck, Upload, ExternalLink,
  ChevronLeft, Hash, Thermometer, FlaskConical, ClipboardCheck,
  UserCheck, Phone, MailOpen, Star, Circle, Triangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, Legend
} from "recharts";

// ─── TYPES ───────────────────────────────────────────────────
type Page =
  | "login" | "dashboard" | "protocol" | "subjects" | "subject-detail"
  | "econsent" | "remote-visit" | "epro" | "ae-sae" | "risk-monitor"
  | "drugs" | "reports" | "documents" | "ai-config" | "settings";

type RiskLevel = "low" | "medium" | "high" | "critical";
type ModalType =
  | null | "confirm" | "high-risk-confirm" | "ai-confirm"
  | "delete-confirm" | "export-confirm" | "protocol-activate"
  | "close-alert" | "adopt-ai-note";

// ─── MOCK DATA ───────────────────────────────────────────────
const SUBJECTS = [
  { id: "AUR-001-003", center: "北京协和医院", status: "in-treatment", visit: "V4 访视4", icf: "已签署", eproRate: 92, ae: 1, aiRisk: 78, riskLevel: "high" as RiskLevel, crc: "张丽华", tasks: 2 },
  { id: "AUR-001-011", center: "北京协和医院", status: "screening", visit: "V1 筛查", icf: "已签署", eproRate: 0, ae: 0, aiRisk: 45, riskLevel: "medium" as RiskLevel, crc: "张丽华", tasks: 1 },
  { id: "AUR-002-007", center: "上海瑞金医院", status: "in-treatment", visit: "V6 访视6", icf: "已签署", eproRate: 88, ae: 2, aiRisk: 85, riskLevel: "critical" as RiskLevel, crc: "李明远", tasks: 3 },
  { id: "AUR-002-014", center: "上海瑞金医院", status: "in-treatment", visit: "V3 访视3", icf: "再知情待签", eproRate: 75, ae: 0, aiRisk: 62, riskLevel: "high" as RiskLevel, crc: "李明远", tasks: 2 },
  { id: "AUR-003-002", center: "广州南方医院", status: "completed", visit: "V8 完成", icf: "已签署", eproRate: 97, ae: 0, aiRisk: 20, riskLevel: "low" as RiskLevel, crc: "王芳", tasks: 0 },
  { id: "AUR-003-009", center: "广州南方医院", status: "dropout", visit: "V5 脱落", icf: "已签署", eproRate: 60, ae: 1, aiRisk: 92, riskLevel: "critical" as RiskLevel, crc: "王芳", tasks: 1 },
  { id: "AUR-001-018", center: "北京协和医院", status: "screening", visit: "V1 筛查", icf: "未签署", eproRate: 0, ae: 0, aiRisk: 30, riskLevel: "low" as RiskLevel, crc: "张丽华", tasks: 1 },
  { id: "AUR-002-021", center: "上海瑞金医院", status: "in-treatment", visit: "V5 访视5", icf: "已签署", eproRate: 83, ae: 0, aiRisk: 55, riskLevel: "medium" as RiskLevel, crc: "陈静", tasks: 1 },
];

const RISK_ITEMS = [
  { id: "R001", level: "critical" as RiskLevel, type: "AE未处理", object: "AUR-002-007", trigger: "SAE超24h未报告给IRB", suggestion: "立即通知研究者完成SAE上报，核查事件经过", owner: "李明远", deadline: "2024-07-09 18:00", status: "pending" },
  { id: "R002", level: "high" as RiskLevel, type: "访视超窗", object: "AUR-001-003", trigger: "V4访视超出时间窗±7天（已超14天）", suggestion: "安排补救访视或记录方案偏离，通知PM审批", owner: "张丽华", deadline: "2024-07-10", status: "processing" },
  { id: "R003", level: "high" as RiskLevel, type: "再知情合规", object: "AUR-002-014", trigger: "方案第3版修订后未完成再知情签署", suggestion: "立即发起再知情任务，设置3日完成期限", owner: "李明远", deadline: "2024-07-11", status: "pending" },
  { id: "R004", level: "medium" as RiskLevel, type: "ePRO缺失", object: "AUR-003-009", trigger: "连续3次ePRO未按时填写", suggestion: "CRC电话提醒，若仍未完成记录依从性偏离", owner: "王芳", deadline: "2024-07-12", status: "pending" },
  { id: "R005", level: "medium" as RiskLevel, type: "药品超温", object: "上海瑞金医院", trigger: "冷链运输记录显示温度超出2°C达3小时", suggestion: "联系药品管理员核实，填写偏差记录，暂停发药", owner: "陈静", deadline: "2024-07-10", status: "resolved" },
  { id: "R006", level: "low" as RiskLevel, type: "数据缺失", object: "AUR-001-011", trigger: "V1访视生命体征数据未录入EDC", suggestion: "提醒CRC在48h内补录数据", owner: "张丽华", deadline: "2024-07-15", status: "pending" },
];

const ENROLLMENT_DATA = [
  { month: "1月", target: 10, actual: 8 },
  { month: "2月", target: 20, actual: 18 },
  { month: "3月", target: 35, actual: 30 },
  { month: "4月", target: 55, actual: 48 },
  { month: "5月", target: 80, actual: 72 },
  { month: "6月", target: 110, actual: 95 },
  { month: "7月", target: 150, actual: 120 },
];

const RISK_TREND = [
  { name: "2月", low: 12, medium: 8, high: 3, critical: 1 },
  { name: "3月", low: 15, medium: 10, high: 4, critical: 2 },
  { name: "4月", low: 10, medium: 12, high: 6, critical: 1 },
  { name: "5月", low: 18, medium: 9, high: 5, critical: 3 },
  { name: "6月", low: 14, medium: 11, high: 4, critical: 2 },
  { name: "7月", low: 16, medium: 8, high: 7, critical: 2 },
];

const CENTER_RISK = [
  { center: "上海瑞金医院", score: 82, critical: 2, high: 3 },
  { center: "北京协和医院", score: 61, critical: 0, high: 2 },
  { center: "广州南方医院", score: 45, critical: 0, high: 1 },
];

const AUDIT_LOGS = [
  { time: "2024-07-09 14:32:18", user: "李明远 (CRC)", action: "提交受试者AUR-002-007 V6访视记录", ip: "192.168.1.45", result: "成功" },
  { time: "2024-07-09 13:11:05", user: "王医生 (PI)", action: "确认采用AI访视纪要 - AUR-001-003 V4", ip: "192.168.1.12", result: "成功" },
  { time: "2024-07-09 11:48:33", user: "张丽华 (CRC)", action: "上传ICF签署文件 - AUR-001-018", ip: "192.168.1.67", result: "成功" },
  { time: "2024-07-09 10:22:51", user: "系统自动", action: "AI风险评分更新 - 全量受试者", ip: "系统", result: "成功" },
  { time: "2024-07-08 17:05:12", user: "陈静 (CRC)", action: "导出受试者数据报告 (敏感数据已脱敏)", ip: "192.168.1.89", result: "成功" },
];

// ─── STYLE HELPERS ───────────────────────────────────────────
const riskColors: Record<RiskLevel, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5", dot: "#DC2626" },
  high:     { bg: "#FFF7ED", text: "#EA580C", border: "#FCD9A8", dot: "#EA580C" },
  medium:   { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", dot: "#D97706" },
  low:      { bg: "#F0FDF4", text: "#16A34A", border: "#86EFAC", dot: "#16A34A" },
};

const riskLabels: Record<RiskLevel, string> = {
  critical: "紧急", high: "高风险", medium: "中风险", low: "低风险",
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  "screening":    { label: "筛查期", bg: "#EFF6FF", text: "#3B82F6" },
  "in-treatment": { label: "治疗中", bg: "#F0FDF4", text: "#16A34A" },
  "completed":    { label: "已完成", bg: "#F5F3FF", text: "#7C3AED" },
  "dropout":      { label: "已脱落", bg: "#FEF2F2", text: "#DC2626" },
  "pending":      { label: "待处理", bg: "#FFFBEB", text: "#D97706" },
  "processing":   { label: "处理中", bg: "#EFF6FF", text: "#3B82F6" },
  "resolved":     { label: "已解决", bg: "#F0FDF4", text: "#16A34A" },
};

// ─── UI PRIMITIVES ───────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "danger" | "ai" | "ghost" | "outline";
function Btn({
  children, variant = "primary", size = "md", onClick, className = "", disabled = false, icon
}: {
  children: React.ReactNode; variant?: BtnVariant; size?: "sm" | "md" | "lg";
  onClick?: () => void; className?: string; disabled?: boolean; icon?: React.ReactNode;
}) {
  const base = "inline-flex items-center gap-1.5 font-medium rounded transition-all cursor-pointer select-none";
  const sizes = { sm: "px-2.5 py-1 text-xs", md: "px-3.5 py-1.5 text-sm", lg: "px-5 py-2 text-sm" };
  const variants: Record<BtnVariant, string> = {
    primary:   "bg-[#0B4DA2] text-white hover:bg-[#0A3F87] shadow-sm",
    secondary: "bg-[#E6EDF9] text-[#0B4DA2] hover:bg-[#D4E3F7]",
    danger:    "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ai:        "text-white shadow-sm",
    ghost:     "text-slate-600 hover:bg-slate-100",
    outline:   "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  };
  const aiStyle = variant === "ai" ? { background: "linear-gradient(135deg, #6B52D9, #3B8BF5)" } : {};
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      style={aiStyle}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

function RiskBadge({ level, size = "sm" }: { level: RiskLevel; size?: "sm" | "md" }) {
  const c = riskColors[level];
  const p = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${p}`}
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {riskLabels[level]}
    </span>
  );
}

function AITag({ label = "AI建议" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: "#EDE9FE", color: "#5B21B6", border: "1px solid #C4B5FD" }}>
      <Zap className="w-3 h-3" />{label}
    </span>
  );
}

function StatusTag({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
  );
}

function KPICard({ title, value, sub, trend, trendUp, icon, color = "#0B4DA2" }: {
  title: string; value: string | number; sub?: string; trend?: string;
  trendUp?: boolean; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">{title}</span>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style={{ background: color }}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800" style={{ fontFamily: "DM Sans, sans-serif" }}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trendUp ? "text-green-600" : "text-red-500"}`}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      )}
    </div>
  );
}

function RiskCard({ item }: { item: typeof RISK_ITEMS[0] }) {
  const c = riskColors[item.level];
  return (
    <div className="bg-white rounded-lg p-4 border-l-4 shadow-sm"
      style={{ borderLeftColor: c.dot }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <RiskBadge level={item.level} />
          <span className="text-sm font-medium text-slate-700">{item.type}</span>
        </div>
        <span className="text-xs text-slate-400">{item.deadline}</span>
      </div>
      <div className="text-xs text-slate-500 mb-2">
        <span className="font-medium text-slate-600">{item.object}</span> · {item.trigger}
      </div>
      <div className="flex items-center gap-2 p-2 rounded-md text-xs"
        style={{ background: "#F5F3FF", color: "#5B21B6" }}>
        <Zap className="w-3 h-3 flex-shrink-0" />
        <span>{item.suggestion}</span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400">责任人：<span className="text-slate-600">{item.owner}</span></span>
        <StatusTag status={item.status} />
      </div>
    </div>
  );
}

function AISuggestionCard({ title, content, source, onConfirm }: {
  title: string; content: string; source?: string; onConfirm?: () => void;
}) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "#F5F3FF", borderColor: "#C4B5FD" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AITag />
          <span className="text-sm font-semibold text-violet-900">{title}</span>
        </div>
        {source && <span className="text-xs text-slate-400">依据：{source}</span>}
      </div>
      <p className="text-sm text-slate-700 leading-relaxed mb-3">{content}</p>
      {onConfirm && (
        <div className="flex items-center gap-2">
          <Btn variant="ai" size="sm" onClick={onConfirm} icon={<Check className="w-3 h-3" />}>人工确认</Btn>
          <Btn variant="ghost" size="sm">查看依据</Btn>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function AuditTrail({ items = AUDIT_LOGS }: { items?: typeof AUDIT_LOGS }) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map((log, i) => (
        <div key={i} className="py-2.5 flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 flex-shrink-0">{log.time}</span>
              <span className="text-xs font-medium text-slate-600">{log.user}</span>
            </div>
            <div className="text-xs text-slate-700 mt-0.5">{log.action}</div>
          </div>
          <span className={`text-xs flex-shrink-0 ${log.result === "成功" ? "text-green-600" : "text-red-500"}`}>{log.result}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <FolderOpen className="w-5 h-5 text-slate-400" />
      </div>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {desc && <div className="text-xs text-slate-400 mt-1 max-w-xs">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex border-b border-slate-200 gap-0">
      {tabs.map(tab => (
        <button key={tab.id}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active === tab.id ? "border-[#0B4DA2] text-[#0B4DA2]" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          onClick={() => onChange(tab.id)}>
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${active === tab.id ? "bg-[#E6EDF9] text-[#0B4DA2]" : "bg-slate-100 text-slate-400"}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function DataTable({ columns, data, onRowClick }: {
  columns: { key: string; label: string; width?: string }[];
  data: Record<string, React.ReactNode>[];
  onRowClick?: (row: Record<string, React.ReactNode>) => void;
}) {
  return (
    <div className="w-full overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map(c => (
              <th key={c.key} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap"
                style={c.width ? { width: c.width } : {}}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}
              className={`border-b border-slate-100 ${onRowClick ? "cursor-pointer hover:bg-blue-50/50" : "hover:bg-slate-50"} transition-colors`}
              onClick={() => onRowClick?.(row)}>
              {columns.map(c => (
                <td key={c.key} className="px-3 py-2.5 text-slate-700">{row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ value, max, color = "#0B4DA2", size = "md" }: {
  value: number; max: number; color?: string; size?: "sm" | "md";
}) {
  const pct = Math.min(100, (value / max) * 100);
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={`w-full bg-slate-100 rounded-full ${h} overflow-hidden`}>
      <div className={`${h} rounded-full transition-all`} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start py-1.5 gap-2">
      <span className="text-xs text-slate-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs text-slate-700 flex-1 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ─── MODALS ───────────────────────────────────────────────────
function Modal({ open, onClose, type, onConfirm }: {
  open: boolean; onClose: () => void; type: ModalType; onConfirm?: () => void;
}) {
  if (!open || !type) return null;

  const configs: Record<NonNullable<ModalType>, {
    title: string; icon: React.ReactNode; danger?: boolean;
    body: React.ReactNode; confirmLabel: string; confirmVariant?: BtnVariant;
  }> = {
    "confirm": {
      title: "确认操作",
      icon: <CheckCircle className="w-5 h-5 text-blue-600" />,
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">您即将提交受试者 <span className="font-semibold">AUR-001-003</span> 的 V4 访视记录。提交后数据将进入审核队列，不可直接修改。</p>
          <div className="bg-slate-50 rounded p-3 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 inline mr-1" />该操作将记录到审计日志
          </div>
        </div>
      ),
      confirmLabel: "确认提交", confirmVariant: "primary",
    },
    "high-risk-confirm": {
      title: "高风险操作确认",
      icon: <AlertTriangle className="w-5 h-5 text-orange-500" />,
      danger: true,
      body: (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
              <AlertCircle className="w-4 h-4" />此操作存在重大风险
            </div>
            <p className="text-xs text-red-600">您正在强制关闭受试者 AUR-002-007 的 SAE 高风险预警。该操作可能影响合规性审查结果。</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">必须填写操作原因 *</label>
            <textarea className="w-full border border-slate-200 rounded p-2 text-xs resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="请详细说明关闭预警的理由..." />
          </div>
          <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />该操作将记录到审计日志，包括操作人、时间戳和填写原因
          </div>
        </div>
      ),
      confirmLabel: "确认关闭预警", confirmVariant: "danger",
    },
    "ai-confirm": {
      title: "确认 AI 输出内容",
      icon: <Zap className="w-5 h-5 text-violet-600" />,
      body: (
        <div className="space-y-3">
          <AITag label="AI生成草稿" />
          <div className="bg-violet-50 border border-violet-200 rounded p-3 text-xs text-violet-800 leading-relaxed">
            受试者 AUR-001-003 在 V4 访视中反映轻度头痛（3/10），持续约 2 小时后自行缓解。体征平稳：血压 128/82 mmHg，心率 74 bpm，血氧 98%。研究者判断：与试验药物可能相关，暂不需调整剂量，下次访视时随访。
          </div>
          <div className="text-xs text-slate-400">依据来源：访视录音转录 + 受试者 ePRO 填报 + 体征数据</div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">人工编辑区（可直接修改后确认）</label>
            <textarea className="w-full border border-slate-200 rounded p-2 text-xs resize-none h-24 focus:outline-none focus:ring-1 focus:ring-violet-400" defaultValue="受试者 AUR-001-003 在 V4 访视中反映轻度头痛（3/10），持续约 2 小时后自行缓解。体征平稳：血压 128/82 mmHg，心率 74 bpm，血氧 98%。研究者判断：与试验药物可能相关，暂不需调整剂量，下次访视时随访。" />
          </div>
          <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />确认后将以您的名义记录，并标注"基于AI草稿人工确认"，该操作将记录到审计日志
          </div>
        </div>
      ),
      confirmLabel: "确认并采用", confirmVariant: "ai",
    },
    "delete-confirm": {
      title: "删除确认",
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      danger: true,
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">您确定要删除此记录吗？此操作<span className="font-semibold text-red-600">不可撤销</span>。</p>
          <div className="bg-red-50 border border-red-100 rounded p-3 text-xs text-red-700">
            删除后数据将无法恢复，相关审计记录仍将保留。
          </div>
          <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />该操作将记录到审计日志
          </div>
        </div>
      ),
      confirmLabel: "确认删除", confirmVariant: "danger",
    },
    "export-confirm": {
      title: "敏感数据导出确认",
      icon: <Download className="w-5 h-5 text-orange-500" />,
      danger: true,
      body: (
        <div className="space-y-3">
          <div className="bg-orange-50 border border-orange-200 rounded p-3">
            <div className="text-sm font-medium text-orange-800 mb-1">即将导出包含受试者个人信息的数据</div>
            <p className="text-xs text-orange-700">导出范围：全部受试者（8人），包含受试者编号、中心、访视状态，不含直接标识信息（已脱敏）。</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">导出原因 *</label>
            <textarea className="w-full border border-slate-200 rounded p-2 text-xs resize-none h-16 focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="请填写导出数据的用途..." />
          </div>
          <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />该操作将记录到审计日志，包括操作人、时间和导出范围
          </div>
        </div>
      ),
      confirmLabel: "确认导出", confirmVariant: "primary",
    },
    "protocol-activate": {
      title: "方案配置生效确认",
      icon: <FileCheck className="w-5 h-5 text-blue-600" />,
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">您即将将 <span className="font-semibold">AURORA-3 方案 v3.1</span> 的 AI 解析结果设置为正式生效配置。</p>
          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs space-y-1">
            <div className="font-medium text-blue-800 mb-2">生效变更摘要：</div>
            <div className="text-blue-700">· 访视时间窗调整：V4 ±7天 → ±10天</div>
            <div className="text-blue-700">· 新增远程访视任务：V4、V6 支持远程</div>
            <div className="text-blue-700">· 安全风险提示：新增肝功能监测要求</div>
          </div>
          <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />该操作将记录到审计日志，生效后自动向所有中心推送变更通知
          </div>
        </div>
      ),
      confirmLabel: "确认生效", confirmVariant: "primary",
    },
    "close-alert": {
      title: "关闭高风险预警",
      icon: <Shield className="w-5 h-5 text-orange-500" />,
      danger: true,
      body: (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">
            <div className="font-medium mb-1 text-red-800">预警详情：AE未处理 / AUR-002-007</div>
            SAE超24h未报告给IRB，当前为紧急风险等级。关闭预警前请确认已完成SAE报告提交。
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">关闭原因 *</label>
            <textarea className="w-full border border-slate-200 rounded p-2 text-xs resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="请说明关闭原因及已采取的处理措施..." />
          </div>
          <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />该操作将记录到审计日志
          </div>
        </div>
      ),
      confirmLabel: "确认关闭", confirmVariant: "danger",
    },
    "adopt-ai-note": {
      title: "采用 AI 访视纪要",
      icon: <Zap className="w-5 h-5 text-violet-600" />,
      body: (
        <div className="space-y-3">
          <AITag label="AI生成草稿" />
          <div className="bg-violet-50 border border-violet-200 rounded p-3 text-xs text-violet-800 leading-relaxed">
            【AI访视纪要草稿】<br />
            访视日期：2024-07-09，受试者：AUR-001-003<br />
            主诉：轻度头痛，2h内自行缓解。无发热，无恶心。体征：BP 128/82，HR 74，SpO2 98%。<br />
            研究者评估：不良事件（轻度，可能相关），无需停药，继续观察。下次访视：V5，预约2024-08-06。
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">研究者编辑确认</label>
            <textarea className="w-full border border-slate-200 rounded p-2 text-xs resize-none h-28 focus:outline-none focus:ring-1 focus:ring-violet-400" defaultValue="【访视纪要】&#10;访视日期：2024-07-09，受试者：AUR-001-003&#10;主诉：轻度头痛，2h内自行缓解。无发热，无恶心。体征：BP 128/82，HR 74，SpO2 98%。&#10;研究者评估：不良事件（轻度，可能相关），无需停药，继续观察。下次访视：V5，预约2024-08-06。" />
          </div>
          <div className="bg-slate-50 rounded p-2.5 text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />研究者确认后将以其身份归档，标注"AI辅助生成/人工确认"，记录到审计日志
          </div>
        </div>
      ),
      confirmLabel: "研究者确认采用", confirmVariant: "ai",
    },
  };

  const cfg = configs[type];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-5 py-4 border-b flex items-center gap-2.5 ${cfg.danger ? "bg-red-50 border-red-100" : "border-slate-100"}`}>
          {cfg.icon}
          <h3 className="text-sm font-semibold text-slate-800">{cfg.title}</h3>
          <button className="ml-auto text-slate-400 hover:text-slate-600" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4">{cfg.body}</div>
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <Btn variant="outline" size="sm" onClick={onClose}>取消</Btn>
          <Btn variant={cfg.confirmVariant || "primary"} size="sm" onClick={() => { onConfirm?.(); onClose(); }}>{cfg.confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`absolute right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",    label: "项目驾驶舱",   icon: LayoutDashboard },
  { id: "protocol",     label: "AI 方案解析",  icon: Brain },
  { id: "subjects",     label: "受试者管理",   icon: Users },
  { id: "econsent",     label: "电子知情",     icon: FileText },
  { id: "remote-visit", label: "远程访视",     icon: Video },
  { id: "epro",         label: "ePRO / eCOA",  icon: ClipboardList },
  { id: "ae-sae",       label: "AE/SAE 安全事件", icon: AlertTriangle },
  { id: "risk-monitor", label: "AI 风险监查",  icon: Shield },
  { id: "drugs",        label: "药品与样本",   icon: Package },
  { id: "reports",      label: "报告中心",     icon: BarChart2 },
  { id: "documents",    label: "文档与稽查",   icon: FolderOpen },
  { id: "ai-config",    label: "AI 中台配置",  icon: Cpu },
  { id: "settings",     label: "系统设置",     icon: Settings },
];

function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <aside className="w-60 h-full flex flex-col flex-shrink-0 overflow-y-auto" style={{ background: "#0A1628" }}>
      <div className="px-4 py-4 border-b flex items-center gap-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #3B8BF5, #6B52D9)" }}>
          AIC
        </div>
        <div>
          <div className="text-sm font-semibold text-white leading-tight">AIC-DCT</div>
          <div className="text-xs leading-tight" style={{ color: "#64748B" }}>远程临床试验系统</div>
        </div>
      </div>
      <div className="px-2 py-2 text-xs font-semibold tracking-wider px-3 pt-4 pb-1.5" style={{ color: "#334155" }}>
        AURORA-3 项目
      </div>
      <nav className="flex-1 px-2 pb-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = page === item.id;
          const isAI = ["protocol", "risk-monitor", "ai-config"].includes(item.id);
          return (
            <button key={item.id}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-left transition-colors group"
              style={{
                background: active ? "rgba(59,139,245,0.15)" : "transparent",
                color: active ? "#3B8BF5" : "#94A3B8",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              onClick={() => setPage(item.id as Page)}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">{item.label}</span>
              {isAI && (
                <span className="ml-auto px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(107,82,217,0.3)", color: "#A78BFA", fontSize: "10px" }}>AI</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">王</div>
          <div>
            <div className="text-xs font-medium text-slate-300">王医生</div>
            <div className="text-xs" style={{ color: "#475569" }}>主要研究者 (PI)</div>
          </div>
          <button className="ml-auto text-slate-500 hover:text-slate-300"><LogOut className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </aside>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────
function Topbar({ page, setPage, openModal }: { page: Page; setPage: (p: Page) => void; openModal: (m: ModalType) => void }) {
  const titles: Record<Page, string> = {
    login: "", dashboard: "项目驾驶舱", protocol: "AI 方案解析", subjects: "受试者管理",
    "subject-detail": "受试者详情", econsent: "电子知情管理", "remote-visit": "远程访视工作台",
    epro: "ePRO / eCOA 管理", "ae-sae": "AE/SAE 安全事件", "risk-monitor": "AI 风险监查",
    drugs: "药品与样本管理", reports: "报告中心", documents: "文档与稽查", "ai-config": "AI 中台配置", settings: "系统设置",
  };
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-5 gap-4 flex-shrink-0 z-10">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span className="hover:text-blue-600 cursor-pointer" onClick={() => setPage("dashboard")}>AURORA-3</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-700 font-medium">{titles[page]}</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 w-56">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <input className="flex-1 bg-transparent text-xs text-slate-600 outline-none placeholder-slate-400" placeholder="搜索受试者、事件..." />
      </div>
      <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <Bell className="w-4 h-4 text-slate-500" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
      </button>
      <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">王</div>
        <span className="text-xs font-medium text-slate-700">王医生</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </div>
    </header>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [pwd, setPwd] = useState("");
  const [step, setStep] = useState<"creds" | "2fa">("creds");

  return (
    <div className="min-h-screen flex" style={{ background: "#0A1628" }}>
      <div className="hidden lg:flex w-3/5 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse at 20% 50%, #3B8BF5 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #6B52D9 0%, transparent 50%)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg, #3B8BF5, #6B52D9)" }}>AIC</div>
            <div>
              <div className="text-white font-semibold text-lg leading-tight">AIC-DCT</div>
              <div className="text-slate-400 text-xs">远程智能临床试验操作系统</div>
            </div>
          </div>
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white leading-tight">AI 驱动的<br />临床试验<br /><span style={{ color: "#3B8BF5" }}>全流程管理</span></h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">融合 AI 风险监查、远程访视、ePRO/eCOA 和审计留痕，为临床试验提供端到端的智能化解决方案。</p>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { label: "活跃受试者", value: "120", sub: "AURORA-3" },
            { label: "AI 风险预警", value: "6", sub: "待处理" },
            { label: "访视完成率", value: "87%", sub: "本月" },
          ].map((m, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="text-2xl font-bold text-white">{m.value}</div>
              <div className="text-xs text-slate-300 mt-1">{m.label}</div>
              <div className="text-xs text-slate-500">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="p-8 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-lg mb-4" style={{ background: "linear-gradient(135deg, #3B8BF5, #6B52D9)" }}>AIC</div>
              <h2 className="text-xl font-semibold text-white">欢迎登录</h2>
              <p className="text-slate-400 text-sm mt-1">AIC-DCT 远程临床试验系统</p>
            </div>

            {step === "creds" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">账号 / 邮箱</label>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <User className="w-4 h-4 text-slate-500" />
                    <input className="flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500" placeholder="wang.doctor@hospital.com" defaultValue="wang.doctor@hospital.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">密码</label>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <Lock className="w-4 h-4 text-slate-500" />
                    <input type="password" className="flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500" placeholder="••••••••" value={pwd} onChange={e => setPwd(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">图形验证码</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg flex-1" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <input className="flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500" placeholder="请输入验证码" />
                    </div>
                    <div className="w-24 h-10 rounded-lg flex items-center justify-center text-sm font-bold select-none cursor-pointer" style={{ background: "rgba(59,139,245,0.15)", color: "#3B8BF5", border: "1px solid rgba(59,139,245,0.3)", fontFamily: "monospace", letterSpacing: "4px", textDecoration: "line-through" }}>8KX2</div>
                  </div>
                </div>
                <button className="w-full py-2.5 rounded-lg text-white text-sm font-medium mt-2 transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #0B4DA2, #3B8BF5)" }}
                  onClick={() => setStep("2fa")}>
                  下一步
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-3">
                  <div className="text-3xl mb-2">📱</div>
                  <p className="text-sm text-slate-300">验证码已发送至您的手机</p>
                  <p className="text-xs text-slate-500">138****6789</p>
                </div>
                <div className="flex gap-2 justify-center">
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} className="w-9 h-10 rounded-lg flex items-center justify-center text-lg font-bold" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                      {["8","4","","","",""][i]}
                    </div>
                  ))}
                </div>
                <button className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #0B4DA2, #3B8BF5)" }}
                  onClick={onLogin}>
                  验证并登录
                </button>
                <button className="w-full text-xs text-slate-500 hover:text-slate-300 py-1" onClick={() => setStep("creds")}>返回上一步</button>
              </div>
            )}

            <div className="mt-6 pt-4 border-t text-center text-xs text-slate-600" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              符合 21 CFR Part 11 · ICH E6(R2) GCP 标准
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────
function DashboardPage({ setPage, openModal }: { setPage: (p: Page) => void; openModal: (m: ModalType) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">AURORA-3 项目驾驶舱</h1>
          <p className="text-xs text-slate-400 mt-0.5">Phase III · 3个中心 · 最后更新：2024-07-09 14:45</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}>刷新</Btn>
          <Btn variant="ai" size="sm" icon={<Zap className="w-3.5 h-3.5" />}>AI 项目摘要</Btn>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3">
        <KPICard title="入组进度" value="120/150" sub="目标150人" trend="较上月 +25" trendUp icon={<Users className="w-4 h-4" />} color="#0B4DA2" />
        <KPICard title="访视完成率" value="87%" sub="本月 127/146 次" trend="较上月 +3%" trendUp icon={<CheckCircle className="w-4 h-4" />} color="#16A34A" />
        <KPICard title="ePRO完成率" value="82%" sub="本周 134/163 问卷" trend="较上周 -2%" icon={<ClipboardList className="w-4 h-4" />} color="#6B52D9" />
        <KPICard title="AE/SAE" value="4/1" sub="4项AE·1项SAE" trend="新增 1 SAE" icon={<AlertTriangle className="w-4 h-4" />} color="#EA580C" />
        <KPICard title="待处理任务" value="12" sub="高优先 3 项" trend="较昨日 +2" icon={<Clock className="w-4 h-4" />} color="#D97706" />
      </div>

      {/* AI Risk Summary */}
      <AISuggestionCard
        title="AI 风险摘要 · 今日"
        content="当前项目存在1项紧急风险（AUR-002-007 SAE超时未报）、2项高风险（AUR-001-003访视超窗、AUR-002-014再知情缺失）。建议优先处理SAE报告，预计影响当前合规性评分。上海瑞金医院中心整体风险等级最高，建议安排CRA现场稽查。"
        source="风险规则引擎 v2.3 + 大模型综合分析"
        onConfirm={() => openModal("confirm")}
      />

      <div className="grid grid-cols-3 gap-5">
        {/* Enrollment Chart */}
        <div className="col-span-2 bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">入组进度趋势</span>
            <span className="text-xs text-slate-400">目标线 vs 实际入组</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ENROLLMENT_DATA}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0B4DA2" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0B4DA2" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #E2E8F0", borderRadius: 6 }} />
              <Line type="monotone" dataKey="target" stroke="#CBD5E1" strokeDasharray="4 2" dot={false} name="目标" strokeWidth={1.5} />
              <Area type="monotone" dataKey="actual" stroke="#0B4DA2" fill="url(#actualGrad)" dot={{ r: 3, fill: "#0B4DA2" }} name="实际" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* High Risk Center */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-700 mb-4">中心风险排行</div>
          <div className="space-y-3">
            {CENTER_RISK.map((c, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{c.center}</span>
                  <div className="flex items-center gap-1.5">
                    {c.critical > 0 && <span className="text-xs font-medium text-red-600">{c.critical} 紧急</span>}
                    {c.high > 0 && <span className="text-xs font-medium text-orange-500">{c.high} 高风险</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ProgressBar value={c.score} max={100} color={c.score > 75 ? "#DC2626" : c.score > 55 ? "#EA580C" : "#16A34A"} />
                  <span className="text-xs font-medium text-slate-600 w-8 text-right">{c.score}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <Btn variant="secondary" size="sm" className="w-full justify-center" onClick={() => setPage("risk-monitor")}>
              查看全部风险 <ArrowRight className="w-3 h-3" />
            </Btn>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* High Risk Subjects */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <SectionHeader title="高风险受试者" sub="AI 综合风险评分 ≥ 70" actions={<Btn variant="ghost" size="sm" onClick={() => setPage("subjects")}>查看全部 <ChevronRight className="w-3.5 h-3.5" /></Btn>} />
          <div className="space-y-2">
            {SUBJECTS.filter(s => s.aiRisk >= 70).map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setPage("subject-detail")}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: riskColors[s.riskLevel].dot }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 font-mono">{s.id}</div>
                  <div className="text-xs text-slate-400">{s.center} · {s.visit}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: riskColors[s.riskLevel].text }}>{s.aiRisk}</div>
                  <div className="text-xs text-slate-400">风险分</div>
                </div>
                <RiskBadge level={s.riskLevel} />
              </div>
            ))}
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <SectionHeader title="待处理任务" sub="需要人工介入" />
          <div className="space-y-2">
            {[
              { type: "SAE报告", subject: "AUR-002-007", deadline: "今日 18:00", level: "critical" as RiskLevel, owner: "李明远" },
              { type: "访视超窗处理", subject: "AUR-001-003", deadline: "明日", level: "high" as RiskLevel, owner: "张丽华" },
              { type: "再知情签署", subject: "AUR-002-014", deadline: "3日内", level: "high" as RiskLevel, owner: "李明远" },
              { type: "ICF签署跟进", subject: "AUR-001-018", deadline: "5日内", level: "medium" as RiskLevel, owner: "张丽华" },
            ].map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                <RiskBadge level={task.level} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700">{task.type}</div>
                  <div className="text-xs text-slate-400 font-mono">{task.subject}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-500">{task.deadline}</div>
                  <div className="text-xs text-slate-400">{task.owner}</div>
                </div>
                <Btn variant="ghost" size="sm">处理</Btn>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROTOCOL PAGE ────────────────────────────────────────────
function ProtocolPage({ openModal }: { openModal: (m: ModalType) => void }) {
  const [activeTab, setActiveTab] = useState("criteria");
  const tabs = [
    { id: "criteria", label: "入排标准", count: 12 },
    { id: "visits", label: "访视计划", count: 8 },
    { id: "tasks", label: "访视任务" },
    { id: "risks", label: "安全风险点", count: 5 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">AI 方案解析</h1>
          <div className="flex items-center gap-2 mt-1">
            <AITag label="AI已解析" />
            <span className="text-xs text-slate-400">AURORA-3-Protocol-v3.1.pdf · 解析于 2024-07-01 · 由研究者王医生确认生效</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<Upload className="w-3.5 h-3.5" />}>上传新版本</Btn>
          <Btn variant="primary" size="sm" icon={<FileCheck className="w-3.5 h-3.5" />} onClick={() => openModal("protocol-activate")}>确认生效</Btn>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        <div className="p-4">
          {activeTab === "criteria" && (
            <div className="space-y-4">
              <AISuggestionCard
                title="AI 解析说明"
                content="已从方案第4章提取入选标准8条、排除标准4条。建议特别关注排除标准第3条（严重肝功能损害），AI识别该条与AE安全风险点存在关联，建议研究者确认解析准确性。"
                source="AURORA-3-Protocol-v3.1.pdf 第4章 §4.2-4.3"
                onConfirm={() => openModal("ai-confirm")}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />入选标准（8条）</div>
                  {[
                    "年龄 18-75 岁",
                    "确诊晚期非小细胞肺癌",
                    "ECOG 体力评分 0-2 分",
                    "预期生存期 ≥ 12 周",
                    "具备阅读和理解知情同意书能力",
                    "近6个月内未参与其他临床试验",
                    "签署书面知情同意书",
                    "有可测量靶病灶（RECIST 1.1）",
                  ].map((c, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-50">
                      <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0 font-mono">I{i+1}</span>
                      <span className="text-xs text-slate-700">{c}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已确认</span>
                        <button className="text-slate-400 hover:text-slate-600"><Edit className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />排除标准（4条）</div>
                  {[
                    "既往接受过同类靶向治疗",
                    "未控制的脑转移",
                    "严重肝功能损害（Child-Pugh C级）",
                    "妊娠期或哺乳期女性",
                  ].map((c, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-50">
                      <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0 font-mono">E{i+1}</span>
                      <span className="text-xs text-slate-700">{c}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {i === 2 ? (
                          <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" />待核查</span>
                        ) : (
                          <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已确认</span>
                        )}
                        <button className="text-slate-400 hover:text-slate-600"><Edit className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === "visits" && (
            <div className="space-y-3">
              {[
                { visit: "V1", name: "筛查访视", window: "第-28~0天", remote: false, tasks: 6 },
                { visit: "V2", name: "基线访视", window: "第1天", remote: false, tasks: 8 },
                { visit: "V3", name: "第8周访视", window: "第56天 ±7天", remote: true, tasks: 5 },
                { visit: "V4", name: "第16周访视", window: "第112天 ±10天", remote: true, tasks: 5 },
                { visit: "V5", name: "第24周访视", window: "第168天 ±7天", remote: true, tasks: 4 },
                { visit: "V6", name: "第32周访视", window: "第224天 ±7天", remote: false, tasks: 7 },
                { visit: "V7", name: "第40周访视", window: "第280天 ±7天", remote: true, tasks: 4 },
                { visit: "V8", name: "研究完成访视", window: "第336天 ±14天", remote: false, tasks: 9 },
              ].map((v, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "#E6EDF9", color: "#0B4DA2" }}>{v.visit}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-700">{v.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{v.window}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.remote ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1"><Video className="w-3 h-3" />可远程</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" />必须到院</span>
                    )}
                    <span className="text-xs text-slate-400">{v.tasks} 项任务</span>
                    <Btn variant="ghost" size="sm">详情</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(activeTab === "tasks" || activeTab === "risks") && (
            <div className="py-4">
              <AISuggestionCard
                title={activeTab === "tasks" ? "AI 访视任务清单（示例：V4 远程访视）" : "AI 识别安全风险点"}
                content={activeTab === "tasks"
                  ? "V4远程访视包含5项可远程任务：ePRO问卷收集、受试者自述症状、用药依从性核查、生活质量评分、安全性问询。以下2项须到院：ECG检查、血液样本采集。"
                  : "AI从方案中识别出5项安全风险点：①排除标准E3肝功能需定期监测；②已知与靶向药物相关的间质性肺炎风险；③QTc延长风险（需ECG随访）；④免疫相关不良事件监测；⑤驾驶和操作机器能力影响告知。"
                }
                source={activeTab === "tasks" ? "方案§6.3远程访视要求" : "方案§7.4安全性监测 + 参考文献库"}
                onConfirm={() => openModal("ai-confirm")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SUBJECTS PAGE ────────────────────────────────────────────
function SubjectsPage({ setPage, openModal }: { setPage: (p: Page) => void; openModal: (m: ModalType) => void }) {
  const [search, setSearch] = useState("");
  const stats = [
    { label: "筛查期", count: 2, color: "#3B82F6" },
    { label: "治疗中", count: 4, color: "#16A34A" },
    { label: "已完成", count: 1, color: "#7C3AED" },
    { label: "已脱落", count: 1, color: "#DC2626" },
  ];

  const filtered = SUBJECTS.filter(s => s.id.includes(search) || s.center.includes(search));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">受试者管理</h1>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => openModal("export-confirm")}>导出数据</Btn>
          <Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>新增受试者</Btn>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ background: s.color }} />
            <div>
              <div className="text-xl font-bold text-slate-800">{s.count}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-3 border-b border-slate-100 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input className="flex-1 bg-transparent text-xs text-slate-600 outline-none placeholder-slate-400" placeholder="搜索受试者编号、中心..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Btn variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />}>筛选</Btn>
          <div className="flex items-center gap-2 ml-auto text-xs text-slate-400">
            共 {filtered.length} 位受试者
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["受试者编号", "研究中心", "状态", "当前访视", "电子知情", "ePRO完成率", "AE/SAE", "AI风险", "责任CRC", "待办任务", "操作"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => setPage("subject-detail")}>
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-medium text-blue-700 hover:text-blue-900">{s.id}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{s.center}</td>
                  <td className="px-3 py-2.5"><StatusTag status={s.status} /></td>
                  <td className="px-3 py-2.5 text-slate-600">{s.visit}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.icf === "已签署" ? "bg-green-50 text-green-700" : s.icf === "未签署" ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"}`}>
                      {s.icf}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={s.eproRate} max={100} size="sm" color={s.eproRate >= 80 ? "#16A34A" : s.eproRate >= 60 ? "#D97706" : "#DC2626"} />
                      <span className="w-8 text-right text-slate-600">{s.eproRate}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {s.ae > 0 ? <span className="text-orange-600 font-medium">{s.ae}</span> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold" style={{ color: riskColors[s.riskLevel].text }}>{s.aiRisk}</span>
                      <RiskBadge level={s.riskLevel} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{s.crc}</td>
                  <td className="px-3 py-2.5">
                    {s.tasks > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-xs font-medium">{s.tasks} 项待办</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Btn variant="ghost" size="sm">详情</Btn>
                      <button className="p-1 text-slate-400 hover:text-slate-600"><MoreVertical className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">第 1-{filtered.length} 条，共 {filtered.length} 条</span>
          <div className="flex items-center gap-1">
            <button className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-500 disabled:opacity-40" disabled>上一页</button>
            <button className="px-2.5 py-1 text-xs bg-[#0B4DA2] text-white rounded">1</button>
            <button className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-500 disabled:opacity-40" disabled>下一页</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SUBJECT DETAIL PAGE ─────────────────────────────────────
function SubjectDetailPage({ setPage, openModal }: { setPage: (p: Page) => void; openModal: (m: ModalType) => void }) {
  const [activeTab, setActiveTab] = useState("overview");
  const subject = SUBJECTS[0];
  const tabs = [
    { id: "overview", label: "基本信息" }, { id: "visits", label: "访视记录" },
    { id: "icf", label: "电子知情" }, { id: "epro", label: "ePRO" },
    { id: "meds", label: "用药记录" }, { id: "ae", label: "AE/SAE" },
    { id: "files", label: "上传文件" }, { id: "ai", label: "AI 风险" },
    { id: "audit", label: "审计日志" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="text-slate-400 hover:text-slate-600" onClick={() => setPage("subjects")}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-800 font-mono">{subject.id}</h1>
            <StatusTag status={subject.status} />
            <RiskBadge level={subject.riskLevel} />
            <AITag label={`AI风险分 ${subject.aiRisk}`} />
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{subject.center} · {subject.visit} · 责任CRC：{subject.crc}</div>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<Phone className="w-3.5 h-3.5" />}>联系受试者</Btn>
          <Btn variant="primary" size="sm" icon={<Video className="w-3.5 h-3.5" />} onClick={() => setPage("remote-visit")}>发起远程访视</Btn>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <KPICard title="当前访视" value="V4" sub="第16周访视" icon={<Calendar className="w-4 h-4" />} color="#0B4DA2" />
        <KPICard title="ePRO完成率" value="92%" sub="本月" icon={<ClipboardList className="w-4 h-4" />} color="#16A34A" />
        <KPICard title="AE 记录" value="1" sub="轻度头痛" icon={<AlertCircle className="w-4 h-4" />} color="#EA580C" />
        <KPICard title="用药依从性" value="96%" sub="过去28天" icon={<Activity className="w-4 h-4" />} color="#6B52D9" />
        <KPICard title="待办任务" value="2" sub="访视超窗·ICF" icon={<Clock className="w-4 h-4" />} color="#D97706" />
      </div>

      {/* AI Risk Card */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-l-4" style={{ borderColor: "#E2E8F0", borderLeftColor: riskColors[subject.riskLevel].dot }}>
        <div className="flex items-center gap-2 mb-3">
          <AITag label="AI风险提示" />
          <RiskBadge level={subject.riskLevel} size="md" />
          <span className="text-sm font-semibold text-slate-700">综合风险评分 {subject.aiRisk}/100</span>
          <span className="text-xs text-slate-400 ml-auto">更新于 2024-07-09 10:22</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "访视合规风险", score: 85, detail: "V4已超出时间窗±7天，延误14天" },
            { label: "AE随访风险", score: 62, detail: "V3发现轻度头痛，V4尚未确认缓解状态" },
            { label: "数据质量风险", score: 40, detail: "V3体征数据填写完整，本周期数据待录入" },
          ].map((r, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">{r.label}</span>
                <span className="text-sm font-bold" style={{ color: r.score >= 75 ? "#DC2626" : r.score >= 50 ? "#D97706" : "#16A34A" }}>{r.score}</span>
              </div>
              <ProgressBar value={r.score} max={100} color={r.score >= 75 ? "#DC2626" : r.score >= 50 ? "#D97706" : "#16A34A"} />
              <p className="text-xs text-slate-500 mt-1.5">{r.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Btn variant="ai" size="sm" icon={<Zap className="w-3.5 h-3.5" />} onClick={() => openModal("ai-confirm")}>查看AI建议</Btn>
          <Btn variant="outline" size="sm">查看依据</Btn>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        <div className="p-4">
          {activeTab === "overview" && (
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">基本信息</div>
                <InfoRow label="受试者编号" value={subject.id} mono />
                <InfoRow label="研究中心" value={subject.center} />
                <InfoRow label="入组日期" value="2024-01-15" />
                <InfoRow label="年龄/性别" value="58岁 / 男" />
                <InfoRow label="诊断" value="晚期非小细胞肺癌（腺癌）" />
                <InfoRow label="ECOG评分" value="1" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">研究状态</div>
                <InfoRow label="当前状态" value={<StatusTag status={subject.status} />} />
                <InfoRow label="当前访视" value={subject.visit} />
                <InfoRow label="下次访视" value="V5 · 2024-08-06 ±7天" />
                <InfoRow label="知情状态" value={<span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">已签署</span>} />
                <InfoRow label="责任CRC" value={subject.crc} />
                <InfoRow label="主要研究者" value="王医生" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">联系方式</div>
                <InfoRow label="联系电话" value="138****6789" />
                <InfoRow label="紧急联系人" value="李** · 138****4321" />
                <InfoRow label="常住地址" value="北京市朝阳区（50km内）" />
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="text-xs font-medium text-amber-800 flex items-center gap-1 mb-1"><AlertCircle className="w-3.5 h-3.5" />待办提醒</div>
                  <div className="text-xs text-amber-700">V4访视已超窗14天，请尽快安排补救访视或记录偏差原因。</div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "visits" && (
            <div className="space-y-3">
              {[
                { v: "V1", name: "筛查访视", date: "2024-01-10", status: "completed", note: "筛查通过，符合所有入选标准" },
                { v: "V2", name: "基线访视", date: "2024-01-15", status: "completed", note: "基线数据采集完成，开始入组" },
                { v: "V3", name: "第8周访视", date: "2024-03-12", status: "completed", note: "受试者反映轻度头痛，已记录AE" },
                { v: "V4", name: "第16周访视", date: "预计2024-05-07", status: "overdue", note: "超窗14天，尚未完成" },
              ].map((v, i) => (
                <div key={i} className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${v.status === "overdue" ? "border-orange-200 bg-orange-50" : "border-slate-100 hover:border-blue-200"}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${v.status === "completed" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{v.v}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-700">{v.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{v.date}</div>
                  </div>
                  <div className="text-xs text-slate-500 flex-1">{v.note}</div>
                  {v.status === "overdue" ? (
                    <RiskBadge level="high" />
                  ) : (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">已完成</span>
                  )}
                  <Btn variant="ghost" size="sm">详情</Btn>
                </div>
              ))}
            </div>
          )}
          {activeTab === "audit" && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-1.5"><FileCheck className="w-3.5 h-3.5" />审计追踪（全部操作记录，不可删改）</div>
              <AuditTrail />
            </div>
          )}
          {(activeTab === "ae" || activeTab === "epro" || activeTab === "icf" || activeTab === "meds" || activeTab === "files" || activeTab === "ai") && (
            <EmptyState title={`${tabs.find(t => t.id === activeTab)?.label}内容`} desc="点击下方按钮查看完整记录" action={<Btn variant="secondary" size="sm">加载数据</Btn>} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REMOTE VISIT PAGE ────────────────────────────────────────
function RemoteVisitPage({ openModal }: { openModal: (m: ModalType) => void }) {
  const [noteGen, setNoteGen] = useState(false);
  const [noteReady, setNoteReady] = useState(false);

  const genNote = () => {
    setNoteGen(true);
    setTimeout(() => { setNoteGen(false); setNoteReady(true); }, 2000);
  };

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">远程访视工作台</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">会话进行中</span>
            <span className="text-xs text-slate-400">· AUR-001-003 · V4 第16周访视 · 2024-07-09 14:30</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}>发起 AE</Btn>
          <Btn variant="primary" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />} onClick={() => openModal("confirm")}>完成访视</Btn>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-[240px_1fr_280px] gap-3 min-h-0">
        {/* Left: Subject + Tasks */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
            <div className="text-xs font-semibold text-slate-500 mb-2">受试者信息</div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">李</div>
              <div>
                <div className="text-xs font-medium text-slate-700 font-mono">AUR-001-003</div>
                <div className="text-xs text-slate-400">北京协和医院</div>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">年龄</span><span className="text-slate-700">58岁 男</span></div>
              <div className="flex justify-between"><span className="text-slate-400">ECOG</span><span className="text-slate-700">1分</span></div>
              <div className="flex justify-between"><span className="text-slate-400">当前访视</span><span className="font-medium text-blue-700">V4</span></div>
              <div className="flex justify-between"><span className="text-slate-400">上次访视</span><span className="text-slate-700">V3 · 2024-03-12</span></div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 flex-1 overflow-y-auto">
            <div className="text-xs font-semibold text-slate-500 mb-2">访视任务清单</div>
            <div className="space-y-1.5">
              {[
                { task: "受试者症状问询", done: true, type: "remote" },
                { task: "用药依从性核查", done: true, type: "remote" },
                { task: "生活质量评分（ePRO）", done: false, type: "remote" },
                { task: "体征数据录入", done: false, type: "remote" },
                { task: "安全性问询", done: false, type: "remote" },
                { task: "ECG检查", done: false, type: "site" },
                { task: "血液样本采集", done: false, type: "site" },
              ].map((t, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded text-xs ${t.done ? "opacity-60" : ""}`}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${t.done ? "bg-green-500" : "border border-slate-300"}`}>
                    {t.done && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className={`flex-1 ${t.done ? "line-through text-slate-400" : "text-slate-700"}`}>{t.task}</span>
                  <span className={`px-1 py-0.5 rounded text-xs ${t.type === "remote" ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`} style={{ fontSize: "9px" }}>
                    {t.type === "remote" ? "远程" : "到院"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Video + Data */}
        <div className="flex flex-col gap-3">
          <div className="bg-slate-900 rounded-lg overflow-hidden flex-1 relative" style={{ minHeight: 280 }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3">
                  <User className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-white text-sm font-medium">受试者 AUR-001-003</div>
                <div className="text-slate-400 text-xs mt-1">视频通话中 · 45:22</div>
              </div>
            </div>
            <div className="absolute bottom-3 right-3 w-24 h-16 bg-slate-700 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-slate-500" />
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-medium">REC</span>
            </div>
            <div className="absolute bottom-3 left-3 flex gap-2">
              {["麦克风", "摄像头", "屏幕共享"].map((b, i) => (
                <button key={i} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors">{b}</button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
            <div className="text-xs font-semibold text-slate-500 mb-3">体征 & 数据录入</div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "收缩压", unit: "mmHg", value: "128", ref: "90-140" },
                { label: "舒张压", unit: "mmHg", value: "82", ref: "60-90" },
                { label: "心率", unit: "bpm", value: "74", ref: "60-100" },
                { label: "血氧", unit: "%", value: "98", ref: ">95" },
              ].map((v, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
                  <div className="text-xs text-slate-400 mb-1">{v.label}</div>
                  <input className="w-full text-center text-lg font-bold text-slate-800 bg-transparent border-b border-slate-200 outline-none focus:border-blue-400" defaultValue={v.value} />
                  <div className="text-xs text-slate-400 mt-1">{v.unit} · 参考{v.ref}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500">操作栏</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Btn variant="outline" size="sm">保存草稿</Btn>
              <Btn variant="ai" size="sm" icon={noteGen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} onClick={genNote} disabled={noteGen}>
                {noteGen ? "AI 生成中..." : "生成 AI 纪要"}
              </Btn>
              {noteReady && <Btn variant="secondary" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />} onClick={() => openModal("adopt-ai-note")}>提交研究者确认</Btn>}
              <Btn variant="outline" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}>发起 AE 报告</Btn>
            </div>
          </div>
        </div>

        {/* Right: AI Panel */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
            <div className="flex items-center gap-1.5 mb-3">
              <AITag label="AI 访视提纲" />
            </div>
            <div className="space-y-2">
              {[
                "询问上次访视以来的症状变化，重点关注头痛是否复发",
                "核查近28天用药情况及依从性，是否有漏服",
                "询问是否出现新发症状，特别是：皮疹、腹泻、口腔溃疡",
                "评估生活质量：疲劳感、食欲、睡眠质量",
                "检查是否有因头痛使用过其他药物（合并用药确认）",
              ].map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-violet-50 border border-violet-100">
                  <span className="text-xs font-bold text-violet-400 w-4 flex-shrink-0">{i + 1}.</span>
                  <span className="text-xs text-violet-800 leading-relaxed">{q}</span>
                </div>
              ))}
            </div>
          </div>

          {noteReady && (
            <div className="bg-white rounded-lg p-3 shadow-sm border border-violet-200">
              <div className="flex items-center gap-1.5 mb-3">
                <AITag label="AI 访视纪要草稿" />
                <span className="text-xs text-slate-400">刚刚生成</span>
              </div>
              <div className="text-xs text-slate-700 leading-relaxed bg-violet-50 p-3 rounded border border-violet-100">
                受试者AUR-001-003于本次V4访视中报告：上次访视发生的轻度头痛未再复发（NCI CTCAE 1级，已缓解）。过去28天用药依从性良好，无漏服。未出现皮疹、腹泻等新发不良反应。体征平稳。
              </div>
              <Btn variant="ai" size="sm" className="mt-2 w-full justify-center" onClick={() => openModal("adopt-ai-note")}>
                <Zap className="w-3.5 h-3.5" />提交研究者确认
              </Btn>
            </div>
          )}

          <div className="bg-white rounded-lg p-3 shadow-sm border border-orange-200">
            <div className="flex items-center gap-1.5 mb-2">
              <AITag label="AI 潜在AE提示" />
              <RiskBadge level="medium" />
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">
              受试者本次提及头痛，结合历史记录（V3访视也有报告），AI建议：<span className="font-medium text-orange-600">主动评估头痛严重程度、持续时间及是否与服药时间相关</span>，判断是否需升级AE报告级别。
            </div>
            <div className="flex gap-2 mt-2">
              <Btn variant="outline" size="sm" className="flex-1">忽略</Btn>
              <Btn variant="danger" size="sm" className="flex-1" icon={<AlertTriangle className="w-3 h-3" />}>记录 AE</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AE/SAE PAGE ──────────────────────────────────────────────
function AESAEPage({ openModal }: { openModal: (m: ModalType) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-800">AE/SAE 安全事件详情</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200">SAE · 紧急</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">事件编号：AE-20240709-002 · 受试者：AUR-002-007 · 上报人：李明远 CRC</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="danger" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5" />}>紧急上报 IRB</Btn>
          <Btn variant="primary" size="sm" icon={<FileCheck className="w-3.5 h-3.5" />} onClick={() => openModal("confirm")}>研究者签署确认</Btn>
        </div>
      </div>

      {/* Deadline Banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
        <Clock className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-red-800">SAE 报告时限倒计时</div>
          <div className="text-xs text-red-600">根据 ICH E6(R2) 要求，SAE 须在发现后 24 小时内向申办方报告。</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-red-600 font-mono">03:42:17</div>
          <div className="text-xs text-red-500">剩余时间</div>
        </div>
        <Btn variant="danger" size="sm">立即提交报告</Btn>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Main Info */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="text-sm font-semibold text-slate-700 mb-3">事件概要</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <InfoRow label="事件名称" value="急性过敏反应" />
              <InfoRow label="发生日期" value="2024-07-08 21:30" />
              <InfoRow label="严重程度" value={<span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700">SAE · Grade 3</span>} />
              <InfoRow label="相关性判断" value={<span className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700">可能相关</span>} />
              <InfoRow label="当前状态" value={<span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">持续中</span>} />
              <InfoRow label="处理措施" value="暂停给药，抗过敏治疗" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="text-sm font-semibold text-slate-700 mb-3">受试者描述</div>
            <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded">
              受试者AUR-002-007于2024-07-08 21:30服用第224天研究药物约2小时后出现全身荨麻疹，伴面部及喉部轻微水肿感，无呼吸困难，无意识障碍。就近于上海瑞金医院急诊就诊，予静脉注射地塞米松5mg及苯海拉明，约3小时后皮疹消退，水肿感缓解，留观至次日出院。
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-700">随访记录</div>
              <Btn variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>新增随访</Btn>
            </div>
            <div className="space-y-2">
              {[
                { date: "2024-07-09 09:00", content: "CRC电话随访：受试者已出院，皮疹完全消退，无不适。已通知研究者。", by: "李明远 CRC" },
                { date: "2024-07-09 10:30", content: "研究者评估：判定为Grade 3过敏反应，与研究药物可能相关，暂停给药等待安全审查。", by: "刘医生 (Sub-I)" },
              ].map((f, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">{f.date}</span>
                    <span className="text-xs text-blue-600 font-medium">{f.by}</span>
                  </div>
                  <p className="text-xs text-slate-700">{f.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          <AISuggestionCard
            title="AI 风险提示"
            content="该SAE（Grade 3过敏反应）属于已知靶向药物严重不良反应范围。AI建议：1) 立即通知申办方安全监察部门；2) 参照方案§8.3提交SAE报告；3) 评估是否需要永久停药；4) 通知DSMB（数据安全监察委员会）。"
            source="方案§7.4 + 同类药物安全性数据库"
            onConfirm={() => openModal("ai-confirm")}
          />

          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="text-sm font-semibold text-slate-700 mb-3">研究者判断</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500">严重程度</label>
                <div className="mt-1 flex gap-1.5">
                  {["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"].map((g, i) => (
                    <button key={i} className={`px-2 py-1 text-xs rounded border transition-colors ${g === "Grade 3" ? "bg-red-600 text-white border-red-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">与研究药物相关性</label>
                <div className="mt-1 flex gap-1.5 flex-wrap">
                  {["肯定相关", "可能相关", "可能无关", "肯定无关", "无法判断"].map((r, i) => (
                    <button key={i} className={`px-2 py-1 text-xs rounded border transition-colors ${r === "可能相关" ? "bg-orange-500 text-white border-orange-500" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="text-sm font-semibold text-slate-700 mb-2">审计追踪</div>
            <AuditTrail items={AUDIT_LOGS.slice(0, 3)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RISK MONITOR PAGE ────────────────────────────────────────
function RiskMonitorPage({ openModal }: { openModal: (m: ModalType) => void }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<typeof RISK_ITEMS[0] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-800">AI 风险监查看板</h1>
            <AITag label="实时监控" />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">最后更新：2024-07-09 14:45 · 规则引擎 v2.3 + 大模型综合分析</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}>手动刷新</Btn>
          <Btn variant="ai" size="sm" icon={<Zap className="w-3.5 h-3.5" />}>生成风险报告</Btn>
        </div>
      </div>

      {/* Risk Overview */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "紧急风险", count: 1, level: "critical" as RiskLevel, desc: "需立即处理" },
          { label: "高风险", count: 2, level: "high" as RiskLevel, desc: "24h内处理" },
          { label: "中风险", count: 2, level: "medium" as RiskLevel, desc: "本周内处理" },
          { label: "低风险", count: 1, level: "low" as RiskLevel, desc: "关注观察" },
        ].map((r, i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="w-3 h-10 rounded-full" style={{ background: riskColors[r.level].dot }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: riskColors[r.level].text }}>{r.count}</div>
              <div className="text-xs font-medium text-slate-600">{r.label}</div>
              <div className="text-xs text-slate-400">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Risk Trend */}
        <div className="col-span-2 bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-700 mb-3">风险趋势（近6个月）</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={RISK_TREND} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #E2E8F0", borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="critical" name="紧急" fill="#DC2626" radius={[2,2,0,0]} />
              <Bar dataKey="high" name="高风险" fill="#EA580C" radius={[2,2,0,0]} />
              <Bar dataKey="medium" name="中风险" fill="#D97706" radius={[2,2,0,0]} />
              <Bar dataKey="low" name="低风险" fill="#16A34A" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Center Risk */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-700 mb-3">中心风险排行</div>
          <div className="space-y-3">
            {CENTER_RISK.map((c, i) => (
              <div key={i} className="p-3 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">{c.center}</span>
                  <span className="text-sm font-bold" style={{ color: c.score > 75 ? "#DC2626" : c.score > 55 ? "#EA580C" : "#16A34A" }}>{c.score}</span>
                </div>
                <ProgressBar value={c.score} max={100} color={c.score > 75 ? "#DC2626" : c.score > 55 ? "#EA580C" : "#16A34A"} />
                <div className="flex gap-2 mt-1.5">
                  {c.critical > 0 && <span className="text-xs text-red-600">{c.critical} 紧急</span>}
                  {c.high > 0 && <span className="text-xs text-orange-500">{c.high} 高风险</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-3 border-b border-slate-100 flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">风险明细列表</span>
          <Btn variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />}>筛选</Btn>
          <div className="ml-auto flex gap-2">
            <Btn variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => openModal("export-confirm")}>导出</Btn>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["风险等级", "风险类型", "风险对象", "触发原因", "AI建议动作", "责任人", "截止时间", "处理状态", "操作"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RISK_ITEMS.map((r, i) => (
                <tr key={i}
                  className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${r.level === "critical" ? "bg-red-50/50" : ""}`}
                  onClick={() => { setSelectedRisk(r); setDrawerOpen(true); }}>
                  <td className="px-3 py-2.5"><RiskBadge level={r.level} /></td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{r.type}</td>
                  <td className="px-3 py-2.5 font-mono text-blue-700">{r.object}</td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate">{r.trigger}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 text-violet-700">
                      <Zap className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{r.suggestion}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{r.owner}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{r.deadline}</td>
                  <td className="px-3 py-2.5"><StatusTag status={r.status} /></td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Btn variant="ghost" size="sm">处理</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => openModal("close-alert")}>关闭</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="风险详情">
        {selectedRisk && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RiskBadge level={selectedRisk.level} size="md" />
              <span className="text-sm font-semibold text-slate-700">{selectedRisk.type}</span>
            </div>
            <InfoRow label="风险对象" value={selectedRisk.object} mono />
            <InfoRow label="触发原因" value={selectedRisk.trigger} />
            <InfoRow label="责任人" value={selectedRisk.owner} />
            <InfoRow label="截止时间" value={selectedRisk.deadline} mono />
            <InfoRow label="当前状态" value={<StatusTag status={selectedRisk.status} />} />
            <AISuggestionCard
              title="AI 建议动作"
              content={selectedRisk.suggestion}
              source="风险规则引擎 v2.3"
              onConfirm={() => openModal("ai-confirm")}
            />
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500">处理操作</div>
              <Btn variant="primary" size="sm" className="w-full justify-center">标记处理中</Btn>
              <Btn variant="outline" size="sm" className="w-full justify-center">关闭风险项</Btn>
              <Btn variant="ghost" size="sm" className="w-full justify-center text-red-500" onClick={() => openModal("high-risk-confirm")}>强制关闭（高风险）</Btn>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ─── ECONSENT PAGE ────────────────────────────────────────────
function EConsentPage({ openModal }: { openModal: (m: ModalType) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">电子知情管理</h1>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>发起再知情任务</Btn>
          <Btn variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" />}>上传新版 ICF</Btn>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KPICard title="ICF 当前版本" value="v3.0" sub="2024-05-15生效" icon={<FileText className="w-4 h-4" />} color="#0B4DA2" />
        <KPICard title="已签署人数" value="7/8" sub="完成率 87.5%" icon={<UserCheck className="w-4 h-4" />} color="#16A34A" />
        <KPICard title="理解度测试通过" value="6/7" sub="1人需重新测试" icon={<ClipboardCheck className="w-4 h-4" />} color="#6B52D9" />
        <KPICard title="待完成再知情" value="1" sub="AUR-002-014" icon={<AlertCircle className="w-4 h-4" />} color="#EA580C" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <SectionHeader title="受试者签署列表" />
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["受试者", "签署版本", "签署日期", "理解度测试", "再知情状态"].map(h => (
                  <th key={h} className="text-left px-2 py-2 font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUBJECTS.map((s, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-2 py-2 font-mono text-blue-700">{s.id}</td>
                  <td className="px-2 py-2 text-slate-600">v{s.icf === "未签署" ? "—" : "3.0"}</td>
                  <td className="px-2 py-2 text-slate-500">{s.icf === "未签署" ? "—" : "2024-0" + (i + 1) + "-15"}</td>
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${s.icf === "已签署" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                      {s.icf === "已签署" ? "通过" : "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${s.icf === "再知情待签" ? "bg-orange-50 text-orange-600" : s.icf === "未签署" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{s.icf}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <AISuggestionCard
            title="AI 通俗解释卡（v3.0 ICF）"
            content="这份知情同意书是关于一项肺癌治疗新药的研究。您参与后，将服用一种实验性药物，每4周进行一次检查。研究可能对您有帮助，但也可能产生副作用（如头痛、皮疹等），所有副作用都会被记录和治疗。您可以随时退出，不影响您的正常治疗。"
            source="GPT-4o基于ICF v3.0生成，经研究者审核"
            onConfirm={() => openModal("ai-confirm")}
          />
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="text-sm font-semibold text-slate-700 mb-3">ICF 版本历史</div>
            {[
              { ver: "v3.0", date: "2024-05-15", change: "更新药物剂量信息和肝功能监测要求", status: "当前版本" },
              { ver: "v2.1", date: "2024-02-01", change: "增加远程访视知情条款", status: "历史版本" },
              { ver: "v2.0", date: "2023-10-12", change: "初始版本", status: "历史版本" },
            ].map((v, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${v.status === "当前版本" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>{v.ver}</span>
                <div className="flex-1">
                  <div className="text-xs text-slate-600">{v.change}</div>
                  <div className="text-xs text-slate-400">{v.date}</div>
                </div>
                <Btn variant="ghost" size="sm" icon={<Eye className="w-3 h-3" />}>查看</Btn>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EPRO PAGE ────────────────────────────────────────────────
function EPROPage({ openModal }: { openModal: (m: ModalType) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">ePRO / eCOA 管理</h1>
        <Btn variant="ai" size="sm" icon={<Zap className="w-3.5 h-3.5" />}>AI 异常分析</Btn>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <KPICard title="本周完成率" value="82%" sub="134/163 问卷" trend="-2% vs 上周" icon={<ClipboardList className="w-4 h-4" />} color="#0B4DA2" />
        <KPICard title="缺失次数" value="29" sub="本月累计" trend="+5 vs 上月" icon={<XCircle className="w-4 h-4" />} color="#DC2626" />
        <KPICard title="异常答案" value="7" sub="AI识别异常填报" icon={<AlertCircle className="w-4 h-4" />} color="#D97706" />
        <KPICard title="平均完成时长" value="8.3min" sub="每份问卷" trend="-1.2min" trendUp icon={<Clock className="w-4 h-4" />} color="#16A34A" />
      </div>

      <AISuggestionCard
        title="AI 异常识别报告"
        content="本周检测到7处异常填报：受试者AUR-003-009连续3次在'疲劳程度'评分0（最轻），但同周ePRO'日常活动受限'评分却为8（较重），存在逻辑矛盾，建议CRC核实。另有2位受试者提交时间集中在凌晨2-4点，建议关注填报真实性。"
        source="AI问卷异常检测模块 v1.2"
        onConfirm={() => openModal("ai-confirm")}
      />

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-3 border-b border-slate-100 flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">问卷填写记录</span>
          <Btn variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />}>筛选</Btn>
          <Btn variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => openModal("export-confirm")}>导出</Btn>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["受试者", "问卷类型", "应填日期", "实际提交", "完成状态", "完成时长", "AI异常标记", "操作"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { sub: "AUR-001-003", type: "QoL-FACT-L", due: "2024-07-08", submitted: "2024-07-08 19:32", status: "completed", dur: "9.2min", ai: false },
              { sub: "AUR-002-007", type: "CTCAE-PRO", due: "2024-07-08", submitted: "2024-07-08 21:45", status: "completed", dur: "6.8min", ai: true },
              { sub: "AUR-003-009", type: "QoL-FACT-L", due: "2024-07-07", submitted: "—", status: "missing", dur: "—", ai: false },
              { sub: "AUR-002-014", type: "CTCAE-PRO", due: "2024-07-09", submitted: "进行中", status: "pending", dur: "—", ai: false },
              { sub: "AUR-001-011", type: "QoL-FACT-L", due: "2024-07-09", submitted: "—", status: "pending", dur: "—", ai: false },
            ].map((r, i) => (
              <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${r.ai ? "bg-orange-50/30" : ""}`}>
                <td className="px-3 py-2.5 font-mono text-blue-700">{r.sub}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.type}</td>
                <td className="px-3 py-2.5 font-mono text-slate-500">{r.due}</td>
                <td className="px-3 py-2.5 font-mono text-slate-500">{r.submitted}</td>
                <td className="px-3 py-2.5"><StatusTag status={r.status} /></td>
                <td className="px-3 py-2.5 text-slate-500">{r.dur}</td>
                <td className="px-3 py-2.5">{r.ai ? <AITag label="AI异常" /> : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5"><Btn variant="ghost" size="sm">查看</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DRUGS PAGE ───────────────────────────────────────────────
function DrugsPage({ openModal }: { openModal: (m: ModalType) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">药品与样本管理</h1>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>新建配送单</Btn>
          <Btn variant="outline" size="sm" icon={<FlaskConical className="w-3.5 h-3.5" />}>登记样本</Btn>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KPICard title="在途配送单" value="3" sub="2中心待签收" icon={<Truck className="w-4 h-4" />} color="#0B4DA2" />
        <KPICard title="冷链异常" value="1" sub="上海瑞金医院" icon={<Thermometer className="w-4 h-4" />} color="#DC2626" />
        <KPICard title="用药依从性" value="93%" sub="全部受试者均值" icon={<Activity className="w-4 h-4" />} color="#16A34A" />
        <KPICard title="样本待运输" value="4" sub="已采集未运送" icon={<FlaskConical className="w-4 h-4" />} color="#D97706" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <SectionHeader title="药品配送状态" actions={<Btn variant="ghost" size="sm">查看全部</Btn>} />
          <div className="space-y-2">
            {[
              { id: "SHP-001", center: "北京协和医院", drug: "AUR-003 · 批号B240612", qty: "30粒×2", status: "delivered", temp: "正常", date: "2024-07-05" },
              { id: "SHP-002", center: "上海瑞金医院", drug: "AUR-003 · 批号B240612", qty: "30粒×3", status: "in-transit", temp: "异常", date: "2024-07-08" },
              { id: "SHP-003", center: "广州南方医院", drug: "AUR-003 · 批号B240612", qty: "30粒×2", status: "pending", temp: "—", date: "2024-07-10" },
            ].map((s, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${s.temp === "异常" ? "border-red-200 bg-red-50/30" : "border-slate-100 hover:border-blue-200"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-blue-700">{s.id}</span>
                    <span className="text-xs text-slate-500">{s.center}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.drug} · {s.qty}</div>
                </div>
                <div className="flex items-center gap-2">
                  {s.temp === "异常" && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600 flex items-center gap-1">
                      <Thermometer className="w-3 h-3" />温度异常
                    </span>
                  )}
                  <StatusTag status={s.status === "delivered" ? "completed" : s.status === "in-transit" ? "processing" : "pending"} />
                </div>
                <Btn variant="ghost" size="sm">详情</Btn>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <SectionHeader title="样本管理" />
          <div className="space-y-2">
            {[
              { id: "SAM-001", sub: "AUR-001-003", type: "血清", visit: "V4", collected: "2024-07-09", status: "pending", note: "待运输至中心实验室" },
              { id: "SAM-002", sub: "AUR-002-007", type: "PBMC", visit: "V6", collected: "2024-07-08", status: "in-transit", note: "已发出，在途" },
              { id: "SAM-003", sub: "AUR-003-002", type: "血清", visit: "V8", collected: "2024-07-07", status: "completed", note: "已接收，入库" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                <FlaskConical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-700">{s.id} · <span className="font-mono text-blue-700">{s.sub}</span></div>
                  <div className="text-xs text-slate-400">{s.type} · {s.visit} · {s.collected}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.note}</div>
                </div>
                <StatusTag status={s.status === "in-transit" ? "processing" : s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────
function ReportsPage({ openModal }: { openModal: (m: ModalType) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">报告中心</h1>
          <div className="flex items-center gap-2 mt-0.5"><AITag label="AI自动生成" /><span className="text-xs text-slate-400">报告经 AI 草拟，需研究者确认后正式归档</span></div>
        </div>
        <Btn variant="ai" size="sm" icon={<Zap className="w-3.5 h-3.5" />}>立即生成日报</Btn>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { type: "AI 项目日报", date: "2024-07-09 06:00 自动生成", desc: "入组120人，今日3次访视，1项新增AE，风险评分平均58分。建议关注上海瑞金医院SAE处理情况。", confirmed: false, source: "系统数据 + 大模型综合分析" },
          { type: "AI 周报（第28周）", date: "2024-07-07 自动生成", desc: "本周完成访视12次，ePRO完成率82%，新增AE 2项，入组净增8人。无新发SAE。中心风险评分整体下降。", confirmed: true, source: "系统数据聚合" },
          { type: "中心风险报告", date: "2024-07-08 系统触发", desc: "上海瑞金医院风险等级升至高风险（82分）。主要驱动因素：SAE未处理、药品超温、访视超窗。建议CRA尽快现场稽查。", confirmed: false, source: "AI风险引擎 v2.3" },
          { type: "数据质量报告", date: "2024-07-05 周期生成", desc: "数据录入完整率94.3%，缺失主要集中在体征数据（V4）。EDC填写逻辑错误2处，已触发质疑。", confirmed: true, source: "EDC数据质量监控" },
        ].map((r, i) => (
          <div key={i} className={`bg-white rounded-lg p-4 shadow-sm border transition-colors ${r.confirmed ? "border-slate-100" : "border-violet-200"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{r.type}</span>
                  {!r.confirmed && <AITag label="待确认" />}
                  {r.confirmed && <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">已确认</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{r.date}</div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">{r.desc}</p>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400 flex-1">数据来源：{r.source}</span>
              {!r.confirmed && <Btn variant="ai" size="sm" icon={<Check className="w-3 h-3" />} onClick={() => openModal("ai-confirm")}>人工确认</Btn>}
              <Btn variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => openModal("export-confirm")}>导出</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DOCUMENTS PAGE ───────────────────────────────────────────
function DocumentsPage({ openModal }: { openModal: (m: ModalType) => void }) {
  const [activeTab, setActiveTab] = useState("docs");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">文档与稽查</h1>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" icon={<Upload className="w-3.5 h-3.5" />}>上传文档</Btn>
          <Btn variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => openModal("export-confirm")}>导出中心</Btn>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <Tabs tabs={[
          { id: "docs", label: "文档分类" }, { id: "versions", label: "版本记录" },
          { id: "signatures", label: "签署记录" }, { id: "ai-outputs", label: "AI输出记录" },
          { id: "audit", label: "完整审计日志" },
        ]} active={activeTab} onChange={setActiveTab} />
        <div className="p-4">
          {activeTab === "docs" && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { cat: "方案文件", count: 3, icon: <FileText className="w-4 h-4" />, color: "#0B4DA2" },
                { cat: "知情同意书", count: 5, icon: <FileCheck className="w-4 h-4" />, color: "#16A34A" },
                { cat: "研究者手册", count: 2, icon: <FolderOpen className="w-4 h-4" />, color: "#6B52D9" },
                { cat: "伦理批件", count: 4, icon: <Shield className="w-4 h-4" />, color: "#D97706" },
                { cat: "访视记录表", count: 48, icon: <ClipboardList className="w-4 h-4" />, color: "#EA580C" },
                { cat: "SAE 报告", count: 2, icon: <AlertTriangle className="w-4 h-4" />, color: "#DC2626" },
              ].map((c, i) => (
                <button key={i} className="flex items-center gap-3 p-4 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: c.color }}>
                    {c.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700">{c.cat}</div>
                    <div className="text-xs text-slate-400">{c.count} 份文件</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                </button>
              ))}
            </div>
          )}
          {activeTab === "audit" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700">
                <Shield className="w-3.5 h-3.5" />
                审计日志符合 21 CFR Part 11 要求，所有记录不可删改，具有完整时间戳和操作人信息。
              </div>
              <AuditTrail items={[...AUDIT_LOGS, ...AUDIT_LOGS]} />
            </div>
          )}
          {(activeTab === "versions" || activeTab === "signatures" || activeTab === "ai-outputs") && (
            <EmptyState title={`${activeTab === "versions" ? "版本记录" : activeTab === "signatures" ? "签署记录" : "AI输出记录"}`} desc="选择具体文档类别查看详情" action={<Btn variant="secondary" size="sm">浏览文档</Btn>} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI CONFIG PAGE ───────────────────────────────────────────
function AIConfigPage({ openModal }: { openModal: (m: ModalType) => void }) {
  const [activeTab, setActiveTab] = useState("capabilities");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-800">AI 中台配置</h1>
            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "#EDE9FE", color: "#5B21B6" }}>管理员</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">管理AI能力开关、知识库、提示词模板、模型配置和风险规则</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <Tabs tabs={[
          { id: "capabilities", label: "AI能力列表" }, { id: "knowledge", label: "知识库" },
          { id: "prompts", label: "提示词模板" }, { id: "models", label: "模型配置" },
          { id: "rules", label: "风险规则配置" }, { id: "logs", label: "调用日志" },
        ]} active={activeTab} onChange={setActiveTab} />
        <div className="p-4">
          {activeTab === "capabilities" && (
            <div className="space-y-2">
              {[
                { name: "AI 方案解析", desc: "自动解析临床试验方案，提取入排标准、访视计划、风险点", model: "GPT-4o", enabled: true, calls: 1240 },
                { name: "AI 风险监查", desc: "实时监控受试者风险，基于规则引擎+大模型综合评分", model: "Claude 3.5 Sonnet", enabled: true, calls: 8920 },
                { name: "AI 访视纪要生成", desc: "基于访视录音转录自动生成访视纪要草稿", model: "Whisper + GPT-4o", enabled: true, calls: 234 },
                { name: "AI ePRO 异常识别", desc: "识别问卷填写中的逻辑矛盾和异常模式", model: "Claude 3.5 Haiku", enabled: true, calls: 4500 },
                { name: "AI 报告生成", desc: "自动生成项目日报、周报、中心风险报告", model: "GPT-4o", enabled: true, calls: 156 },
                { name: "AI ICF 通俗化", desc: "将专业知情同意书内容转化为通俗语言", model: "Claude 3.5 Sonnet", enabled: false, calls: 0 },
              ].map((cap, i) => (
                <div key={i} className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${cap.enabled ? "border-slate-100 hover:border-blue-200" : "border-slate-100 bg-slate-50"}`}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cap.enabled ? "linear-gradient(135deg, #6B52D9, #3B8BF5)" : "#E2E8F0" }}>
                    <Zap className={`w-4 h-4 ${cap.enabled ? "text-white" : "text-slate-400"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{cap.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "#F1F5F9", color: "#64748B" }}>{cap.model}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{cap.desc}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium text-slate-600">{cap.calls.toLocaleString()}</div>
                    <div className="text-xs text-slate-400">本月调用</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn variant="ghost" size="sm" icon={<Edit className="w-3 h-3" />}>配置</Btn>
                    <button className={`w-10 h-5 rounded-full transition-colors relative ${cap.enabled ? "bg-blue-600" : "bg-slate-200"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${cap.enabled ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "rules" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">当前启用风险规则</span>
                <Btn variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>新建规则</Btn>
              </div>
              {[
                { id: "R-001", name: "SAE报告超时", condition: "SAE发生后 > 24h 未提交报告", level: "critical" as RiskLevel, active: true },
                { id: "R-002", name: "访视超窗", condition: "访视时间超出方案时间窗 > 7天", level: "high" as RiskLevel, active: true },
                { id: "R-003", name: "再知情缺失", condition: "方案修订后7日内未完成再知情", level: "high" as RiskLevel, active: true },
                { id: "R-004", name: "ePRO连续缺失", condition: "连续3次ePRO未按时填写", level: "medium" as RiskLevel, active: true },
                { id: "R-005", name: "冷链温度异常", condition: "冷链记录温度超出范围 > 2小时", level: "medium" as RiskLevel, active: true },
              ].map((rule, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                  <span className="text-xs font-mono text-slate-400 w-14">{rule.id}</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-700">{rule.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{rule.condition}</div>
                  </div>
                  <RiskBadge level={rule.level} />
                  <Btn variant="ghost" size="sm" icon={<Edit className="w-3 h-3" />}>编辑</Btn>
                </div>
              ))}
            </div>
          )}
          {(activeTab === "knowledge" || activeTab === "prompts" || activeTab === "models" || activeTab === "logs") && (
            <EmptyState title={`${activeTab === "knowledge" ? "知识库管理" : activeTab === "prompts" ? "提示词模板" : activeTab === "models" ? "模型配置" : "调用日志"}`} desc="请联系系统管理员配置此功能" action={<Btn variant="secondary" size="sm">联系管理员</Btn>} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────
function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">系统设置</h1>
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: "用户与权限管理", desc: "管理用户账号、角色分配、中心权限", icon: <User className="w-5 h-5" /> },
          { title: "通知与消息设置", desc: "配置邮件、短信、系统消息通知规则", icon: <Bell className="w-5 h-5" /> },
          { title: "合规与审计配置", desc: "21 CFR Part 11、GCP合规设置", icon: <Shield className="w-5 h-5" /> },
          { title: "数据安全与备份", desc: "数据加密、定期备份、访问日志", icon: <Lock className="w-5 h-5" /> },
        ].map((s, i) => (
          <button key={i} className="flex items-center gap-4 p-5 bg-white rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-colors text-left shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">{s.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-700">{s.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN LAYOUT + APP ────────────────────────────────────────
function MainLayout({ page, setPage, openModal, children }: {
  page: Page; setPage: (p: Page) => void; openModal: (m: ModalType) => void; children: React.ReactNode;
}) {
  return (
    <div className="w-full h-screen flex overflow-hidden bg-background" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={setPage} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar page={page} setPage={setPage} openModal={openModal} />
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [modal, setModal] = useState<ModalType>(null);

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  const pageProps = { setPage, openModal: setModal };

  const pages: Record<Page, React.ReactNode> = {
    login: null,
    dashboard: <DashboardPage {...pageProps} />,
    protocol: <ProtocolPage openModal={setModal} />,
    subjects: <SubjectsPage {...pageProps} />,
    "subject-detail": <SubjectDetailPage {...pageProps} />,
    econsent: <EConsentPage openModal={setModal} />,
    "remote-visit": <RemoteVisitPage openModal={setModal} />,
    epro: <EPROPage openModal={setModal} />,
    "ae-sae": <AESAEPage openModal={setModal} />,
    "risk-monitor": <RiskMonitorPage openModal={setModal} />,
    drugs: <DrugsPage openModal={setModal} />,
    reports: <ReportsPage openModal={setModal} />,
    documents: <DocumentsPage openModal={setModal} />,
    "ai-config": <AIConfigPage openModal={setModal} />,
    settings: <SettingsPage />,
  };

  return (
    <>
      <MainLayout page={page} setPage={setPage} openModal={setModal}>
        {pages[page]}
      </MainLayout>
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        type={modal}
        onConfirm={() => setModal(null)}
      />
    </>
  );
}
