export type CaseChannel = 'whatsapp' | 'email';
export type CaseStatus = 'new' | 'in_progress' | 'escalated' | 'resolved';
export type CaseCategory = 'customs' | 'delivery' | 'billing' | 'account' | 'other';
export type CaseTeam = 'mada_ops' | 'sez_ops';
export type EventKind = 'note' | 'customer_update' | 'escalation' | 'status_change';

export interface Agent {
  id: string;
  full_name: string;
  team: string;
  active: boolean;
}

export interface Case {
  id: number;
  subject: string;
  customer_name: string;
  customer_contact: string | null;
  channel: CaseChannel;
  category: CaseCategory;
  status: CaseStatus;
  owner_id: string;
  assigned_team: CaseTeam | null;
  created_at: string;
  resolved_at: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface CaseEvent {
  id: number;
  case_id: number;
  author_id: string;
  kind: EventKind;
  channel: CaseChannel | null;
  body: string;
  created_at: string;
}
