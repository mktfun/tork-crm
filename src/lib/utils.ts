import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Faz parse de uma data no formato YYYY-MM-DD ou ISO sem problemas de timezone.
 * Evita o bug do "dia anterior" causado por UTC shift.
 */
export const parseDateOnly = (dateStr: string | null | undefined): Date | undefined => {
  if (!dateStr) return undefined;
  // Se vier como ISO (2023-10-25T00:00:00), pega só a parte da data
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [year, month, day] = cleanDate.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return undefined;
  // Cria data local (ano, mes-1, dia) para evitar UTC shift
  return new Date(year, month - 1, day);
};
