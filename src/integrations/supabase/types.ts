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
          id: number
          logo_url: string | null
          name: string
          susep_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          cnpj?: string | null
          created_at?: string
          id?: never
          logo_url?: string | null
          name: string
          susep_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          cnpj?: string | null
          created_at?: string
          id?: never
          logo_url?: string | null
          name?: string
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
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
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
      batch_update_transactions: {
        Args: { p_user_id: string; updates: Json }
        Returns: string
      }
      check_upcoming_appointments: { Args: never; Returns: undefined }
      execute_sql: { Args: { query: string }; Returns: Json }
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
      get_orphan_transactions: { Args: { p_user_id: string }; Returns: Json }
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
      get_schema_info: { Args: never; Returns: Json }
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
      settle_due_commissions: { Args: never; Returns: string }
      settle_due_commissions_v2: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      validate_user_data_access: {
        Args: { target_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
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
      user_role: ["admin", "corretor", "assistente"],
    },
  },
} as const
