import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AIAssistantPopover } from "@/components/ai/AIAssistantPopover";
import { RootLayout } from "./layouts/RootLayout";
import { SettingsLayout } from "./layouts/SettingsLayout";
import Dashboard from "./pages/Dashboard";
import Policies from "./pages/Policies";
import PolicyDetails from "./pages/PolicyDetails";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import Appointments from "./pages/Appointments";
import FinanceiroERP from "./pages/FinanceiroERP";
import Tasks from "./pages/Tasks";
import Renovacoes from "./pages/Renovacoes";
import Sinistros from "./pages/Sinistros";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import AuthConfirm from "./pages/AuthConfirm";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import ModernMobileMenuDemo from "./pages/ModernMobileMenuDemo";
import ProfileSettings from "./pages/settings/ProfileSettings";
import BrokerageSettings from "./pages/settings/BrokerageSettings";
import ProducerSettings from "./pages/settings/ProducerSettings";
import CompanySettings from "./pages/settings/CompanySettings";
import TransactionSettings from "./pages/settings/TransactionSettings";
import RamoSettings from "./pages/settings/RamoSettings";
import Novidades from "./pages/Novidades";
import CRM from "./pages/CRM";
import ChatTorkSettings from "./pages/settings/ChatTorkSettings";

// Helper to redirect legacy detail routes to dashboard namespace
function ParamRedirect({ toBase }: { toBase: string }) {
  const params = useParams();
  const id = (params as any)?.id;
  const to = id ? `${toBase}/${id}` : toBase;
  return <Navigate to={to} replace />;
}

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
            <AIAssistantPopover />
            <div className="min-h-screen">
              <Routes>
                {/* Rota principal - Landing page para não autenticados */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/confirm" element={<AuthConfirm />} />
                <Route path="/auth/reset-password" element={<AuthConfirm />} />

                {/* Redirects for legacy/direct route access */}
                <Route path="/appointments" element={<Navigate to="/dashboard/appointments" replace />} />
                <Route path="/policies" element={<Navigate to="/dashboard/policies" replace />} />
                <Route path="/policies/:id" element={<ParamRedirect toBase="/dashboard/policies" />} />
                <Route path="/clients" element={<Navigate to="/dashboard/clients" replace />} />
                <Route path="/clients/:id" element={<ParamRedirect toBase="/dashboard/clients" />} />
                <Route path="/tasks" element={<Navigate to="/dashboard/tasks" replace />} />
                <Route path="/faturamento" element={<Navigate to="/dashboard/financeiro" replace />} />
                <Route path="/renovacoes" element={<Navigate to="/dashboard/renovacoes" replace />} />
                <Route path="/sinistros" element={<Navigate to="/dashboard/sinistros" replace />} />
                <Route path="/reports" element={<Navigate to="/dashboard/reports" replace />} />

                {/* Todas as rotas do sistema são protegidas */}
                <Route path="/dashboard" element={
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
                  <Route path="financeiro" element={<FinanceiroERP />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="renovacoes" element={<Renovacoes />} />
                  <Route path="sinistros" element={<Sinistros />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="novidades" element={<Novidades />} />
                  <Route path="crm" element={<CRM />} />
                  <Route path="demo/mobile-menu" element={<ModernMobileMenuDemo />} />
                  
                  {/* Rotas de configurações com layout próprio */}
                  <Route path="settings" element={<SettingsLayout />}>
                    <Route index element={<Navigate to="/dashboard/settings/profile" replace />} />
                    <Route path="profile" element={<ProfileSettings />} />
                    <Route path="brokerages" element={<BrokerageSettings />} />
                    <Route path="producers" element={<ProducerSettings />} />
                    <Route path="companies" element={<CompanySettings />} />
                    <Route path="ramos" element={<RamoSettings />} />
                    <Route path="transactions" element={<TransactionSettings />} />
                    <Route path="chat-tork" element={<ChatTorkSettings />} />
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
