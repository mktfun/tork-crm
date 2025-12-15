export function formatCurrency(value: number): string {
  // Garantir que value é número válido
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  
  return safeValue.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
