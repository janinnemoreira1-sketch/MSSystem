import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound, ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsDialog({ open, onOpenChange }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
    setShow(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (next.length < 6) return setError("A nova senha deve ter ao menos 6 caracteres.");
    if (next !== confirm) return setError("A confirmação não coincide com a nova senha.");
    if (next === current) return setError("A nova senha deve ser diferente da atual.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      toast.success("Senha alterada com sucesso");
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = formatApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="bg-[#0B132B] border-slate-800 text-slate-100 max-w-md"
        data-testid="settings-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "Outfit" }}>
            <KeyRound className="w-5 h-5 text-blue-400" /> Alterar senha
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Troque a senha do painel periodicamente para manter a conta segura.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="glass-card p-3 flex items-start gap-2 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            Use pelo menos 6 caracteres, combinando letras, números e símbolos. A senha nunca é
            armazenada em texto puro — ela é protegida com bcrypt.
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Senha atual</Label>
            <div className="relative">
              <Input
                required
                type={show ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11 pr-9"
                data-testid="pwd-current"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                onClick={() => setShow((s) => !s)}
                aria-label="Alternar exibição"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Nova senha</Label>
              <Input
                required
                type={show ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11"
                data-testid="pwd-new"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Confirmar</Label>
              <Input
                required
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 h-11"
                data-testid="pwd-confirm"
              />
            </div>
          </div>

          {error && (
            <div
              className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2"
              data-testid="pwd-error"
            >
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => onOpenChange(false)}
              data-testid="pwd-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-500 text-white"
              data-testid="pwd-submit"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
