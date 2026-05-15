import { useAppContext } from '@/contexts/AppContext';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Card } from '@/components/ui/card';
import {
  DollarSign, TrendingUp, ShoppingCart, Users, Package,
  AlertTriangle, XCircle, BarChart3, Percent,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

function KpiCard({ icon: Icon, label, value, iconBg, iconColor }: {
  icon: any; label: string; value: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ backgroundColor: iconBg }}>
        <Icon className="w-6 h-6" style={{ color: iconColor }} />
      </div>
      <div>
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { state } = useAppContext();
  const { vendas, produtos, clientes, dreRows, contasPagar, contasReceber } = state;

  const receitaBruta = dreRows.find(r => r.descricao === 'RECEITA BRUTA TOTAL')?.total || 0;
  const lucroBruto = dreRows.find(r => r.descricao === 'LUCRO BRUTO')?.total || 0;
  const resultadoLiquido = dreRows.find(r => r.descricao === 'RESULTADO LÍQUIDO')?.total || 0;
  const margemLiquida = receitaBruta !== 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;
  const margemDisplay = receitaBruta === 0 ? '—' : formatPercent(margemLiquida);

  const vendasPagas = vendas.filter(v => v.status === 'Pago');
  const faturamento = vendasPagas.reduce((s, v) => s + v.totalVenda, 0);
  const ticketMedio = vendasPagas.length > 0 ? faturamento / vendasPagas.length : 0;

  const valorEstoque = produtos.reduce((s, p) => s + p.valorEstoque, 0);
  const repor = produtos.filter(p => p.status === 'REPOR').length;
  const semEstoque = produtos.filter(p => p.status === 'SEM ESTOQUE').length;

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const receitaRow = dreRows.find(r => r.descricao === 'RECEITA BRUTA TOTAL');
  const despesasRow = dreRows.find(r => r.descricao === 'TOTAL DESPESAS OPERACIONAIS');
  const resultadoRow = dreRows.find(r => r.descricao === 'RESULTADO LÍQUIDO');

  const chartData = months.map((m, i) => ({
    name: m,
    Receita: receitaRow?.valores[i] || 0,
    Despesas: despesasRow?.valores[i] || 0,
    Resultado: resultadoRow?.valores[i] || 0,
  }));

  const receberPendente = contasReceber.filter(c => c.status === 'Pendente').reduce((s, c) => s + c.valor, 0);
  const receberRecebido = contasReceber.filter(c => c.status === 'Recebido').reduce((s, c) => s + c.valorPago, 0);
  const pagarPendente = contasPagar.filter(c => c.status === 'Pendente' || c.status === 'Vencido').reduce((s, c) => s + c.valor, 0);
  const pagarPago = contasPagar.filter(c => c.status === 'Pago').reduce((s, c) => s + c.valorPago, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="section-title">Indicadores Financeiros</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={DollarSign} label="Receita Bruta" value={formatCurrency(receitaBruta)} iconBg="rgba(16,185,129,0.1)" iconColor="#10B981" />
          <KpiCard icon={TrendingUp} label="Lucro Bruto" value={formatCurrency(lucroBruto)} iconBg="rgba(37,99,235,0.1)" iconColor="#2563EB" />
          <KpiCard icon={BarChart3} label="Resultado Líquido" value={formatCurrency(resultadoLiquido)} iconBg={resultadoLiquido >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)"} iconColor={resultadoLiquido >= 0 ? '#10B981' : '#EF4444'} />
          <KpiCard icon={Percent} label="Margem Líquida" value={margemDisplay} iconBg="rgba(245,158,11,0.1)" iconColor="#F59E0B" />
        </div>
      </div>

      <div>
        <h2 className="section-title">Indicadores de Vendas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={ShoppingCart} label="Total de Vendas" value={String(vendas.length)} iconBg="rgba(37,99,235,0.1)" iconColor="#2563EB" />
          <KpiCard icon={DollarSign} label="Faturamento" value={formatCurrency(faturamento)} iconBg="rgba(16,185,129,0.1)" iconColor="#10B981" />
          <KpiCard icon={TrendingUp} label="Ticket Médio" value={formatCurrency(ticketMedio)} iconBg="rgba(245,158,11,0.1)" iconColor="#F59E0B" />
          <KpiCard icon={Users} label="Clientes" value={String(clientes.length)} iconBg="rgba(37,99,235,0.1)" iconColor="#2563EB" />
        </div>
      </div>

      <div>
        <h2 className="section-title">Indicadores de Estoque</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Package} label="Produtos" value={String(produtos.length)} iconBg="rgba(37,99,235,0.1)" iconColor="#2563EB" />
          <KpiCard icon={DollarSign} label="Valor em Estoque" value={formatCurrency(valorEstoque)} iconBg="rgba(37,99,235,0.1)" iconColor="#2563EB" />
          <KpiCard icon={AlertTriangle} label="Precisam Repor" value={String(repor)} iconBg="rgba(245,158,11,0.1)" iconColor="#F59E0B" />
          <KpiCard icon={XCircle} label="Sem Estoque" value={String(semEstoque)} iconBg="rgba(239,68,68,0.1)" iconColor="#EF4444" />
        </div>
      </div>

      <Card className="p-6 rounded-2xl">
        <h2 className="section-title">Receita vs Despesas por Mês</h2>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,32%,91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#64748B' }} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid hsl(214,32%,91%)', borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Receita" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Resultado" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 rounded-2xl">
        <h2 className="section-title">Posição de Contas</h2>
        <div className="space-y-2">
          {[
            { label: 'A Receber — Pendente', value: receberPendente, bg: 'bg-success-light' },
            { label: 'A Receber — Recebido', value: receberRecebido, bg: 'bg-card' },
            { label: 'A Pagar — Pendente', value: pagarPendente, bg: 'bg-danger-light' },
            { label: 'A Pagar — Pago', value: pagarPago, bg: 'bg-card' },
            { label: 'Saldo Líquido', value: receberPendente - pagarPendente, bg: 'bg-info-light' },
          ].map(item => (
            <div key={item.label} className={`flex justify-between items-center p-3 rounded-lg ${item.bg}`}>
              <span className="text-sm font-medium">{item.label}</span>
              <span className={`font-bold ${item.label === 'Saldo Líquido' ? 'text-lg' : ''}`}>{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
