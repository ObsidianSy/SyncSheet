import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Venda } from '@/types';
import { formatCurrency, formatDate, generateId, round2, todayISO } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, ShoppingCart, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const FORMAS_PGTO = ['Pix', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Dinheiro', 'Transferência'];
const PAGE_SIZE = 20;

export default function VendasPage() {
  const { state, setVendas } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Venda>>({});
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [stockWarning, setStockWarning] = useState('');

  const filtered = useMemo(() => {
    return state.vendas.filter(v => {
      const ms = !search || v.numVenda.toLowerCase().includes(search.toLowerCase()) || v.cliente.toLowerCase().includes(search.toLowerCase()) || v.skuProduto.toLowerCase().includes(search.toLowerCase());
      const mst = filterStatus === 'todos' || v.status === filterStatus;
      return ms && mst;
    });
  }, [state.vendas, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const faturamento = state.vendas.filter(v => v.status === 'Pago').reduce((s, v) => s + v.totalVenda, 0);
  const pagas = state.vendas.filter(v => v.status === 'Pago').length;
  const pendentes = state.vendas.filter(v => v.status === 'Pendente').length;
  const ticketMedio = pagas > 0 ? faturamento / pagas : 0;

  const openNew = () => {
    setEditing({
      data: todayISO(),
      numVenda: generateId('V', state.vendas, 'numVenda'),
      codCliente: '', skuProduto: '', cliente: '', quantidade: 1,
      precoUnit: 0, descontoPercent: 0, formaPgto: 'Pix', status: 'Pago',
    });
    setEditIndex(null);
    setStockWarning('');
    setModalOpen(true);
  };

  const openEdit = (v: Venda, idx: number) => { setEditing({ ...v }); setEditIndex(idx); setStockWarning(''); setModalOpen(true); };

  const handleClienteChange = (cod: string) => {
    const cli = state.clientes.find(c => c.codigo === cod);
    setEditing(prev => ({ ...prev, codCliente: cod, cliente: cli?.nome || '' }));
  };

  const handleSkuChange = (sku: string) => {
    const prod = state.produtos.find(p => p.sku === sku);
    setEditing(prev => ({ ...prev, skuProduto: sku, precoUnit: prod?.precoVenda || prev?.precoUnit || 0 }));
    if (prod && prod.estoqueAtual <= 0) {
      setStockWarning(`Atenção: "${prod.produto}" sem estoque (${prod.estoqueAtual} disponíveis)`);
    } else if (prod && (editing.quantidade || 1) > prod.estoqueAtual) {
      setStockWarning(`Atenção: Estoque insuficiente (${prod.estoqueAtual} disponíveis)`);
    } else {
      setStockWarning('');
    }
  };

  const totalVenda = round2((editing.quantidade || 0) * (editing.precoUnit || 0) * (1 - (editing.descontoPercent || 0) / 100));

  const save = () => {
    if (!editing.skuProduto || !editing.quantidade) { toast.error('Campos obrigatórios'); return; }
    const prod = state.produtos.find(p => p.sku === editing.skuProduto);
    if (prod && prod.estoqueAtual < (editing.quantidade || 0)) {
      toast.warning(`Estoque insuficiente (${prod.estoqueAtual} disponíveis). Venda registrada como pré-venda.`);
    }
    const venda: Venda = {
      data: editing.data || todayISO(),
      numVenda: editing.numVenda || '', codCliente: editing.codCliente || '',
      skuProduto: editing.skuProduto || '', cliente: editing.cliente || '',
      quantidade: editing.quantidade || 0, precoUnit: round2(editing.precoUnit || 0),
      descontoPercent: editing.descontoPercent || 0, totalVenda: round2(totalVenda),
      formaPgto: editing.formaPgto || 'Pix', status: (editing.status || 'Pago') as Venda['status'],
    };
    const updated = [...state.vendas];
    if (editIndex !== null) { updated[editIndex] = venda; } else { updated.push(venda); }
    setVendas(updated);
    setModalOpen(false);
    toast.success(editIndex !== null ? 'Venda atualizada' : 'Venda registrada');
  };

  const statusBadge = (s: string) => {
    if (s === 'Pago') return <span className="status-badge status-pago">Pago</span>;
    if (s === 'Pendente') return <span className="status-badge status-pendente">Pendente</span>;
    return <span className="status-badge status-cancelado">Cancelado</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}><ShoppingCart className="w-5 h-5" style={{ color: '#2563EB' }} /></div><div><p className="kpi-label">Vendas</p><p className="kpi-value">{state.vendas.length}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}><DollarSign className="w-5 h-5" style={{ color: '#10B981' }} /></div><div><p className="kpi-label">Faturamento</p><p className="kpi-value text-lg">{formatCurrency(faturamento)}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}><ShoppingCart className="w-5 h-5" style={{ color: '#10B981' }} /></div><div><p className="kpi-label">Pagas</p><p className="kpi-value">{pagas}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}><ShoppingCart className="w-5 h-5" style={{ color: '#F59E0B' }} /></div><div><p className="kpi-label">Pendentes</p><p className="kpi-value">{pendentes}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}><TrendingUp className="w-5 h-5" style={{ color: '#F59E0B' }} /></div><div><p className="kpi-label">Ticket Médio</p><p className="kpi-value text-lg">{formatCurrency(ticketMedio)}</p></div></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar venda..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Venda</Button>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="table-header">
              {['Data', 'Nº Venda', 'Cliente', 'SKU', 'Qtd', 'P. Unit.', 'Desc.%', 'Total', 'Pgto', 'Status'].map(h => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {paginated.map((v, i) => (
                <tr key={i} className="border-b border-border hover:bg-table-hover cursor-pointer even:bg-table-row-alt transition-colors duration-150" onClick={() => openEdit(v, state.vendas.indexOf(v))}>
                  <td className="px-4 py-3">{formatDate(v.data)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{v.numVenda}</td>
                  <td className="px-4 py-3">{v.cliente}</td>
                  <td className="px-4 py-3 font-mono text-xs">{v.skuProduto}</td>
                  <td className="px-4 py-3">{v.quantidade}</td>
                  <td className="px-4 py-3">{formatCurrency(v.precoUnit)}</td>
                  <td className="px-4 py-3">{v.descontoPercent}%</td>
                  <td className="px-4 py-3 font-bold">{formatCurrency(v.totalVenda)}</td>
                  <td className="px-4 py-3">{v.formaPgto}</td>
                  <td className="px-4 py-3">{statusBadge(v.status)}</td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhuma venda</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader><DialogTitle>{editIndex !== null ? 'Editar' : 'Nova'} Venda</DialogTitle></DialogHeader>
          {stockWarning && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning-light text-sm">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span>{stockWarning}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Data *</Label><Input type="date" value={editing.data || ''} onChange={e => setEditing({ ...editing, data: e.target.value })} /></div>
            <div><Label>Nº Venda</Label><Input value={editing.numVenda || ''} disabled /></div>
            <div className="col-span-2">
              <Label>Cliente</Label>
              <Input list="cli-list" value={editing.codCliente || ''} onChange={e => handleClienteChange(e.target.value)} placeholder="Código do cliente" />
              <datalist id="cli-list">{state.clientes.map(c => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</datalist>
              {editing.cliente && <p className="text-xs text-muted-foreground mt-1">{editing.cliente}</p>}
            </div>
            <div className="col-span-2">
              <Label>SKU Produto *</Label>
              <Input list="prod-list-v" value={editing.skuProduto || ''} onChange={e => handleSkuChange(e.target.value)} />
              <datalist id="prod-list-v">{state.produtos.map(p => <option key={p.sku} value={p.sku}>{p.produto}</option>)}</datalist>
            </div>
            <div><Label>Quantidade *</Label><Input type="number" value={editing.quantidade || ''} onChange={e => setEditing({ ...editing, quantidade: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Preço Unitário</Label><Input type="number" step="0.01" value={editing.precoUnit || ''} onChange={e => setEditing({ ...editing, precoUnit: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Desconto %</Label><Input type="number" value={editing.descontoPercent || 0} onChange={e => setEditing({ ...editing, descontoPercent: parseFloat(e.target.value) || 0 })} /></div>
            <div>
              <Label>Total</Label>
              <div className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalVenda)}</div>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={editing.formaPgto || 'Pix'} onValueChange={v => setEditing({ ...editing, formaPgto: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PGTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editing.status || 'Pago'} onValueChange={v => setEditing({ ...editing, status: v as Venda['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
