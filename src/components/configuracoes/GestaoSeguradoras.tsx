import React, { useState } from 'react';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { useCompanyRamosById, useCreateCompanyRamo, useDeleteCompanyRamo } from '@/hooks/useCompanyRamos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppCard } from '@/components/ui/app-card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2 } from 'lucide-react';

export function GestaoSeguradoras() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  const { companies, loading: isLoading } = useSupabaseCompanies();
  const { data: ramos = [] } = useSupabaseRamos();
  const { data: companyRamos = [] } = useCompanyRamosById(selectedCompanyId);
  const createCompanyRamo = useCreateCompanyRamo();
  const deleteCompanyRamo = useDeleteCompanyRamo();

  const handleToggleRamo = async (ramoId: string, isCurrentlyAssociated: boolean) => {
    if (!selectedCompanyId) return;
    
    if (isCurrentlyAssociated) {
      await deleteCompanyRamo.mutateAsync({
        companyId: selectedCompanyId,
        ramoId: ramoId
      });
    } else {
      await createCompanyRamo.mutateAsync({
        company_id: selectedCompanyId,
        ramo_id: ramoId
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppCard className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Gestão de Seguradoras</h2>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-700 rounded w-1/4"></div>
            <div className="h-10 bg-slate-700 rounded"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </AppCard>
        <AppCard className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Ramos da Seguradora</h2>
          </div>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-700 rounded"></div>
            ))}
          </div>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lista de Seguradoras */}
      <AppCard className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">Gestão de Seguradoras</h2>
          <p className="text-sm text-slate-400 mt-2">
            Selecione uma seguradora para gerenciar seus ramos
          </p>
        </div>
        <div className="space-y-4">
          {/* Lista de seguradoras existentes */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300 mb-4">
              Seguradoras cadastradas ({companies.length})
            </h3>
            
            {companies.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p>Nenhuma seguradora cadastrada ainda.</p>
                <p className="text-sm">Vá para "Gestão de Seguradoras" em Configurações para adicionar seguradoras.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCompanyId === company.id
                        ? 'bg-blue-500/20 border-blue-400/50 ring-2 ring-blue-400/30'
                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                    }`}
                    onClick={() => setSelectedCompanyId(company.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={selectedCompanyId === company.id ? "default" : "secondary"} 
                          className={selectedCompanyId === company.id ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-200"}
                        >
                          <Building2 className="w-3 h-3 mr-1" />
                          {company.name}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          Criada em {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      <Badge variant="outline" className="border-slate-600 text-slate-400">
                        {companyRamos.filter((cr: any) => cr.company_id === company.id).length} ramos
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Informações sobre a migração */}
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <h4 className="text-green-400 font-medium mb-2">✅ Migração concluída</h4>
            <div className="text-sm text-green-300 space-y-1">
              <p>• Suas seguradoras foram preservadas</p>
              <p>• Os ramos foram normalizados automaticamente</p>
              <p>• Agora você pode gerenciar as associações seguradoras-ramos</p>
            </div>
          </div>
        </div>
      </AppCard>

      {/* Gestão de Ramos da Seguradora Selecionada */}
      <AppCard className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">
            {selectedCompanyId 
              ? `Ramos - ${companies.find(c => c.id === selectedCompanyId)?.name}`
              : 'Ramos da Seguradora'
            }
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            {selectedCompanyId 
              ? 'Gerencie quais ramos esta seguradora oferece'
              : 'Selecione uma seguradora para gerenciar seus ramos'
            }
          </p>
        </div>
        <div>
          {!selectedCompanyId ? (
            <div className="text-center py-8 text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>Selecione uma seguradora na lista ao lado</p>
              <p className="text-sm">para gerenciar os ramos que ela oferece.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ramos.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>Nenhum ramo cadastrado ainda.</p>
                  <p className="text-sm">Vá para "Gestão de Ramos" para criar os primeiros ramos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-300 mb-4">
                    Ramos disponíveis ({ramos.length})
                  </h4>
                  {ramos.map((ramo) => {
                    const isAssociated = companyRamos.some((cr: any) => cr.ramo_id === ramo.id);
                    
                    return (
                      <div
                        key={ramo.id}
                        className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`ramo-${ramo.id}`}
                            checked={isAssociated}
                            onCheckedChange={() => handleToggleRamo(ramo.id, isAssociated)}
                            disabled={createCompanyRamo.isPending || deleteCompanyRamo.isPending}
                          />
                          <Label 
                            htmlFor={`ramo-${ramo.id}`}
                            className={`cursor-pointer ${isAssociated ? 'text-white font-medium' : 'text-slate-300'}`}
                          >
                            {ramo.nome}
                          </Label>
                        </div>
                        
                        {isAssociated && (
                          <Badge variant="default" className="bg-green-600 text-white text-xs">
                            Ativo
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Resumo da seguradora */}
              <div className="mt-6 p-4 bg-slate-900 border border-slate-700 rounded-lg">
                <h4 className="text-sm font-medium text-slate-300 mb-2">📊 Resumo</h4>
                <div className="text-sm text-slate-400 space-y-1">
                  <p>• Total de ramos oferecidos: <span className="text-white font-medium">{companyRamos.length}</span></p>
                  <p>• Total de ramos disponíveis: <span className="text-white font-medium">{ramos.length}</span></p>
                  {companyRamos.length > 0 && (
                    <p className="mt-2">
                      • Ramos ativos: {companyRamos.map((cr: any) => cr.ramos?.nome || 'Nome não disponível').join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AppCard>
    </div>
  );
}