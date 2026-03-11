// ═══════════════════════════════════════════════════════════════
// CATALOG CONTEXT
// React Context providing company catalog data throughout the app
// ═══════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadCatalog, loadCatalogFromFiles, createSampleCatalog } from './catalogLoader.js';

const CatalogContext = createContext({
  catalog: null,
  loading: false,
  error: null,
  catalogUrl: '',
  authConfig: null,
  loadCatalogFromUrl: async () => {},
  loadCatalogFromFolder: async () => {},
  loadSampleCatalog: () => {},
  clearCatalog: () => {},
});

const STORAGE_KEY = 'c4-catalog-url';
const AUTH_STORAGE_KEY = 'c4-catalog-auth';

/**
 * Persist auth config to localStorage (base64-encoded to avoid plain-text)
 */
function saveAuth(auth) {
  if (auth?.username && auth?.password) {
    localStorage.setItem(AUTH_STORAGE_KEY, btoa(JSON.stringify(auth)));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

/**
 * Load auth config from localStorage
 */
function loadAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(atob(stored));
  } catch {
    return null;
  }
}

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [catalogUrl, setCatalogUrl] = useState('');
  const [authConfig, setAuthConfig] = useState(null);

  const loadCatalogFromUrl = useCallback(async (url, auth = null) => {
    if (!url) return;
    setLoading(true);
    setError(null);
    const effectiveAuth = auth?.username && auth?.password ? auth : null;
    try {
      const result = await loadCatalog(url, effectiveAuth);
      setCatalog(result);
      setCatalogUrl(url);
      setAuthConfig(effectiveAuth);
      localStorage.setItem(STORAGE_KEY, url);
      saveAuth(effectiveAuth);
      if (result.errors.length > 0) {
        console.warn('Catalog loaded with warnings:', result.errors);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog');
      console.error('Failed to load catalog:', err);
    }
    setLoading(false);
  }, []);

  const loadCatalogFromFolder = useCallback(async (fileList) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCatalogFromFiles(fileList);
      setCatalog(result);
      setCatalogUrl('local');
      setAuthConfig(null);
      // Don't persist to localStorage — local files can't be auto-reloaded
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      if (result.errors.length > 0) {
        console.warn('Catalog loaded with warnings:', result.errors);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog from files');
      console.error('Failed to load catalog from files:', err);
    }
    setLoading(false);
  }, []);

  const loadSampleCatalog = useCallback(() => {
    const sample = createSampleCatalog();
    setCatalog(sample);
    setCatalogUrl('sample');
    setError(null);
  }, []);

  const clearCatalog = useCallback(() => {
    setCatalog(null);
    setCatalogUrl('');
    setAuthConfig(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  // Auto-load from localStorage on mount (restores URL + auth)
  useEffect(() => {
    const savedUrl = localStorage.getItem(STORAGE_KEY);
    if (savedUrl && savedUrl !== 'sample') {
      const savedAuth = loadAuth();
      loadCatalogFromUrl(savedUrl, savedAuth);
    }
  }, [loadCatalogFromUrl]);

  return (
    <CatalogContext.Provider value={{
      catalog,
      loading,
      error,
      catalogUrl,
      authConfig,
      loadCatalogFromUrl,
      loadCatalogFromFolder,
      loadSampleCatalog,
      clearCatalog,
    }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  return useContext(CatalogContext);
}

export default CatalogContext;
