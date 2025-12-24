import { useState, useMemo, useCallback } from 'react';
import { Check, ChevronsUpDown, Search, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ClientOption {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface ClientSearchComboboxProps {
  clients: ClientOption[];
  value: string;
  onValueChange: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ClientSearchCombobox({
  clients,
  value,
  onValueChange,
  isLoading = false,
  placeholder = "Buscar cliente...",
  disabled = false,
}: ClientSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter clients based on search query (name, phone, email)
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase().trim();
    return clients.filter((client) => {
      const nameMatch = client.name?.toLowerCase().includes(query);
      const phoneMatch = client.phone?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
      const emailMatch = client.email?.toLowerCase().includes(query);
      return nameMatch || phoneMatch || emailMatch;
    });
  }, [clients, searchQuery]);

  // Get selected client info
  const selectedClient = useMemo(() => {
    return clients.find((client) => client.id === value);
  }, [clients, value]);

  const handleSelect = useCallback((clientId: string) => {
    onValueChange(clientId === value ? '' : clientId);
    setOpen(false);
    setSearchQuery('');
  }, [onValueChange, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando clientes...
            </span>
          ) : selectedClient ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedClient.name}</span>
              {selectedClient.phone && (
                <span className="text-xs text-muted-foreground truncate">
                  • {selectedClient.phone}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Buscar por nome, telefone ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-center text-sm">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : (
                "Nenhum cliente encontrado."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredClients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={() => handleSelect(client.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === client.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">{client.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {client.phone && <span>{client.phone}</span>}
                      {client.phone && client.email && <span>•</span>}
                      {client.email && <span className="truncate">{client.email}</span>}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
