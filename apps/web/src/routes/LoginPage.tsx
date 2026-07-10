import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { login } from "../lib/api/auth.js";
import { saveSession } from "../lib/session.js";

/** Decorative captcha placeholder — the prototype ships one too. */
const DECORATIVE_CAPTCHA = "8KX2";

const SAMPLE_USERS: ReadonlyArray<{ email: string; label: string }> = [
  { email: "pi-pek@aic-dct.test", label: "PI · 北京协和" },
  { email: "crc-pek@aic-dct.test", label: "CRC · 北京协和" },
  { email: "pm@aic-dct.test", label: "CRO PM" },
  { email: "sponsor@aic-dct.test", label: "申办方管理员" },
];

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("请填写账号和密码");
      return;
    }
    if (captcha.trim() === "") {
      setError("请输入图形验证码");
      return;
    }
    setSubmitting(true);
    try {
      const { session } = await login({ email: email.trim(), password });
      saveSession(session);
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--sidebar)", minWidth: 1280 }}
    >
      {/* Brand panel */}
      <div
        className="hidden lg:flex w-3/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ minHeight: 720 }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, var(--sidebar-primary) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, var(--accent) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{
                background:
                  "linear-gradient(135deg, var(--sidebar-primary), var(--accent))",
              }}
            >
              AIC
            </div>
            <div>
              <div className="text-white font-semibold text-lg leading-tight">
                AIC-DCT
              </div>
              <div className="text-slate-400 text-xs">
                远程智能临床试验操作系统
              </div>
            </div>
          </div>
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold text-white leading-tight">
              AI 驱动的
              <br />
              临床试验
              <br />
              <span style={{ color: "var(--sidebar-primary)" }}>
                全流程管理
              </span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              融合 AI 风险监查、远程访视、ePRO/eCOA 和审计留痕，为临床试验
              提供端到端的智能化解决方案。
            </p>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-4 max-w-2xl">
          {[
            { label: "活跃受试者", value: "120", sub: "AUR-001" },
            { label: "AI 风险预警", value: "6", sub: "待处理" },
            { label: "访视完成率", value: "87%", sub: "本月" },
          ].map((m) => (
            <div
              key={m.label}
              className="p-4 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="text-2xl font-bold text-white">{m.value}</div>
              <div className="text-xs text-slate-300 mt-1">{m.label}</div>
              <div className="text-xs text-slate-500">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div
            className="p-8 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="text-center mb-8">
              <div
                className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-lg mb-4"
                style={{
                  background:
                    "linear-gradient(135deg, var(--sidebar-primary), var(--accent))",
                }}
              >
                AIC
              </div>
              <h2 className="text-xl font-semibold text-white">欢迎登录</h2>
              <p className="text-slate-400 text-sm mt-1">
                AIC-DCT 远程临床试验系统
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">账号 / 邮箱</label>
                <Input
                  icon={<User className="w-4 h-4" />}
                  type="email"
                  placeholder="pi-pek@aic-dct.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="!text-white"
                  style={{ color: "white", background: "rgba(255,255,255,0.08)" }}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">密码</label>
                <Input
                  icon={<Lock className="w-4 h-4" />}
                  type="password"
                  placeholder="至少 4 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ color: "white", background: "rgba(255,255,255,0.08)" }}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">图形验证码</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="请输入验证码"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value)}
                    style={{ color: "white", background: "rgba(255,255,255,0.08)" }}
                  />
                  <div
                    className="w-24 h-10 rounded-lg flex items-center justify-center text-sm font-bold select-none"
                    style={{
                      background: "rgba(59,139,245,0.15)",
                      color: "var(--sidebar-primary)",
                      border: "1px solid rgba(59,139,245,0.3)",
                      fontFamily: "monospace",
                      letterSpacing: "4px",
                      textDecoration: "line-through",
                    }}
                    aria-label={`Captcha ${DECORATIVE_CAPTCHA}`}
                  >
                    {DECORATIVE_CAPTCHA}
                  </div>
                </div>
              </div>

              {error ? (
                <div
                  className="flex items-center gap-2 text-xs text-red-300 px-2 py-1.5 rounded"
                  style={{ background: "rgba(220,38,38,0.12)" }}
                  role="alert"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full justify-center !rounded-lg mt-2"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), var(--sidebar-primary))",
                }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                登录
              </Button>
            </form>

            <details
              className="mt-6 pt-4 border-t text-slate-300"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <summary className="text-xs text-slate-400 cursor-pointer">
                可用种子账号（密码任意 ≥ 4 位）
              </summary>
              <ul className="mt-2 text-xs space-y-1">
                {SAMPLE_USERS.map((u) => (
                  <li
                    key={u.email}
                    className="flex items-center justify-between"
                  >
                    <button
                      type="button"
                      className="text-slate-300 hover:text-white"
                      onClick={() => setEmail(u.email)}
                    >
                      {u.email}
                    </button>
                    <span className="text-slate-500">{u.label}</span>
                  </li>
                ))}
              </ul>
            </details>
            <div
              className="mt-4 pt-4 border-t text-center text-xs text-slate-600"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              符合 21 CFR Part 11 · ICH E6(R2) GCP 标准
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
