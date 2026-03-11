// ═══════════════════════════════════════════════════════════════
// CATALOG DSL PARSER
// Parses company catalog DSL files into structured data
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all quoted strings from a line
 */
function extractQuoted(str) {
  const matches = [];
  const re = /"([^"]*)"/g;
  let m;
  while ((m = re.exec(str)) !== null) matches.push(m[1]);
  return matches;
}

/**
 * Parse system catalog entries (cmdb.dsl, externalprovider.dsl)
 * Pattern: TRIGRAM = softwareSystem "Name" "Description" { ... }
 * Also handles: TRIGRAM = softwareSystem "Name" "Description" "tags"
 */
export function parseSystems(dslText, isExternal = false) {
  const systems = [];
  const lines = dslText.split('\n');
  let currentGroup = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Track group comments: // --- Domain Name ---
    const groupMatch = trimmed.match(/^\/\/\s*[-=]+\s*(.+?)\s*[-=]+\s*$/);
    if (groupMatch) {
      currentGroup = groupMatch[1].trim();
      continue;
    }

    // Also track group via structurizr group keyword
    const grpMatch = trimmed.match(/^group\s+"([^"]+)"/);
    if (grpMatch) {
      currentGroup = grpMatch[1];
      continue;
    }

    // Skip non-system lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;

    // Match: ID = softwareSystem "Name" "Description" ...
    const sysMatch = trimmed.match(/^(\w+)\s*=\s*softwareSystem\s+/);
    if (sysMatch) {
      const id = sysMatch[1];
      const quoted = extractQuoted(trimmed);
      systems.push({
        trigram: id,
        id,
        name: quoted[0] || id,
        description: quoted[1] || '',
        group: currentGroup,
        internal: !isExternal,
      });
    }
  }

  return systems;
}

/**
 * Parse person definitions
 * Pattern: id = person "Name" "Description"
 */
export function parsePersons(dslText) {
  const persons = [];
  const lines = dslText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^(\w+)\s*=\s*person\s+/);
    if (match) {
      const id = match[1];
      const quoted = extractQuoted(trimmed);
      persons.push({
        id,
        name: quoted[0] || id,
        description: quoted[1] || '',
      });
    }
  }

  return persons;
}

/**
 * Parse archetype/element definitions
 * Handles multiple patterns used in Structurizr DSL:
 *
 * 1. !const pattern:  !const ARCHETYPE_NAME "container" { ... }
 * 2. Element type:    KEYWORD = element "Name" { tags "Container" }
 * 3. Standard:        keyword = container "Name" "Desc" "Tech"
 * 4. Comment-header:  // KEYWORD: Description (Technology)
 *    followed by usage example
 */
