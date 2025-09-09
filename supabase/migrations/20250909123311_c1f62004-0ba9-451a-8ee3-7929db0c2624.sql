-- Inserir changelogs históricos do sistema
INSERT INTO public.changelogs (version, title, description, category, priority, is_published, created_at) VALUES 
-- v1.0.0 - Sistema Base
('v1.0.0', 'Sistema Base de Gestão', 'Implementação do sistema fundamental com gestão completa de clientes, apólices e autenticação de usuários. Inclui CRUD completo para clientes com dados pessoais, endereço e observações, além de gestão de apólices com status, valores e renovações automáticas.', 'feature', 'high', true, '2024-06-01 10:00:00+00'),

-- v1.1.0 - Dashboard
('v1.1.0', 'Dashboard Inteligente', 'Dashboard com métricas em tempo real, KPIs dinâmicos por segmento de seguro, gráficos interativos de performance e distribuição por ramos. Inclui cards de métricas com animações e insights automáticos.', 'feature', 'high', true, '2024-06-15 14:30:00+00'),

-- v1.2.0 - Agendamentos
('v1.2.0', 'Sistema de Agendamentos', 'Sistema completo de compromissos com calendário interativo, notificações automáticas 15 minutos antes dos eventos, suporte a recorrência e integração com clientes e apólices. Inclui diferentes visualizações: dia, semana e mês.', 'feature', 'medium', true, '2024-07-01 09:00:00+00'),

-- v1.3.0 - Gestão Financeira
('v1.3.0', 'Gestão Financeira Avançada', 'Sistema robusto de transações financeiras com controle de parcelas, histórico detalhado de pagamentos, diferentes tipos de transação e relatórios de faturamento. Suporte a baixas parciais e múltiplas formas de pagamento.', 'feature', 'high', true, '2024-07-20 11:00:00+00'),

-- v1.4.0 - Renovações
('v1.4.1', 'Sistema de Renovações Automáticas', 'Gestão inteligente de renovações de apólices com agendamento automático 15 dias antes do vencimento, métricas de renovação e controle de status. Dashboard específico para acompanhar carteira de renovações.', 'feature', 'medium', true, '2024-08-05 16:00:00+00'),

-- v1.5.0 - Sinistros
('v1.5.0', 'Gestão Completa de Sinistros', 'Sistema abrangente para gestão de sinistros com upload de documentos, timeline de atividades, controle de status, integração com apólices e clientes. Inclui numeração automática e controle de prazos.', 'feature', 'high', true, '2024-08-25 13:00:00+00'),

-- v1.6.0 - Relatórios
('v1.6.0', 'Relatórios Avançados e Analytics', 'Suite completa de relatórios personalizáveis com gráficos interativos, análises por período, segmentação por produtor e seguradora. Exportação em PDF e métricas de performance detalhadas.', 'improvement', 'medium', true, '2024-09-01 15:30:00+00'),

-- v1.7.0 - Configurações
('v1.7.0', 'Centro de Configurações', 'Sistema centralizado de configurações com gestão de seguradoras, produtores, ramos de seguro, corretoras e tipos de transação. Interface intuitiva para personalização completa do sistema.', 'feature', 'low', true, '2024-09-05 10:15:00+00'),

-- v1.8.0 - Melhorias UX
('v1.8.0', 'Revolução na Interface do Usuário', 'Implementação do design system glassmorphism com efeitos visuais modernos, navegação mobile otimizada, sistema de busca avançado e componentes reutilizáveis. Melhoria significativa na experiência do usuário.', 'improvement', 'medium', true, '2024-09-07 12:00:00+00'),

-- v1.9.0 - Segurança
('v1.9.0', 'Aprimoramentos de Segurança', 'Implementação de políticas RLS robustas, auditoria de acesso, sistema de proteção avançado e melhorias na segurança dos dados. Compliance com melhores práticas de segurança.', 'improvement', 'critical', true, '2024-09-08 14:45:00+00'),

-- v2.0.0 - Sistema de Novidades
('v2.0.0', 'Sistema de Novidades e Atualizações', 'Lançamento do centro de novidades com histórico completo de atualizações, notificações de novas funcionalidades, badges de conteúdo não lido e sistema de categorização por tipo e prioridade.', 'feature', 'medium', true, NOW());