import { useState } from 'react';
import { ChangelogCard } from './ChangelogCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCheck, Filter } from 'lucide-react';
import { Changelog, useChangelogs } from '@/hooks/useChangelogs';

interface ChangelogListProps {}

export function ChangelogList({}: ChangelogListProps) {
  const { changelogs, markAsViewed, markAllAsViewed, unreadCount, viewedChangelogIds } = useChangelogs();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const filteredChangelogs = changelogs.filter(changelog => {
    const categoryMatch = categoryFilter === 'all' || changelog.category === categoryFilter;
    const priorityMatch = priorityFilter === 'all' || changelog.priority === priorityFilter;
    return categoryMatch && priorityMatch;
  });

  const handleViewChangelog = (changelog: Changelog) => {
    if (!viewedChangelogIds.has(changelog.id)) {
      markAsViewed(changelog.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Novidades do Sistema
          </h2>
          <p className="text-muted-foreground">
            Acompanhe as últimas atualizações e melhorias
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsViewed}
              className="flex items-center gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como lidas ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="feature">Funcionalidades</SelectItem>
            <SelectItem value="improvement">Melhorias</SelectItem>
            <SelectItem value="bugfix">Correções</SelectItem>
            <SelectItem value="breaking">Mudanças Importantes</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Changelog list */}
      <div className="space-y-4">
        {filteredChangelogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhuma novidade encontrada com os filtros selecionados.
            </p>
          </div>
        ) : (
          filteredChangelogs.map(changelog => (
            <ChangelogCard
              key={changelog.id}
              changelog={changelog}
              isNew={!viewedChangelogIds.has(changelog.id)}
              onView={() => handleViewChangelog(changelog)}
            />
          ))
        )}
      </div>
    </div>
  );
}