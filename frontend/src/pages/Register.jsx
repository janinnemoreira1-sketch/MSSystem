import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("A senha precisa ter ao menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setBusy(true);
    try {
      await api.post("/auth/register", {
        email,
        password,
        name,
        business_name: business,
      });
      setSubmitted(true);
      toast.success("Cadastro enviado. Aguarde a aprovação do administrador.");
    } catch (err) {
      const msg = formatApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" data-testid="register-pending">
        <div className="w-full max-w-md glass-card p-8 space-y-5 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center">
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Outfit" }}>
            Aguardando aprovação
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Seu cadastro foi registrado com sucesso. Por segurança, novos painéis passam por
            aprovação do administrador antes do primeiro acesso.
          </p>
          <div className="glass-card p-4 text-left space-y-2">
            <div className="flex items-start gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Você receberá
              acesso assim que o administrador aprovar.
            </div>
            <div className="flex items-start gap-2 text-sm text-slate-300">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> Sua senha está
              protegida com criptografia bcrypt.
            </div>
          </div>
          <Link to="/login" data-testid="pending-back-login">
            <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11">
              Voltar ao login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6" data-testid="register-page">
      <form
        onSubmit={submit}
        className="w-full max-w-md glass-card p-8 space-y-5"
        data-testid="register-form"
      >
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          data-testid="back-to-login"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
        </Link>

        <div className="flex items-center gap-3">
          <Logo size={48} />
          <div>
            <div className="text-white font-bold text-lg" style={{ fontFamily: "Outfit" }}>
              Criar seu painel
            </div>
            <div className="text-xs text-slate-400">MS Soluções Financeiras</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Seu nome *</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Maria Souza"
            className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11"
            data-testid="reg-name"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Nome do painel (opcional)</Label>
          <Input
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Ex: MS Soluções Financeiras"
            className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11"
            data-testid="reg-business"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">E-mail *</Label>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11"
            data-testid="reg-email"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-slate-300">Senha *</Label>
            <div className="relative">
              <Input
                required
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11 pr-9"
                data-testid="reg-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                onClick={() => setShowPwd((s) => !s)}
                aria-label="Alternar senha"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Confirmar</Label>
            <Input
              required
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11"
              data-testid="reg-confirm"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-md p-3 flex gap-2 items-start">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            Novos cadastros passam por <strong className="text-blue-300">aprovação do administrador</strong>{" "}
            antes do primeiro acesso.
          </span>
        </div>

        {error && (
          <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2" data-testid="reg-error">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          data-testid="reg-submit"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar solicitação"}
        </Button>

        <p className="text-xs text-slate-500 text-center">
          Já tem uma conta?{" "}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
