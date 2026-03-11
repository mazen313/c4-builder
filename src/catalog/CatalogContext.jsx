// ═══════════════════════════════════════════════════════════════
// CATALOG CONTEXT
// React Context providing company catalog data throughout the app
// ═══════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadCatalog, createSampleCatalog } from './catalogLoader.js';

const CatalogContext = createContext({
  catalog: null,
  loading: false,
  error: null,
  catalogUrl: '',
  loadCatalogFromUrl: async () => {},
  loadSampleCatalog: () => {},
  clearCatalog: () => {},
});

const STORAGE_KEY = 'c4-catalog-url';

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [catalogUrl, setCatalogUrl] = useState('');

  const loadCatalogFromUrl = useCallback(async (url) => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadCatalog(url);
      setCatalog(result);
      setCatalogUrl(url);
      localStorage.setItem(STORAGE_KEY, url);
      if (result.errors.length > 0) {
        console.warn('Catalog loaded with warnings:', result.errors);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog');
      console.error('Failed to load catalog:', err);
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
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Auto-load from localStorage on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem(STORAGE_KEY);
    if (savedUrl && savedUrl !== 'sample') {
      loadCatalogFromUrl(savedUrl);
    }
  }, [loadCatalogFromUrl]);

  return (
    <CatalogContext.Provider value={{
      catalog,
      loading,
      error,
      catalogUrl,
      loadCatalogFromUrl,
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
