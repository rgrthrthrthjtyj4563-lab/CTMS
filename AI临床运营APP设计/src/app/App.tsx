import { useState } from "react";
import {
  Mic, Camera, Paperclip, ChevronRight, ChevronLeft,
  AlertTriangle, Clock, FileText, X, MapPin, Calendar,
  User, Building2, Bell, Edit3, Trash2, Eye, AlertCircle,
  Check, Shield, Home, ClipboardList, MessageSquare, Image,
  ChevronDown, Loader2, LogOut, MoreHorizontal, ArrowRight,
  ScanLine, Square, Play, Link2, TrendingUp, Zap,
  CheckCircle2, Info, Plus, WifiOff
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type ScreenId =
  | "login" | "workbench" | "imv-brief" | "imv-active"
  | "voice" | "action-pack" | "action-edit" | "confirm"
  | "todo" | "issue" | "hours" | "qa-review";

// ── Shared UI components ──────────────────────────────────────────────────────

function StatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? "text-white/80" : "text-gray-800";
  return (
    <div className={`flex items-center justify-between px-5 pt-3 pb-1.5 text-[13px] font-semibold flex-none ${c}`}>
      <span>9:41</span>
      <div className="flex items-center gap-[6px]">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="4" width="3" height="7" rx="0.6" opacity="0.4"/>
          <rect x="4.5" y="2.5" width="3" height="8.5" rx="0.6" opacity="0.6"/>
          <rect x="9" y="1" width="3" height="10" rx="0.6" opacity="0.8"/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.6"/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
          <path d="M7.5 2.2C9.7 2.2 11.7 3.1 13.1 4.6L14.4 3.2C12.6 1.2 10.2 0 7.5 0 4.8 0 2.4 1.2 0.6 3.2L1.9 4.6C3.3 3.1 5.3 2.2 7.5 2.2Z" opacity="0.5"/>
          <path d="M7.5 5.1C9 5.1 10.3 5.7 11.2 6.7L12.5 5.3C11.2 3.9 9.5 3 7.5 3 5.5 3 3.8 3.9 2.5 5.3L3.8 6.7C4.7 5.7 6 5.1 7.5 5.1Z" opacity="0.75"/>
          <circle cx="7.5" cy="9.5" r="1.5"/>
        </svg>
        <div className="flex items-center gap-[2px]">
          <div className="w-[22px] h-[11px] rounded-[2.5px] border-[1.5px] border-current flex items-center p-[1.5px]">
            <div className="h-full bg-current rounded-[1px]" style={{ width: "82%" }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

type TagStatus = "draft" | "pending" | "risk" | "done" | "info" | "warning";
function Tag({ status, label }: { status: TagStatus; label: string }) {
  const map: Record<TagStatus, { dot: string; wrap: string }> = {
    draft:   { dot: "bg-sky-400",     wrap: "bg-sky-50 text-sky-700 border-sky-200" },
    pending: { dot: "bg-amber-400",   wrap: "bg-amber-50 text-amber-700 border-amber-200" },
    risk:    { dot: "bg-red-500",     wrap: "bg-red-50 text-red-700 border-red-200" },
    done:    { dot: "bg-emerald-500", wrap: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    info:    { dot: "bg-gray-400",    wrap: "bg-gray-50 text-gray-600 border-gray-200" },
    warning: { dot: "bg-orange-400",  wrap: "bg-orange-50 text-orange-700 border-orange-200" },
  };
  const { dot, wrap } = map[status];
  return (
    <span className={`inline-flex items-center gap-[5px] px-2 py-[3px] rounded border text-[10.5px] font-medium leading-none ${wrap}`}>
      <span className={`w-[5px] h-[5px] rounded-full flex-none ${dot}`}/>
      {label}
    </span>
  );
}

function BottomNav({ active, nav }: { active: "workbench"|"todo"|"mine"; nav: (s: ScreenId) => void }) {
  const tabs = [
    { key: "workbench" as const, label: "工作台", Icon: Home,         to: "workbench" as ScreenId },
    { key: "todo"      as const, label: "待办",   Icon: ClipboardList,to: "todo"      as ScreenId },
    { key: "mine"      as const, label: "我的",   Icon: User,         to: "hours"     as ScreenId },
  ];
  return (
    <div className="flex-none bg-white border-t border-gray-100">
      <div className="flex pb-5">
        {tabs.map(({ key, label, Icon, to }) => {
          const on = active === key;
          return (
            <button key={key} onClick={() => nav(to)}
              className={`flex-1 flex flex-col items-center gap-[3px] pt-3 transition-colors ${on ? "text-[#0B7070]" : "text-gray-400"}`}>
              <Icon size={21} strokeWidth={on ? 2.2 : 1.6}/>
              <span className="text-[10.5px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Screen: Login ─────────────────────────────────────────────────────────────

function LoginScreen({ nav }: { nav: (s: ScreenId) => void }) {
  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      <StatusBar/>
      <div className="flex-1 flex flex-col px-6 pt-10 pb-8">
        {/* Logo mark */}
        <div className="mb-10">
          <div className="w-11 h-11 bg-[#0B7070] rounded-[9px] flex items-center justify-center mb-4 shadow-md shadow-[#0B7070]/25">
            <Zap size={21} className="text-white" strokeWidth={2.2}/>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">AI临床运营</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">协同平台 · 专业版</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">手机号 / 工号</label>
            <input defaultValue="13800138001"
              className="w-full h-11 bg-gray-50 rounded-[6px] border border-gray-200 px-3.5 text-[15px] text-gray-900 outline-none focus:border-[#0B7070] focus:bg-white transition-colors"/>
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">密码</label>
            <input type="password" defaultValue="password"
              className="w-full h-11 bg-gray-50 rounded-[6px] border border-gray-200 px-3.5 text-[15px] text-gray-900 outline-none focus:border-[#0B7070] focus:bg-white transition-colors"/>
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">所属组织</label>
            <div className="relative">
              <select defaultValue="qm"
                className="w-full h-11 bg-gray-50 rounded-[6px] border border-gray-200 px-3.5 pr-8 text-[15px] text-gray-900 outline-none appearance-none focus:border-[#0B7070]">
                <option value="qm">启明医药CRO</option>
                <option value="aj">安健制药（申办方）</option>
                <option value="hs">华山医学研究SMO</option>
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
          </div>
        </div>

        <button onClick={() => nav("workbench")}
          className="mt-8 w-full h-12 bg-[#0B7070] text-white rounded-[6px] text-[15px] font-semibold tracking-wide active:opacity-90">
          登录
        </button>
        <div className="mt-4 flex justify-between">
          <button className="text-[13px] text-[#0B7070]">忘记密码</button>
          <button className="text-[13px] text-[#0B7070]">扫码登录</button>
        </div>
      </div>
      <div className="px-6 pb-10 text-center text-[11px] text-gray-400">v2.6.1 · 服务协议 · 隐私政策</div>
    </div>
  );
}

// ── Screen: Workbench ─────────────────────────────────────────────────────────

function WorkbenchScreen({ nav }: { nav: (s: ScreenId) => void }) {
  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      {/* Header */}
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <button className="flex items-center gap-1.5 bg-gray-50 rounded-[6px] px-2.5 py-[7px] border border-gray-200 max-w-[230px]">
              <Building2 size={12} className="text-gray-500 flex-none"/>
              <span className="text-[12px] font-semibold text-gray-800 truncate">启明医药CRO</span>
              <span className="text-gray-300 mx-0.5 flex-none">·</span>
              <span className="text-[12px] text-gray-500 truncate">AJ-001研究</span>
              <ChevronDown size={12} className="text-gray-400 ml-0.5 flex-none"/>
            </button>
            <div className="flex items-center gap-2.5">
              <button className="relative p-0.5">
                <Bell size={19} strokeWidth={1.7} className="text-gray-600"/>
                <span className="absolute top-0 right-0 w-[15px] h-[15px] bg-red-500 rounded-full text-white text-[9.5px] font-bold flex items-center justify-center">3</span>
              </button>
              <div className="w-7 h-7 bg-[#0B7070] rounded-full flex items-center justify-center text-white text-[11px] font-bold">李</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <MapPin size={10} className="flex-none"/>
            <span>华山医院 · 中心05</span>
            <span className="text-gray-200">·</span>
            <span className="text-[#0B7070] font-semibold">CRA</span>
            <span className="text-gray-200">·</span>
            <span>2026年7月15日 周二</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Today highlights */}
        <div className="bg-white mx-4 mt-3 rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
            <span className="text-[11.5px] font-semibold text-gray-700 uppercase tracking-wide">今日重点</span>
            <span className="text-[11px] text-gray-400">3项</span>
          </div>
          {[
            {
              icon: <div className="w-7 h-7 bg-[#0B7070]/10 rounded-[5px] flex items-center justify-center"><Calendar size={13} className="text-[#0B7070]"/></div>,
              title: "IMV · 复旦大学附属华山医院 中心05",
              sub: "今日 09:30 开始 · AJ-001 Phase II",
              badge: <Tag status="pending" label="待开始"/>,
              to: "imv-brief" as ScreenId,
            },
            {
              icon: <div className="w-7 h-7 bg-amber-100 rounded-[5px] flex items-center justify-center"><AlertCircle size={13} className="text-amber-600"/></div>,
              title: "2条上次遗留 Issue 待跟进",
              sub: "最晚截止 · 2026-07-19 周五",
              badge: <Tag status="warning" label="截止临近"/>,
              to: "issue" as ScreenId,
            },
            {
              icon: <div className="w-7 h-7 bg-sky-100 rounded-[5px] flex items-center justify-center"><FileText size={13} className="text-sky-600"/></div>,
              title: "PI 签字文件待上传 3 份",
              sub: "知情同意书 · 研究者手册确认函",
              badge: <Tag status="draft" label="待操作"/>,
              to: "todo" as ScreenId,
            },
          ].map((item, i) => (
            <button key={i} onClick={() => nav(item.to)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50 text-left active:bg-gray-50">
              {item.icon}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800 leading-snug truncate">{item.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{item.sub}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-none">
                {item.badge}
                <ChevronRight size={13} className="text-gray-300"/>
              </div>
            </button>
          ))}
        </div>

        {/* AI suggestion card */}
        <div className="mx-4 mt-3">
          <div className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider mb-2">AI建议</div>
          <div className="bg-white rounded-[8px] border border-[#0B7070]/25 overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-[#0B7070]/5 border-b border-[#0B7070]/10">
              <Zap size={11} className="text-[#0B7070]"/>
              <span className="text-[11px] font-semibold text-[#0B7070]">基于上次访视记录生成</span>
              <Tag status="draft" label="草稿"/>
            </div>
            <div className="px-3.5 py-3">
              <p className="text-[13px] text-gray-700 leading-relaxed">本次 IMV 建议重点核查受试者 03、05 的原始记录，以及 7 月药物管理温度记录。上次遗留 IS-2024-031、IS-2024-032 请现场跟进关闭。</p>
              <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                <Info size={10}/>来源：访视记录 2026-05-20 · Issue 历史
              </p>
            </div>
          </div>
        </div>

        {/* Timeline placeholder */}
        <div className="mx-4 mt-4 mb-2">
          <div className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider mb-2">今日记录</div>
          <div className="bg-white rounded-[8px] border border-dashed border-gray-200 flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <MessageSquare size={18} className="text-gray-400"/>
            </div>
            <p className="text-[13px] text-gray-500">描述你的工作事实</p>
            <p className="text-[12px] text-gray-400 mt-1">AI 自动整理成监查记录、Issue、工时</p>
          </div>
        </div>
        <div className="h-4"/>
      </div>

      {/* Input bar */}
      <div className="flex-none bg-white border-t border-gray-100 px-3 pt-2.5 pb-3">
        <div className="flex gap-1.5 mb-2.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => nav("imv-brief")}
            className="flex-none flex items-center gap-1.5 bg-[#0B7070] text-white rounded-[6px] px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap">
            <Play size={10} fill="white"/> 开始 IMV
          </button>
          <button className="flex-none flex items-center gap-1.5 bg-gray-100 text-gray-600 rounded-[6px] px-3 py-1.5 text-[12px] font-medium whitespace-nowrap">
            <Camera size={11}/> 拍照记录
          </button>
          <button onClick={() => nav("action-pack")}
            className="flex-none flex items-center gap-1.5 bg-gray-100 text-gray-600 rounded-[6px] px-3 py-1.5 text-[12px] font-medium whitespace-nowrap">
            <CheckCircle2 size={11}/> 结束整理
          </button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-gray-50 rounded-[8px] border border-gray-200 flex items-end px-3.5 py-2.5 gap-2">
            <textarea placeholder="描述工作事实（文字、语音、照片、文件）…"
              rows={1}
              className="flex-1 bg-transparent text-[14px] text-gray-900 placeholder-gray-400 outline-none resize-none leading-5 max-h-24"/>
            <div className="flex items-center gap-2 mb-0.5 flex-none">
              <button><Camera size={17} strokeWidth={1.7} className="text-gray-400"/></button>
              <button><Paperclip size={17} strokeWidth={1.7} className="text-gray-400"/></button>
            </div>
          </div>
          <button onClick={() => nav("voice")}
            className="w-10 h-10 rounded-full bg-[#0B7070] flex items-center justify-center shadow-sm flex-none">
            <Mic size={17} className="text-white"/>
          </button>
        </div>
      </div>

      <BottomNav active="workbench" nav={nav}/>
    </div>
  );
}

// ── Screen: IMV Brief ─────────────────────────────────────────────────────────

function IMVBriefScreen({ nav }: { nav: (s: ScreenId) => void }) {
  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => nav("workbench")} className="text-gray-500">
            <ChevronLeft size={22} strokeWidth={1.8}/>
          </button>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-gray-900">访视前简报</h2>
            <p className="text-[11px] text-gray-500">IMV 第3次 · 华山医院 中心05</p>
          </div>
          <button onClick={() => nav("imv-active")}
            className="flex items-center gap-1.5 bg-[#0B7070] text-white rounded-[6px] px-3.5 py-2 text-[13px] font-semibold">
            <Play size={12} fill="white"/> 开始
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Basic info */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">访视信息</span>
          </div>
          {[
            ["访视类型", "IMV（第三次监查访视）"],
            ["研究项目", "AJ-001 · 安健制药 Phase II 肿瘤"],
            ["研究中心", "复旦大学附属华山医院 · 中心05"],
            ["主要研究者", "陈建国 教授"],
            ["计划时间", "2026-07-15  09:30 ~ 17:00"],
            ["CRC联系人", "王小燕（小王）· 139-1234-5678"],
          ].map(([k, v], i) => (
            <div key={i} className="flex px-4 py-2.5 border-b last:border-0 border-gray-50">
              <span className="text-[11.5px] text-gray-400 w-[76px] flex-none">{k}</span>
              <span className="text-[13px] text-gray-800 font-medium">{v}</span>
            </div>
          ))}
        </div>

        {/* Enrollment */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">入组概况</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-[28px] font-bold text-gray-900 leading-none">8</span>
              <span className="text-[13px] text-gray-500 mb-0.5">/ 12 名在研</span>
              <span className="ml-auto text-[12px] text-amber-600 font-semibold mb-0.5">差4名达标</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
              <div className="bg-[#0B7070] h-1.5 rounded-full" style={{ width: "66.7%" }}/>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["6","筛选通过","text-emerald-700"],["2","筛选失败","text-red-600"],["0","脱落退出","text-gray-500"]].map(([n, l, c], i) => (
                <div key={i} className="bg-gray-50 rounded-[5px] py-2">
                  <p className={`text-[17px] font-bold ${c}`}>{n}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Open issues from last visit */}
        <div className="bg-white rounded-[8px] border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-100 bg-amber-50">
            <AlertTriangle size={12} className="text-amber-600"/>
            <span className="text-[11.5px] font-semibold text-amber-700">上次遗留 Issue（2条未关闭）</span>
          </div>
          {[
            { id: "IS-2024-031", title: "受试者04原始记录缺页", due: "07-15", owner: "小王" },
            { id: "IS-2024-032", title: "6月药物盘点表未签字",  due: "07-15", owner: "小王" },
          ].map((issue, i) => (
            <div key={i} className="px-4 py-3 border-b last:border-0 border-amber-50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10.5px] text-gray-400 font-mono">{issue.id}</p>
                  <p className="text-[13px] text-gray-800 font-medium mt-0.5">{issue.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">负责人：{issue.owner} · 截止 {issue.due}</p>
                </div>
                <Tag status="pending" label="跟进中"/>
              </div>
            </div>
          ))}
        </div>

        {/* Focus checklist */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">本次访视重点</span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {[
              "核查所有在研受试者知情同意书完整性",
              "药物管理：盘点、温度记录、账物相符",
              "原始记录签字完整性（重点受试者03、05）",
              "研究者手册最新版本确认（v3.1，2026-06-01）",
              "跟进上次遗留 Issue 关闭情况",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-[15px] h-[15px] rounded-[3px] border-2 border-gray-300 flex-none mt-[2px]"/>
                <span className="text-[13px] text-gray-700 leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-2"/>
      </div>
    </div>
  );
}

// ── Screen: IMV Active ────────────────────────────────────────────────────────

function IMVActiveScreen({ nav }: { nav: (s: ScreenId) => void }) {
  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-[#0B2E2E] flex-none">
        <StatusBar dark/>
        <div className="px-4 pb-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full block animate-pulse"/>
                <span className="text-[11px] text-emerald-400 font-semibold tracking-widest uppercase">访视进行中</span>
              </div>
              <h2 className="text-[17px] font-bold text-white leading-tight">IMV · 华山医院 中心05</h2>
              <p className="text-[11.5px] text-white/50 mt-0.5">AJ-001-Ph II · 09:10 开始</p>
            </div>
            <div className="text-right flex-none">
              <p className="text-[24px] font-bold text-white font-mono leading-none tracking-tight">03:42</p>
              <p className="text-[10px] text-white/40 mt-1">已用时</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button className="flex items-center gap-1.5 bg-white/12 text-white/80 rounded-[6px] px-3 py-1.5 text-[12px] font-medium border border-white/10">
              <ScanLine size={11}/> 记录节点
            </button>
            <button onClick={() => nav("action-pack")}
              className="flex items-center gap-1.5 bg-emerald-500 text-white rounded-[6px] px-3.5 py-1.5 text-[12px] font-semibold shadow-sm shadow-emerald-900/30">
              <Square size={10} fill="white"/> 结束整理
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {[
          {
            time: "09:12", status: "done" as const,
            content: "到达华山医院，签到并与 CRC 小王确认今日访视安排，获取受试者最新状态清单。",
            files: [] as string[],
          },
          {
            time: "09:45", status: "done" as const,
            content: "核查知情同意书：共8份，受试者01-08均已签署。受试者06 ICF 日期填写不规范（已与 PI 确认，需重新签署确认页）。",
            files: ["ICF_01-08_scan.pdf"],
          },
          {
            time: "11:20", status: "risk" as const,
            content: "⚑ 发现：受试者03原始记录（第3次、第4次方案访视）均未见研究者签字。PI 出诊中，小王确认文件存在。",
            files: ["IMG_0312.jpg", "IMG_0313.jpg"],
          },
          {
            time: "13:35", status: "risk" as const,
            content: "⚑ 药物管理核查：当前库存与账目相符。但 7月12日 温度记录表缺失，7月13–15日记录完整。",
            files: ["药物盘点表0715.jpg"],
          },
          {
            time: "14:50", status: "done" as const,
            content: "与 PI 陈教授会面 15 分钟，讨论受试者03和05的安全性随访安排。PI 承诺下周一（7月21日）完成所有遗留签字复核。",
            files: [] as string[],
          },
        ].map((entry, i) => (
          <div key={i} className={`bg-white rounded-[8px] border overflow-hidden ${entry.status === "risk" ? "border-red-200" : "border-gray-100"}`}>
            <div className="flex items-start gap-3 px-3.5 py-3">
              <div className="flex-none pt-0.5 flex flex-col items-center gap-1">
                <span className="text-[11px] text-gray-400 font-mono">{entry.time}</span>
                {entry.status === "risk" && <AlertTriangle size={11} className="text-red-500"/>}
              </div>
              <div className="flex-1">
                <p className="text-[13px] text-gray-700 leading-relaxed">{entry.content}</p>
                {entry.files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.files.map((f, j) => (
                      <div key={j} className="flex items-center gap-1 bg-gray-50 rounded-[4px] px-2 py-1 border border-gray-200">
                        <Paperclip size={9} className="text-gray-400"/>
                        <span className="text-[10.5px] text-gray-600">{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div className="text-center text-[11px] text-gray-400 py-2">继续描述发现，AI 实时关联业务记录</div>
        <div className="h-2"/>
      </div>

      <div className="flex-none bg-white border-t border-gray-100 px-3 pt-2.5 pb-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-gray-50 rounded-[8px] border border-gray-200 flex items-end px-3.5 py-2.5 gap-2">
            <textarea placeholder="继续描述发现…" rows={1}
              className="flex-1 bg-transparent text-[14px] text-gray-900 placeholder-gray-400 outline-none resize-none leading-5 max-h-20"/>
            <button className="mb-0.5 flex-none"><Camera size={17} strokeWidth={1.7} className="text-gray-400"/></button>
          </div>
          <button onClick={() => nav("voice")} className="w-10 h-10 rounded-full bg-[#0B7070] flex items-center justify-center flex-none">
            <Mic size={17} className="text-white"/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Screen: Voice Input ───────────────────────────────────────────────────────

function VoiceScreen({ nav }: { nav: (s: ScreenId) => void }) {
  const [phase, setPhase] = useState<"rec"|"done">("rec");

  const HEIGHTS = [14,22,36,28,44,20,38,26,46,18,34,28,42,16,30,24,40,22,36,20,44,18,32,26,38,14,28,22,40,16,34,20];

  return (
    <div className="flex-1 flex flex-col bg-[#0B2E2E] overflow-hidden">
      <StatusBar dark/>
      <div className="flex items-center px-4 py-1">
        <button onClick={() => nav("imv-active")} className="text-white/60 p-1"><X size={21}/></button>
        <span className="flex-1 text-center text-[13.5px] font-medium text-white/70">语音录入</span>
        <span className="text-[13px] text-white/40 p-1">帮助</span>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pb-8">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {phase === "rec" ? (
            <>
              <div className="flex items-center gap-[3px] mb-6 h-14">
                {HEIGHTS.map((h, i) => (
                  <div key={i} className="w-[6px] bg-emerald-400 rounded-full transition-all"
                    style={{ height: `${h}px`, opacity: 0.5 + (h / 46) * 0.5 }}/>
                ))}
              </div>
              <p className="text-[34px] font-bold text-white font-mono mb-1 tracking-tight">00:47</p>
              <p className="text-[12px] text-white/40">正在录音…</p>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/40">
                <Check size={30} className="text-white" strokeWidth={2.5}/>
              </div>
              <p className="text-[15px] font-semibold text-white">录音完成</p>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="w-full bg-white/10 rounded-[10px] p-4 mb-6 border border-white/10">
          <div className="flex items-center gap-2 mb-2.5">
            {phase === "rec" && <span className="w-[7px] h-[7px] bg-emerald-400 rounded-full animate-pulse"/>}
            <span className="text-[10.5px] text-white/50 font-semibold uppercase tracking-widest">
              {phase === "rec" ? "实时转写" : "转写结果"}
            </span>
          </div>
          <p className="text-[13.5px] text-white/85 leading-relaxed">
            {phase === "rec"
              ? "今天在华山医院做了IMV，9:10到17:40。发现03号受试者两份原始记录未签字，7月12日药物温度记录缺失…"
              : "今天在华山医院做了IMV，9:10到17:40。发现03号受试者两份原始记录未签字，7月12日药物温度记录缺失。CRC小王承诺周五前补齐，PI下周一复核。"}
          </p>
          {phase === "done" && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                <Shield size={11}/>识别到受试者编号，发送前将自动脱敏处理
              </p>
            </div>
          )}
        </div>

        {phase === "rec" ? (
          <div className="flex items-center gap-8">
            <button className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10">
              <Trash2 size={18} className="text-white/60"/>
            </button>
            <button onClick={() => setPhase("done")}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-900/40">
              <Square size={20} className="text-white" fill="white"/>
            </button>
            <button className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10">
              <Loader2 size={18} className="text-white/60"/>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 w-full">
            <button onClick={() => nav("action-pack")}
              className="w-full h-12 bg-[#0B7070] text-white rounded-[8px] text-[15px] font-semibold">
              发送并整理 →
            </button>
            <button onClick={() => setPhase("rec")} className="text-[13px] text-white/50">重新录音</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Screen: Action Pack ───────────────────────────────────────────────────────

function ActionPackScreen({ nav }: { nav: (s: ScreenId) => void }) {
  const [open, setOpen] = useState<number|null>(0);

  const actions = [
    {
      type: "visit", title: "IMV 执行记录", count: 1, status: "draft" as TagStatus,
      detail: "华山医院中心05 · 2026-07-15 · 09:10–17:40（8.5h）· PI 陈建国 · 8名受试者在研",
      source: "来源：本次访视录音转写 + 中心日历信息",
      Icon: Calendar, iconBg: "bg-[#0B7070]/10", iconColor: "text-[#0B7070]",
    },
    {
      type: "hours", title: "工时记录候选", count: 1, status: "pending" as TagStatus,
      detail: "8.5 小时 · IMV · 华山医院 · AJ-001-Ph II · 2026-07-15",
      source: "来源：访视开始 / 结束时间推算",
      Icon: Clock, iconBg: "bg-sky-100", iconColor: "text-sky-700",
    },
    {
      type: "issue", title: "Issue（待创建）", count: 2, status: "risk" as TagStatus,
      detail: null, source: null,
      Icon: AlertTriangle, iconBg: "bg-red-100", iconColor: "text-red-600",
      items: [
        { title: "受试者03原始记录未签字（×2份）", severity: "主要", owner: "小王 CRC", due: "2026-07-19" },
        { title: "药物温度记录缺失（7月12日）",     severity: "次要", owner: "小王 CRC", due: "2026-07-19" },
      ],
    },
    {
      type: "task", title: "后续任务", count: 2, status: "pending" as TagStatus,
      detail: null, source: null,
      Icon: CheckCircle2, iconBg: "bg-amber-100", iconColor: "text-amber-600",
      items: [
        { title: "跟进受试者03原始记录补签字", owner: "小王 CRC", due: "2026-07-19" },
        { title: "PI 陈教授下周一复核确认",    owner: "陈建国 PI",  due: "2026-07-21" },
      ],
    },
    {
      type: "evidence", title: "证据关联建议", count: 3, status: "draft" as TagStatus,
      detail: "3张图片 → 关联至 Issue · 药物盘点表 → 关联至访视记录 · ICF 扫描件 → 归档",
      source: "来源：本次访视上传文件",
      Icon: Link2, iconBg: "bg-violet-100", iconColor: "text-violet-700",
    },
    {
      type: "report", title: "监查报告草稿内容", count: 1, status: "draft" as TagStatus,
      detail: "已生成本次 IMV 摘要、发现事项、跟进计划章节草稿（结论待补充）",
      source: "来源：本次访视全部记录整合",
      Icon: FileText, iconBg: "bg-indigo-100", iconColor: "text-indigo-700",
    },
    {
      type: "risk", title: "重复问题风险升级提示", count: 1, status: "risk" as TagStatus,
      detail: "原始记录签字缺失已连续出现 2 次（本次 + 上次 IS-2024-032）→ 建议升级为中心级风险事项",
      source: "来源：Issue 历史记录比对",
      Icon: TrendingUp, iconBg: "bg-red-100", iconColor: "text-red-600",
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => nav("imv-active")} className="text-gray-500">
            <ChevronLeft size={22} strokeWidth={1.8}/>
          </button>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-gray-900">AI 整理结果</h2>
            <p className="text-[11px] text-gray-500">7 项业务动作 · 请逐项审查后确认</p>
          </div>
          <Tag status="draft" label="草稿"/>
        </div>
      </div>

      {/* AI notice */}
      <div className="flex items-start gap-2 bg-[#EBF5F5] border-b border-[#0B7070]/15 px-4 py-2.5 flex-none">
        <Zap size={12} className="text-[#0B7070] mt-0.5 flex-none"/>
        <p className="text-[12px] text-[#0B7070] leading-snug">AI 已识别以下业务动作。所有内容为草稿，确认后才写入正式记录。</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {actions.map((a, i) => {
          const { Icon, iconBg, iconColor } = a;
          const border = a.status === "risk" ? "border-red-200" : a.status === "pending" ? "border-amber-200" : "border-gray-100";
          return (
            <div key={i} className={`bg-white rounded-[8px] border overflow-hidden ${border}`}>
              <button className="w-full flex items-center gap-3 px-3.5 py-3" onClick={() => setOpen(open === i ? null : i)}>
                <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center flex-none ${iconBg}`}>
                  <Icon size={14} className={iconColor}/>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-semibold text-gray-900">{a.title}</p>
                  <div className="flex items-center gap-1.5 mt-[3px]">
                    <Tag status={a.status} label={a.status === "draft" ? "AI草稿" : a.status === "risk" ? "需处理" : "待确认"}/>
                    <span className="text-[10.5px] text-gray-400">{a.count} 项</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-none">
                  <button onClick={(e) => { e.stopPropagation(); nav("action-edit"); }}
                    className="p-1.5 text-gray-400"><Edit3 size={13}/></button>
                  <ChevronDown size={15} className={`text-gray-400 transition-transform duration-150 ${open === i ? "rotate-180" : ""}`}/>
                </div>
              </button>
              {open === i && (
                <div className="border-t border-gray-50 px-3.5 py-3 bg-gray-50/60">
                  {a.detail && <p className="text-[12.5px] text-gray-700 leading-relaxed mb-2">{a.detail}</p>}
                  {"items" in a && a.items && (
                    <div className="space-y-1.5 mb-2">
                      {a.items.map((item: any, j: number) => (
                        <div key={j} className="bg-white rounded-[5px] border border-gray-100 px-3 py-2">
                          <p className="text-[12.5px] text-gray-800 font-medium">{item.title}</p>
                          <div className="flex items-center gap-2.5 mt-1 text-[11px] text-gray-500">
                            {item.severity && <span className={item.severity === "主要" ? "text-red-600 font-semibold" : "text-amber-600 font-semibold"}>{item.severity}</span>}
                            <span>{item.owner}</span>
                            <span>截止 {item.due}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {a.source && (
                    <p className="text-[10.5px] text-gray-400 flex items-start gap-1">
                      <Info size={10} className="mt-0.5 flex-none"/>
                      {a.source}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* AI follow-up */}
        <div className="bg-white rounded-[8px] border border-[#0B7070]/25 overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#EBF5F5] border-b border-[#0B7070]/15">
            <Zap size={11} className="text-[#0B7070]"/>
            <span className="text-[11.5px] font-semibold text-[#0B7070]">AI 补充追问</span>
          </div>
          <div className="px-3.5 py-3">
            <p className="text-[13px] text-gray-700 leading-relaxed mb-3">7月12日药物温度记录缺失，当日是否确认有药物出入库操作？如无操作可标注「无需记录日」；否则建议创建偏差记录。</p>
            <div className="flex gap-2">
              <button className="flex-1 h-9 bg-gray-50 border border-gray-200 rounded-[5px] text-[12.5px] text-gray-700 font-medium">当日无操作</button>
              <button className="flex-1 h-9 bg-[#EBF5F5] border border-[#0B7070]/25 rounded-[5px] text-[12.5px] text-[#0B7070] font-semibold">创建偏差记录</button>
            </div>
          </div>
        </div>

        <div className="h-2"/>
      </div>

      <div className="flex-none bg-white border-t border-gray-100 px-4 py-3">
        <button onClick={() => nav("confirm")}
          className="w-full h-12 bg-[#0B7070] text-white rounded-[8px] text-[15px] font-semibold">
          逐项确认 7 项动作
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-2">确认后写入正式记录，不可撤销</p>
      </div>
    </div>
  );
}

// ── Screen: Action Edit ───────────────────────────────────────────────────────

function ActionEditScreen({ nav }: { nav: (s: ScreenId) => void }) {
  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => nav("action-pack")} className="text-gray-500">
            <ChevronLeft size={22} strokeWidth={1.8}/>
          </button>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-gray-900">编辑 Issue 草稿</h2>
            <p className="text-[11px] text-gray-500">AI 生成 · 修改后确认写入</p>
          </div>
          <Tag status="draft" label="草稿"/>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Source attribution */}
        <div className="flex items-start gap-2 bg-[#EBF5F5] rounded-[6px] px-3 py-2.5 border border-[#0B7070]/20">
          <Info size={12} className="text-[#0B7070] mt-0.5 flex-none"/>
          <p className="text-[11.5px] text-[#0B7070] leading-snug">
            来源：语音转写 11:20 片段 · "03号受试者两份原始记录未签字"
          </p>
        </div>

        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          {[
            { label: "Issue 类型", value: "原始记录缺陷", type: "select" },
            { label: "严重程度",   value: "主要",         type: "select" },
          ].map((f, i) => (
            <div key={i} className="px-4 py-3 border-b border-gray-50">
              <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">{f.label}</label>
              <div className="relative">
                <select className="w-full h-10 bg-gray-50 rounded-[5px] border border-gray-200 px-3 text-[14px] text-gray-800 appearance-none outline-none focus:border-[#0B7070]" defaultValue={f.value}>
                  {f.label === "Issue 类型"
                    ? ["原始记录缺陷","药物管理缺陷","ICF缺陷","知情同意缺陷"].map(o => <option key={o}>{o}</option>)
                    : ["主要","次要","轻微"].map(o => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">问题描述</label>
            <textarea rows={4} defaultValue="受试者03（华山医院）第3次方案访视记录（2026-07-08）及第4次方案访视记录（2026-07-12）均未见研究者签字。原始文件存在，但PI签名栏空白。"
              className="w-full bg-gray-50 rounded-[5px] border border-gray-200 p-3 text-[13.5px] text-gray-800 outline-none focus:border-[#0B7070] resize-none leading-relaxed"/>
          </div>
          {[
            { label: "负责人",  value: "王小燕（小王）· CRC" },
            { label: "关闭截止", value: "2026-07-19" },
          ].map((f, i) => (
            <div key={i} className="px-4 py-3 border-b last:border-0 border-gray-50">
              <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">{f.label}</label>
              <input defaultValue={f.value}
                className="w-full h-10 bg-gray-50 rounded-[5px] border border-gray-200 px-3 text-[13.5px] text-gray-800 outline-none focus:border-[#0B7070]"/>
            </div>
          ))}
        </div>

        {/* Evidence */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">关联证据</span>
            <button className="flex items-center gap-1 text-[12px] text-[#0B7070] font-medium"><Plus size={12}/> 添加</button>
          </div>
          {["IMG_0312.jpg","IMG_0313.jpg"].map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 border-gray-50">
              <div className="w-7 h-7 bg-sky-100 rounded-[4px] flex items-center justify-center flex-none">
                <Image size={13} className="text-sky-700"/>
              </div>
              <span className="flex-1 text-[13px] text-gray-700">{f}</span>
              <button><X size={14} className="text-gray-400"/></button>
            </div>
          ))}
        </div>
        <div className="h-2"/>
      </div>

      <div className="flex-none bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
        <button onClick={() => nav("action-pack")}
          className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-[6px] text-[14px] font-medium">取消</button>
        <button onClick={() => nav("action-pack")}
          className="flex-[2] h-11 bg-[#0B7070] text-white rounded-[6px] text-[14px] font-semibold">保存并返回</button>
      </div>
    </div>
  );
}

// ── Screen: Confirm Flow ──────────────────────────────────────────────────────

function ConfirmScreen({ nav }: { nav: (s: ScreenId) => void }) {
  const [confirmed, setConfirmed] = useState<number[]>([]);
  const [skipped, setSkipped]     = useState<number[]>([]);

  const items = [
    { title: "IMV 执行记录",                  sub: "华山医院中心05 · 2026-07-15 · 8.5h",          type: "visit",  cta: "确认访视记录",        critical: false },
    { title: "工时记录 8.5 小时",              sub: "IMV · 2026-07-15 · AJ-001",                  type: "hours",  cta: "确认工时",            critical: false },
    { title: "Issue：受试者03原始记录未签字（×2）", sub: "主要 · 负责：小王 CRC · 截止 07-19",    type: "issue",  cta: "确认并创建 Issue",    critical: true  },
    { title: "Issue：药物温度记录缺失（7月12日）", sub: "次要 · 负责：小王 CRC · 截止 07-19",     type: "issue",  cta: "确认并创建 Issue",    critical: false },
    { title: "任务：跟进受试者03原始记录补签字",  sub: "截止 07-19 · 指派 小王 CRC",              type: "task",   cta: "确认并创建任务",      critical: false },
    { title: "任务：PI 下周一复核确认",          sub: "截止 07-21 · 指派 陈建国 PI",              type: "task",   cta: "确认并创建任务",      critical: false },
    { title: "监查报告草稿（3个章节）",          sub: "来源：本次访视记录整合",                    type: "report", cta: "确认保存草稿",        critical: false },
  ];

  const done = confirmed.length + skipped.length;
  const allDone = done === items.length;

  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => nav("action-pack")} className="text-gray-500">
            <ChevronLeft size={22} strokeWidth={1.8}/>
          </button>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-gray-900">逐项确认</h2>
            <p className="text-[11px] text-gray-500">
              {done}/{items.length} 已处理 · {confirmed.length} 确认 · {skipped.length} 跳过
            </p>
          </div>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-[#0B7070] transition-all duration-300"
            style={{ width: `${(done / items.length) * 100}%` }}/>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.map((item, i) => {
          const isC = confirmed.includes(i);
          const isS = skipped.includes(i);
          return (
            <div key={i} className={`bg-white rounded-[8px] border overflow-hidden transition-opacity duration-200 ${
              isS ? "opacity-40" : item.critical && !isC ? "border-red-200" : "border-gray-100"
            }`}>
              <div className="flex items-start gap-3 px-3.5 py-3">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-none mt-0.5 transition-all duration-200 ${
                  isC ? "bg-emerald-500 border-emerald-500" : isS ? "bg-gray-100 border-gray-200" : "border-gray-300"
                }`}>
                  {isC && <Check size={14} className="text-white" strokeWidth={2.5}/>}
                  {isS && <X    size={13} className="text-gray-400" strokeWidth={2}/>}
                </div>
                <div className="flex-1">
                  <p className={`text-[13px] font-medium leading-snug ${isS ? "text-gray-400 line-through" : "text-gray-800"}`}>
                    {item.title}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{item.sub}</p>
                  {item.critical && !isC && !isS && (
                    <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle size={11}/> 主要 Issue，建议确认后及时通知 PI
                    </p>
                  )}
                </div>
                <button className="p-1 text-gray-300 flex-none"><Edit3 size={13}/></button>
              </div>
              {!isC && !isS && (
                <div className="flex border-t border-gray-50">
                  <button onClick={() => setSkipped(p => [...p, i])}
                    className="flex-1 py-2.5 text-[12.5px] text-gray-500 font-medium border-r border-gray-50">
                    跳过
                  </button>
                  <button onClick={() => setConfirmed(p => [...p, i])}
                    className={`flex-1 py-2.5 text-[12.5px] font-semibold ${item.type === "issue" ? "text-red-600" : "text-[#0B7070]"}`}>
                    {item.cta}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="flex-none bg-white border-t border-gray-100 px-4 py-3">
          <button onClick={() => nav("todo")}
            className="w-full h-12 bg-[#0B7070] text-white rounded-[8px] text-[15px] font-semibold">
            完成确认，查看正式记录 →
          </button>
          <p className="text-center text-[11px] text-gray-500 mt-2">
            已确认 {confirmed.length} 项 · 跳过 {skipped.length} 项
          </p>
        </div>
      )}
    </div>
  );
}

// ── Screen: Todo ──────────────────────────────────────────────────────────────

function TodoScreen({ nav }: { nav: (s: ScreenId) => void }) {
  const [tab, setTab] = useState<"mine"|"all">("mine");

  const todos = [
    { title: "跟进受试者03原始记录补签字",          project: "AJ-001 · 华山医院中心05", due: "07-19", days: 4, urgent: false, source: "IS-2025-041" },
    { title: "核查7月12日药物温度记录",             project: "AJ-001 · 华山医院中心05", due: "07-19", days: 4, urgent: false, source: "IS-2025-042" },
    { title: "PI 陈教授下周一复核确认",              project: "AJ-001 · 华山医院中心05", due: "07-21", days: 6, urgent: false, source: "IMV-2025-003" },
    { title: "上传受试者06知情同意书修正版扫描件",  project: "AJ-001 · 华山医院中心05", due: "07-17", days: 2, urgent: true,  source: "今日 IMV 记录" },
    { title: "提交本次 IMV 监查报告",               project: "AJ-001 · 华山医院中心05", due: "07-22", days: 7, urgent: false, source: "AI草稿已生成" },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="px-4">
          <h2 className="text-[18px] font-bold text-gray-900 mb-3">待办</h2>
          <div className="flex gap-0 border-b border-gray-100">
            {[{ k: "mine" as const, l: "我的待办", n: 5 }, { k: "all" as const, l: "全部", n: 12 }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`px-4 pb-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                  tab === t.k ? "border-[#0B7070] text-[#0B7070]" : "border-transparent text-gray-400"
                }`}>
                {t.l}
                <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${tab === t.k ? "bg-[#EBF5F5] text-[#0B7070]" : "bg-gray-100 text-gray-500"}`}>{t.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {todos.map((t, i) => (
          <button key={i} onClick={() => nav("issue")}
            className={`w-full bg-white rounded-[8px] border text-left overflow-hidden active:bg-gray-50 ${t.urgent ? "border-red-200" : "border-gray-100"}`}>
            <div className="flex items-start gap-3 px-3.5 py-3">
              <div className={`w-[15px] h-[15px] rounded-[3px] border-2 flex-none mt-[3px] ${t.urgent ? "border-red-400" : "border-gray-300"}`}/>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800 leading-snug">{t.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{t.project}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[11px] font-semibold ${t.days <= 2 ? "text-red-600" : t.days <= 4 ? "text-amber-600" : "text-gray-500"}`}>
                    截止 {t.due}{t.days <= 2 ? " · 紧急" : t.days <= 4 ? " · 临近" : ""}
                  </span>
                  <span className="text-gray-200">·</span>
                  <span className="text-[11px] text-gray-400">来自 {t.source}</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5 flex-none"/>
            </div>
          </button>
        ))}
      </div>

      <BottomNav active="todo" nav={nav}/>
    </div>
  );
}

// ── Screen: Issue Detail ──────────────────────────────────────────────────────

function IssueScreen({ nav }: { nav: (s: ScreenId) => void }) {
  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => nav("todo")} className="text-gray-500">
            <ChevronLeft size={22} strokeWidth={1.8}/>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] text-gray-400 font-mono">IS-2025-041</span>
              <Tag status="pending" label="待关闭"/>
            </div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight truncate">受试者03原始记录未签字</h2>
          </div>
          <button className="text-gray-400 flex-none"><MoreHorizontal size={20}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Meta grid */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-2">
            {[
              ["严重程度", "主要",                   "text-red-600 font-bold"],
              ["发现来源", "IMV · 2026-07-15",       "text-gray-800"],
              ["负责人",   "王小燕（CRC）",           "text-gray-800"],
              ["关闭截止", "2026-07-19",             "text-amber-600 font-semibold"],
            ].map(([l, v, c], i) => (
              <div key={i} className={`px-4 py-3 ${i < 2 ? "border-b" : ""} ${i % 2 === 0 ? "border-r" : ""} border-gray-50`}>
                <p className="text-[10.5px] text-gray-400 uppercase tracking-wide">{l}</p>
                <p className={`text-[13px] mt-0.5 ${c}`}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">问题描述</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-[13px] text-gray-700 leading-relaxed">
              受试者03（华山医院）第3次方案访视记录（2026-07-08）及第4次方案访视记录（2026-07-12）均未见研究者签字。原始文件存在，PI 签名栏空白。
            </p>
            <p className="text-[10.5px] text-gray-400 mt-2 flex items-center gap-1">
              <Info size={10}/>来源：今日 IMV 语音转写 · 11:20 片段
            </p>
          </div>
        </div>

        {/* Evidence */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">关联证据</span>
            <button className="flex items-center gap-1 text-[12px] text-[#0B7070] font-medium"><Plus size={11}/> 添加</button>
          </div>
          {[
            { name: "IMG_0312.jpg", desc: "受试者03第3次访视记录封面（签字栏空白）", date: "11:22" },
            { name: "IMG_0313.jpg", desc: "受试者03第4次访视记录封面（签字栏空白）", date: "11:23" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 border-gray-50">
              <div className="w-8 h-8 bg-sky-100 rounded-[5px] flex items-center justify-center flex-none">
                <Image size={13} className="text-sky-700"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-gray-800">{f.name}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">{f.desc}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">今日 {f.date} 上传</p>
              </div>
              <Eye size={15} className="text-gray-400 flex-none"/>
            </div>
          ))}
        </div>

        {/* CAPA */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">纠正措施 CAPA</span>
            <Tag status="pending" label="进行中"/>
          </div>
          <div className="px-4 py-3 space-y-3">
            {[
              ["纠正措施", "CRC 小王于 2026-07-19 前协调 PI 补签两份原始记录。"],
              ["预防措施", "提醒研究团队：每次访视结束当日完成所有记录签字。"],
              ["关闭条件", "CRA 确认两份原始记录签字完整后关闭 Issue。"],
            ].map(([l, v], i) => (
              <div key={i}>
                <p className="text-[10.5px] text-gray-400 uppercase tracking-wide mb-1">{l}</p>
                <p className="text-[13px] text-gray-700 leading-snug">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">操作历史</span>
          </div>
          {[
            { t: "17:45", a: "李明（CRA）",    e: "创建 Issue · 来自 IMV 记录" },
            { t: "18:02", a: "系统自动",       e: "指派给 王小燕（CRC），截止 07-19" },
          ].map((h, i) => (
            <div key={i} className="flex gap-3 px-4 py-2.5 border-b last:border-0 border-gray-50">
              <span className="text-[11px] text-gray-400 font-mono w-10 flex-none">{h.t}</span>
              <p className="text-[12.5px] text-gray-700">
                <span className="font-medium">{h.a}</span>
                <span className="text-gray-500"> · {h.e}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="h-4"/>
      </div>

      {/* Action */}
      <div className="flex-none bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
        <button className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-[6px] text-[13.5px] font-medium">跟进备注</button>
        <button className="flex-1 h-11 bg-emerald-600 text-white rounded-[6px] text-[13.5px] font-semibold">确认关闭 Issue</button>
      </div>
    </div>
  );
}

// ── Screen: My Hours ──────────────────────────────────────────────────────────

function HoursScreen({ nav }: { nav: (s: ScreenId) => void }) {
  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="px-4 pb-3">
          <h2 className="text-[18px] font-bold text-gray-900 mb-0.5">我的工时</h2>
          <p className="text-[12px] text-gray-500">2026年7月 · 启明医药CRO</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Summary card */}
        <div className="bg-[#0B2E2E] rounded-[8px] overflow-hidden px-4 py-4">
          <p className="text-[11px] text-white/50 uppercase tracking-wide mb-1">本月工时合计</p>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-[38px] font-bold text-white leading-none tracking-tight">87.5</span>
            <span className="text-[15px] text-white/60 mb-1.5">小时</span>
            <span className="text-[12px] text-emerald-400 ml-auto mb-1.5 font-semibold">+8.5h 今日</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["8天","访视天数"],["5天","出差天数"],["待提交","审批状态"]].map(([v, l], i) => (
              <div key={i} className="bg-white/10 rounded-[5px] px-3 py-2 border border-white/5">
                <p className="text-[10px] text-white/40 mb-0.5">{l}</p>
                <p className="text-[14px] font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Entries */}
        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-gray-600 uppercase tracking-wide">近期记录</span>
            <button className="text-[12px] text-[#0B7070] font-medium">全部明细</button>
          </div>
          {[
            { date: "07-15", day: "周二", desc: "IMV · 华山医院 中心05",  h: 8.5, st: "pending" as TagStatus },
            { date: "07-11", day: "周五", desc: "IMV · 仁济医院 中心03",  h: 7.0, st: "done"    as TagStatus },
            { date: "07-10", day: "周四", desc: "电话访视 · AJ-001 协调", h: 2.5, st: "done"    as TagStatus },
            { date: "07-08", day: "周二", desc: "TMF 整理 · AJ-001 归档", h: 3.0, st: "done"    as TagStatus },
            { date: "07-05", day: "周六", desc: "IMV · 中山医院 中心01",  h: 9.0, st: "done"    as TagStatus },
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
              <div className="text-center w-10 flex-none">
                <p className="text-[12px] font-semibold text-gray-700">{e.date}</p>
                <p className="text-[10px] text-gray-400">{e.day}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-gray-800 font-medium truncate">{e.desc}</p>
              </div>
              <div className="text-right flex-none">
                <p className="text-[15px] font-bold text-gray-900">{e.h}h</p>
                <Tag status={e.st} label={e.st === "done" ? "已审批" : "待审批"}/>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[8px] border border-gray-100 overflow-hidden px-4 py-3">
          <button className="w-full h-10 bg-[#0B7070] text-white rounded-[5px] text-[14px] font-semibold">
            提交 7月工时审批
          </button>
        </div>
        <div className="h-2"/>
      </div>

      <BottomNav active="mine" nav={nav}/>
    </div>
  );
}

// ── Screen: QA Review ─────────────────────────────────────────────────────────

function QAReviewScreen({ nav }: { nav: (s: ScreenId) => void }) {
  const [tab, setTab] = useState<"pending"|"done">("pending");

  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F7] overflow-hidden">
      <div className="bg-white flex-none">
        <StatusBar/>
        <div className="px-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[18px] font-bold text-gray-900">移动审核</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[#0B7070] rounded-full"/>
              <span className="text-[11.5px] text-gray-600 font-medium">QA · 张磊</span>
            </div>
          </div>
          <div className="flex gap-0 border-b border-gray-100">
            {[{ k: "pending" as const, l: "待审核", n: 3 }, { k: "done" as const, l: "已完成", n: 18 }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`px-4 pb-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                  tab === t.k ? "border-[#0B7070] text-[#0B7070]" : "border-transparent text-gray-400"
                }`}>
                {t.l}
                <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${tab === t.k ? "bg-[#EBF5F5] text-[#0B7070]" : "bg-gray-100 text-gray-500"}`}>{t.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {tab === "pending" ? [
          {
            type: "Issue", id: "IS-2025-041", title: "受试者03原始记录未签字（×2）",
            submitter: "李明 CRA", time: "07-15 17:45", severity: "主要",
            project: "AJ-001 · 华山医院中心05",
          },
          {
            type: "工时", id: "HRS-2025-0715", title: "2026-07-15 IMV 工时 8.5h",
            submitter: "李明 CRA", time: "07-15 18:00", severity: null,
            project: "AJ-001 · 华山医院中心05",
          },
          {
            type: "报告草稿", id: "RPT-2025-003", title: "第3次 IMV 监查报告草稿",
            submitter: "李明 CRA", time: "07-15 18:10", severity: null,
            project: "AJ-001 · 华山医院中心05",
          },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-[8px] border border-gray-100 overflow-hidden">
            <div className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-mono">{item.id}</span>
                  <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{item.type}</span>
                  {item.severity && <Tag status="risk" label={item.severity}/>}
                </div>
                <span className="text-[10.5px] text-gray-400 flex-none">{item.time}</span>
              </div>
              <p className="text-[13px] font-semibold text-gray-900">{item.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{item.project} · 提交人：{item.submitter}</p>
            </div>
            <div className="flex border-t border-gray-50">
              <button className="flex-1 py-2.5 text-[12.5px] text-gray-500 font-medium border-r border-gray-50 flex items-center justify-center gap-1.5">
                <Eye size={12}/> 查看详情
              </button>
              <button className="flex-1 py-2.5 text-[12.5px] text-red-600 font-medium border-r border-gray-50">
                退回
              </button>
              <button className="flex-1 py-2.5 text-[12.5px] text-emerald-700 font-semibold">
                通过
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-10 text-gray-400 text-[13px]">已完成 18 条审核记录</div>
        )}
      </div>

      <BottomNav active="workbench" nav={nav}/>
    </div>
  );
}

// ── Screen selector / nav dots ────────────────────────────────────────────────

const SCREENS: Array<{ id: ScreenId; label: string }> = [
  { id: "login",       label: "登录" },
  { id: "workbench",   label: "AI工作台" },
  { id: "imv-brief",   label: "IMV简报" },
  { id: "imv-active",  label: "访视中" },
  { id: "voice",       label: "语音录入" },
  { id: "action-pack", label: "动作包" },
  { id: "action-edit", label: "记录编辑" },
  { id: "confirm",     label: "逐项确认" },
  { id: "todo",        label: "待办" },
  { id: "issue",       label: "Issue" },
  { id: "hours",       label: "我的工时" },
  { id: "qa-review",   label: "QA审核" },
];

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("workbench");
  const nav = (s: ScreenId) => setScreen(s);

  const renderScreen = () => {
    switch (screen) {
      case "login":       return <LoginScreen      nav={nav}/>;
      case "workbench":   return <WorkbenchScreen  nav={nav}/>;
      case "imv-brief":   return <IMVBriefScreen   nav={nav}/>;
      case "imv-active":  return <IMVActiveScreen  nav={nav}/>;
      case "voice":       return <VoiceScreen      nav={nav}/>;
      case "action-pack": return <ActionPackScreen nav={nav}/>;
      case "action-edit": return <ActionEditScreen nav={nav}/>;
      case "confirm":     return <ConfirmScreen    nav={nav}/>;
      case "todo":        return <TodoScreen       nav={nav}/>;
      case "issue":       return <IssueScreen      nav={nav}/>;
      case "hours":       return <HoursScreen      nav={nav}/>;
      case "qa-review":   return <QAReviewScreen   nav={nav}/>;
      default:            return <WorkbenchScreen  nav={nav}/>;
    }
  };

  return (
    <div className="min-h-screen bg-[#DDE0E8] flex flex-col items-center justify-start py-6 px-4">
      {/* Screen picker */}
      <div className="w-full max-w-[390px] mb-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">页面</p>
        <div className="flex flex-wrap gap-1.5">
          {SCREENS.map(s => (
            <button key={s.id} onClick={() => setScreen(s.id)}
              className={`px-2.5 py-1 rounded-[4px] text-[11px] font-semibold transition-colors ${
                screen === s.id
                  ? "bg-[#0B7070] text-white shadow-sm"
                  : "bg-white/80 text-gray-600 border border-gray-200/80"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone frame */}
      <div className="w-[390px] flex-none bg-white rounded-[44px] border border-black/20 shadow-2xl shadow-black/30 overflow-hidden flex flex-col"
        style={{ height: "844px" }}>
        {renderScreen()}
      </div>

      <p className="mt-4 text-[10.5px] text-gray-400 font-medium tracking-wide">
        AI临床运营协同平台 · 移动端 UI · 390 × 844
      </p>
    </div>
  );
}
