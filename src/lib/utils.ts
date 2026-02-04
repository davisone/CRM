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
    NOUVEAU: "bg-neutral-800 text-neutral-300",
    A_CONTACTER: "bg-blue-900/40 text-blue-400",
    CONTACTE: "bg-yellow-900/40 text-yellow-400",
    INTERESSE: "bg-green-900/40 text-green-400",
    A_RELANCER: "bg-orange-900/40 text-orange-400",
    CLIENT: "bg-emerald-900/40 text-emerald-400",
    NON_INTERESSE: "bg-red-900/40 text-red-400",
    PERDU: "bg-red-950/50 text-red-500",
    NE_PLUS_CONTACTER: "bg-purple-900/40 text-purple-400",
  };
  return colors[status] || "bg-neutral-800 text-neutral-300";
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
    1: "bg-red-900/40 text-red-400",
    2: "bg-orange-900/40 text-orange-400",
    3: "bg-blue-900/40 text-blue-400",
    4: "bg-neutral-800 text-neutral-500",
    5: "bg-neutral-800/50 text-neutral-600",
  };
  return colors[priority] || "bg-neutral-800 text-neutral-300";
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
