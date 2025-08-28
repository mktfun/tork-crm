import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_TRANSACTION_TYPES = {
  COMMISSION: 'commission-default',
  EXPENSE: 'expense-default',
  INCOME: 'income-default'
};

export async function ensureDefaultTransactionTypes(userId: string) {
  try {
    // Run both checks in parallel for better performance
    const [commissionResult, expenseResult] = await Promise.all([
      supabase
        .from('transaction_types')
        .select('id')
        .eq('user_id', userId)
        .eq('name', 'Comissão')
        .eq('nature', 'GANHO')
        .maybeSingle(),
      
      supabase
        .from('transaction_types')
        .select('id')
        .eq('user_id', userId)
        .eq('name', 'Despesa')
        .eq('nature', 'PERDA')
        .maybeSingle()
    ]);

    const insertPromises = [];

    // Prepare inserts to run in parallel
    if (!commissionResult.data) {
      insertPromises.push(
        supabase
          .from('transaction_types')
          .insert({
            user_id: userId,
            name: 'Comissão',
            nature: 'GANHO'
          })
      );
    }

    if (!expenseResult.data) {
      insertPromises.push(
        supabase
          .from('transaction_types')
          .insert({
            user_id: userId,
            name: 'Despesa',
            nature: 'PERDA'
          })
      );
    }

    // Execute all inserts in parallel
    if (insertPromises.length > 0) {
      await Promise.allSettled(insertPromises);
    }
  } catch (error) {
    // Silent fail - don't block the auth process
    if (process.env.NODE_ENV === 'development') {
      console.error('Error ensuring default transaction types:', error);
    }
  }
}
