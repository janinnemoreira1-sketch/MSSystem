export const brl = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

export const dt = (iso) => {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso) : iso;
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const daysUntil = (iso) => {
  if (!iso) return null;
  const target = new Date(`${iso}T12:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
};

export const statusMeta = {
  pago: { label: "Pago", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "text-emerald-400" },
  pendente: { label: "Pendente", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "text-blue-400" },
  a_vencer: { label: "A Vencer", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "text-amber-400" },
  atrasado: { label: "Atrasado", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "text-rose-400" },
};

export const methodLabel = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  cartao: "Cartão",
  outro: "Outro",
};
