import * as XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import { AppState, Cliente, Produto, Movimentacao, Venda, LancamentoFC, Conta, DRERow, Categoria } from '@/types';
import { parseExcelDate, round2, parseLocalDate } from '@/utils/formatters';

function safeNum(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v.replace(',', '.')) || 0;
  return 0;
}

function safeStr(v: any): string {
  return v != null ? String(v) : '';
}

function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '' ||
         (typeof v === 'string' && v.trim() === '');
}

const DEFAULT_CATEGORIAS_PRODUTO = [
  'Vestuário', 'Calçados', 'Acessórios', 'Eletrônicos', 'Alimentos',
  'Bebidas', 'Casa e Decoração', 'Beleza e Cuidados', 'Outros',
];

export function readExcel(buffer: ArrayBuffer): AppState {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true, cellFormula: true, cellDates: true });
  const clientes = readClientes(wb);
  const produtos = readProdutos(wb);
  const movimentacoes = readMovimentacoes(wb);
  const vendas = readVendas(wb, clientes);
  const fluxoCaixa = readFluxoCaixa(wb);
  const contasPagar = readContas(wb, 'Contas a Pagar');
  const contasReceber = readContas(wb, 'Contas a Receber');
  const dreRows = readDRE(wb);
  const categorias = readCategorias(wb);
  const computedProducts = computeStock(produtos, movimentacoes, vendas);

  // Reconstrói a lista de categorias de produto a partir do default + qualquer valor
  // único já presente em produtos importados (preserva categorias custom existentes).
  const fromProdutos = produtos.map(p => (p.categoria || '').trim()).filter(Boolean);
  const seen = new Set<string>();
  const categoriasProduto: string[] = [];
  [...DEFAULT_CATEGORIAS_PRODUTO, ...fromProdutos].forEach(c => {
    const key = c.toLowerCase();
    if (!seen.has(key)) { seen.add(key); categoriasProduto.push(c); }
  });

  return {
    isLoaded: true, clientes, produtos: computedProducts, movimentacoes, vendas,
    fluxoCaixa, contasPagar, contasReceber, dreRows, categorias, categoriasProduto,
  };
}

function readSheetRows(wb: XLSX.WorkBook, sheetName: string, keyHeader: string): any[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { range: 3, defval: null });
  return rows.filter(r => !isEmptyValue(r[keyHeader]));
}

function readClientes(wb: XLSX.WorkBook): Cliente[] {
  return readSheetRows(wb, 'Clientes', 'Código').map(r => ({
    codigo: safeStr(r['Código'] || r['Codigo']),
    nome: safeStr(r['Nome / Razão Social'] || r['Nome'] || r['Nome/Razão Social']),
    cpfCnpj: safeStr(r['CPF/CNPJ']),
    email: safeStr(r['E-mail'] || r['Email']),
    telefone: safeStr(r['Telefone']),
    cidade: safeStr(r['Cidade']),
    estado: safeStr(r['Estado']),
    canalVenda: safeStr(r['Canal de Venda']),
    dataCadastro: parseExcelDate(r['Data Cadastro']),
    observacoes: safeStr(r['Observações'] || r['Observacoes'] || ''),
  }));
}

function readProdutos(wb: XLSX.WorkBook): Produto[] {
  return readSheetRows(wb, 'Produtos', 'SKU').map(r => ({
    sku: safeStr(r['SKU']),
    produto: safeStr(r['Produto']),
    categoria: safeStr(r['Categoria']),
    unidade: safeStr(r['Unidade'] || 'UN'),
    precoCusto: safeNum(r['Preço Custo'] || r['Preco Custo']),
    precoVenda: safeNum(r['Preço Venda'] || r['Preco Venda']),
    margemPercent: 0,
    estoqueMin: safeNum(r['Estoque Mín.'] || r['Estoque Min'] || r['Estoque Min.']),
    estoqueAtual: 0,
    valorEstoque: 0,
    status: 'OK' as const,
    observacoes: safeStr(r['Observações'] || r['Observacoes'] || ''),
  }));
}

