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

// Extrai CEP do endereço
function extractCep(endereco: string | null | undefined): string | null {
  if (!endereco) return null;
  const match = endereco.match(/\d{5}-?\d{3}/);
  return match ? match[0].replace('-', '') : null;
}

// Extrai cidade e UF do endereço (heurística simples)
function extractCityState(endereco: string | null | undefined): { city: string | null; state: string | null } {
  if (!endereco) return { city: null, state: null };
  
  // Procura por padrão "Cidade - UF" ou "Cidade/UF" ou "Cidade, UF"
  const ufMatch = endereco.match(/([A-Za-zÀ-ÿ\s]+)[\s\-\/,]+([A-Z]{2})\s*(?:\d{5}|$)/i);
  if (ufMatch) {
    return { 
      city: ufMatch[1].trim().substring(0, 50), 
      state: ufMatch[2].toUpperCase() 
    };
  }
  
  return { city: null, state: null };
}

// Cria um novo cliente com dados completos (usa dados da IA)
export async function createClient(
  data: ExtractedPolicyData['cliente'] & { cep?: string | null },
  userId: string
): Promise<{ id: string } | null> {
  // Extrair CEP se não veio separado
  const cep = data.cep || extractCep(data.endereco_completo);
  const { city, state } = extractCityState(data.endereco_completo);
  
  const { data: newClient, error } = await supabase
    .from('clientes')
    .insert({
      user_id: userId,
      name: data.nome_completo,
      cpf_cnpj: data.cpf_cnpj,
      email: data.email || '',
      phone: data.telefone || '',
      address: data.endereco_completo || '',
      cep: cep,
      city: city,
      state: state,
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

// Cria cliente usando dados EDITADOS da tabela (não da IA)
// Isso garante que o corretor pode corrigir nomes/CPFs antes de salvar
export async function createClientFromEdited(
  clientName: string,
  cpfCnpj: string | null,
  email: string | null,
  telefone: string | null,
  endereco: string | null,
  userId: string
): Promise<{ id: string } | null> {
  const cep = extractCep(endereco);
  const { city, state } = extractCityState(endereco);
  
  const { data: newClient, error } = await supabase
    .from('clientes')
    .insert({
      user_id: userId,
      name: clientName,
      cpf_cnpj: cpfCnpj,
      email: email || '',
      phone: telefone || '',
      address: endereco || '',
      cep: cep,
      city: city,
      state: state,
      status: 'Ativo',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating client from edited data:', error);
    return null;
  }

  console.log('✅ [CREATE] Cliente criado com dados editados:', clientName, cpfCnpj);
  return newClient;
}

// Upload do PDF para o Storage com nome estruturado
// 🔴 FIX RLS: userId DEVE ser o primeiro segmento do path para passar na política de RLS
// Estrutura: userId/brokerageId/cpf/timestamp_arquivo.pdf
export async function uploadPolicyPdf(
  file: File,
  userId: string,
  cpfCnpj?: string,
  numeroApolice?: string,
  brokerageId?: number | string | null
): Promise<string | null> {
  const timestamp = Date.now();
  
  // Limpar CPF/CNPJ - usar fallback único se não tiver
  const rawCpf = cpfCnpj?.replace(/[^\d]/g, '');
  const cleanCpf = rawCpf && rawCpf.length >= 11 ? rawCpf : `novo-${timestamp}`;
  
  // Limpar nome do arquivo original para usar no path
  const originalName = file.name.replace(/[^\w.\-]/g, '_').substring(0, 50);
  
  // 🔴 FIX CRÍTICO: userId DEVE ser o primeiro segmento para passar na RLS
  // A política exige: (auth.uid())::text = (storage.foldername(name))[1]
  // Estrutura: userId/brokerageId/cpf/timestamp_arquivo.pdf
  const brokerageSegment = brokerageId ? `/${brokerageId}` : '';
  const fileName = `${userId}${brokerageSegment}/${cleanCpf}/${timestamp}_${originalName}`;
  
  console.log(`📁 [UPLOAD] Path: ${fileName} (userId first for RLS compliance)`);

  const { data, error } = await supabase.storage
    .from('policy-docs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('❌ [UPLOAD] Erro no Storage:', error.message, error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('policy-docs')
    .getPublicUrl(data.path);

  console.log('✅ [UPLOAD] PDF salvo com sucesso:', urlData.publicUrl);
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
