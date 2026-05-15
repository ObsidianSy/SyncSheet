import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Movimentacao, Conta, LancamentoFC } from '@/types';
import { formatCurrency, formatDate, round2, todayISO } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

export default function MovimentacoesPage() {
  const { state, setMovimentacoes, setFluxoCaixa, setContasPagar } = useAppContext();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Movimentacao>>({});
  const [page, setPage] = useState(1);
  const [gerarFin, setGerarFin] = useState(false);
  const [tipoFin, setTipoFin] = useState<'avista' | 'aprazo'>('avista');
  const [vencimento, setVencimento] = useState(todayISO());

  const fornecedores = useMemo(() =>
    Array.from(new Set(state.movimentacoes.map(m => m.fornecedor).filter(Boolean))),
    [state.movimentacoes]
  );

  const filtered = useMemo(() => {
    return state.movimentacoes.filter(m => {
      if (!search) return true;
      const s = search.toLowerCase();
      return m.sku.toLowerCase().includes(s) || m.produto.toLowerCase().includes(s);
    });
  }, [state.movimentacoes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalQtd = state.movimentacoes.reduce((s, m) => s + m.quantidade, 0);
  const totalValor = state.movimentacoes.reduce((s, m) => s + (m.custoUnit * m.quantidade), 0);

  const openNew = () => {
    setEditing({ data: todayISO(), sku: '', produto: '', fornecedor: '', notaFiscal: '', quantidade: 0, custoUnit: 0 });
    setGerarFin(false);
    setTipoFin('avista');
    setVencimento(todayISO());
    setModalOpen(true);
  };

  const handleSkuChange = (sku: string) => {
    const prod = state.produtos.find(p => p.sku === sku);
    setEditing(prev => ({ ...prev, sku, produto: prod?.produto || '', custoUnit: prod?.precoCusto || prev?.custoUnit || 0 }));
  };

  const save = () => {
    if (!editing.sku || !editing.quantidade) { toast.error('SKU e Quantidade são obrigatórios'); return; }
    const custoTotal = round2((editing.quantidade || 0) * (editing.custoUnit || 0));
    const prod = state.produtos.find(p => p.sku === editing.sku);
    const data = editing.data || todayISO();
    const fornecedor = editing.fornecedor || '';
    // Nota fiscal: texto livre (números, letras, hífens). Sempre persistido como string.
    const nf = String(editing.notaFiscal ?? '').trim();
    const movId = `mov-${data}-${editing.sku}-${nf || Date.now()}`;
    const mov: Movimentacao = {
      id: movId,
      data, sku: editing.sku || '', produto: prod?.produto || editing.produto || '',
      fornecedor, notaFiscal: nf,
      quantidade: parseInt(String(editing.quantidade || 0), 10), custoUnit: round2(editing.custoUnit || 0), custoTotal,
      status: gerarFin && tipoFin === 'aprazo' ? 'Pendente' : (gerarFin ? 'Confirmada' : undefined),
    };
    setMovimentacoes([...state.movimentacoes, mov]);

    if (gerarFin && custoTotal > 0) {
      const origemId = movId;
      if (tipoFin === 'avista') {
        const lanc: LancamentoFC = {
          data, descricao: `Compra ${prod?.produto || editing.sku}${nf ? ' (NF ' + nf + ')' : ''}`,
          categoria: 'D01', clienteFornecedor: fornecedor, formaPgto: '',
          valor: round2(custoTotal), status: 'Confirmado', observacoes: 'Auto: entrada de estoque',
          origemTipo: 'movimentacao', origemId,
        };
        setFluxoCaixa({ ...state.fluxoCaixa, saidas: [...state.fluxoCaixa.saidas, lanc] });
      } else {
        const conta: Conta = {
          vencimento, descricao: `Compra ${prod?.produto || editing.sku}${nf ? ' (NF ' + nf + ')' : ''}`,
          categoria: 'D01', fornecedorCliente: fornecedor, formaPgto: '',
          valor: round2(custoTotal), valorPago: 0, dataPgto: '', status: 'Pendente',
          observacoes: 'Auto: entrada de estoque', origemTipo: 'movimentacao', origemId,
        };
        setContasPagar([...state.contasPagar, conta]);
      }
    }

    setModalOpen(false);
    toast.success('Entrada registrada');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}><ArrowDownToLine className="w-5 h-5" style={{ color: '#2563EB' }} /></div><div><p className="kpi-label">Total Entradas (Qtd)</p><p className="kpi-value">{totalQtd}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}><ArrowDownToLine className="w-5 h-5" style={{ color: '#10B981' }} /></div><div><p className="kpi-label">Valor Total</p><p className="kpi-value">{formatCurrency(totalValor)}</p></div></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por SKU ou produto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Entrada</Button>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="table-header">
              {['Data', 'SKU', 'Produto', 'Fornecedor', 'NF', 'Qtd', 'Custo Unit.', 'Custo Total', 'Status'].map(h => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {paginated.map((m, i) => (
                <tr key={i} className="border-b border-border hover:bg-table-hover even:bg-table-row-alt transition-colors duration-150">
                  <td className="px-4 py-3">{formatDate(m.data)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.sku}</td>
                  <td className="px-4 py-3">{m.produto}</td>
                  <td className="px-4 py-3">{m.fornecedor}</td>
                  <td className="px-4 py-3">{m.notaFiscal}</td>
                  <td className="px-4 py-3 font-bold">{m.quantidade}</td>
                  <td className="px-4 py-3">{formatCurrency(m.custoUnit)}</td>
                  <td className="px-4 py-3 font-bold">{formatCurrency(m.quantidade * m.custoUnit)}</td>
                  <td className="px-4 py-3">
                    {m.status === 'Confirmada'
                      ? <span className="status-badge status-pago">Confirmada</span>
                      : m.status === 'Pendente'
                        ? <span className="status-badge status-pendente">Pendente</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhuma movimentação</td></tr>}
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Entrada de Estoque</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Data *</Label><Input type="date" value={editing.data || ''} onChange={e => setEditing({ ...editing, data: e.target.value })} /></div>
            <div>
              <Label>SKU *</Label>
              <Input list="sku-list" value={editing.sku || ''} onChange={e => handleSkuChange(e.target.value)} />
              <datalist id="sku-list">{state.produtos.map(p => <option key={p.sku} value={p.sku}>{p.produto}</option>)}</datalist>
            </div>
            <div className="col-span-2"><Label>Produto</Label><Input disabled value={editing.produto || ''} /></div>
            <div>
              <Label>Fornecedor</Label>
              <Input list="forn-mov-list" value={editing.fornecedor || ''} onChange={e => setEditing({ ...editing, fornecedor: e.target.value })} />
              <datalist id="forn-mov-list">{fornecedores.map(f => <option key={f} value={f} />)}</datalist>
            </div>
            <div><Label>Nota Fiscal</Label><Input type="text" inputMode="text" placeholder="NF-1023 ou 1023" value={editing.notaFiscal ?? ''} onChange={e => setEditing({ ...editing, notaFiscal: e.target.value })} /></div>
            <div><Label>Quantidade *</Label><Input type="number" value={editing.quantidade || ''} onChange={e => setEditing({ ...editing, quantidade: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Custo Unitário *</Label><Input type="number" step="0.01" value={editing.custoUnit || ''} onChange={e => setEditing({ ...editing, custoUnit: parseFloat(e.target.value) || 0 })} /></div>
            <div className="col-span-2">
              <Label>Custo Total</Label>
              <div className="text-2xl font-bold text-foreground mt-1">{formatCurrency((editing.quantidade || 0) * (editing.custoUnit || 0))}</div>
            </div>
            <div className="col-span-2 border-t pt-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={gerarFin} onCheckedChange={v => setGerarFin(!!v)} />
                <span className="text-sm font-medium">Gerar lançamento financeiro</span>
              </label>
              {gerarFin && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={tipoFin} onValueChange={v => setTipoFin(v as 'avista' | 'aprazo')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avista">À vista (Saída de Caixa)</SelectItem>
                        <SelectItem value="aprazo">A prazo (Conta a Pagar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {tipoFin === 'aprazo' && (
                    <div>
                      <Label>Vencimento</Label>
                      <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
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
