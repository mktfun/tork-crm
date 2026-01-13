export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      apolices: {
        Row: {
          automatic_renewal: boolean
          bonus_class: string | null
          brokerage_id: number | null
          client_id: string
          commission_rate: number
          created_at: string
          expiration_date: string
          id: string
          installments: number | null
          insurance_company: string | null
          insured_asset: string | null
          pdf_attached_data: string | null
          pdf_attached_name: string | null
          pdf_url: string | null
          policy_number: string | null
          premium_value: number
          producer_id: string | null
          ramo_id: string | null
          renewal_status: string | null
          start_date: string | null
          status: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          automatic_renewal?: boolean
          bonus_class?: string | null
          brokerage_id?: number | null
          client_id: string
          commission_rate?: number
          created_at?: string
          expiration_date: string
          id?: string
          installments?: number | null
          insurance_company?: string | null
          insured_asset?: string | null
          pdf_attached_data?: string | null
          pdf_attached_name?: string | null
          pdf_url?: string | null
          policy_number?: string | null
          premium_value?: number
          producer_id?: string | null
          ramo_id?: string | null
          renewal_status?: string | null
          start_date?: string | null
          status?: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          automatic_renewal?: boolean
          bonus_class?: string | null
          brokerage_id?: number | null
          client_id?: string
          commission_rate?: number
          created_at?: string
          expiration_date?: string
          id?: string
          installments?: number | null
          insurance_company?: string | null
          insured_asset?: string | null
          pdf_attached_data?: string | null
          pdf_attached_name?: string | null
          pdf_url?: string | null
          policy_number?: string | null
          premium_value?: number
          producer_id?: string | null
          ramo_id?: string | null
          renewal_status?: string | null
          start_date?: string | null
          status?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apolices_brokerage_id_fkey"
            columns: ["brokerage_id"]
            isOneToOne: false
            referencedRelation: "brokerages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_insurance_company_fkey"
            columns: ["insurance_company"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_insurance_company_fkey"
            columns: ["insurance_company"]
            isOneToOne: false
            referencedRelation: "companies_with_ramos_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "ramos"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          original_start_timestamptz: string | null
          parent_appointment_id: string | null
          policy_id: string | null
          priority: string | null
          recurrence_rule: string | null
          status: string
          time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          original_start_timestamptz?: string | null
          parent_appointment_id?: string | null
          policy_id?: string | null
          priority?: string | null
          recurrence_rule?: string | null
          status?: string
          time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          original_start_timestamptz?: string | null
          parent_appointment_id?: string | null
          policy_id?: string | null
          priority?: string | null
          recurrence_rule?: string | null
          status?: string
          time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_parent_appointment_id_fkey"
            columns: ["parent_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_greetings: {
        Row: {
          client_id: string
          id: string
          sent_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          client_id: string
          id?: string
          sent_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          client_id?: string
          id?: string
          sent_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "birthday_greetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_greetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_greetings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brokerages: {
        Row: {
          api_key: string | null
          cnpj: string | null
          created_at: string
          financial_settings: Json | null
          id: number
          logo_url: string | null
          name: string
          portal_allow_card_download: boolean | null
          portal_allow_policy_download: boolean | null
          portal_allow_profile_edit: boolean | null
          portal_enabled: boolean | null
          portal_show_cards: boolean | null
          portal_show_policies: boolean | null
          slug: string
          susep_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          cnpj?: string | null
          created_at?: string
          financial_settings?: Json | null
          id?: never
          logo_url?: string | null
          name: string
          portal_allow_card_download?: boolean | null
          portal_allow_policy_download?: boolean | null
          portal_allow_profile_edit?: boolean | null
          portal_enabled?: boolean | null
          portal_show_cards?: boolean | null
          portal_show_policies?: boolean | null
          slug: string
          susep_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          cnpj?: string | null
          created_at?: string
          financial_settings?: Json | null
          id?: never
          logo_url?: string | null
          name?: string
          portal_allow_card_download?: boolean | null
          portal_allow_policy_download?: boolean | null
          portal_allow_profile_edit?: boolean | null
          portal_enabled?: boolean | null
          portal_show_cards?: boolean | null
          portal_show_policies?: boolean | null
          slug?: string
          susep_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      changelogs: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          is_published: boolean
          priority: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          is_published?: boolean
          priority?: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          priority?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          address: string | null
          birth_date: string | null
          cep: string | null
          chatwoot_contact_id: number | null
          chatwoot_synced_at: string | null
          city: string | null
          complement: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          id: string
          marital_status: string | null
          name: string
          neighborhood: string | null
          number: string | null
          observations: string | null
          phone: string
          portal_first_access: boolean | null
          portal_password: string | null
          profession: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          chatwoot_contact_id?: number | null
          chatwoot_synced_at?: string | null
          city?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          id?: string
          marital_status?: string | null
          name: string
          neighborhood?: string | null
          number?: string | null
          observations?: string | null
          phone: string
          portal_first_access?: boolean | null
          portal_password?: string | null
          profession?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          chatwoot_contact_id?: number | null
          chatwoot_synced_at?: string | null
          city?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          id?: string
          marital_status?: string | null
          name?: string
          neighborhood?: string | null
          number?: string | null
          observations?: string | null
          phone?: string
          portal_first_access?: boolean | null
          portal_password?: string | null
          profession?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          assistance_phone: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assistance_phone?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assistance_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_branches: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_with_ramos_count"
            referencedColumns: ["id"]
          },
        ]
      }
      company_ramos: {
        Row: {
          company_id: string
          created_at: string
          ramo_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ramo_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ramo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_ramos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_ramos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_with_ramos_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_ramos_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "ramos"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          chatwoot_conversation_id: number | null
          client_id: string | null
          created_at: string
          expected_close_date: string | null
          id: string
          last_sync_source: string | null
          notes: string | null
          position: number
          stage_id: string
          sync_token: string | null
          title: string
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          chatwoot_conversation_id?: number | null
          client_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          last_sync_source?: string | null
          notes?: string | null
          position?: number
          stage_id: string
          sync_token?: string | null
          title: string
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          chatwoot_conversation_id?: number | null
          client_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          last_sync_source?: string | null
          notes?: string | null
          position?: number
          stage_id?: string
          sync_token?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_settings: {
        Row: {
          chatwoot_account_id: string | null
          chatwoot_api_key: string | null
          chatwoot_url: string | null
          chatwoot_webhook_secret: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chatwoot_account_id?: string | null
          chatwoot_api_key?: string | null
          chatwoot_url?: string | null
          chatwoot_webhook_secret?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chatwoot_account_id?: string | null
          chatwoot_api_key?: string | null
          chatwoot_url?: string | null
          chatwoot_webhook_secret?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_stages: {
        Row: {
          chatwoot_label: string | null
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string | null
          position: number
          user_id: string
        }
        Insert: {
          chatwoot_label?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id?: string | null
          position?: number
          user_id: string
        }
        Update: {
          chatwoot_label?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string | null
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          apolices_novas: number
          apolices_perdidas: number
          auto_value: number
          consorcio_value: number
          created_at: string
          date: string
          empresarial_value: number
          error_message: string | null
          id: string
          outros_value: number
          renovacoes: number
          residencial_value: number
          saude_value: number
          sync_status: string
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apolices_novas?: number
          apolices_perdidas?: number
          auto_value?: number
          consorcio_value?: number
          created_at?: string
          date: string
          empresarial_value?: number
          error_message?: string | null
          id?: string
          outros_value?: number
          renovacoes?: number
          residencial_value?: number
          saude_value?: number
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apolices_novas?: number
          apolices_perdidas?: number
          auto_value?: number
          consorcio_value?: number
          created_at?: string
          date?: string
          empresarial_value?: number
          error_message?: string | null
          id?: string
          outros_value?: number
          renovacoes?: number
          residencial_value?: number
          saude_value?: number
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_correction_audit: {
        Row: {
          corrected_at: string
          correction_type: string
          id: string
          migration_context: string | null
          new_user_id: string | null
          old_user_id: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          corrected_at?: string
          correction_type: string
          id?: string
          migration_context?: string | null
          new_user_id?: string | null
          old_user_id?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          corrected_at?: string
          correction_type?: string
          id?: string
          migration_context?: string | null
          new_user_id?: string | null
          old_user_id?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id: number
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          parent_id: string | null
          status: Database["public"]["Enums"]["financial_account_status"]
          type: Database["public"]["Enums"]["financial_account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["financial_account_status"]
          type: Database["public"]["Enums"]["financial_account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["financial_account_status"]
          type?: Database["public"]["Enums"]["financial_account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          memo: string | null
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          memo?: string | null
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          memo?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_recurring_configs: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          day_of_month: number | null
          description: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean | null
          last_generated_date: string | null
          name: string
          nature: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          name: string
          nature: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          name?: string
          nature?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_recurring_configs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_recurring_configs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          attachments: string[] | null
          created_at: string
          created_by: string
          description: string
          id: string
          is_void: boolean | null
          reference_number: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          status: string | null
          transaction_date: string
          user_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          is_void?: boolean | null
          reference_number?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          transaction_date?: string
          user_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          attachments?: string[] | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_void?: boolean | null
          reference_number?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          transaction_date?: string
          user_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      migration_ramos_log: {
        Row: {
          created_at: string | null
          id: string
          new_ramo_id: string
          normalized_name: string
          old_type_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_ramo_id: string
          normalized_name: string
          old_type_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          new_ramo_id?: string
          normalized_name?: string
          old_type_value?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      producers: {
        Row: {
          brokerage_id: number
          company_name: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brokerage_id: number
          company_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brokerage_id?: number
          company_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producers_brokerage_id_fkey"
            columns: ["brokerage_id"]
            isOneToOne: false
            referencedRelation: "brokerages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          birthday_message_template: string | null
          commission_settlement_days: number
          commission_settlement_installments: number
          commission_settlement_strategy: string
          created_at: string
          email: string
          id: string
          nome_completo: string
          onboarding_completed: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          settle_commissions_automatically: boolean
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          birthday_message_template?: string | null
          commission_settlement_days?: number
          commission_settlement_installments?: number
          commission_settlement_strategy?: string
          created_at?: string
          email: string
          id: string
          nome_completo: string
          onboarding_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          settle_commissions_automatically?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          birthday_message_template?: string | null
          commission_settlement_days?: number
          commission_settlement_installments?: number
          commission_settlement_strategy?: string
          created_at?: string
          email?: string
          id?: string
          nome_completo?: string
          onboarding_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          settle_commissions_automatically?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ramos: {
        Row: {
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action_type: string
          attempted_access: Json | null
          created_at: string | null
          id: string
          ip_address: unknown
          record_id: string | null
          severity: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          attempted_access?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          record_id?: string | null
          severity?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          attempted_access?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          record_id?: string | null
          severity?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sheets_sync_logs: {
        Row: {
          created_at: string
          execution_time_ms: number | null
          id: string
          message: string | null
          status: string
          sync_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          message?: string | null
          status: string
          sync_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          execution_time_ms?: number | null
          id?: string
          message?: string | null
          status?: string
          sync_date?: string
          user_id?: string
        }
        Relationships: []
      }
      sinistro_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          new_values: Json | null
          old_values: Json | null
          sinistro_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          sinistro_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          sinistro_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_activities_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_activities_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_required: boolean | null
          is_validated: boolean | null
          mime_type: string | null
          sinistro_id: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_required?: boolean | null
          is_validated?: boolean | null
          mime_type?: string | null
          sinistro_id: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_required?: boolean | null
          is_validated?: boolean | null
          mime_type?: string | null
          sinistro_id?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_documents_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_documents_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistros: {
        Row: {
          analysis_deadline: string | null
          approved_amount: number | null
          assigned_to: string | null
          brokerage_id: number | null
          circumstances: string | null
          claim_amount: number | null
          claim_number: string | null
          claim_type: string
          client_id: string | null
          created_at: string
          deductible_amount: number | null
          description: string
          documents_checklist: Json | null
          evidence_urls: string[] | null
          id: string
          location_occurrence: string | null
          occurrence_date: string
          payment_date: string | null
          police_report_number: string | null
          policy_id: string | null
          priority: string | null
          producer_id: string | null
          report_date: string
          resolution_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_deadline?: string | null
          approved_amount?: number | null
          assigned_to?: string | null
          brokerage_id?: number | null
          circumstances?: string | null
          claim_amount?: number | null
          claim_number?: string | null
          claim_type: string
          client_id?: string | null
          created_at?: string
          deductible_amount?: number | null
          description: string
          documents_checklist?: Json | null
          evidence_urls?: string[] | null
          id?: string
          location_occurrence?: string | null
          occurrence_date: string
          payment_date?: string | null
          police_report_number?: string | null
          policy_id?: string | null
          priority?: string | null
          producer_id?: string | null
          report_date?: string
          resolution_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_deadline?: string | null
          approved_amount?: number | null
          assigned_to?: string | null
          brokerage_id?: number | null
          circumstances?: string | null
          claim_amount?: number | null
          claim_number?: string | null
          claim_type?: string
          client_id?: string | null
          created_at?: string
          deductible_amount?: number | null
          description?: string
          documents_checklist?: Json | null
          evidence_urls?: string[] | null
          id?: string
          location_occurrence?: string | null
          occurrence_date?: string
          payment_date?: string | null
          police_report_number?: string | null
          policy_id?: string | null
          priority?: string | null
          producer_id?: string | null
          report_date?: string
          resolution_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_brokerage_id_fkey"
            columns: ["brokerage_id"]
            isOneToOne: false
            referencedRelation: "brokerages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          policy_id: string | null
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          policy_id?: string | null
          priority: string
          status?: string
          task_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          policy_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payments: {
        Row: {
          amount_paid: number
          created_at: string
          description: string | null
          id: string
          payment_date: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          description?: string | null
          id?: string
          payment_date?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          description?: string | null
          id?: string
          payment_date?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_types: {
        Row: {
          created_at: string
          id: string
          name: string
          nature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          nature: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          nature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          brokerage_id: number | null
          client_id: string | null
          company_id: string | null
          created_at: string
          date: string
          description: string
          due_date: string
          id: string
          nature: string
          paid_date: string | null
          policy_id: string | null
          producer_id: string | null
          ramo_id: string | null
          status: string
          transaction_date: string
          type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          brokerage_id?: number | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          date: string
          description: string
          due_date: string
          id?: string
          nature: string
          paid_date?: string | null
          policy_id?: string | null
          producer_id?: string | null
          ramo_id?: string | null
          status: string
          transaction_date: string
          type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          brokerage_id?: number | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string
          due_date?: string
          id?: string
          nature?: string
          paid_date?: string | null
          policy_id?: string | null
          producer_id?: string | null
          ramo_id?: string | null
          status?: string
          transaction_date?: string
          type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_brokerage_id_fkey"
            columns: ["brokerage_id"]
            isOneToOne: false
            referencedRelation: "brokerages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "ramos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_changelog_views: {
        Row: {
          changelog_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          changelog_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          changelog_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_changelog_views_changelog_id_fkey"
            columns: ["changelog_id"]
            isOneToOne: false
            referencedRelation: "changelogs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      clients_with_stats: {
        Row: {
          active_policies: number | null
          budget_policies: number | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          phone: string | null
          status: string | null
          total_commission: number | null
          total_policies: number | null
          total_premium: number | null
          user_id: string | null
        }
        Relationships: []
      }
      companies_with_ramos_count: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          ramos_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      financial_account_balances: {
        Row: {
          balance: number | null
          code: string | null
          created_at: string | null
          description: string | null
          entry_count: number | null
          id: string | null
          is_system: boolean | null
          name: string | null
          parent_id: string | null
          status: Database["public"]["Enums"]["financial_account_status"] | null
          type: Database["public"]["Enums"]["financial_account_type"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_dre_view: {
        Row: {
          account_type:
            | Database["public"]["Enums"]["financial_account_type"]
            | null
          category: string | null
          month: number | null
          period: string | null
          total_amount: number | null
          user_id: string | null
          year: number | null
        }
        Relationships: []
      }
      sinistros_complete: {
        Row: {
          analysis_deadline: string | null
          approved_amount: number | null
          assigned_to: string | null
          brokerage_id: number | null
          brokerage_name: string | null
          circumstances: string | null
          claim_amount: number | null
          claim_number: string | null
          claim_type: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          company_name: string | null
          created_at: string | null
          deductible_amount: number | null
          description: string | null
          documents_checklist: Json | null
          evidence_urls: string[] | null
          id: string | null
          insurance_company: string | null
          location_occurrence: string | null
          occurrence_date: string | null
          payment_date: string | null
          police_report_number: string | null
          policy_id: string | null
          policy_number: string | null
          priority: string | null
          producer_id: string | null
          producer_name: string | null
          report_date: string | null
          resolution_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apolices_insurance_company_fkey"
            columns: ["insurance_company"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_insurance_company_fkey"
            columns: ["insurance_company"]
            isOneToOne: false
            referencedRelation: "companies_with_ramos_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_brokerage_id_fkey"
            columns: ["brokerage_id"]
            isOneToOne: false
            referencedRelation: "brokerages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_list_functions: {
        Args: never
        Returns: {
          function_name: string
          function_schema: string
          function_type: string
        }[]
      }
      admin_list_log_tables: {
        Args: never
        Returns: {
          schemaname: string
          tablename: string
        }[]
      }
      admin_list_schemas: {
        Args: never
        Returns: {
          schema_name: string
        }[]
      }
      admin_list_tables: {
        Args: never
        Returns: {
          schemaname: string
          tablename: string
        }[]
      }
      admin_list_triggers: {
        Args: never
        Returns: {
          action_timing: string
          event_manipulation: string
          event_object_table: string
          trigger_name: string
        }[]
      }
      archive_financial_account: {
        Args: { p_account_id: string }
        Returns: boolean
      }
      audit_financial_divergence: { Args: never; Returns: Json }
      audit_ledger_integrity: {
        Args: never
        Returns: {
          account_id: string
          amount: number
          description: string
          issue_type: string
          transaction_id: string
        }[]
      }
      backfill_legacy_transactions: { Args: never; Returns: Json }
      batch_update_transactions: {
        Args: { p_user_id: string; updates: Json }
        Returns: string
      }
      bulk_confirm_receipts: {
        Args: { p_transaction_ids: string[] }
        Returns: Json
      }
      bulk_create_financial_movements: {
        Args: { p_transactions: Json }
        Returns: Json
      }
      check_upcoming_appointments: { Args: never; Returns: undefined }
      count_ledger_entries_by_account: {
        Args: { p_account_id: string }
        Returns: number
      }
      count_pending_legacy_transactions: { Args: never; Returns: number }
      count_problematic_descriptions: { Args: never; Returns: number }
      count_wrong_backfill_dates: { Args: never; Returns: number }
      create_financial_movement: {
        Args: {
          p_description: string
          p_movements: Json
          p_reference_number?: string
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_transaction_date: string
        }
        Returns: string
      }
      delete_financial_account_safe: {
        Args: { p_migrate_to_account_id?: string; p_target_account_id: string }
        Returns: Json
      }
      diagnose_ledger_gaps: { Args: never; Returns: Json }
      diagnose_ledger_health: { Args: never; Returns: Json }
      ensure_default_financial_accounts: { Args: never; Returns: undefined }
      execute_sql: { Args: { query: string }; Returns: Json }
      find_unbalanced_transactions: {
        Args: never
        Returns: {
          description: string
          entry_count: number
          total_amount: number
          transaction_date: string
          transaction_id: string
        }[]
      }
      fix_backfill_dates: { Args: never; Returns: Json }
      fix_ledger_descriptions: { Args: never; Returns: Json }
      generate_recurring_dates: {
        Args: {
          p_config_end_date: string
          p_config_start_date: string
          p_day_of_month: number
          p_end_date: string
          p_frequency: string
          p_start_date: string
        }
        Returns: {
          occurrence_date: string
        }[]
      }
      get_account_balances: {
        Args: never
        Returns: {
          balance: number
          code: string
          id: string
          name: string
          type: string
        }[]
      }
      get_account_balances_from_date: {
        Args: { p_start_date?: string }
        Returns: {
          balance: number
          code: string
          id: string
          name: string
          type: string
        }[]
      }
      get_account_statement: {
        Args: {
          p_account_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          amount: number
          description: string
          is_reversal: boolean
          memo: string
          running_balance: number
          transaction_date: string
          transaction_id: string
        }[]
      }
      get_brokerage_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_cash_flow_data: {
        Args: {
          p_end_date: string
          p_granularity?: string
          p_start_date: string
        }
        Returns: {
          balance: number
          expense: number
          income: number
          period: string
        }[]
      }
      get_cash_flow_with_projection: {
        Args: {
          p_end_date: string
          p_granularity?: string
          p_start_date: string
        }
        Returns: Json
      }
      get_client_kpis: {
        Args: { p_search_term?: string; p_status?: string; p_user_id: string }
        Returns: Json
      }
      get_clientes_filtrados: {
        Args: {
          p_ramo?: string
          p_search_term?: string
          p_seguradora_id?: string
          p_user_id: string
        }
        Returns: {
          address: string | null
          birth_date: string | null
          cep: string | null
          chatwoot_contact_id: number | null
          chatwoot_synced_at: string | null
          city: string | null
          complement: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          id: string
          marital_status: string | null
          name: string
          neighborhood: string | null
          number: string | null
          observations: string | null
          phone: string
          portal_first_access: boolean | null
          portal_password: string | null
          profession: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_clients_with_stats: {
        Args: never
        Returns: {
          active_policies: number | null
          budget_policies: number | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          phone: string | null
          status: string | null
          total_commission: number | null
          total_policies: number | null
          total_premium: number | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clients_with_stats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_dashboard_financial_kpis: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_dre_data: {
        Args: { p_year?: number }
        Returns: {
          abr: number
          account_type: string
          ago: number
          category: string
          dez: number
          fev: number
          jan: number
          jul: number
          jun: number
          mai: number
          mar: number
          nov: number
          out: number
          set: number
          total: number
        }[]
      }
      get_empresas_com_metricas: {
        Args: { p_corretora_id: string }
        Returns: {
          custo_mensal_total: number
          email: string
          id: string
          nome: string
          responsavel: string
          telefone: string
          total_cnpjs: number
          total_funcionarios: number
          total_funcionarios_ativos: number
        }[]
      }
      get_faturamento_data: {
        Args: {
          p_client_id?: string
          p_company_id?: string
          p_end_date: string
          p_page?: number
          p_page_size?: number
          p_start_date: string
          p_timezone?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_financial_accounts_by_type: {
        Args: { p_type: string }
        Returns: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          parent_id: string | null
          status: Database["public"]["Enums"]["financial_account_status"]
          type: Database["public"]["Enums"]["financial_account_type"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "financial_accounts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_financial_summary: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_monthly_commission_chart: {
        Args: { p_months?: number }
        Returns: {
          confirmed_amount: number
          month_date: string
          month_label: string
          pending_amount: number
        }[]
      }
      get_or_create_ledger_sync_accounts: {
        Args: { p_user_id: string }
        Returns: {
          bank_account_id: string
          revenue_account_id: string
        }[]
      }
      get_orphan_transactions: { Args: { p_user_id: string }; Returns: Json }
      get_pending_receivables_from_date: {
        Args: { p_start_date?: string }
        Returns: {
          pending_count: number
          total_amount: number
        }[]
      }
      get_pending_this_month: {
        Args: never
        Returns: {
          pending_count: number
          total_amount: number
        }[]
      }
      get_pending_totals: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_portal_cards_hybrid: {
        Args: {
          p_client_id: string
          p_cpf?: string
          p_email?: string
          p_user_id: string
        }
        Returns: {
          expiration_date: string
          id: string
          insurance_company: string
          insured_asset: string
          policy_number: string
          start_date: string
          status: string
          type: string
        }[]
      }
      get_portal_policies_hybrid: {
        Args: {
          p_client_id: string
          p_cpf?: string
          p_email?: string
          p_user_id: string
        }
        Returns: {
          expiration_date: string
          id: string
          insurance_company: string
          insured_asset: string
          pdf_attached_data: string
          pdf_attached_name: string
          pdf_url: string
          policy_number: string
          premium_value: number
          start_date: string
          status: string
          type: string
        }[]
      }
      get_producao_por_ramo: {
        Args: { end_range: string; p_user_id: string; start_range: string }
        Returns: {
          ramo_nome: string
          taxa_media_comissao: number
          total_apolices: number
          total_comissao: number
          total_premio: number
        }[]
      }
      get_projected_cashflow: {
        Args: {
          p_end_date: string
          p_granularity?: string
          p_start_date: string
        }
        Returns: {
          period: string
          period_date: string
          projected_expense: number
          projected_income: number
          realized_expense: number
          realized_income: number
          running_balance: number
        }[]
      }
      get_recent_financial_transactions: {
        Args: { p_limit?: number; p_offset?: number; p_type?: string }
        Returns: {
          account_names: string
          created_at: string
          description: string
          id: string
          is_void: boolean
          reference_number: string
          status: string
          total_amount: number
          transaction_date: string
        }[]
      }
      get_revenue_totals: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          financial_total: number
          legacy_total: number
        }[]
      }
      get_revenue_transactions: {
        Args: { p_end_date?: string; p_limit?: number; p_start_date?: string }
        Returns: {
          account_name: string
          amount: number
          client_name: string
          description: string
          id: string
          is_confirmed: boolean
          legacy_status: string
          policy_number: string
          related_entity_id: string
          related_entity_type: string
          transaction_date: string
        }[]
      }
      get_schema_info: { Args: never; Returns: Json }
      get_total_pending_receivables: {
        Args: never
        Returns: {
          pending_count: number
          total_amount: number
        }[]
      }
      get_transaction_details:
        | { Args: { p_transaction_id: string }; Returns: Json }
        | {
            Args: { p_legacy_id?: string; p_transaction_id?: string }
            Returns: Json
          }
      get_user_companies_with_ramos: {
        Args: never
        Returns: {
          created_at: string | null
          id: string | null
          name: string | null
          ramos_count: number | null
          updated_at: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "companies_with_ramos_count"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_dre_data: {
        Args: never
        Returns: {
          account_type:
            | Database["public"]["Enums"]["financial_account_type"]
            | null
          category: string | null
          month: number | null
          period: string | null
          total_amount: number | null
          user_id: string | null
          year: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "financial_dre_view"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_financial_settings: { Args: never; Returns: Json }
      get_user_role: { Args: { user_id: string }; Returns: string }
      get_user_sinistros_complete: {
        Args: never
        Returns: {
          analysis_deadline: string | null
          approved_amount: number | null
          assigned_to: string | null
          brokerage_id: number | null
          brokerage_name: string | null
          circumstances: string | null
          claim_amount: number | null
          claim_number: string | null
          claim_type: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          company_name: string | null
          created_at: string | null
          deductible_amount: number | null
          description: string | null
          documents_checklist: Json | null
          evidence_urls: string[] | null
          id: string | null
          insurance_company: string | null
          location_occurrence: string | null
          occurrence_date: string | null
          payment_date: string | null
          police_report_number: string | null
          policy_id: string | null
          policy_number: string | null
          priority: string | null
          producer_id: string | null
          producer_name: string | null
          report_date: string | null
          resolution_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "sinistros_complete"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: { user_id?: string }; Returns: boolean }
      link_manual_transactions: { Args: { p_user_id: string }; Returns: string }
      merge_duplicate_clients: { Args: { p_user_id: string }; Returns: Json }
      migrate_missing_transactions: { Args: never; Returns: Json }
      preview_apolices_filtradas: {
        Args: { p_ramo?: string; p_seguradora_id?: string; p_user_id: string }
        Returns: {
          client_name: string
          expiration_date: string
          id: string
          insurance_company: string
          insurance_company_name: string
          policy_number: string
          premium_value: number
          status: string
          total_records: number
          type: string
        }[]
      }
      preview_clientes_filtrados: {
        Args: { p_ramo?: string; p_seguradora_id?: string; p_user_id: string }
        Returns: {
          email: string
          id: string
          nome: string
          phone: string
          total_records: number
        }[]
      }
      promote_user_to_admin: { Args: { user_email: string }; Returns: boolean }
      register_policy_commission:
        | {
            Args: {
              p_client_name?: string
              p_commission_amount?: number
              p_policy_id: string
              p_policy_number?: string
              p_ramo_name?: string
              p_status?: string
              p_transaction_date?: string
            }
            Returns: {
              reference_number: string
              success: boolean
              transaction_id: string
            }[]
          }
        | {
            Args: {
              p_client_name: string
              p_commission_amount: number
              p_company_name?: string
              p_policy_id: string
              p_policy_number: string
              p_ramo_name: string
            }
            Returns: Json
          }
      sanitize_orphan_transactions: {
        Args: never
        Returns: {
          action_taken: string
          description: string
          transaction_id: string
        }[]
      }
      settle_commission_transaction: {
        Args: {
          p_bank_account_id: string
          p_settlement_date?: string
          p_transaction_id: string
        }
        Returns: Json
      }
      settle_due_commissions: { Args: never; Returns: string }
      settle_due_commissions_v2: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_financial_account: {
        Args: {
          p_account_id: string
          p_code?: string
          p_description?: string
          p_name: string
        }
        Returns: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          parent_id: string | null
          status: Database["public"]["Enums"]["financial_account_status"]
          type: Database["public"]["Enums"]["financial_account_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_portal_profile: {
        Args: {
          p_client_id: string
          p_new_data?: Json
          p_new_password?: string
          p_verify_password: string
        }
        Returns: Json
      }
      validate_financial_transaction: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
      validate_user_data_access: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      verify_portal_login: {
        Args: { p_identifier: string; p_password: string }
        Returns: Json
      }
      verify_portal_login_scoped: {
        Args: {
          p_brokerage_slug: string
          p_identifier: string
          p_password: string
        }
        Returns: Json
      }
      void_financial_transaction: {
        Args: { p_reason?: string; p_transaction_id: string }
        Returns: Json
      }
    }
    Enums: {
      financial_account_status: "active" | "archived"
      financial_account_type:
        | "asset"
        | "liability"
        | "equity"
        | "revenue"
        | "expense"
      user_role: "admin" | "corretor" | "assistente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      financial_account_status: ["active", "archived"],
      financial_account_type: [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
      ],
      user_role: ["admin", "corretor", "assistente"],
    },
  },
} as const
