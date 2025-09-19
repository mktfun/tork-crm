import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppCard } from '@/components/ui/app-card';
import { Button } from '@/components/ui/button';
import { useClients, usePolicies, useTransactions, useTransactionTypes } from '@/hooks/useAppData';
import { useGenericSupabaseMutation } from '@/hooks/useGenericSupabaseMutation';
import { Client, TransactionType } from '@/types';
import { generateWhatsAppUrl } from '@/utils/whatsapp';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ClientHeader } from '@/components/clients/ClientHeader';
import { ClientBasicInfo } from '@/components/clients/ClientBasicInfo';
import { ClientPersonalInfo } from '@/components/clients/ClientPersonalInfo';
import { ClientPoliciesHistory } from '@/components/clients/ClientPoliciesHistory';
import { ClientFinancialHistory } from '@/components/clients/ClientFinancialHistory';
import { ClientInteractionsHistory } from '@/components/clients/ClientInteractionsHistory';

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, loading: clientsLoading } = useClients();
  const { updateItem: updateClient } = useGenericSupabaseMutation({
    tableName: 'clientes',
    queryKey: 'clients',
    onSuccessMessage: {
      update: 'Cliente atualizado com sucesso'
    }
  });
  const { policies, loading: policiesLoading } = usePolicies();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { transactionTypes } = useTransactionTypes();
  
  const [client, setClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<Client | null>(null);

  // Dynamic page title based on client name
  usePageTitle(client ? `Detalhes de ${client.name}` : 'Detalhes do Cliente');

  useEffect(() => {
    if (id && !clientsLoading) {
      const foundClient = clients.find(c => c.id === id);
      setClient(foundClient || null);
      setEditedClient(foundClient || null);
    }
  }, [id, clients, clientsLoading]);

  const handleSaveChanges = async () => {
    if (client && editedClient) {
      updateClient({ id: client.id, ...editedClient });
      setClient(editedClient);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedClient(client);
    setIsEditing(false);
  };

  const handleFieldChange = (field: keyof Client, value: any) => {
    if (editedClient) {
      setEditedClient({ ...editedClient, [field]: value });
    }
  };

  const handleWhatsAppClick = () => {
    if (!client) return;
    const message = `Olá ${client.name}! Como posso ajudá-lo hoje?`;
    const url = generateWhatsAppUrl(client.phone, message);
    window.open(url, '_blank');
  };

  const isLoading = clientsLoading || policiesLoading || transactionsLoading;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <AppCard className="p-8 text-center">
          <h3 className="text-lg font-medium text-white mb-2">
            Carregando dados do cliente...
          </h3>
        </AppCard>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-7xl mx-auto">
        <AppCard className="p-8 text-center">
          <h3 className="text-lg font-medium text-white mb-2">
            Cliente não encontrado
          </h3>
          <p className="text-slate-300 mb-4">
            O cliente solicitado não existe ou foi removido.
          </p>
          <Button onClick={() => navigate('/clients')}>
            Voltar para Clientes
          </Button>
        </AppCard>
      </div>
    );
  }

  const clientPolicies = policies.filter(p => p.clientId === client.id);
  const activePolicies = clientPolicies.filter(p => p.status === 'Ativa');
  const clientTransactions = transactions.filter(t => t.clientId === client.id);

  // Map database transaction types to application format
  const mappedTransactionTypes: TransactionType[] = transactionTypes.map(type => ({
    id: type.id,
    name: type.name,
    nature: type.nature as 'GANHO' | 'PERDA',
    createdAt: type.createdAt
  }));

  const displayClient = isEditing ? editedClient! : client;

  return (
    <div className="max-w-7xl mx-auto">
      <ClientHeader
        client={displayClient}
        activePolicies={activePolicies}
        isEditing={isEditing}
        onBack={() => navigate('/clients')}
        onEdit={() => setIsEditing(true)}
        onSave={handleSaveChanges}
        onCancel={handleCancelEdit}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <ClientBasicInfo
            client={displayClient}
            isEditing={isEditing}
            onFieldChange={handleFieldChange}
            onWhatsAppClick={handleWhatsAppClick}
          />

          <ClientPersonalInfo
            client={displayClient}
            isEditing={isEditing}
            onFieldChange={handleFieldChange}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <ClientPoliciesHistory policies={clientPolicies} />
          <ClientFinancialHistory 
            transactions={clientTransactions} 
            transactionTypes={mappedTransactionTypes} 
          />
          <ClientInteractionsHistory />
        </div>
      </div>
    </div>
  );
}
