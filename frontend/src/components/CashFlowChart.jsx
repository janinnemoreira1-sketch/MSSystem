import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { brl } from "@/lib/format";
import { TrendingUp } from "lucide-react";

export default function CashFlowChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/dashboard/chart?months=6");
        setData(data.buckets || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="glass-card p-5 md:p-6" data-testid="cash-flow-chart">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "Outfit" }}>
              Fluxo dos últimos 6 meses
            </h2>
            <p className="text-xs text-slate-500">Recebido vs. Previsto por mês</p>
          </div>
        </div>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Carregando gráfico...
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0B132B",
                  border: "1px solid #1e293b",
                  borderRadius: "10px",
                  color: "#e2e8f0",
                }}
                formatter={(v, name) => [brl(v), name === "recebido" ? "Recebido" : "Previsto"]}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                formatter={(v) => (v === "recebido" ? "Recebido" : "Previsto")}
              />
              <Bar dataKey="previsto" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={44} />
              <Bar dataKey="recebido" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
