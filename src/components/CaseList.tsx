import React from 'react';
import type { Case } from '../types/database';
import {
  STATUS_LABELS,
  CHANNEL_LABELS,
  CATEGORY_LABELS,
  formatRelativeDate,
} from '../utils/formatters';
import {
  MessageSquare,
  Mail,
  AlertCircle,
  RefreshCw,
  Search,
  Inbox,
  Filter,
} from 'lucide-react';

interface CaseListProps {
  cases: Case[];
  selectedCaseId: number | null;
  onSelectCase: (caseItem: Case) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const CaseList: React.FC<CaseListProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  loading,
  error,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const filteredCases = React.useMemo(() => {
    return cases.filter((c) => {
      const matchSearch =
        !searchQuery.trim() ||
        c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toString().includes(searchQuery);

      const matchStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [cases, searchQuery, statusFilter]);

  return (
    <aside
      style={{
        width: '340px',
        minWidth: '340px',
        maxWidth: '340px',
        borderRight: '0.5px solid var(--border-color)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* List Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              Dossiers
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                background: 'var(--bg-subtle)',
                borderRadius: '10px',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              {cases.length}
            </span>
          </div>

          <button
            onClick={onRetry}
            disabled={loading}
            title="Actualiser la liste"
            style={{
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Rechercher par sujet, client ou #ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px 6px 30px',
              fontSize: '12px',
              border: '0.5px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-subtle)',
              outline: 'none',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Status quick filter */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: 'Tous' },
            { id: 'new', label: 'Nouveaux' },
            { id: 'in_progress', label: 'En cours' },
            { id: 'escalated', label: 'Escaladés' },
            { id: 'resolved', label: 'Résolus' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: statusFilter === tab.id ? 'var(--teal-primary)' : 'var(--bg-subtle)',
                color: statusFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: statusFilter === tab.id ? 500 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Case List Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Loading state */}
        {loading && cases.length === 0 && (
          <div className="state-container" style={{ padding: '32px 16px' }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--teal-primary)' }} />
            <span>Chargement des dossiers...</span>
          </div>
        )}

        {/* Error state */}
        {error && cases.length === 0 && (
          <div className="state-container" style={{ padding: '24px 16px', textAlign: 'center' }}>
            <AlertCircle size={28} style={{ color: '#dc2626' }} />
            <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
              Erreur de chargement
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '240px', lineHeight: 1.4 }}>
              {error}
            </p>
            <button
              onClick={onRetry}
              className="btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', marginTop: '8px' }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredCases.length === 0 && (
          <div className="state-container" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <Inbox size={28} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
              {searchQuery || statusFilter !== 'all' ? 'Aucun résultat' : 'Aucun dossier'}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px', lineHeight: 1.4 }}>
              {searchQuery || statusFilter !== 'all'
                ? 'Essayez de modifier vos critères de recherche ou de filtre.'
                : 'La table Supabase ne contient aucun dossier pour le moment.'}
            </p>
          </div>
        )}

        {/* List of items */}
        {filteredCases.map((caseItem) => {
          const isSelected = selectedCaseId === caseItem.id;
          const statusClass = `badge-${caseItem.status}`;
          const isWhatsapp = caseItem.channel === 'whatsapp';

          return (
            <div
              key={caseItem.id}
              onClick={() => onSelectCase(caseItem)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectCase(caseItem);
              }}
              style={{
                padding: '12px 14px',
                borderBottom: '0.5px solid var(--border-color)',
                cursor: 'pointer',
                background: isSelected ? 'var(--teal-surface)' : 'var(--bg-surface)',
                borderLeft: isSelected ? '3px solid var(--teal-primary)' : '3px solid transparent',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'var(--bg-subtle)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)';
              }}
            >
              {/* Row 1: ID, Channel & Relative Time */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    #{caseItem.id}
                  </span>
                  <span
                    className={isWhatsapp ? 'badge badge-channel-whatsapp' : 'badge badge-channel-email'}
                    title={`Canal : ${CHANNEL_LABELS[caseItem.channel]}`}
                  >
                    {isWhatsapp ? <MessageSquare size={10} /> : <Mail size={10} />}
                    {CHANNEL_LABELS[caseItem.channel]}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {formatRelativeDate(caseItem.created_at)}
                </span>
              </div>

              {/* Row 2: Subject */}
              <div
                style={{
                  fontWeight: 500,
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {caseItem.subject}
              </div>

              {/* Row 3: Customer Name */}
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {caseItem.customer_name}
              </div>

              {/* Row 4: Status and Category Tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span className={`badge ${statusClass}`}>
                  {STATUS_LABELS[caseItem.status]}
                </span>
                <span className="badge badge-category">
                  {CATEGORY_LABELS[caseItem.category] || caseItem.category}
                </span>
                {caseItem.assigned_team && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-secondary)',
                      border: '0.5px solid var(--border-color)',
                    }}
                  >
                    {caseItem.assigned_team === 'mada_ops' ? 'Mada Ops' : 'Sez Ops'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
