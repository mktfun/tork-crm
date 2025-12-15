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
import { Building2, Edit2, Save, X, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function GestaoSeguradoras() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  
  // Estado para criação de nova seguradora
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [selectedRamosForNewCompany, setSelectedRamosForNewCompany] = useState<string[]>([]);
  
  const { companies, loading: isLoading, addCompany, updateCompany, deleteCompany, isUpdating, isAdding } = useSupabaseCompanies();
  const { toast } = useToast();
  const { data: ramos = [] } = useSupabaseRamos();
  const { data: companyRamos = [] } = useCompanyRamosById(selectedCompanyId);
  const createCompanyRamo = useCreateCompanyRamo();
  const deleteCompanyRamo = useDeleteCompanyRamo();

  const handleDeleteCompany = async (companyId: string) => {
    const companyName = companies.find(c => c.id === companyId)?.name || 'Seguradora';
    
    if (window.confirm(`Tem certeza que deseja excluir "${companyName}"?\n\nEsta ação não pode ser desfeita e só será possível se a seguradora não possuir apólices ou ramos associados.`)) {
      console.log('🗑️ Usuário confirmou exclusão da seguradora:', companyName);
      
      try {
        const result = await deleteCompany(companyId);
        console.log('✅ Resultado da exclusão:', result);
        
        toast({
          title: "Sucesso",
          description: `"${companyName}" foi excluída com sucesso!`,
        });
        
        if (selectedCompanyId === companyId) {
          setSelectedCompanyId(null);
        }
      } catch (error: any) {
        console.error('❌ Erro na exclusão capturado no componente:', error);
        
        toast({
          title: "Erro ao excluir",
          description: error.message || 'Erro inesperado ao excluir a seguradora',
          variant: "destructive",
        });
      }
    } else {
      console.log('❌ Usuário cancelou a exclusão');
    }
  };

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

  const handleStartEdit = (company: any) => {
    setEditingCompanyId(company.id);
    setEditingName(company.name);
  };

  const handleCancelEdit = () => {
    setEditingCompanyId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!editingCompanyId || !editingName.trim()) return;
    
    try {
      await updateCompany(editingCompanyId, {
        name: editingName.trim()
      });
      
      toast({
        title: "Seguradora atualizada",
        description: "O nome da seguradora foi atualizado com sucesso.",
      });
      
      setEditingCompanyId(null);
      setEditingName('');
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o nome da seguradora.",
        variant: "destructive",
      });
    }
  };

  const handleToggleRamoForNewCompany = (ramoId: string) => {
    setSelectedRamosForNewCompany(prev => 
      prev.includes(ramoId) 
        ? prev.filter(id => id !== ramoId)
        : [...prev, ramoId]
    );
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome da seguradora.",
        variant: "destructive",
      });
      return;
    }

    try {
      // 1. Criar a seguradora
      const newCompany = await addCompany({ name: newCompanyName.trim() });
      
      // 2. Associar os ramos selecionados
      if (selectedRamosForNewCompany.length > 0 && newCompany?.id) {
        for (const ramoId of selectedRamosForNewCompany) {
          await createCompanyRamo.mutateAsync({
            company_id: newCompany.id,
            ramo_id: ramoId
          });
        }
      }
      
      toast({
        title: "Seguradora criada",
        description: `"${newCompanyName}" foi criada com ${selectedRamosForNewCompany.length} ramo(s) associado(s).`,
      });
      
      // Limpar formulário e selecionar a nova seguradora
      setNewCompanyName('');
      setSelectedRamosForNewCompany([]);
      setIsCreating(false);
      if (newCompany?.id) {
        setSelectedCompanyId(newCompany.id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar",
        description: error.message || "Não foi possível criar a seguradora.",
        variant: "destructive",
      });
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewCompanyName('');
    setSelectedRamosForNewCompany([]);
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Gestão de Seguradoras</h2>
            <p className="text-sm text-slate-400 mt-2">
              Selecione uma seguradora para gerenciar seus ramos
            </p>
          </div>
          {!isCreating && (
            <Button 
              onClick={() => setIsCreating(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova
            </Button>
          )}
        </div>

        {/* Formulário de criação */}
        {isCreating && (
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg space-y-4">
            <h3 className="text-sm font-medium text-blue-400">Nova Seguradora</h3>
            
            <div>
              <Label htmlFor="new-company-name" className="text-slate-300">Nome da Seguradora *</Label>
              <Input
                id="new-company-name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Ex: Porto Seguro"
                className="mt-1 bg-slate-800 border-slate-600"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-slate-300">Ramos oferecidos (opcional)</Label>
              <div className="mt-2 max-h-[200px] overflow-y-auto space-y-2 pr-2">
                {ramos.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum ramo cadastrado. Crie ramos primeiro em "Gestão de Ramos".</p>
                ) : (
                  ramos.map((ramo) => (
                    <div
                      key={ramo.id}
                      className="flex items-center space-x-3 p-2 bg-slate-800 border border-slate-700 rounded"
                    >
                      <Checkbox
                        id={`new-ramo-${ramo.id}`}
                        checked={selectedRamosForNewCompany.includes(ramo.id)}
                        onCheckedChange={() => handleToggleRamoForNewCompany(ramo.id)}
                      />
                      <Label 
                        htmlFor={`new-ramo-${ramo.id}`}
                        className={`cursor-pointer text-sm ${selectedRamosForNewCompany.includes(ramo.id) ? 'text-white font-medium' : 'text-slate-300'}`}
                      >
                        {ramo.nome}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {selectedRamosForNewCompany.length > 0 && (
                <p className="mt-2 text-xs text-blue-400">
                  {selectedRamosForNewCompany.length} ramo(s) selecionado(s)
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleCreateCompany} 
                disabled={isAdding || !newCompanyName.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isAdding ? 'Criando...' : 'Criar Seguradora'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancelCreate}
                disabled={isAdding}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

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
                <p className="text-sm">Clique em "Nova" para adicionar sua primeira seguradora.</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      selectedCompanyId === company.id
                        ? 'bg-blue-500/20 border-blue-400/50 ring-2 ring-blue-400/30'
                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setSelectedCompanyId(company.id)}
                      >
                        {editingCompanyId === company.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8 text-sm bg-slate-700 border-slate-600"
                              placeholder="Nome da seguradora"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {editingCompanyId === company.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              disabled={isUpdating || !editingName.trim()}
                              className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              disabled={isUpdating}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-600"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(company);
                              }}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-600"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCompany(company.id);
                              }}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                          {(company as any).ramos_count || 0} ramos
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
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