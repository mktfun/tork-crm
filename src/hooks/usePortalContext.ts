import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface BrokerageData {
  id: number;
  name: string;
  logo_url: string | null;
  slug: string;
  show_policies: boolean;
  show_cards: boolean;
  allow_profile_edit: boolean;
  allow_policy_download: boolean;
  allow_card_download: boolean;
}

interface PortalContextData {
  brokerageSlug: string;
  brokerageName: string;
  brokerageLogo: string | null;
  portalConfig: {
    show_policies: boolean;
    show_cards: boolean;
    allow_profile_edit: boolean;
  };
  isLoading: boolean;
  isValid: boolean;
  errorMessage: string | null;
}

interface GetBrokerageResponse {
  success: boolean;
  message?: string;
  brokerage?: BrokerageData;
}

export function usePortalContext(): PortalContextData {
  const { brokerageSlug } = useParams<{ brokerageSlug: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [brokerageData, setBrokerageData] = useState<BrokerageData | null>(null);

  useEffect(() => {
    async function fetchBrokerage() {
      if (!brokerageSlug) {
        setIsLoading(false);
        setIsValid(false);
        setErrorMessage('Slug da corretora não informado');
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_brokerage_by_slug', {
          p_slug: brokerageSlug.toLowerCase()
        });

        if (error) {
          console.error('Error fetching brokerage:', error);
          setErrorMessage('Erro ao buscar corretora');
          setIsValid(false);
        } else {
          const response = data as unknown as GetBrokerageResponse;
          if (response.success && response.brokerage) {
            setBrokerageData(response.brokerage);
            setIsValid(true);
            setErrorMessage(null);
          } else {
            setErrorMessage(response.message || 'Corretora não encontrada');
            setIsValid(false);
          }
        }
      } catch (err) {
        console.error('Error in fetchBrokerage:', err);
        setErrorMessage('Erro ao carregar dados da corretora');
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBrokerage();
  }, [brokerageSlug]);

  return {
    brokerageSlug: brokerageSlug || '',
    brokerageName: brokerageData?.name || '',
    brokerageLogo: brokerageData?.logo_url || null,
    portalConfig: {
      show_policies: brokerageData?.show_policies ?? true,
      show_cards: brokerageData?.show_cards ?? true,
      allow_profile_edit: brokerageData?.allow_profile_edit ?? true,
    },
    isLoading,
    isValid,
    errorMessage,
  };
}
