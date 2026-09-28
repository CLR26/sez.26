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
  Plus,
} from 'lucide-react';

interface CaseListProps {
  cases: Case[];
  selectedCaseId: number | null;
  onSelectCase: (caseItem: Case) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onCreateCase?: () => void;
}

export const CaseList: React.FC<CaseListProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  loading,
  error,
  onRetry,
  onCreateCase,
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {onCreateCase && (
              <button
                type="button"
                onClick={onCreateCase}
                className="btn-primary"
                style={{
                  marginTop: 0,
                  padding: '4px 9px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Plus size={13} />
                <span>Nouveau</span>
              </button>
            )}

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
        {/* Loading state: skeleton cards */}
        {loading && cases.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  borderBottom: '0.5px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div className="skeleton" style={{ width: '38px', height: '14px' }} />
                    <div className="skeleton" style={{ width: '65px', height: '14px', borderRadius: '10px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '45px', height: '12px' }} />
                </div>
                <div className="skeleton" style={{ width: i % 2 === 0 ? '80%' : '92%', height: '14px' }} />
                <div className="skeleton" style={{ width: '50%', height: '12px' }} />
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <div className="skeleton" style={{ width: '55px', height: '16px', borderRadius: '10px' }} />
                  <div className="skeleton" style={{ width: '70px', height: '16px', borderRadius: '10px' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && cases.length === 0 && (
          <div style={{ padding: '36px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#fef2f2',
                border: '0.5px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                marginBottom: '10px',
              }}
            >
              <AlertCircle size={22} />
            </div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Échec du chargement
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '240px', lineHeight: 1.45, marginBottom: '14px' }}>
              {error}
            </p>
            <button
              onClick={onRetry}
              className="btn-primary"
              style={{
                marginTop: 0,
                fontSize: '12px',
                padding: '6px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={12} />
              <span>Réessayer</span>
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredCases.length === 0 && (
          <div
            style={{
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                border: '0.5px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              {searchQuery || statusFilter !== 'all' ? <Search size={20} /> : <Inbox size={20} />}
            </div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              {searchQuery || statusFilter !== 'all' ? 'Aucun résultat correspondant' : 'Aucun dossier actif'}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '240px', lineHeight: 1.45, margin: 0 }}>
              {searchQuery || statusFilter !== 'all'
                ? `Aucun dossier ne correspond à votre filtre actuel.`
                : 'La file est actuellement vide. Vous pouvez créer un nouveau dossier pour consigner une demande.'}
            </p>

            {searchQuery || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                style={{
                  marginTop: '6px',
                  background: 'none',
                  border: '0.5px solid var(--border-color)',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--teal-primary)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Réinitialiser les filtres
              </button>
            ) : onCreateCase ? (
              <button
                onClick={onCreateCase}
                className="btn-primary"
                style={{
                  marginTop: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={13} />
                <span>Créer un dossier</span>
              </button>
            ) : null}
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
