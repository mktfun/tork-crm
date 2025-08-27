import { Navigate } from 'react-router-dom';

// Redireciona para a nova estrutura de configurações
export default function Settings() {
  return <Navigate to="/dashboard/settings/profile" replace />;
}
