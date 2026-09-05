import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Calendar,
  CircleDollarSign,
  CheckCircle2,
  Undo2,
  DollarSign,
  MessageCircle,
} from "lucide-react";
import { brl, dt, statusMeta, methodLabel } from "@/lib/format";

export default function ClientDetailSheet({ client, onOpenChange, onPay, onUndo }) {
  if (!client) return null;
  const s = statusMeta[client.status] || statusMeta.pendente;
  const waPhone = (client.phone || "").replace(/\D/g, "");

  return (
    <Sheet open={!!client} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#0B132B] border-slate-800 text-slate-100 w-full sm:max-w-lg overflow-y-auto"
        data-testid="client-detail-sheet"
      >
        <SheetHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-white text-xl" style={{ fontFamily: "Outfit" }}>
                {client.name}
              </SheetTitle>
              <SheetDescription className="text-slate-400 text-xs">
                Cliente desde {dt(client.created_at)}
              </SheetDescription>
            </div>
            <Badge variant="outline" className={`${s.bg} ${s.color} ${s.border}`}>
              <span className={`status-dot mr-2 ${s.dot}`} />
              {s.label}
            </Badge>
          </div>

          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Phone className="w-4 h-4 text-blue-400" />
              {client.phone}
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                  data-testid="wa-link"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="grid grid-cols-3 gap-3 my-6">
          <div className="glass-card p-3">
            <div className="text-[10px] uppercase text-slate-500 mb-1 tracking-widest">
              Emprestado
            </div>
            <div className="metric-value text-sm text-white">{brl(client.loan_amount)}</div>
          </div>
          <div className="glass-card p-3">
            <div className="text-[10px] uppercase text-slate-500 mb-1 tracking-widest">Recebido</div>
            <div className="metric-value text-sm text-emerald-400">{brl(client.total_paid)}</div>
          </div>
          <div className="glass-card p-3">
            <div className="text-[10px] uppercase text-slate-500 mb-1 tracking-widest">Saldo</div>
            <div className="metric-value text-sm text-amber-400">{brl(client.balance)}</div>
          </div>
        </div>

        <div className="glass-card p-4 mb-4 text-sm space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Data do empréstimo
            </span>
            <span className="font-mono">{dt(client.loan_date)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500 flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4" /> Cobrança
            </span>
            <span>
              {client.collection_method === "a_vista"
                ? "À Vista"
                : `${client.installments_count}x ${client.collection_frequency}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500">Juros</span>
            <span className="font-mono">{client.interest_rate}%</span>
          </div>
          {client.notes && (
            <div className="pt-2 border-t border-slate-800/70 text-slate-400 text-xs italic">
              {client.notes}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3 tracking-tight" style={{ fontFamily: "Outfit" }}>
            Parcelas
          </h3>
          <div className="space-y-2">
            {client.installments.map((it) => (
              <div
                key={it.number}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  it.paid
                    ? "bg-emerald-500/5 border-emerald-500/25"
                    : "bg-slate-900/40 border-slate-800"
                }`}
                data-testid={`installment-${it.number}`}
              >
                <div>
                  <div className="text-sm text-slate-200 font-medium">
                    Parcela {it.number} · {brl(it.amount)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {it.paid
                      ? `Pago em ${dt(it.paid_at)} · ${methodLabel[it.payment_method] || ""}`
                      : `Vence em ${dt(it.due_date)}`}
                  </div>
                </div>
                {it.paid ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-rose-300 h-8"
                      onClick={() => onUndo?.(it)}
                      data-testid={`undo-${it.number}`}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
                    onClick={() => onPay?.(it)}
                    data-testid={`pay-inst-${it.number}`}
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-1" /> Pagar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
