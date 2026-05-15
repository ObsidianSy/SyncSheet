import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Produto } from '@/types';
import { formatCurrency, formatPercent, generateId } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Search, Package, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const UNIDADES = ['UN', 'KG', 'LT', 'CX', 'PCT', 'MT'];
const PAGE_SIZE = 20;

const NEW_CATEGORY_SENTINEL = '__new__';

export default function ProdutosPage() {
  const { state, setProdutos, addCategoriaProduto } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Produto>>({});
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [novaCatOpen, setNovaCatOpen] = useState(false);
  const [novaCat, setNovaCat] = useState('');

  // Mescla a lista do contexto (default + adicionadas) com categorias presentes em produtos
  // (para cobrir planilhas legadas que ainda não foram normalizadas).
  const categorias = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    [...state.categoriasProduto, ...state.produtos.map(p => p.categoria)].forEach(c => {
      const v = (c || '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(v); }
    });
    return out;
  }, [state.categoriasProduto, state.produtos]);

  const handleCategoriaChange = (value: string) => {
    if (value === NEW_CATEGORY_SENTINEL) {
      setNovaCat('');
      setNovaCatOpen(true);
      return;
    }
    setEditing({ ...editing, categoria: value });
  };

  const confirmarNovaCategoria = () => {
    const nome = novaCat.trim();
    if (!nome) { toast.error('Informe um nome para a categoria'); return; }
    addCategoriaProduto(nome);
    setEditing(prev => ({ ...prev, categoria: nome }));
    setNovaCatOpen(false);
    toast.success(`Categoria "${nome}" adicionada`);
  };

  const filtered = useMemo(() => {
    return state.produtos.filter(p => {
      const ms = !search || p.produto.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const mc = filterCat === 'todos' || p.categoria === filterCat;
      const mst = filterStatus === 'todos' || p.status === filterStatus;
      return ms && mc && mst;
    });
  }, [state.produtos, search, filterCat, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const valorEstoque = state.produtos.reduce((s, p) => s + p.valorEstoque, 0);
  const ok = state.produtos.filter(p => p.status === 'OK').length;
  const repor = state.produtos.filter(p => p.status === 'REPOR').length;
  const sem = state.produtos.filter(p => p.status === 'SEM ESTOQUE').length;

  const openNew = () => {
    setEditing({ sku: generateId('PROD', state.produtos, 'sku'), produto: '', categoria: '', unidade: 'UN', precoCusto: 0, precoVenda: 0, estoqueMin: 0, observacoes: '' });
    setEditIndex(null);
    setModalOpen(true);
  };

  const openEdit = (p: Produto, idx: number) => { setEditing({ ...p }); setEditIndex(idx); setModalOpen(true); };

  const save = () => {
    if (!editing.produto || !editing.sku) { toast.error('SKU e Produto são obrigatórios'); return; }
    const updated = [...state.produtos];
    const prod = { ...editing, margemPercent: 0, estoqueAtual: 0, valorEstoque: 0, status: 'OK' as const } as Produto;
    if (editIndex !== null) { updated[editIndex] = { ...updated[editIndex], ...editing } as Produto; }
    else { updated.push(prod); }
    setProdutos(updated);
    setModalOpen(false);
    toast.success(editIndex !== null ? 'Produto atualizado' : 'Produto adicionado');
  };

  const remove = () => {
    if (editIndex === null) return;
    setProdutos(state.produtos.filter((_, i) => i !== editIndex));
    setModalOpen(false);
    toast.success('Produto removido');
  };

  const statusBadge = (s: string) => {
    if (s === 'OK') return <span className="status-badge status-ok">OK</span>;
    if (s === 'REPOR') return <span className="status-badge status-repor">REPOR</span>;
    return <span className="status-badge status-sem-estoque">SEM ESTOQUE</span>;
  };

  const margem = editing.precoVenda && editing.precoVenda > 0
    ? ((editing.precoVenda - (editing.precoCusto || 0)) / editing.precoVenda * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}><Package className="w-5 h-5" style={{ color: '#2563EB' }} /></div><div><p className="kpi-label">Produtos</p><p className="kpi-value">{state.produtos.length}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}><Package className="w-5 h-5" style={{ color: '#2563EB' }} /></div><div><p className="kpi-label">Valor Estoque</p><p className="kpi-value text-lg">{formatCurrency(valorEstoque)}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}><CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} /></div><div><p className="kpi-label">OK</p><p className="kpi-value">{ok}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}><AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} /></div><div><p className="kpi-label">Repor</p><p className="kpi-value">{repor}</p></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}><XCircle className="w-5 h-5" style={{ color: '#EF4444' }} /></div><div><p className="kpi-label">Sem Estoque</p><p className="kpi-value">{sem}</p></div></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={v => { setFilterCat(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todas</SelectItem>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="OK">OK</SelectItem><SelectItem value="REPOR">REPOR</SelectItem><SelectItem value="SEM ESTOQUE">SEM ESTOQUE</SelectItem></SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Produto</Button>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="table-header">
              {['SKU', 'Produto', 'Categoria', 'P. Custo', 'P. Venda', 'Margem', 'Est. Mín', 'Est. Atual', 'Valor Est.', 'Status'].map(h => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {paginated.map((p, i) => (
                <tr key={i} className="border-b border-border hover:bg-table-hover cursor-pointer even:bg-table-row-alt transition-colors duration-150" style={{ padding: '11px 16px' }} onClick={() => openEdit(p, state.produtos.indexOf(p))}>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">{p.produto}</td>
                  <td className="px-4 py-3">{p.categoria}</td>
                  <td className="px-4 py-3">{formatCurrency(p.precoCusto)}</td>
                  <td className="px-4 py-3">{formatCurrency(p.precoVenda)}</td>
                  <td className="px-4 py-3">{formatPercent(p.margemPercent)}</td>
                  <td className="px-4 py-3">{p.estoqueMin}</td>
                  <td className="px-4 py-3 font-bold">{p.estoqueAtual}</td>
                  <td className="px-4 py-3">{formatCurrency(p.valorEstoque)}</td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>}
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
          <DialogHeader><DialogTitle>{editIndex !== null ? 'Editar' : 'Novo'} Produto</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>SKU *</Label><Input value={editing.sku || ''} onChange={e => setEditing({ ...editing, sku: e.target.value })} /></div>
            <div className="col-span-2"><Label>Produto *</Label><Input value={editing.produto || ''} onChange={e => setEditing({ ...editing, produto: e.target.value })} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={editing.categoria || ''} onValueChange={handleCategoriaChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectSeparator />
                  <SelectItem value={NEW_CATEGORY_SENTINEL}>
                    <span className="flex items-center gap-2 text-primary"><Plus className="w-3.5 h-3.5" /> Nova categoria…</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Unidade</Label>
              <Select value={editing.unidade || 'UN'} onValueChange={v => setEditing({ ...editing, unidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Preço de Custo *</Label><Input type="number" step="0.01" value={editing.precoCusto || ''} onChange={e => setEditing({ ...editing, precoCusto: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Preço de Venda *</Label><Input type="number" step="0.01" value={editing.precoVenda || ''} onChange={e => setEditing({ ...editing, precoVenda: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Margem</Label><Input disabled value={formatPercent(margem)} /></div>
            <div><Label>Estoque Mínimo</Label><Input type="number" value={editing.estoqueMin || ''} onChange={e => setEditing({ ...editing, estoqueMin: parseInt(e.target.value) || 0 })} /></div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={editing.observacoes || ''} onChange={e => setEditing({ ...editing, observacoes: e.target.value })} /></div>
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

      <Dialog open={novaCatOpen} onOpenChange={setNovaCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova categoria de produto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                autoFocus
                value={novaCat}
                onChange={e => setNovaCat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarNovaCategoria(); } }}
                placeholder="Ex.: Pet Shop"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setNovaCatOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarNovaCategoria}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
