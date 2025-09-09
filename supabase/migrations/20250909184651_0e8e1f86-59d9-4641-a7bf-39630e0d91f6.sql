-- Histórico Retroativo Completo de Changelogs
-- Implementações realizadas nos últimos 2 meses do projeto

-- Sistema Core (Novembro 2024)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v1.0.0',
  'Sistema Base de Autenticação',
  'Implementação completa do sistema de autenticação com Supabase, incluindo login, registro e gestão de sessões. Base sólida para todo o sistema de gestão de seguros.',
  'feature',
  'critical',
  true,
  '2024-11-15 09:00:00'
),
(
  'v1.1.0',
  'Integração Completa com Banco de Dados',
  'Estrutura completa do banco de dados com tabelas para clientes, apólices, transações e sistema de auditoria. Implementação de Row Level Security (RLS) para proteção de dados.',
  'feature',
  'high',
  true,
  '2024-11-18 14:30:00'
),
(
  'v1.2.0',
  'Sistema de Profiles e Roles',
  'Gestão de perfis de usuário com diferentes níveis de acesso (corretor, admin). Sistema de roles para controle de permissões avançado.',
  'feature',
  'medium',
  true,
  '2024-11-22 11:15:00'
);

-- Gestão de Clientes (Dezembro 2024)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v1.3.0',
  'Sistema Completo de Gestão de Clientes',
  'Interface completa para cadastro, edição e visualização de clientes. Incluindo dados pessoais, endereço, contato e observações. Validação de CPF/CNPJ integrada.',
  'feature',
  'high',
  true,
  '2024-12-01 10:20:00'
),
(
  'v1.3.1',
  'Importação CSV de Clientes',
  'Sistema avançado de importação de clientes via CSV com mapeamento inteligente de colunas, validação de dados e preview antes da importação.',
  'feature',
  'medium',
  true,
  '2024-12-03 16:45:00'
),
(
  'v1.3.2',
  'Sistema de Deduplicação de Clientes',
  'Detecção automática de clientes duplicados com algoritmos de similaridade. Interface para merge de registros duplicados e relatórios de qualidade de dados.',
  'feature',
  'medium',
  true,
  '2024-12-05 13:30:00'
),
(
  'v1.4.0',
  'Pesquisa Avançada de Clientes',
  'Sistema de busca inteligente com filtros por seguradora, ramo, status e texto livre. Performance otimizada com índices de busca full-text.',
  'improvement',
  'medium',
  true,
  '2024-12-08 09:15:00'
);

-- Sistema de Apólices (Dezembro 2024)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v1.5.0',
  'Gestão Completa de Apólices',
  'Sistema robusto para criação, edição e gestão de apólices de seguro. Suporte a múltiplos ramos, cálculo automático de parcelas e controle de status.',
  'feature',
  'high',
  true,
  '2024-12-10 14:00:00'
),
(
  'v1.5.1',
  'Upload e Anexo de PDFs',
  'Funcionalidade completa para upload e anexo de PDFs das apólices. Visualização inline e download direto dos documentos.',
  'feature',
  'medium',
  true,
  '2024-12-12 11:30:00'
),
(
  'v1.5.2',
  'Sistema de Renovação Automática',
  'Agendamento automático de renovações 15 dias antes do vencimento. Controle de status de renovação e notificações proativas.',
  'feature',
  'high',
  true,
  '2024-12-15 10:45:00'
),
(
  'v1.6.0',
  'Cálculo Automático de Comissões',
  'Sistema inteligente para cálculo de comissões baseado em taxas por ramo e seguradora. Relatórios detalhados de comissões por período.',
  'feature',
  'medium',
  true,
  '2024-12-18 15:20:00'
);

