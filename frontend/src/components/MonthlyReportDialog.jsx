import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, dt, methodLabel } from "@/lib/format";
import { Printer, Loader2, FileText } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function MonthlyReportDialog({ open, onOpenChange, businessName }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  const load = async (y = year, m = month) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/monthly?year=${y}&month=${m}`);
      setData(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleChange = (y, m) => {
    setYear(y);
    setMonth(m);
    load(y, m);
  };

  const doPrint = () => {
    const html = buildPrintHtml(data, businessName);
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Permita pop-ups para gerar o PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0B132B] border-slate-800 text-slate-100 max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="report-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "Outfit" }}>
            <FileText className="w-5 h-5 text-blue-400" /> Relatório Mensal
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Resumo do mês com o que entrou e o que ainda falta receber.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          <Select value={month} onValueChange={(v) => handleChange(year, v)}>
            <SelectTrigger className="bg-slate-900/60 border-slate-700 w-full sm:w-40" data-testid="report-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              {MONTHS_PT.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={(v) => handleChange(v, month)}>
            <SelectTrigger className="bg-slate-900/60 border-slate-700 w-full sm:w-32" data-testid="report-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button
            onClick={doPrint}
            disabled={!data || loading}
            className="bg-blue-600 hover:bg-blue-500 text-white"
            data-testid="report-download-btn"
          >
            <Printer className="w-4 h-4 mr-2" /> Baixar PDF
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Gerando resumo...
          </div>
        ) : data ? (
          <div className="space-y-5" data-testid="report-content">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="glass-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Recebido</div>
                <div className="metric-value text-xl text-emerald-400">{brl(data.total_received)}</div>
                <div className="text-xs text-slate-500 mt-1">{data.count_received} pagamento(s)</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Previsto</div>
                <div className="metric-value text-xl text-blue-400">{brl(data.total_expected)}</div>
                <div className="text-xs text-slate-500 mt-1">{data.count_expected} parcela(s)</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">A receber</div>
                <div className="metric-value text-xl text-amber-400">{brl(data.outstanding)}</div>
                <div className="text-xs text-slate-500 mt-1">saldo do mês</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-2" style={{ fontFamily: "Outfit" }}>
                Pagamentos recebidos
              </h3>
              {data.received.length === 0 ? (
                <div className="text-xs text-slate-500 italic px-1">Nenhum pagamento recebido neste mês.</div>
              ) : (
                <div className="glass-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
                        <th className="p-3">Data</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Método</th>
                        <th className="p-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.received.map((r, i) => (
                        <tr key={i} className="border-b border-slate-800/60 last:border-none">
                          <td className="p-3 font-mono text-slate-300">{dt(r.paid_at)}</td>
                          <td className="p-3 text-slate-200">{r.client_name}</td>
                          <td className="p-3 text-slate-400">{methodLabel[r.payment_method] || "-"}</td>
                          <td className="p-3 text-right font-mono text-emerald-400">{brl(r.paid_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-2" style={{ fontFamily: "Outfit" }}>
                Parcelas do mês
              </h3>
              {data.expected.length === 0 ? (
                <div className="text-xs text-slate-500 italic px-1">Nenhuma parcela com vencimento neste mês.</div>
              ) : (
                <div className="glass-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
                        <th className="p-3">Vencimento</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expected.map((e, i) => (
                        <tr key={i} className="border-b border-slate-800/60 last:border-none">
                          <td className="p-3 font-mono text-slate-300">{dt(e.due_date)}</td>
                          <td className="p-3 text-slate-200">{e.client_name}</td>
                          <td className={`p-3 ${e.paid ? "text-emerald-400" : "text-amber-400"}`}>
                            {e.paid ? "Pago" : "Em aberto"}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-200">{brl(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPrintHtml(d, businessName) {
  if (!d) return "";
  const business = businessName || "MS Soluções Financeiras";
  const monthLabel = `${MONTHS_PT[d.month - 1]}/${d.year}`;
  const rows = (arr, cols) =>
    arr.map((r) => `<tr>${cols.map((c) => `<td>${c(r)}</td>`).join("")}</tr>`).join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
  <title>Relatório ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .muted { color: #64748b; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .card .label { text-transform: uppercase; letter-spacing: 1px; font-size: 10px; color: #64748b; }
    .card .val { font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    th { text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: #64748b; }
    .right { text-align: right; }
    .section-title { font-size: 13px; font-weight: 700; margin: 22px 0 8px; }
    .brand { color: #2563eb; font-weight: 700; }
    @page { size: A4; margin: 15mm; }
  </style></head><body>
  <div class="brand">${business}</div>
  <h1>Relatório Mensal — ${monthLabel}</h1>
  <div class="muted">Gerado em ${new Date().toLocaleString("pt-BR")}</div>

  <div class="grid">
    <div class="card"><div class="label">Recebido</div><div class="val" style="color:#10b981">${brl(d.total_received)}</div><div class="muted">${d.count_received} pagamento(s)</div></div>
    <div class="card"><div class="label">Previsto</div><div class="val" style="color:#2563eb">${brl(d.total_expected)}</div><div class="muted">${d.count_expected} parcela(s)</div></div>
    <div class="card"><div class="label">A receber</div><div class="val" style="color:#d97706">${brl(d.outstanding)}</div><div class="muted">saldo do mês</div></div>
  </div>

  <div class="section-title">Pagamentos recebidos</div>
  ${d.received.length === 0 ? '<div class="muted">Nenhum pagamento recebido neste mês.</div>' : `
    <table><thead><tr><th>Data</th><th>Cliente</th><th>Método</th><th class="right">Valor</th></tr></thead>
    <tbody>${rows(d.received, [
      (r) => dt(r.paid_at),
      (r) => r.client_name,
      (r) => methodLabel[r.payment_method] || "-",
      (r) => `<span class="right" style="color:#10b981">${brl(r.paid_amount)}</span>`,
    ])}</tbody></table>`}

  <div class="section-title">Parcelas do mês</div>
  ${d.expected.length === 0 ? '<div class="muted">Nenhuma parcela com vencimento neste mês.</div>' : `
    <table><thead><tr><th>Vencimento</th><th>Cliente</th><th>Status</th><th class="right">Valor</th></tr></thead>
    <tbody>${rows(d.expected, [
      (e) => dt(e.due_date),
      (e) => e.client_name,
      (e) => (e.paid ? '<span style="color:#10b981">Pago</span>' : '<span style="color:#d97706">Em aberto</span>'),
      (e) => `<span class="right">${brl(e.amount)}</span>`,
    ])}</tbody></table>`}
  </body></html>`;
}
