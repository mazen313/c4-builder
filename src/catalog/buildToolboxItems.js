// ═══════════════════════════════════════════════════════════════
// DYNAMIC TOOLBOX BUILDER
// Builds toolbox items from loaded company catalog
// Falls back to default items when no catalog is loaded
// ═══════════════════════════════════════════════════════════════

/**
 * Build relationship items from catalog (or defaults)
 */
function buildRelationshipItems(catalog) {
  if (!catalog?.archetypes?.relationships?.length) {
    return [
      { type: 'rel', label: 'Uses / Calls', icon: '➜', preset: 'Uses', subtitle: 'Relationship' },
      { type: 'rel', label: 'Reads from', icon: '➜', preset: 'Reads from', subtitle: 'Relationship' },
      { type: 'rel', label: 'Sends data to', icon: '➜', preset: 'Sends data to', subtitle: 'Relationship' },
      { type: 'rel', label: 'Custom relationship', icon: '✏️', preset: '', subtitle: 'Custom label' },
    ];
  }

  return [
    ...catalog.archetypes.relationships.map(r => ({
      type: 'rel',
      label: r.label,
      icon: '➜',
      preset: r.label,
      subtitle: r.technology || 'Relationship',
      archetypeKeyword: r.keyword,
    })),
    { type: 'rel', label: 'Custom relationship', icon: '✏️', preset: '', subtitle: 'Custom label' },
  ];
}

/**
 * Group items by their section field
 */
function groupBySection(items, sectionName) {
  const groups = {};
  for (const item of items) {
    const section = item._section || sectionName;
    if (!groups[section]) groups[section] = [];
    groups[section].push(item);
  }
  return Object.entries(groups).map(([section, sectionItems]) => ({
    section,
    items: sectionItems.map(({ _section, ...rest }) => rest),
  }));
}

/**
 * Build toolbox items for a given level from catalog data.
 * Returns the same format as the hardcoded TOOLBOX_ITEMS.
 *
 * @param {number} level - Current view level (1-4)
 * @param {object|null} catalog - Loaded catalog, or null for defaults
 * @param {object} defaultItems - The hardcoded TOOLBOX_ITEMS constant
 * @returns {Array} - Array of { section, items } groups
 */
export function buildToolboxItems(level, catalog, defaultItems) {
  // No catalog → use hardcoded defaults
  if (!catalog) return defaultItems[level] || [];

  switch (level) {
    case 1: // System Context
      return buildSystemContextItems(catalog);
    case 2: // Container View
      return buildContainerItems(catalog);
    case 3: // Component View
      return buildComponentItems(catalog, defaultItems);
    case 4: // Deployment View
      return buildDeploymentItems(catalog);
    default:
      return defaultItems[level] || [];
  }
}

/**
 * Level 1: System Context — persons, internal systems, external systems
 */
function buildSystemContextItems(catalog) {
  const sections = [];

  // Actors / Persons
  const personItems = catalog.systems.persons.length > 0
    ? catalog.systems.persons.map(p => ({
        type: 'person', label: p.name, icon: '🧍',
        subtitle: p.description || 'Person',
        catalogRef: p.id,
        preset: { name: p.name, description: p.description },
      }))
    : [{ type: 'person', label: 'Person', icon: '🧍', subtitle: 'Actor' }];

  sections.push({ section: 'ACTORS', items: personItems });

  // Internal Systems from catalog — grouped by domain
  if (catalog.systems.internal.length > 0) {
    const byGroup = {};
    for (const s of catalog.systems.internal) {
      const group = s.group || 'Internal Systems';
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push({
        type: 'softwareSystem', label: `${s.trigram} — ${s.name}`, icon: '🏢',
        subtitle: s.group || 'Internal',
        catalogRef: s.trigram,
        preset: { name: s.name, description: s.description, internal: true },
      });
    }
    for (const [group, items] of Object.entries(byGroup)) {
      sections.push({ section: group.toUpperCase(), items });
    }
  } else {
    sections.push({ section: 'SYSTEMS', items: [
      { type: 'softwareSystem', label: 'Software System', icon: '🏢', subtitle: 'Internal, drillable' },
    ]});
  }

  // External Systems
  if (catalog.systems.external.length > 0) {
    sections.push({
      section: 'EXTERNAL SYSTEMS',
      items: catalog.systems.external.map(s => ({
        type: 'externalSystem', label: s.name, icon: '🤖',
        subtitle: s.description || 'External',
        catalogRef: s.id,
        preset: { name: s.name, description: s.description },
      })),
    });
  } else {
    sections.push({ section: 'EXTERNAL', items: [
      { type: 'externalSystem', label: 'External System', icon: '🤖', subtitle: 'External' },
    ]});
  }

  // Relationships
  sections.push({ section: 'RELATIONSHIPS', items: buildRelationshipItems(catalog) });

  return sections;
}

