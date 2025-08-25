-- Add missing priority field to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal' 
CHECK (priority IN ('Baixa', 'Normal', 'Alta', 'Urgente'));

-- Create sinistros table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sinistros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    client_id UUID,
    policy_id UUID,
    claim_number TEXT,
    claim_type TEXT NOT NULL,
    description TEXT NOT NULL,
    occurrence_date DATE NOT NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Aberto',
    priority TEXT DEFAULT 'Média',
    claim_amount NUMERIC,
    approved_amount NUMERIC,
    deductible_amount NUMERIC DEFAULT 0,
    circumstances TEXT,
    location_occurrence TEXT,
    police_report_number TEXT,
    evidence_urls TEXT[],
    producer_id UUID,
    assigned_to UUID,
    brokerage_id INTEGER,
    analysis_deadline DATE,
    resolution_date DATE,
    payment_date DATE,
    documents_checklist JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sinistro_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sinistro_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sinistro_id UUID NOT NULL,
    user_id UUID NOT NULL,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    is_required BOOLEAN DEFAULT false,
    is_validated BOOLEAN DEFAULT false,
    validated_by UUID,
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sinistro_activities table if it doesn't exist  
CREATE TABLE IF NOT EXISTS public.sinistro_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sinistro_id UUID NOT NULL,
    user_id UUID NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sinistros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistro_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistro_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sinistros
CREATE POLICY IF NOT EXISTS "Users can view their own sinistros" 
ON public.sinistros FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create their own sinistros" 
ON public.sinistros FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own sinistros" 
ON public.sinistros FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own sinistros" 
ON public.sinistros FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for sinistro_documents
CREATE POLICY IF NOT EXISTS "Users can view documents of their sinistros" 
ON public.sinistro_documents FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.sinistros 
    WHERE sinistros.id = sinistro_documents.sinistro_id 
    AND sinistros.user_id = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Users can insert documents in their sinistros" 
ON public.sinistro_documents FOR INSERT 
WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.sinistros 
    WHERE sinistros.id = sinistro_documents.sinistro_id 
    AND sinistros.user_id = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Users can update documents of their sinistros" 
ON public.sinistro_documents FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.sinistros 
    WHERE sinistros.id = sinistro_documents.sinistro_id 
    AND sinistros.user_id = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Users can delete documents of their sinistros" 
ON public.sinistro_documents FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM public.sinistros 
    WHERE sinistros.id = sinistro_documents.sinistro_id 
    AND sinistros.user_id = auth.uid()
));

-- Create RLS policies for sinistro_activities
CREATE POLICY IF NOT EXISTS "Users can view activities of their sinistros" 
ON public.sinistro_activities FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.sinistros 
    WHERE sinistros.id = sinistro_activities.sinistro_id 
    AND sinistros.user_id = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Users can create activities in their sinistros" 
ON public.sinistro_activities FOR INSERT 
WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.sinistros 
    WHERE sinistros.id = sinistro_activities.sinistro_id 
    AND sinistros.user_id = auth.uid()
));

-- Create triggers for updated_at fields
CREATE OR REPLACE TRIGGER update_sinistros_updated_at
    BEFORE UPDATE ON public.sinistros
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at_sinistros();

-- Add comment on priority column
COMMENT ON COLUMN public.appointments.priority IS 'Prioridade do agendamento: Baixa, Normal, Alta, Urgente';