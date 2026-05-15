import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import AppLayout from "@/components/AppLayout";
import WelcomeScreen from "@/components/WelcomeScreen";
import DashboardPage from "@/pages/DashboardPage";
import ClientesPage from "@/pages/ClientesPage";
import ProdutosPage from "@/pages/ProdutosPage";
import MovimentacoesPage from "@/pages/MovimentacoesPage";
import VendasPage from "@/pages/VendasPage";
import FluxoCaixaPage from "@/pages/FluxoCaixaPage";
import ContasPage from "@/pages/ContasPage";
import DREPage from "@/pages/DREPage";
import CategoriasPage from "@/pages/CategoriasPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { state } = useAppContext();

  if (!state.isLoaded) {
    return <WelcomeScreen />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/movimentacoes" element={<MovimentacoesPage />} />
        <Route path="/vendas" element={<VendasPage />} />
        <Route path="/fluxo-de-caixa" element={<FluxoCaixaPage />} />
        <Route path="/contas-a-pagar" element={<ContasPage tipo="pagar" />} />
        <Route path="/contas-a-receber" element={<ContasPage tipo="receber" />} />
        <Route path="/dre" element={<DREPage />} />
        <Route path="/categorias" element={<CategoriasPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
