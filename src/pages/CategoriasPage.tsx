import { useAppContext } from '@/contexts/AppContext';
import { Categoria } from '@/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Tags } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoriasPage() {
  const { state, setCategorias } = useAppContext();
  const { receitas, despesas } = state.categorias;

  const addReceita = () => {
    const cod = `R${String(receitas.length + 1).padStart(2, '0')}`;
    setCategorias({ ...state.categorias, receitas: [...receitas, { codigo: cod, categoria: '' }] });
  };
  const addDespesa = () => {
    const cod = `D${String(despesas.length + 1).padStart(2, '0')}`;
    setCategorias({ ...state.categorias, despesas: [...despesas, { codigo: cod, categoria: '' }] });
  };
  const updateReceita = (idx: number, cat: Categoria) => {
    const updated = [...receitas]; updated[idx] = cat;
    setCategorias({ ...state.categorias, receitas: updated });
  };
  const updateDespesa = (idx: number, cat: Categoria) => {
    const updated = [...despesas]; updated[idx] = cat;
    setCategorias({ ...state.categorias, despesas: updated });
  };
  const removeReceita = (idx: number) => {
    setCategorias({ ...state.categorias, receitas: receitas.filter((_, i) => i !== idx) });
    toast.success('Categoria removida');
  };
  const removeDespesa = (idx: number) => {
    setCategorias({ ...state.categorias, despesas: despesas.filter((_, i) => i !== idx) });
    toast.success('Categoria removida');
  };

  const CatList = ({ title, items, onUpdate, onRemove, onAdd, color }: {
    title: string; items: Categoria[]; onUpdate: (i: number, c: Categoria) => void;
    onRemove: (i: number) => void; onAdd: () => void; color: string;
  }) => (
    <Card className={`overflow-hidden border-t-4 rounded-xl ${color}`}>
      <div className="p-4">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Tags className="w-5 h-5" /> {title}
        </h3>
        <div className="space-y-2">
          {items.map((cat, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="w-20 text-center font-mono text-xs" value={cat.codigo} onChange={e => onUpdate(i, { ...cat, codigo: e.target.value })} />
              <Input className="flex-1" value={cat.categoria} onChange={e => onUpdate(i, { ...cat, categoria: e.target.value })} placeholder="Nome da categoria" />
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onRemove(i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CatList title="Categorias de Receita" items={receitas} onUpdate={updateReceita} onRemove={removeReceita} onAdd={addReceita} color="border-t-success" />
      <CatList title="Categorias de Despesa" items={despesas} onUpdate={updateDespesa} onRemove={removeDespesa} onAdd={addDespesa} color="border-t-destructive" />
    </div>
  );
}
