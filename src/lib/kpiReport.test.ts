import assert from 'node:assert/strict';
import test from 'node:test';
import { displayKpiMetric, loadKpiReport } from './kpiReport';

test('returns an unavailable result when the KPI RPC returns an error', async () => {
  const result = await loadKpiReport(30, true, async () => ({
    data: null,
    error: { message: 'RPC unavailable' },
  }));

  assert.deepEqual(result, { rows: [], error: 'RPC unavailable' });
  assert.equal(displayKpiMetric(12, false, result.error), '—');
  assert.equal(displayKpiMetric('12 min', false, result.error), '—');
  assert.equal(displayKpiMetric('12%', false, result.error), '—');
  assert.equal(displayKpiMetric(12, true, result.error), '…');
});

test('surfaces transport failures and supports retrying the same period', async () => {
  let attempts = 0;
  const request = async (periodDays: number) => {
    attempts += 1;
    assert.equal(periodDays, 7);
    if (attempts === 1) throw new Error('Network unavailable');
    return { data: [], error: null };
  };

  const firstAttempt = await loadKpiReport(7, true, request);
  const retry = await loadKpiReport(7, true, request);

  assert.deepEqual(firstAttempt, { rows: [], error: 'Network unavailable' });
  assert.deepEqual(retry, { rows: [], error: null });
  assert.equal(attempts, 2);
});

test('does not call the RPC when Supabase is not configured', async () => {
  let called = false;
  const result = await loadKpiReport(90, false, async () => {
    called = true;
    return { data: [], error: null };
  });

  assert.equal(called, false);
  assert.deepEqual(result, {
    rows: [],
    error: 'Supabase n’est pas configuré. Les indicateurs ne peuvent pas être chargés.',
  });
});

test('returns successful RPC rows unchanged', async () => {
  const rows = [{
    dimension: 'all' as const,
    key: 'all',
    open_count: 2,
    resolved_count: 1,
    avg_resolution_seconds: 45,
  }];

  const result = await loadKpiReport(30, true, async (periodDays) => {
    assert.equal(periodDays, 30);
    return { data: rows, error: null };
  });

  assert.deepEqual(result, { rows, error: null });
});
