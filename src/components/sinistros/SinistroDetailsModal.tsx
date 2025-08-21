import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Eye, 
  Edit,
  Save,
  X,
  FileText,
  Clock,
  Calendar,
  DollarSign,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  History,
  Paperclip
} from 'lucide-react';
import { useUpdateSinistro, useSinistroActivities, useSinistroDocuments, type Sinistro } from '@/hooks/useSinistros';
import { SinistroDocumentUpload } from './SinistroDocumentUpload';
import { SinistroTimeline } from './SinistroTimeline';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const updateSinistroSchema = z.object({
  status: z.string().min(1, 'Status é obrigatório'),
  claim_amount: z.string().optional(),
  approved_amount: z.string().optional(),
  deductible_amount: z.string().optional(),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  location_occurrence: z.string().optional(),
  circumstances: z.string().optional(),
  police_report_number: z.string().optional(),
  priority: z.string().optional(),
  analysis_deadline: z.string().optional(),
  resolution_date: z.string().optional(),
  payment_date: z.string().optional(),
});

type UpdateSinistroFormData = z.infer<typeof updateSinistroSchema>;

const statusOptions = [
  'Aberto',
  'Em Análise',
  'Documentação Pendente',
  'Aprovado',
  'Negado',
  'Cancelado',
  'Finalizado'
];

