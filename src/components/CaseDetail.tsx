import React, { useEffect, useState, useCallback } from 'react';
import type { Case, CaseEvent, Agent, CaseStatus } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEMO_EVENTS } from '../data/mockData';
import { EscalateModal } from './EscalateModal';
import {
  STATUS_LABELS,
  CHANNEL_LABELS,
  CATEGORY_LABELS,
  TEAM_LABELS,
  EVENT_KIND_LABELS,
  formatDateTime,
} from '../utils/formatters';
import {
  MessageSquare,
  Mail,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Tag,
  Users,
  Shield,
  RefreshCw,
  AlertCircle,
  Inbox,
  ArrowUpRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';

interface CaseDetailProps {
  selectedCase: Case | null;
  agentsMap: Record<string, Agent>;
  currentAgent: Agent;
  onCaseUpdated: (updatedCase: Case) => void;
}

export const CaseDetail: React.FC<CaseDetailProps> = ({
  selectedCase,
  agentsMap,
  currentAgent,
  onCaseUpdated,
}) => {
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // Status update state
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (caseId: number) => {
    setLoadingEvents(true);
    setEventError(null);

    if (!isSupabaseConfigured) {
      // Demo mock fallback
      setTimeout(() => {
        const mockList = DEMO_EVENTS[caseId] || [];
        setEvents(mockList);
        setLoadingEvents(false);
      }, 150);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('case_events')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setEvents(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des événements';
      setEventError(message);
      // If table doesn't exist yet, fall back gracefully to demo mock if available
      if (DEMO_EVENTS[caseId]) {
        setEvents(DEMO_EVENTS[caseId]);
      }
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCase) {
      fetchEvents(selectedCase.id);
      setStatusActionError(null);
    } else {
      setEvents([]);
      setEventError(null);
      setStatusActionError(null);
    }
  }, [selectedCase, fetchEvents]);

  const handleStatusChangeRequest = async (targetStatus: CaseStatus) => {
    if (!selectedCase || targetStatus === selectedCase.status) return;

    // Requirement: Selecting Escalated requires choosing a team
    if (targetStatus === 'escalated') {
      setIsEscalateModalOpen(true);
      return;
    }

    // Direct status update for 'new', 'in_progress', 'resolved'
    setUpdatingStatus(true);
    setStatusActionError(null);

    const nowIso = new Date().toISOString();
    const isResolved = targetStatus === 'resolved';

    if (!isSupabaseConfigured) {
      const updatedMock: Case = {
        ...selectedCase,
        status: targetStatus,
        resolved_at: isResolved ? nowIso : null,
      };

      const newMockEvent: CaseEvent = {
        id: Math.floor(2000 + Math.random() * 8000),
        case_id: selectedCase.id,
        author_id: currentAgent.id,
        kind: 'status_change',
        channel: null,
        body: `Statut passé de "${STATUS_LABELS[selectedCase.status]}" à "${STATUS_LABELS[targetStatus]}".`,
        created_at: nowIso,
      };

      if (!DEMO_EVENTS[selectedCase.id]) {
        DEMO_EVENTS[selectedCase.id] = [];
      }
      DEMO_EVENTS[selectedCase.id].push(newMockEvent);

      setTimeout(() => {
        setUpdatingStatus(false);
        onCaseUpdated(updatedMock);
        setEvents((prev) => [...prev, newMockEvent]);
      }, 150);
      return;
    }

    try {
      // 1. Update cases table
      const { data: updatedData, error: updateError } = await supabase
        .from('cases')
        .update({
          status: targetStatus,
          resolved_at: isResolved ? nowIso : null,
        })
        .eq('id', selectedCase.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // 2. Insert event in case_events
      const eventText = `Statut passé de "${STATUS_LABELS[selectedCase.status]}" à "${STATUS_LABELS[targetStatus]}".`;
      await supabase.from('case_events').insert([
        {
          case_id: selectedCase.id,
          author_id: currentAgent.id,
          kind: 'status_change',
          channel: null,
          body: eventText,
        },
      ]);

      onCaseUpdated(updatedData as Case);
      fetchEvents(selectedCase.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du statut';
      setStatusActionError(message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEscalationComplete = (updatedCase: Case) => {
    onCaseUpdated(updatedCase);
    if (selectedCase) {
      fetchEvents(selectedCase.id);
    }
  };

  if (!selectedCase) {
    return (
      <section
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app)',
          padding: '32px',
        }}
      >
        <div
          style={{
            maxWidth: '360px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--bg-subtle)',
              border: '0.5px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--text-muted)',
            }}
          >
            <FileText size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Aucun dossier sélectionné
          </h3>
          <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
            Sélectionnez un dossier dans la liste à gauche pour consulter ses informations détaillées et son journal d'événements.
          </p>
        </div>
      </section>
    );
  }

  const isWhatsapp = selectedCase.channel === 'whatsapp';
  const ownerName = agentsMap[selectedCase.owner_id]?.full_name || `Agent (${selectedCase.owner_id.slice(0, 8)}...)`;

  return (
    <section
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        background: 'var(--bg-app)',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        {/* Badges & ID row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--text-secondary)',
                background: 'var(--bg-subtle)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '0.5px solid var(--border-color)',
              }}
            >
              #{selectedCase.id}
            </span>
            <span className={`badge badge-${selectedCase.status}`}>
              {STATUS_LABELS[selectedCase.status]}
            </span>
            <span className={isWhatsapp ? 'badge badge-channel-whatsapp' : 'badge badge-channel-email'}>
              {isWhatsapp ? <MessageSquare size={11} /> : <Mail size={11} />}
              {CHANNEL_LABELS[selectedCase.channel]}
            </span>
            <span className="badge badge-category">
              <Tag size={10} style={{ marginRight: '2px' }} />
              {CATEGORY_LABELS[selectedCase.category] || selectedCase.category}
            </span>

            {selectedCase.assigned_team && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--teal-primary)',
                  background: 'var(--teal-surface)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid rgba(8,80,65,0.2)',
                }}
              >
                <Users size={11} />
                <span>{TEAM_LABELS[selectedCase.assigned_team] || selectedCase.assigned_team}</span>
              </div>
            )}
          </div>

          {/* Status Change Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Modifier le statut :
            </span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select
                value={selectedCase.status}
                onChange={(e) => handleStatusChangeRequest(e.target.value as CaseStatus)}
                disabled={updatingStatus}
                style={{
                  padding: '5px 28px 5px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  border: '0.5px solid var(--border-color)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  cursor: updatingStatus ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  appearance: 'none',
                }}
              >
                <option value="new">Nouveau</option>
                <option value="in_progress">En cours</option>
                <option value="escalated">Escaladé (Sélection d'équipe)</option>
                <option value="resolved">Résolu</option>
              </select>
              {updatingStatus ? (
                <Loader2
                  size={12}
                  className="animate-spin"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    pointerEvents: 'none',
                    color: 'var(--text-muted)',
                  }}
                />
              ) : (
                <ChevronDown
                  size={12}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    pointerEvents: 'none',
                    color: 'var(--text-muted)',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {statusActionError && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fef2f2',
              border: '0.5px solid #fecaca',
              borderRadius: 'var(--radius-sm)',
              color: '#991b1b',
              fontSize: '12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{statusActionError}</span>
          </div>
        )}

        {/* Subject */}
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            marginBottom: '16px',
          }}
        >
          {selectedCase.subject}
        </h1>

        {/* Info Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px 20px',
            paddingTop: '16px',
            borderTop: '0.5px solid var(--border-color)',
            fontSize: '13px',
          }}
        >
          {/* Customer */}
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>
              CLIENT
            </div>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={13} style={{ color: 'var(--text-muted)' }} />
              <span>{selectedCase.customer_name}</span>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>
              CONTACT CLIENT
            </div>
            <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={13} style={{ color: 'var(--text-muted)' }} />
              <span>{selectedCase.customer_contact || 'Non renseigné'}</span>
            </div>
          </div>

          {/* Owner / Agent */}
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>
              AGENT EN CHARGE (CS)
            </div>
            <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={13} style={{ color: 'var(--teal-primary)' }} />
              <span>{ownerName}</span>
            </div>
          </div>

          {/* Created date */}
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>
              CRÉÉ LE
            </div>
            <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
              <span>{formatDateTime(selectedCase.created_at)}</span>
            </div>
          </div>

          {/* Resolved date */}
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>
              RÉSOLU LE
            </div>
            <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2
                size={13}
                style={{ color: selectedCase.resolved_at ? '#059669' : 'var(--text-muted)' }}
              />
              <span>{selectedCase.resolved_at ? formatDateTime(selectedCase.resolved_at) : 'Non résolu (En cours)'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Events / Timeline Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          flex: 1,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '0.5px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Journal des événements
            </h2>
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
              {events.length}
            </span>
          </div>

          <button
            onClick={() => fetchEvents(selectedCase.id)}
            disabled={loadingEvents}
            title="Rafraîchir les événements"
            style={{
              background: 'none',
              border: 'none',
              cursor: loadingEvents ? 'not-allowed' : 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={13} className={loadingEvents ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Loading Events */}
        {loadingEvents && (
          <div className="state-container" style={{ padding: '36px 0' }}>
            <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--teal-primary)' }} />
            <span>Chargement des événements...</span>
          </div>
        )}

        {/* Error Events */}
        {!loadingEvents && eventError && (
          <div
            style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '0.5px solid #fecaca',
              borderRadius: 'var(--radius-sm)',
              color: '#991b1b',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={15} />
              <span>{eventError}</span>
            </div>
            <button
              onClick={() => fetchEvents(selectedCase.id)}
              style={{
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                color: '#991b1b',
                fontWeight: 500,
                fontSize: '12px',
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Empty Events */}
        {!loadingEvents && events.length === 0 && (
          <div className="state-container" style={{ padding: '40px 0', textAlign: 'center' }}>
            <Inbox size={26} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              Aucun événement consigné
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Ce dossier ne comporte encore aucune note, échange ou action d'escalade.
            </span>
          </div>
        )}

        {/* Event Timeline */}
        {!loadingEvents && events.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
            {events.map((evt, idx) => {
              const authorName = agentsMap[evt.author_id]?.full_name || `Agent (${evt.author_id.slice(0, 8)})`;
              const isEventWhatsapp = evt.channel === 'whatsapp';
              const isEventEmail = evt.channel === 'email';

              return (
                <div
                  key={evt.id || idx}
                  style={{
                    position: 'relative',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-app)',
                    border: '0.5px solid var(--border-color)',
                  }}
                >
                  {/* Top line: Kind badge, Channel, Author, Time */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge event-kind-${evt.kind}`}>
                        {evt.kind === 'escalation' && <ArrowUpRight size={11} />}
                        {evt.kind === 'customer_update' && <MessageSquare size={11} />}
                        {evt.kind === 'note' && <FileText size={11} />}
                        {evt.kind === 'status_change' && <RefreshCw size={10} />}
                        {EVENT_KIND_LABELS[evt.kind] || evt.kind}
                      </span>

                      {evt.channel && (
                        <span
                          className={isEventWhatsapp ? 'badge badge-channel-whatsapp' : 'badge badge-channel-email'}
                          style={{ fontSize: '10px' }}
                        >
                          {isEventWhatsapp ? <MessageSquare size={9} /> : <Mail size={9} />}
                          {CHANNEL_LABELS[evt.channel]}
                        </span>
                      )}

                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {authorName}
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDateTime(evt.created_at)}
                    </span>
                  </div>

                  {/* Body */}
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {evt.body}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedCase && (
        <EscalateModal
          isOpen={isEscalateModalOpen}
          onClose={() => setIsEscalateModalOpen(false)}
          caseItem={selectedCase}
          currentAgent={currentAgent}
          onStatusUpdated={handleEscalationComplete}
        />
      )}
    </section>
  );
};
