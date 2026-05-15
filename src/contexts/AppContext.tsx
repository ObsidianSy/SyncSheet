import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppState, Cliente, Produto, Movimentacao, Venda, LancamentoFC, Conta, DRERow, Categoria } from '@/types';
import { readExcel, writeExcel, computeStock, getDefaultDRE } from '@/utils/excel';
import { syncAll } from '@/utils/sync';

interface AppContextType {
  state: AppState;
  loadFromExcel: (buffer: ArrayBuffer) => void;
  downloadExcel: () => void;
  setClientes: (c: Cliente[]) => void;
  setProdutos: (p: Produto[]) => void;
  setMovimentacoes: (m: Movimentacao[]) => void;
  setVendas: (v: Venda[]) => void;
  setFluxoCaixa: (fc: AppState['fluxoCaixa']) => void;
  setContasPagar: (c: Conta[]) => void;
  setContasReceber: (c: Conta[]) => void;
  setDreRows: (d: DRERow[]) => void;
  setCategorias: (c: AppState['categorias']) => void;
  setCategoriasProduto: (cats: string[]) => void;
  addCategoriaProduto: (cat: string) => void;
  recalcStock: () => void;
}

export const DEFAULT_CATEGORIAS_PRODUTO: string[] = [
  'Vestuário',
  'Calçados',
  'Acessórios',
  'Eletrônicos',
  'Alimentos',
  'Bebidas',
  'Casa e Decoração',
  'Beleza e Cuidados',
  'Outros',
];

const defaultState: AppState = {
  isLoaded: false,
  clientes: [],
  produtos: [],
  movimentacoes: [],
  vendas: [],
  fluxoCaixa: { saldoInicial: 0, entradas: [], saidas: [] },
  contasPagar: [],
  contasReceber: [],
  dreRows: getDefaultDRE(),
  categorias: {
    receitas: [
      { codigo: 'R01', categoria: 'Vendas de Produtos' },
      { codigo: 'R02', categoria: 'Vendas de Serviços' },
      { codigo: 'R03', categoria: 'Cursos e Infoprodutos' },
      { codigo: 'R04', categoria: 'Assinaturas' },
      { codigo: 'R05', categoria: 'Receitas Financeiras' },
      { codigo: 'R06', categoria: 'Outras Receitas' },
    ],
    despesas: [
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
    ],
  },
  categoriasProduto: DEFAULT_CATEGORIAS_PRODUTO,
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [originalBuffer, setOriginalBuffer] = useState<ArrayBuffer | null>(null);

  const loadFromExcel = useCallback((buffer: ArrayBuffer) => {
    setOriginalBuffer(buffer);
    const data = readExcel(buffer);
    setState(syncAll(data));
  }, []);

  const downloadExcel = useCallback(() => {
    void writeExcel(state, originalBuffer);
  }, [state, originalBuffer]);

  const recalcStock = useCallback(() => {
    setState(prev => ({
      ...prev,
      produtos: computeStock(prev.produtos, prev.movimentacoes, prev.vendas),
    }));
  }, []);

  const setClientes = (c: Cliente[]) => setState(s => ({ ...s, clientes: c }));
  const setProdutos = (p: Produto[]) => setState(s => ({ ...s, produtos: computeStock(p, s.movimentacoes, s.vendas) }));
  const setMovimentacoes = (m: Movimentacao[]) => setState(s => syncAll({ ...s, movimentacoes: m, produtos: computeStock(s.produtos, m, s.vendas) }));
  const setVendas = (v: Venda[]) => setState(s => syncAll({ ...s, vendas: v, produtos: computeStock(s.produtos, s.movimentacoes, v) }));
  const setFluxoCaixa = (fc: AppState['fluxoCaixa']) => setState(s => syncAll({ ...s, fluxoCaixa: fc }));
  const setContasPagar = (c: Conta[]) => setState(s => syncAll({ ...s, contasPagar: c }));
  const setContasReceber = (c: Conta[]) => setState(s => syncAll({ ...s, contasReceber: c }));
  const setDreRows = (d: DRERow[]) => setState(s => ({ ...s, dreRows: d }));
  const setCategorias = (c: AppState['categorias']) => setState(s => ({ ...s, categorias: c }));
  const setCategoriasProduto = (cats: string[]) => setState(s => ({ ...s, categoriasProduto: cats }));
  const addCategoriaProduto = (cat: string) => {
    const nova = cat.trim();
    if (!nova) return;
    setState(s => s.categoriasProduto.some(c => c.toLowerCase() === nova.toLowerCase())
      ? s
      : { ...s, categoriasProduto: [...s.categoriasProduto, nova] });
  };

  return (
    <AppContext.Provider value={{
      state, loadFromExcel, downloadExcel,
      setClientes, setProdutos, setMovimentacoes, setVendas,
      setFluxoCaixa, setContasPagar, setContasReceber, setDreRows, setCategorias,
      setCategoriasProduto, addCategoriaProduto, recalcStock,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