export function parseArchetypes(dslText, type = 'container') {
  const archetypes = [];
  const lines = dslText.split('\n');
  let currentSection = '';

  const iconMap = {
    'web': '🌐', 'api': '⚙️', 'database': '🗄️', 'db': '🗄️', 'sql': '🗄️',
    'message': '📨', 'queue': '📨', 'mq': '📨', 'kafka': '📨',
    'cache': '⚡', 'redis': '⚡',
    'file': '📁', 'storage': '📁', 'blob': '📁',
    'batch': '⏱️', 'scheduler': '⏱️', 'cron': '⏱️',
    'gateway': '🚪', 'proxy': '🚪', 'load': '🚪',
    'auth': '🔐', 'keycloak': '🔐', 'sso': '🔐',
    'monitor': '📊', 'log': '📊', 'metric': '📊',
    'mail': '✉️', 'smtp': '✉️', 'email': '✉️',
    'kubernetes': '⎈', 'k8s': '⎈', 'docker': '🐳',
    'server': '🖥️', 'vm': '🖥️', 'node': '🖥️',
    'cloud': '☁️', 'aws': '☁️', 'azure': '☁️', 'gcp': '☁️',
  };

  function guessIcon(label, tech) {
    const combined = `${label} ${tech}`.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (combined.includes(key)) return icon;
    }
    return type === 'deploymentNode' ? '🖥️' : '📦';
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Track section comments
    const sectionMatch = trimmed.match(/^\/\/\s*[-=]+\s*(.+?)\s*[-=]+\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Pattern 1: !const KEYWORD "value"
    const constMatch = trimmed.match(/^!const(?:ant)?\s+(\w+)\s+"([^"]*)"/);
    if (constMatch) {
      const keyword = constMatch[1];
      const value = constMatch[2];
      // If it looks like a type definition (contains container/deploymentNode)
      if (value.includes(type) || keyword.toUpperCase().includes(type.toUpperCase().replace('NODE', ''))) {
        archetypes.push({
          keyword,
          label: keyword.replace(/_/g, ' ').replace(/^(ARCHETYPE|DN|CONTAINER|PLATFORM)\s*/i, ''),
          technology: value,
          icon: guessIcon(keyword, value),
          section: currentSection,
          dslKeyword: type,
        });
      }
      continue;
    }

    // Pattern 2: KEYWORD = container/deploymentNode "Name" "Desc" "Tech"
    const elemMatch = trimmed.match(new RegExp(`^(\\w+)\\s*=\\s*${type}\\s+`));
    if (elemMatch) {
      const keyword = elemMatch[1];
      const quoted = extractQuoted(trimmed);
      archetypes.push({
        keyword,
        label: quoted[0] || keyword.replace(/_/g, ' '),
        description: quoted[1] || '',
        technology: quoted[2] || '',
        icon: guessIcon(keyword, quoted[2] || quoted[0] || ''),
        section: currentSection,
        dslKeyword: type,
      });
      continue;
    }

    // Pattern 3: Standalone keyword definition (no = sign, but defines a reusable type)
    // e.g., ARCHETYPE_WEB_APP "Web Application" "Serves frontend" "React / TypeScript"
    const standaloneMatch = trimmed.match(/^(\w+)\s+"([^"]+)"/);
    if (standaloneMatch && trimmed.match(/"/g)?.length >= 2) {
      const keyword = standaloneMatch[1];
      // Only if keyword looks like an archetype (uppercase with underscores)
      if (keyword === keyword.toUpperCase() || keyword.includes('_')) {
        const quoted = extractQuoted(trimmed);
        archetypes.push({
          keyword,
          label: quoted[0] || keyword.replace(/_/g, ' '),
          description: quoted[1] || '',
          technology: quoted[2] || '',
          icon: guessIcon(keyword, quoted[2] || quoted[0] || ''),
          section: currentSection,
          dslKeyword: type,
        });
      }
    }
  }

  return archetypes;
}

/**
 * Parse relationship archetypes
 * Pattern: REL_KEYWORD = relationship "Label" "Technology"
 * Or: !const REL_HTTP "Uses" "HTTPS"
 */
export function parseRelationships(dslText) {
  const relationships = [];
  const lines = dslText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // !const pattern
    const constMatch = trimmed.match(/^!const(?:ant)?\s+(\w+)\s+/);
    if (constMatch) {
      const keyword = constMatch[1];
      const quoted = extractQuoted(trimmed);
      if (quoted.length >= 1) {
        relationships.push({
          keyword,
          label: quoted[0],
          technology: quoted[1] || '',
        });
      }
      continue;
    }

    // relationship keyword pattern
    const relMatch = trimmed.match(/^(\w+)\s*=\s*relationship\s+/);
    if (relMatch) {
      const keyword = relMatch[1];
      const quoted = extractQuoted(trimmed);
      relationships.push({
        keyword,
        label: quoted[0] || keyword,
        technology: quoted[1] || '',
      });
    }
  }

  return relationships;
}

/**
 * Parse constants/variables
 * Pattern: !constant NAME "value" or !const NAME "value"
 */
export function parseConstants(dslText) {
  const constants = {};
  const lines = dslText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^!const(?:ant)?\s+(\w+)\s+"([^"]*)"/);
    if (match) {
      constants[match[1]] = match[2];
    }
  }

  return constants;
}

/**
 * Parse platform component definitions
 * Pattern varies — could be container definitions, archetypes, or element blocks
 */
export function parsePlatform(dslText, filename = '') {
  const components = [];
  const lines = dslText.split('\n');
  const category = filename.replace(/\.dsl$/, '').replace(/[-_]/g, ' ');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;

    // Match element definitions
    const match = trimmed.match(/^(\w+)\s*=\s*(?:container|softwareSystem|component)\s+/);
    if (match) {
      const keyword = match[1];
      const quoted = extractQuoted(trimmed);
      components.push({
        keyword,
        label: quoted[0] || keyword.replace(/_/g, ' '),
        description: quoted[1] || '',
        technology: quoted[2] || '',
        category: category.charAt(0).toUpperCase() + category.slice(1),
      });
    }
  }

  return components;
}

/**
 * Parse styles DSL (return as-is for !include in generated DSL)
 */
export function parseStyles(dslText) {
  return dslText.trim();
}
