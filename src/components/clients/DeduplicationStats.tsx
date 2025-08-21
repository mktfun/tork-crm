import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Shield,
  Target,
  Database,
  Zap,
  ChevronDown,
  ChevronUp,
  BarChart3
} from 'lucide-react';

interface DeduplicationStatsProps {
  totalClients: number;
  duplicateCount: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  cleanClients?: number;
}

export function DeduplicationStats({ 
  totalClients, 
  duplicateCount, 
  highConfidence, 
  mediumConfidence, 
  lowConfidence,
  cleanClients = 0
}: DeduplicationStatsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const duplicatePercentage = totalClients > 0 ? (duplicateCount / totalClients) * 100 : 0;
  const cleanPercentage = totalClients > 0 ? ((totalClients - duplicateCount) / totalClients) * 100 : 100;
  const priorityCount = highConfidence + mediumConfidence;
  
  const qualityScore = Math.max(0, 100 - duplicatePercentage);
  const getQualityLevel = (score: number) => {
    if (score >= 95) return { label: 'Excelente', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (score >= 85) return { label: 'Boa', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (score >= 70) return { label: 'Regular', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { label: 'Precisa melhorar', color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const quality = getQualityLevel(qualityScore);

  // Versão resumida quando colapsado
  if (!isExpanded) {
    return (
      <Card className="bg-white/5 border-white/10 mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-400" />
              Estatísticas de Deduplicação
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="h-8 px-2 text-white/60 hover:text-white"
            >
              <ChevronDown size={16} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{totalClients.toLocaleString()}</div>
              <div className="text-white/60">Clientes Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">{duplicateCount.toLocaleString()}</div>
              <div className="text-white/60">Duplicados</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">{priorityCount}</div>
              <div className="text-white/60">Prioritários</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${quality.color}`}>
                {qualityScore.toFixed(0)}%
              </div>
              <div className="text-white/60">Qualidade</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Header com botão de colapsar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-400" />
          Estatísticas Detalhadas de Deduplicação
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="h-8 px-2 text-white/60 hover:text-white flex items-center gap-1"
        >
          <span className="text-xs">Colapsar</span>
          <ChevronUp size={16} />
        </Button>
      </div>

      {/* Estatísticas expandidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Qualidade da Base */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Shield size={16} className={quality.color} />
              Qualidade da Base
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-white">
                {qualityScore.toFixed(0)}%
              </span>
              <Badge className={`${quality.bg} ${quality.color} border-0`}>
                {quality.label}
              </Badge>
            </div>
            <Progress 
              value={qualityScore} 
              className="h-2"
            />
            <p className="text-xs text-white/60">
              {cleanPercentage.toFixed(1)}% dos clientes únicos
            </p>
          </CardContent>
        </Card>

        {/* Total de Clientes */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Database size={16} className="text-blue-400" />
              Base de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold text-white">
              {totalClients.toLocaleString()}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle size={12} />
                  Únicos
                </span>
                <span className="text-white/80">{(totalClients - duplicateCount).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-400 flex items-center gap-1">
                  <Users size={12} />
                  Duplicados
                </span>
                <span className="text-white/80">{duplicateCount.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Casos Prioritários */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Target size={16} className="text-red-400" />
              Casos Prioritários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold text-white">
              {priorityCount}
            </div>
            <div className="space-y-1">
              {highConfidence > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Alta confiança
                  </span>
                  <span className="text-white/80">{highConfidence}</span>
                </div>
              )}
              {mediumConfidence > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-400 flex items-center gap-1">
                    <TrendingUp size={12} />
                    Média confiança
                  </span>
                  <span className="text-white/80">{mediumConfidence}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recomendações */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Zap size={16} className="text-purple-400" />
              Próxima Ação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {duplicateCount === 0 ? (
              <div className="text-center">
                <CheckCircle className="mx-auto mb-2 text-green-400" size={24} />
                <p className="text-sm text-green-400">Base limpa!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {highConfidence > 0 ? (
                  <div className="p-2 bg-red-500/10 border border-red-400/20 rounded">
                    <p className="text-xs text-red-200">
                      Revisar {highConfidence} casos de alta confiança primeiro
                    </p>
                  </div>
                ) : mediumConfidence > 0 ? (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-400/20 rounded">
                    <p className="text-xs text-yellow-200">
                      Analisar {mediumConfidence} casos de média confiança
                    </p>
                  </div>
                ) : (
                  <div className="p-2 bg-blue-500/10 border border-blue-400/20 rounded">
                    <p className="text-xs text-blue-200">
                      Revisar {lowConfidence} casos de baixa confiança quando possível
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
