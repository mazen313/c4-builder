// ═══════════════════════════════════════════════════════════════
// CATALOG PANEL
// Settings UI + system catalog browser with search
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { X, Search, Loader2, CheckCircle, AlertCircle, BookOpen, Plug, Plus, RefreshCw, Trash2, Lock, Eye, EyeOff } from 'lucide-react';
import { useCatalog } from './CatalogContext.jsx';

export default function CatalogPanel({ onClose, onAddSystem }) {
  const { catalog, loading, error, catalogUrl, authConfig, loadCatalogFromUrl, loadSampleCatalog, clearCatalog } = useCatalog();
  const [urlInput, setUrlInput] = useState(catalogUrl || '');
  const [username, setUsername] = useState(authConfig?.username || '');
  const [password, setPassword] = useState(authConfig?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(catalog ? 'browse' : 'settings');

  const filteredSystems = useMemo(() => {
    if (!catalog) return { internal: [], external: [], persons: [] };
    const q = search.toLowerCase();
    const filter = (list) => q ? list.filter(s =>
      (s.trigram || s.id || '').toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.group || '').toLowerCase().includes(q)
    ) : list;
    return {
      internal: filter(catalog.systems.internal),
      external: filter(catalog.systems.external),
      persons: filter(catalog.systems.persons),
    };
  }, [catalog, search]);

  const stats = useMemo(() => {
    if (!catalog) return null;
    return {
      systems: catalog.systems.internal.length + catalog.systems.external.length,
      archetypes: catalog.archetypes.containers.length + catalog.archetypes.deploymentNodes.length,
      platform: catalog.platform.length,
      constants: Object.keys(catalog.constants.environments).length + Object.keys(catalog.constants.exchanges).length,
    };
  }, [catalog]);

  const handleConnect = async () => {
    if (!urlInput.trim()) return;
    const auth = username.trim() && password ? { username: username.trim(), password } : null;
    await loadCatalogFromUrl(urlInput.trim(), auth);
    setTab('browse');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-400" />
            <span className="text-white font-semibold text-sm">Company Catalog</span>
            {catalog && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">
                {authConfig ? <Lock size={10} /> : <CheckCircle size={10} />}
                {authConfig ? 'Connected (Auth)' : 'Connected'}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            className={`px-4 py-2 text-xs font-medium ${tab === 'browse' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setTab('browse')}
          >Browse Catalog</button>
          <button
            className={`px-4 py-2 text-xs font-medium ${tab === 'archetypes' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setTab('archetypes')}
          >Archetypes</button>
          <button
            className={`px-4 py-2 text-xs font-medium ${tab === 'constants' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setTab('constants')}
          >Constants</button>
          <button
            className={`px-4 py-2 text-xs font-medium ${tab === 'settings' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setTab('settings')}
          >Settings</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">

          {/* === SETTINGS TAB === */}
          {tab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Catalog URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://git.company.com/raw/repo/main/common"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  />
                  <button
                    onClick={handleConnect}
                    disabled={loading || !urlInput.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded font-medium"
                  >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                    Connect
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  URL should point to the common/ folder served via HTTP (static file server, git raw, or API)
                </p>
              </div>

              {/* Authentication */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Authentication <span className="text-gray-600">(optional)</span></label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Username (LDAP / Azure DevOps)"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password or Personal Access Token"
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 pr-9 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      onKeyDown={e => e.key === 'Enter' && handleConnect()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  For Azure DevOps with LDAP, use your network credentials or a Personal Access Token (PAT).
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="border-t border-gray-700 pt-4">
                <p className="text-xs text-gray-400 mb-2">Or load sample data for testing:</p>
                <button
                  onClick={() => { loadSampleCatalog(); setTab('browse'); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded font-medium"
                >
                  <BookOpen size={12} />
                  Load Sample Catalog
                </button>
              </div>

              {catalog && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400">Catalog loaded from: <span className="text-white">{catalog.baseUrl}</span></p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => catalog.baseUrl !== 'sample' && loadCatalogFromUrl(catalog.baseUrl, authConfig)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-[10px] rounded"
                      >
                        <RefreshCw size={10} /> Reload
                      </button>
                      <button
                        onClick={clearCatalog}
                        className="flex items-center gap-1 px-2 py-1 bg-red-900/50 hover:bg-red-800 text-red-300 text-[10px] rounded"
                      >
                        <Trash2 size={10} /> Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  {stats && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <div className="bg-gray-800 rounded p-2 text-center">
                        <div className="text-lg font-bold text-blue-400">{stats.systems}</div>
                        <div className="text-[10px] text-gray-400">Systems</div>
                      </div>
                      <div className="bg-gray-800 rounded p-2 text-center">
                        <div className="text-lg font-bold text-teal-400">{stats.archetypes}</div>
                        <div className="text-[10px] text-gray-400">Archetypes</div>
                      </div>
                      <div className="bg-gray-800 rounded p-2 text-center">
                        <div className="text-lg font-bold text-purple-400">{stats.platform}</div>
                        <div className="text-[10px] text-gray-400">Platform</div>
                      </div>
                      <div className="bg-gray-800 rounded p-2 text-center">
                        <div className="text-lg font-bold text-amber-400">{stats.constants}</div>
                        <div className="text-[10px] text-gray-400">Constants</div>
                      </div>
                    </div>
                  )}

                  {/* Errors/warnings */}
                  {catalog.errors.length > 0 && (
                    <div className="mt-3 p-2 bg-amber-900/20 border border-amber-800 rounded">
                      <p className="text-[10px] text-amber-400 font-medium mb-1">Warnings ({catalog.errors.length}):</p>
                      {catalog.errors.map((err, i) => (
                        <p key={i} className="text-[10px] text-amber-300/70">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === BROWSE TAB === */}
          {tab === 'browse' && (
            <div className="space-y-3">
              {!catalog ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No catalog loaded</p>
                  <button onClick={() => setTab('settings')} className="text-blue-400 hover:underline text-xs mt-1">
                    Go to Settings to connect
                  </button>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by trigram, name, or description..."
                      className="w-full bg-gray-800 border border-gray-600 rounded pl-8 pr-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>

                  {/* Internal Systems */}
                  {filteredSystems.internal.length > 0 && (
                    <SystemGroup
                      title={`INTERNAL SYSTEMS (${filteredSystems.internal.length})`}
                      systems={filteredSystems.internal}
                      color="blue"
                      onAdd={onAddSystem}
                    />
                  )}

                  {/* External Systems */}
                  {filteredSystems.external.length > 0 && (
                    <SystemGroup
                      title={`EXTERNAL SYSTEMS (${filteredSystems.external.length})`}
                      systems={filteredSystems.external}
                      color="gray"
                      onAdd={onAddSystem}
                    />
                  )}

                  {/* Persons */}
                  {filteredSystems.persons.length > 0 && (
                    <SystemGroup
                      title={`PERSONS (${filteredSystems.persons.length})`}
                      systems={filteredSystems.persons}
                      color="indigo"
                      onAdd={onAddSystem}
                    />
                  )}

                  {search && filteredSystems.internal.length === 0 && filteredSystems.external.length === 0 && filteredSystems.persons.length === 0 && (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      No results for "{search}"
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* === ARCHETYPES TAB === */}
          {tab === 'archetypes' && catalog && (
            <div className="space-y-4">
              {catalog.archetypes.containers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 mb-2">Container Archetypes ({catalog.archetypes.containers.length})</h3>
                  <div className="space-y-1">
                    {catalog.archetypes.containers.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded text-xs">
                        <span>{a.icon || '📦'}</span>
                        <span className="text-white font-medium">{a.label}</span>
                        <span className="text-gray-500">—</span>
                        <span className="text-gray-400">{a.technology}</span>
                        <span className="ml-auto text-[10px] text-gray-600 font-mono">{a.keyword}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {catalog.archetypes.deploymentNodes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 mb-2">Deployment Node Archetypes ({catalog.archetypes.deploymentNodes.length})</h3>
                  <div className="space-y-1">
                    {catalog.archetypes.deploymentNodes.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded text-xs">
                        <span>{a.icon || '🖥️'}</span>
                        <span className="text-white font-medium">{a.label}</span>
                        <span className="text-gray-500">—</span>
                        <span className="text-gray-400">{a.technology}</span>
                        <span className="ml-auto text-[10px] text-gray-600 font-mono">{a.keyword}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {catalog.platform.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 mb-2">Platform Components ({catalog.platform.length})</h3>
                  <div className="space-y-1">
                    {catalog.platform.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded text-xs">
                        <span>🔧</span>
                        <span className="text-white font-medium">{p.label}</span>
                        <span className="text-gray-500">—</span>
                        <span className="text-gray-400">{p.technology}</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400">{p.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === CONSTANTS TAB === */}
          {tab === 'constants' && catalog && (
            <div className="space-y-4">
              {Object.keys(catalog.constants.environments).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 mb-2">Environments</h3>
                  <div className="space-y-1">
                    {Object.entries(catalog.constants.environments).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded text-xs">
                        <span className="font-mono text-amber-400">${'{'}${key}{'}'}</span>
                        <span className="text-gray-500">=</span>
                        <span className="text-white">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(catalog.constants.exchanges).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 mb-2">Exchange Properties</h3>
                  <div className="space-y-1">
                    {Object.entries(catalog.constants.exchanges).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded text-xs">
                        <span className="font-mono text-teal-400">${'{'}${key}{'}'}</span>
                        <span className="text-gray-500">=</span>
                        <span className="text-white">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(catalog.constants.protocols).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 mb-2">Network Protocols</h3>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(catalog.constants.protocols).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded text-xs">
                        <span className="font-mono text-orange-400">{key}</span>
                        <span className="text-gray-400">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(tab === 'archetypes' || tab === 'constants') && !catalog && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
              <p>No catalog loaded</p>
              <button onClick={() => setTab('settings')} className="text-blue-400 hover:underline text-xs mt-1">
                Go to Settings to connect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible group of systems in the browse tab
 */
function SystemGroup({ title, systems, color, onAdd }) {
  const [expanded, setExpanded] = useState(true);
  const colorClasses = {
    blue: 'text-blue-400',
    gray: 'text-gray-400',
    indigo: 'text-indigo-400',
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className={`text-[11px] font-semibold ${colorClasses[color] || 'text-gray-400'} mb-1 flex items-center gap-1 hover:brightness-125`}
      >
        <span>{expanded ? '▾' : '▸'}</span>
        {title}
      </button>
      {expanded && (
        <div className="space-y-0.5 ml-2">
          {systems.map((s, i) => (
            <div key={s.id || s.trigram || i} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 hover:bg-gray-800 rounded group text-xs">
              <span className="text-white font-medium flex-shrink-0">
                {s.trigram ? `${s.trigram}` : s.name}
              </span>
              {s.trigram && s.name && <span className="text-gray-400">— {s.name}</span>}
              {s.group && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{s.group}</span>}
              {onAdd && (
                <button
                  onClick={() => onAdd(s)}
                  className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded transition-opacity"
                  title="Add to diagram"
                >
                  <Plus size={10} /> Add
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
