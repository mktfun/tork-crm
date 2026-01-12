// Dados extraídos pela IA do PDF
export interface ExtractedPolicyData {
  cliente: {
    nome_completo: string;
    cpf_cnpj: string | null;
    email: string | null;
    telefone: string | null;
    endereco_completo: string | null;
  };
  apolice: {
    numero_apolice: string;
    nome_seguradora: string;
    data_inicio: string;
    data_fim: string;
    ramo_seguro: string;
  };
  objeto_segurado: {
    descricao_bem: string;
  };
  valores: {
    premio_liquido: number;
    premio_total: number;
  };
}

// Resultado da API de análise
export interface AnalyzePolicyResult {
  success: boolean;
  data?: ExtractedPolicyData;
  error?: string;
}

// Status de reconciliação do cliente
export type ClientReconcileStatus = 'matched' | 'new';

// Tipo de documento detectado pela IA
export type DocumentType = 'APOLICE' | 'PROPOSTA' | 'ORCAMENTO' | 'ENDOSSO';

// Item processado para a tabela de revisão
export interface PolicyImportItem {
  id: string;              // UUID temporário
  file: File;              // Arquivo original
  filePreviewUrl: string;  // Para miniatura
  fileName: string;        // Nome do arquivo
  
  // Dados extraídos
  extracted: ExtractedPolicyData;
  
  // Status de reconciliação
  clientStatus: ClientReconcileStatus;
  clientId?: string;
  clientName: string;      // Editável
  clientCpfCnpj: string | null;
  matchedBy?: 'cpf_cnpj' | 'email';
  
  // Campos selecionáveis pelo usuário
  seguradoraId: string | null;
  seguradoraNome: string;
  ramoId: string | null;
  ramoNome: string;
  producerId: string | null;
  commissionRate: number;
  
  // Dados da apólice
  numeroApolice: string;
  dataInicio: string;
  dataFim: string;
  objetoSegurado: string;
  premioLiquido: number;
  premioTotal: number;
  
  // NOVOS CAMPOS v3.0
  tipoDocumento: DocumentType | null;
  tipoOperacao: 'RENOVACAO' | 'NOVA' | 'ENDOSSO' | null;
  endossoMotivo: string | null;
  tituloSugerido: string;
  identificacaoAdicional: string | null;  // Placa, CEP, etc
  
  // Calculado
  estimatedCommission: number;
  
  // Validação
  isValid: boolean;
  validationErrors: string[];
  
  // Estado de processamento
  isProcessing?: boolean;
  isProcessed?: boolean;
  processError?: string;
}

// Resultado da importação
export interface PolicyImportResult {
  success: number;
  errors: number;
  details: {
    policyId?: string;
    clientId?: string;
    clientCreated: boolean;
    error?: string;
  }[];
}

// Dados extraídos pelo OCR Bulk (v3.0 expandido)
export interface BulkOCRExtractedPolicy {
  // Cliente
  nome_cliente: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco_completo: string | null;         // NOVO: Endereço completo com CEP
  
  // Documento
  tipo_documento: DocumentType | null;      // NOVO: APOLICE, PROPOSTA, ORCAMENTO, ENDOSSO
  numero_apolice: string;
  numero_proposta: string | null;           // NOVO: Se diferente do número da apólice
  tipo_operacao: 'RENOVACAO' | 'NOVA' | 'ENDOSSO' | null;
  endosso_motivo: string | null;            // NOVO: Motivo do endosso
  
  // Seguro
  nome_seguradora: string;
  ramo_seguro: string;
  data_inicio: string;
  data_fim: string;
  
  // Objeto segurado
  descricao_bem: string | null;
  objeto_segurado: string | null;           // Ex: VW Golf GTI 2024
  identificacao_adicional: string | null;   // Placa do veículo ou endereço/CEP
  
  // Valores (NUMBERS puros!)
  premio_liquido: number;
  premio_total: number;
  
  // Metadados
  titulo_sugerido: string;                  // NOME - RAMO (OBJETO) - ID - CIA
  arquivo_origem: string;
}

// Resposta da Edge Function ocr-bulk-analyze
export interface BulkOCRResponse {
  success: boolean;
  data?: BulkOCRExtractedPolicy[];
  processedFiles?: string[];
  errors?: Array<{ fileName: string; error: string }>;
  stats?: {
    total: number;
    success: number;
    failed: number;
  };
  error?: string;
}