function readMovimentacoes(wb: XLSX.WorkBook): Movimentacao[] {
  const ws = wb.Sheets['Movimentações'] || wb.Sheets['Movimentacoes'];
  if (!ws) return [];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { range: 3, defval: null });
  return rows.filter(r => !isEmptyValue(r['SKU'])).map(r => ({
    data: parseExcelDate(r['Data']),
    sku: safeStr(r['SKU']),
    produto: safeStr(r['Produto'] || ''),
    fornecedor: safeStr(r['Fornecedor'] || ''),
    notaFiscal: safeStr(r['Nota Fiscal'] || ''),
    quantidade: safeNum(r['Quantidade']),
    custoUnit: safeNum(r['Custo Unit.'] || r['Custo Unit']),
    custoTotal: safeNum(r['Custo Total']),
  }));
}

function readVendas(wb: XLSX.WorkBook, clientes: Cliente[]): Venda[] {
  const ws = wb.Sheets['Vendas'];
  if (!ws) return [];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { range: 3, defval: null });
  return rows
    .filter(r => !isEmptyValue(r['Nº Venda'] || r['N Venda'] || r['Num Venda']))
    .map(r => {
      const codCliente = safeStr(r['Cód. Cliente'] || r['Cod. Cliente'] || r['Cod Cliente']);
      const cliente = clientes.find(c => c.codigo === codCliente);
      return {
        data: parseExcelDate(r['Data']),
        numVenda: safeStr(r['Nº Venda'] || r['N Venda'] || r['Num Venda']),
        codCliente,
        skuProduto: safeStr(r['SKU Produto'] || r['SKU']),
        cliente: cliente?.nome || safeStr(r['Cliente'] || ''),
        quantidade: safeNum(r['Quantidade']),
        precoUnit: safeNum(r['Preço Unit.'] || r['Preco Unit'] || r['Preço Unit']),
        descontoPercent: safeNum(r['Desconto %'] || r['Desconto']),
        totalVenda: safeNum(r['Venda Total'] || r['Total Venda']),
        formaPgto: safeStr(r['Forma Pgto'] || r['Forma de Pagamento'] || ''),
        status: (safeStr(r['Status']) || 'Pendente') as Venda['status'],
      };
    });
}

function readFluxoCaixa(wb: XLSX.WorkBook): { saldoInicial: number; entradas: LancamentoFC[]; saidas: LancamentoFC[] } {
  const ws = wb.Sheets['Fluxo de Caixa'];
  if (!ws) return { saldoInicial: 0, entradas: [], saidas: [] };
  const saldoInicial = safeNum(ws['D4']?.v);
  const readLancamentos = (startRow: number, endRow: number): LancamentoFC[] => {
    const result: LancamentoFC[] = [];
    for (let row = startRow; row <= endRow; row++) {
      const valor = ws[XLSX.utils.encode_cell({ r: row - 1, c: 5 })]?.v;
      if (isEmptyValue(valor)) continue;
      result.push({
        data: parseExcelDate(ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })]?.v),
        descricao: safeStr(ws[XLSX.utils.encode_cell({ r: row - 1, c: 1 })]?.v),
        categoria: safeStr(ws[XLSX.utils.encode_cell({ r: row - 1, c: 2 })]?.v),
        clienteFornecedor: safeStr(ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })]?.v),
        formaPgto: safeStr(ws[XLSX.utils.encode_cell({ r: row - 1, c: 4 })]?.v),
        valor: safeNum(valor),
        status: safeStr(ws[XLSX.utils.encode_cell({ r: row - 1, c: 6 })]?.v),
        observacoes: safeStr(ws[XLSX.utils.encode_cell({ r: row - 1, c: 7 })]?.v),
      });
    }
    return result;
  };
  return { saldoInicial, entradas: readLancamentos(8, 37), saidas: readLancamentos(42, 71) };
}

function readContas(wb: XLSX.WorkBook, sheetName: string): Conta[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { range: 3, defval: null });
  return rows
    .filter(r => !isEmptyValue(r['Descrição'] || r['Descricao']))
    .map(r => ({
      vencimento: parseExcelDate(r['Vencimento']),
      descricao: safeStr(r['Descrição'] || r['Descricao']),
      categoria: safeStr(r['Categoria']),
      fornecedorCliente: safeStr(r['Fornecedor'] || r['Cliente'] || ''),
      formaPgto: safeStr(r['Forma Pgto'] || r['Forma de Pagamento'] || ''),
      valor: safeNum(r['Valor']),
      valorPago: safeNum(r['Valor Pago'] || r['Valor Recebido'] || 0),
      dataPgto: parseExcelDate(r['Data Pgto'] || r['Data Recebimento'] || ''),
      status: (safeStr(r['Status']) || 'Pendente') as Conta['status'],
      observacoes: safeStr(r['Observações'] || r['Observacoes'] || ''),
    }));
}

