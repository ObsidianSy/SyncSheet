import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Conta } from '@/types';
import { formatCurrency, formatDate, getCategoriaLabel, categoriaToCodigo, round2, todayISO } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, FileText, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ContasPageProps { tipo: 'pagar' | 'receber'; }
const PAGE_SIZE = 20;

const FORMAS_PGTO = ['Pix', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Dinheiro', 'Transferência'];

const makeEmptyConta = (): Conta => ({
  vencimento: todayISO(),
  descricao: '', categoria: '', fornecedorCliente: '', formaPgto: '',
  valor: 0, valorPago: 0, dataPgto: '', status: 'Pendente', observacoes: '',
});

export default function ContasPage({ tipo }: ContasPageProps) {
  const { state, setContasPagar, setContasReceber } = useAppContext();
  const contas = tipo === 'pagar' ? state.contasPagar : state.contasReceber;
  const setContas = tipo === 'pagar' ? setContasPagar : setContasReceber;

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conta>(makeEmptyConta());
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const today = todayISO();
  const paidLabel = tipo === 'pagar' ? 'Pago' : 'Recebido';

  const processedContas = useMemo(() => {
    return contas.map(c => {
      if (c.vencimento < today && c.status === 'Pendente') return { ...c, status: 'Vencido' as Conta['status'] };
      return c;
    });
  }, [contas, today]);

  const filtered = useMemo(() => {
    return processedContas.filter(c => {
      const ms = !search || c.descricao.toLowerCase().includes(search.toLowerCase());
      const mst = filterStatus === 'todos' || c.status === filterStatus;
      return ms && mst;
    });
  }, [processedContas, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPendente = processedContas.filter(c => c.status === 'Pendente' || c.status === 'Vencido').reduce((s, c) => s + c.valor, 0);
  const vencidas = processedContas.filter(c => c.status === 'Vencido').length;
  const totalPago = processedContas.filter(c => c.status === 'Pago' || c.status === 'Recebido').reduce((s, c) => s + c.valorPago, 0);

  const openNew = () => { setEditing({ ...makeEmptyConta() }); setEditIndex(null); setModalOpen(true); };
  const openEdit = (c: Conta, idx: number) => { setEditing({ ...c }); setEditIndex(idx); setModalOpen(true); };

  const save = () => {
    if (!editing.descricao) { toast.error('Descrição obrigatória'); return; }
    let final: Conta = {
      ...editing,
      categoria: categoriaToCodigo(editing.categoria, state.categorias),
      valor: round2(editing.valor),
      valorPago: round2(editing.valorPago),
    };
    if ((final.status === 'Pago' || final.status === 'Recebido')) {
      if (!final.dataPgto) final.dataPgto = todayISO();
      if (!final.valorPago) final.valorPago = round2(final.valor);
    }
    const updated = [...contas];
    if (editIndex !== null) { updated[editIndex] = final; } else { updated.push(final); }
    setContas(updated);
    setModalOpen(false);
    toast.success('Conta salva');
  };

  const remove = () => {
    if (editIndex === null) return;
    setContas(contas.filter((_, i) => i !== editIndex));
    setModalOpen(false);
    toast.success('Conta removida');
  };

  const statusBadge = (s: string) => {
    if (s === 'Pago' || s === 'Recebido') return <span className="status-badge status-pago">{s}</span>;
    if (s === 'Pendente') return <span className="status-badge status-pendente">Pendente</span>;
    return <span className="status-badge status-vencido">Vencido</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}><FileText className="w-5 h-5" style={{ color: '#EF4444' }} /></div><div><p className="kpi-label">Total Pendente</p><p className="kpi-value">{formatCurrency(totalPendente)}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}><AlertTriangle className="w-5 h-5" style={{ color: '#EF4444' }} /></div><div><p className="kpi-label">Vencidas</p><p className="kpi-value">{vencidas}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}><DollarSign className="w-5 h-5" style={{ color: '#10B981' }} /></div><div><p className="kpi-label">Total {paidLabel}</p><p className="kpi-value">{formatCurrency(totalPago)}</p></div></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value={paidLabel}>{paidLabel}</SelectItem>
            <SelectItem value="Vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Conta</Button>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="table-header">
              {['Vencimento', 'Descrição', 'Categoria', tipo === 'pagar' ? 'Fornecedor' : 'Cliente', 'Valor', `Valor ${paidLabel}`, `Data ${tipo === 'pagar' ? 'Pgto' : 'Receb.'}`, 'Status'].map(h => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {paginated.map((c, i) => (
                <tr key={i} className={cn("border-b border-border hover:bg-table-hover cursor-pointer even:bg-table-row-alt transition-colors duration-150", c.status === 'Vencido' && 'bg-danger-light')} onClick={() => openEdit(c, contas.indexOf(c))}>
                  <td className="px-4 py-3">{formatDate(c.vencimento)}</td>
                  <td className="px-4 py-3 font-medium">{c.descricao}</td>
                  <td className="px-4 py-3">{getCategoriaLabel(c.categoria, state.categorias)}</td>
                  <td className="px-4 py-3">{c.fornecedorCliente}</td>
                  <td className="px-4 py-3 font-bold">{formatCurrency(c.valor)}</td>
                  <td className="px-4 py-3">{formatCurrency(c.valorPago)}</td>
                  <td className="px-4 py-3">{formatDate(c.dataPgto)}</td>
                  <td className="px-4 py-3">{statusBadge(c.status)}</td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma conta</td></tr>}
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
          <DialogHeader><DialogTitle>{editIndex !== null ? 'Editar' : 'Nova'} Conta</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Vencimento *</Label><Input type="date" value={editing.vencimento} onChange={e => setEditing({ ...editing, vencimento: e.target.value })} /></div>
            <div className="col-span-2"><Label>Descrição *</Label><Input value={editing.descricao} onChange={e => setEditing({ ...editing, descricao: e.target.value })} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoriaToCodigo(editing.categoria, state.categorias)} onValueChange={v => setEditing({ ...editing, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(tipo === 'pagar' ? state.categorias.despesas : state.categorias.receitas).map(c => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.categoria}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tipo === 'pagar' ? 'Fornecedor' : 'Cliente'}</Label>
              {tipo === 'receber' ? (
                <Select value={editing.fornecedorCliente} onValueChange={v => setEditing({ ...editing, fornecedorCliente: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {state.clientes.map(c => <SelectItem key={c.codigo} value={c.nome}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input list="forn-list" value={editing.fornecedorCliente} onChange={e => setEditing({ ...editing, fornecedorCliente: e.target.value })} />
                  <datalist id="forn-list">
                    {Array.from(new Set(state.movimentacoes.map(m => m.fornecedor).filter(Boolean))).map(f => <option key={f} value={f} />)}
                  </datalist>
                </>
              )}
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={editing.formaPgto || ''} onValueChange={v => setEditing({ ...editing, formaPgto: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{FORMAS_PGTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={editing.valor || ''} onChange={e => setEditing({ ...editing, valor: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Valor {paidLabel}</Label><Input type="number" step="0.01" value={editing.valorPago || ''} onChange={e => setEditing({ ...editing, valorPago: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Data {tipo === 'pagar' ? 'Pgto' : 'Recebimento'}</Label><Input type="date" value={editing.dataPgto} onChange={e => setEditing({ ...editing, dataPgto: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v as Conta['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value={paidLabel}>{paidLabel}</SelectItem>
                  <SelectItem value="Vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={editing.observacoes} onChange={e => setEditing({ ...editing, observacoes: e.target.value })} /></div>
          </div>
          <div className="flex justify-between mt-4">
            {editIndex !== null && <Button variant="destructive" onClick={remove}>Excluir</Button>}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
