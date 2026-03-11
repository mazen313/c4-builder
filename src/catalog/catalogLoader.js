// ═══════════════════════════════════════════════════════════════
// CATALOG LOADER
// Fetches and parses company catalog DSL files from a URL
// ═══════════════════════════════════════════════════════════════

import {
  parseSystems,
  parsePersons,
  parseArchetypes,
  parseRelationships,
  parseConstants,
  parsePlatform,
  parseStyles,
} from './catalogDslParser.js';

/**
 * Known file paths within the common/ folder structure.
 * Each entry maps a path to a parser function and target location in the catalog.
 */
const CORE_FILES = [
  { path: 'systemcatalog/cmdb.dsl', parser: (txt) => parseSystems(txt, false), target: 'systems.internal' },
  { path: 'systemcatalog/externalprovider.dsl', parser: (txt) => parseSystems(txt, true), target: 'systems.external' },
  { path: 'systemcatalog/person.dsl', parser: parsePersons, target: 'systems.persons' },
  { path: 'systemcatalog/toaddcmdb.dsl', parser: (txt) => parseSystems(txt, false), target: 'systems.pending' },
  { path: 'archetypes/container.dsl', parser: (txt) => parseArchetypes(txt, 'container'), target: 'archetypes.containers' },
  { path: 'archetypes/deploymentnode.dsl', parser: (txt) => parseArchetypes(txt, 'deploymentNode'), target: 'archetypes.deploymentNodes' },
  { path: 'archetypes/relationship.dsl', parser: parseRelationships, target: 'archetypes.relationships' },
  { path: 'constants/environments.dsl', parser: parseConstants, target: 'constants.environments' },
  { path: 'constants/exchanges.dsl', parser: parseConstants, target: 'constants.exchanges' },
  { path: 'constants/protocols.dsl', parser: parseConstants, target: 'constants.protocols' },
  { path: 'constants/technologies.dsl', parser: parseConstants, target: 'constants.technologies' },
];

/**
 * Known platform component files.
 * These are optional — 404s are silently ignored.
 */
const PLATFORM_FILES = [
  'platform/keycloak.dsl',
  'platform/controlm.dsl',
  'platform/mq.dsl',
  'platform/kafka.dsl',
  'platform/cognos.dsl',
  'platform/powerbi.dsl',
  'platform/camunda.dsl',
  'platform/ado.dsl',
];

/**
 * Known deployment node files
 */
const DEPLOYMENT_NODE_FILES = [
  'deploymentsnode/servers.dsl',
  'deploymentsnode/namespaces.dsl',
  'deploymentsnode/constants.dsl',
];

/**
 * Create an empty catalog structure
 */
function emptyCatalog(baseUrl) {
  return {
    loaded: false,
    baseUrl,
    systems: { internal: [], external: [], persons: [], pending: [] },
    archetypes: { containers: [], deploymentNodes: [], relationships: [] },
    constants: { environments: {}, exchanges: {}, protocols: {}, technologies: {}, other: {} },
    platform: [],
    styles: '',
    errors: [],
  };
}

/**
 * Set a nested value on an object using dot-path notation
 * e.g., setPath(obj, 'systems.internal', value)
 */
function setPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  // Merge arrays, overwrite objects
  if (Array.isArray(value) && Array.isArray(current[lastKey])) {
    current[lastKey] = [...current[lastKey], ...value];
  } else if (typeof value === 'object' && !Array.isArray(value) && typeof current[lastKey] === 'object' && !Array.isArray(current[lastKey])) {
    current[lastKey] = { ...current[lastKey], ...value };
  } else {
    current[lastKey] = value;
  }
}

/**
 * Route a file to its parser based on directory and filename patterns.
 * Returns { parser, target } or null if the file should be skipped.
 *
 * Special parser values:
 *   'platform' — use parsePlatform(text, filename)
 *   'styles'   — use parseStyles(text) and concatenate
 */
