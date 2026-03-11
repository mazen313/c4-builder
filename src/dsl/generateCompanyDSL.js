// ═══════════════════════════════════════════════════════════════
// COMPANY-COMPLIANT DSL GENERATOR
// Generates Structurizr DSL using company patterns:
//   workspace extends, !element, archetypes, exchange codes
// ═══════════════════════════════════════════════════════════════

/**
 * Generate company-compliant Structurizr DSL
 *
 * @param {object} workspace - The workspace data model
 * @param {object} catalog - The loaded company catalog (or null)
 * @param {object} config - Workspace configuration
 * @param {string} config.trigram - Application trigram (e.g., "AAD")
 * @param {string} [config.extendsPath] - Path to system-catalog.dsl
 * @param {string} [config.stylesPath] - Path to shared styles
 * @returns {string} - Generated DSL text
 */
export function generateCompanyDSL(workspace, catalog, config = {}) {
  const {
    trigram = workspace.meta?.trigram || workspace.name || 'APP',
    extendsPath = workspace.meta?.extendsPath || '../common/system-catalog.dsl',
    stylesPath = workspace.meta?.stylesIncludePath || '../common/styles',
  } = config;

  const lines = [];
  const ind = (n) => '    '.repeat(n);

  // ─── Header ───
  lines.push(`workspace extends ${extendsPath} {`);
  lines.push(`${ind(1)}name "${trigram}"`);
  lines.push(`${ind(1)}description "${workspace.description || ''}"`);
  lines.push('');
  lines.push(`${ind(1)}properties {`);
  lines.push(`${ind(2)}"COMPANY.agregation" "true"`);
  lines.push(`${ind(1)}}`);
  lines.push('');

  // ─── Model ───
  lines.push(`${ind(1)}model {`);
  lines.push(`${ind(2)}properties {`);
  lines.push(`${ind(3)}"structurizr.groupSeparator" "/"`);
  lines.push(`${ind(3)}"structurizr.tooltips" "true"`);
  lines.push(`${ind(2)}}`);
  lines.push('');

  // Find the main system (matching trigram) and external references
  const mainSystem = workspace.model.softwareSystems.find(s =>
    s.internal && (s.id === trigram || s.name === trigram || s.trigram === trigram)
  ) || workspace.model.softwareSystems.find(s => s.internal);

  // ─── !element block for the main system's containers ───
  if (mainSystem && (mainSystem.containers || []).length > 0) {
    const elementId = mainSystem.trigram || mainSystem.id || trigram;
    lines.push(`${ind(2)}!element ${elementId} {`);

    for (const container of mainSystem.containers) {
      const keyword = container.archetypeKeyword || 'container';
      const hasComponents = (container.components || []).length > 0;

      if (hasComponents) {
        lines.push(`${ind(3)}${container.id} = ${keyword} "${container.name}" "${container.description || ''}" "${container.technology || ''}" {`);
        for (const comp of container.components) {
          const compKeyword = comp.archetypeKeyword || 'component';
          lines.push(`${ind(4)}${comp.id} = ${compKeyword} "${comp.name}" "${comp.description || ''}" "${comp.technology || ''}"`);
        }
        lines.push(`${ind(3)}}`);
      } else {
        lines.push(`${ind(3)}${container.id} = ${keyword} "${container.name}" "${container.description || ''}" "${container.technology || ''}"`);
      }
    }

    lines.push(`${ind(2)}}`);
    lines.push('');
  }

  // ─── Additional persons (not from catalog) ───
  const catalogPersonIds = catalog ? new Set(catalog.systems.persons.map(p => p.id)) : new Set();
  const extraPersons = workspace.model.persons.filter(p => !catalogPersonIds.has(p.id) && !catalogPersonIds.has(p.catalogRef));
  if (extraPersons.length > 0) {
    for (const p of extraPersons) {
      lines.push(`${ind(2)}${p.id} = person "${p.name}" "${p.description || ''}"`);
    }
    lines.push('');
  }

  // ─── Relationships with exchange codes ───
  if (workspace.model.relationships.length > 0) {
    lines.push(`${ind(2)}// Relationships`);
    for (const rel of workspace.model.relationships) {
      const from = rel.from;
      const to = rel.to;
      const label = rel.label || '';
      const tech = rel.technology || '';

      // Build exchange properties if available
      const exchangeProps = [];
      if (rel.exchangeCode) {
        exchangeProps.push(`// Exchange: ${rel.exchangeCode}`);
      }
      if (rel.exchangeProperties) {
        exchangeProps.push(rel.exchangeProperties);
      }

      if (exchangeProps.length > 0) {
        lines.push(`${ind(2)}${from} -> ${to} "${label}" "${tech}" {`);
        for (const prop of exchangeProps) {
          lines.push(`${ind(3)}${prop}`);
        }
        lines.push(`${ind(2)}}`);
      } else {
        lines.push(`${ind(2)}${from} -> ${to} "${label}" "${tech}"`);
      }
    }
    lines.push('');
  }

  // ─── Deployment environments ───
  const deployEnvs = workspace.model.deploymentEnvironments || [];
  if (deployEnvs.length > 0) {
    for (const env of deployEnvs) {
      const envName = env.envConstant
        ? `${trigram}_\${${env.envConstant}}`
        : env.name || 'Default';

      lines.push(`${ind(2)}deploymentEnvironment "${envName}" {`);
      for (const node of (env.nodes || [])) {
        const nodeKeyword = node.archetypeKeyword || 'deploymentNode';
        lines.push(`${ind(3)}${nodeKeyword} "${node.name}" "${node.description || ''}" "${node.technology || ''}" {`);
        for (const ci of (node.containerInstances || [])) {
          lines.push(`${ind(4)}containerInstance ${ci.containerId}`);
        }
        lines.push(`${ind(3)}}`);
      }
      lines.push(`${ind(2)}}`);
      lines.push('');
    }
  } else if ((workspace.model.deploymentNodes || []).length > 0) {
    // Fallback: single default deployment environment
    lines.push(`${ind(2)}deploymentEnvironment "${trigram}_\${ENV_PRD}" {`);
    for (const dn of workspace.model.deploymentNodes) {
      const nodeKeyword = dn.archetypeKeyword || 'deploymentNode';
      const hasCi = (dn.containerInstances || []).length > 0;
      if (hasCi) {
        lines.push(`${ind(3)}${nodeKeyword} "${dn.name}" "${dn.description || ''}" "${dn.technology || ''}" {`);
        for (const ci of dn.containerInstances) {
          lines.push(`${ind(4)}containerInstance ${ci.containerId}`);
        }
        lines.push(`${ind(3)}}`);
      } else {
        lines.push(`${ind(3)}${nodeKeyword} "${dn.name}" "${dn.description || ''}" "${dn.technology || ''}"`);
      }
    }
    lines.push(`${ind(2)}}`);
    lines.push('');
  }

  lines.push(`${ind(1)}}`); // end model
  lines.push('');

  // ─── Views ───
  lines.push(`${ind(1)}views {`);

  if (mainSystem) {
    const sysId = mainSystem.trigram || mainSystem.id;

    // System Context view
    lines.push(`${ind(2)}systemContext ${sysId} "${sysId}_SystemContext" {`);
    lines.push(`${ind(3)}include *`);
    lines.push(`${ind(3)}autoLayout tb`);
    lines.push(`${ind(2)}}`);

    // Container view
    if ((mainSystem.containers || []).length > 0) {
      lines.push(`${ind(2)}container ${sysId} "${sysId}_Containers" {`);
      lines.push(`${ind(3)}include *`);
      lines.push(`${ind(3)}autoLayout tb`);
      lines.push(`${ind(2)}}`);

      // Component views for containers with components
      for (const c of mainSystem.containers) {
        if ((c.components || []).length > 0) {
          lines.push(`${ind(2)}component ${c.id} "${c.id}_Components" {`);
          lines.push(`${ind(3)}include *`);
          lines.push(`${ind(3)}autoLayout tb`);
          lines.push(`${ind(2)}}`);
        }
      }
    }
  }

  // Deployment views
  if (deployEnvs.length > 0) {
    for (const env of deployEnvs) {
      const envName = env.envConstant
        ? `${trigram}_\${${env.envConstant}}`
        : env.name || 'Default';
      const viewKey = env.envConstant || 'default';
      lines.push(`${ind(2)}deployment * "${envName}" "${trigram}_Deployment_${viewKey}" {`);
      lines.push(`${ind(3)}include *`);
      lines.push(`${ind(3)}autoLayout tb`);
      lines.push(`${ind(2)}}`);
    }
  } else if ((workspace.model.deploymentNodes || []).length > 0) {
    lines.push(`${ind(2)}deployment * "${trigram}_\${ENV_PRD}" "${trigram}_Deployment" {`);
    lines.push(`${ind(3)}include *`);
    lines.push(`${ind(3)}autoLayout tb`);
    lines.push(`${ind(2)}}`);
  }

  lines.push('');
  lines.push(`${ind(2)}!include ${stylesPath}`);
  lines.push(`${ind(1)}}`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Validate workspace against company rules.
 * Returns an array of warning/error objects.
 */
export function validateCompanyCompliance(workspace, catalog) {
  const warnings = [];

  if (!workspace.meta?.trigram) {
    warnings.push({ type: 'warning', message: 'No trigram set — workspace name should be a valid application trigram' });
  }

  // Check containers use archetypes
  for (const sys of workspace.model.softwareSystems) {
    for (const c of (sys.containers || [])) {
      if (!c.archetypeKeyword) {
        warnings.push({
          type: 'info',
          message: `Container "${c.name}" uses raw 'container' keyword — consider using an archetype`,
        });
      }
    }
  }

  // Check relationships have exchange codes
  for (const rel of workspace.model.relationships) {
    if (!rel.exchangeCode) {
      warnings.push({
        type: 'info',
        message: `Relationship ${rel.from} -> ${rel.to} has no exchange code — add one following SOURCE_TO_DEST_TYPE convention`,
      });
    }
  }

  // Check deployment nodes use archetypes
  for (const dn of (workspace.model.deploymentNodes || [])) {
    if (!dn.archetypeKeyword) {
      warnings.push({
        type: 'info',
        message: `Deployment node "${dn.name}" uses raw 'deploymentNode' — use an archetype from common/archetypes/`,
      });
    }
  }

  return warnings;
}
