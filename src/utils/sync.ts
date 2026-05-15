import { AppState, Conta, LancamentoFC, DRERow, Venda, Movimentacao } from '@/types';
import { round2, parseLocalDate } from '@/utils/formatters';

/** Soma N dias a uma data ISO mantendo a data civil local (sem deslocamento de fuso). */
function addDaysISO(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Sincronização Venda ↔ Conta a Receber ↔ Fluxo de Caixa.
 *
 * Regras bidirecionais:
 *  - Venda Paga  → garante entrada de caixa (origemTipo='venda'), remove CR órfã.
 *  - Venda Pendente → garante CR aberta (vencimento +30d), remove entrada órfã.
 *  - Venda Cancelada → remove ambos.
 *  - CR criada a partir de venda muda para "Recebido" → eleva a venda para "Pago"
 *    (e a regra acima passa a gerar a entrada de caixa).
 *  - CR volta a "Pendente" → rebaixa a venda para "Pendente" (e remove entrada
 *    automática até a CR ser quitada novamente).
 */
export function syncVendasToFinanceiro(state: AppState): AppState {
  // 1) Refletir status da CR (origem=venda) DE VOLTA na venda original.
  //    Isso garante que marcar CR como Recebido vire a venda em Paga, e vice-versa.
  const crByVendaId = new Map<string, Conta>();
  state.contasReceber.forEach(cr => {
    if (cr.origemTipo === 'venda' && cr.origemId) crByVendaId.set(cr.origemId, cr);
  });

  const vendas: Venda[] = state.vendas.map(v => {
    if (!v.numVenda) return v;
    if (v.status === 'Cancelado') return v;
    const cr = crByVendaId.get(v.numVenda);
    if (!cr) return v;
    if (cr.status === 'Recebido' && v.status !== 'Pago') return { ...v, status: 'Pago' };
    if (cr.status === 'Pendente' && v.status === 'Pago') return { ...v, status: 'Pendente' };
    return v;
  });

  const validVendaIds = new Set(vendas.map(v => v.numVenda).filter(Boolean));

  // 2) Limpa lançamentos de origem 'venda' cuja venda original sumiu.
  let entradas = state.fluxoCaixa.entradas.filter(e =>
    !(e.origemTipo === 'venda' && (!e.origemId || !validVendaIds.has(e.origemId)))
  );
  let contasReceber = state.contasReceber.filter(c =>
    !(c.origemTipo === 'venda' && (!c.origemId || !validVendaIds.has(c.origemId)))
  );

  const existingEntradas = new Map<string, LancamentoFC>();
  entradas.forEach(e => { if (e.origemTipo === 'venda' && e.origemId) existingEntradas.set(e.origemId, e); });
  const existingCR = new Map<string, Conta>();
  contasReceber.forEach(c => { if (c.origemTipo === 'venda' && c.origemId) existingCR.set(c.origemId, c); });

  vendas.forEach(v => {
    if (!v.numVenda) return;
    if (v.status === 'Pago') {
      // Garante entrada de caixa
      if (!existingEntradas.has(v.numVenda)) {
        entradas.push({
          data: v.data,
          descricao: `Venda ${v.numVenda}`,
          categoria: 'R01',
          clienteFornecedor: v.cliente,
          formaPgto: v.formaPgto,
          valor: round2(v.totalVenda),
          status: 'Confirmado',
          observacoes: `Auto: venda ${v.numVenda}`,
          origemTipo: 'venda',
          origemId: v.numVenda,
        });
      }
      // Mantém CR mas marca como Recebido (espelhamento bidirecional Venda→CR).
      const cr = existingCR.get(v.numVenda);
      if (cr) {
        if (cr.status !== 'Recebido') {
          cr.status = 'Recebido';
          cr.valorPago = round2(v.totalVenda);
          if (!cr.dataPgto) cr.dataPgto = v.data;
        }
      }
    } else if (v.status === 'Pendente') {
      if (!existingCR.has(v.numVenda)) {
        contasReceber.push({
          vencimento: addDaysISO(v.data, 30),
          descricao: `Venda ${v.numVenda}`,
          categoria: 'R01',
          fornecedorCliente: v.cliente,
          formaPgto: v.formaPgto,
          valor: round2(v.totalVenda),
          valorPago: 0,
          dataPgto: '',
          status: 'Pendente',
          observacoes: `Auto: venda ${v.numVenda}`,
          origemTipo: 'venda',
          origemId: v.numVenda,
        });
      } else {
        // Se a CR estava marcada como Recebido mas o usuário rebaixou a venda
        // (cenário improvável — já tratado acima), garante consistência.
        const cr = existingCR.get(v.numVenda)!;
        if (cr.status === 'Recebido') {
          cr.status = 'Pendente';
          cr.valorPago = 0;
          cr.dataPgto = '';
        }
      }
      // Remove entrada se venda voltou para pendente
      entradas = entradas.filter(e => !(e.origemTipo === 'venda' && e.origemId === v.numVenda));
    } else {
      // Cancelada — remove ambos
      contasReceber = contasReceber.filter(c => !(c.origemTipo === 'venda' && c.origemId === v.numVenda));
      entradas = entradas.filter(e => !(e.origemTipo === 'venda' && e.origemId === v.numVenda));
    }
  });

  return { ...state, vendas, fluxoCaixa: { ...state.fluxoCaixa, entradas }, contasReceber };
}

/**
 * Sincronização Movimentação ↔ Conta a Pagar.
 * Quando a CP gerada pela movimentação está Paga, a movimentação ganha status 'Confirmada'.
 */
export function syncMovimentacoesToContas(state: AppState): AppState {
  const cpByOrigemId = new Map<string, Conta>();
  state.contasPagar.forEach(cp => {
    if (cp.origemTipo === 'movimentacao' && cp.origemId) cpByOrigemId.set(cp.origemId, cp);
  });

  const movimentacoes: Movimentacao[] = state.movimentacoes.map(m => {
    if (!m.id) return m;
    const cp = cpByOrigemId.get(m.id);
    if (!cp) return m;
    if (cp.status === 'Pago' && m.status !== 'Confirmada') return { ...m, status: 'Confirmada' };
    if (cp.status !== 'Pago' && m.status === 'Confirmada') return { ...m, status: 'Pendente' };
    return m;
  });

  return { ...state, movimentacoes };
}

/** Sincroniza contas pagas/recebidas → fluxo de caixa (lançamentos automáticos com origemTipo='conta'). */
export function syncContasToFluxo(state: AppState): AppState {
  let entradas = state.fluxoCaixa.entradas.filter(e => e.origemTipo !== 'conta');
  let saidas = state.fluxoCaixa.saidas.filter(s => s.origemTipo !== 'conta');

  state.contasReceber.forEach((c, idx) => {
    // CR oriunda de venda gera entrada via 'venda', não 'conta' — evita duplicidade.
    if (c.origemTipo === 'venda') return;
    if (c.status === 'Recebido' && c.valorPago > 0) {
      entradas.push({
        data: c.dataPgto || c.vencimento,
        descricao: c.descricao,
        categoria: c.categoria,
        clienteFornecedor: c.fornecedorCliente,
        formaPgto: c.formaPgto || '',
        valor: round2(c.valorPago),
        status: 'Confirmado',
        observacoes: `Auto: ${c.descricao}`,
        origemTipo: 'conta',
        origemId: `cr-${c.origemId || idx}`,
      });
    }
  });

  state.contasPagar.forEach((c, idx) => {
    if (c.status === 'Pago' && c.valorPago > 0) {
      saidas.push({
        data: c.dataPgto || c.vencimento,
        descricao: c.descricao,
        categoria: c.categoria,
        clienteFornecedor: c.fornecedorCliente,
        formaPgto: c.formaPgto || '',
        valor: round2(c.valorPago),
        status: 'Confirmado',
        observacoes: `Auto: ${c.descricao}`,
        origemTipo: 'conta',
        origemId: `cp-${c.origemId || idx}`,
      });
    }
  });

  return { ...state, fluxoCaixa: { ...state.fluxoCaixa, entradas, saidas } };
}

export function syncAll(state: AppState): AppState {
  let s = syncVendasToFinanceiro(state);
  s = syncMovimentacoesToContas(s);
  s = syncContasToFluxo(s);
  s = recomputeDREFromBusiness(s);
  return s;
}

// =============================================================================
// DRE — recálculo a partir de vendas pagas + contas pagas (correção contábil)
// =============================================================================

/**
 * Mapeamento de categoria (código OU nome) de despesa → linha do DRE.
 * CMV (D01) é tratado SEPARADAMENTE, calculado por venda × custo do produto.
 */
const DESPESA_TO_DRE: Record<string, string> = {
  D02: 'Custo de Serviço',
  D03: 'Salários',
  D04: 'Aluguel',
  D05: 'Marketing',
  D06: 'Ferramentas / Software',
  D07: 'Contabilidade',
  D08: 'Telefone / Internet',
  D09: 'Terceirizados',
  D10: 'Material',
  D11: 'Impostos sobre Vendas',
  D12: 'Outras Despesas',
  // Aliases por nome (compat com lançamentos legados)
  'Custo de Serviço': 'Custo de Serviço',
  Salários: 'Salários',
  Aluguel: 'Aluguel',
  Marketing: 'Marketing',
  Ferramentas: 'Ferramentas / Software',
  'Ferramentas / Software': 'Ferramentas / Software',
  Contabilidade: 'Contabilidade',
  'Telefone/Internet': 'Telefone / Internet',
  'Telefone / Internet': 'Telefone / Internet',
  Terceirizados: 'Terceirizados',
  Material: 'Material',
  Impostos: 'Impostos sobre Vendas',
  'Impostos sobre Vendas': 'Impostos sobre Vendas',
  Outras: 'Outras Despesas',
  'Outras Despesas': 'Outras Despesas',
};

const RECEITA_TO_DRE: Record<string, string> = {
  R01: 'Vendas de Produtos',
  R02: 'Vendas de Serviços',
  R03: 'Cursos e Infoprodutos',
  R04: 'Assinaturas / Recorrência',
  R05: 'Receitas Financeiras',
  R06: 'Outras Receitas',
  'Vendas de Produtos': 'Vendas de Produtos',
  'Vendas de Serviços': 'Vendas de Serviços',
  'Cursos e Infoprodutos': 'Cursos e Infoprodutos',
  Assinaturas: 'Assinaturas / Recorrência',
  'Assinaturas / Recorrência': 'Assinaturas / Recorrência',
  'Receitas Financeiras': 'Receitas Financeiras',
  'Outras Receitas': 'Outras Receitas',
};

/**
 * Recalcula o DRE a partir das fontes primárias:
 *  - Vendas com status "Pago" alimentam a Receita Bruta (por categoria do produto/venda).
 *  - CMV = soma de (quantidade_vendida × preço_custo do produto) por venda paga, agrupado por mês.
 *  - Contas a Pagar com status "Pago" alimentam impostos, custos de serviço e despesas operacionais
 *    por categoria (D02..D12). D01 NÃO entra como despesa operacional — é apenas referência de CMV manual.
 *  - Receitas financeiras (R05) vêm de Contas a Receber recebidas com categoria R05.
 *  - Linhas editáveis com algum valor manual (≠ 0) NÃO são sobrescritas.
 */
export function recomputeDREFromBusiness(state: AppState): AppState {
  const monthOf = (iso: string): number => {
    const d = parseLocalDate(iso);
    return d ? d.getMonth() : -1;
  };

  const auto: Record<string, number[]> = {};
  const add = (dreDesc: string, month: number, valor: number) => {
    if (month < 0 || month > 11) return;
    if (!auto[dreDesc]) auto[dreDesc] = Array(12).fill(0);
    auto[dreDesc][month] = round2(auto[dreDesc][month] + (valor || 0));
  };

  // --- Receita Bruta a partir das vendas Pagas ---
  const produtoById = new Map(state.produtos.map(p => [p.sku, p]));
  state.vendas.forEach(v => {
    if (v.status !== 'Pago') return;
    const m = monthOf(v.data);
    const total = round2(v.totalVenda || 0);
    // Por enquanto todas as vendas vão para "Vendas de Produtos" — se quiser segmentar
    // por categoria do produto (serviços, infoprodutos…), basta mapear aqui.
    add('Vendas de Produtos', m, total);

    // CMV correto: quantidade × preço de custo do produto no momento atual.
    const prod = produtoById.get(v.skuProduto);
    if (prod) {
      const cmv = round2((v.quantidade || 0) * (prod.precoCusto || 0));
      if (cmv > 0) add('CMV', m, cmv);
    }
  });

  // --- Receitas Financeiras (e outras receitas não-venda) via Contas a Receber recebidas ---
  state.contasReceber.forEach(cr => {
    if (cr.status !== 'Recebido' || !cr.valorPago) return;
    if (cr.origemTipo === 'venda') return; // já contabilizado pela venda
    const dreLine = RECEITA_TO_DRE[cr.categoria];
    if (!dreLine) return;
    add(dreLine, monthOf(cr.dataPgto || cr.vencimento), cr.valorPago);
  });

  // --- Despesas operacionais e custos via Contas a Pagar Pagas (D02..D12, excluindo D01) ---
  state.contasPagar.forEach(cp => {
    if (cp.status !== 'Pago' || !cp.valorPago) return;
    // D01 (CMV) é IGNORADO aqui — CMV vem das vendas, não das compras de estoque.
    if (cp.categoria === 'D01' || cp.categoria === 'CMV') return;
    const dreLine = DESPESA_TO_DRE[cp.categoria];
    if (!dreLine) return;
    add(dreLine, monthOf(cp.dataPgto || cp.vencimento), cp.valorPago);
  });

  // Aplica nas linhas editáveis preservando edições manuais (qualquer valor ≠ 0).
  const updatedRows: DRERow[] = state.dreRows.map(row => {
    if (!row.isEditable) return row;
    const autoVals = auto[row.descricao];
    if (!autoVals) {
      // Não há dado automático — se a linha estava sendo populada por auto antes e agora não tem nada,
      // mantemos o que está (decisão conservadora; o usuário pode zerar manualmente).
      return row;
    }
    const hasManual = row.valores.some(v => v !== 0);
    if (hasManual) return row;
    return { ...row, valores: autoVals, total: round2(autoVals.reduce((a, b) => a + b, 0)) };
  });

  return { ...state, dreRows: recalcDREStructure(updatedRows) };
}

// Backwards-compat: o nome antigo segue exportado para qualquer chamada legada.
export const recomputeDREFromFluxo = recomputeDREFromBusiness;

function recalcDREStructure(rows: DRERow[]): DRERow[] {
  const out = rows.map(r => ({ ...r, valores: [...r.valores] }));
  const get = (d: string) => out.find(r => r.descricao === d)?.valores || Array(12).fill(0);
  const set = (d: string, vs: number[]) => {
    const r = out.find(x => x.descricao === d);
    if (r) { r.valores = vs.map(round2); r.total = round2(vs.reduce((a, b) => a + b, 0)); }
  };
  const sum = (...names: string[]) => Array.from({ length: 12 }, (_, i) => names.reduce((s, n) => s + (get(n)[i] || 0), 0));
  const sub = (base: string, ...names: string[]) => Array.from({ length: 12 }, (_, i) => (get(base)[i] || 0) - names.reduce((s, n) => s + (get(n)[i] || 0), 0));

  set('RECEITA BRUTA TOTAL', sum('Vendas de Produtos', 'Vendas de Serviços', 'Cursos e Infoprodutos', 'Assinaturas / Recorrência', 'Outras Receitas'));
  set('RECEITA LÍQUIDA', sub('RECEITA BRUTA TOTAL', 'Impostos sobre Vendas', 'Devoluções e Cancelamentos'));
  set('LUCRO BRUTO', sub('RECEITA LÍQUIDA', 'CMV', 'Custo de Serviço'));
  set('TOTAL DESPESAS OPERACIONAIS', sum('Salários', 'Aluguel', 'Marketing', 'Ferramentas / Software', 'Contabilidade', 'Telefone / Internet', 'Terceirizados', 'Material', 'Outras Despesas'));
  set('RESULTADO OPERACIONAL', sub('LUCRO BRUTO', 'TOTAL DESPESAS OPERACIONAIS'));
  set('RESULTADO FINANCEIRO', sub('Receitas Financeiras', 'Despesas Financeiras'));
  set('RESULTADO LÍQUIDO', sum('RESULTADO OPERACIONAL', 'RESULTADO FINANCEIRO'));

  const margem = out.find(r => r.descricao === 'MARGEM LÍQUIDA');
  if (margem) {
    const rb = get('RECEITA BRUTA TOTAL');
    const rl = get('RESULTADO LÍQUIDO');
    margem.valores = rb.map((v, i) => v !== 0 ? round2((rl[i] / v) * 100) : 0);
    const tRb = rb.reduce((a, b) => a + b, 0);
    const tRl = rl.reduce((a, b) => a + b, 0);
    margem.total = tRb !== 0 ? round2((tRl / tRb) * 100) : 0;
  }
  return out;
}
