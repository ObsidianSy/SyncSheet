import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Cliente } from '@/types';
import { formatCPF, formatPhone, formatDate, generateId, todayISO } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const CANAIS = ['Site/E-commerce', 'Instagram', 'WhatsApp', 'Indicação', 'Marketplace', 'Loja Física', 'Outros'];
const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
const PAGE_SIZE = 20;

const makeEmptyCliente = (): Cliente => ({
  codigo: '', nome: '', cpfCnpj: '', email: '', telefone: '',
  cidade: '', estado: '', canalVenda: '', dataCadastro: todayISO(), observacoes: '',
});

export default function ClientesPage() {
  const { state, setClientes } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterCanal, setFilterCanal] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente>(makeEmptyCliente());
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return state.clientes.filter(c => {
      const matchSearch = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.codigo.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
      const matchCanal = filterCanal === 'todos' || c.canalVenda === filterCanal;
      return matchSearch && matchCanal;
    });
  }, [state.clientes, search, filterCanal]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const canalData = useMemo(() => {
    const counts: Record<string, number> = {};
    state.clientes.forEach(c => { counts[c.canalVenda || 'Outros'] = (counts[c.canalVenda || 'Outros'] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [state.clientes]);

  const openNew = () => { setEditing({ ...makeEmptyCliente(), codigo: generateId('CLI', state.clientes, 'codigo') }); setEditIndex(null); setModalOpen(true); };
  const openEdit = (c: Cliente, idx: number) => { setEditing({ ...c }); setEditIndex(idx); setModalOpen(true); };

  const save = () => {
    if (!editing.nome) { toast.error('Nome é obrigatório'); return; }
    const updated = [...state.clientes];
    if (editIndex !== null) { updated[editIndex] = editing; } else { updated.push(editing); }
    setClientes(updated);
    setModalOpen(false);
    toast.success(editIndex !== null ? 'Cliente atualizado' : 'Cliente adicionado');
  };

  const remove = () => {
    if (editIndex === null) return;
    setClientes(state.clientes.filter((_, i) => i !== editIndex));
    setModalOpen(false);
    toast.success('Cliente removido');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}><Users className="w-6 h-6" style={{ color: '#2563EB' }} /></div>
          <div><p className="kpi-label">Total de Clientes</p><p className="kpi-value">{state.clientes.length}</p></div>
        </div>
        <Card className="lg:col-span-3 p-4 rounded-2xl">
          <p className="text-sm font-medium mb-2 text-muted-foreground">Distribuição por Canal</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={canalData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {canalData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterCanal} onValueChange={v => { setFilterCanal(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Canais</SelectItem>
            {CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Cliente</Button>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="table-header">
              {['Código', 'Nome', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Cidade', 'UF', 'Canal', 'Cadastro'].map(h => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {paginated.map((c, i) => (
                <tr key={i} className="border-b border-border hover:bg-table-hover cursor-pointer even:bg-table-row-alt transition-colors duration-150" onClick={() => openEdit(c, state.clientes.indexOf(c))}>
                  <td className="px-4 py-3 font-mono text-xs">{c.codigo}</td>
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3">{formatCPF(c.cpfCnpj)}</td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{formatPhone(c.telefone)}</td>
                  <td className="px-4 py-3">{c.cidade}</td>
                  <td className="px-4 py-3">{c.estado}</td>
                  <td className="px-4 py-3"><span className="status-badge" style={{ background: 'hsl(var(--info-light))', color: '#1e40af' }}>{c.canalVenda}</span></td>
                  <td className="px-4 py-3">{formatDate(c.dataCadastro)}</td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>}
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
          <DialogHeader><DialogTitle>{editIndex !== null ? 'Editar' : 'Novo'} Cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Código *</Label><Input value={editing.codigo} onChange={e => setEditing({ ...editing, codigo: e.target.value })} /></div>
            <div className="col-span-2"><Label>Nome / Razão Social *</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
            <div><Label>CPF/CNPJ</Label><Input value={editing.cpfCnpj} onChange={e => setEditing({ ...editing, cpfCnpj: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={editing.telefone} onChange={e => setEditing({ ...editing, telefone: e.target.value })} /></div>
            <div><Label>Cidade</Label><Input value={editing.cidade} onChange={e => setEditing({ ...editing, cidade: e.target.value })} /></div>
            <div>
              <Label>Estado</Label>
              <Select value={editing.estado} onValueChange={v => setEditing({ ...editing, estado: v })}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Canal de Venda</Label>
              <Select value={editing.canalVenda} onValueChange={v => setEditing({ ...editing, canalVenda: v })}>
                <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
                <SelectContent>{CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
