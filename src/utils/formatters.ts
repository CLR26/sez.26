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

export function formatInterval(raw?: string | null | Record<string, unknown>): string {
  if (!raw) return '—';
  if (typeof raw === 'object') {
    const obj = raw as Record<string, number>;
    const parts: string[] = [];
    if (obj.days) parts.push(`${obj.days}j`);
    if (obj.hours) parts.push(`${obj.hours}h`);
    if (obj.minutes) parts.push(`${obj.minutes}min`);
    return parts.length > 0 ? parts.join(' ') : '< 1min';
  }
  const str = String(raw).trim();
  if (!str || str === '0' || str === '00:00:00') return '< 1min';

  let days = 0;
  const dayMatch = str.match(/(\d+)\s+days?/i);
  if (dayMatch) {
    days = parseInt(dayMatch[1], 10);
  }

  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
    return parts.join(' ');
  }

  const isoMatch = str.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3])) {
    const d = isoMatch[1] ? parseInt(isoMatch[1], 10) : 0;
    const h = isoMatch[2] ? parseInt(isoMatch[2], 10) : 0;
    const m = isoMatch[3] ? parseInt(isoMatch[3], 10) : 0;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}j`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || parts.length === 0) parts.push(`${m}min`);
    return parts.join(' ');
  }

  return str;
}
