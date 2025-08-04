
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface RenewalAppointment {
  id: string;
  title: string;
  date: string;
  time: string;
  status: string;
  notes: string;
  policy_id: string;
  client_id: string;
  policyNumber?: string;
  clientName?: string;
}

export function useRenewalAppointments() {
  const [appointments, setAppointments] = useState<RenewalAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchRenewalAppointments = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: queryError } = await supabase
          .from('appointments')
          .select(`
            id,
            title,
            date,
            time,
            status,
            notes,
            policy_id,
            client_id,
            apolices!inner(
              policy_number
            ),
            clientes!inner(
              name
            )
          `)
          .eq('user_id', user.id)
          .like('title', 'Renovação%')
          .order('date', { ascending: true });

        if (queryError) {
          throw queryError;
        }

        const transformedData = (data || []).map(item => ({
          id: item.id,
          title: item.title,
          date: item.date,
          time: item.time,
          status: item.status,
          notes: item.notes || '',
          policy_id: item.policy_id,
          client_id: item.client_id,
          policyNumber: item.apolices?.policy_number,
          clientName: item.clientes?.name
        }));

        setAppointments(transformedData);
      } catch (err) {
        console.error('Erro ao buscar agendamentos de renovação:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchRenewalAppointments();
  }, [user]);

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      // Atualizar estado local
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status: newStatus }
            : apt
        )
      );

      return true;
    } catch (err) {
      console.error('Erro ao atualizar status do agendamento:', err);
      return false;
    }
  };

  return {
    appointments,
    loading,
    error,
    updateAppointmentStatus
  };
}
