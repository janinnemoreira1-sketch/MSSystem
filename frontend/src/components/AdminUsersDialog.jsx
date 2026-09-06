import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl, dt } from "@/lib/format";
import {
  Users,
  Trash2,
  Search,
  Loader2,
  ShieldCheck,
  Mail,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const STATUS_META = {
  approved: {
    label: "Aprovado",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  pending: {
    label: "Aguardando aprovação",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: Clock,
  },
  rejected: {
    label: "Recusado",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    icon: XCircle,
  },
};

export default function AdminUsersDialog({ open, onOpenChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all"); // all | pending

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data.users || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const setStatus = async (u, status) => {
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status });
      toast.success(
        status === "approved"
          ? "Cadastro aprovado"
          : status === "rejected"
            ? "Cadastro recusado"
            : "Status atualizado",
      );
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const remove = async (u) => {
    if (
      !window.confirm(
        `Excluir a conta "${u.email}"? Isso também apagará ${u.clients_count} cliente(s) desta conta. Ação irreversível.`,
      )
    )
      return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("Conta excluída");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const filtered = users.filter((u) => {
    if (tab === "pending" && u.status !== "pending") return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(s) ||
      (u.name || "").toLowerCase().includes(s) ||
      (u.business_name || "").toLowerCase().includes(s)
    );
  });

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0B132B] border-slate-800 text-slate-100 max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="admin-users-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "Outfit" }}>
            <ShieldCheck className="w-5 h-5 text-blue-400" /> Contas cadastradas no painel
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Aprove ou recuse novos cadastros. Cada conta continua com clientes isolados por
            segurança.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 my-2">
          <Button
            size="sm"
            variant={tab === "all" ? "default" : "outline"}
            className={
              tab === "all"
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "border-slate-700 text-slate-300 hover:bg-slate-800"
            }
            onClick={() => setTab("all")}
            data-testid="admin-tab-all"
          >
            Todas · {users.length}
          </Button>
          <Button
            size="sm"
            variant={tab === "pending" ? "default" : "outline"}
            className={
              tab === "pending"
                ? "bg-amber-500 hover:bg-amber-400 text-slate-900"
                : "border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
            }
            onClick={() => setTab("pending")}
            data-testid="admin-tab-pending"
          >
            Aguardando · {pendingCount}
          </Button>
        </div>

        <div className="relative mb-2">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por email, nome ou negócio..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-10 bg-slate-900/60 border-slate-700 focus:border-blue-500"
            data-testid="admin-search"
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando contas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhuma conta encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((u) => {
              const st = STATUS_META[u.status] || STATUS_META.approved;
              const StIcon = st.icon;
              return (
                <div
                  key={u.id}
                  className="glass-card p-4 flex flex-col gap-3"
                  data-testid={`admin-user-${u.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-slate-100 truncate">
                          {u.business_name || u.name || u.email}
                        </div>
                        {u.role === "admin" && (
                          <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 border">
                            Administrador
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`${st.bg} ${st.color} ${st.border} inline-flex items-center gap-1`}
                          data-testid={`admin-status-${u.id}`}
                        >
                          <StIcon className="w-3 h-3" /> {st.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {u.email}
                        </span>
                        {u.business_name && u.name && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {u.name}
                          </span>
                        )}
                        <span className="text-slate-500">Cadastrado em {dt(u.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <div className="text-[10px] uppercase text-slate-500 tracking-widest">
                          Clientes
                        </div>
                        <div className="text-slate-100 font-mono font-semibold">
                          {u.clients_count}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase text-slate-500 tracking-widest">
                          Emprestado
                        </div>
                        <div className="text-blue-300 font-mono font-semibold">
                          {brl(u.total_lent)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] uppercase text-slate-500 tracking-widest">
                          Saldo
                        </div>
                        <div className="text-amber-300 font-mono font-semibold">
                          {brl(u.balance)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {u.role !== "admin" && (
                    <div className="flex items-center gap-2 flex-wrap justify-end border-t border-slate-800/70 pt-3">
                      {u.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
                            onClick={() => setStatus(u, "approved")}
                            data-testid={`admin-approve-${u.id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 h-8"
                            onClick={() => setStatus(u, "rejected")}
                            data-testid={`admin-reject-${u.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Recusar
                          </Button>
                        </>
                      )}
                      {u.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 h-8"
                          onClick={() => setStatus(u, "rejected")}
                          data-testid={`admin-block-${u.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Bloquear
                        </Button>
                      )}
                      {u.status === "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 h-8"
                          onClick={() => setStatus(u, "approved")}
                          data-testid={`admin-reactivate-${u.id}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reativar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-rose-300 h-8"
                        onClick={() => remove(u)}
                        data-testid={`admin-delete-${u.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
