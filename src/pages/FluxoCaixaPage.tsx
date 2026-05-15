import { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { LancamentoFC } from '@/types';
import { formatCurrency, formatDate, getCategoriaLabel, categoriaToCodigo, round2, todayISO } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';

const makeEmptyLanc = (): LancamentoFC => ({ data: todayISO(), descricao: '', categoria: '', clienteFornecedor: '', formaPgto: '', valor: 0, status: 'Confirmado', observacoes: '' });

export default function FluxoCaixaPage() {
  const { state, setFluxoCaixa } = useAppContext();
  const fc = state.fluxoCaixa;
  const [modalType, setModalType] = useState<'entrada' | 'saida' | null>(null);
  const [editing, setEditing] = useState<LancamentoFC>(makeEmptyLanc());

  const totalEntradas = fc.entradas.reduce((s, e) => s + e.valor, 0);
  const totalSaidas = fc.saidas.reduce((s, e) => s + e.valor, 0);
  const saldoFinal = fc.saldoInicial + totalEntradas - totalSaidas;
  const variacao = fc.saldoInicial !== 0 ? ((saldoFinal - fc.saldoInicial) / fc.saldoInicial * 100) : 0;

  const save = () => {
    if (!editing.descricao) { toast.error('Descrição obrigatória'); return; }
    const final: LancamentoFC = {
      ...editing,
      categoria: categoriaToCodigo(editing.categoria, state.categorias),
      valor: round2(editing.valor),
    };
    if (modalType === 'entrada') {
      setFluxoCaixa({ ...fc, entradas: [...fc.entradas, final] });
    } else {
      setFluxoCaixa({ ...fc, saidas: [...fc.saidas, final] });
    }
    setModalType(null);
    toast.success('Lançamento registrado');
  };

  const LancTable = ({ items, type }: { items: LancamentoFC[]; type: 'entrada' | 'saida' }) => (
    <Card className={`overflow-hidden border-l-4 rounded-xl ${type === 'entrada' ? 'border-l-success' : 'border-l-destructive'}`}>
      <div className="p-4 flex justify-between items-center">
        <h3 className="font-display font-semibold">{type === 'entrada' ? 'Entradas' : 'Saídas'}</h3>
        <Button size="sm" onClick={() => { setEditing(makeEmptyLanc()); setModalType(type); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova {type === 'entrada' ? 'Entrada' : 'Saída'}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="table-header">
            {['Data', 'Descrição', 'Categoria', type === 'entrada' ? 'Cliente' : 'Fornecedor', 'Forma Pgto', 'Valor', 'Origem'].map(h => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border even:bg-table-row-alt">
                <td className="px-4 py-3">{formatDate(item.data)}</td>
                <td className="px-4 py-3">{item.descricao}</td>
                <td className="px-4 py-3">{getCategoriaLabel(item.categoria, state.categorias)}</td>
                <td className="px-4 py-3">{item.clienteFornecedor}</td>
                <td className="px-4 py-3">{item.formaPgto}</td>
                <td className="px-4 py-3 font-bold">{formatCurrency(item.valor)}</td>
                <td className="px-4 py-3">
                  {item.origemTipo && item.origemTipo !== 'manual' ? (
                    <span className="status-badge status-pendente text-[10px]">Auto: {item.origemTipo}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Manual</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem lançamentos</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}><ArrowUpCircle className="w-5 h-5" style={{ color: '#2563EB' }} /></div><div><p className="kpi-label">Saldo Inicial</p><p className="kpi-value text-base">{formatCurrency(fc.saldoInicial)}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}><ArrowUpCircle className="w-5 h-5" style={{ color: '#10B981' }} /></div><div><p className="kpi-label">Entradas</p><p className="kpi-value text-base">{formatCurrency(totalEntradas)}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}><ArrowDownCircle className="w-5 h-5" style={{ color: '#EF4444' }} /></div><div><p className="kpi-label">Saídas</p><p className="kpi-value text-base">{formatCurrency(totalSaidas)}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}><ArrowUpCircle className="w-5 h-5" style={{ color: '#2563EB' }} /></div><div><p className="kpi-label">Saldo Atual</p><p className={`kpi-value text-base ${saldoFinal >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(saldoFinal)}</p></div></div>
      </div>

      <Card className="p-4 rounded-2xl">
        <Label className="text-sm font-medium">Saldo Inicial do Mês</Label>
        <Input type="number" step="0.01" className="max-w-xs mt-1" value={fc.saldoInicial || ''} onChange={e => setFluxoCaixa({ ...fc, saldoInicial: parseFloat(e.target.value) || 0 })} />
      </Card>

      <Tabs defaultValue="entradas">
        <TabsList><TabsTrigger value="entradas">Entradas</TabsTrigger><TabsTrigger value="saidas">Saídas</TabsTrigger></TabsList>
        <TabsContent value="entradas"><LancTable items={fc.entradas} type="entrada" /></TabsContent>
        <TabsContent value="saidas"><LancTable items={fc.saidas} type="saida" /></TabsContent>
      </Tabs>

      <Card className="p-6 space-y-3 rounded-2xl">
        <h3 className="section-title">Resumo do Mês</h3>
        <div className="space-y-2">
          <div className="flex justify-between p-3 rounded-lg"><span>Saldo Inicial</span><span className="font-bold">{formatCurrency(fc.saldoInicial)}</span></div>
          <div className="flex justify-between p-3 bg-success-light rounded-lg"><span className="flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-success" /> Total Entradas</span><span className="font-bold text-success">{formatCurrency(totalEntradas)}</span></div>
          <div className="flex justify-between p-3 bg-danger-light rounded-lg"><span className="flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-destructive" /> Total Saídas</span><span className="font-bold text-destructive">{formatCurrency(totalSaidas)}</span></div>
          <div className="flex justify-between p-4 bg-secondary rounded-xl"><span className="text-secondary-foreground font-bold">Saldo Final</span><span className="text-secondary-foreground font-bold text-xl">{formatCurrency(saldoFinal)}</span></div>
          <div className="flex justify-between p-3"><span>Variação %</span><span className={`font-bold ${variacao >= 0 ? 'text-success' : 'text-destructive'}`}>{variacao.toFixed(1)}%</span></div>
        </div>
      </Card>

      <Dialog open={modalType !== null} onOpenChange={() => setModalType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova {modalType === 'entrada' ? 'Entrada' : 'Saída'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Data</Label><Input type="date" value={editing.data} onChange={e => setEditing({ ...editing, data: e.target.value })} /></div>
            <div className="col-span-2"><Label>Descrição *</Label><Input value={editing.descricao} onChange={e => setEditing({ ...editing, descricao: e.target.value })} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoriaToCodigo(editing.categoria, state.categorias)} onValueChange={v => setEditing({ ...editing, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(modalType === 'entrada' ? state.categorias.receitas : state.categorias.despesas).map(c => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} — {c.categoria}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{modalType === 'entrada' ? 'Cliente' : 'Fornecedor'}</Label>
              {modalType === 'entrada' ? (
                <Select value={editing.clienteFornecedor} onValueChange={v => setEditing({ ...editing, clienteFornecedor: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {state.clientes.map(c => (
                      <SelectItem key={c.codigo} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={editing.clienteFornecedor} onChange={e => setEditing({ ...editing, clienteFornecedor: e.target.value })} />
              )}
            </div>
            <div>
              <Label>Forma Pgto</Label>
              <Select value={editing.formaPgto} onValueChange={v => setEditing({ ...editing, formaPgto: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto', 'Transferência'].map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={editing.valor || ''} onChange={e => setEditing({ ...editing, valor: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setModalType(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