-- Dashboard e Métricas (Janeiro 2025)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v1.7.0',
  'Dashboard Principal com KPIs',
  'Dashboard executivo com métricas em tempo real: apólices ativas, faturamento mensal, renovações pendentes e indicadores de performance.',
  'feature',
  'high',
  true,
  '2025-01-02 09:30:00'
),
(
  'v1.7.1',
  'Gráficos Interativos Avançados',
  'Implementação de gráficos interativos com Recharts: distribuição por ramos, crescimento temporal e performance por produtor.',
  'improvement',
  'medium',
  true,
  '2025-01-05 14:15:00'
),
(
  'v1.7.2',
  'Sistema de Métricas Diárias',
  'Coleta automática de métricas diárias com sincronização via Google Sheets. Histórico de performance e tendências de crescimento.',
  'feature',
  'medium',
  true,
  '2025-01-08 11:45:00'
),
(
  'v1.8.0',
  'Insights Automáticos de Negócio',
  'Sistema de análise automática que gera insights sobre performance, identifica oportunidades e sugere ações baseadas nos dados.',
  'feature',
  'high',
  true,
  '2025-01-12 16:00:00'
);

-- Sistema de Agendamentos (Janeiro 2025)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v1.9.0',
  'Calendário Completo de Agendamentos',
  'Sistema de agendamentos integrado com FullCalendar. Visualizações por mês, semana e agenda com cores por tipo de compromisso.',
  'feature',
  'high',
  true,
  '2025-01-15 10:30:00'
),
(
  'v1.9.1',
  'Agendamentos Recorrentes',
  'Suporte completo a agendamentos recorrentes com regras flexíveis: diário, semanal, mensal e personalizado.',
  'feature',
  'medium',
  true,
  '2025-01-18 13:20:00'
),
(
  'v1.9.2',
  'Sistema de Notificações Automáticas',
  'Notificações proativas 15 minutos antes dos compromissos. Central de notificações com histórico e controle de leitura.',
  'feature',
  'medium',
  true,
  '2025-01-22 09:45:00'
),
(
  'v1.9.3',
  'Sugestões Inteligentes de Horários',
  'IA para sugestão de melhores horários baseado no histórico do usuário e disponibilidade. Otimização automática da agenda.',
  'feature',
  'low',
  true,
  '2025-01-25 15:30:00'
);

-- Design System Liquid Glass (Janeiro-Fevereiro 2025)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v2.0.0',
  'Design System Liquid Glass',
  'Implementação completa do sistema visual Liquid Glass com efeitos glassmorphism, gradientes fluidos e identidade visual moderna.',
  'breaking',
  'high',
  true,
  '2025-01-28 12:00:00'
),
(
  'v2.0.1',
  'Componentes Glassmorphism',
  'Biblioteca completa de componentes com efeitos de vidro: cards, modais, sidebar e elementos de navegação com transparência e blur.',
  'improvement',
  'medium',
  true,
  '2025-01-30 14:45:00'
),
(
  'v2.0.2',
  'Animações e Transições Fluidas',
  'Sistema de animações com Framer Motion: transições suaves, micro-interações e feedback visual aprimorado.',
  'improvement',
  'medium',
  true,
  '2025-02-02 11:15:00'
),
(
  'v2.0.3',
  'Responsividade Móvel Aprimorada',
  'Design system completamente responsivo com navegação móvel otimizada e componentes adaptáveis para todos os dispositivos.',
  'improvement',
  'high',
  true,
  '2025-02-05 16:20:00'
);

-- Faturamento e Transações (Fevereiro 2025)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v2.1.0',
  'Sistema Completo de Faturamento',
  'Gestão financeira completa com controle de receitas, despesas e comissões. Dashboard financeiro com métricas detalhadas.',
  'feature',
  'high',
  true,
  '2025-02-08 10:00:00'
),
(
  'v2.1.1',
  'Controle de Parcelas e Pagamentos',
  'Sistema avançado para gestão de parcelas com controle de vencimentos, baixas parciais e histórico completo de pagamentos.',
  'feature',
  'medium',
  true,
  '2025-02-12 13:45:00'
),
(
  'v2.1.2',
  'Relatórios Financeiros Detalhados',
  'Relatórios executivos de faturamento com análises por período, cliente, produtor e tipo de transação. Exportação para Excel.',
  'feature',
  'medium',
  true,
  '2025-02-15 09:30:00'
),
(
  'v2.1.3',
  'Integração com Métricas de Comissão',
  'Sincronização automática entre faturamento e métricas de comissão. Cálculos precisos e reconciliação de dados financeiros.',
  'improvement',
  'medium',
  true,
  '2025-02-18 14:15:00'
);

