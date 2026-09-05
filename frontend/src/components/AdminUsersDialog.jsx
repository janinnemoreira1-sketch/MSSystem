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
import { Users, Trash2, Search, Loader2, ShieldCheck, Mail, Building2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function AdminUsersDialog({ open, onOpenChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

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

  const remove = async (u) => {
    if (
      !window.confirm(
        `Excluir a conta "${u.email}"? Isso também apagará ${u.clients_count} cliente(s) e todo o histórico dessa conta. Essa ação não pode ser desfeita.`,
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
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(s) ||
      (u.name || "").toLowerCase().includes(s) ||
      (u.business_name || "").toLowerCase().includes(s)
    );
  });

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
            Todos os usuários que criaram uma conta em MS Soluções Financeiras. Cada conta tem
            seus próprios clientes, isolados por segurança.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 my-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por email, nome ou negócio..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-10 bg-slate-900/60 border-slate-700 focus:border-blue-500"
              data-testid="admin-search"
            />
          </div>
          <div className="text-xs text-slate-500">
            {filtered.length} de {users.length} conta(s)
          </div>
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
            {filtered.map((u) => (
              <div
                key={u.id}
                className="glass-card p-4 flex flex-col md:flex-row md:items-center gap-3"
                data-testid={`admin-user-${u.id}`}
              >
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
                    <div className="text-amber-300 font-mono font-semibold">{brl(u.balance)}</div>
                  </div>
                  {u.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-rose-300"
                      onClick={() => remove(u)}
                      data-testid={`admin-delete-${u.id}`}
                      title="Excluir conta e todos os dados"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
