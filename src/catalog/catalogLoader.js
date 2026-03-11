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
    constants: { environments: {}, exchanges: {}, protocols: {}, technologies: {} },
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
 * Fetch a single file, returning null on 404 or network error
 *
 * @param {string} baseUrl - Base URL to the common/ folder
 * @param {string} path - Relative path within common/
 * @param {{ username: string, password: string } | null} authConfig - Optional basic auth credentials
 */
async function fetchFile(baseUrl, path, authConfig) {
  const url = `${baseUrl.replace(/\/+$/, '')}/${path}`;
  const headers = {};
  if (authConfig?.username && authConfig?.password) {
    headers['Authorization'] = `Basic ${btoa(authConfig.username + ':' + authConfig.password)}`;
  }
  try {
    const res = await fetch(url, { headers });
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
 * Load the complete company catalog from a base URL.
 *
 * @param {string} baseUrl - URL pointing to the common/ folder
 *   e.g., "https://git.company.com/raw/repo/main/common"
 *   or "http://localhost:3001/common"
 * @param {{ username: string, password: string } | null} authConfig - Optional basic auth credentials
 *   for Azure DevOps or other servers requiring LDAP / PAT authentication
 * @returns {Promise<CompanyCatalog>} - Parsed catalog structure
 */
export async function loadCatalog(baseUrl, authConfig = null) {
  const catalog = emptyCatalog(baseUrl);
  const errors = [];

  // Try loading manifest for file discovery
  const manifest = await loadManifest(baseUrl, authConfig);

  // Determine platform files to load
  let platformPaths = PLATFORM_FILES;
  let deployNodePaths = DEPLOYMENT_NODE_FILES;
  if (manifest?.files) {
    platformPaths = manifest.files.filter(f => f.startsWith('platform/') && f.endsWith('.dsl'));
    deployNodePaths = manifest.files.filter(f => f.startsWith('deploymentsnode/') && f.endsWith('.dsl'));
  }

  // Fetch all core files in parallel
  const coreResults = await Promise.all(
    CORE_FILES.map(async (entry) => {
      const text = await fetchFile(baseUrl, entry.path, authConfig);
      return { ...entry, text };
    })
  );

  // Parse core files
  for (const { path, parser, target, text } of coreResults) {
    if (text === null) {
      errors.push(`Could not load ${path}`);
      continue;
    }
    try {
      const parsed = parser(text);
      setPath(catalog, target, parsed);
    } catch (err) {
      errors.push(`Error parsing ${path}: ${err.message}`);
    }
  }

  // Fetch platform files in parallel
  const platformResults = await Promise.all(
    platformPaths.map(async (path) => {
      const text = await fetchFile(baseUrl, path, authConfig);
      const filename = path.split('/').pop();
      return { path, text, filename };
    })
  );

  for (const { path, text, filename } of platformResults) {
    if (text === null) continue; // Optional files — skip silently
    try {
      const components = parsePlatform(text, filename);
      catalog.platform.push(...components);
    } catch (err) {
      errors.push(`Error parsing ${path}: ${err.message}`);
    }
  }

  // Fetch deployment node files in parallel
  const deployResults = await Promise.all(
    deployNodePaths.map(async (path) => {
      const text = await fetchFile(baseUrl, path, authConfig);
      return { path, text };
    })
  );

  for (const { path, text } of deployResults) {
    if (text === null) continue;
    try {
      const nodes = parseArchetypes(text, 'deploymentNode');
      catalog.archetypes.deploymentNodes.push(...nodes);
    } catch (err) {
      errors.push(`Error parsing ${path}: ${err.message}`);
    }
  }

  // Fetch styles
  const stylesText = await fetchFile(baseUrl, 'styles/styles.dsl', authConfig) || await fetchFile(baseUrl, 'styles', authConfig);
  if (stylesText) catalog.styles = parseStyles(stylesText);

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
 * Matches files by their relative path against CORE_FILES, PLATFORM_FILES, etc.
 *
 * @param {FileList} fileList - Files from a folder picker input
 * @returns {Promise<CompanyCatalog>} - Parsed catalog structure
 */
export async function loadCatalogFromFiles(fileList) {
  const catalog = emptyCatalog('local');
  const errors = [];

  // Build a path→File map, normalizing the relative path.
  // webkitRelativePath gives "folderName/systemcatalog/cmdb.dsl"
  // We strip the first directory segment (the selected folder name) to get the relative path.
  const fileMap = {};
  for (const file of fileList) {
    if (!file.name.endsWith('.dsl') && !file.name.endsWith('.json')) continue;
    const relPath = file.webkitRelativePath.replace(/^[^/]+\//, '');
    fileMap[relPath] = file;
  }

  // Process CORE_FILES
  for (const entry of CORE_FILES) {
    const file = fileMap[entry.path];
    if (!file) {
      errors.push(`File not found: ${entry.path}`);
      continue;
    }
    try {
      const text = await readFileAsText(file);
      if (text) setPath(catalog, entry.target, entry.parser(text));
    } catch (err) {
      errors.push(`Error parsing ${entry.path}: ${err.message}`);
    }
  }

  // Process platform files (any platform/*.dsl found in the folder)
  const platformFiles = Object.entries(fileMap).filter(([p]) => p.startsWith('platform/') && p.endsWith('.dsl'));
  for (const [path, file] of platformFiles) {
    try {
      const text = await readFileAsText(file);
      if (text) catalog.platform.push(...parsePlatform(text, file.name));
    } catch (err) {
      errors.push(`Error parsing ${path}: ${err.message}`);
    }
  }

  // Process deployment node files (any deploymentsnode/*.dsl)
  const deployFiles = Object.entries(fileMap).filter(([p]) => p.startsWith('deploymentsnode/') && p.endsWith('.dsl'));
  for (const [path, file] of deployFiles) {
    try {
      const text = await readFileAsText(file);
      if (text) catalog.archetypes.deploymentNodes.push(...parseArchetypes(text, 'deploymentNode'));
    } catch (err) {
      errors.push(`Error parsing ${path}: ${err.message}`);
    }
  }

  // Process styles
  const stylesFile = fileMap['styles/styles.dsl'] || fileMap['styles'];
  if (stylesFile) {
    const text = await readFileAsText(stylesFile);
    if (text) catalog.styles = parseStyles(text);
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
