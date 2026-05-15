import React, { useCallback, useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import {
  BarChart3, Users, Package, ArrowDownToLine, ShoppingCart,
  Wallet, FileText, FileCheck, TrendingUp, Tags, Upload, Download,
  Menu, X, Bell, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { todayISO } from '@/utils/formatters';

const navItems = [
  { to: '/', label: 'Painel', icon: BarChart3 },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowDownToLine },
  { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { to: '/fluxo-de-caixa', label: 'Fluxo de Caixa', icon: Wallet },
  { to: '/contas-a-pagar', label: 'Contas a Pagar', icon: FileText },
  { to: '/contas-a-receber', label: 'Contas a Receber', icon: FileCheck },
  { to: '/dre', label: 'DRE', icon: TrendingUp },
  { to: '/categorias', label: 'Categorias', icon: Tags },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, downloadExcel, loadFromExcel } = useAppContext();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const handleUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      loadFromExcel(buffer);
    };
    input.click();
  }, [loadFromExcel]);

  const currentPage = navItems.find(n => n.to === location.pathname)?.label || 'Painel';

  const alerts = useMemo(() => {
    const items: { label: string; count: number; color: string; link: string }[] = [];
    const repor = state.produtos.filter(p => p.status === 'REPOR').length;
    const semEstoque = state.produtos.filter(p => p.status === 'SEM ESTOQUE').length;
    const today = todayISO();
    const vencidasPagar = state.contasPagar.filter(c => c.vencimento < today && c.status === 'Pendente').length;
    const vencidasReceber = state.contasReceber.filter(c => c.vencimento < today && c.status === 'Pendente').length;
    if (repor > 0) items.push({ label: 'Produtos para repor', count: repor, color: 'text-warning', link: '/produtos' });
    if (semEstoque > 0) items.push({ label: 'Produtos sem estoque', count: semEstoque, color: 'text-destructive', link: '/produtos' });
    if (vencidasPagar > 0) items.push({ label: 'Contas a pagar vencidas', count: vencidasPagar, color: 'text-destructive', link: '/contas-a-pagar' });
    if (vencidasReceber > 0) items.push({ label: 'Contas a receber vencidas', count: vencidasReceber, color: 'text-destructive', link: '/contas-a-receber' });
    return items;
  }, [state]);

  const totalAlerts = alerts.reduce((s, a) => s + a.count, 0);

  return (
    <div className="min-h-screen flex w-full">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-[240px] bg-sidebar flex flex-col transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="SyncSheet" className="w-9 h-9 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-display font-bold text-sidebar-foreground leading-tight">SyncSheet</span>
            <span className="text-[10px] text-sidebar-muted">Gestão Financeira</span>
          </div>
          <button className="lg:hidden ml-auto text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 mx-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
                isActive
                  ? "bg-sidebar-active text-white font-medium border-l-[3px] border-sidebar-primary"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
              )}
              end={item.to === '/'}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 space-y-2 border-t border-sidebar-border">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-sidebar-border text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground bg-transparent"
            onClick={handleUpload}
          >
            <Upload className="w-4 h-4" /> Carregar Planilha
          </Button>
          {state.isLoaded && (
            <Button
              className="w-full justify-start gap-2 bg-sidebar-primary hover:bg-sidebar-primary/80 text-white"
              onClick={downloadExcel}
            >
              <Download className="w-4 h-4" /> Baixar Planilha
            </Button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] bg-card border-b flex items-center px-4 gap-4 sticky top-0 z-30">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-lg text-foreground">{currentPage}</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className={cn(
              "text-xs px-2.5 py-1 rounded-full font-semibold",
              state.isLoaded ? "status-pago" : "bg-muted text-muted-foreground"
            )}>
              {state.isLoaded ? '✓ Planilha carregada' : 'Sem planilha'}
            </span>

            {state.isLoaded && totalAlerts > 0 && (
              <div className="relative">
                <button onClick={() => setAlertsOpen(!alertsOpen)} className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalAlerts}
                  </span>
                </button>
                {alertsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAlertsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-72 bg-card border rounded-xl shadow-lg z-50 overflow-hidden">
                      <div className="p-3 border-b font-semibold text-sm">Alertas</div>
                      {alerts.map((a, i) => (
                        <NavLink key={i} to={a.link} onClick={() => setAlertsOpen(false)} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                          <span className="text-sm">{a.label}</span>
                          <span className={cn("font-bold text-sm", a.color)}>{a.count}</span>
                        </NavLink>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {state.isLoaded && (
              <Button size="sm" onClick={downloadExcel} className="bg-primary hover:bg-primary/80 text-primary-foreground">
                <Download className="w-4 h-4 mr-1" /> Baixar
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto bg-background">
          {children}
        </main>
        <footer className="border-t bg-card px-4 py-3 text-center text-xs text-muted-foreground">
          © SyncSheet 2026 - Todos os direitos reservados
        </footer>
      </div>
    </div>
  );
}
