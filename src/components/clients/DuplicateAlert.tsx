import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, Users, Target, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface DuplicateAlertProps {
  count: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  totalClients?: number;
}

export function DuplicateAlert({ count, highConfidence, mediumConfidence, lowConfidence, totalClients }: DuplicateAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (count === 0) return null;

  const duplicatePercentage = totalClients ? ((count / totalClients) * 100).toFixed(1) : 0;
  const priorityCount = highConfidence + mediumConfidence;

  return (
    <Alert className={`border-l-4 ${
      highConfidence > 0
        ? 'border-l-red-500 border-red-500/20 bg-red-500/10'
        : mediumConfidence > 0
        ? 'border-l-yellow-500 border-yellow-500/20 bg-yellow-500/10'
        : 'border-l-blue-500 border-blue-500/20 bg-blue-500/10'
    }`}>
      <AlertTriangle className={`h-5 w-5 ${
        highConfidence > 0 ? 'text-red-400' : mediumConfidence > 0 ? 'text-yellow-400' : 'text-blue-400'
      }`} />
      <AlertDescription className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${
                highConfidence > 0 ? 'text-red-200' : mediumConfidence > 0 ? 'text-yellow-200' : 'text-blue-200'
              }`}>
                {count} possíveis clientes duplicados encontrados
              </span>
              {totalClients && (
                <Badge variant="outline" className="text-xs">
                  {duplicatePercentage}% da base
                </Badge>
              )}
            </div>

            {!isExpanded && totalClients && (
              <div className="text-sm text-white/60 flex items-center gap-1">
                <Users size={14} />
                Análise de {totalClients} clientes total
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {priorityCount > 0 && !isExpanded && (
              <div className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-md">
                <Target size={14} className="text-white/60" />
                <span className="text-xs text-white/80">{priorityCount} prioritários</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2 text-white/60 hover:text-white"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>
        </div>

        {/* Conteúdo expandido */}
        {isExpanded && (
          <>
            {totalClients && (
              <div className="text-sm text-white/60 flex items-center gap-1 pb-2 border-b border-white/10">
                <Users size={14} />
                Análise detalhada de {totalClients} clientes total
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {highConfidence > 0 && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {highConfidence} alta confiança
                </Badge>
              )}
              {mediumConfidence > 0 && (
                <Badge variant="default" className="text-xs bg-yellow-600 hover:bg-yellow-700 flex items-center gap-1">
                  <TrendingUp size={12} />
                  {mediumConfidence} média confiança
                </Badge>
              )}
              {lowConfidence > 0 && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Users size={12} />
                  {lowConfidence} baixa confiança
                </Badge>
              )}
            </div>

            {priorityCount > 0 && (
              <div className="p-3 bg-white/5 rounded-md border border-white/10">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <div className="text-sm text-white/90 font-medium">
                      Recomendações de Limpeza:
                    </div>
                    <ul className="text-xs text-white/70 space-y-1">
                      <li>• Comece pelos {highConfidence} casos de alta confiança</li>
                      <li>• Use o preview de mesclagem para validar antes de confirmar</li>
                      <li>• Exporte um relatório antes de fazer alterações em massa</li>
                      <li>• Revise manualmente casos de baixa confiança</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
