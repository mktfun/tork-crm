import { Tables } from '@/integrations/supabase/types';

// Transform Supabase policy data to component format
export function transformPolicyData(policy: Tables<'apolices'>): any {
  return {
    id: policy.id,
    clientId: policy.client_id,
    premiumValue: policy.premium_value,
    commissionRate: policy.commission_rate,
    createdAt: policy.created_at,
    expirationDate: policy.expiration_date,
    startDate: policy.start_date,
    status: policy.status,
    type: policy.type,
    insuranceCompany: policy.insurance_company,
    insuredAsset: policy.insured_asset,
    policyNumber: policy.policy_number,
    installments: policy.installments,
    bonusClass: policy.bonus_class,
    producerId: policy.producer_id,
    brokerageId: policy.brokerage_id,
    renewalStatus: policy.renewal_status,
    updatedAt: policy.updated_at,
    // Keep original snake_case properties for backward compatibility
    client_id: policy.client_id,
    premium_value: policy.premium_value,
    commission_rate: policy.commission_rate,
    created_at: policy.created_at,
    expiration_date: policy.expiration_date,
    start_date: policy.start_date,
    insurance_company: policy.insurance_company,
    insured_asset: policy.insured_asset,
    policy_number: policy.policy_number,
    bonus_class: policy.bonus_class,
    producer_id: policy.producer_id,
    brokerage_id: policy.brokerage_id,
    renewal_status: policy.renewal_status,
    updated_at: policy.updated_at
  };
}

// Transform Supabase client data to component format
export function transformClientData(client: Tables<'clientes'>): any {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
    status: client.status,
    birthDate: client.birth_date,
    cpfCnpj: client.cpf_cnpj,
    address: client.address,
    number: client.number,
    complement: client.complement,
    neighborhood: client.neighborhood,
    city: client.city,
    state: client.state,
    cep: client.cep,
    profession: client.profession,
    maritalStatus: client.marital_status,
    observations: client.observations,
    // Keep original snake_case properties for backward compatibility
    created_at: client.created_at,
    updated_at: client.updated_at,
    birth_date: client.birth_date,
    cpf_cnpj: client.cpf_cnpj,
    marital_status: client.marital_status
  };
}

// Transform Supabase transaction data to component format
export function transformTransactionData(transaction: Tables<'transactions'>): any {
  return {
    id: transaction.id,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date,
    dueDate: transaction.due_date,
    transactionDate: transaction.transaction_date,
    status: transaction.status,
    nature: transaction.nature,
    typeId: transaction.type_id,
    clientId: transaction.client_id,
    policyId: transaction.policy_id,
    producerId: transaction.producer_id,
    brokerageId: transaction.brokerage_id,
    companyId: transaction.company_id,
    ramoId: transaction.ramo_id, // ✅ CORREÇÃO: Adicionar ramo_id
    createdAt: transaction.created_at,
    updatedAt: transaction.updated_at,
    // Keep original snake_case properties for backward compatibility
    due_date: transaction.due_date,
    transaction_date: transaction.transaction_date,
    type_id: transaction.type_id,
    client_id: transaction.client_id,
    policy_id: transaction.policy_id,
    producer_id: transaction.producer_id,
    brokerage_id: transaction.brokerage_id,
    company_id: transaction.company_id,
    ramo_id: transaction.ramo_id, // ✅ CORREÇÃO: Adicionar ramo_id
    created_at: transaction.created_at,
    updated_at: transaction.updated_at
  };
}
