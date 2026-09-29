import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Case, CaseTeam, Agent } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TEAM_LABELS } from '../utils/formatters';
import { X, ArrowUpRight, AlertCircle, Loader2, Users } from 'lucide-react';

interface EscalateModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: Case;
  currentAgent: Agent;
  onStatusUpdated: (updatedCase: Case) => void;
}

export const EscalateModal: React.FC<EscalateModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  currentAgent,
  onStatusUpdated,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<CaseTeam | ''>(caseItem.assigned_team || '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('select, textarea, button:not(:disabled)')?.focus();
    return () => returnFocusRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled)'));
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) {
      setError('Veuillez sélectionner obligatoirement une équipe opérationnelle pour escalader.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const teamLabel = TEAM_LABELS[selectedTeam as CaseTeam];
    const eventBody = `Dossier escaladé à l'équipe ${teamLabel}.${
      reason.trim() ? ` Motif : ${reason.trim()}` : ''
    }`;

    if (!isSupabaseConfigured) { setError('Supabase n’est pas configuré. L’escalade n’a pas été enregistrée.'); setSubmitting(false); return; }

    try {
      // 1. Update case status & team in Supabase
      const { data: updatedData, error: updateError } = await supabase
        .from('cases')
        .update({
          status: 'escalated',
          assigned_team: selectedTeam,
        })
        .eq('id', caseItem.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
      onStatusUpdated(updatedData as Case);

      // 2. Add escalation event in journal
      const { error: eventError } = await supabase.from('case_events').insert([
        {
          case_id: caseItem.id,
          author_id: currentAgent.id,
          kind: 'escalation',
          channel: null,
          body: eventBody,
        },
      ]);
      if (eventError) throw eventError;

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'escalade du dossier";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="app-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-surface app-dialog escalate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalate-dialog-title"
        aria-describedby="escalate-dialog-description"
      >
        <header className="app-dialog-header">
          <div className="app-dialog-heading">
            <span className="app-dialog-icon escalation-dialog-icon"><ArrowUpRight size={17} /></span>
            <div>
              <span className="app-dialog-eyebrow">ESCALADE</span>
              <h2 id="escalate-dialog-title">Escalader le dossier #{caseItem.id}</h2>
              <p id="escalate-dialog-description">Choisissez l’équipe opérationnelle qui prendra le relais.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer la fenêtre d’escalade"
            onClick={onClose}
            disabled={submitting}
            className="app-dialog-close"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="app-dialog-form">
          {error && (
            <div role="alert" className="app-dialog-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="field-group">
            <div className="dialog-section-heading">
              <span className="field-label">Équipe opérationnelle</span>
              <span className="required-indicator">Obligatoire</span>
            </div>
            <div role="group" aria-label="Équipe opérationnelle assignée" className="team-choice-grid">
              <button
                type="button"
                className={`team-choice${selectedTeam === 'mada_ops' ? ' selected' : ''}`}
                aria-pressed={selectedTeam === 'mada_ops'}
                onClick={() => setSelectedTeam('mada_ops')}
              >
                <span className="team-choice-icon"><Users size={16} /></span>
                <span className="team-choice-label">Ops Madagascar</span>
                <span className="team-choice-indicator" aria-hidden="true" />
              </button>

              <button
                type="button"
                className={`team-choice${selectedTeam === 'sez_ops' ? ' selected' : ''}`}
                aria-pressed={selectedTeam === 'sez_ops'}
                onClick={() => setSelectedTeam('sez_ops')}
              >
                <span className="team-choice-icon"><Users size={16} /></span>
                <span className="team-choice-label">Ops Seychelles</span>
                <span className="team-choice-indicator" aria-hidden="true" />
              </button>
            </div>
            {!selectedTeam && (
              <p className="field-help">
                Sélectionnez une équipe pour activer l’escalade.
              </p>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="escalate-reason" className="field-label dialog-field-label">
              Motif ou consigne <span className="optional-indicator">Facultatif · ajouté au journal</span>
            </label>
            <textarea
              id="escalate-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              className="text-input"
            />
          </div>

          <footer className="app-dialog-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="button-secondary dialog-secondary-button"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={submitting || !selectedTeam}
              className="button-escalate"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Escalade en cours...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight size={14} />
                  <span>Confirmer l'escalade</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
};
