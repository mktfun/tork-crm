import { useSupabaseClients } from './useSupabaseClients';
import { useSupabasePolicies } from './useSupabasePolicies';
import { useSupabaseTransactions } from './useSupabaseTransactions';
import { useSupabaseAppointments } from './useSupabaseAppointments';
import { useSupabaseTasks } from './useSupabaseTasks';
import { useSupabaseTransactionTypes } from './useSupabaseTransactionTypes';
import { useSupabaseCompanies } from './useSupabaseCompanies';
import { useSupabaseCompanyBranches } from './useSupabaseCompanyBranches';
import { useSupabaseBrokerages } from './useSupabaseBrokerages';
import { useSupabaseProducers } from './useSupabaseProducers';

export function useClients() {
  const { clients, loading, refetch } = useSupabaseClients();
  
  return {
    clients,
    loading,
    error: null,
    refetch
  };
}

export function usePolicies() {
  const supabasePolicies = useSupabasePolicies();

  // Fallback para caso de erro
  const policies = supabasePolicies.policies || [];
  const loading = supabasePolicies.loading || false;

  return {
    policies,
    addPolicy: supabasePolicies.addPolicy,
    updatePolicy: supabasePolicies.updatePolicy,
    deletePolicy: supabasePolicies.deletePolicy,
    ativarEAnexarPdf: supabasePolicies.ativarEAnexarPdf,
    loading,
    isLoading: supabasePolicies.isLoading || false,
    isUpdatingPolicy: supabasePolicies.isUpdatingPolicy || false,
    error: null
  };
}

export function useAppointments() {
  const { 
    appointments, 
    upcomingAppointments,
    scheduleGaps,
    weeklyStats,
    loading, 
    addAppointment, 
    updateAppointment, 
    deleteAppointment 
  } = useSupabaseAppointments();
  
  return {
    appointments,
    upcomingAppointments,
    scheduleGaps,
    weeklyStats,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    loading,
    error: null
  };
}

export function useTasks() {
  const { tasks, loading, addTask, updateTask, deleteTask, updateTaskStatus } = useSupabaseTasks();
  
  return {
    tasks,
    addTask,
    updateTaskStatus,
    updateTask,
    deleteTask,
    loading,
    error: null
  };
}

export function useTransactions() {
  const { 
    transactions, 
    loading, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    addPartialPayment,
    getTransactionPayments,
    refetch
  } = useSupabaseTransactions();
  
  return {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addPartialPayment,
    getTransactionPayments,
    loading,
    error: null,
    refetch
  };
}

// Entidades de configuração - agora vêm do Supabase
export function useTransactionTypes() {
  const { 
    transactionTypes, 
    loading, 
    addTransactionType, 
    updateTransactionType, 
    deleteTransactionType,
    isAdding,
    isUpdating,
    isDeleting
  } = useSupabaseTransactionTypes();
  
  return {
    transactionTypes,
    addTransactionType,
    updateTransactionType,
    deleteTransactionType,
    loading,
    isAdding,
    isUpdating,
    isDeleting,
    error: null
  };
}

export function useCompanies() {
  const { 
    companies, 
    loading, 
    addCompany, 
    updateCompany, 
    deleteCompany,
    isAdding,
    isUpdating,
    isDeleting
  } = useSupabaseCompanies();
  
  return {
    companies,
    addCompany,
    updateCompany,
    deleteCompany,
    loading,
    isAdding,
    isUpdating,
    isDeleting,
    error: null
  };
}

export function useCompanyBranches() {
  const { 
    companyBranches, 
    loading, 
    addCompanyBranch, 
    updateCompanyBranch, 
    deleteCompanyBranch,
    isAdding,
    isUpdating,
    isDeleting
  } = useSupabaseCompanyBranches();
  
  return {
    companyBranches,
    addCompanyBranch,
    updateCompanyBranch,
    deleteCompanyBranch,
    loading,
    isAdding,
    isUpdating,
    isDeleting,
    error: null
  };
}

// Novas funções para o ecossistema de corretoras e produtores
export function useBrokerages() {
  const { 
    brokerages, 
    loading, 
    addBrokerage, 
    updateBrokerage, 
    deleteBrokerage,
    isAdding,
    isUpdating,
    isDeleting
  } = useSupabaseBrokerages();
  
  return {
    brokerages,
    addBrokerage,
    updateBrokerage,
    deleteBrokerage,
    loading,
    isAdding,
    isUpdating,
    isDeleting,
    error: null
  };
}

export function useProducers() {
  const { 
    producers, 
    loading, 
    addProducer, 
    updateProducer, 
    deleteProducer,
    isAdding,
    isUpdating,
    isDeleting
  } = useSupabaseProducers();
  
  return {
    producers,
    addProducer,
    updateProducer,
    deleteProducer,
    loading,
    isAdding,
    isUpdating,
    isDeleting,
    error: null
  };
}