function readDRE(wb: XLSX.WorkBook): DRERow[] {
  const ws = wb.Sheets['DRE'];
  if (!ws) return getDefaultDRE();
  const dreLines = getDREStructure();
  const rows = dreLines.map(line => {
    const valores: number[] = [];
    for (let col = 2; col <= 13; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: line.excelRow - 1, c: col })];
      valores.push(safeNum(cell?.v));
    }
    const totalCell = ws[XLSX.utils.encode_cell({ r: line.excelRow - 1, c: 14 })];
    const total = safeNum(totalCell?.v) || valores.reduce((a, b) => a + b, 0);
    return { conta: line.conta, descricao: line.descricao, valores, total, isEditable: line.isEditable, isTotal: line.isTotal, style: line.style };
  });
  return recalcDRERows(rows);
}

function recalcDRERows(rows: DRERow[]): DRERow[] {
  const get = (descricao: string) => rows.find(r => r.descricao === descricao)?.valores || Array(12).fill(0);
  const set = (descricao: string, valores: number[]) => {
    const row = rows.find(r => r.descricao === descricao);
    if (row) {
      row.valores = valores;
      row.total = valores.reduce((sum, value) => sum + value, 0);
    }
  };
  const sumRows = (...names: string[]) => Array.from({ length: 12 }, (_, i) => names.reduce((sum, name) => sum + (get(name)[i] || 0), 0));
  const subRows = (base: string, ...names: string[]) => Array.from({ length: 12 }, (_, i) => (get(base)[i] || 0) - names.reduce((sum, name) => sum + (get(name)[i] || 0), 0));

  set('RECEITA BRUTA TOTAL', sumRows('Vendas de Produtos', 'Vendas de Serviços', 'Cursos e Infoprodutos', 'Assinaturas / Recorrência', 'Outras Receitas'));
  set('RECEITA LÍQUIDA', subRows('RECEITA BRUTA TOTAL', 'Impostos sobre Vendas', 'Devoluções e Cancelamentos'));
  set('LUCRO BRUTO', subRows('RECEITA LÍQUIDA', 'CMV', 'Custo de Serviço'));
  set('TOTAL DESPESAS OPERACIONAIS', sumRows('Salários', 'Aluguel', 'Marketing', 'Ferramentas / Software', 'Contabilidade', 'Telefone / Internet', 'Terceirizados', 'Material', 'Outras Despesas'));
  set('RESULTADO OPERACIONAL', subRows('LUCRO BRUTO', 'TOTAL DESPESAS OPERACIONAIS'));
  set('RESULTADO FINANCEIRO', subRows('Receitas Financeiras', 'Despesas Financeiras'));
  set('RESULTADO LÍQUIDO', sumRows('RESULTADO OPERACIONAL', 'RESULTADO FINANCEIRO'));

  const margem = rows.find(r => r.descricao === 'MARGEM LÍQUIDA');
  if (margem) {
    const receita = get('RECEITA BRUTA TOTAL');
    const resultado = get('RESULTADO LÍQUIDO');
    margem.valores = receita.map((value, i) => value !== 0 ? (resultado[i] / value) * 100 : 0);
    margem.total = receita.reduce((sum, value) => sum + value, 0) !== 0 ? (resultado.reduce((sum, value) => sum + value, 0) / receita.reduce((sum, value) => sum + value, 0)) * 100 : 0;
  }
  return rows;
}

