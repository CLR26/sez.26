import React, { useEffect, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { DEMO_CASES, DEMO_AGENTS } from './data/mockData';
import type { Case, Agent } from './types/database';

const MainView: React.FC = () => {
  const { session, agent, loading: authLoading, signOut } = useAuth();

  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [loadingCases, setLoadingCases] = useState<boolean>(true);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [agentsMap, setAgentsMap] = useState<Record<string, Agent>>({});

  const fetchCasesAndAgents = useCallback(async () => {
    setLoadingCases(true);
    setCaseError(null);

    // If Supabase is not configured or in demo mode, use demo data
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        const sortedMock = [...DEMO_CASES].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setCases(sortedMock);
        if (sortedMock.length > 0) {
          setSelectedCaseId(sortedMock[0].id);
        }

        const map: Record<string, Agent> = {};
        DEMO_AGENTS.forEach((ag) => {
          map[ag.id] = ag;
        });
        if (agent) {
          map[agent.id] = agent;
        }
        setAgentsMap(map);
        setLoadingCases(false);
      }, 200);
      return;
    }

    try {
      // 1. Fetch agents for name mapping
      const { data: agentsData } = await supabase.from('agents').select('*');
      const map: Record<string, Agent> = {};
      if (agentsData) {
        agentsData.forEach((ag: Agent) => {
          map[ag.id] = ag;
        });
      }
      if (agent) {
        map[agent.id] = agent;
      }
      setAgentsMap(map);

      // 2. Fetch cases sorted by created_at desc
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const caseList = data || [];
      setCases(caseList);

      // Select first case if none currently selected or if selected was deleted
      setSelectedCaseId((prevId) => {
        if (prevId && caseList.some((c) => c.id === prevId)) {
          return prevId;
        }
        return caseList.length > 0 ? caseList[0].id : null;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des dossiers';
      setCaseError(message);

      // If database tables are not yet created in the Supabase instance, fall back to mock data
      const sortedMock = [...DEMO_CASES].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setCases(sortedMock);
      if (sortedMock.length > 0) {
        setSelectedCaseId(sortedMock[0].id);
      }
      const map: Record<string, Agent> = {};
      DEMO_AGENTS.forEach((ag) => {
        map[ag.id] = ag;
      });
      if (agent) {
        map[agent.id] = agent;
      }
      setAgentsMap(map);
    } finally {
      setLoadingCases(false);
    }
  }, [agent]);

  useEffect(() => {
    if (session && agent) {
      fetchCasesAndAgents();
    }
  }, [session, agent, fetchCasesAndAgents]);

  if (authLoading) {
    return (
      <div className="state-container" style={{ height: '100vh' }}>
        Chargement de la session...
      </div>
    );
  }

  if (!session || !agent) {
    return <Login />;
  }

  const teamLabel =
    agent.team === 'mada_ops'
      ? 'Madagascar Ops'
      : agent.team === 'sez_ops'
      ? 'Seychelles Ops'
      : agent.team;

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: '1000px' }}>
      {/* Top Navbar */}
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
            v0.2.0
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
              title="Agent connecté"
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

      {/* Main Split View: Left List (~340px) & Right Read-Only Detail */}
      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <CaseList
          cases={cases}
          selectedCaseId={selectedCaseId}
          onSelectCase={(c) => setSelectedCaseId(c.id)}
          loading={loadingCases}
          error={caseError}
          onRetry={fetchCasesAndAgents}
        />

        <CaseDetail
          selectedCase={selectedCase}
          agentsMap={agentsMap}
        />
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
