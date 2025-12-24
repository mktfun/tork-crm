import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_TRANSACTION_TYPES = {
  COMMISSION: 'commission-default',
  EXPENSE: 'expense-default',
  INCOME: 'income-default'
};

export async function ensureDefaultTransactionTypes(userId: string) {
  try {
    // Use upsert with ON CONFLICT to prevent duplicates
    // The unique constraint (user_id, name, nature) will handle conflicts
    await supabase
      .from('transaction_types')
      .upsert([
        {
          user_id: userId,
          name: 'Comissão',
          nature: 'GANHO'
        },
        {
          user_id: userId,
          name: 'Despesa',
          nature: 'PERDA'
        }
      ], {
        onConflict: 'user_id,name,nature',
        ignoreDuplicates: true
      });
  } catch (error) {
    // Silent fail - don't block the auth process
    if (process.env.NODE_ENV === 'development') {
      console.error('Error ensuring default transaction types:', error);
    }
  }
}
