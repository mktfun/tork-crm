
import { supabase } from '@/integrations/supabase/client';
import { Policy } from '@/types';

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
    .maybeSingle();

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
    .maybeSingle();

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

// 🔧 Função robusta para obter ou criar o ID do tipo de transação "Comissão"
export async function getCommissionTypeId(userId: string): Promise<string> {
  console.log('🔍 Buscando tipo de transação "Comissão" para usuário:', userId);
  
  // 1. Tenta buscar o tipo de forma determinística
  const { data: existingType, error: fetchError } = await supabase
    .from('transaction_types')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Comissão')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Erro ao buscar tipo de transação:', fetchError);
    throw new Error(`Erro ao buscar tipo de transação: ${fetchError.message}`);
  }

  if (existingType) {
    console.log('✅ Tipo "Comissão" encontrado:', existingType.id);
    return existingType.id;
  }

  // 2. Se não existir, cria
  console.log("📝 Tipo 'Comissão' não encontrado. Criando um novo...");
  const { data: newType, error: createError } = await supabase
    .from('transaction_types')
    .insert({
      user_id: userId,
      name: 'Comissão',
      nature: 'GANHO', // Em transaction_types, a natureza é conceitual
    })
    .select('id')
    .single();

  if (createError) {
    console.error('❌ Erro ao criar tipo de transação:', createError);
    throw new Error(`Erro ao criar tipo de transação: ${createError.message}`);
  }

  console.log('✅ Novo tipo "Comissão" criado:', newType.id);
  return newType.id;
}

// 🎯 **FUNÇÃO CENTRALIZADA ÚNICA** - Function to generate commission transaction for a policy
export async function gerarTransacaoDeComissao(policy: Policy) {
  console.log('💰 [CENTRALIZADA] Generating commission transaction for policy:', policy.policyNumber);
  
  if (!policy.userId) {
    console.error('❌ No user ID found for policy');
    throw new Error('Apólice ou ID do usuário inválido.');
  }

  // 🛡️ **VERIFICAÇÃO ANTI-DUPLICATA** - Check if commission already exists for this policy
  const { data: existingTransaction, error: checkError } = await supabase
    .from('transactions')
    .select('id')
    .eq('policy_id', policy.id)
    .in('nature', ['RECEITA', 'GANHO']) // Verifica ambos os padrões
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('❌ Erro ao verificar transação existente:', checkError);
    throw checkError;
  }

  if (existingTransaction) {
    console.log('⚠️ Commission transaction already exists for policy:', policy.policyNumber);
    return existingTransaction;
  }

  // Get the commission transaction type ID
  const commissionTypeId = await getCommissionTypeId(policy.userId);
  
  if (!commissionTypeId) {
    console.error('❌ No commission transaction type found for user');
    throw new Error('Tipo de transação "Comissão" não encontrado');
  }

  // Calculate commission amount
  const commissionAmount = (policy.premiumValue * policy.commissionRate) / 100;
  
  if (commissionAmount <= 0) {
    console.log('⚠️ Commission amount is zero or negative, skipping transaction creation');
    return null;
  }

  // 🎯 **CRIAÇÃO ÚNICA DA COMISSÃO** - Respeita o CHECK constraint do banco (RECEITA)
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: policy.userId,
      client_id: policy.clientId,
      policy_id: policy.id,
      type_id: commissionTypeId,
      description: `Comissão da apólice ${policy.policyNumber}`,
      amount: commissionAmount,
      date: new Date().toISOString().split('T')[0],
      transaction_date: new Date().toISOString().split('T')[0],
      due_date: policy.expirationDate,
      status: 'PENDENTE',
      nature: 'RECEITA', // 🔧 CORRIGIDO: usar RECEITA para respeitar o CHECK constraint
      company_id: policy.insuranceCompany?.toString() || null, // 🔧 Converter UUID para string
      brokerage_id: policy.brokerageId,
      producer_id: policy.producerId?.toString() || null // 🔧 Converter UUID para string
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating commission transaction:', error);
    throw error;
  }

  console.log('✅ [CENTRALIZADA] Commission transaction created successfully:', data);
  return data;
}

// 🆕 Função para criar comissão no ERP moderno (partidas dobradas)
export async function gerarTransacaoDeComissaoERP(
  policy: Policy, 
  clientName?: string, 
  ramoName?: string
): Promise<{ transaction_id: string; reference_number: string; success: boolean } | null> {
  console.log('🚀 [ERP] Disparando criação de comissão para apólice:', policy.id, 'Status: pending');
  console.log('💰 [ERP] Gerando comissão no ERP moderno para apólice:', policy.policyNumber);
  
  // 🛡️ Validação de UUID antes de enviar
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!policy.id || !uuidRegex.test(policy.id)) {
    console.error('❌ [ERP] ID da apólice inválido (não é UUID):', policy.id);
    return null;
  }
  
  const commissionAmount = (policy.premiumValue * policy.commissionRate) / 100;
  
  if (commissionAmount <= 0) {
    console.log('⚠️ [ERP] Valor de comissão zero ou negativo, pulando criação');
    return null;
  }

  // 🔧 Fallbacks robustos para evitar "undefined" na descrição
  const safeClientName = (clientName && clientName.trim() !== '' && clientName !== 'undefined') 
    ? clientName.trim() 
    : 'Cliente';
  const safeRamoName = (ramoName && ramoName.trim() !== '' && ramoName !== 'undefined') 
    ? ramoName.trim() 
    : 'Seguro';
  const safePolicyNumber = (policy.policyNumber && policy.policyNumber.trim() !== '' && policy.policyNumber !== 'undefined')
    ? policy.policyNumber.trim()
    : '';

  // 🔧 Enviar como TEXT - a RPC faz o cast interno para UUID
  const { data, error } = await supabase.rpc('register_policy_commission', {
    p_policy_id: policy.id,
    p_client_name: safeClientName,
    p_ramo_name: safeRamoName,
    p_policy_number: safePolicyNumber,
    p_commission_amount: commissionAmount,
    p_transaction_date: policy.startDate || new Date().toISOString().split('T')[0],
    p_status: 'pending'
  });

  if (error) {
    console.error('❌ [ERP] Erro ao criar comissão no ERP:', error);
    // Não lançar erro para não quebrar o fluxo - a comissão legada ainda foi criada
    return null;
  }

  const result = data?.[0];
  if (result?.success) {
    console.log('✅ [ERP] Comissão criada no ERP moderno:', result.transaction_id);
  } else {
    console.warn('⚠️ [ERP] RPC retornou sem sucesso:', result);
  }

  return result || null;
}
