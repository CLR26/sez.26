import type { Case, CaseEvent } from '../types/database';

export type WorkView = 'mine' | 'all' | 'escalated' | 'resolved' | 'archived';

export const isPermanentlyDeletedCase = (item: Pick<Case, 'permanently_deleted_at'>): boolean =>
  Boolean(item.permanently_deleted_at);

export const getWorkViewCases = (
  allCases: Case[],
  view: WorkView,
  agentId: string,
  searchQuery = '',
): Case[] => {
  const available = allCases.filter((item) => !isPermanentlyDeletedCase(item));
  const inView = view === 'archived'
    ? available.filter((item) => Boolean(item.deleted_at))
    : available.filter((item) => {
      if (item.deleted_at) return false;
      if (view === 'mine') return item.owner_id === agentId;
      if (view === 'escalated') return item.status === 'escalated';
      if (view === 'resolved') return item.status === 'resolved';
      return true;
    });
  const query = searchQuery.trim().toLocaleLowerCase();
  if (!query) return inView;
  return inView.filter((item) =>
    [item.subject, item.customer_name, String(item.id)].some((value) => value.toLocaleLowerCase().includes(query)),
  );
};

export const sortEventsNewestFirst = <T extends Pick<CaseEvent, 'created_at' | 'id'>>(
  events: readonly T[],
): T[] => [...events].sort((left, right) =>
  Date.parse(right.created_at) - Date.parse(left.created_at) || right.id - left.id,
);
