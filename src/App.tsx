import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RootLayout } from "./layouts/RootLayout";
import { SettingsLayout } from "./layouts/SettingsLayout";
import Dashboard from "./pages/Dashboard";
import Policies from "./pages/Policies";
import PolicyDetails from "./pages/PolicyDetails";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import Appointments from "./pages/Appointments";
import Faturamento from "./pages/Faturamento";
import Tasks from "./pages/Tasks";
import Renovacoes from "./pages/Renovacoes";
import Sinistros from "./pages/Sinistros";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import ProfileSettings from "./pages/settings/ProfileSettings";
import BrokerageSettings from "./pages/settings/BrokerageSettings";
import ProducerSettings from "./pages/settings/ProducerSettings";
import CompanySettings from "./pages/settings/CompanySettings";
import TransactionSettings from "./pages/settings/TransactionSettings";

// Create query client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <div className="min-h-screen">
              <Routes>
                {/* Rota pública de autenticação */}
                <Route path="/auth" element={<Auth />} />
                
                {/* Todas as outras rotas são protegidas */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <RootLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="policies" element={<Policies />} />
                  <Route path="policies/:id" element={<PolicyDetails />} />
                  <Route path="clients" element={<Clients />} />
                  <Route path="clients/:id" element={<ClientDetails />} />
                  <Route path="appointments" element={<Appointments />} />
                  <Route path="faturamento" element={<Faturamento />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="renovacoes" element={<Renovacoes />} />
                  <Route path="sinistros" element={<Sinistros />} />
                  <Route path="reports" element={<Reports />} />
                  
                  {/* Rotas de configurações com layout próprio */}
                  <Route path="settings" element={<SettingsLayout />}>
                    <Route index element={<Navigate to="/settings/profile" replace />} />
                    <Route path="profile" element={<ProfileSettings />} />
                    <Route path="brokerages" element={<BrokerageSettings />} />
                    <Route path="producers" element={<ProducerSettings />} />
                    <Route path="companies" element={<CompanySettings />} />
                    <Route path="transactions" element={<TransactionSettings />} />
                  </Route>
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            
            {/* Toast components */}
            <Toaster />
            <Sonner />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