/**
 * Level 2: Container View — container archetypes, platform components
 */
function buildContainerItems(catalog) {
  const sections = [];

  // Container archetypes grouped by section
  if (catalog.archetypes.containers.length > 0) {
    const bySection = {};
    for (const a of catalog.archetypes.containers) {
      const section = a.section || 'Containers';
      if (!bySection[section]) bySection[section] = [];
      bySection[section].push({
        type: 'container', label: a.label, icon: a.icon || '📦',
        subtitle: a.technology || '',
        archetypeKeyword: a.keyword,
        preset: { technology: a.technology, description: a.description || a.label },
      });
    }
    for (const [section, items] of Object.entries(bySection)) {
      sections.push({ section: section.toUpperCase(), items });
    }
  } else {
    sections.push({ section: 'CONTAINERS', items: [
      { type: 'container', label: 'Web Application', icon: '🌐', subtitle: 'React / TypeScript', preset: { technology: 'React / TypeScript', description: 'Web application' } },
      { type: 'container', label: 'API / Backend', icon: '⚙️', subtitle: 'Node.js / Express', preset: { technology: 'Node.js / Express', description: 'API service' } },
      { type: 'container', label: 'Database', icon: '🗄️', subtitle: 'PostgreSQL', preset: { technology: 'PostgreSQL', description: 'Relational database' } },
      { type: 'container', label: 'Generic Container', icon: '📦', subtitle: 'No preset', preset: null },
    ]});
  }

  // Platform components
  if (catalog.platform.length > 0) {
    const byCategory = {};
    for (const p of catalog.platform) {
      const cat = p.category || 'Platform';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        type: 'container', label: p.label, icon: '🔧',
        subtitle: p.technology || p.category,
        archetypeKeyword: p.keyword,
        preset: { technology: p.technology, description: p.description || p.label },
      });
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      sections.push({ section: `PLATFORM: ${cat.toUpperCase()}`, items });
    }
  }

  // People & External (always available for reference)
  sections.push({ section: 'PEOPLE & EXTERNAL', items: [
    { type: 'person', label: 'Person', icon: '🧍', subtitle: 'Actor' },
    { type: 'externalSystem', label: 'External System', icon: '🔌', subtitle: 'External' },
  ]});

  // Relationships
  sections.push({ section: 'RELATIONSHIPS', items: buildRelationshipItems(catalog) });

  return sections;
}

/**
 * Level 3: Component View — use defaults since archetypes are container-level
 */
function buildComponentItems(catalog, defaultItems) {
  // Components don't typically have company archetypes, use defaults
  return defaultItems[3] || [];
}

/**
 * Level 4: Deployment View — deployment node archetypes
 */
function buildDeploymentItems(catalog) {
  const sections = [];

  if (catalog.archetypes.deploymentNodes.length > 0) {
    sections.push({
      section: 'DEPLOYMENT NODES',
      items: catalog.archetypes.deploymentNodes.map(d => ({
        type: 'deploymentNode', label: d.label, icon: d.icon || '🖥️',
        subtitle: d.technology || '',
        archetypeKeyword: d.keyword,
        preset: { technology: d.technology },
      })),
    });
  } else {
    sections.push({ section: 'DEPLOYMENT NODES', items: [
      { type: 'deploymentNode', label: 'Cloud Provider', icon: '☁️', subtitle: 'AWS / Azure / GCP', preset: { technology: 'Cloud' } },
      { type: 'deploymentNode', label: 'Server', icon: '🖥️', subtitle: 'Physical / VM', preset: { technology: 'Ubuntu Server' } },
      { type: 'deploymentNode', label: 'Kubernetes', icon: '⎈', subtitle: 'K8s cluster / pod', preset: { technology: 'Kubernetes' } },
      { type: 'deploymentNode', label: 'Generic Node', icon: '📦', subtitle: 'No preset', preset: null },
    ]});
  }

  // Container instances
  sections.push({ section: 'CONTAINER INSTANCES', items: [
    { type: 'containerInstance', label: 'Container Instance', icon: '🔗', subtitle: 'Deployed container' },
  ]});

  // Environments (if catalog has them)
  if (catalog.constants?.environments && Object.keys(catalog.constants.environments).length > 0) {
    sections.push({
      section: 'ENVIRONMENTS',
      items: Object.entries(catalog.constants.environments).map(([key, label]) => ({
        type: 'environment', label: label, icon: '🌍',
        subtitle: `\${${key}}`,
        envConstant: key,
      })),
    });
  }

  // Relationships
  sections.push({ section: 'RELATIONSHIPS', items: buildRelationshipItems(catalog) });

  return sections;
}
