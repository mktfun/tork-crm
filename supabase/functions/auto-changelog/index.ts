import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChangelogPayload {
  version: string;
  title: string;
  description: string;
  category: 'feature' | 'bugfix' | 'improvement' | 'breaking';
  priority: 'low' | 'medium' | 'high' | 'critical';
  repo: string;
  commit: string;
  author: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto-changelog function called');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: ChangelogPayload = await req.json();
    console.log('Received payload:', payload);

    // Validate required fields
    if (!payload.version || !payload.title || !payload.description) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: version, title, description' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if changelog already exists for this version
    const { data: existing } = await supabase
      .from('changelogs')
      .select('id')
      .eq('version', payload.version)
      .single();

    if (existing) {
      console.log(`Changelog for version ${payload.version} already exists`);
      return new Response(
        JSON.stringify({ message: 'Changelog already exists for this version' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Insert new changelog entry
    const { data, error } = await supabase
      .from('changelogs')
      .insert({
        version: payload.version,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        priority: payload.priority,
        is_published: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting changelog:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create changelog entry' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Changelog created successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        changelog: data,
        message: `Changelog created for ${payload.version}` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in auto-changelog function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});