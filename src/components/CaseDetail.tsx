import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Case, CaseEvent, Agent, CaseStatus, CaseChannel } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
  ChevronLeft,
  ChevronRight,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { sortEventsNewestFirst } from '../lib/caseWorkflow';

interface CaseDetailProps {
  selectedCase: Case | null;
  agentsMap: Record<string, Agent>;
  currentAgent: Agent;
  onCaseUpdated: (updatedCase: Case) => void;
  onCaseDeleted: (caseId: number) => void;
  onNavigate: (direction: -1 | 1) => void;
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
  onBackToList: () => void;
}

export const CaseDetail: React.FC<CaseDetailProps> = ({
  selectedCase,
  agentsMap,
  currentAgent,
  onCaseUpdated,
  onCaseDeleted,
  onNavigate,
  canNavigatePrevious,
  canNavigateNext,
  onBackToList,
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
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingCase, setIsDeletingCase] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (caseId: number) => {
    setLoadingEvents(true);
    setEventError(null);

    if (!isSupabaseConfigured) {
      setEvents([]);
      setEventError('Supabase n’est pas configuré. Le journal ne peut pas être chargé.');
      setLoadingEvents(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('case_events')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (error) {
        throw error;
      }

      setEvents(sortEventsNewestFirst(data || []));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des événements';
      setEventError(message);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const selectedCaseId = selectedCase?.id;
  const prevCaseIdRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (selectedCaseId !== undefined && selectedCaseId !== null) {
      fetchEvents(selectedCaseId);
      setStatusActionError(null);
      // Requirement 3: Never clear note draft when the same case is reloaded
      if (prevCaseIdRef.current !== selectedCaseId) {
        setNoteText('');
        setNoteError(null);
        prevCaseIdRef.current = selectedCaseId;
      }
    } else {
      setEvents([]);
      setEventError(null);
      setStatusActionError(null);
      setNoteText('');
      setNoteError(null);
      prevCaseIdRef.current = null;
    }
  }, [selectedCaseId, fetchEvents]);

  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCase || !noteText.trim() || submittingNote) return;

    setSubmittingNote(true);
    setNoteError(null);

    const trimmedBody = noteText.trim();
    const channelToSave = noteKind === 'customer_update' ? noteChannel : null;

    if (!isSupabaseConfigured) { setNoteError('Supabase n’est pas configuré. Votre message n’a pas été enregistré.'); setSubmittingNote(false); return; }

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

      setEvents((prev) => sortEventsNewestFirst([data as CaseEvent, ...prev]));
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

    if (!isSupabaseConfigured) { setStatusActionError('Supabase n’est pas configuré. Le statut n’a pas été modifié.'); setUpdatingStatus(false); return; }

    try {
      // 1. Update cases table
      const { data: updatedData, error: updateError } = await supabase
        .from('cases')
        .update({
          status: targetStatus,
        })
        .eq('id', selectedCase.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
      onCaseUpdated(updatedData as Case);

      // 2. Insert event in case_events
      const eventText = `Statut passé de "${STATUS_LABELS[selectedCase.status]}" à "${STATUS_LABELS[targetStatus]}".`;
      const { error: eventError } = await supabase.from('case_events').insert([
        {
          case_id: selectedCase.id,
          author_id: currentAgent.id,
          kind: 'status_change',
          channel: null,
          body: eventText,
        },
      ]);
      if (eventError) throw eventError;

      await fetchEvents(selectedCase.id);
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

  const handleArchive = async () => {
    if (!selectedCase || archiveBusy) return;
    const restoring = Boolean(selectedCase.deleted_at);
    if (!restoring && !window.confirm(`Archiver le dossier #${selectedCase.id} ? Il restera disponible dans la vue Archivés.`)) return;
    setArchiveBusy(true);
    setStatusActionError(null);
    setArchiveMessage(null);
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase n’est pas configuré.');
      const { data, error } = await supabase.from('cases').update(restoring ? { deleted_at: null } : { deleted_at: new Date().toISOString() }).eq('id', selectedCase.id).select().single();
      if (error) throw error;
      onCaseUpdated(data as Case);
      setArchiveMessage(restoring ? 'Dossier restauré.' : 'Dossier archivé.');
    } catch (err) {
      setStatusActionError(err instanceof Error ? err.message : 'Impossible de modifier l’archivage du dossier.');
    } finally { setArchiveBusy(false); }
  };

  const handleDeleteCase = async () => {
    if (!selectedCase || isDeletingCase) return;
    setIsDeletingCase(true);
    setDeleteError(null);
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase n’est pas configuré. Le dossier n’a pas été supprimé.');
      const { data, error } = await supabase.rpc('delete_case', { target_case_id: selectedCase.id });
      if (error) throw error;
      if (data !== true) throw new Error('Ce dossier est introuvable ou déjà supprimé. Actualisez la liste.');
      setIsDeleteDialogOpen(false);
      onCaseDeleted(selectedCase.id);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Impossible de supprimer ce dossier.');
    } finally {
      setIsDeletingCase(false);
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
        <div className="case-detail-toolbar">
          <div className="case-navigation"><button className="mobile-back-button" onClick={onBackToList}><ArrowLeft size={15} /> Dossiers</button><button className="icon-button" aria-label="Dossier précédent (K)" title="Précédent · K" disabled={!canNavigatePrevious} onClick={() => onNavigate(-1)}><ChevronLeft size={17} /></button><button className="icon-button" aria-label="Dossier suivant (J)" title="Suivant · J" disabled={!canNavigateNext} onClick={() => onNavigate(1)}><ChevronRight size={17} /></button><span>#{selectedCase.id}</span></div>
          <div className="case-detail-actions">
            <button className="button-secondary" onClick={() => void handleArchive()} disabled={archiveBusy}>{selectedCase.deleted_at ? <ArchiveRestore size={15} /> : <Archive size={15} />}{selectedCase.deleted_at ? 'Restaurer' : 'Archiver'}</button>
            {!selectedCase.permanently_deleted_at && <><span className="case-action-divider" aria-hidden="true" /><button type="button" className="button-danger-quiet" aria-label="Supprimer le dossier" title="Retirer définitivement des vues et rapports (historique conservé)" onClick={() => { setDeleteError(null); setIsDeleteDialogOpen(true); }}><Trash2 size={14} />Supprimer</button></>}
          </div>
        </div>
        {archiveMessage && <div role="status" className="success-message">{archiveMessage}</div>}
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
              background: 'var(--danger-bg)',
              border: '0.5px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger-text)',
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
                style={{ color: selectedCase.resolved_at ? 'var(--status-resolved-text)' : 'var(--text-muted)' }}
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
                      border: noteChannel === 'whatsapp' ? '1px solid var(--channel-whatsapp-border)' : '0.5px solid var(--border-color)',
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
                      border: noteChannel === 'email' ? '1px solid var(--channel-email-border)' : '0.5px solid var(--border-color)',
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
            aria-label={noteKind === 'note' ? 'Nouvelle note interne' : 'Nouvelle mise à jour client'}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleAddNote();
              }
            }}
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
                color: 'var(--danger-text)',
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
                    backgroundColor: 'var(--event-system-bg)',
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
              background: 'var(--danger-bg)',
              border: '0.5px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger-text)',
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
                color: 'var(--danger-text)',
                fontWeight: 500,
                fontSize: '12px',
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Empty Events */}
        {!loadingEvents && !eventError && events.length === 0 && (
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

              let dotBg = 'var(--event-system-bg)';
              let dotColor = 'var(--event-system-text)';
              if (evt.kind === 'escalation') {
                dotBg = 'var(--danger-bg)';
                dotColor = 'var(--danger-text)';
              } else if (evt.kind === 'customer_update') {
                dotBg = isEventWhatsapp ? 'var(--channel-whatsapp-bg)' : 'var(--channel-email-bg)';
                dotColor = isEventWhatsapp ? 'var(--channel-whatsapp-text)' : 'var(--channel-email-text)';
              } else if (evt.kind === 'status_change') {
                dotBg = 'var(--event-status-bg)';
                dotColor = 'var(--event-status-text)';
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
                  className={`event-${evt.kind}`}
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

      {selectedCase && isDeleteDialogOpen && createPortal(
        <div className="app-dialog-backdrop delete-dialog-backdrop">
          <section
            className="app-dialog delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-case-title"
            aria-describedby="delete-case-description"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !isDeletingCase) {
                event.stopPropagation();
                setIsDeleteDialogOpen(false);
              }
            }}
          >
            <header className="app-dialog-header">
              <div className="app-dialog-heading">
                <span className="app-dialog-icon delete-dialog-icon"><Trash2 size={17} /></span>
                <div>
                  <span className="app-dialog-eyebrow">SUPPRESSION DÉFINITIVE</span>
                  <h2 id="delete-case-title">Supprimer le dossier #{selectedCase.id} ?</h2>
                </div>
              </div>
            </header>
            <div className="delete-dialog-content">
              <p id="delete-case-description">Ce dossier sera retiré de l’espace agent et des rapports. Il ne pourra pas être restauré, mais son historique restera conservé.</p>
              {deleteError && <div role="alert" className="app-dialog-error">{deleteError}</div>}
            </div>
            <footer className="app-dialog-actions">
              <button type="button" className="button-secondary dialog-secondary-button" autoFocus disabled={isDeletingCase} onClick={() => setIsDeleteDialogOpen(false)}>Annuler</button>
              <button type="button" className="button-danger" disabled={isDeletingCase} onClick={() => void handleDeleteCase()}>
                {isDeletingCase ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Supprimer le dossier
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </section>
  );
};
