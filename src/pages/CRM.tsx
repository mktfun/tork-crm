import { motion } from 'framer-motion';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { AppCard } from '@/components/ui/app-card';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CRM() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus leads e negócios no funil de vendas
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/dashboard/settings/chat-tork')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat Tork
          </Button>
        </div>
      </motion.div>

      {/* Kanban Board */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <KanbanBoard />
      </motion.div>
    </div>
  );
}
