import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useParams } from "react-router-dom";
import { brl, dt, methodLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Landmark, Printer, CheckCircle2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Receipt() {
  const { token } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/receipts/${token}`);
        setReceipt(data);
      } catch (e) {
        setError(e?.response?.data?.detail || "Recibo não encontrado");
      }
    })();
  }, [token]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-8 text-center max-w-sm" data-testid="receipt-error">
          <div className="text-white font-semibold text-lg mb-2">Recibo indisponível</div>
          <div className="text-slate-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }
  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-slate-400">
        Carregando recibo...
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 flex justify-center print:bg-white print:py-0" data-testid="receipt-page">
      <div className="w-full max-w-2xl">
        {/* Actions - hidden on print */}
        <div className="flex justify-end gap-2 mb-4 print:hidden">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={copyLink}
            data-testid="receipt-copy-link"
          >
            <Copy className="w-4 h-4 mr-2" /> Copiar link
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500 text-white"
            onClick={() => window.print()}
            data-testid="receipt-print-btn"
          >
            <Printer className="w-4 h-4 mr-2" /> Baixar PDF
          </Button>
        </div>

        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-8 md:p-10 print:shadow-none print:rounded-none">
          <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold" style={{ fontFamily: "Outfit" }}>
                  {receipt.business_name}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">
                  Recibo de Pagamento
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase">Nº do recibo</div>
              <div className="text-xs font-mono text-slate-700">
                {receipt.receipt_token?.slice(0, 10).toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div>
              <div className="text-sm text-slate-500">Confirmação de pagamento</div>
              <div className="text-2xl font-bold" style={{ fontFamily: "Outfit" }}>
                {brl(receipt.paid_amount)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-widest">Cliente</div>
              <div className="font-medium">{receipt.client_name}</div>
              {receipt.client_phone && (
                <div className="text-slate-500 text-xs">{receipt.client_phone}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-widest">Data</div>
              <div className="font-medium">{dt(receipt.paid_at)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-widest">
                Forma de pagamento
              </div>
              <div className="font-medium">{methodLabel[receipt.payment_method] || "-"}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-widest">Parcela</div>
              <div className="font-medium">
                {receipt.installment_number} de {receipt.installments_count}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-[11px] text-slate-500 uppercase tracking-widest">
                Contrato base
              </div>
              <div className="font-medium">
                Empréstimo de {brl(receipt.loan_amount)} ·{" "}
                {receipt.collection_method === "a_vista" ? "À Vista" : "Parcelado"}
              </div>
            </div>
            {receipt.note && (
              <div className="col-span-2">
                <div className="text-[11px] text-slate-500 uppercase tracking-widest">
                  Observação
                </div>
                <div className="italic text-slate-700">{receipt.note}</div>
              </div>
            )}
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 text-center text-xs text-slate-500">
            Documento gerado eletronicamente por {receipt.business_name}. <br />
            <span className="inline-flex items-center gap-1 mt-1">
              <ExternalLink className="w-3 h-3" /> Verifique este recibo em: {window.location.href}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          @page { size: A4; margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
