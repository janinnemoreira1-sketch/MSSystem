import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { brl, dt, daysUntil, statusMeta } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Wallet,
  LogOut,
  Search,
  UserPlus,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  BadgeDollarSign,
  TrendingUp,
  Users,
  Phone,
  Landmark,
  MessageCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import ClientFormDialog from "@/components/ClientFormDialog";
import PaymentDialog from "@/components/PaymentDialog";
import ClientDetailSheet from "@/components/ClientDetailSheet";
import CashFlowChart from "@/components/CashFlowChart";
import MonthlyReportDialog from "@/components/MonthlyReportDialog";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "atrasado", label: "Atrasados" },
  { key: "a_vencer", label: "A Vencer" },
  { key: "pendente", label: "Pendentes" },
  { key: "pago", label: "Pagos" },
];

function MetricCard({ icon: Icon, label, value, hint, tone = "blue", testid }) {
  const toneMap = {
    blue: "from-blue-500/20 to-blue-500/0 text-blue-400 border-blue-500/30",
    emerald: "from-emerald-500/20 to-emerald-500/0 text-emerald-400 border-emerald-500/30",
    amber: "from-amber-500/20 to-amber-500/0 text-amber-400 border-amber-500/30",
    rose: "from-rose-500/20 to-rose-500/0 text-rose-400 border-rose-500/30",
    slate: "from-slate-500/20 to-slate-500/0 text-slate-300 border-slate-500/30",
  };
  return (
    <div className="glass-card glass-card-hover p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
          {label}
        </div>
        <div
          className={`w-9 h-9 rounded-lg bg-gradient-to-br ${toneMap[tone]} border flex items-center justify-center`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="metric-value text-2xl sm:text-3xl text-white">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-2">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("todos");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [paymentCtx, setPaymentCtx] = useState(null); // {client, installment}
  const [detailClient, setDetailClient] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get("/clients"),
      ]);
      setSummary(s.data);
      setClients(c.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const okStatus = filter === "todos" || c.status === filter;
      const okQ =
        !q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        (c.phone || "").includes(q);
      return okStatus && okQ;
    });
  }, [clients, q, filter]);

  const alerts = useMemo(
    () =>
      clients.filter(
        (c) => c.status === "atrasado" || c.status === "a_vencer"
      ),
    [clients]
  );

  const handleDelete = async (c) => {
    if (!window.confirm(`Excluir cliente "${c.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      toast.success("Cliente excluído");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const openPaymentForNext = (c) => {
    const next = (c.installments || []).find((i) => !i.paid);
    if (!next) {
      toast.info("Todas as parcelas já foram pagas.");
      return;
    }
    setPaymentCtx({ client: c, installment: next });
  };

  const sendReminder = (c) => {
    const next = (c.installments || []).find((i) => !i.paid);
    if (!next) {
      toast.info("Não há parcelas em aberto para lembrar.");
      return;
    }
    const phone = (c.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Cliente sem telefone. Cadastre um número para enviar o lembrete.");
      return;
    }
    const business = user?.business_name || user?.name || "MS Soluções Financeiras";
    const dueLabel = new Date(`${next.due_date}T12:00:00`).toLocaleDateString("pt-BR");
    const valueLabel = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(next.amount);
    const msg = `Olá ${c.name}, aqui é ${business}. Passando para lembrar do pagamento no valor de ${valueLabel} com vencimento em ${dueLabel}. Qualquer dúvida, é só responder por aqui. Obrigado!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl bg-[#060A12]/80 border-b border-slate-800/80"
        data-testid="top-header"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>
                {user?.business_name || "MS Soluções Financeiras"}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                Painel de Empréstimos
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm text-slate-200 font-medium" data-testid="header-user-name">
                {user?.name}
              </div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9 rounded-full bg-slate-800/60 hover:bg-slate-700/60 text-slate-200"
                  data-testid="header-menu-btn"
                >
                  <span className="font-semibold text-sm">
                    {(user?.name || "U").slice(0, 1).toUpperCase()}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200">
                <DropdownMenuItem disabled className="text-slate-400">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem onClick={logout} data-testid="logout-menu-item" className="cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Hero header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-2">
              Painel de Controle
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
              style={{ fontFamily: "Outfit" }}
              data-testid="dashboard-title"
            >
              Olá, {user?.name?.split(" ")[0] || "titular"}.
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Um panorama rápido dos empréstimos, cobranças e pagamentos em andamento.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white h-11 px-5 self-start md:self-auto"
            data-testid="add-client-btn"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Novo cliente
          </Button>
          <Button
            onClick={() => setReportOpen(true)}
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white h-11 px-5 self-start md:self-auto"
            data-testid="open-report-btn"
          >
            <FileText className="w-4 h-4 mr-2" /> Relatório mensal
          </Button>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div
            className="glass-card p-4 md:p-5 border-amber-500/30 bg-amber-500/5 flex items-center gap-4"
            data-testid="alerts-banner"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-amber-200 font-medium">
                {alerts.length} cliente(s) com pagamento próximo ou em atraso.
              </div>
              <div className="text-xs text-slate-400 truncate">
                {alerts
                  .slice(0, 3)
                  .map((c) => c.name)
                  .join(" · ")}
                {alerts.length > 3 && ` +${alerts.length - 3}`}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
              onClick={() => setFilter("atrasado")}
              data-testid="alerts-view-btn"
            >
              Ver atrasados
            </Button>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-grid">
          <MetricCard
            testid="metric-total-lent"
            icon={BadgeDollarSign}
            label="Total Emprestado"
            value={brl(summary?.total_lent ?? 0)}
            hint={`${summary?.total_clients ?? 0} clientes ativos`}
            tone="blue"
          />
          <MetricCard
            testid="metric-total-paid"
            icon={CheckCircle2}
            label="Total Recebido"
            value={brl(summary?.total_paid ?? 0)}
            hint="Pagamentos registrados"
            tone="emerald"
          />
          <MetricCard
            testid="metric-balance"
            icon={TrendingUp}
            label="Saldo Pendente"
            value={brl(summary?.balance ?? 0)}
            hint="A receber"
            tone="amber"
          />
          <MetricCard
            testid="metric-overdue"
            icon={AlertTriangle}
            label="Em Atraso"
            value={summary?.overdue ?? 0}
            hint={`${summary?.upcoming ?? 0} a vencer em breve`}
            tone="rose"
          />
        </div>

        {/* Cash flow chart */}
        <CashFlowChart />

        {/* Clients table */}
        <div className="glass-card p-4 md:p-6" data-testid="clients-panel">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "Outfit" }}>
                  Clientes
                </h2>
                <p className="text-xs text-slate-500">
                  {filtered.length} de {clients.length} exibidos
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9 h-10 w-full sm:w-72 bg-slate-900/60 border-slate-700 focus:border-blue-500"
                  data-testid="search-input"
                />
              </div>
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="bg-slate-900/60 border border-slate-800 h-10" data-testid="status-filter-tabs">
                  {FILTERS.map((f) => (
                    <TabsTrigger
                      key={f.key}
                      value={f.key}
                      data-testid={`filter-${f.key}`}
                      className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-300"
                    >
                      {f.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500" data-testid="clients-loading">
              Carregando clientes...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center" data-testid="clients-empty">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-slate-300 font-medium mb-1">Nenhum cliente encontrado</div>
              <div className="text-xs text-slate-500 mb-5">
                Adicione seu primeiro cliente para começar a acompanhar os empréstimos.
              </div>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-500"
                data-testid="empty-add-client-btn"
              >
                <UserPlus className="w-4 h-4 mr-2" /> Adicionar cliente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800/80">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                      Cliente
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                      Valor / Saldo
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                      Cobrança
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                      Próx. vencimento
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="text-right text-slate-400 text-xs uppercase tracking-wider">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const s = statusMeta[c.status] || statusMeta.pendente;
                    const dU = daysUntil(c.next_due_date);
                    return (
                      <TableRow
                        key={c.id}
                        className="border-slate-800/70 hover:bg-slate-800/40 transition-colors"
                        data-testid={`client-row-${c.id}`}
                      >
                        <TableCell>
                          <div className="font-medium text-slate-100">{c.name}</div>
                          {c.phone && (
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-slate-100 text-sm">{brl(c.loan_amount)}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            Saldo: {brl(c.balance)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-300">
                            {c.collection_method === "a_vista"
                              ? "À Vista"
                              : `${c.installments_count}x ${c.collection_frequency || ""}`}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {c.collection_method === "parcelado"
                              ? `${brl(c.installment_amount)} / parcela`
                              : "Pagamento único"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-300 font-mono">
                            {c.next_due_date ? dt(c.next_due_date) : "—"}
                          </div>
                          {c.next_due_date && (
                            <div
                              className={`text-xs mt-0.5 ${
                                dU < 0
                                  ? "text-rose-400"
                                  : dU <= 3
                                    ? "text-amber-400"
                                    : "text-slate-500"
                              }`}
                            >
                              {dU < 0
                                ? `${Math.abs(dU)} dia(s) em atraso`
                                : dU === 0
                                  ? "Vence hoje"
                                  : `Em ${dU} dia(s)`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${s.bg} ${s.color} ${s.border} font-medium`}
                            data-testid={`status-${c.id}`}
                          >
                            <span className={`status-dot mr-2 ${s.dot}`} />
                            {s.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {c.status !== "pago" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 h-8"
                                onClick={() => openPaymentForNext(c)}
                                data-testid={`pay-btn-${c.id}`}
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-1" /> Pagar
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-100"
                                  data-testid={`row-menu-${c.id}`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-slate-900 border-slate-700 text-slate-200"
                              >
                                <DropdownMenuItem
                                  onClick={() => setDetailClient(c)}
                                  data-testid={`view-${c.id}`}
                                >
                                  <Eye className="w-4 h-4 mr-2" /> Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => sendReminder(c)}
                                  data-testid={`remind-${c.id}`}
                                >
                                  <MessageCircle className="w-4 h-4 mr-2" /> Enviar lembrete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing(c);
                                    setFormOpen(true);
                                  }}
                                  data-testid={`edit-${c.id}`}
                                >
                                  <Pencil className="w-4 h-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-700" />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(c)}
                                  className="text-rose-400 focus:text-rose-300"
                                  data-testid={`delete-${c.id}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editing}
        onSaved={() => {
          setFormOpen(false);
          setEditing(null);
          load();
        }}
      />

      <PaymentDialog
        ctx={paymentCtx}
        onOpenChange={(o) => !o && setPaymentCtx(null)}
        onSaved={() => {
          load();
        }}
      />

      <ClientDetailSheet
        client={detailClient}
        onOpenChange={(o) => !o && setDetailClient(null)}
        onPay={(inst) => {
          setPaymentCtx({ client: detailClient, installment: inst });
        }}
        onRemind={() => sendReminder(detailClient)}
        onUndo={async (inst) => {
          try {
            await api.delete(`/clients/${detailClient.id}/payments/${inst.number}`);
            toast.success("Pagamento desfeito");
            const { data } = await api.get(`/clients/${detailClient.id}`);
            setDetailClient(data);
            load();
          } catch (e) {
            toast.error(formatApiError(e));
          }
        }}
      />

      <MonthlyReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        businessName={user?.business_name || user?.name}
      />
    </div>
  );
}
