-- Create changelogs table
CREATE TABLE public.changelogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('feature', 'bugfix', 'improvement', 'breaking')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user changelog views table
CREATE TABLE public.user_changelog_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  changelog_id UUID NOT NULL REFERENCES public.changelogs(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, changelog_id)
);

-- Enable RLS
ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_changelog_views ENABLE ROW LEVEL SECURITY;

-- Policies for changelogs (users can only read published ones)
CREATE POLICY "Users can view published changelogs" 
ON public.changelogs 
FOR SELECT 
USING (is_published = true);

-- Policies for user_changelog_views
CREATE POLICY "Users can view their own changelog views" 
ON public.user_changelog_views 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own changelog views" 
ON public.user_changelog_views 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own changelog views" 
ON public.user_changelog_views 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at_changelogs()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_changelogs_updated_at
BEFORE UPDATE ON public.changelogs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at_changelogs();

-- Create indexes
CREATE INDEX idx_changelogs_published ON public.changelogs(is_published, created_at DESC);
CREATE INDEX idx_user_changelog_views_user_id ON public.user_changelog_views(user_id);
CREATE INDEX idx_user_changelog_views_changelog_id ON public.user_changelog_views(changelog_id);