const priorities = [
  { value: 'Baixa', label: 'Baixa' },
  { value: 'Média', label: 'Média' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Urgente', label: 'Urgente' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Aberto':
      return 'bg-blue-500';
    case 'Em Análise':
      return 'bg-yellow-500';
    case 'Aprovado':
      return 'bg-green-500';
    case 'Negado':
      return 'bg-red-500';
    case 'Finalizado':
      return 'bg-gray-500';
    case 'Cancelado':
      return 'bg-orange-500';
    case 'Documentação Pendente':
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Aberto':
      return <AlertTriangle className="w-4 h-4" />;
    case 'Em Análise':
      return <Clock className="w-4 h-4" />;
    case 'Aprovado':
      return <CheckCircle className="w-4 h-4" />;
    case 'Negado':
      return <XCircle className="w-4 h-4" />;
    case 'Finalizado':
      return <CheckCircle className="w-4 h-4" />;
    case 'Cancelado':
      return <X className="w-4 h-4" />;
    case 'Documentação Pendente':
      return <FileText className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

interface SinistroDetailsModalProps {
  sinistro: Sinistro | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SinistroDetailsModal({ sinistro, open, onOpenChange, onSuccess }: SinistroDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  const updateSinistro = useUpdateSinistro();
  const { data: activities = [] } = useSinistroActivities(sinistro?.id || '');
  const { data: documents = [] } = useSinistroDocuments(sinistro?.id || '');

  const form = useForm<UpdateSinistroFormData>({
    resolver: zodResolver(updateSinistroSchema),
  });

  // Reset form when sinistro changes or modal opens
  useEffect(() => {
    if (sinistro && open) {
      form.reset({
        status: sinistro.status,
        claim_amount: sinistro.claim_amount?.toString() || '',
        approved_amount: sinistro.approved_amount?.toString() || '',
        deductible_amount: sinistro.deductible_amount?.toString() || '',
        description: sinistro.description,
        location_occurrence: sinistro.location_occurrence || '',
        circumstances: sinistro.circumstances || '',
        police_report_number: sinistro.police_report_number || '',
        priority: sinistro.priority || 'Média',
        analysis_deadline: sinistro.analysis_deadline || '',
        resolution_date: sinistro.resolution_date || '',
        payment_date: sinistro.payment_date || '',
      });
      setIsEditing(false);
      setActiveTab('details');
    }
  }, [sinistro, open, form]);

  if (!sinistro) return null;

  const onSubmit = async (data: UpdateSinistroFormData) => {
    try {
      const submitData = {
        id: sinistro.id,
        ...data,
        claim_amount: data.claim_amount ? parseFloat(data.claim_amount) : undefined,
        approved_amount: data.approved_amount ? parseFloat(data.approved_amount) : undefined,
        deductible_amount: data.deductible_amount ? parseFloat(data.deductible_amount) : undefined,
      };

      await updateSinistro.mutateAsync(submitData);
      
      setIsEditing(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao atualizar sinistro:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {sinistro.claim_number || `Sinistro #${sinistro.id.slice(-8)}`}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={`${getStatusColor(sinistro.status)} text-white flex items-center gap-1`}>
                {getStatusIcon(sinistro.status)}
                {sinistro.status}
              </Badge>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="details" className="space-y-6 p-1">
              {/* Informações Principais */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Informações do Sinistro
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/60">Cliente:</span>
                      <p className="text-white font-medium">{sinistro.client_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Apólice:</span>
                      <p className="text-white font-medium">{sinistro.policy_number || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Tipo:</span>
                      <p className="text-white font-medium">{sinistro.claim_type}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Data Ocorrência:</span>
                      <p className="text-white font-medium">{formatDate(sinistro.occurrence_date)}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Data Registro:</span>
                      <p className="text-white font-medium">{formatDate(sinistro.report_date)}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Seguradora:</span>
                      <p className="text-white font-medium">
                        {sinistro.company_name || sinistro.insurance_company || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {sinistro.location_occurrence && (
                    <div>
                      <span className="text-white/60 text-sm">Local da Ocorrência:</span>
                      <p className="text-white/80 text-sm flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4" />
                        {sinistro.location_occurrence}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Responsáveis
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-white/60">Produtor:</span>
                      <p className="text-white font-medium">{sinistro.producer_name || 'Não atribuído'}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Corretora:</span>
                      <p className="text-white font-medium">{sinistro.brokerage_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Prioridade:</span>
                      <Badge variant="outline" className={`${
                        sinistro.priority === 'Alta' ? 'border-orange-500 text-orange-400' :
                        sinistro.priority === 'Urgente' ? 'border-red-500 text-red-400' :
                        'border-gray-500 text-gray-400'
                      }`}>
                        {sinistro.priority || 'Média'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 my-6" />

              {/* Formulário de Edição ou Visualização */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Descrição */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição da Ocorrência</FormLabel>
                        <FormControl>
                          {isEditing ? (
                            <Textarea className="min-h-[100px]" {...field} />
                          ) : (
                            <div className="p-3 bg-white/5 rounded-lg text-white/80">
                              {field.value}
                            </div>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Circunstâncias */}
                  <FormField
                    control={form.control}
                    name="circumstances"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Circunstâncias Detalhadas</FormLabel>
                        <FormControl>
                          {isEditing ? (
                            <Textarea {...field} />
                          ) : (
                            <div className="p-3 bg-white/5 rounded-lg text-white/80">
                              {field.value || 'Não informado'}
                            </div>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isEditing && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Status */}
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {statusOptions.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Prioridade */}
                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prioridade</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {priorities.map((priority) => (
                                    <SelectItem key={priority.value} value={priority.value}>
                                      {priority.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex justify-end gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsEditing(false)}
                          disabled={updateSinistro.isPending}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={updateSinistro.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {updateSinistro.isPending && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          <Save className="w-4 h-4 mr-2" />
                          Salvar Alterações
                        </Button>
                      </div>
                    </>
                  )}
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4 p-1">
              <SinistroTimeline
                sinistroId={sinistro.id}
                currentStatus={sinistro.status}
                activities={activities}
                onRefresh={onSuccess}
              />
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 p-1">
              <div className="space-y-6">
                <SinistroDocumentUpload
                  sinistroId={sinistro.id}
                  onSuccess={onSuccess}
                />

                <div className="border-t border-white/10 pt-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Paperclip className="w-5 h-5" />
                    Documentos Anexados
                  </h3>

                  {documents.length === 0 ? (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum documento anexado ainda.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid gap-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-white font-medium">{doc.file_name}</p>
                              <p className="text-xs text-white/60">{doc.document_type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.is_validated && (
                              <Badge className="bg-green-500">Validado</Badge>
                            )}
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-4 p-1">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Informações Financeiras
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white/60 text-sm mb-2">Valor Solicitado</h4>
                  <p className="text-2xl font-bold text-blue-400">
                    {sinistro.claim_amount?.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }) || 'N/A'}
                  </p>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white/60 text-sm mb-2">Valor Aprovado</h4>
                  <p className="text-2xl font-bold text-green-400">
                    {sinistro.approved_amount?.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }) || 'N/A'}
                  </p>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white/60 text-sm mb-2">Franquia</h4>
                  <p className="text-2xl font-bold text-orange-400">
                    {sinistro.deductible_amount?.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }) || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white/60 text-sm mb-2">Prazo de Análise</h4>
                  <p className="text-white">
                    {sinistro.analysis_deadline ? formatDate(sinistro.analysis_deadline) : 'Não definido'}
                  </p>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white/60 text-sm mb-2">Data de Pagamento</h4>
                  <p className="text-white">
                    {sinistro.payment_date ? formatDate(sinistro.payment_date) : 'Não realizado'}
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
