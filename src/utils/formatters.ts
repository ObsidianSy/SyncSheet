export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPercent(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

export function formatDate(value: string): string {
  if (!value) return '';
  const d = parseLocalDate(value);
  if (!d) return value;
  return d.toLocaleDateString('pt-BR');
}

export function formatCPF(value: string): string {
  const nums = value.replace(/\D/g, '');
  if (nums.length <= 11) {
    return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function formatPhone(value: string): string {
  const nums = value.replace(/\D/g, '');
  if (nums.length === 11) {
    return nums.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (nums.length === 10) {
    return nums.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return value;
}

export function parseCurrencyInput(value: string): number {
  return parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
}

/**
 * Cria um Date "âncora" no fuso local no meio-dia para evitar bugs de DST/timezone.
 * Sempre representa a data civil — nunca desliza para o dia anterior/seguinte ao serializar.
 */
export function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
}

/**
 * Parse robusto de qualquer valor que represente uma data, normalizando ao meio-dia local.
 * Aceita Date, ISO ("2026-05-13" ou "2026-05-13T..."), BR ("13/05/2026") ou serial Excel.
 * Retorna null quando inválido — nunca usa toISOString() para evitar offset UTC.
 */
export function parseLocalDate(input: unknown): Date | null {
  if (input == null || input === '') return null;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12, 0, 0, 0);
  }

  if (typeof input === 'number') {
    // Serial Excel (dias desde 1899-12-30). Calculamos a data civil em UTC e
    // reconstruímos no fuso local para preservar o dia.
    const ms = (input - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0);
  }

  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  // ISO "YYYY-MM-DD" (com ou sem hora)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(+y, +m - 1, +d, 12, 0, 0, 0);
  }

  // BR "DD/MM/YYYY"
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return new Date(+y, +m - 1, +d, 12, 0, 0, 0);
  }

  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
}

/**
 * Formata uma data como ISO "YYYY-MM-DD" usando componentes LOCAIS.
 * Substitui o antipadrão new Date(x).toISOString().split('T')[0], que desloca dias em fusos negativos.
 */
export function toLocalISODate(input: unknown): string {
  const d = parseLocalDate(input);
  if (!d) return typeof input === 'string' ? input : '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Hoje como ISO local (ex.: usado para inputs <input type="date">). */
export function todayISO(): string {
  return toLocalISODate(todayLocal());
}

/** Mantida por compatibilidade com chamadas existentes; agora roteia pela versão local-safe. */
export function parseExcelDate(value: any): string {
  if (value == null || value === '') return '';
  const iso = toLocalISODate(value);
  return iso || String(value);
}

export function generateId(prefix: string, list: any[], field: string): string {
  let max = 0;
  list.forEach(item => {
    const match = item[field]?.match(/(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1]));
  });
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100;
}

export function getCategoriaLabel(codigoOrName: string, categorias: { receitas: { codigo: string; categoria: string }[]; despesas: { codigo: string; categoria: string }[] }): string {
  if (!codigoOrName) return '';
  const all = [...categorias.receitas, ...categorias.despesas];
  const byCode = all.find(c => c.codigo === codigoOrName);
  if (byCode) return `${byCode.codigo} — ${byCode.categoria}`;
  const byName = all.find(c => c.categoria === codigoOrName);
  if (byName) return `${byName.codigo} — ${byName.categoria}`;
  return codigoOrName;
}

export function categoriaToCodigo(value: string, categorias: { receitas: { codigo: string; categoria: string }[]; despesas: { codigo: string; categoria: string }[] }): string {
  if (!value) return '';
  const all = [...categorias.receitas, ...categorias.despesas];
  if (all.some(c => c.codigo === value)) return value;
  const byName = all.find(c => c.categoria === value);
  return byName ? byName.codigo : value;
}
