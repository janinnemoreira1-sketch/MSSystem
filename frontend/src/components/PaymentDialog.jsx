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
import { CheckCircle2, Loader2, Copy, ExternalLink } from "lucide-react";
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
  const [receiptToken, setReceiptToken] = useState(null);

  useEffect(() => {
    if (ctx) {
      setPaidAmount(String(ctx.installment.amount || ""));
      setPaidAt(todayISO());
      setMethod("pix");
      setNote("");
      setReceiptToken(null);
    }
  }, [ctx]);

  if (!ctx) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/clients/${ctx.client.id}/payments`, {
        installment_number: ctx.installment.number,
        paid_amount: parseFloat(paidAmount) || 0,
        paid_at: paidAt,
        payment_method: method,
        note,
      });
      const inst = (data.installments || []).find(
        (i) => i.number === ctx.installment.number
      );
      const token = inst?.receipt_token;
      toast.success("Pagamento registrado");
      if (token) setReceiptToken(token);
      onSaved?.(token);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const receiptUrl = receiptToken ? `${window.location.origin}/r/${receiptToken}` : null;

  const copyLink = async () => {
    if (!receiptUrl) return;
    try {
      await navigator.clipboard.writeText(receiptUrl);
      toast.success("Link do recibo copiado");
    } catch {
      toast.error("Não foi possível copiar");
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
            {receiptToken ? (
              <div className="w-full flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800"
                  onClick={copyLink}
                  data-testid="pd-copy-receipt"
                >
                  <Copy className="w-4 h-4 mr-2" /> Copiar recibo
                </Button>
                <a
                  href={`/r/${receiptToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                  data-testid="pd-open-receipt"
                >
                  <Button
                    type="button"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Abrir recibo
                  </Button>
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:bg-slate-800"
                  onClick={() => onOpenChange(false)}
                  data-testid="pd-close"
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <>
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
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
