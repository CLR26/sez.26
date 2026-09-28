import React, { useState } from 'react';
import type { Case, CaseChannel, CaseCategory, Agent } from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CHANNEL_LABELS, CATEGORY_LABELS } from '../utils/formatters';
import { X, Plus, MessageSquare, Mail, AlertCircle, Loader2 } from 'lucide-react';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (newCase: Case) => void;
  currentAgent: Agent;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated,
  currentAgent,
}) => {
  const [subject, setSubject] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [channel, setChannel] = useState<CaseChannel>('whatsapp');
  const [category, setCategory] = useState<CaseCategory>('customs');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Veuillez renseigner le sujet du dossier.');
      return;
    }
    if (!customerName.trim()) {
      setError('Veuillez renseigner le nom du client.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const nowIso = new Date().toISOString();

    if (!isSupabaseConfigured) {
      // Mock creation in demo mode
      const newMockCase: Case = {
        id: Math.floor(1000 + Math.random() * 9000),
        subject: subject.trim(),
        customer_name: customerName.trim(),
        customer_contact: customerContact.trim() || null,
        channel,
        category,
        status: 'new',
        owner_id: currentAgent.id,
        assigned_team: null,
        created_at: nowIso,
        resolved_at: null,
      };

      setTimeout(() => {
        setSubmitting(false);
        onCaseCreated(newMockCase);
        onClose();
      }, 200);
      return;
    }

    try {
      // 1. Insert case into Supabase
      const { data: insertedCase, error: insertCaseError } = await supabase
        .from('cases')
        .insert([
          {
            subject: subject.trim(),
            customer_name: customerName.trim(),
            customer_contact: customerContact.trim() || null,
            channel,
            category,
            status: 'new',
            owner_id: currentAgent.id,
            assigned_team: null,
          },
        ])
        .select()
        .single();

      if (insertCaseError) {
        throw insertCaseError;
      }

      // 2. Insert initial event in case_events
      const channelLabel = CHANNEL_LABELS[channel];
      await supabase.from('case_events').insert([
        {
          case_id: insertedCase.id,
          author_id: currentAgent.id,
          kind: 'note',
          channel,
          body: `Dossier ouvert pour ${customerName.trim()} via ${channelLabel}.`,
        },
      ]);

      onCaseCreated(insertedCase as Case);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du dossier';
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
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '0.5px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Nouveau dossier client
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Enregistrez un nouvel incident ou une demande client
            </p>
          </div>
          <button
            type="button"
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

        {/* Modal Body / Form */}
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

          {/* Subject */}
          <div className="field-group">
            <label htmlFor="create-subject" className="field-label">
              Sujet du dossier <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="create-subject"
              type="text"
              placeholder="Ex : Retard livraison conteneur #C-492, Déclaration douanière..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting}
              className="text-input"
              required
            />
          </div>

          {/* Customer Name & Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field-group">
              <label htmlFor="create-customer" className="field-label">
                Nom du client <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="create-customer"
                type="text"
                placeholder="Ex : Mada Transit SARL"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={submitting}
                className="text-input"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="create-contact" className="field-label">
                Contact (Tél / E-mail)
              </label>
              <input
                id="create-contact"
                type="text"
                placeholder="Ex : +261 34 00 000 00"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                disabled={submitting}
                className="text-input"
              />
            </div>
          </div>

          {/* Channel selector */}
          <div className="field-group">
            <label className="field-label">
              Canal d'origine <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: channel === 'whatsapp' ? '1.5px solid #16a34a' : '0.5px solid var(--border-color)',
                  background: channel === 'whatsapp' ? '#f0fdf4' : 'var(--bg-surface)',
                  color: channel === 'whatsapp' ? '#15803d' : 'var(--text-secondary)',
                  fontWeight: channel === 'whatsapp' ? 600 : 400,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <MessageSquare size={16} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: channel === 'email' ? '1.5px solid #2563eb' : '0.5px solid var(--border-color)',
                  background: channel === 'email' ? '#eff6ff' : 'var(--bg-surface)',
                  color: channel === 'email' ? '#1d4ed8' : 'var(--text-secondary)',
                  fontWeight: channel === 'email' ? 600 : 400,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Mail size={16} />
                <span>E-mail</span>
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="field-group">
            <label htmlFor="create-category" className="field-label">
              Catégorie <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="create-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as CaseCategory)}
              disabled={submitting}
              className="text-input"
              style={{ cursor: 'pointer' }}
            >
              {(Object.keys(CATEGORY_LABELS) as CaseCategory[]).map((catKey) => (
                <option key={catKey} value={catKey}>
                  {CATEGORY_LABELS[catKey]}
                </option>
              ))}
            </select>
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
              marginTop: '4px',
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
              disabled={submitting}
              className="btn-primary"
              style={{
                marginTop: 0,
                padding: '8px 18px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Créer le dossier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
