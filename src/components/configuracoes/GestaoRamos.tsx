import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppCard } from '@/components/ui/app-card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Plus, Check, X } from 'lucide-react';
import { useSupabaseRamos, useCreateRamo, useUpdateRamo, useDeleteRamo } from '@/hooks/useSupabaseRamos';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function GestaoRamos() {
  const [novoRamo, setNovoRamo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const { data: ramos = [], isLoading } = useSupabaseRamos();
  const createRamo = useCreateRamo();
  const updateRamo = useUpdateRamo();
  const deleteRamo = useDeleteRamo();

  const handleCreateRamo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoRamo.trim()) return;
    
    await createRamo.mutateAsync({ nome: novoRamo.trim() });
    setNovoRamo('');
  };

  const handleStartEdit = (ramo: any) => {
    setEditingId(ramo.id);
    setEditingName(ramo.nome);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    
    await updateRamo.mutateAsync({
      id: editingId,
      data: { nome: editingName.trim() }
    });
    
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDeleteRamo = async (id: string) => {
    await deleteRamo.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <AppCard className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">Gestão de Ramos</h2>
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
    );
  }

  return (
    <AppCard className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Gestão de Ramos</h2>
        <p className="text-sm text-slate-400 mt-2">
          Gerencie os ramos de seguro disponíveis no sistema. Todos os ramos criados aqui poderão ser associados às seguradoras.
        </p>
      </div>
      <div className="space-y-6">
        {/* Formulário para criar novo ramo */}
        <form onSubmit={handleCreateRamo} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="novo-ramo" className="text-slate-300">
              Nome do novo ramo
            </Label>
            <Input
              id="novo-ramo"
              value={novoRamo}
              onChange={(e) => setNovoRamo(e.target.value)}
              placeholder="Ex: Auto, Vida, Residencial..."
              className="bg-slate-800 border-slate-700 text-white"
              disabled={createRamo.isPending}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={!novoRamo.trim() || createRamo.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {createRamo.isPending ? 'Criando...' : 'Adicionar'}
            </Button>
          </div>
        </form>

        {/* Lista de ramos existentes */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            Ramos cadastrados ({ramos.length})
          </h3>
          
          {ramos.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>Nenhum ramo cadastrado ainda.</p>
              <p className="text-sm">Adicione o primeiro ramo usando o formulário acima.</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
              {ramos.map((ramo) => (
                <div
                  key={ramo.id}
                  className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg"
                >
                  {editingId === ramo.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={!editingName.trim() || updateRamo.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                          {ramo.nome}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          Criado em {new Date(ramo.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(ramo)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-400 hover:bg-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-900 border-slate-700">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">
                                Excluir ramo "{ramo.nome}"?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-400">
                                Esta ação não pode ser desfeita. O ramo será removido de todas as
                                associações com seguradoras e não poderá mais ser usado em novas apólices.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRamo(ramo.id)}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={deleteRamo.isPending}
                              >
                                {deleteRamo.isPending ? 'Excluindo...' : 'Excluir'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informações sobre a migração */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h4 className="text-blue-400 font-medium mb-2">📋 Sobre a normalização</h4>
          <div className="text-sm text-blue-300 space-y-1">
            <p>• Os ramos existentes nas suas apólices foram automaticamente migrados e normalizados</p>
            <p>• Agora você pode gerenciar os ramos de forma centralizada</p>
            <p>• Novos ramos criados aqui ficarão disponíveis para associar às seguradoras</p>
          </div>
        </div>
      </div>
    </AppCard>
  );
}