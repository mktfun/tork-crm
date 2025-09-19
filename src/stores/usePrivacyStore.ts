import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PrivacyState {
  showValues: boolean;
  toggleShowValues: () => void;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      showValues: true, // Padrão: mostrar valores
      toggleShowValues: () => set((state) => ({ showValues: !state.showValues })),
    }),
    {
      name: 'privacy-storage', // Nome da chave no localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);