function readCategorias(wb: XLSX.WorkBook): { receitas: Categoria[]; despesas: Categoria[] } {
  const ws = wb.Sheets['Categorias'];
  if (!ws) return { receitas: getDefaultCategoriasReceita(), despesas: getDefaultCategoriasDespesa() };
  const receitas: Categoria[] = [];
  for (let row = 5; row <= 11; row++) {
    const cod = ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })]?.v;
    const cat = ws[XLSX.utils.encode_cell({ r: row - 1, c: 1 })]?.v;
    if (cod && cat) receitas.push({ codigo: safeStr(cod), categoria: safeStr(cat) });
  }
  const despesas: Categoria[] = [];
  for (let row = 15; row <= 27; row++) {
    const cod = ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })]?.v;
    const cat = ws[XLSX.utils.encode_cell({ r: row - 1, c: 1 })]?.v;
    if (cod && cat) despesas.push({ codigo: safeStr(cod), categoria: safeStr(cat) });
  }
  return {
    receitas: receitas.length > 0 ? receitas : getDefaultCategoriasReceita(),
    despesas: despesas.length > 0 ? despesas : getDefaultCategoriasDespesa(),
  };
}

export function computeStock(produtos: Produto[], movimentacoes: Movimentacao[], vendas: Venda[]): Produto[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return produtos.map(p => {
    const entradas = movimentacoes.filter(m => m.sku === p.sku).reduce((sum, m) => sum + m.quantidade, 0);
    const saidas = vendas.filter(v => v.skuProduto === p.sku && v.status !== 'Cancelado').reduce((sum, v) => sum + v.quantidade, 0);
    const estoqueAtual = entradas - saidas;
    const margemPercent = p.precoVenda > 0 ? r2(((p.precoVenda - p.precoCusto) / p.precoVenda) * 100) : 0;
    const valorEstoque = r2(estoqueAtual * p.precoCusto);
    let status: Produto['status'] = 'OK';
    if (estoqueAtual <= 0) status = 'SEM ESTOQUE';
    else if (estoqueAtual <= p.estoqueMin) status = 'REPOR';
    return { ...p, estoqueAtual, margemPercent, valorEstoque, status };
  });
}

// ===== WRITE — uses ExcelJS to fully preserve formatting, formulas, CF, merges =====

function toExcelDate(input: any): Date | null {
  return parseLocalDate(input);
}

const DATE_FIELD_RE = /^(?:data|vencimento|dataPgto|dataCadastro)$/i;

function setEjsCell(ws: ExcelJS.Worksheet, addr: string, value: any, isDate = false) {
  const cell = ws.getCell(addr);
  if (value == null || value === '' || (typeof value === 'string' && value.trim() === '')) {
    cell.value = null;
    return;
  }
  if (isDate) {
    const d = toExcelDate(value);
    if (d) {
      cell.value = d;
      cell.numFmt = 'dd/mm/yyyy';
    } else {
      cell.value = null;
    }
    return;
  }
  if (value instanceof Date) {
    cell.value = value;
    cell.numFmt = 'dd/mm/yyyy';
  } else if (typeof value === 'number') {
    cell.value = value;
  } else {
    cell.value = String(value);
  }
}

function clearEjsRange(ws: ExcelJS.Worksheet, cols: string[], startRow: number, endRow: number) {
  for (let row = startRow; row <= endRow; row++) {
    cols.forEach(col => { ws.getCell(`${col}${row}`).value = null; });
  }
}

