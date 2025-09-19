import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useGenericSupabaseMutation } from '@/hooks/useGenericSupabaseMutation';
import { useAppointments } from '@/hooks/useAppData';
import { ColumnMappingTable } from './import/ColumnMappingTable';
import { ImportPreview } from './import/ImportPreview';
import { validateImportRow, filterValidRows, validateDate } from './import/ImportUtils';
import type { ColumnMapping } from './import/types';

interface ClientImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ClientImportModal({ open, onOpenChange, onImportComplete }: ClientImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'processing' | 'complete'>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping[]>([]);
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: number;
    skipped: number;
    appointmentOnly: number;
  }>({ success: 0, errors: 0, skipped: 0, appointmentOnly: 0 });
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addItem: addClient } = useGenericSupabaseMutation({
    tableName: 'clientes',
    queryKey: 'clients',
    onSuccessMessage: {
      add: 'Cliente importado com sucesso'
    }
  });
  const { addAppointment } = useAppointments();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // CSV data parsed successfully
          setCsvData(results.data);
          setCsvHeaders(Object.keys(results.data[0] || {}));
          setStep('mapping');
        },
        error: (error) => {
          console.error('Erro ao fazer parsing do CSV:', error);
          toast.error('Erro ao processar arquivo CSV');
        }
      });
    }
  };

  const handleColumnMappingComplete = (mapping: ColumnMapping[]) => {
    setColumnMapping(mapping);
    setStep('preview');
  };

  const processImport = async () => {
    setIsProcessing(true);
    setStep('processing');
    setProcessingProgress(0);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let appointmentOnlyCount = 0;

    // Filtrar apenas linhas válidas usando a função utilitária
    const filteredData = filterValidRows(csvData, columnMapping);
    const validRows = filteredData.validRows;
    const totalRows = csvData.length;
    const validCount = validRows.length;
    skippedCount = filteredData.stats.invalid;

    // Import validation completed

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      
      try {
        const validation = validateImportRow(row, columnMapping);
        
        if (!validation.isValid) {
          console.error(`Linha ${i + 1}: ${validation.issues.join(', ')} - IGNORADA`);
          errorCount++;
          continue;
        }

        // Extrair dados da linha baseado no mapeamento
        const clientData: any = {};
        const appointmentData: any = {};

        columnMapping.forEach(mapping => {
          if (mapping.ignored || !mapping.systemField) return;

          const value = row[mapping.csvColumn];
          if (!value) return;

          // Campos do cliente
          if (['name', 'email', 'phone', 'cpfCnpj', 'birthDate', 'profession', 'maritalStatus', 'cep', 'address', 'city', 'state', 'observations'].includes(mapping.systemField)) {
            if (mapping.systemField === 'birthDate') {
              const dateValidation = validateDate(value);
              if (dateValidation.isValid) {
                clientData[mapping.systemField] = dateValidation.parsedDate?.toISOString().split('T')[0];
              }
            } else {
              clientData[mapping.systemField] = value;
            }
          }

          // Campos do agendamento
          if (['appointmentTitle', 'appointmentDate', 'appointmentTime', 'appointmentStatus'].includes(mapping.systemField)) {
            if (mapping.systemField === 'appointmentDate') {
              const dateValidation = validateDate(value);
              if (dateValidation.isValid) {
                appointmentData.date = dateValidation.parsedDate?.toISOString().split('T')[0];
              }
            } else if (mapping.systemField === 'appointmentTitle') {
              appointmentData.title = value;
            } else if (mapping.systemField === 'appointmentTime') {
              appointmentData.time = value;
            } else if (mapping.systemField === 'appointmentStatus') {
              appointmentData.status = value;
            }
          }
        });

        let clientId: string | null = null;

        // Tentar criar cliente se tiver dados mínimos
        if (clientData.name && (clientData.email || clientData.phone)) {
          try {
            addClient(clientData, {
              onSuccess: (newClient) => {
                clientId = newClient.id;
                successCount++;
              },
              onError: (error) => {
                console.error('Erro ao criar cliente:', error);
                errorCount++;
              }
            });
            // Client creation initiated
          } catch (error) {
            console.error('Erro ao criar cliente:', error);
            errorCount++;
            continue;
          }
        }

        // Criar agendamento se tiver dados de agendamento
        if (appointmentData.date && appointmentData.title) {
          try {
            await addAppointment({
              ...appointmentData,
              client_id: clientId,
              status: appointmentData.status || 'Pendente'
            });
            
            if (clientId) {
              successCount++;
              // Client and appointment created successfully
            } else {
              appointmentOnlyCount++;
              // Appointment created without linked client
            }
          } catch (error) {
            console.error('Erro ao criar agendamento:', error);
            errorCount++;
          }
        } else if (clientId) {
          // Cliente criado sem agendamento
          successCount++;
          // Client created without appointment
        }

      } catch (error) {
        console.error(`Erro ao processar linha ${i + 1}:`, error);
        errorCount++;
      }

      setProcessingProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImportResults({
      success: successCount,
      errors: errorCount,
      skipped: skippedCount,
      appointmentOnly: appointmentOnlyCount
    });

    setIsProcessing(false);
    setStep('complete');

    // Exibir toasts com resultados
    if (successCount > 0) {
      toast.success(`${successCount} clientes importados com sucesso!`);
    }
    if (appointmentOnlyCount > 0) {
      toast.info(`${appointmentOnlyCount} agendamentos criados sem cliente vinculado.`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} linhas tiveram erro no processamento.`);
    }
    if (skippedCount > 0) {
      toast.info(`${skippedCount} linhas vazias ou inválidas foram ignoradas.`);
    }
  };

  const handleComplete = () => {
    onImportComplete();
    onOpenChange(false);
    resetModal();
  };

  const resetModal = () => {
    setStep('upload');
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping([]);
    setImportResults({ success: 0, errors: 0, skipped: 0, appointmentOnly: 0 });
    setProcessingProgress(0);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const template = `CLIENTE,EMAIL,TELEFONE,DATA_NASCIMENTO,ENDERECO,CIDADE,CEP,VENCIMENTO,PRODUTO,OBSERVACOES
João Silva,joao@email.com,11999999999,1980-01-15,Rua das Flores 123,São Paulo,01234-567,2024-12-25,Seguro Auto,Cliente muito pontual
Maria Santos,maria@email.com,11888888888,1975-03-22,Av. Principal 456,Rio de Janeiro,21000-000,2024-12-30,Seguro Residencial,Renovação automática`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-importacao-clientes.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Clientes via CSV
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Upload do Arquivo CSV
                </CardTitle>
                <CardDescription>
                  Selecione um arquivo CSV com os dados dos clientes para importar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="csvFile">Arquivo CSV</Label>
                  <Input
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="mt-1"
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Não tem um arquivo CSV?</p>
                    <p className="text-sm text-muted-foreground">
                      Baixe nosso template e preencha com seus dados
                    </p>
                  </div>
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'mapping' && (
          <ColumnMappingTable
            csvHeaders={csvHeaders}
            csvData={csvData}
            onMappingChange={handleColumnMappingComplete}
          />
        )}

        {step === 'preview' && (
          <ImportPreview
            mappings={columnMapping}
            csvData={csvData}
            totalRows={csvData.length}
          />
        )}

        {step === 'processing' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Processando Importação...</CardTitle>
                <CardDescription>
                  Aguarde enquanto processamos seus dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={processingProgress} className="w-full" />
                <p className="text-sm text-muted-foreground mt-2">
                  {processingProgress}% concluído
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Importação Concluída!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {importResults.success} Sucessos
                    </Badge>
                  </div>
                  
                  {importResults.appointmentOnly > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {importResults.appointmentOnly} Agendamentos
                      </Badge>
                    </div>
                  )}
                  
                  {importResults.errors > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        {importResults.errors} Erros
                      </Badge>
                    </div>
                  )}
                  
                  {importResults.skipped > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {importResults.skipped} Ignoradas
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <Button onClick={handleComplete} className="w-full">
                    Finalizar Importação
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
