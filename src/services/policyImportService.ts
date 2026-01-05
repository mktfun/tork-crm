import { supabase } from '@/integrations/supabase/client';
import { ExtractedPolicyData, PolicyImportItem, ClientReconcileStatus } from '@/types/policyImport';

// Normaliza CPF/CNPJ removendo formatação
function normalizeCpfCnpj(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/[^\d]/g, '');
}

// Busca cliente por CPF/CNPJ
async function findClientByCpfCnpj(cpfCnpj: string, userId: string) {
  const normalized = normalizeCpfCnpj(cpfCnpj);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('clientes')
    .select('id, name, cpf_cnpj, email')
    .eq('user_id', userId)
    .ilike('cpf_cnpj', `%${normalized}%`)
    .limit(1);

  if (error) {
    console.error('Error finding client by CPF/CNPJ:', error);
    return null;
  }

  return data?.[0] || null;
}

// Busca cliente por email
async function findClientByEmail(email: string, userId: string) {
  if (!email) return null;

  const { data, error } = await supabase
    .from('clientes')
    .select('id, name, cpf_cnpj, email')
    .eq('user_id', userId)
    .ilike('email', email.trim())
    .limit(1);

  if (error) {
    console.error('Error finding client by email:', error);
    return null;
  }

  return data?.[0] || null;
}

// Busca seguradora pelo nome
export async function matchSeguradora(nome: string, userId: string) {
  if (!nome) return null;

  const normalizedName = nome.toLowerCase().trim();

  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching companies:', error);
    return null;
  }

  // Tenta encontrar match parcial
  const match = data?.find(company => 
    company.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(company.name.toLowerCase())
  );

  return match || null;
}

// Busca ramo pelo nome
export async function matchRamo(nome: string, userId: string) {
  if (!nome) return null;

  const normalizedName = nome.toLowerCase().trim();

  const { data, error } = await supabase
    .from('ramos')
    .select('id, nome')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching ramos:', error);
    return null;
  }

  // Mapeamento de variações comuns
  const ramoKeywords: Record<string, string[]> = {
    'auto': ['auto', 'automóvel', 'automovel', 'veículo', 'veiculo', 'carro'],
    'residencial': ['residencial', 'residência', 'residencia', 'casa', 'apartamento'],
    'vida': ['vida', 'pessoal'],
    'empresarial': ['empresarial', 'empresa', 'comercial', 'negócio', 'negocio'],
    'saúde': ['saúde', 'saude', 'médico', 'medico'],
    'viagem': ['viagem', 'travel'],
    'responsabilidade civil': ['responsabilidade', 'rc', 'civil'],
    'transporte': ['transporte', 'carga', 'mercadoria'],
  };

  // Primeiro tenta match direto
  let match = data?.find(ramo => 
    ramo.nome.toLowerCase() === normalizedName
  );

  if (!match) {
    // Tenta match por keywords
    for (const [key, keywords] of Object.entries(ramoKeywords)) {
      if (keywords.some(kw => normalizedName.includes(kw))) {
        match = data?.find(ramo => 
          ramo.nome.toLowerCase().includes(key) ||
          keywords.some(kw => ramo.nome.toLowerCase().includes(kw))
        );
        if (match) break;
      }
    }
  }

  if (!match) {
    // Tenta match parcial
    match = data?.find(ramo => 
      ramo.nome.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(ramo.nome.toLowerCase())
    );
  }

  return match || null;
}

// Reconcilia clientes extraídos com a base de dados
export async function reconcileClient(
  extracted: ExtractedPolicyData,
  userId: string
): Promise<{
  status: ClientReconcileStatus;
  clientId?: string;
  matchedBy?: 'cpf_cnpj' | 'email';
}> {
  // Primeiro tenta por CPF/CNPJ
  if (extracted.cliente.cpf_cnpj) {
    const clientByCpf = await findClientByCpfCnpj(extracted.cliente.cpf_cnpj, userId);
    if (clientByCpf) {
      return {
        status: 'matched',
        clientId: clientByCpf.id,
        matchedBy: 'cpf_cnpj',
      };
    }
  }

  // Depois tenta por email
  if (extracted.cliente.email) {
    const clientByEmail = await findClientByEmail(extracted.cliente.email, userId);
    if (clientByEmail) {
      return {
        status: 'matched',
        clientId: clientByEmail.id,
        matchedBy: 'email',
      };
    }
  }

  // Não encontrou - cliente novo
  return { status: 'new' };
}

// Cria um novo cliente
export async function createClient(
  data: ExtractedPolicyData['cliente'],
  userId: string
): Promise<{ id: string } | null> {
  const { data: newClient, error } = await supabase
    .from('clientes')
    .insert({
      user_id: userId,
      name: data.nome_completo,
      cpf_cnpj: data.cpf_cnpj,
      email: data.email || '',
      phone: data.telefone || '',
      address: data.endereco_completo,
      status: 'Ativo',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating client:', error);
    return null;
  }

  return newClient;
}

// Upload do PDF para o Storage
export async function uploadPolicyPdf(
  file: File,
  userId: string
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('policy-docs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading PDF:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('policy-docs')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// Valida um item de importação
export function validateImportItem(item: PolicyImportItem): string[] {
  const errors: string[] = [];

  if (!item.clientName?.trim()) {
    errors.push('Nome do cliente é obrigatório');
  }

  if (!item.numeroApolice?.trim()) {
    errors.push('Número da apólice é obrigatório');
  }

  if (!item.seguradoraId) {
    errors.push('Seguradora é obrigatória');
  }

  if (!item.ramoId) {
    errors.push('Ramo é obrigatório');
  }

  if (!item.producerId) {
    errors.push('Produtor é obrigatório');
  }

  if (item.commissionRate < 0 || item.commissionRate > 100) {
    errors.push('Taxa de comissão deve estar entre 0 e 100%');
  }

  if (!item.dataInicio) {
    errors.push('Data de início é obrigatória');
  }

  if (!item.dataFim) {
    errors.push('Data de fim é obrigatória');
  }

  if (item.premioLiquido <= 0) {
    errors.push('Prêmio líquido deve ser maior que zero');
  }

  return errors;
}