function routeFile(relPath) {
  if (!relPath.endsWith('.dsl')) return null;

  const parts = relPath.split('/');
  const dir = parts[0].toLowerCase();
  const filename = parts[parts.length - 1].replace(/\.dsl$/i, '').toLowerCase();

  if (dir === 'systemcatalog') {
    if (filename.includes('person'))
      return { parser: parsePersons, target: 'systems.persons' };
    if (filename.includes('external') || filename.includes('provider'))
      return { parser: (txt) => parseSystems(txt, true), target: 'systems.external' };
    if (filename.includes('toadd') || filename.includes('pending'))
      return { parser: (txt) => parseSystems(txt, false), target: 'systems.pending' };
    return { parser: (txt) => parseSystems(txt, false), target: 'systems.internal' };
  }

  if (dir === 'archetypes') {
    if (filename.includes('relationship') || filename.includes('rel'))
      return { parser: parseRelationships, target: 'archetypes.relationships' };
    if (filename.includes('deployment') || filename.includes('node'))
      return { parser: (txt) => parseArchetypes(txt, 'deploymentNode'), target: 'archetypes.deploymentNodes' };
    return { parser: (txt) => parseArchetypes(txt, 'container'), target: 'archetypes.containers' };
  }

  if (dir === 'constants') {
    if (filename.includes('environment') || filename.includes('env'))
      return { parser: parseConstants, target: 'constants.environments' };
    if (filename.includes('exchange'))
      return { parser: parseConstants, target: 'constants.exchanges' };
    if (filename.includes('protocol'))
      return { parser: parseConstants, target: 'constants.protocols' };
    if (filename.includes('technolog'))
      return { parser: parseConstants, target: 'constants.technologies' };
    return { parser: parseConstants, target: 'constants.other' };
  }

  if (dir === 'platform')
    return { parser: 'platform', target: 'platform' };

  if (dir === 'deploymentsnode' || dir === 'deploymentnode' || dir === 'deploymentnodes')
    return { parser: (txt) => parseArchetypes(txt, 'deploymentNode'), target: 'archetypes.deploymentNodes' };

  if (dir === 'styles')
    return { parser: 'styles', target: 'styles' };

  return null;
}

/**
 * Apply a routed file's parsed result to the catalog.
 */
function applyRoute(catalog, route, text, filename) {
  if (route.parser === 'platform') {
    catalog.platform.push(...parsePlatform(text, filename));
  } else if (route.parser === 'styles') {
    const s = parseStyles(text);
    catalog.styles = catalog.styles ? catalog.styles + '\n' + s : s;
  } else {
    setPath(catalog, route.target, route.parser(text));
  }
}

/**
 * Fetch a single file, returning null on 404 or network error.
 *
 * @param {string} baseUrl - Base URL to the common/ folder
 * @param {string} path - Relative path within common/
 * @param {object|null} authConfig - Authentication and connection settings
 * @param {string} [authConfig.authMode] - 'basic' (default) or 'ntlm'
 * @param {string} [authConfig.username] - Username for basic auth
 * @param {string} [authConfig.password] - Password / PAT for basic auth
 * @param {boolean} [authConfig.useProxy] - Route through Vite dev proxy (bypasses CORS + SSL)
 */
