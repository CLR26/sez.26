import assert from 'node:assert/strict';
import test from 'node:test';
import type { Case, CaseEvent } from '../types/database';
import { getWorkViewCases, sortEventsNewestFirst } from './caseWorkflow';

const createCase = (overrides: Partial<Case> = {}): Case => ({
  id: 1,
  subject: 'Dossier',
  customer_name: 'Client',
  customer_contact: null,
  channel: 'email',
  category: 'other',
  status: 'new',
  owner_id: 'agent-1',
  assigned_team: null,
  created_at: '2026-09-29T12:00:00.000Z',
  resolved_at: null,
  ...overrides,
});

test('permanently deleted cases are excluded from active, archived and searched views', () => {
  const visible = createCase({ id: 1, subject: 'Visible record' });
  const archived = createCase({ id: 2, deleted_at: '2026-09-28T12:00:00.000Z' });
  const tombstoned = createCase({ id: 3, subject: 'Needle hidden', permanently_deleted_at: '2026-09-29T13:00:00.000Z' });
  const cases = [visible, archived, tombstoned];

  assert.deepEqual(getWorkViewCases(cases, 'all', 'agent-1').map((item) => item.id), [1]);
  assert.deepEqual(getWorkViewCases(cases, 'archived', 'agent-1').map((item) => item.id), [2]);
  assert.deepEqual(getWorkViewCases(cases, 'all', 'agent-1', 'Needle'), []);
});

test('journal ordering is newest first, including stable descending id order for equal timestamps', () => {
  const events: CaseEvent[] = [
    { id: 3, case_id: 1, author_id: 'agent-1', kind: 'note', channel: null, body: 'older', created_at: '2026-09-28T10:00:00Z' },
    { id: 4, case_id: 1, author_id: 'agent-1', kind: 'status_change', channel: null, body: 'same timestamp lower id', created_at: '2026-09-29T10:00:00Z' },
    { id: 5, case_id: 1, author_id: 'agent-1', kind: 'escalation', channel: null, body: 'newest', created_at: '2026-09-30T10:00:00Z' },
    { id: 6, case_id: 1, author_id: 'agent-1', kind: 'customer_update', channel: 'email', body: 'same timestamp higher id', created_at: '2026-09-29T10:00:00Z' },
  ];

  assert.deepEqual(sortEventsNewestFirst(events).map((event) => event.id), [5, 6, 4, 3]);
  assert.deepEqual(events.map((event) => event.id), [3, 4, 5, 6]);
});
