import { Transaction, Policy, Client } from '@/types';

/**
 * Gera um título de exibição inteligente para transações.
 * Se a descrição contém "undefined" ou está vazia, usa fallback:
 * Cliente • Ramo • Seguradora
 */
export function getTransactionDisplayTitle(
  transaction: Transaction,
  policies: Policy[],
  clients: Client[]
): string {
  const policy = policies.find(p => p.id === transaction.policyId);
  const client = clients.find(c => c.id === transaction.clientId);
  
  // Se a descrição está ok, retornar ela
  if (transaction.description && !transaction.description.includes('undefined')) {
    return transaction.description;
  }
  
  // Se tem apólice com número, usar o número da apólice
  if (policy?.policyNumber) {
    return `Comissão da apólice ${policy.policyNumber}`;
  }
  
  // Fallback: Cliente • Ramo • Seguradora
  const clientName = client?.name || 'Cliente não ident.';
  const ramoName = policy?.ramos?.nome || policy?.type || 'Diversos';
  const companyName = policy?.companies?.name || '';
  
  return companyName 
    ? `${clientName} • ${ramoName} • ${companyName}`
    : `${clientName} • ${ramoName}`;
}
