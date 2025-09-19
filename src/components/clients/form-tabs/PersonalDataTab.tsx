
import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { Switch } from '@/components/ui/switch';
import { ClientFormData } from '@/schemas/clientSchema';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface PersonalDataTabProps {
  form: UseFormReturn<ClientFormData>;
}

function CalendarCaption({ 
  displayMonth, 
  onMonthChange 
}: { 
  displayMonth: Date;
  onMonthChange: (month: Date) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = [];
  
  for (let i = 1920; i <= currentYear; i++) {
    years.push(i);
  }

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="flex justify-center items-center space-x-2 mb-4">
      <Select
        value={String(displayMonth.getMonth())}
        onValueChange={(value) => {
          const newDate = new Date(displayMonth);
          newDate.setMonth(Number(value));
          onMonthChange(newDate);
        }}
      >
        <SelectTrigger className="w-[120px] bg-slate-900/50 border-slate-700">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {months.map((month, i) => (
            <SelectItem key={month} value={String(i)}>
              {month}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(displayMonth.getFullYear())}
        onValueChange={(value) => {
          const newDate = new Date(displayMonth);
          newDate.setFullYear(Number(value));
          onMonthChange(newDate);
        }}
      >
        <SelectTrigger className="w-[100px] bg-slate-900/50 border-slate-700">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {years.reverse().map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Função para validar CPF
const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleanCPF.charAt(10));
};

// Função para validar CNPJ
const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cleanCNPJ.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleanCNPJ.charAt(12))) return false;
  
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cleanCNPJ.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return digit2 === parseInt(cleanCNPJ.charAt(13));
};

// Função para verificar se o documento é válido
const getDocumentValidation = (value: string) => {
  if (!value || value.trim() === '') return null;
  
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    return validateCPF(value) ? 'valid' : 'invalid';
  }
  if (clean.length === 14) {
    return validateCNPJ(value) ? 'valid' : 'invalid';
  }
  return 'invalid';
};

export function PersonalDataTab({ form }: PersonalDataTabProps) {
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [isCNPJ, setIsCNPJ] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');
  const cpfCnpjValue = form.watch('cpfCnpj');
  const birthDateValue = form.watch('birthDate');
  const documentValidation = getDocumentValidation(cpfCnpjValue || '');

  // Sync date input value with form value
  useEffect(() => {
    if (birthDateValue) {
      const date = new Date(birthDateValue);
      setDateInputValue(format(date, 'dd/MM/yyyy'));
    } else {
      setDateInputValue('');
    }
  }, [birthDateValue]);

  // Determine the mask based on switch state
  const getMask = () => {
    return isCNPJ ? '99.999.999/9999-99' : '999.999.999-99';
  };

  // Handle switch change
  const handleSwitchChange = (checked: boolean) => {
    setIsCNPJ(checked);
    // Clear the field when switching between CPF/CNPJ
    form.setValue('cpfCnpj', '');
  };

  // Handle manual date input
  const handleDateInputChange = (value: string) => {
    setDateInputValue(value);
    
    if (value === '' || value.replace(/\D/g, '').length === 0) {
      form.setValue('birthDate', '');
      return;
    }

    // Remove qualquer caractere que não seja número
    const cleanValue = value.replace(/\D/g, '');
    
    // Verifica se tem exatamente 8 dígitos (DDMMYYYY)
    if (cleanValue.length === 8) {
      const day = parseInt(cleanValue.substr(0, 2));
      const month = parseInt(cleanValue.substr(2, 2));
      const year = parseInt(cleanValue.substr(4, 4));
      
      // Validação básica
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1920 && year <= new Date().getFullYear()) {
        // Criar a data sem considerar fuso horário
        const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Validar se a data é válida criando um objeto Date e verificando se não foi ajustada
        const testDate = new Date(year, month - 1, day);
        if (testDate.getDate() === day && testDate.getMonth() === month - 1 && testDate.getFullYear() === year) {
          form.setValue('birthDate', dateString);
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Dados Pessoais</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Nome Completo *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Digite o nome completo"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* CONTAINER FLEX PARA TELEFONE E EMAIL - RESPONSIVO */}
        <div className="md:col-span-2 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="phone" className="text-white">Telefone *</FormLabel>
                  <FormControl>
                    <MaskedInput
                      {...field}
                      id="phone"
                      mask="(99) 99999-9999"
                      placeholder="(11) 99999-9999"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex-1">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="email" className="text-white">Email *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      placeholder="cliente@email.com"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <FormField
            control={form.control}
            name="cpfCnpj"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel className="text-white">
                    {isCNPJ ? 'CNPJ' : 'CPF'}
                  </FormLabel>
                  <div className="flex items-center space-x-2">
                    <span className={cn("text-sm", !isCNPJ ? "text-white" : "text-white/50")}>
                      CPF
                    </span>
                    <Switch
                      checked={isCNPJ}
                      onCheckedChange={handleSwitchChange}
                    />
                    <span className={cn("text-sm", isCNPJ ? "text-white" : "text-white/50")}>
                      CNPJ
                    </span>
                  </div>
                </div>
                <FormControl>
                  <div className="relative">
                    <MaskedInput
                      {...field}
                      mask={getMask()}
                      placeholder={isCNPJ ? "00.000.000/0000-00" : "000.000.000-00"}
                      className={cn(
                        "bg-black/20 border-white/20 text-white placeholder:text-white/50 pr-10",
                        documentValidation === 'valid' && "border-green-500/50",
                        documentValidation === 'invalid' && "border-red-500/50"
                      )}
                    />
                    {documentValidation && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {documentValidation === 'valid' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </FormControl>
                {documentValidation === 'invalid' && cpfCnpjValue && (
                  <p className="text-sm text-red-400 mt-1">{isCNPJ ? 'CNPJ inválido' : 'CPF inválido'}</p>
                )}
                {documentValidation === 'valid' && (
                  <p className="text-sm text-green-400 mt-1">
                    {isCNPJ ? 'CNPJ válido' : 'CPF válido'}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-white">Data de Nascimento</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <MaskedInput
                    mask="99/99/9999"
                    placeholder="DD/MM/AAAA"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/50 flex-1"
                    value={dateInputValue}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                  />
                </FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-black/20 border-white/20 text-white hover:bg-black/30 px-3"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(day: Date | undefined) => {
                        if (!day) {
                          field.onChange('');
                          return;
                        }
                        // Usar o mesmo formato sem considerar fuso horário
                        const dateString = `${day.getFullYear()}-${(day.getMonth() + 1).toString().padStart(2, '0')}-${day.getDate().toString().padStart(2, '0')}`;
                        field.onChange(dateString);
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      className="p-3 pointer-events-auto"
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      fromYear={1920}
                      toYear={new Date().getFullYear()}
                      components={{
                        Caption: ({ displayMonth }) => (
                          <CalendarCaption 
                            displayMonth={displayMonth} 
                            onMonthChange={setCalendarMonth} 
                          />
                        ),
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maritalStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Estado Civil</FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="w-full h-10 px-3 py-2 border border-white/20 bg-black/20 rounded-md text-sm text-white"
                >
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="profession"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Profissão</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Ex: Engenheiro, Médico..."
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

      </div>
    </div>
  );
}
