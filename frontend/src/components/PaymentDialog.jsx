import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { brl, todayISO, dt } from "@/lib/format";
import { toast } from "sonner";

export default function PaymentDialog({ ctx, onOpenChange, onSaved }) {
  const open = !!ctx;
  const [paidAmount, setPaidAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState("pix");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ctx) {
      setPaidAmount(String(ctx.installment.amount || ""));
      setPaidAt(todayISO());
      setMethod("pix");
      setNote("");
    }
  }, [ctx]);

  if (!ctx) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/clients/${ctx.client.id}/payments`, {
        installment_number: ctx.installment.number,
        paid_amount: parseFloat(paidAmount) || 0,
        paid_at: paidAt,
        payment_method: method,
        note,
      });
      toast.success("Pagamento registrado");
      onSaved?.();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0B132B] border-slate-800 text-slate-100 max-w-md"
        data-testid="payment-dialog"
      >
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <DialogTitle className="text-center" style={{ fontFamily: "Outfit" }}>
            Registrar pagamento
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {ctx.client.name} · Parcela {ctx.installment.number} · Vencimento{" "}
            {dt(ctx.installment.due_date)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="glass-card p-4 text-center">
            <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Valor devido
            </div>
            <div className="metric-value text-2xl text-white">
              {brl(ctx.installment.amount)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Valor pago (R$)</Label>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 font-mono"
                data-testid="pd-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Data</Label>
              <Input
                required
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500"
                data-testid="pd-date"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="bg-slate-900/60 border-slate-700" data-testid="pd-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Observação</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-slate-900/60 border-slate-700 focus:border-blue-500"
              data-testid="pd-note"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => onOpenChange(false)}
              data-testid="pd-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="pd-submit"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
