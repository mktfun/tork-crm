
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_TRANSACTION_TYPES = {
  COMMISSION: 'commission-default',
  EXPENSE: 'expense-default',
  INCOME: 'income-default'
};

export async function ensureDefaultTransactionTypes(userId: string) {
  console.log('🔧 Ensuring default transaction types for user:', userId);
  
  // Check if default commission type exists
  const { data: existingCommission } = await supabase
    .from('transaction_types')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Comissão')
    .eq('nature', 'GANHO')
    .maybeSingle(); // ✅ CORREÇÃO: Mudou de .single() para .maybeSingle()

  if (!existingCommission) {
    console.log('📝 Creating default commission transaction type');
    const { error } = await supabase
      .from('transaction_types')
      .insert({
        user_id: userId,
        name: 'Comissão',
        nature: 'GANHO'
      });

    if (error) {
      console.error('Error creating default commission type:', error);
    } else {
      console.log('✅ Default commission type created');
    }
  }

  // Check if default expense type exists
  const { data: existingExpense } = await supabase
    .from('transaction_types')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Despesa')
    .eq('nature', 'PERDA')
    .maybeSingle(); // ✅ CORREÇÃO: Mudou de .single() para .maybeSingle()

  if (!existingExpense) {
    console.log('📝 Creating default expense transaction type');
    const { error } = await supabase
      .from('transaction_types')
      .insert({
        user_id: userId,
        name: 'Despesa',
        nature: 'PERDA'
      });

    if (error) {
      console.error('Error creating default expense type:', error);
    } else {
      console.log('✅ Default expense type created');
    }
  }
}
