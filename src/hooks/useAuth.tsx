import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureDefaultTransactionTypes } from '@/services/transactionTypeService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Configurar listener de mudanças de autenticação PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        // *** AQUI ESTÁ A TRAVA DE SEGURANÇA ***
        // A gente SÓ vai rodar o setup inicial se o evento for EXATAMENTE 'SIGNED_IN'.
        if (event === 'SIGNED_IN') {
          console.log('EVENTO DE SIGNED_IN DETECTADO. Rodando setup inicial UMA VEZ.');
          if (session?.user) {
            ensureDefaultTransactionTypes(session.user.id).catch(error => {
              console.error('Error ensuring default transaction types:', error);
            });
          }
        }
        
        // A gente pode até logar o refresh pra ver que ele não faz mais nada de perigoso.
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token foi só atualizado em segundo plano. Nenhuma ação de setup necessária.');
        }
        
        setLoading(false);
      }
    );

    // DEPOIS verificar sessão existente - SEM duplicar o setup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Erro no login:', error);
        return { error };
      }

      if (data.user) {
        toast.success('Login realizado com sucesso!');
        return { error: null };
      }

      return { error: new Error('Erro desconhecido no login') };
    } catch (error) {
      console.error('Erro no signIn:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, nomeCompleto: string) => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nome_completo: nomeCompleto,
          },
        },
      });

      if (error) {
        console.error('Erro no cadastro:', error);
        return { error };
      }

      if (data.user) {
        toast.success('Cadastro realizado! Verifique seu email para confirmar a conta.');
        return { error: null };
      }

      return { error: new Error('Erro desconhecido no cadastro') };
    } catch (error) {
      console.error('Erro no signUp:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erro no logout:', error);
        toast.error('Erro ao fazer logout');
      } else {
        toast.success('Logout realizado com sucesso!');
        // Force page reload para garantir limpeza completa
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Erro no signOut:', error);
      toast.error('Erro ao fazer logout');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Erro ao resetar senha:', error);
        return { error };
      }

      toast.success('Email de recuperação enviado!');
      return { error: null };
    } catch (error) {
      console.error('Erro no resetPassword:', error);
      return { error };
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
