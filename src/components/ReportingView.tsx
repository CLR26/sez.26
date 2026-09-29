import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { displayKpiMetric, loadKpiReport, type KpiReportRow } from '../lib/kpiReport';
import { CATEGORY_LABELS, CHANNEL_LABELS, formatInterval } from '../utils/formatters';
import type { CaseCategory, CaseChannel } from '../types/database';
import { AlertCircle, BarChart3, Calendar, Clock, Mail, MessageSquare, RefreshCw } from 'lucide-react';

const formatSeconds = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '—';
  const totalMinutes = Math.floor(Number(seconds) / 60);
  return formatInterval({ days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60 });
};

export const ReportingView: React.FC = () => {
  const [rows, setRows] = useState<KpiReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState(30);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await loadKpiReport(periodDays, isSupabaseConfigured, async (days) => {
      const { data, error: rpcError } = await supabase.rpc('kpi_report', { period_days: days });
      return { data: data as KpiReportRow[] | null, error: rpcError };
    });
    setRows(result.rows);
    setError(result.error);
    setLoading(false);
  }, [periodDays]);

  useEffect(() => { void fetchReport(); }, [fetchReport]);
  const total = rows.find((row) => row.dimension === 'all' && row.key === 'all');
  const byChannel = useMemo(() => rows.filter((row) => row.dimension === 'channel'), [rows]);
  const byCategory = useMemo(() => rows.filter((row) => row.dimension === 'category'), [rows]);
  const totalCases = (Number(total?.open_count) || 0) + (Number(total?.resolved_count) || 0);
  const resolutionRate = totalCases ? Math.round(((Number(total?.resolved_count) || 0) / totalCases) * 100) : 0;

  return <section style={{ flex: 1, minHeight: '100%', overflowY: 'auto', background: 'var(--bg-app)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
      <div><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><BarChart3 size={20} color="var(--teal-primary)" /><h1 style={{ fontSize: 20, fontWeight: 650 }}>Rapports & indicateurs</h1></div><p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 5 }}>Données en direct · dossiers actifs uniquement</p></div>
      <button className="button-secondary" onClick={() => void fetchReport()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser</button>
    </header>

    <div className="report-period-row"><span>Période des dossiers résolus</span><div className="period-switcher" role="group" aria-label="Période de reporting">{[7, 30, 90].map((days) => <button key={days} type="button" aria-pressed={periodDays === days} className={periodDays === days ? 'selected' : ''} onClick={() => setPeriodDays(days)}>{days} jours</button>)}</div></div>

    {error && <div role="alert" className="notice-box" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><AlertCircle size={16} /><span style={{ flex: 1 }}>{error}</span><button className="button-secondary" onClick={() => void fetchReport()}>Réessayer</button></div>}

    <div className="report-cards">
      <article className="report-card"><span>Dossiers ouverts actuellement</span><strong>{displayKpiMetric(Number(total?.open_count) || 0, loading, error)}</strong><small>{error ? 'Indicateur indisponible' : 'Tous les statuts actifs sauf résolu'}</small></article>
      <article className="report-card"><span>Résolus sur {periodDays} jours</span><strong>{displayKpiMetric(Number(total?.resolved_count) || 0, loading, error)}</strong><small>{error ? 'Indicateur indisponible' : 'Selon la période du rapport'}</small></article>
      <article className="report-card"><span>Temps moyen de résolution</span><strong>{displayKpiMetric(formatSeconds(total?.avg_resolution_seconds), loading, error)}</strong><small>{error ? 'Indicateur indisponible' : 'Calculé par PostgreSQL sur la période'}</small></article>
      <article className="report-card"><span>Taux de résolution sur la période</span><strong>{displayKpiMetric(`${resolutionRate}%`, loading, error)}</strong><small>{error ? 'Indicateur indisponible' : `${Number(total?.resolved_count) || 0} résolus sur ${totalCases} dossiers considérés`}</small></article>
    </div>

    <section className="report-panel"><h2>Résultats par canal</h2><div className="channel-report-grid">{(['whatsapp', 'email'] as CaseChannel[]).map((channel) => {
      const row = byChannel.find((item) => item.key === channel);
      return <article className="channel-report-card" key={channel}>{channel === 'whatsapp' ? <MessageSquare size={18} /> : <Mail size={18} />}<div><strong>{CHANNEL_LABELS[channel]}</strong><p>{error ? 'Indicateurs indisponibles' : `${Number(row?.resolved_count) || 0} résolus · ${Number(row?.open_count) || 0} ouverts · délai moyen ${formatSeconds(row?.avg_resolution_seconds)}`}</p></div></article>;
    })}</div></section>

    <section className="report-panel"><div className="report-panel-heading"><div><h2>Résultats par catégorie</h2><p>Dossiers résolus pendant les {periodDays} derniers jours et dossiers ouverts actuellement</p></div><Calendar size={18} /></div>
      <div className="report-table-scroll"><table><thead><tr><th>Catégorie</th><th>Dossiers ouverts</th><th>Résolus · {periodDays} j</th><th>Temps moyen</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={4} className="report-empty">Chargement des indicateurs…</td></tr> : byCategory.length === 0 ? <tr><td colSpan={4} className="report-empty">{error ? 'Les indicateurs sont indisponibles.' : 'Aucun résultat pour cette période.'}</td></tr> : byCategory.map((row) => <tr key={row.key}><td>{CATEGORY_LABELS[row.key as CaseCategory] || row.key}</td><td>{Number(row.open_count) || 0}</td><td>{Number(row.resolved_count) || 0}</td><td><Clock size={13} /> {formatSeconds(row.avg_resolution_seconds)}</td></tr>)}
      </tbody></table></div>
    </section>
  </section>;
};
