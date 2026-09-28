import React, { useEffect, useState, useCallback } from 'react';
import type { Case, CaseEvent, Agent, CaseStatus, CaseChannel } from '../types/database';
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
  Send,
  CornerDownLeft,
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

  // Note composer state
  const [noteText, setNoteText] = useState('');
  const [noteKind, setNoteKind] = useState<'note' | 'customer_update'>('note');
  const [noteChannel, setNoteChannel] = useState<CaseChannel>('whatsapp');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

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
      setNoteText('');
      setNoteError(null);
    } else {
      setEvents([]);
      setEventError(null);
      setStatusActionError(null);
      setNoteText('');
      setNoteError(null);
    }
  }, [selectedCase, fetchEvents]);

  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCase || !noteText.trim() || submittingNote) return;

    setSubmittingNote(true);
    setNoteError(null);

    const nowIso = new Date().toISOString();
    const trimmedBody = noteText.trim();
    const channelToSave = noteKind === 'customer_update' ? noteChannel : null;

    if (!isSupabaseConfigured) {
      const mockEvent: CaseEvent = {
        id: Math.floor(3000 + Math.random() * 7000),
        case_id: selectedCase.id,
        author_id: currentAgent.id,
        kind: noteKind,
        channel: channelToSave,
        body: trimmedBody,
        created_at: nowIso,
      };

      if (!DEMO_EVENTS[selectedCase.id]) {
        DEMO_EVENTS[selectedCase.id] = [];
      }
      DEMO_EVENTS[selectedCase.id].push(mockEvent);

      setTimeout(() => {
        setEvents((prev) => [...prev, mockEvent]);
        setNoteText('');
        setSubmittingNote(false);
      }, 150);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('case_events')
        .insert([
          {
            case_id: selectedCase.id,
            author_id: currentAgent.id,
            kind: noteKind,
            channel: channelToSave,
            body: trimmedBody,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setEvents((prev) => [...prev, data as CaseEvent]);
      setNoteText('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la note";
      setNoteError(message);
    } finally {
      setSubmittingNote(false);
    }
  };

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
            maxWidth: '380px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '36px 28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'var(--teal-surface)',
              border: '0.5px solid rgba(8,80,65,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--teal-primary)',
            }}
          >
            <FileText size={24} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Sélectionnez un dossier
          </h3>
          <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
            Choisissez un dossier dans la colonne de gauche pour consulter son récapitulatif, modifier son statut ou ajouter une note dans son journal.
          </p>
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '0.5px solid var(--border-color)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            Astuce : utilisez la barre de recherche ou les filtres de statut pour naviguer rapidement.
          </div>
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

        {/* Note Composer Box */}
        <form
          onSubmit={handleAddNote}
          style={{
            marginBottom: '20px',
            padding: '14px 16px',
            background: 'var(--bg-app)',
            borderRadius: 'var(--radius-sm)',
            border: '0.5px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginRight: '4px' }}>
                Nouvelle entrée :
              </span>
              <button
                type="button"
                onClick={() => setNoteKind('note')}
                style={{
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: noteKind === 'note' ? 600 : 400,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: noteKind === 'note' ? 'var(--teal-primary)' : 'var(--bg-subtle)',
                  color: noteKind === 'note' ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <FileText size={11} />
                <span>Note interne</span>
              </button>

              <button
                type="button"
                onClick={() => setNoteKind('customer_update')}
                style={{
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: noteKind === 'customer_update' ? 600 : 400,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: noteKind === 'customer_update' ? 'var(--teal-primary)' : 'var(--bg-subtle)',
                  color: noteKind === 'customer_update' ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <MessageSquare size={11} />
                <span>Échange client</span>
              </button>

              {noteKind === 'customer_update' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setNoteChannel('whatsapp')}
                    className={noteChannel === 'whatsapp' ? 'badge badge-channel-whatsapp' : 'badge'}
                    style={{
                      cursor: 'pointer',
                      border: noteChannel === 'whatsapp' ? '1px solid #16a34a' : '0.5px solid var(--border-color)',
                      fontSize: '10px',
                    }}
                  >
                    <MessageSquare size={10} />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteChannel('email')}
                    className={noteChannel === 'email' ? 'badge badge-channel-email' : 'badge'}
                    style={{
                      cursor: 'pointer',
                      border: noteChannel === 'email' ? '1px solid #2563eb' : '0.5px solid var(--border-color)',
                      fontSize: '10px',
                    }}
                  >
                    <Mail size={10} />
                    E-mail
                  </button>
                </div>
              )}
            </div>

            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Agent : <strong>{currentAgent.full_name}</strong>
            </span>
          </div>

          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleAddNote();
              }
            }}
            placeholder={
              noteKind === 'note'
                ? "Rédiger une observation interne, une consigne pour un collègue ou une note de dossier..."
                : `Consigner un échange client envoyé ou reçu via ${noteChannel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}...`
            }
            rows={2}
            disabled={submittingNote}
            className="text-input"
            style={{
              resize: 'vertical',
              minHeight: '60px',
              fontSize: '13px',
              lineHeight: 1.45,
            }}
          />

          {noteError && (
            <div
              style={{
                color: '#dc2626',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <AlertCircle size={12} />
              <span>{noteError}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Raccourci : <kbd style={{ padding: '1px 5px', background: 'var(--bg-subtle)', borderRadius: '3px', border: '0.5px solid var(--border-color)' }}>Ctrl + Entrée</kbd>
            </span>

            <button
              type="submit"
              disabled={submittingNote || !noteText.trim()}
              className="btn-primary"
              style={{
                marginTop: 0,
                padding: '6px 14px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {submittingNote ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Ajouter au journal</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Loading Events: Timeline Skeletons */}
        {loadingEvents && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '22px', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '12px',
                bottom: '16px',
                width: '2px',
                backgroundColor: 'var(--border-color)',
              }}
            />
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-app)',
                  border: '0.5px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '-22px',
                    top: '14px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#e2e8f0',
                    border: '2px solid var(--bg-surface)',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="skeleton" style={{ width: '80px', height: '16px', borderRadius: '10px' }} />
                    <div className="skeleton" style={{ width: '70px', height: '14px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '90px', height: '12px' }} />
                </div>
                <div className="skeleton" style={{ width: i === 1 ? '90%' : i === 2 ? '75%' : '60%', height: '13px' }} />
              </div>
            ))}
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
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'var(--bg-app)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-color)',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                border: '0.5px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                marginBottom: '10px',
              }}
            >
              <FileText size={20} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Historique vierge
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '320px', lineHeight: 1.45 }}>
              Aucun événement ou échange n'a encore été consigné pour ce dossier. Rédigez une première note ci-dessus pour démarrer le suivi.
            </span>
          </div>
        )}

        {/* Event Timeline */}
        {!loadingEvents && events.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              paddingLeft: '22px',
            }}
          >
            {/* Continuous timeline line */}
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '12px',
                bottom: '16px',
                width: '2px',
                backgroundColor: 'var(--border-color)',
              }}
            />

            {events.map((evt, idx) => {
              const authorName = agentsMap[evt.author_id]?.full_name || `Agent (${evt.author_id.slice(0, 8)})`;
              const isEventWhatsapp = evt.channel === 'whatsapp';
              const isEventEmail = evt.channel === 'email';

              let dotBg = '#e2e8f0';
              let dotColor = '#475569';
              if (evt.kind === 'escalation') {
                dotBg = '#fee2e2';
                dotColor = '#b91c1c';
              } else if (evt.kind === 'customer_update') {
                dotBg = isEventWhatsapp ? '#dcfce7' : '#dbeafe';
                dotColor = isEventWhatsapp ? '#15803d' : '#1d4ed8';
              } else if (evt.kind === 'status_change') {
                dotBg = '#f3e8ff';
                dotColor = '#7e22ce';
              }

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
                  {/* Timeline Node Dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-22px',
                      top: '14px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: dotBg,
                      border: '2px solid var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: dotColor,
                    }}
                    title={EVENT_KIND_LABELS[evt.kind] || evt.kind}
                  >
                    {evt.kind === 'escalation' && <ArrowUpRight size={9} />}
                    {evt.kind === 'customer_update' && (isEventWhatsapp ? <MessageSquare size={8} /> : <Mail size={8} />)}
                    {evt.kind === 'note' && <FileText size={8} />}
                    {evt.kind === 'status_change' && <RefreshCw size={8} />}
                  </div>

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
