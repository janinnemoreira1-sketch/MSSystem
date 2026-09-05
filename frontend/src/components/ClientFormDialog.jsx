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
import { Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

const empty = {
  name: "",
  phone: "",
  loan_amount: "",
  loan_date: todayISO(),
  interest_rate: "0",
  collection_method: "a_vista",
  collection_frequency: "mensal",
  installments_count: "1",
  installment_amount: "",
  first_payment_date: todayISO(),
  notes: "",
};

export default function ClientFormDialog({ open, onOpenChange, client, onSaved }) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (client) {
        setForm({
          name: client.name || "",
          phone: client.phone || "",
          loan_amount: String(client.loan_amount ?? ""),
          loan_date: client.loan_date || todayISO(),
          interest_rate: String(client.interest_rate ?? "0"),
          collection_method: client.collection_method || "a_vista",
          collection_frequency: client.collection_frequency || "mensal",
          installments_count: String(client.installments_count ?? "1"),
          installment_amount: client.installment_amount ? String(client.installment_amount) : "",
          first_payment_date: client.first_payment_date || todayISO(),
          notes: client.notes || "",
        });
      } else {
        setForm(empty);
      }
    }
  }, [open, client]);

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        loan_amount: parseFloat(form.loan_amount) || 0,
        loan_date: form.loan_date,
        interest_rate: parseFloat(form.interest_rate) || 0,
        collection_method: form.collection_method,
        collection_frequency: form.collection_frequency,
        installments_count:
          form.collection_method === "a_vista" ? 1 : parseInt(form.installments_count) || 1,
        installment_amount: form.installment_amount ? parseFloat(form.installment_amount) : null,
        first_payment_date: form.first_payment_date,
        notes: form.notes,
      };
      if (client) {
        await api.patch(`/clients/${client.id}`, payload);
        toast.success("Cliente atualizado com sucesso");
      } else {
        await api.post("/clients", payload);
        toast.success("Cliente adicionado com sucesso");
      }
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
        className="bg-[#0B132B] border-slate-800 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="client-form-dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Outfit" }}>
            {client ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Preencha os dados do empréstimo e a forma de cobrança.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Nome *</Label>
              <Input
                required
                value={form.name}
                onChange={set("name")}
                placeholder="Nome completo"
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500"
                data-testid="cf-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Telefone</Label>
              <Input
                value={form.phone}
                onChange={set("phone")}
                placeholder="(11) 99999-9999"
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500"
                data-testid="cf-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Valor emprestado (R$) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.loan_amount}
                onChange={set("loan_amount")}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 font-mono"
                data-testid="cf-loan-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Data do empréstimo *</Label>
              <Input
                required
                type="date"
                value={form.loan_date}
                onChange={set("loan_date")}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500"
                data-testid="cf-loan-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Taxa de juros (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.interest_rate}
                onChange={set("interest_rate")}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500 font-mono"
                data-testid="cf-interest"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Forma de cobrança *</Label>
              <Select value={form.collection_method} onValueChange={set("collection_method")}>
                <SelectTrigger
                  className="bg-slate-900/60 border-slate-700"
                  data-testid="cf-method"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                  <SelectItem value="a_vista">À Vista (Pagamento único)</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.collection_method === "parcelado" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Frequência</Label>
                  <Select
                    value={form.collection_frequency}
                    onValueChange={set("collection_frequency")}
                  >
                    <SelectTrigger className="bg-slate-900/60 border-slate-700" data-testid="cf-freq">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Nº de parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.installments_count}
                    onChange={set("installments_count")}
                    className="bg-slate-900/60 border-slate-700 focus:border-blue-500 font-mono"
                    data-testid="cf-installments"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-slate-300">Valor por parcela (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Deixe vazio para dividir automaticamente"
                    value={form.installment_amount}
                    onChange={set("installment_amount")}
                    className="bg-slate-900/60 border-slate-700 focus:border-blue-500 font-mono"
                    data-testid="cf-inst-amount"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-slate-300">Data do primeiro pagamento *</Label>
              <Input
                required
                type="date"
                value={form.first_payment_date}
                onChange={set("first_payment_date")}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500"
                data-testid="cf-first-date"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-slate-300">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={set("notes")}
                rows={2}
                className="bg-slate-900/60 border-slate-700 focus:border-blue-500"
                data-testid="cf-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => onOpenChange(false)}
              data-testid="cf-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-500 text-white"
              data-testid="cf-submit"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : client ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
