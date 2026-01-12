import { ChevronDown, Settings, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CRMPipeline } from '@/hooks/useCRMPipelines';

interface PipelineSelectorProps {
  pipelines: CRMPipeline[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onManage: () => void;
}

export function PipelineSelector({ pipelines, selectedId, onSelect, onManage }: PipelineSelectorProps) {
  const selectedPipeline = pipelines.find(p => p.id === selectedId);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="bg-secondary/30 border-border/50 hover:bg-secondary/50 min-w-[200px] justify-between"
          >
            <div className="flex items-center gap-2">
              {selectedPipeline?.is_default && (
                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              )}
              <span>{selectedPipeline?.name || 'Selecionar Funil'}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px] glass-component border-border/50">
          {pipelines.map((pipeline) => (
            <DropdownMenuItem
              key={pipeline.id}
              onClick={() => onSelect(pipeline.id)}
              className={`cursor-pointer ${selectedId === pipeline.id ? 'bg-primary/10' : ''}`}
            >
              <div className="flex items-center gap-2 flex-1">
                {pipeline.is_default && (
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                )}
                <span className="flex-1">{pipeline.name}</span>
              </div>
            </DropdownMenuItem>
          ))}
          
          {pipelines.length === 0 && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              Nenhum funil encontrado
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onManage} className="cursor-pointer">
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar Funis
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