export async function writeExcel(state: AppState, originalBuffer: ArrayBuffer | null): Promise<void> {
  if (!originalBuffer) {
    console.error('Original workbook buffer not available — download cancelled.');
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(originalBuffer);

  // Clientes
  const wsCli = wb.getWorksheet('Clientes');
  if (wsCli) {
    clearEjsRange(wsCli, ['A','B','C','D','E','F','G','H','I','J'], 5, 100);
    state.clientes.forEach((c, i) => {
      const row = 5 + i;
      setEjsCell(wsCli, `A${row}`, c.codigo);
      setEjsCell(wsCli, `B${row}`, c.nome);
      setEjsCell(wsCli, `C${row}`, c.cpfCnpj);
      setEjsCell(wsCli, `D${row}`, c.email);
      setEjsCell(wsCli, `E${row}`, c.telefone);
      setEjsCell(wsCli, `F${row}`, c.cidade);
      setEjsCell(wsCli, `G${row}`, c.estado);
      setEjsCell(wsCli, `H${row}`, c.canalVenda);
      setEjsCell(wsCli, `I${row}`, c.dataCadastro, true);
      setEjsCell(wsCli, `J${row}`, c.observacoes);
    });
  }

  // Produtos — todas as colunas calculadas também são gravadas (sobrescreve fórmulas
  // residuais para garantir que valor apareça mesmo em novas linhas).
  const wsProd = wb.getWorksheet('Produtos');
  if (wsProd) {
    clearEjsRange(wsProd, ['A','B','C','D','E','F','G','H','I','J','K','L'], 5, 100);
    state.produtos.forEach((p, i) => {
      const row = 5 + i;
      setEjsCell(wsProd, `A${row}`, p.sku);
      setEjsCell(wsProd, `B${row}`, p.produto);
      setEjsCell(wsProd, `C${row}`, p.categoria);
      setEjsCell(wsProd, `D${row}`, p.unidade);
      setEjsCell(wsProd, `E${row}`, p.precoCusto);
      setEjsCell(wsProd, `F${row}`, p.precoVenda);
      // G: margem em fração (0..1), formatada como % na planilha de origem
      const margemFrac = p.precoVenda > 0 ? (p.precoVenda - p.precoCusto) / p.precoVenda : 0;
      setEjsCell(wsProd, `G${row}`, Math.round(margemFrac * 10000) / 10000);
      wsProd.getCell(`G${row}`).numFmt = '0.0%';
      setEjsCell(wsProd, `H${row}`, p.estoqueMin);
      setEjsCell(wsProd, `I${row}`, p.estoqueAtual);
      setEjsCell(wsProd, `J${row}`, p.valorEstoque);
      setEjsCell(wsProd, `K${row}`, p.status);
      setEjsCell(wsProd, `L${row}`, p.observacoes);
    });
  }

  // Movimentações — preenche também produto resolvido (C) e custo total (H).
  const wsMov = wb.getWorksheet('Movimentações') || wb.getWorksheet('Movimentacoes');
  if (wsMov) {
    clearEjsRange(wsMov, ['A','B','C','D','E','F','G','H'], 5, 100);
    state.movimentacoes.forEach((m, i) => {
      const row = 5 + i;
      const produtoNome = m.produto || state.produtos.find(p => p.sku === m.sku)?.produto || '';
      setEjsCell(wsMov, `A${row}`, m.data, true);
      setEjsCell(wsMov, `B${row}`, m.sku);
      setEjsCell(wsMov, `C${row}`, produtoNome);
      setEjsCell(wsMov, `D${row}`, m.fornecedor);
      // E (Nota Fiscal): sempre como texto, preservando o que o usuário digitou.
      setEjsCell(wsMov, `E${row}`, m.notaFiscal == null ? '' : String(m.notaFiscal));
      setEjsCell(wsMov, `F${row}`, m.quantidade);
      setEjsCell(wsMov, `G${row}`, m.custoUnit);
      setEjsCell(wsMov, `H${row}`, round2((m.quantidade || 0) * (m.custoUnit || 0)));
    });
  }

  // Vendas — preenche cliente resolvido (E), preço unit (G) e venda total (I).
  const wsVen = wb.getWorksheet('Vendas');
  if (wsVen) {
    clearEjsRange(wsVen, ['A','B','C','D','E','F','G','H','I','J','K'], 5, 100);
    state.vendas.forEach((v, i) => {
      const row = 5 + i;
      const clienteNome = v.cliente || state.clientes.find(c => c.codigo === v.codCliente)?.nome || '';
      const total = round2((v.quantidade || 0) * (v.precoUnit || 0) * (1 - (v.descontoPercent || 0) / 100));
      setEjsCell(wsVen, `A${row}`, v.data, true);
      setEjsCell(wsVen, `B${row}`, v.numVenda);
      setEjsCell(wsVen, `C${row}`, v.codCliente);
      setEjsCell(wsVen, `D${row}`, v.skuProduto);
      setEjsCell(wsVen, `E${row}`, clienteNome);
      setEjsCell(wsVen, `F${row}`, v.quantidade);
      setEjsCell(wsVen, `G${row}`, v.precoUnit);
      setEjsCell(wsVen, `H${row}`, v.descontoPercent);
      setEjsCell(wsVen, `I${row}`, total);
      setEjsCell(wsVen, `J${row}`, v.formaPgto);
      setEjsCell(wsVen, `K${row}`, v.status);
    });
  }

  // Fluxo de Caixa
  const wsFc = wb.getWorksheet('Fluxo de Caixa');
  if (wsFc) {
    setEjsCell(wsFc, 'D4', state.fluxoCaixa.saldoInicial);
    clearEjsRange(wsFc, ['A','B','C','D','E','F','G','H'], 8, 37);
    state.fluxoCaixa.entradas.forEach((e, i) => {
      const row = 8 + i;
      if (row > 37) return;
      setEjsCell(wsFc, `A${row}`, e.data, true);
      setEjsCell(wsFc, `B${row}`, e.descricao);
      setEjsCell(wsFc, `C${row}`, e.categoria);
      setEjsCell(wsFc, `D${row}`, e.clienteFornecedor);
      setEjsCell(wsFc, `E${row}`, e.formaPgto);
      setEjsCell(wsFc, `F${row}`, e.valor);
      setEjsCell(wsFc, `G${row}`, e.status);
      setEjsCell(wsFc, `H${row}`, e.observacoes);
    });
    clearEjsRange(wsFc, ['A','B','C','D','E','F','G','H'], 42, 71);
    state.fluxoCaixa.saidas.forEach((s, i) => {
      const row = 42 + i;
      if (row > 71) return;
      setEjsCell(wsFc, `A${row}`, s.data, true);
      setEjsCell(wsFc, `B${row}`, s.descricao);
      setEjsCell(wsFc, `C${row}`, s.categoria);
      setEjsCell(wsFc, `D${row}`, s.clienteFornecedor);
      setEjsCell(wsFc, `E${row}`, s.formaPgto);
      setEjsCell(wsFc, `F${row}`, s.valor);
      setEjsCell(wsFc, `G${row}`, s.status);
      setEjsCell(wsFc, `H${row}`, s.observacoes);
    });
  }

  const writeContas = (sheetName: string, contas: Conta[]) => {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) return;
    clearEjsRange(ws, ['A','B','C','D','E','F','G','H','I'], 5, 100);
    contas.forEach((c, i) => {
      const row = 5 + i;
      const quitada = c.status === 'Pago' || c.status === 'Recebido';
      const valorPago = quitada ? round2(c.valorPago || c.valor) : round2(c.valorPago || 0);
      const dataPgto = quitada ? (c.dataPgto || c.vencimento) : c.dataPgto;
      setEjsCell(ws, `A${row}`, c.vencimento, true);
      setEjsCell(ws, `B${row}`, c.descricao);
      setEjsCell(ws, `C${row}`, c.categoria);
      setEjsCell(ws, `D${row}`, c.fornecedorCliente);
      setEjsCell(ws, `E${row}`, c.valor);
      setEjsCell(ws, `F${row}`, valorPago);
      setEjsCell(ws, `G${row}`, dataPgto, true);
      setEjsCell(ws, `H${row}`, c.status);
      setEjsCell(ws, `I${row}`, c.observacoes);
    });
  };
  writeContas('Contas a Pagar', state.contasPagar);
  writeContas('Contas a Receber', state.contasReceber);

  // DRE — só células editáveis (C..N = meses 0..11). Coluna O é fórmula total.
  const wsDre = wb.getWorksheet('DRE');
  if (wsDre) {
    const dreStructure = getDREStructure();
    state.dreRows.forEach((row, i) => {
      const line = dreStructure[i];
      if (!line || !line.isEditable) return;
      row.valores.forEach((value, monthIdx) => {
        const col = String.fromCharCode(67 + monthIdx);
        setEjsCell(wsDre, `${col}${line.excelRow}`, value);
      });
    });
  }

  // Categorias
  const wsCat = wb.getWorksheet('Categorias');
  if (wsCat) {
    clearEjsRange(wsCat, ['A','B'], 5, 11);
    state.categorias.receitas.forEach((c, i) => {
      setEjsCell(wsCat, `A${5+i}`, c.codigo);
      setEjsCell(wsCat, `B${5+i}`, c.categoria);
    });
    clearEjsRange(wsCat, ['A','B'], 15, 27);
    state.categorias.despesas.forEach((c, i) => {
      setEjsCell(wsCat, `A${15+i}`, c.codigo);
      setEjsCell(wsCat, `B${15+i}`, c.categoria);
    });
  }

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date();
  const dataStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
  a.download = `SyncSheet_Gestao_Financeira_${dataStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function getDREStructure() {
  return [
    { excelRow: 6, conta: '1.1', descricao: 'Vendas de Produtos', isEditable: true, isTotal: false, style: undefined as any },
    { excelRow: 7, conta: '1.2', descricao: 'Vendas de Serviços', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 8, conta: '1.3', descricao: 'Cursos e Infoprodutos', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 9, conta: '1.4', descricao: 'Assinaturas / Recorrência', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 10, conta: '1.5', descricao: 'Outras Receitas', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 11, conta: '(=)', descricao: 'RECEITA BRUTA TOTAL', isEditable: false, isTotal: true, style: 'receita-bruta' as const },
    { excelRow: 14, conta: '2.1', descricao: 'Impostos sobre Vendas', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 15, conta: '2.2', descricao: 'Devoluções e Cancelamentos', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 16, conta: '(=)', descricao: 'RECEITA LÍQUIDA', isEditable: false, isTotal: true, style: 'receita-liquida' as const },
    { excelRow: 19, conta: '3.1', descricao: 'CMV', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 20, conta: '3.2', descricao: 'Custo de Serviço', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 21, conta: '(=)', descricao: 'LUCRO BRUTO', isEditable: false, isTotal: true, style: 'lucro-bruto' as const },
    { excelRow: 24, conta: '4.1', descricao: 'Salários', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 25, conta: '4.2', descricao: 'Aluguel', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 26, conta: '4.3', descricao: 'Marketing', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 27, conta: '4.4', descricao: 'Ferramentas / Software', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 28, conta: '4.5', descricao: 'Contabilidade', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 29, conta: '4.6', descricao: 'Telefone / Internet', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 30, conta: '4.7', descricao: 'Terceirizados', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 31, conta: '4.8', descricao: 'Material', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 32, conta: '4.9', descricao: 'Outras Despesas', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 33, conta: '(=)', descricao: 'TOTAL DESPESAS OPERACIONAIS', isEditable: false, isTotal: true, style: 'despesas' as const },
    { excelRow: 35, conta: '(=)', descricao: 'RESULTADO OPERACIONAL', isEditable: false, isTotal: true, style: 'resultado-operacional' as const },
    { excelRow: 38, conta: '5.1', descricao: 'Receitas Financeiras', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 39, conta: '5.2', descricao: 'Despesas Financeiras', isEditable: true, isTotal: false, style: undefined },
    { excelRow: 40, conta: '(=)', descricao: 'RESULTADO FINANCEIRO', isEditable: false, isTotal: true, style: undefined },
    { excelRow: 43, conta: '(=)', descricao: 'RESULTADO LÍQUIDO', isEditable: false, isTotal: true, style: 'resultado-liquido' as const },
    { excelRow: 45, conta: '%', descricao: 'MARGEM LÍQUIDA', isEditable: false, isTotal: true, style: 'margem' as const },
  ];
}

export function getDefaultDRE(): DRERow[] {
  return getDREStructure().map(line => ({
    conta: line.conta, descricao: line.descricao, valores: Array(12).fill(0),
    total: 0, isEditable: line.isEditable, isTotal: line.isTotal, style: line.style,
  }));
}

function getDefaultCategoriasReceita(): Categoria[] {
  return [
    { codigo: 'R01', categoria: 'Vendas de Produtos' },
    { codigo: 'R02', categoria: 'Vendas de Serviços' },
    { codigo: 'R03', categoria: 'Cursos e Infoprodutos' },
    { codigo: 'R04', categoria: 'Assinaturas' },
    { codigo: 'R05', categoria: 'Receitas Financeiras' },
    { codigo: 'R06', categoria: 'Outras Receitas' },
  ];
}

function getDefaultCategoriasDespesa(): Categoria[] {
  return [
    { codigo: 'D01', categoria: 'CMV' },
    { codigo: 'D02', categoria: 'Custo de Serviço' },
    { codigo: 'D03', categoria: 'Salários' },
    { codigo: 'D04', categoria: 'Aluguel' },
    { codigo: 'D05', categoria: 'Marketing' },
    { codigo: 'D06', categoria: 'Ferramentas' },
    { codigo: 'D07', categoria: 'Contabilidade' },
    { codigo: 'D08', categoria: 'Telefone/Internet' },
    { codigo: 'D09', categoria: 'Terceirizados' },
    { codigo: 'D10', categoria: 'Material' },
    { codigo: 'D11', categoria: 'Impostos' },
    { codigo: 'D12', categoria: 'Outras' },
  ];
}
