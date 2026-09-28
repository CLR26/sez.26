import type { CaseCategory, CaseChannel, CaseStatus, CaseTeam, EventKind } from '../types/database';

export const STATUS_LABELS: Record<CaseStatus, string> = {
  new: 'Nouveau',
  in_progress: 'En cours',
  escalated: 'Escaladé',
  resolved: 'Résolu',
};

export const CHANNEL_LABELS: Record<CaseChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
};

export const CATEGORY_LABELS: Record<CaseCategory, string> = {
  customs: 'Dédouanement',
  delivery: 'Livraison',
  billing: 'Facturation',
  account: 'Compte client',
  other: 'Autre',
};

export const TEAM_LABELS: Record<CaseTeam, string> = {
  mada_ops: 'Ops Madagascar',
  sez_ops: 'Ops Seychelles',
};

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  note: 'Note interne',
  customer_update: 'Échange client',
  escalation: 'Escalade',
  status_change: 'Statut mis à jour',
};

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatRelativeDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.round(diffMs / (1000 * 60));
    const diffHrs = Math.round(diffMin / 60);
    const diffDays = Math.round(diffHrs / 24);

    if (diffMin < 2) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHrs < 24) return `Il y a ${diffHrs} h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return isoString;
  }
}
