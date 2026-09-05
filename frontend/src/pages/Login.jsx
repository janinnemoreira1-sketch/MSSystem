import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Eye, EyeOff, Loader2, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
    } else {
      toast.success("Bem-vindo(a) de volta!");
    }
  };

  return (
    <div className="min-h-screen w-full flex" data-testid="login-page">
      {/* Left side: brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-slate-900 to-black" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=srgb&fm=jpg&q=85)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            mixBlendMode: "luminosity",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060A12] via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/40">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: "Outfit" }}>
                CrediFlux
              </div>
              <div className="text-blue-300 text-xs uppercase tracking-widest">Gestão de Empréstimos</div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight" style={{ fontFamily: "Outfit" }}>
              Controle total sobre <span className="text-blue-400">seus empréstimos</span> pessoais.
            </h1>
            <p className="text-slate-300 text-base max-w-md leading-relaxed">
              Registre clientes, acompanhe datas de cobrança e visualize o que já foi pago — tudo em um painel
              rápido, seguro e feito para você.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="glass-card px-4 py-2 flex items-center gap-2 text-sm text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Dados privados
              </div>
              <div className="glass-card px-4 py-2 flex items-center gap-2 text-sm text-slate-200">
                <TrendingUp className="w-4 h-4 text-blue-400" /> Painel em tempo real
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500">© 2026 CrediFlux · Todos os direitos reservados</div>
        </div>
      </div>

      {/* Right side: form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <form
          onSubmit={submit}
          className="w-full max-w-md glass-card p-8 space-y-6"
          data-testid="login-form"
        >
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="text-white font-bold text-lg" style={{ fontFamily: "Outfit" }}>
              CrediFlux
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Outfit" }}>
              Entrar na sua conta
            </h2>
            <p className="text-sm text-slate-400 mt-1">Acesse seu painel de gestão de empréstimos.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="login-email-input"
              className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                data-testid="login-toggle-password"
                aria-label="Alternar senha"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2"
              data-testid="login-error"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            data-testid="login-submit-btn"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            Acesso restrito. Aplicativo pessoal de gestão financeira.
          </p>
        </form>
      </div>
    </div>
  );
}