async function fetchFile(baseUrl, path, authConfig) {
  // Handle Azure DevOps URLs with ?path= query parameter
  let fullUrl;
  if (baseUrl.includes('?path=') || baseUrl.includes('&path=')) {
    const url = new URL(baseUrl);
    const basePath = url.searchParams.get('path') || '/';
    url.searchParams.set('path', `${basePath.replace(/\/+$/, '')}/${path}`);
    fullUrl = url.toString();
  } else {
    fullUrl = `${baseUrl.replace(/\/+$/, '')}/${path}`;
  }
  const headers = {};
  const fetchOptions = { headers };

  if (authConfig?.useProxy) {
    // Route through Vite dev server proxy — bypasses CORS and accepts custom SSL certs
    const proxyUrl = `/api/catalog-proxy?url=${encodeURIComponent(fullUrl)}`;
    if (authConfig?.authMode === 'ntlm' && authConfig?.username && authConfig?.password) {
      // Send NTLM credentials via custom headers — proxy performs the handshake server-side
      headers['X-NTLM-Username'] = authConfig.username;
      headers['X-NTLM-Password'] = authConfig.password;
      if (authConfig.domain) headers['X-NTLM-Domain'] = authConfig.domain;
    } else if (authConfig?.username && authConfig?.password) {
      headers['Authorization'] = `Basic ${btoa(authConfig.username + ':' + authConfig.password)}`;
    }
    try {
      const res = await fetch(proxyUrl, fetchOptions);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  // Direct browser fetch
  if (authConfig?.authMode === 'ntlm') {
    fetchOptions.credentials = 'include';
  } else if (authConfig?.username && authConfig?.password) {
    headers['Authorization'] = `Basic ${btoa(authConfig.username + ':' + authConfig.password)}`;
  }

  try {
    const res = await fetch(fullUrl, fetchOptions);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Try to load a catalog manifest file that lists all available DSL files.
 * This is optional — if it exists, it enables discovery of platform/* and deploymentsnode/* files.
 */
async function loadManifest(baseUrl, authConfig) {
  const text = await fetchFile(baseUrl, 'catalog-manifest.json', authConfig);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Discover all .dsl files available at the remote URL.
 * Tries (in order):
 *   1. Proxy-based discovery via /api/catalog-discover (lists files server-side, supports Azure DevOps)
 *   2. Manifest file (catalog-manifest.json)
 *   3. Fallback to hardcoded known paths
 */
async function discoverFiles(baseUrl, authConfig) {
  // 1. Try proxy-based directory listing
  if (authConfig?.useProxy) {
    try {
      const headers = {};
      if (authConfig?.authMode === 'ntlm' && authConfig?.username && authConfig?.password) {
        headers['X-NTLM-Username'] = authConfig.username;
        headers['X-NTLM-Password'] = authConfig.password;
        if (authConfig.domain) headers['X-NTLM-Domain'] = authConfig.domain;
      } else if (authConfig?.username && authConfig?.password) {
        headers['Authorization'] = `Basic ${btoa(authConfig.username + ':' + authConfig.password)}`;
      }
      const res = await fetch(`/api/catalog-discover?url=${encodeURIComponent(baseUrl)}`, { headers });
      if (res.ok) {
        const files = await res.json();
        if (Array.isArray(files) && files.length > 0) return files;
      }
    } catch { /* fall through */ }
  }

  // 2. Try manifest
  const manifest = await loadManifest(baseUrl, authConfig);
  if (manifest?.files) return manifest.files;

  // 3. Fallback: hardcoded known paths
  return [
    ...CORE_FILES.map(f => f.path),
    ...PLATFORM_FILES,
    ...DEPLOYMENT_NODE_FILES,
    'styles/styles.dsl',
  ];
}

/**
 * Load the complete company catalog from a base URL.
 * Auto-discovers all .dsl files and routes them to parsers by directory/filename patterns.
 *
 * @param {string} baseUrl - URL pointing to the common/ folder
 * @param {object|null} authConfig - Authentication and connection settings
 * @returns {Promise<CompanyCatalog>} - Parsed catalog structure
 */
export async function loadCatalog(baseUrl, authConfig = null) {
  const catalog = emptyCatalog(baseUrl);
  const errors = [];

  // Discover all files in the remote directory
  const filePaths = await discoverFiles(baseUrl, authConfig);

  // Fetch all files in parallel
  const results = await Promise.all(
    filePaths.map(async (relPath) => {
      const text = await fetchFile(baseUrl, relPath, authConfig);
      return { relPath, text };
    })
  );

  // Route and parse each file
  let filesLoaded = 0;
  for (const { relPath, text } of results) {
    if (!text) continue;
    const route = routeFile(relPath);
    if (!route) continue;

    try {
      const filename = relPath.split('/').pop();
      applyRoute(catalog, route, text, filename);
      filesLoaded++;
    } catch (err) {
      errors.push(`Error parsing ${relPath}: ${err.message}`);
    }
  }

  if (filesLoaded === 0) {
    throw new Error('Could not load any catalog files. Check the URL, credentials, and proxy settings.');
  }

  catalog.loaded = true;
  catalog.errors = errors;

  return catalog;
}

// ═══════════════════════════════════════════════════════════════
// LOCAL FILE LOADING
// Loads catalog from a local folder via <input webkitdirectory>
// ═══════════════════════════════════════════════════════════════

/**
 * Read a File object as text
 */
function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

/**
 * Load catalog from a local FileList (from <input webkitdirectory>).
 * Auto-discovers all .dsl files and routes them to parsers by directory/filename patterns.
 *
 * @param {FileList} fileList - Files from a folder picker input
 * @returns {Promise<CompanyCatalog>} - Parsed catalog structure
 */
export async function loadCatalogFromFiles(fileList) {
  const catalog = emptyCatalog('local');
  const errors = [];

  // Build path → File map, stripping the selected folder name prefix.
  // webkitRelativePath gives "folderName/systemcatalog/cmdb.dsl"
  const fileMap = {};
  for (const file of fileList) {
    if (!file.name.endsWith('.dsl') && !file.name.endsWith('.json')) continue;
    const relPath = file.webkitRelativePath.replace(/^[^/]+\//, '');
    fileMap[relPath] = file;
  }

  // Route and parse every .dsl file
  for (const [relPath, file] of Object.entries(fileMap)) {
    if (!relPath.endsWith('.dsl')) continue;
    const route = routeFile(relPath);
    if (!route) continue;

    try {
      const text = await readFileAsText(file);
      if (!text) continue;
      applyRoute(catalog, route, text, file.name);
    } catch (err) {
      errors.push(`Error parsing ${relPath}: ${err.message}`);
    }
  }

  catalog.loaded = true;
  catalog.errors = errors;
  return catalog;
}

/**
 * Create a demo/sample catalog for testing without a server.
 * This provides realistic data matching the company structure.
 */
export function createSampleCatalog() {
  return {
    loaded: true,
    baseUrl: 'sample',
    systems: {
      internal: [
        { trigram: 'AAD', id: 'AAD', name: 'Auth & Access Directory', description: 'Central authentication and authorization', group: 'Security', internal: true },
        { trigram: 'CRM', id: 'CRM', name: 'Customer Relationship Mgmt', description: 'Customer data and interactions', group: 'Sales', internal: true },
        { trigram: 'ERP', id: 'ERP', name: 'Enterprise Resource Planning', description: 'Core business processes', group: 'Finance', internal: true },
        { trigram: 'DWH', id: 'DWH', name: 'Data Warehouse', description: 'Central data lake and analytics', group: 'Data', internal: true },
        { trigram: 'PRT', id: 'PRT', name: 'Partner Portal', description: 'B2B partner interface', group: 'Integration', internal: true },
        { trigram: 'MBL', id: 'MBL', name: 'Mobile Banking App', description: 'Customer-facing mobile app', group: 'Digital', internal: true },
        { trigram: 'WEB', id: 'WEB', name: 'Web Banking Portal', description: 'Customer-facing web application', group: 'Digital', internal: true },
        { trigram: 'PAY', id: 'PAY', name: 'Payment Gateway', description: 'Payment processing system', group: 'Payments', internal: true },
        { trigram: 'NTF', id: 'NTF', name: 'Notification Service', description: 'Multi-channel notifications', group: 'Integration', internal: true },
        { trigram: 'DOC', id: 'DOC', name: 'Document Management', description: 'Document storage and retrieval', group: 'Content', internal: true },
      ],
      external: [
        { trigram: 'SAP', id: 'SAP', name: 'SAP ERP', description: 'External ERP system', internal: false },
        { trigram: 'SFR', id: 'SFR', name: 'Salesforce', description: 'Cloud CRM platform', internal: false },
        { trigram: 'TWL', id: 'TWL', name: 'Twilio', description: 'SMS and communication API', internal: false },
        { trigram: 'STP', id: 'STP', name: 'SWIFT Network', description: 'International payment network', internal: false },
        { trigram: 'AGR', id: 'AGR', name: 'Atrium', description: 'ITSM and CMDB', internal: false },
      ],
      persons: [
        { id: 'customer', name: 'Customer', description: 'End customer using banking services' },
        { id: 'partner', name: 'Business Partner', description: 'B2B partner organization' },
        { id: 'operator', name: 'Back-office Operator', description: 'Internal back-office user' },
        { id: 'admin', name: 'System Administrator', description: 'IT operations staff' },
      ],
      pending: [],
    },
    archetypes: {
      containers: [
        { keyword: 'WEB_APP', label: 'Web Application', technology: 'React / TypeScript', icon: '🌐', dslKeyword: 'container', section: 'Frontend' },
        { keyword: 'SPA', label: 'Single Page Application', technology: 'Angular', icon: '🌐', dslKeyword: 'container', section: 'Frontend' },
        { keyword: 'API_REST', label: 'REST API', technology: 'Spring Boot / Java', icon: '⚙️', dslKeyword: 'container', section: 'Backend' },
        { keyword: 'API_GRAPHQL', label: 'GraphQL API', technology: 'Node.js / Apollo', icon: '⚙️', dslKeyword: 'container', section: 'Backend' },
        { keyword: 'BATCH_JOB', label: 'Batch Job', technology: 'Spring Batch / Java', icon: '⏱️', dslKeyword: 'container', section: 'Backend' },
        { keyword: 'DB_POSTGRES', label: 'PostgreSQL Database', technology: 'PostgreSQL', icon: '🗄️', dslKeyword: 'container', section: 'Data' },
        { keyword: 'DB_SQLSERVER', label: 'SQL Server Database', technology: 'SQL Server', icon: '🗄️', dslKeyword: 'container', section: 'Data' },
        { keyword: 'DB_ORACLE', label: 'Oracle Database', technology: 'Oracle', icon: '🗄️', dslKeyword: 'container', section: 'Data' },
        { keyword: 'QUEUE_MQ', label: 'MQ Queue', technology: 'IBM MQ', icon: '📨', dslKeyword: 'container', section: 'Messaging' },
        { keyword: 'TOPIC_KAFKA', label: 'Kafka Topic', technology: 'Apache Kafka', icon: '📨', dslKeyword: 'container', section: 'Messaging' },
        { keyword: 'CACHE_REDIS', label: 'Redis Cache', technology: 'Redis', icon: '⚡', dslKeyword: 'container', section: 'Data' },
        { keyword: 'FILE_STORAGE', label: 'File Storage', technology: 'NAS / S3', icon: '📁', dslKeyword: 'container', section: 'Storage' },
      ],
      deploymentNodes: [
        { keyword: 'DN_K8S_CLUSTER', label: 'Kubernetes Cluster', technology: 'Kubernetes', icon: '⎈', dslKeyword: 'deploymentNode' },
        { keyword: 'DN_K8S_NAMESPACE', label: 'Kubernetes Namespace', technology: 'Kubernetes', icon: '⎈', dslKeyword: 'deploymentNode' },
        { keyword: 'DN_DOCKER_HOST', label: 'Docker Host', technology: 'Docker', icon: '🐳', dslKeyword: 'deploymentNode' },
        { keyword: 'DN_VM_LINUX', label: 'Linux Server', technology: 'RHEL 8', icon: '🖥️', dslKeyword: 'deploymentNode' },
        { keyword: 'DN_VM_WINDOWS', label: 'Windows Server', technology: 'Windows Server 2019', icon: '🖥️', dslKeyword: 'deploymentNode' },
        { keyword: 'DN_DB_SERVER', label: 'Database Server', technology: 'Dedicated DB Host', icon: '🗄️', dslKeyword: 'deploymentNode' },
        { keyword: 'DN_CLOUD_AZURE', label: 'Azure Cloud', technology: 'Microsoft Azure', icon: '☁️', dslKeyword: 'deploymentNode' },
      ],
      relationships: [
        { keyword: 'REL_HTTP', label: 'HTTP/HTTPS Call', technology: 'HTTPS' },
        { keyword: 'REL_REST', label: 'REST API Call', technology: 'REST/HTTPS' },
        { keyword: 'REL_SOAP', label: 'SOAP Call', technology: 'SOAP/HTTPS' },
        { keyword: 'REL_JDBC', label: 'JDBC Connection', technology: 'JDBC' },
        { keyword: 'REL_MQ', label: 'MQ Message', technology: 'IBM MQ' },
        { keyword: 'REL_KAFKA', label: 'Kafka Event', technology: 'Apache Kafka' },
        { keyword: 'REL_SFTP', label: 'SFTP Transfer', technology: 'SFTP' },
        { keyword: 'REL_SMTP', label: 'Email', technology: 'SMTP' },
      ],
    },
    constants: {
      environments: {
        ENV_DEV: 'Development',
        ENV_INT: 'Integration',
        ENV_UAT: 'User Acceptance',
        ENV_PRE: 'Pre-Production',
        ENV_PRD: 'Production',
      },
      exchanges: {
        EXCHANGE_NF: 'Network Flow',
        EXCHANGE_NF_REVERSED: 'Network Flow Reversed',
        EXCHANGE_NETWORKPROTOCOLRULE: 'Network Protocol Rule',
      },
      protocols: {
        TCP_443: 'HTTPS',
        TCP_8080: 'HTTP',
        TCP_8443: 'HTTPS Alt',
        TCP_1433: 'SQL Server',
        TCP_5432: 'PostgreSQL',
        TCP_1522: 'Oracle',
        TCP_1414: 'IBM MQ',
        TCP_9092: 'Kafka',
        TCP_6379: 'Redis',
        TCP_22: 'SSH/SFTP',
        TCP_25: 'SMTP',
      },
      technologies: {},
    },
    platform: [
      { keyword: 'PLATFORM_KEYCLOAK', label: 'Keycloak', description: 'Identity & Access Management', technology: 'Keycloak', category: 'Auth' },
      { keyword: 'PLATFORM_CONTROLM', label: 'Control-M', description: 'Job scheduling and orchestration', technology: 'Control-M', category: 'Scheduling' },
      { keyword: 'PLATFORM_MQ', label: 'IBM MQ Manager', description: 'Message queue manager', technology: 'IBM MQ', category: 'Messaging' },
      { keyword: 'PLATFORM_KAFKA', label: 'Kafka Cluster', description: 'Event streaming platform', technology: 'Apache Kafka', category: 'Messaging' },
      { keyword: 'PLATFORM_COGNOS', label: 'Cognos Analytics', description: 'Business intelligence reporting', technology: 'IBM Cognos', category: 'BI' },
      { keyword: 'PLATFORM_POWERBI', label: 'Power BI', description: 'Data visualization and dashboards', technology: 'Microsoft Power BI', category: 'BI' },
      { keyword: 'PLATFORM_CAMUNDA', label: 'Camunda BPM', description: 'Business process management', technology: 'Camunda', category: 'BPM' },
      { keyword: 'PLATFORM_ADO', label: 'Azure DevOps', description: 'CI/CD and project management', technology: 'Azure DevOps', category: 'DevOps' },
    ],
    styles: '',
    errors: [],
  };
}
