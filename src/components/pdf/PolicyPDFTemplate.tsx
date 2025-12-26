
import { Policy, Client } from '@/types';

interface PolicyPDFTemplateProps {
  policy: Policy;
  client: Client | null;
}

// Este é o nosso template Black Tie. Elegante, legível, profissional.
export function PolicyPDFTemplate({ policy, client }: PolicyPDFTemplateProps) {
  // Nota: Para o html2canvas renderizar o fundo, a gente aplica ele direto na div.
  // O `bg-slate-900` é mais uma garantia.
  return (
    <div 
      id="pdf-template" 
      className="w-[210mm] min-h-[297mm] p-12 font-sans bg-slate-900 text-slate-100"
      style={{ backgroundColor: '#0f172a' }} // Garantia extra para o fundo
    >
      
      {/* ===== CABEÇALHO MODERNO ===== */}
      <div className="flex justify-between items-start border-b-2 border-slate-700 pb-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold text-white">Ficha da Apólice</h1>
          <p className="text-lg text-slate-400">Documento de Conferência</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Gerado em:</p>
          <p className="font-semibold text-slate-200">{new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* ===== SEÇÃO DO SEGURADO ===== */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-blue-400 mb-4">
          INFORMAÇÕES DO SEGURADO
        </h2>
        <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700 grid grid-cols-2 gap-x-8 gap-y-4 text-base">
          {client ? (
            <>
              <div>
                <p className="text-sm text-slate-400">Nome Completo</p>
                <p className="font-semibold text-slate-50">{client.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Telefone</p>
                <p className="font-semibold text-slate-50">{client.phone}</p>
              </div>
              {client.cpfCnpj && (
                <div>
                  <p className="text-sm text-slate-400">CPF/CNPJ</p>
                  <p className="font-semibold text-slate-50 font-mono">{client.cpfCnpj}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-400">Email</p>
                <p className="font-semibold text-slate-50">{client.email}</p>
              </div>
              {client.birthDate && (
                <div>
                  <p className="text-sm text-slate-400">Data de Nascimento</p>
                  <p className="font-semibold text-slate-50">{new Date(client.birthDate).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
              {client.profession && (
                <div>
                  <p className="text-sm text-slate-400">Profissão</p>
                  <p className="font-semibold text-slate-50">{client.profession}</p>
                </div>
              )}
            </>
          ) : (
            <div className="col-span-2">
              <p className="text-slate-500 italic">Cliente não encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== SEÇÃO DA APÓLICE ===== */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-blue-400 mb-4">
          DADOS DA APÓLICE
        </h2>
        <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700 grid grid-cols-2 gap-x-8 gap-y-4 text-base">
          <div>
            <p className="text-sm text-slate-400">Número</p>
            <p className="font-semibold text-slate-50 font-mono">{policy.policyNumber}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Status</p>
            <p className={`font-bold text-lg ${
              policy.status === 'Ativa' ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {policy.status}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Ramo</p>
            <p className="font-semibold text-slate-50">{policy.ramos?.nome || policy.type || 'Ramo não especificado'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Seguradora</p>
            <p className="font-semibold text-slate-50">{policy.companies?.name || 'Seguradora não especificada'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Bem Segurado</p>
            <p className="font-semibold text-slate-50">{policy.insuredAsset}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Vigência Final</p>
            <p className="font-semibold text-slate-50">{new Date(policy.expirationDate).toLocaleDateString('pt-BR')}</p>
          </div>
          <div className="col-span-2 mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">Valor do Prêmio</p>
            <p className="text-3xl font-bold text-white">
              {policy.premiumValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Comissão: {policy.commissionRate}%
            </p>
          </div>
        </div>
      </div>

      {/* ===== ENDEREÇO (SE DISPONÍVEL) ===== */}
      {client && (client.address || client.city || client.state) && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-blue-400 mb-4">
            ENDEREÇO
          </h2>
          <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700 grid grid-cols-2 gap-x-8 gap-y-4 text-base">
            {client.address && (
              <div>
                <p className="text-sm text-slate-400">Endereço</p>
                <p className="font-semibold text-slate-50">{client.address}</p>
              </div>
            )}
            {client.number && (
              <div>
                <p className="text-sm text-slate-400">Número</p>
                <p className="font-semibold text-slate-50">{client.number}</p>
              </div>
            )}
            {client.neighborhood && (
              <div>
                <p className="text-sm text-slate-400">Bairro</p>
                <p className="font-semibold text-slate-50">{client.neighborhood}</p>
              </div>
            )}
            {client.city && (
              <div>
                <p className="text-sm text-slate-400">Cidade</p>
                <p className="font-semibold text-slate-50">{client.city}</p>
              </div>
            )}
            {client.state && (
              <div>
                <p className="text-sm text-slate-400">Estado</p>
                <p className="font-semibold text-slate-50">{client.state}</p>
              </div>
            )}
            {client.cep && (
              <div>
                <p className="text-sm text-slate-400">CEP</p>
                <p className="font-semibold text-slate-50 font-mono">{client.cep}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== OBSERVAÇÕES (SE DISPONÍVEL) ===== */}
      {client?.observations && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-blue-400 mb-4">
            OBSERVAÇÕES
          </h2>
          <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-slate-200 leading-relaxed">{client.observations}</p>
          </div>
        </div>
      )}
      
      {/* ===== RODAPÉ ===== */}
      <div className="absolute bottom-12 left-12 right-12 pt-6 border-t-2 border-slate-700 text-center text-sm text-slate-500">
        <p>Documento gerado pelo Tork CRM • {new Date().toLocaleString('pt-BR')} • Apólice: {policy.policyNumber}</p>
      </div>
    </div>
  );
}
