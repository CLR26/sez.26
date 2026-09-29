import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { CreateCaseModal } from './components/CreateCaseModal';
import { ReportingView } from './components/ReportingView';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import type { Case, Agent } from './types/database';
import { BarChart3, Inbox, Loader2, Plus, LogOut } from 'lucide-react';

export type WorkView = 'mine' | 'all' | 'escalated' | 'resolved' | 'archived';

const MainView: React.FC = () => {
  const { session, agent, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'cases' | 'reporting'>('cases');
  const [workView, setWorkView] = useState<WorkView>('mine');
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [agentsMap, setAgentsMap] = useState<Record<string, Agent>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list');
  const hasLoadedOnceRef = useRef(false);
  const lastVisibilityRefreshRef = useRef(Date.now());
  const agentId = agent?.id;

  const handleCaseCreated = (newCase: Case) => {
    setCases((prev) => [newCase, ...prev.filter((item) => item.id !== newCase.id)]);
    setSelectedCaseId(newCase.id);
    setWorkView('all');
  };
  const handleCaseUpdated = (updatedCase: Case) => {
    setCases((prev) => prev.map((item) => item.id === updatedCase.id ? updatedCase : item));
    if (!updatedCase.deleted_at && workView === 'archived') setWorkView('all');
  };

  const fetchCasesAndAgents = useCallback(async (silent = false) => {
    if (!hasLoadedOnceRef.current && !silent) setLoadingCases(true);
    else setIsRefreshing(true);
    setCaseError(null);

    if (!isSupabaseConfigured) {
      setCases([]);
      setCaseError('Supabase n’est pas configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY pour charger les dossiers.');
      hasLoadedOnceRef.current = true;
      setLoadingCases(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const { data: agentsData, error: agentsError } = await supabase.from('agents').select('*');
      if (agentsError) throw agentsError;
      const map: Record<string, Agent> = {};
      agentsData?.forEach((item: Agent) => { map[item.id] = item; });
      if (agent) map[agent.id] = agent;
      setAgentsMap(map);

      const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data || []) as Case[];
      setCases(list);
      setSelectedCaseId((current) => current && list.some((item) => item.id === current) ? current : list[0]?.id ?? null);
    } catch (err) {
      setCaseError(err instanceof Error ? err.message : 'Erreur lors du chargement des dossiers.');
    } finally {
      hasLoadedOnceRef.current = true;
      setLoadingCases(false);
      setIsRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (session && agentId) void fetchCasesAndAgents();
  }, [session?.user?.id, agentId, fetchCasesAndAgents]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastVisibilityRefreshRef.current >= 60000) {
        lastVisibilityRefreshRef.current = Date.now();
        void fetchCasesAndAgents(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchCasesAndAgents]);

  const viewCases = cases.filter((item) => {
    const archived = Boolean(item.deleted_at);
    if (workView === 'archived') return archived;
    if (archived) return false;
    if (workView === 'mine') return item.owner_id === agent?.id;
    if (workView === 'escalated') return item.status === 'escalated';
    if (workView === 'resolved') return item.status === 'resolved';
    return true;
  });
  const selectedCase = cases.find((item) => item.id === selectedCaseId) || null;

  const navigateCase = (direction: -1 | 1) => {
    const index = viewCases.findIndex((item) => item.id === selectedCaseId);
    const target = viewCases[index + direction];
    if (target) setSelectedCaseId(target.id);
  };

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isCreateModalOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === '/') { event.preventDefault(); document.getElementById('case-search')?.focus(); }
      else if (event.key.toLowerCase() === 'n') { event.preventDefault(); setIsCreateModalOpen(true); }
      else if (event.key.toLowerCase() === 'j') { event.preventDefault(); navigateCase(1); }
      else if (event.key.toLowerCase() === 'k') { event.preventDefault(); navigateCase(-1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewCases, selectedCaseId, isCreateModalOpen]);

  if (authLoading) return <div className="auth-loading"><Loader2 size={22} className="animate-spin" /> Chargement de votre session…</div>;
  if (!session || !agent) return <Login />;

  const teamLabel = agent.team === 'mada_ops' ? 'Madagascar Ops' : agent.team === 'sez_ops' ? 'Seychelles Ops' : agent.team;
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup"><span className="brand-mark">C</span><div><strong>CS - MADA</strong><small>Service client</small></div></div>
        <nav className="top-navigation" aria-label="Navigation principale">
          <button className={activeTab === 'cases' ? 'top-nav-button active' : 'top-nav-button'} onClick={() => setActiveTab('cases')}><Inbox size={16} /> Dossiers <span className="count-pill">{cases.filter((item) => !item.deleted_at).length}</span></button>
          <button className={activeTab === 'reporting' ? 'top-nav-button active' : 'top-nav-button'} onClick={() => setActiveTab('reporting')}><BarChart3 size={16} /> Rapports</button>
        </nav>
        <div className="account-menu"><span className="agent-presence" /><div><strong>{agent.full_name}</strong><small>{teamLabel}</small></div><button className="icon-button" aria-label="Se déconnecter" title="Se déconnecter" onClick={() => void signOut()}><LogOut size={16} /></button></div>
      </header>
      {activeTab === 'cases' ? (
        <main className={`inbox-layout ${mobilePane === 'list' ? 'show-list-mobile' : 'show-detail-mobile'}`}>
          <CaseList cases={viewCases} allCases={cases} selectedCaseId={selectedCaseId} onSelectCase={(item) => { setSelectedCaseId(item.id); setMobilePane('detail'); }} loading={loadingCases} isRefreshing={isRefreshing} error={caseError} onRetry={() => void fetchCasesAndAgents(false)} onCreateCase={() => setIsCreateModalOpen(true)} currentAgent={agent} workView={workView} onWorkViewChange={(view) => { setWorkView(view); setMobilePane('list'); }} />
          <CaseDetail selectedCase={selectedCase} agentsMap={agentsMap} currentAgent={agent} onCaseUpdated={handleCaseUpdated} onNavigate={navigateCase} canNavigatePrevious={viewCases.findIndex((item) => item.id === selectedCaseId) > 0} canNavigateNext={viewCases.findIndex((item) => item.id === selectedCaseId) < viewCases.length - 1} onBackToList={() => setMobilePane('list')} />
        </main>
      ) : <main className="reporting-layout"><ReportingView /></main>}
      <button className="floating-create" aria-label="Créer un dossier" onClick={() => setIsCreateModalOpen(true)}><Plus size={18} /></button>
      <CreateCaseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCaseCreated={handleCaseCreated} currentAgent={agent} />
    </div>
  );
};

export const App: React.FC = () => <AuthProvider><MainView /></AuthProvider>;
export default App;
