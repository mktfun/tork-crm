
import { z } from 'zod';

export const policyFormSchema = z.object({
  clientId: z.string().min(1, 'Cliente é obrigatório'),
  policyNumber: z.string().optional(),
  insuranceCompany: z.string().optional(), // ✅ OPERAÇÃO VIRA-LATA: Agora é opcional
  type: z.string().optional(), // ✅ OPERAÇÃO VIRA-LATA: Agora é opcional
  insuredAsset: z.string().min(1, 'Bem segurado é obrigatório'), // ✅ Corrigido: obrigatório
  premiumValue: z.number().min(0.01, 'Valor do prêmio deve ser maior que zero'),
  commissionRate: z.number().min(0, 'Taxa de comissão deve ser maior ou igual a zero').max(100, 'Taxa de comissão não pode ser maior que 100%'),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  expirationDate: z.string().optional(),
  producerId: z.string().optional(),
  brokerageId: z.string().optional(), // ✅ Corrigido: string para compatibilidade com Select
  status: z.enum(['Orçamento', 'Ativa', 'Cancelada', 'Renovada']), // ✅ Adicionado 'Renovada'
  isBudget: z.boolean().optional(),
  automaticRenewal: z.boolean(), // ✅ CORRIGIDO: Obrigatório, sem .optional()
}).superRefine((data, ctx) => {
  // 🎯 LÓGICA CONDICIONAL: Se não é orçamento (isBudget é false) e status não é "Orçamento", 
  // então seguradora e ramo se tornam obrigatórios
  if (!data.isBudget && data.status !== 'Orçamento') {
    if (!data.insuranceCompany || data.insuranceCompany.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Seguradora é obrigatória para apólices ativas',
        path: ['insuranceCompany']
      });
    }
    
    if (!data.type || data.type.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ramo é obrigatório para apólices ativas',
        path: ['type']
      });
    }
    
    if (!data.policyNumber || data.policyNumber.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Número da apólice é obrigatório para apólices ativas',
        path: ['policyNumber']
      });
    }
  }
});

export type PolicyFormData = z.infer<typeof policyFormSchema>;
