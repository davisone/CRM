import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NOUVEAU: "bg-gray-100 text-gray-800",
    A_CONTACTER: "bg-blue-100 text-blue-800",
    CONTACTE: "bg-yellow-100 text-yellow-800",
    INTERESSE: "bg-green-100 text-green-800",
    A_RELANCER: "bg-orange-100 text-orange-800",
    CLIENT: "bg-emerald-100 text-emerald-800",
    NON_INTERESSE: "bg-red-100 text-red-800",
    PERDU: "bg-red-200 text-red-900",
    NE_PLUS_CONTACTER: "bg-purple-100 text-purple-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NOUVEAU: "Nouveau",
    A_CONTACTER: "À contacter",
    CONTACTE: "Contacté",
    INTERESSE: "Intéressé",
    A_RELANCER: "À relancer",
    CLIENT: "Client",
    NON_INTERESSE: "Non intéressé",
    PERDU: "Perdu",
    NE_PLUS_CONTACTER: "Ne plus contacter",
  };
  return labels[status] || status;
}

export function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    1: "Hot",
    2: "Warm",
    3: "À contacter",
    4: "Low",
    5: "Skip",
  };
  return labels[priority] || "Unknown";
}

export function getPriorityColor(priority: number): string {
  const colors: Record<number, string> = {
    1: "bg-red-100 text-red-800",
    2: "bg-orange-100 text-orange-800",
    3: "bg-blue-100 text-blue-800",
    4: "bg-gray-100 text-gray-600",
    5: "bg-gray-50 text-gray-400",
  };
  return colors[priority] || "bg-gray-100 text-gray-800";
}

export function getActivityIcon(type: string): string {
  const icons: Record<string, string> = {
    APPEL: "phone",
    EMAIL: "mail",
    NOTE: "file-text",
    RELANCE: "clock",
    CHANGEMENT_STATUT: "arrow-right",
    ENRICHISSEMENT: "database",
  };
  return icons[type] || "circle";
}
