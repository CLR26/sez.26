import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { CreateCaseModal } from './components/CreateCaseModal';
import { ReportingView } from './components/ReportingView';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { DEMO_CASES, DEMO_AGENTS } from './data/mockData';
import type { Case, Agent } from './types/database';
import { Plus, Inbox, BarChart3, Loader2 } from 'lucide-react';

const MainView: React.FC = () => {
  const { session, agent, loading: authLoading, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<'cases' | 'reporting'>('cases');
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [loadingCases, setLoadingCases] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [agentsMap, setAgentsMap] = useState<Record<string, Agent>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const lastVisibilityRefreshRef = useRef<number>(Date.now());
  const agentId = agent?.id;

  const handleCaseCreated = (newCase: Case) => {
    setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    setSelectedCaseId(newCase.id);
  };

  const handleCaseUpdated = (updatedCase: Case) => {
    setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
  };

  const fetchCasesAndAgents = useCallback(async (silent = false) => {
    // Show list skeleton only on the first load; later refreshes are silent
    if (!hasLoadedOnceRef.current && !silent) {
      setLoadingCases(true);
    } else {
      setIsRefreshing(true);
    }
    setCaseError(null);

    // If Supabase is not configured or in demo mode, use demo data
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        const sortedMock = [...DEMO_CASES].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setCases(sortedMock);
        setSelectedCaseId((prevId) => {
          if (prevId && sortedMock.some((c) => c.id === prevId)) {
            return prevId;
          }
          return sortedMock.length > 0 ? sortedMock[0].id : null;
        });

        const map: Record<string, Agent> = {};
        DEMO_AGENTS.forEach((ag) => {
          map[ag.id] = ag;
        });
        if (agent) {
          map[agent.id] = agent;
        }
        setAgentsMap(map);
        hasLoadedOnceRef.current = true;
        setLoadingCases(false);
        setIsRefreshing(false);
      }, 150);
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

      // Keep current selectedCaseId if valid, otherwise pick first
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
      if (!hasLoadedOnceRef.current) {
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
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setLoadingCases(false);
      setIsRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (session && agentId) {
      fetchCasesAndAgents();
    }
  }, [session?.user?.id, agentId, fetchCasesAndAgents]);

  // Refresh silently when the browser tab becomes visible again, at most once per 60 seconds, with no loading state
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibilityRefreshRef.current >= 60000) {
          lastVisibilityRefreshRef.current = now;
          fetchCasesAndAgents(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCasesAndAgents]);

  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-app)',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'var(--teal-surface)',
            border: '0.5px solid rgba(8,80,65,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--teal-primary)',
          }}
        >
          <Loader2 size={22} className="animate-spin" />
        </div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Chargement de votre session...
        </div>
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
            v0.3.0
          </span>
        </div>

        {/* View Switcher Tabs */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--bg-subtle)',
            padding: '2px 4px',
            borderRadius: '6px',
            border: '0.5px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: activeTab === 'cases' ? 600 : 500,
              background: activeTab === 'cases' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'cases' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: activeTab === 'cases' ? '0.5px solid var(--border-color)' : 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: activeTab === 'cases' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Inbox size={13} />
            <span>Dossiers</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '8px',
                background: activeTab === 'cases' ? 'var(--teal-surface)' : 'rgba(0,0,0,0.05)',
                color: activeTab === 'cases' ? 'var(--teal-primary)' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {cases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reporting')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: activeTab === 'reporting' ? 600 : 500,
              background: activeTab === 'reporting' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'reporting' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: activeTab === 'reporting' ? '0.5px solid var(--border-color)' : 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: activeTab === 'reporting' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart3 size={13} />
            <span>Rapports & KPI</span>
          </button>
        </nav>

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

      {/* Main View: Cases Split View or Reporting */}
      {activeTab === 'cases' ? (
        <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <CaseList
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={(c) => setSelectedCaseId(c.id)}
            loading={loadingCases}
            isRefreshing={isRefreshing}
            error={caseError}
            onRetry={() => fetchCasesAndAgents(false)}
            onCreateCase={() => setIsCreateModalOpen(true)}
          />

          <CaseDetail
            selectedCase={selectedCase}
            agentsMap={agentsMap}
            currentAgent={agent}
            onCaseUpdated={handleCaseUpdated}
          />
        </main>
      ) : (
        <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ReportingView />
        </main>
      )}

      {/* Create Case Modal */}
      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCaseCreated={handleCaseCreated}
        currentAgent={agent}
      />
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
