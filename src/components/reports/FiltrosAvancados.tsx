
import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { AppCard } from '@/components/ui/app-card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Filter, ChevronDown } from 'lucide-react';

interface FiltrosGlobais {
  intervalo: DateRange | undefined;
  seguradoraIds: string[];
  ramos: string[];
  produtorIds: string[];
  statusIds: string[];
}

interface FiltrosAvancadosProps {
  filtros: FiltrosGlobais;
  onFiltrosChange: (filtros: FiltrosGlobais) => void;
  seguradoras: Array<{ id: string; name: string }>;
  ramos: Array<{ id: string; nome: string }>;
  produtores: Array<{ id: string; name: string }>;
  statusDisponiveis: string[];
}

export function FiltrosAvancados({
  filtros,
  onFiltrosChange,
  seguradoras,
  ramos,
  produtores,
  statusDisponiveis
}: FiltrosAvancadosProps) {
  
  const handleMultiSelectChange = (
    field: 'seguradoraIds' | 'ramos' | 'produtorIds' | 'statusIds',
    value: string,
    checked: boolean
  ) => {
    const currentValues = filtros[field];
    const newValues = checked 
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    onFiltrosChange({
      ...filtros,
      [field]: newValues
    });
  };

  const removeFilter = (field: 'seguradoraIds' | 'ramos' | 'produtorIds' | 'statusIds', value: string) => {
    const newValues = filtros[field].filter(v => v !== value);
    onFiltrosChange({
      ...filtros,
      [field]: newValues
    });
  };

  const clearAllFilters = () => {
    onFiltrosChange({
      intervalo: filtros.intervalo,
      seguradoraIds: [],
      ramos: [],
      produtorIds: [],
      statusIds: []
    });
  };

  const totalFiltrosAtivos = filtros.seguradoraIds.length + 
                           filtros.ramos.length + 
                           filtros.produtorIds.length + 
                           filtros.statusIds.length;

  // Debug log para verificar dados
  console.log('🔍 FiltrosAvancados - Dados recebidos:', {
    seguradoras: seguradoras?.length,
    seguradorasData: seguradoras,
    produtores: produtores?.length,
    ramos: ramos?.length
  });

  return (
    <AppCard className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-white" />
          <h2 className="text-lg font-semibold text-white">Filtros Avançados</h2>
          {totalFiltrosAtivos > 0 && (
            <Badge variant="secondary" className="bg-blue-600 text-white">
              {totalFiltrosAtivos} ativo{totalFiltrosAtivos > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {totalFiltrosAtivos > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters}
            className="text-slate-400 hover:text-white"
          >
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* FILTROS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* Filtro de Período */}
        <div>
          <Label className="text-slate-300 mb-2 block">Período de Análise</Label>
          <DatePickerWithRange 
            date={filtros.intervalo}
            onDateChange={(intervalo) => onFiltrosChange({ ...filtros, intervalo })}
          />
        </div>

        {/* Filtro de Seguradoras */}
        <div>
          <Label className="text-slate-300 mb-2 block">Seguradoras</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-slate-800 border-slate-600 text-white">
                {filtros.seguradoraIds.length === 0 
                  ? "Todas as Seguradoras"
                  : `${filtros.seguradoraIds.length} selecionada(s)`
                }
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-slate-900 border-slate-700 z-50">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {seguradoras && seguradoras.length > 0 ? (
                  seguradoras.map((seguradora) => (
                    <div key={seguradora.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`seguradora-${seguradora.id}`}
                        checked={filtros.seguradoraIds.includes(seguradora.id)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('seguradoraIds', seguradora.id, checked as boolean)
                        }
                      />
                      <Label 
                        htmlFor={`seguradora-${seguradora.id}`}
                        className="text-sm text-white cursor-pointer flex-1"
                      >
                        {seguradora.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400 p-2">
                    Nenhuma seguradora encontrada
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtro de Ramos */}
        <div>
          <Label className="text-slate-300 mb-2 block">Ramos</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-slate-800 border-slate-600 text-white">
                {filtros.ramos.length === 0 
                  ? "Todos os Ramos"
                  : `${filtros.ramos.length} selecionado(s)`
                }
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-slate-900 border-slate-700 z-50">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {ramos && ramos.length > 0 ? (
                  ramos.map((ramo) => (
                    <div key={ramo.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ramo-${ramo.id}`}
                        checked={filtros.ramos.includes(ramo.id)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('ramos', ramo.id, checked as boolean)
                        }
                      />
                      <Label 
                        htmlFor={`ramo-${ramo.id}`}
                        className="text-sm text-white cursor-pointer flex-1"
                      >
                        {ramo.nome}
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400 p-2">
                    Nenhum ramo encontrado
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtro de Produtores */}
        <div>
          <Label className="text-slate-300 mb-2 block">Produtores</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-slate-800 border-slate-600 text-white">
                {filtros.produtorIds.length === 0 
                  ? "Todos os Produtores"
                  : `${filtros.produtorIds.length} selecionado(s)`
                }
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-slate-900 border-slate-700 z-50">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {produtores && produtores.length > 0 ? (
                  produtores.map((produtor) => (
                    <div key={produtor.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`produtor-${produtor.id}`}
                        checked={filtros.produtorIds.includes(produtor.id)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('produtorIds', produtor.id, checked as boolean)
                        }
                      />
                      <Label 
                        htmlFor={`produtor-${produtor.id}`}
                        className="text-sm text-white cursor-pointer flex-1"
                      >
                        {produtor.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400 p-2">
                    Nenhum produtor encontrado
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtro de Status */}
        <div>
          <Label className="text-slate-300 mb-2 block">Status</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-slate-800 border-slate-600 text-white">
                {filtros.statusIds.length === 0 
                  ? "Todos os Status"
                  : `${filtros.statusIds.length} selecionado(s)`
                }
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-slate-900 border-slate-700 z-50">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {statusDisponiveis && statusDisponiveis.length > 0 ? (
                  statusDisponiveis.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filtros.statusIds.includes(status)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('statusIds', status, checked as boolean)
                        }
                      />
                      <Label 
                        htmlFor={`status-${status}`}
                        className="text-sm text-white cursor-pointer flex-1"
                      >
                        {status}
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400 p-2">
                    Nenhum status encontrado
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* BADGES DOS FILTROS ATIVOS */}
      {totalFiltrosAtivos > 0 && (
        <div className="flex flex-wrap gap-2">
          {filtros.seguradoraIds.map(seguradoraId => {
            const seguradora = seguradoras.find(s => s.id === seguradoraId);
            return (
              <Badge key={seguradoraId} variant="secondary" className="bg-blue-600 text-white flex items-center gap-1">
                {seguradora?.name || 'Seguradora'}
                <X 
                  className="w-3 h-3 cursor-pointer hover:bg-blue-700 rounded" 
                  onClick={() => removeFilter('seguradoraIds', seguradoraId)}
                />
              </Badge>
            );
          })}
          {filtros.ramos.map(ramo => (
            <Badge key={ramo} variant="secondary" className="bg-green-600 text-white flex items-center gap-1">
              {ramo}
              <X 
                className="w-3 h-3 cursor-pointer hover:bg-green-700 rounded" 
                onClick={() => removeFilter('ramos', ramo)}
              />
            </Badge>
          ))}
          {filtros.produtorIds.map(produtorId => {
            const produtor = produtores.find(p => p.id === produtorId);
            return (
              <Badge key={produtorId} variant="secondary" className="bg-purple-600 text-white flex items-center gap-1">
                {produtor?.name || 'Produtor'}
                <X 
                  className="w-3 h-3 cursor-pointer hover:bg-purple-700 rounded" 
                  onClick={() => removeFilter('produtorIds', produtorId)}
                />
              </Badge>
            );
          })}
          {filtros.statusIds.map(status => (
            <Badge key={status} variant="secondary" className="bg-orange-600 text-white flex items-center gap-1">
              {status}
              <X 
                className="w-3 h-3 cursor-pointer hover:bg-orange-700 rounded" 
                onClick={() => removeFilter('statusIds', status)}
              />
            </Badge>
          ))}
        </div>
      )}
    </AppCard>
  );
}
