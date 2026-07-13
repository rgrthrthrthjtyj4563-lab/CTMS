import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage.js";
import { ProjectSelectionPage } from "./routes/ProjectSelectionPage.js";
import { DashboardPage } from "./routes/DashboardPage.js";
import { PlaceholderPage } from "./routes/PlaceholderPage.js";
import { SubjectsPage } from "./routes/SubjectsPage.js";
import { SubjectDetailPage } from "./routes/SubjectDetailPage.js";
import { EConsentPage } from "./routes/EConsentPage.js";
import { RemoteVisitPage } from "./routes/RemoteVisitPage.js";
import { EproPage } from "./routes/EproPage.js";
import { SafetyEventsPage } from "./routes/SafetyEventsPage.js";
import { SafetyEventDetailPage } from "./routes/SafetyEventDetailPage.js";
import { RiskMonitorPage } from "./routes/RiskMonitorPage.js";
import { ProtocolPage } from "./routes/ProtocolPage.js";
import { ReportsPage } from "./routes/ReportsPage.js";
import { DocumentsPage } from "./routes/DocumentsPage.js";
import { DocumentsAuditPage } from "./routes/DocumentsAuditPage.js";
import { AppShell } from "./components/app/AppShell.js";
import { Toaster } from "./components/ui/Toast.js";
import { loadSession, type Session } from "./lib/session.js";

const ROUTE_PHASE: Record<string, { title: string; phase?: "Phase 2" | "Phase 3" | "Phase 4"; description: string }> = {
  "/app/protocol": {
    title: "AI 方案解析",
    phase: "Phase 3",
    description: "上传方案 PDF 后由 AI 抽取访视、剂量、不良事件等结构化字段，由 PI 人工确认后纳入研究配置。",
  },
  "/app/subjects": {
    title: "受试者管理",
    phase: "Phase 2",
    description: "受试者档案、状态流转、知情同意、SAE 联动。",
  },
  "/app/econsent": {
    title: "电子知情",
    phase: "Phase 2",
    description: "电子知情书签署、人脸核身、签名留痕。",
  },
  "/app/remote-visit": {
    title: "远程访视",
    phase: "Phase 2",
    description: "远程视频访视、ECG/血压/血氧的设备对接。",
  },
  "/app/epro": {
    title: "ePRO / eCOA",
    phase: "Phase 2",
    description: "患者报告结局、量表回收、缺项提醒。",
  },
  "/app/drugs": {
    title: "药品与样本",
    phase: "Phase 2",
    description: "药品物流、生物样本、链式监管。",
  },
  "/app/reports": {
    title: "报告中心",
    phase: "Phase 3",
    description: "受试者报告、中心报告、监管报告。",
  },
  "/app/documents": {
    title: "文档与稽查",
    description: "试验主文档、版本控制、审计追踪。",
  },
  "/app/documents-audit": {
    title: "审计日志",
    description: "全项目审计事件流、合规导出（21 CFR Part 11）。",
  },
  "/app/ai-config": {
    title: "AI 中台配置",
    phase: "Phase 3",
    description: "模型选择、置信度阈值、人工确认策略。",
  },
  "/app/settings": {
    title: "系统设置",
    phase: "Phase 4",
    description: "组织、角色、权限、集成。",
  },
};

function RequireAuth({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(undefined as unknown as Session);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      navigate("/login", { replace: true });
      return;
    }
    setSessionState(s);
  }, [navigate]);

  if (session === undefined) return null;
  if (!session) return null;
  return (
    <AppShell session={session} key={session.userId + session.projectId}>
      {children}
    </AppShell>
  );
}

function DashboardRoute() {
  return (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  );
}

function SubjectsListRoute() {
  return (
    <RequireAuth>
      <SubjectsPage />
    </RequireAuth>
  );
}

function SubjectDetailRoute() {
  return (
    <RequireAuth>
      <SubjectDetailPage />
    </RequireAuth>
  );
}

function EConsentRoute() {
  return (
    <RequireAuth>
      <EConsentPage />
    </RequireAuth>
  );
}

function RemoteVisitRoute() {
  return (
    <RequireAuth>
      <RemoteVisitPage />
    </RequireAuth>
  );
}

function EproRoute() {
  return (
    <RequireAuth>
      <EproPage />
    </RequireAuth>
  );
}

function SafetyEventsRoute() {
  return (
    <RequireAuth>
      <SafetyEventsPage />
    </RequireAuth>
  );
}

function SafetyEventDetailRoute() {
  return (
    <RequireAuth>
      <SafetyEventDetailPage />
    </RequireAuth>
  );
}

function RiskMonitorRoute() {
  return (
    <RequireAuth>
      <RiskMonitorPage />
    </RequireAuth>
  );
}

function ProtocolRoute() {
  return (
    <RequireAuth>
      <ProtocolPage />
    </RequireAuth>
  );
}

function ReportsRoute() {
  return (
    <RequireAuth>
      <ReportsPage />
    </RequireAuth>
  );
}

function DocumentsRoute() {
  return (
    <RequireAuth>
      <DocumentsPage />
    </RequireAuth>
  );
}

function DocumentsAuditRoute() {
  return (
    <RequireAuth>
      <DocumentsAuditPage />
    </RequireAuth>
  );
}

function PlaceholderRoute() {
  const location = useLocation();
  const cfg = ROUTE_PHASE[location.pathname];
  if (!cfg) return <Navigate to="/app/dashboard" replace />;
  return (
    <RequireAuth>
      <PlaceholderPage {...cfg} />
    </RequireAuth>
  );
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/projects" element={<ProjectSelectionPage />} />
        <Route path="/app/dashboard" element={<DashboardRoute />} />
        <Route path="/app/subjects" element={<SubjectsListRoute />} />
        <Route path="/app/subjects/:subjectId" element={<SubjectDetailRoute />} />
        <Route path="/app/econsent" element={<EConsentRoute />} />
        <Route path="/app/remote-visit" element={<RemoteVisitRoute />} />
        <Route path="/app/epro" element={<EproRoute />} />
        <Route path="/app/ae-sae" element={<SafetyEventsRoute />} />
        <Route path="/app/ae-sae/:eventId" element={<SafetyEventDetailRoute />} />
        <Route path="/app/risk-monitor" element={<RiskMonitorRoute />} />
        <Route path="/app/protocol" element={<ProtocolRoute />} />
        <Route path="/app/reports" element={<ReportsRoute />} />
        <Route path="/app/documents" element={<DocumentsRoute />} />
        <Route path="/app/documents-audit" element={<DocumentsAuditRoute />} />
        {Object.keys(ROUTE_PHASE)
          .filter(
            (p) =>
              p !== "/app/subjects" &&
              p !== "/app/econsent" &&
              p !== "/app/remote-visit" &&
              p !== "/app/epro" &&
              p !== "/app/protocol" &&
              p !== "/app/risk-monitor" &&
              p !== "/app/reports" &&
              p !== "/app/documents" &&
              p !== "/app/documents-audit"
          )
          .map((path) => (
            <Route key={path} path={path} element={<PlaceholderRoute />} />
          ))}
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
