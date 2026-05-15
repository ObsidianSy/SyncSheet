export interface Cliente {
  codigo: string;
  nome: string;
  cpfCnpj: string;
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  canalVenda: string;
  dataCadastro: string;
  observacoes: string;
}

export interface Produto {
  sku: string;
  produto: string;
  categoria: string;
  unidade: string;
  precoCusto: number;
  precoVenda: number;
  margemPercent: number;
  estoqueMin: number;
  estoqueAtual: number;
  valorEstoque: number;
  status: 'OK' | 'REPOR' | 'SEM ESTOQUE';
  observacoes: string;
}

export type MovimentacaoStatus = 'Pendente' | 'Confirmada';

export interface Movimentacao {
  data: string;
  sku: string;
  produto: string;
  fornecedor: string;
  notaFiscal: string;
  quantidade: number;
  custoUnit: number;
  custoTotal: number;
  /** ID estável para casar com a Conta a Pagar gerada (origemTipo='movimentacao'). */
  id?: string;
  /** "Confirmada" quando o pagamento da CP correspondente foi quitado. */
  status?: MovimentacaoStatus;
}

export interface Venda {
  data: string;
  numVenda: string;
  codCliente: string;
  skuProduto: string;
  cliente: string;
  quantidade: number;
  precoUnit: number;
  descontoPercent: number;
  totalVenda: number;
  formaPgto: string;
  status: 'Pago' | 'Pendente' | 'Cancelado';
}

export type OrigemTipo = 'venda' | 'conta' | 'movimentacao' | 'manual';

export interface LancamentoFC {
  data: string;
  descricao: string;
  categoria: string;
  clienteFornecedor: string;
  formaPgto: string;
  valor: number;
  status: string;
  observacoes: string;
  origemTipo?: OrigemTipo;
  origemId?: string;
}

export interface Conta {
  vencimento: string;
  descricao: string;
  categoria: string;
  fornecedorCliente: string;
  formaPgto?: string;
  valor: number;
  valorPago: number;
  dataPgto: string;
  status: 'Pendente' | 'Pago' | 'Recebido' | 'Vencido';
  observacoes: string;
  origemTipo?: OrigemTipo;
  origemId?: string;
}

export interface DRERow {
  conta: string;
  descricao: string;
  valores: number[];
  total: number;
  isEditable: boolean;
  isTotal: boolean;
  style?: 'receita-bruta' | 'receita-liquida' | 'lucro-bruto' | 'despesas' | 'resultado-operacional' | 'resultado-liquido' | 'margem';
}

export interface Categoria {
  codigo: string;
  categoria: string;
}

export interface FluxoCaixa {
  saldoInicial: number;
  entradas: LancamentoFC[];
  saidas: LancamentoFC[];
}

export interface AppState {
  isLoaded: boolean;
  clientes: Cliente[];
  produtos: Produto[];
  movimentacoes: Movimentacao[];
  vendas: Venda[];
  fluxoCaixa: FluxoCaixa;
  contasPagar: Conta[];
  contasReceber: Conta[];
  dreRows: DRERow[];
  categorias: {
    receitas: Categoria[];
    despesas: Categoria[];
  };
  /** Categorias disponíveis para Produtos (mescla default + extensões do usuário). */
  categoriasProduto: string[];
}
