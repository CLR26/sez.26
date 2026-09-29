import React, { useEffect, useState } from 'react';
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalate-dialog-title"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '0.5px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#fff7ed',
                border: '0.5px solid #fed7aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c2410c',
              }}
            >
              <ArrowUpRight size={16} />
            </div>
            <div>
              <h2 id="escalate-dialog-title" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Escalader le dossier #{caseItem.id}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Sélection obligatoire de l'équipe opérationnelle
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fermer la fenêtre d’escalade"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: '#fef2f2',
                border: '0.5px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                color: '#991b1b',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Team Selection (MANDATORY) */}
          <div className="field-group">
            <label className="field-label" style={{ fontWeight: 600 }}>
              Équipe opérationnelle assignée <span style={{ color: '#ef4444' }}>* (Obligatoire)</span>
            </label>
            <div role="group" aria-label="Équipe opérationnelle assignée" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                aria-pressed={selectedTeam === 'mada_ops'}
                onClick={() => setSelectedTeam('mada_ops')}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: selectedTeam === 'mada_ops' ? '2px solid var(--teal-primary)' : '0.5px solid var(--border-color)',
                  background: selectedTeam === 'mada_ops' ? 'var(--teal-surface)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Users size={14} style={{ color: 'var(--teal-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Ops Madagascar
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Code : <code>mada_ops</code>
                </div>
              </button>

              <button
                type="button"
                aria-pressed={selectedTeam === 'sez_ops'}
                onClick={() => setSelectedTeam('sez_ops')}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: selectedTeam === 'sez_ops' ? '2px solid var(--teal-primary)' : '0.5px solid var(--border-color)',
                  background: selectedTeam === 'sez_ops' ? 'var(--teal-surface)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Users size={14} style={{ color: 'var(--teal-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Ops Seychelles
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Code : <code>sez_ops</code>
                </div>
              </button>
            </div>
            {!selectedTeam && (
              <p style={{ fontSize: '11px', color: '#c2410c', marginTop: '4px' }}>
                Veuillez sélectionner l'une des deux équipes pour autoriser l'escalade.
              </p>
            )}
          </div>

          {/* Reason / Note */}
          <div className="field-group">
            <label htmlFor="escalate-reason" className="field-label">
              Motif de l'escalade ou instructions pour l'équipe (journalisé)
            </label>
            <textarea
              id="escalate-reason"
              rows={3}
              placeholder="Ex : Problème bloquant au niveau du dédouanement à l'arrivée..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              className="text-input"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Modal Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '12px',
              borderTop: '0.5px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '0.5px solid var(--border-color)',
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={submitting || !selectedTeam}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: !selectedTeam ? '#cbd5e1' : '#c2410c',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: !selectedTeam || submitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
              }}
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
          </div>
        </form>
      </div>
    </div>
  );
};