-- Sistema de Sinistros (Fevereiro 2025)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v2.2.0',
  'Gestão Completa de Sinistros',
  'Sistema robusto para abertura, acompanhamento e fechamento de sinistros. Controle de prazos, valores e documentação completa.',
  'feature',
  'high',
  true,
  '2025-02-20 11:00:00'
),
(
  'v2.2.1',
  'Upload de Documentos e Evidências',
  'Sistema de anexos para sinistros com suporte a múltiplos formatos. Organização por categoria e validação de documentos obrigatórios.',
  'feature',
  'medium',
  true,
  '2025-02-22 15:30:00'
),
(
  'v2.2.2',
  'Timeline de Atividades',
  'Histórico completo de todas as ações realizadas no sinistro com timestamps, responsáveis e descrições detalhadas.',
  'feature',
  'medium',
  true,
  '2025-02-25 12:45:00'
),
(
  'v2.2.3',
  'Sistema de Status e Prioridades',
  'Workflow completo de status do sinistro com priorização automática baseada em valor e prazo. Alertas de vencimento.',
  'improvement',
  'medium',
  true,
  '2025-02-28 10:20:00'
);

-- Relatórios Avançados (Março 2025)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v2.3.0',
  'Sistema de Relatórios Empresariais',
  'Suite completa de relatórios analíticos: carteira, renovações, performance e análises de tendências com visualizações avançadas.',
  'feature',
  'high',
  true,
  '2025-03-03 14:00:00'
),
(
  'v2.3.1',
  'Filtros Avançados e Exportação',
  'Sistema de filtros flexível com múltiplos critérios e exportação em diversos formatos (PDF, Excel, CSV) com layouts profissionais.',
  'feature',
  'medium',
  true,
  '2025-03-06 11:30:00'
),
(
  'v2.3.2',
  'Análise de Performance por Produtor',
  'Relatórios detalhados de performance individual e comparativa de produtores com rankings e metas de vendas.',
  'feature',
  'medium',
  true,
  '2025-03-10 16:15:00'
),
(
  'v2.3.3',
  'Análise de Distribuição por Ramos',
  'Análises aprofundadas da distribuição de apólices por ramos de seguro com insights de concentração e oportunidades.',
  'improvement',
  'low',
  true,
  '2025-03-13 09:45:00'
);

-- Configurações Avançadas (Março 2025)
INSERT INTO changelogs (
  version, title, description, category, priority, is_published, created_at
) VALUES 
(
  'v2.4.0',
  'Gestão de Corretoras e Produtores',
  'Sistema completo para cadastro e gestão de corretoras e produtores com hierarquias, comissões e configurações específicas.',
  'feature',
  'medium',
  true,
  '2025-03-15 13:20:00'
),
(
  'v2.4.1',
  'Configuração de Ramos e Seguradoras',
  'Interface para cadastro e manutenção de ramos de seguro e seguradoras com associações e configurações de comissão.',
  'feature',
  'medium',
  true,
  '2025-03-18 10:45:00'
),
(
  'v2.4.2',
  'Tipos de Transação Personalizáveis',
  'Sistema flexível para criação e configuração de tipos de transação personalizados com natureza receita/despesa.',
  'feature',
  'low',
  true,
  '2025-03-22 15:00:00'
),
(
  'v2.4.3',
  'Perfis de Usuário Avançados',
  'Sistema completo de gestão de perfis com configurações personalizadas, templates de mensagem e preferências do usuário.',
  'improvement',
  'low',
  true,
  '2025-03-25 11:30:00'
);