
-- Criar a foreign key constraint entre apolices e companies
-- Conecta a coluna insurance_company da tabela apolices com o id da tabela companies
ALTER TABLE public.apolices 
ADD CONSTRAINT fk_apolices_companies 
FOREIGN KEY (insurance_company) 
REFERENCES public.companies(id);
