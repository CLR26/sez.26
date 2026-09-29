import React from 'react';
import type { Agent, Case } from '../types/database';
import type { WorkView } from '../App';
import { CHANNEL_LABELS, STATUS_LABELS, formatRelativeDate } from '../utils/formatters';
import { AlertCircle, Archive, Inbox, Mail, MessageSquare, Plus, RefreshCw, Search } from 'lucide-react';

interface CaseListProps {
  cases: Case[];
  allCases: Case[];
  selectedCaseId: number | null;
  onSelectCase: (caseItem: Case) => void;
  loading: boolean;
  isRefreshing?: boolean;
  error: string | null;
  onRetry: () => void;
  onCreateCase?: () => void;
  currentAgent: Agent;
  workView: WorkView;
  onWorkViewChange: (view: WorkView) => void;
}

const views: { id: WorkView; label: string; icon: React.ReactNode }[] = [
  { id: 'mine', label: 'Mes dossiers', icon: <Inbox size={16} /> },
  { id: 'all', label: 'Tous', icon: <MessageSquare size={16} /> },
  { id: 'escalated', label: 'Escaladés', icon: <AlertCircle size={16} /> },
  { id: 'resolved', label: 'Résolus', icon: <span className="resolved-view-icon">✓</span> },
  { id: 'archived', label: 'Archivés', icon: <Archive size={16} /> },
];

export const CaseList: React.FC<CaseListProps> = ({ cases, allCases, selectedCaseId, onSelectCase, loading, isRefreshing = false, error, onRetry, onCreateCase, currentAgent, workView, onWorkViewChange }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const filteredCases = React.useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return cases;
    return cases.filter((item) => [item.subject, item.customer_name, String(item.id)].some((value) => value.toLocaleLowerCase().includes(query)));
  }, [cases, searchQuery]);
  const countFor = (view: WorkView) => {
    const active = allCases.filter((item) => !item.deleted_at);
    if (view === 'mine') return active.filter((item) => item.owner_id === currentAgent.id).length;
    if (view === 'escalated') return active.filter((item) => item.status === 'escalated').length;
    if (view === 'resolved') return active.filter((item) => item.status === 'resolved').length;
    if (view === 'archived') return allCases.filter((item) => Boolean(item.deleted_at)).length;
    return active.length;
  };

  return (
    <aside className="inbox-sidebar" aria-label="Dossiers">
      <div className="inbox-sidebar-heading">
        <div><span className="eyebrow">ESPACE DE TRAVAIL</span><h1>Dossiers</h1></div>
        <button className="icon-button" onClick={onRetry} disabled={isRefreshing} title="Actualiser" aria-label="Actualiser les dossiers"><RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /></button>
      </div>
      <nav className="work-views" aria-label="Vues de travail">
        {views.map((view) => <button key={view.id} onClick={() => onWorkViewChange(view.id)} className={workView === view.id ? 'work-view active' : 'work-view'} aria-current={workView === view.id ? 'page' : undefined}>
          {view.icon}<span>{view.label}</span><span className="work-view-count">{countFor(view.id)}</span>
        </button>)}
      </nav>
      <div className="list-tools">
        <label className="search-field"><Search size={16} /><input id="case-search" type="search" placeholder="Rechercher un dossier" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /><kbd>/</kbd></label>
        <div className="list-summary"><span>{filteredCases.length} {filteredCases.length > 1 ? 'dossiers' : 'dossier'}</span>{isRefreshing && <span className="refresh-label">Actualisation…</span>}</div>
      </div>
      <div className="case-list-scroll">
        {loading && cases.length === 0 && <div className="case-skeletons" aria-label="Chargement des dossiers">{[1, 2, 3, 4, 5].map((i) => <div className="case-skeleton" key={i}><div className="skeleton" style={{ width: '35%', height: 12 }} /><div className="skeleton" style={{ width: '85%', height: 16 }} /><div className="skeleton" style={{ width: '56%', height: 12 }} /></div>)}</div>}
        {error && <div className="list-state error-state"><AlertCircle size={22} /><strong>{cases.length ? 'Actualisation impossible' : 'Chargement impossible'}</strong><p>{error}</p><button className="button-secondary" onClick={onRetry}>Réessayer</button></div>}
        {!loading && !error && filteredCases.length === 0 && <div className="list-state"><div className="empty-icon">{workView === 'archived' ? <Archive size={20} /> : <Inbox size={20} />}</div><strong>{searchQuery ? 'Aucun résultat' : workView === 'archived' ? 'Aucun dossier archivé' : 'La file est vide'}</strong><p>{searchQuery ? 'Essayez un autre nom, sujet ou numéro de dossier.' : workView === 'mine' ? 'Les dossiers dont vous êtes responsable apparaîtront ici.' : 'Aucun dossier ne correspond à cette vue pour le moment.'}</p>{searchQuery && <button className="button-secondary" onClick={() => setSearchQuery('')}>Effacer la recherche</button>}{!searchQuery && workView !== 'archived' && onCreateCase && <button className="button-secondary" onClick={onCreateCase}><Plus size={15} /> Nouveau dossier</button>}</div>}
        {filteredCases.map((item) => {
          const selected = selectedCaseId === item.id;
          const isWhatsapp = item.channel === 'whatsapp';
          return <button key={item.id} type="button" onClick={() => onSelectCase(item)} className={selected ? 'case-row selected' : 'case-row'} aria-current={selected ? 'true' : undefined}>
            <span className="case-row-top"><strong className="case-customer">{item.customer_name}</strong><time>{formatRelativeDate(item.created_at)}</time></span>
            <span className="case-subject">{item.subject}</span>
            <span className="case-row-bottom"><span className={`badge badge-${item.status}`}>{STATUS_LABELS[item.status]}</span><span className="case-channel" title={CHANNEL_LABELS[item.channel]}>{isWhatsapp ? <MessageSquare size={13} /> : <Mail size={13} />}{CHANNEL_LABELS[item.channel]}</span><span className="case-number">#{item.id}</span></span>
          </button>;
        })}
      </div>
      <div className="sidebar-create"><button className="button-primary" onClick={onCreateCase}><Plus size={16} /> Nouveau dossier <kbd>N</kbd></button></div>
    </aside>
  );
};
