import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';

const MainView: React.FC = () => {
  const { session, agent, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="state-container" style={{ height: '100vh' }}>
        Chargement...
      </div>
    );
  }

  if (!session || !agent) {
    return <Login />;
  }

  const teamLabel = agent.team === 'mada_ops' ? 'Madagascar Ops' : agent.team === 'sez_ops' ? 'Seychelles Ops' : agent.team;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: '1000px' }}>
      <header
        style={{
          height: '48px',
          borderBottom: '0.5px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--teal-primary)', letterSpacing: '-0.01em' }}>
            Suivi des dossiers
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              background: 'var(--bg-subtle)',
              border: '0.5px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            v0.1.0
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
              }}
              title="Agent en ligne"
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              <strong>{agent.full_name}</strong> ({teamLabel})
            </span>
          </div>
          <button
            onClick={() => signOut()}
            style={{
              background: 'none',
              border: '0.5px solid var(--border-color)',
              padding: '5px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--text-primary)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside
          style={{
            width: '340px',
            borderRight: '0.5px solid var(--border-color)',
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '0.5px solid var(--border-color)',
              fontWeight: 500,
              fontSize: '13px',
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Liste des dossiers</span>
            <span className="badge badge-new">0 dossier</span>
          </div>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Aucun dossier assigné ou ouvert pour le moment.
          </div>
        </aside>

        <section
          style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            background: 'var(--bg-app)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '32px',
              maxWidth: '800px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Panneau de détail du dossier
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
              Sélectionnez un dossier dans la colonne latérale pour afficher l'historique des événements (notes, messages WhatsApp, e-mails, escalades) et mettre à jour son statut.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainView />
    </AuthProvider>
  );
};

export default App;
