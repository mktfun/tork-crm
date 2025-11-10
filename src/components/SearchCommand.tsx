import { useState } from 'react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useClients, usePolicies } from "@/hooks/useAppData";
import { useNavigate } from "react-router-dom";
import { Users, FileText } from "lucide-react";

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const { clients } = useClients();
  const { policies } = usePolicies();
  const navigate = useNavigate();

  const runCommand = (command: () => unknown) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Busque por clientes, apólices..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        
        <CommandGroup heading="Clientes">
          {clients.slice(0, 5).map(client => (
            <CommandItem
              key={client.id}
              value={`${client.name} ${client.email || ''} ${client.phone || ''}`}
              keywords={[client.name, client.email || '', client.phone || '', 'cliente', 'funcionario']}
              onSelect={() => runCommand(() => navigate(`/clients/${client.id}`))}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4 text-blue-400" />
              <span>{client.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{client.email}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        
        <CommandGroup heading="Apólices">
          {policies.slice(0, 5).map(policy => {
            const client = clients.find(c => c.id === policy.clientId);
            return (
              <CommandItem
                key={policy.id}
                value={`${policy.policyNumber || ''} ${policy.ramos?.nome || policy.type || ''} ${client?.name || ''}`}
                keywords={[policy.policyNumber || '', policy.type || '', client?.name || '', 'apolice', 'seguro']}
                onSelect={() => runCommand(() => navigate(`/policies/${policy.id}`))}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4 text-green-400" />
                <span>Apólice #{policy.policyNumber}</span>
                <span className="text-xs text-muted-foreground ml-auto">{client?.name}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
