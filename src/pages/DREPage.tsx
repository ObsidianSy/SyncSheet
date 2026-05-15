import { useAppContext } from '@/contexts/AppContext';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

export default function DREPage() {
  const { state, setDreRows } = useAppContext();
  const rows = state.dreRows;

  const updateValue = (rowIdx: number, monthIdx: number, value: number) => {
    const updated = [...rows];
    updated[rowIdx] = { ...updated[rowIdx], valores: [...updated[rowIdx].valores] };
    updated[rowIdx].valores[monthIdx] = value;
    recalcDRE(updated);
    setDreRows(updated);
  };

  const recalcDRE = (r: typeof rows) => {
    const get = (desc: string) => r.find(x => x.descricao === desc);
    const sumRange = (start: number, end: number) => {
      return Array(12).fill(0).map((_, m) => {
        let sum = 0;
        for (let i = start; i <= end; i++) sum += r[i]?.valores[m] || 0;
        return sum;
      });
    };

    const rbt = get('RECEITA BRUTA TOTAL');
    if (rbt) { rbt.valores = sumRange(0, 4); rbt.total = rbt.valores.reduce((a, b) => a + b, 0); }

    const rl = get('RECEITA LÍQUIDA');
    if (rl && rbt) {
      rl.valores = rbt.valores.map((v, m) => v - (r[6]?.valores[m] || 0) - (r[7]?.valores[m] || 0));
      rl.total = rl.valores.reduce((a, b) => a + b, 0);
    }

    const lb = get('LUCRO BRUTO');
    if (lb && rl) {
      lb.valores = rl.valores.map((v, m) => v - (r[9]?.valores[m] || 0) - (r[10]?.valores[m] || 0));
      lb.total = lb.valores.reduce((a, b) => a + b, 0);
    }

    const tdo = get('TOTAL DESPESAS OPERACIONAIS');
    if (tdo) { tdo.valores = sumRange(12, 20); tdo.total = tdo.valores.reduce((a, b) => a + b, 0); }

    const ro = get('RESULTADO OPERACIONAL');
    if (ro && lb && tdo) {
      ro.valores = lb.valores.map((v, m) => v - (tdo.valores[m] || 0));
      ro.total = ro.valores.reduce((a, b) => a + b, 0);
    }

    const rf = get('RESULTADO FINANCEIRO');
    if (rf) {
      rf.valores = Array(12).fill(0).map((_, m) => (r[23]?.valores[m] || 0) - (r[24]?.valores[m] || 0));
      rf.total = rf.valores.reduce((a, b) => a + b, 0);
    }

    const rli = get('RESULTADO LÍQUIDO');
    if (rli && ro && rf) {
      rli.valores = ro.valores.map((v, m) => v + (rf.valores[m] || 0));
      rli.total = rli.valores.reduce((a, b) => a + b, 0);
    }

    const ml = get('MARGEM LÍQUIDA');
    if (ml && rli && rbt) {
      ml.valores = rli.valores.map((v, m) => rbt.valores[m] !== 0 ? (v / rbt.valores[m]) * 100 : 0);
      ml.total = rbt.total !== 0 ? (rli.total / rbt.total) * 100 : 0;
    }

    r.forEach(row => { if (row.isEditable) { row.total = row.valores.reduce((a, b) => a + b, 0); } });
  };

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const rowStyle = (style?: string) => {
    switch (style) {
      case 'receita-bruta': return 'bg-success-light font-bold';
      case 'receita-liquida': return 'bg-success-light font-bold';
      case 'lucro-bruto': return 'bg-success-light font-bold';
      case 'despesas': return 'bg-danger-light font-bold';
      case 'resultado-operacional': return 'bg-warning-light font-bold';
      case 'resultado-liquido': return 'bg-secondary text-secondary-foreground font-bold';
      case 'margem': return 'bg-warning-light font-bold';
      default: return '';
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-info-light text-sm">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <span className="text-foreground/80">
          Os valores são calculados automaticamente a partir das vendas pagas e contas a pagar quitadas. Para alterar, edite os lançamentos originais.
        </span>
      </div>
      <Card className="overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                <th className="text-left sticky left-0 z-10 min-w-[50px] bg-table-header text-table-header-foreground">Conta</th>
                <th className="text-left sticky left-[50px] z-10 min-w-[180px] bg-table-header text-table-header-foreground">Descrição</th>
                {months.map(m => <th key={m} className="text-right min-w-[90px] bg-table-header text-table-header-foreground">{m}</th>)}
                <th className="text-right min-w-[100px] bg-table-header text-table-header-foreground">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={cn("border-b border-border", rowStyle(row.style))}>
                  <td className={cn("px-3 py-2 font-mono sticky left-0 z-10 bg-inherit", rowStyle(row.style) || 'bg-card')}>{row.conta}</td>
                  <td className={cn("px-3 py-2 sticky left-[50px] z-10 bg-inherit whitespace-nowrap", rowStyle(row.style) || 'bg-card', row.isTotal && 'font-bold')}>{row.descricao}</td>
                  {row.valores.map((v, mi) => (
                    <td key={mi} className="px-1 py-1 text-right">
                      {row.isEditable ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 text-xs text-right w-20 ml-auto font-medium"
                          style={{ color: '#2563EB' }}
                          value={v || ''}
                          onChange={e => updateValue(ri, mi, parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        <span className="text-xs">
                          {row.style === 'margem' ? formatPercent(v) : formatCurrency(v)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className={cn("px-3 py-2 text-right font-bold", row.style === 'resultado-liquido' && 'text-lg')}>
                    {row.style === 'margem' ? formatPercent(row.total) : formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
