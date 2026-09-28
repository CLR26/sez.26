import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { signIn, signInDemo, isConfigured, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setFormError('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Identifiants invalides';
      setFormError(message === 'Invalid login credentials' ? 'Identifiants incorrects.' : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Suivi des dossiers</h1>
          <p className="login-subtitle">Connectez-vous à votre espace agent</p>
        </div>

        {!isConfigured && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              background: '#fef3c7',
              border: '0.5px solid #f59e0b',
              color: '#92400e',
              lineHeight: 1.4,
            }}
          >
            <strong>Mode démo actif :</strong> Les variables Supabase (<code>VITE_SUPABASE_URL</code>) ne sont pas encore définies. Vous pouvez vous connecter en mode démo ci-dessous ou entrer vos identifiants réels une fois Supabase configuré.
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {(formError || authError) && (
            <div className="notice-box">
              {formError || authError}
            </div>
          )}

          <div className="field-group">
            <label htmlFor="email" className="field-label">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="agent@company.com"
              className="text-input"
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="password" className="field-label">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="text-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>

          {!isConfigured && signInDemo && (
            <button
              type="button"
              onClick={signInDemo}
              className="btn-secondary"
              style={{
                marginTop: '4px',
                padding: '8px 16px',
                background: 'transparent',
                border: '1px dashed var(--teal-primary)',
                color: 'var(--teal-primary)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              Accéder avec un compte agent de test
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
