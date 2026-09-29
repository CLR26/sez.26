export interface KpiReportRow {
  dimension: 'all' | 'channel' | 'category';
  key: string;
  open_count: number;
  resolved_count: number;
  avg_resolution_seconds: number | null;
}

export interface KpiReportResult {
  rows: KpiReportRow[];
  error: string | null;
}

export const displayKpiMetric = (
  value: string | number,
  loading: boolean,
  error: string | null,
): string | number => (loading ? '…' : error ? '—' : value);

type KpiReportRequest = (periodDays: number) => Promise<{
  data: KpiReportRow[] | null;
  error: unknown | null;
}>;

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Erreur lors du chargement du rapport KPI.';
};

export const loadKpiReport = async (
  periodDays: number,
  isConfigured: boolean,
  request: KpiReportRequest,
): Promise<KpiReportResult> => {
  if (!isConfigured) {
    return { rows: [], error: 'Supabase n’est pas configuré. Les indicateurs ne peuvent pas être chargés.' };
  }

  try {
    const { data, error } = await request(periodDays);
    if (error) return { rows: [], error: messageFromError(error) };
    return { rows: data || [], error: null };
  } catch (error) {
    return { rows: [], error: messageFromError(error) };
  }
};
