import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { ZoomIn, ZoomOut, Home, ChevronRight, ChevronLeft, X, Maximize2, ArrowLeft, ExternalLink, Edit3, Eye, Trash2, Copy, Download, Clipboard, Undo2, Redo2, ChevronDown, ChevronUp, AlertCircle, Check, MoreVertical, Plus, BookOpen, Search } from 'lucide-react';
import { useCatalog } from './catalog/CatalogContext.jsx';
import { buildToolboxItems } from './catalog/buildToolboxItems.js';
import CatalogPanel from './catalog/CatalogPanel.jsx';
import { generateCompanyDSL, validateCompanyCompliance } from './dsl/generateCompanyDSL.js';

// ═══════════════════════════════════════════════════════════════
// DEMO WORKSPACE DATA
// ═══════════════════════════════════════════════════════════════
const DEMO_WORKSPACE = {
  name: "E-Commerce Platform",
  description: "Demo e-commerce architecture",
  model: {
    persons: [
      { id: "customer", name: "Customer", description: "A registered online shopper" },
      { id: "adminUser", name: "Admin User", description: "Internal back-office operator" },
    ],
    softwareSystems: [
      {
        id: "shopApp", name: "Shop Application", description: "Allows customers to browse and purchase products", internal: true,
        containers: [
          { id: "webApp", name: "Web Application", technology: "React / TypeScript", description: "Delivers the SPA to the customer's browser", components: [
            { id: "productCatalog", name: "Product Catalog UI", technology: "React", description: "Browsing and searching products" },
            { id: "cartUI", name: "Shopping Cart UI", technology: "React", description: "Manages cart state and checkout flow" },
            { id: "authUI", name: "Auth UI", technology: "React / OIDC", description: "Login, registration, session management" },
          ]},
          { id: "apiGateway", name: "API Gateway", technology: "Node.js / Express", description: "Single entry point for all API calls; auth & rate-limiting", components: [
            { id: "authMiddleware", name: "Auth Middleware", technology: "JWT / Keycloak", description: "Validates tokens on every request" },
            { id: "router", name: "Request Router", technology: "Express Router", description: "Routes requests to downstream services" },
          ]},
          { id: "orderService", name: "Order Service", technology: "Java 21 / Spring Boot", description: "Manages order lifecycle from creation to fulfilment", components: [
            { id: "orderController", name: "Order Controller", technology: "REST", description: "Handles order CRUD endpoints" },
            { id: "orderProcessor", name: "Order Processor", technology: "Spring Batch", description: "Validates, prices, and persists orders" },
            { id: "eventPublisher", name: "Event Publisher", technology: "Kafka", description: "Publishes order events to message bus" },
          ]},
          { id: "database", name: "Database", technology: "PostgreSQL 16", description: "Primary relational store for orders, users, and products", components: [] },
          { id: "messageBus", name: "Message Bus", technology: "Apache Kafka", description: "Async event backbone between internal services", components: [] },
        ],
      },
      { id: "paymentGw", name: "Payment Gateway", description: "Stripe — handles card payments", internal: false, containers: [] },
      { id: "emailSvc", name: "Email Service", description: "SendGrid — transactional emails", internal: false, containers: [] },
      { id: "idProvider", name: "Identity Provider", description: "Keycloak — SSO & OIDC tokens", internal: false, containers: [] },
    ],
    relationships: [
      { from: "customer", to: "shopApp", label: "Browses & purchases", technology: "HTTPS" },
      { from: "adminUser", to: "shopApp", label: "Manages catalogue", technology: "HTTPS" },
      { from: "shopApp", to: "paymentGw", label: "Processes payments", technology: "HTTPS / REST" },
      { from: "shopApp", to: "emailSvc", label: "Sends notifications", technology: "HTTPS / SMTP" },
      { from: "shopApp", to: "idProvider", label: "Authenticates users", technology: "OIDC / OAuth2" },
      { from: "customer", to: "webApp", label: "Visits", technology: "HTTPS" },
      { from: "webApp", to: "apiGateway", label: "Calls API", technology: "REST / JSON" },
      { from: "apiGateway", to: "orderService", label: "Routes orders", technology: "REST / JSON" },
      { from: "apiGateway", to: "idProvider", label: "Validates tokens", technology: "OIDC" },
      { from: "orderService", to: "database", label: "Reads/writes", technology: "SQL / JDBC" },
      { from: "orderService", to: "messageBus", label: "Publishes events", technology: "Kafka protocol" },
      { from: "orderService", to: "paymentGw", label: "Charges payment", technology: "HTTPS / REST" },
      { from: "orderService", to: "emailSvc", label: "Triggers emails", technology: "HTTPS" },
      { from: "productCatalog", to: "apiGateway", label: "Fetches products", technology: "REST" },
      { from: "cartUI", to: "apiGateway", label: "Submits orders", technology: "REST" },
      { from: "authUI", to: "idProvider", label: "Redirects to login", technology: "OIDC" },
      { from: "authMiddleware", to: "idProvider", label: "Verifies JWT", technology: "HTTPS" },
      { from: "orderController", to: "orderProcessor", label: "Delegates", technology: "In-process" },
      { from: "orderProcessor", to: "database", label: "Persists", technology: "JDBC" },
      { from: "eventPublisher", to: "messageBus", label: "Publishes", technology: "Kafka" },
      { from: "orderProcessor", to: "eventPublisher", label: "Notifies", technology: "In-process" },
    ],
    deploymentNodes: [
      { id: "awsCloud", name: "AWS Cloud", description: "Production cloud environment", technology: "Amazon Web Services",
        containerInstances: [
          { id: "webAppInstance", containerId: "webApp" },
          { id: "apiGatewayInstance", containerId: "apiGateway" },
        ]
      },
      { id: "onPremDc", name: "On-Premises DC", description: "Internal data centre", technology: "VMware / Linux",
        containerInstances: [
          { id: "orderServiceInstance", containerId: "orderService" },
          { id: "databaseInstance", containerId: "database" },
          { id: "messageBusInstance", containerId: "messageBus" },
        ]
      },
    ],
  }
};

// ═══════════════════════════════════════════════════════════════
// TOOLBOX DEFINITIONS PER LEVEL
// ═══════════════════════════════════════════════════════════════
const TOOLBOX_ITEMS = {
  1: [
    { section: 'ACTORS', items: [
      { type: 'person', label: 'Person', icon: '🧍', subtitle: 'Actor' },
      { type: 'externalSystem', label: 'External System', icon: '🤖', subtitle: 'External' },
    ]},
    { section: 'SYSTEMS', items: [
      { type: 'softwareSystem', label: 'Software System', icon: '🏢', subtitle: 'Internal, drillable' },
    ]},
    { section: 'RELATIONSHIPS', items: [
      { type: 'rel', label: 'Uses / Calls', icon: '➜', preset: 'Uses', subtitle: 'Relationship' },
      { type: 'rel', label: 'Reads from', icon: '➜', preset: 'Reads from', subtitle: 'Relationship' },
      { type: 'rel', label: 'Sends data to', icon: '➜', preset: 'Sends data to', subtitle: 'Relationship' },
      { type: 'rel', label: 'Authenticates via', icon: '➜', preset: 'Authenticates via', subtitle: 'Relationship' },
      { type: 'rel', label: 'Custom relationship', icon: '✏️', preset: '', subtitle: 'Custom label' },
    ]},
    { section: 'BOUNDARIES', items: [
      { type: 'boundary', label: 'Enterprise Boundary', icon: '⬜', subtitle: 'Dashed box' },
    ]},
  ],
  2: [
    { section: 'CONTAINERS', items: [
      { type: 'container', label: 'Web Application', icon: '🌐', subtitle: 'React / TypeScript', preset: { technology: 'React / TypeScript', description: 'Web application' } },
      { type: 'container', label: 'API / Backend', icon: '⚙️', subtitle: 'Node.js / Express', preset: { technology: 'Node.js / Express', description: 'API service' } },
      { type: 'container', label: 'Database', icon: '🗄️', subtitle: 'PostgreSQL', preset: { technology: 'PostgreSQL', description: 'Relational database' } },
      { type: 'container', label: 'Message Bus', icon: '📨', subtitle: 'Apache Kafka', preset: { technology: 'Apache Kafka', description: 'Message broker' } },
      { type: 'container', label: 'Generic Container', icon: '📦', subtitle: 'No preset', preset: null },
    ]},
    { section: 'PEOPLE & EXTERNAL', items: [
      { type: 'person', label: 'Person', icon: '🧍', subtitle: 'Actor' },
      { type: 'externalSystem', label: 'External System', icon: '🔌', subtitle: 'External' },
    ]},
    { section: 'RELATIONSHIPS', items: [
      { type: 'rel', label: 'Calls / Uses', icon: '➜', preset: 'Calls', subtitle: 'Relationship' },
      { type: 'rel', label: 'Reads/writes', icon: '➜', preset: 'Reads/writes', subtitle: 'Relationship' },
      { type: 'rel', label: 'Publishes events', icon: '➜', preset: 'Publishes events', subtitle: 'Relationship' },
      { type: 'rel', label: 'Subscribes to', icon: '➜', preset: 'Subscribes to', subtitle: 'Relationship' },
      { type: 'rel', label: 'Custom relationship', icon: '✏️', preset: '', subtitle: 'Custom label' },
    ]},
  ],
  3: [
    { section: 'COMPONENTS', items: [
      { type: 'component', label: 'Controller', icon: '🎛️', subtitle: 'REST', preset: { technology: 'REST', description: 'Handles HTTP requests' } },
      { type: 'component', label: 'Service', icon: '⚙️', subtitle: 'Spring Service', preset: { technology: 'Spring Service', description: 'Business logic service' } },
      { type: 'component', label: 'Repository', icon: '🗃️', subtitle: 'JPA / Hibernate', preset: { technology: 'JPA / Hibernate', description: 'Data access layer' } },
      { type: 'component', label: 'Publisher', icon: '📤', subtitle: 'Kafka', preset: { technology: 'Kafka', description: 'Publishes events' } },
      { type: 'component', label: 'Consumer', icon: '📥', subtitle: 'Kafka', preset: { technology: 'Kafka', description: 'Consumes events' } },
      { type: 'component', label: 'Middleware', icon: '🔒', subtitle: 'Filter / Interceptor', preset: { technology: 'Filter / Interceptor', description: 'Request middleware' } },
      { type: 'component', label: 'Generic Component', icon: '📦', subtitle: 'No preset', preset: null },
    ]},
    { section: 'EXTERNAL TO COMPONENT', items: [
      { type: 'extContainer', label: 'Database', icon: '🗄️', subtitle: 'External container', preset: { technology: 'PostgreSQL', description: 'Database' } },
      { type: 'extContainer', label: 'Message Bus', icon: '📨', subtitle: 'External container', preset: { technology: 'Apache Kafka', description: 'Message broker' } },
      { type: 'extContainer', label: 'External Container', icon: '🔌', subtitle: 'External', preset: null },
    ]},
    { section: 'RELATIONSHIPS', items: [
      { type: 'rel', label: 'Delegates to', icon: '➜', preset: 'Delegates to', subtitle: 'Relationship' },
      { type: 'rel', label: 'Calls', icon: '➜', preset: 'Calls', subtitle: 'Relationship' },
      { type: 'rel', label: 'Persists via', icon: '➜', preset: 'Persists via', subtitle: 'Relationship' },
      { type: 'rel', label: 'Publishes', icon: '➜', preset: 'Publishes', subtitle: 'Relationship' },
      { type: 'rel', label: 'Custom relationship', icon: '✏️', preset: '', subtitle: 'Custom label' },
    ]},
  ],
  4: [
    { section: 'DEPLOYMENT NODES', items: [
      { type: 'deploymentNode', label: 'Cloud Provider', icon: '☁️', subtitle: 'AWS / Azure / GCP', preset: { technology: 'Cloud' } },
      { type: 'deploymentNode', label: 'Server', icon: '🖥️', subtitle: 'Physical / VM', preset: { technology: 'Ubuntu Server' } },
      { type: 'deploymentNode', label: 'Kubernetes', icon: '⎈', subtitle: 'K8s cluster / pod', preset: { technology: 'Kubernetes' } },
      { type: 'deploymentNode', label: 'Docker Host', icon: '🐳', subtitle: 'Docker engine', preset: { technology: 'Docker' } },
      { type: 'deploymentNode', label: 'Generic Node', icon: '📦', subtitle: 'No preset', preset: null },
    ]},
    { section: 'CONTAINER INSTANCES', items: [
      { type: 'containerInstance', label: 'Container Instance', icon: '🔗', subtitle: 'Deployed container' },
    ]},
    { section: 'RELATIONSHIPS', items: [
      { type: 'rel', label: 'Connects to', icon: '➜', preset: 'Connects to', subtitle: 'Network link' },
      { type: 'rel', label: 'Deploys to', icon: '➜', preset: 'Deploys to', subtitle: 'Deployment' },
      { type: 'rel', label: 'Custom relationship', icon: '✏️', preset: '', subtitle: 'Custom label' },
    ]},
  ],
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const COLORS = { person: '#08427b', systemInt: '#1168bd', systemExt: '#999999', container: '#438dd5', component: '#85bbf0', deploymentNode: '#d4a574', containerInstance: '#438dd5' };

function allIdsFromWorkspace(ws) {
  const ids = new Set();
  ws.model.persons.forEach(p => ids.add(p.id));
  ws.model.softwareSystems.forEach(s => { ids.add(s.id); (s.containers || []).forEach(c => { ids.add(c.id); (c.components || []).forEach(co => ids.add(co.id)); }); });
  (ws.model.deploymentNodes || []).forEach(dn => { ids.add(dn.id); (dn.containerInstances || []).forEach(ci => ids.add(ci.id)); });
  return ids;
}

function findElementInWorkspace(ws, id) {
  for (const p of ws.model.persons) if (p.id === id) return { ...p, _type: 'person' };
  for (const s of ws.model.softwareSystems) {
    if (s.id === id) return { ...s, _type: 'softwareSystem' };
    for (const c of (s.containers || [])) {
      if (c.id === id) return { ...c, _type: 'container', _parentSystem: s.id };
      for (const co of (c.components || [])) if (co.id === id) return { ...co, _type: 'component', _parentContainer: c.id, _parentSystem: s.id };
    }
  }
  for (const dn of (ws.model.deploymentNodes || [])) {
    if (dn.id === id) return { ...dn, _type: 'deploymentNode' };
    for (const ci of (dn.containerInstances || [])) if (ci.id === id) return { ...ci, _type: 'containerInstance', _parentDeploymentNode: dn.id };
  }
  return null;
}

function toCamelCase(str) {
  return str.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function generateId(name, existingIds) {
  let base = toCamelCase(name) || 'element';
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(base + i)) i++;
  return base + i;
}

function truncateText(text, maxLen) { return text && text.length > maxLen ? text.slice(0, maxLen) + '…' : text || ''; }
function wrapText(text, maxLen) {
  if (!text || text.length <= maxLen) return [text || ''];
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxLen) { lines.push(cur.trim()); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// ═══════════════════════════════════════════════════════════════
// WORKSPACE REDUCER (undo/redo)
// ═══════════════════════════════════════════════════════════════
function cloneWs(ws) { return JSON.parse(JSON.stringify(ws)); }

function pushUndo(state) {
  const past = [...state.past, cloneWs(state.workspace)];
  if (past.length > 20) past.shift();
  return { past, future: [] };
}

function workspaceReducer(state, action) {
  switch (action.type) {
    case 'LOAD_WORKSPACE': return { workspace: cloneWs(action.payload), past: [], future: [], dirty: false };
    case 'CLEAR_WORKSPACE': return { workspace: { name: 'New Workspace', description: '', model: { persons: [], softwareSystems: [], relationships: [], deploymentNodes: [] } }, past: [...state.past, cloneWs(state.workspace)].slice(-20), future: [], dirty: true };

    case 'ADD_PERSON': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      ws.model.persons.push(action.payload);
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'ADD_SOFTWARE_SYSTEM': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      ws.model.softwareSystems.push(action.payload);
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'ADD_CONTAINER': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const sys = ws.model.softwareSystems.find(s => s.id === action.payload.systemId);
      if (sys) { if (!sys.containers) sys.containers = []; sys.containers.push(action.payload.container); }
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'ADD_COMPONENT': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      for (const sys of ws.model.softwareSystems) {
        const ctr = (sys.containers || []).find(c => c.id === action.payload.containerId);
        if (ctr) { if (!ctr.components) ctr.components = []; ctr.components.push(action.payload.component); break; }
      }
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'ADD_DEPLOYMENT_NODE': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      if (!ws.model.deploymentNodes) ws.model.deploymentNodes = [];
      ws.model.deploymentNodes.push(action.payload);
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'ADD_CONTAINER_INSTANCE': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const dn = (ws.model.deploymentNodes || []).find(d => d.id === action.payload.deploymentNodeId);
      if (dn) { if (!dn.containerInstances) dn.containerInstances = []; dn.containerInstances.push(action.payload.instance); }
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'ADD_RELATIONSHIP': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      ws.model.relationships.push(action.payload);
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'UPDATE_ELEMENT': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const { id, changes } = action.payload;
      let found = ws.model.persons.find(p => p.id === id);
      if (!found) for (const s of ws.model.softwareSystems) {
        if (s.id === id) { found = s; break; }
        for (const c of (s.containers || [])) {
          if (c.id === id) { found = c; break; }
          for (const co of (c.components || [])) if (co.id === id) { found = co; break; }
          if (found) break;
        }
        if (found) break;
      }
      if (!found) for (const dn of (ws.model.deploymentNodes || [])) {
        if (dn.id === id) { found = dn; break; }
        for (const ci of (dn.containerInstances || [])) if (ci.id === id) { found = ci; break; }
        if (found) break;
      }
      if (found) Object.assign(found, changes);
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'DELETE_ELEMENT': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const id = action.payload.id;
      ws.model.persons = ws.model.persons.filter(p => p.id !== id);
      ws.model.softwareSystems = ws.model.softwareSystems.filter(s => s.id !== id);
      for (const s of ws.model.softwareSystems) {
        s.containers = (s.containers || []).filter(c => c.id !== id);
        for (const c of (s.containers || [])) c.components = (c.components || []).filter(co => co.id !== id);
      }
      if (ws.model.deploymentNodes) {
        ws.model.deploymentNodes = ws.model.deploymentNodes.filter(dn => dn.id !== id);
        for (const dn of ws.model.deploymentNodes) dn.containerInstances = (dn.containerInstances || []).filter(ci => ci.id !== id);
      }
      ws.model.relationships = ws.model.relationships.filter(r => r.from !== id && r.to !== id);
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'DUPLICATE_ELEMENT': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const { id, newId } = action.payload;
      const p = ws.model.persons.find(x => x.id === id);
      if (p) { ws.model.persons.push({ ...cloneWs(p), id: newId, name: p.name + ' (copy)' }); }
      for (const s of ws.model.softwareSystems) {
        if (s.id === id) { ws.model.softwareSystems.push({ ...cloneWs(s), id: newId, name: s.name + ' (copy)', containers: [] }); break; }
        const ci = (s.containers || []).findIndex(c => c.id === id);
        if (ci >= 0) { const cl = cloneWs(s.containers[ci]); cl.id = newId; cl.name += ' (copy)'; cl.components = []; s.containers.push(cl); break; }
        for (const c of (s.containers || [])) {
          const coi = (c.components || []).findIndex(co => co.id === id);
          if (coi >= 0) { const cl = cloneWs(c.components[coi]); cl.id = newId; cl.name += ' (copy)'; c.components.push(cl); break; }
        }
      }
      for (const dn of (ws.model.deploymentNodes || [])) {
        if (dn.id === id) { const cl = cloneWs(dn); cl.id = newId; cl.name += ' (copy)'; cl.containerInstances = []; ws.model.deploymentNodes.push(cl); break; }
        const cii = (dn.containerInstances || []).findIndex(ci => ci.id === id);
        if (cii >= 0) { const cl = cloneWs(dn.containerInstances[cii]); cl.id = newId; dn.containerInstances.push(cl); break; }
      }
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'DELETE_RELATIONSHIP': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const { from, to, label } = action.payload;
      ws.model.relationships = ws.model.relationships.filter(r => !(r.from === from && r.to === to && r.label === label));
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'UPDATE_POSITIONS': return { ...state, dirty: true };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { workspace: prev, past: state.past.slice(0, -1), future: [cloneWs(state.workspace), ...state.future].slice(0, 20), dirty: true };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { workspace: next, past: [...state.past, cloneWs(state.workspace)].slice(-20), future: state.future.slice(1), dirty: true };
    }
    case 'SET_WORKSPACE_META': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      ws.meta = { ...(ws.meta || {}), ...action.payload };
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'SET_ELEMENT_ARCHETYPE': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const { id, archetypeKeyword } = action.payload;
      for (const s of ws.model.softwareSystems) {
        for (const c of (s.containers || [])) {
          if (c.id === id) { c.archetypeKeyword = archetypeKeyword; break; }
          for (const co of (c.components || [])) {
            if (co.id === id) { co.archetypeKeyword = archetypeKeyword; break; }
          }
        }
      }
      for (const dn of (ws.model.deploymentNodes || [])) {
        if (dn.id === id) { dn.archetypeKeyword = archetypeKeyword; break; }
      }
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'SET_RELATIONSHIP_EXCHANGE': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const { from, to, label, exchangeCode, exchangeProperties } = action.payload;
      const rel = ws.model.relationships.find(r => r.from === from && r.to === to && r.label === label);
      if (rel) {
        if (exchangeCode !== undefined) rel.exchangeCode = exchangeCode;
        if (exchangeProperties !== undefined) rel.exchangeProperties = exchangeProperties;
      }
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    case 'ADD_CATALOG_SYSTEM': {
      const stk = pushUndo(state); const ws = cloneWs(state.workspace);
      const { system } = action.payload;
      // Add as a software system reference (from catalog)
      const exists = ws.model.softwareSystems.find(s => s.id === system.trigram || s.id === system.id);
      if (!exists) {
        ws.model.softwareSystems.push({
          id: system.trigram || system.id,
          name: system.name,
          description: system.description || '',
          internal: system.internal !== false,
          containers: [],
          catalogRef: system.trigram || system.id,
        });
      }
      return { ...state, workspace: ws, ...stk, dirty: true };
    }
    default: return state;
  }
}

// ═══════════════════════════════════════════════════════════════
// VIEW DATA COMPUTATION
// ═══════════════════════════════════════════════════════════════
function computeViewData(ws, level, systemId, containerId) {
  const rels = ws.model.relationships;
  if (level === 1) {
    const nodes = [];
    ws.model.persons.forEach(p => nodes.push({ id: p.id, name: p.name, description: p.description, type: 'person', w: 100, h: 100 }));
    ws.model.softwareSystems.forEach(s => nodes.push({ id: s.id, name: s.name, description: s.description, type: s.internal ? 'system' : 'systemExt', w: 180, h: 100, drillable: s.internal && (s.containers || []).length > 0 }));
    const nodeIds = new Set(nodes.map(n => n.id));
    // Build child→parent map: container/component IDs → their parent system ID
    const childToSystem = {};
    ws.model.softwareSystems.forEach(s => {
      (s.containers || []).forEach(c => { childToSystem[c.id] = s.id; (c.components || []).forEach(comp => { childToSystem[comp.id] = s.id; }); });
    });
    // Promote relationships: if from/to is a child element, map it to parent system
    const edges = [];
    const edgeKeys = new Set();
    rels.forEach(r => {
      const from = nodeIds.has(r.from) ? r.from : childToSystem[r.from];
      const to = nodeIds.has(r.to) ? r.to : childToSystem[r.to];
      if (from && to && from !== to) {
        const key = `${from}->${to}`;
        if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push({ ...r, from, to }); }
      }
    });
    return { nodes, edges, boundary: null, title: 'System Context', level: 1 };
  }
  if (level === 2) {
    const sys = ws.model.softwareSystems.find(s => s.id === systemId);
    if (!sys) return { nodes: [], edges: [], boundary: null, title: '', level: 2 };
    const nodes = [];
    (sys.containers || []).forEach(c => nodes.push({ id: c.id, name: c.name, description: c.description, technology: c.technology, type: 'container', w: 170, h: 100, inside: true, drillable: (c.components || []).length > 0 }));
    const insideIds = new Set(nodes.map(n => n.id));
    const linkedIds = new Set();
    rels.forEach(r => { if (insideIds.has(r.from)) linkedIds.add(r.to); if (insideIds.has(r.to)) linkedIds.add(r.from); });
    ws.model.persons.forEach(p => { if (linkedIds.has(p.id) && !insideIds.has(p.id)) nodes.push({ id: p.id, name: p.name, description: p.description, type: 'person', w: 100, h: 100, outside: true }); });
    ws.model.softwareSystems.forEach(s => { if (linkedIds.has(s.id) && !insideIds.has(s.id) && s.id !== systemId) nodes.push({ id: s.id, name: s.name, description: s.description, type: 'systemExt', w: 160, h: 90, outside: true }); });
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = rels.filter(r => nodeIds.has(r.from) && nodeIds.has(r.to));
    return { nodes, edges, boundary: { id: sys.id, name: sys.name, description: sys.description }, title: sys.name, level: 2 };
  }
  if (level === 3) {
    let container = null, parentSys = null;
    for (const s of ws.model.softwareSystems) { const c = (s.containers || []).find(c => c.id === containerId); if (c) { container = c; parentSys = s; break; } }
    if (!container) return { nodes: [], edges: [], boundary: null, title: '', level: 3 };
    const nodes = [];
    (container.components || []).forEach(co => nodes.push({ id: co.id, name: co.name, description: co.description, technology: co.technology, type: 'component', w: 170, h: 100, inside: true }));
    const insideIds = new Set(nodes.map(n => n.id));
    const linkedIds = new Set();
    rels.forEach(r => { if (insideIds.has(r.from)) linkedIds.add(r.to); if (insideIds.has(r.to)) linkedIds.add(r.from); });
    for (const s of ws.model.softwareSystems) (s.containers || []).forEach(c => { if (linkedIds.has(c.id) && !insideIds.has(c.id)) nodes.push({ id: c.id, name: c.name, description: c.description, technology: c.technology, type: 'container', w: 170, h: 100, outside: true }); });
    ws.model.softwareSystems.forEach(s => { if (linkedIds.has(s.id) && !insideIds.has(s.id)) nodes.push({ id: s.id, name: s.name, description: s.description, type: 'systemExt', w: 160, h: 90, outside: true }); });
    ws.model.persons.forEach(p => { if (linkedIds.has(p.id) && !insideIds.has(p.id)) nodes.push({ id: p.id, name: p.name, description: p.description, type: 'person', w: 100, h: 100, outside: true }); });
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = rels.filter(r => nodeIds.has(r.from) && nodeIds.has(r.to));
    return { nodes, edges, boundary: { id: container.id, name: container.name, technology: container.technology, description: container.description }, title: container.name, level: 3 };
  }
  if (level === 4) {
    const nodes = [];
    const allContainers = {};
    ws.model.softwareSystems.forEach(s => (s.containers || []).forEach(c => { allContainers[c.id] = c; }));
    (ws.model.deploymentNodes || []).forEach(dn => {
      nodes.push({ id: dn.id, name: dn.name, description: dn.description, technology: dn.technology, type: 'deploymentNode', w: 200, h: 120 });
      (dn.containerInstances || []).forEach(ci => {
        const cont = allContainers[ci.containerId];
        nodes.push({ id: ci.id, name: cont?.name || ci.containerId, description: cont?.description || '', technology: cont?.technology || '', type: 'containerInstance', w: 160, h: 90, containerId: ci.containerId, parentDeploymentNode: dn.id });
      });
    });
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = rels.filter(r => nodeIds.has(r.from) && nodeIds.has(r.to));
    return { nodes, edges, boundary: null, title: 'Deployment View', level: 4 };
  }
  return { nodes: [], edges: [], boundary: null, title: '', level };
}

// ═══════════════════════════════════════════════════════════════
// FORCE-DIRECTED LAYOUT
// ═══════════════════════════════════════════════════════════════
function computeLayout(viewData) {
  const { nodes, edges, boundary } = viewData;
  if (nodes.length === 0) return { positions: {}, boundaryRect: null };
  const pos = {};
  const insideNodes = nodes.filter(n => n.inside);
  const outsideNodes = nodes.filter(n => n.outside);
  const allNodes = boundary ? [...insideNodes, ...outsideNodes] : nodes;

  if (boundary) {
    insideNodes.forEach((n, i) => { const cols = Math.max(2, Math.ceil(Math.sqrt(insideNodes.length))); pos[n.id] = { x: 200 + (i % cols) * 250, y: 200 + Math.floor(i / cols) * 180 }; });
    outsideNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, outsideNodes.length)) * Math.PI * 1.5 - Math.PI * 0.25;
      const cx = 400, cy = 300, radius = 380;
      pos[n.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
  } else {
    nodes.forEach((n, i) => { const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length))); pos[n.id] = { x: 150 + (i % cols) * 250, y: 100 + Math.floor(i / cols) * 200 }; });
  }

  const iterations = 150;
  for (let iter = 0; iter < iterations; iter++) {
    const forces = {}; allNodes.forEach(n => { forces[n.id] = { fx: 0, fy: 0 }; });
    for (let i = 0; i < allNodes.length; i++) for (let j = i + 1; j < allNodes.length; j++) {
      const a = allNodes[i], b = allNodes[j];
      const dx = pos[b.id].x - pos[a.id].x, dy = pos[b.id].y - pos[a.id].y;
      const dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));
      const repulsion = 30000 / (dist * dist);
      const nx = dx / dist, ny = dy / dist;
      forces[a.id].fx -= nx * repulsion; forces[a.id].fy -= ny * repulsion;
      forces[b.id].fx += nx * repulsion; forces[b.id].fy += ny * repulsion;
    }
    for (const e of edges) {
      const pa = pos[e.from], pb = pos[e.to];
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));
      const attract = (dist - 280) * 0.01;
      const nx = dx / dist, ny = dy / dist;
      forces[e.from].fx += nx * attract; forces[e.from].fy += ny * attract;
      forces[e.to].fx -= nx * attract; forces[e.to].fy -= ny * attract;
    }
    const damping = 0.85 - (iter / iterations) * 0.3;
    allNodes.forEach(n => {
      pos[n.id].x += forces[n.id].fx * Math.max(0.05, damping);
      pos[n.id].y += forces[n.id].fy * Math.max(0.05, damping);
    });
  }

  let minX = Infinity, minY = Infinity;
  allNodes.forEach(n => { minX = Math.min(minX, pos[n.id].x); minY = Math.min(minY, pos[n.id].y); });
  allNodes.forEach(n => { pos[n.id].x -= minX - 80; pos[n.id].y -= minY - 80; });

  let boundaryRect = null;
  if (boundary && insideNodes.length > 0) {
    let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
    insideNodes.forEach(n => { bx1 = Math.min(bx1, pos[n.id].x - 30); by1 = Math.min(by1, pos[n.id].y - 30); bx2 = Math.max(bx2, pos[n.id].x + (n.w || 170) + 30); by2 = Math.max(by2, pos[n.id].y + (n.h || 100) + 30); });
    boundaryRect = { x: bx1, y: by1, w: bx2 - bx1, h: by2 - by1 };
  }
  return { positions: pos, boundaryRect };
}

// ═══════════════════════════════════════════════════════════════
// EDGE PATH COMPUTATION
// ═══════════════════════════════════════════════════════════════
function computeEdgePath(from, to, nodes, positions) {
  const fn = nodes.find(n => n.id === from), tn = nodes.find(n => n.id === to);
  if (!fn || !tn || !positions[from] || !positions[to]) return null;
  const fp = positions[from], tp = positions[to];
  const fw = fn.w || 170, fh = fn.h || 100, tw = tn.w || 170, th = tn.h || 100;
  const fcx = fp.x + fw / 2, fcy = fp.y + fh / 2, tcx = tp.x + tw / 2, tcy = tp.y + th / 2;
  const dx = tcx - fcx, dy = tcy - fcy;
  let sx, sy, ex, ey;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) { sx = fp.x + fw; ex = tp.x; } else { sx = fp.x; ex = tp.x + tw; }
    sy = fcy; ey = tcy;
    const mx = (sx + ex) / 2;
    return { path: `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ey} L ${ex} ${ey}`, lx: mx, ly: (sy + ey) / 2 };
  } else {
    if (dy >= 0) { sy = fp.y + fh; ey = tp.y; } else { sy = fp.y; ey = tp.y + th; }
    sx = fcx; ex = tcx;
    const my = (sy + ey) / 2;
    return { path: `M ${sx} ${sy} L ${sx} ${my} L ${ex} ${my} L ${ex} ${ey}`, lx: (sx + ex) / 2, ly: my };
  }
}

// ═══════════════════════════════════════════════════════════════
// COORDINATE TRANSFORMS
// ═══════════════════════════════════════════════════════════════
function screenToSvg(clientX, clientY, canvasEl, pan, zoom) {
  const rect = canvasEl.getBoundingClientRect();
  return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
}
function svgToScreen(svgX, svgY, canvasEl, pan, zoom) {
  const rect = canvasEl.getBoundingClientRect();
  return { x: svgX * zoom + pan.x + rect.left, y: svgY * zoom + pan.y + rect.top };
}

// ═══════════════════════════════════════════════════════════════
// SNAP-TO-GRID & ALIGNMENT GUIDES
// ═══════════════════════════════════════════════════════════════
const GRID_SIZE = 20;
const SNAP_THRESHOLD = 8;

function snapToGrid(val, gridSize) {
  return Math.round(val / gridSize) * gridSize;
}

function computeAlignmentGuides(dragId, dragX, dragY, dragW, dragH, nodes, positions, threshold) {
  const guides = [];
  const snapped = { x: dragX, y: dragY };
  const dragCX = dragX + dragW / 2, dragCY = dragY + dragH / 2;
  const dragR = dragX + dragW, dragB = dragY + dragH;

  for (const n of nodes) {
    if (n.id === dragId) continue;
    const p = positions[n.id];
    if (!p) continue;
    const nW = n.w || 170, nH = n.h || 100;
    const nCX = p.x + nW / 2, nCY = p.y + nH / 2;
    const nR = p.x + nW, nB = p.y + nH;

    // Vertical guides (x-axis alignment)
    for (const [dragVal, label] of [[dragX, 'left'], [dragCX, 'centerX'], [dragR, 'right']]) {
      for (const targetVal of [p.x, nCX, nR]) {
        if (Math.abs(dragVal - targetVal) < threshold) {
          guides.push({ axis: 'x', pos: targetVal });
          if (label === 'left') snapped.x = targetVal;
          else if (label === 'centerX') snapped.x = targetVal - dragW / 2;
          else snapped.x = targetVal - dragW;
        }
      }
    }
    // Horizontal guides (y-axis alignment)
    for (const [dragVal, label] of [[dragY, 'top'], [dragCY, 'centerY'], [dragB, 'bottom']]) {
      for (const targetVal of [p.y, nCY, nB]) {
        if (Math.abs(dragVal - targetVal) < threshold) {
          guides.push({ axis: 'y', pos: targetVal });
          if (label === 'top') snapped.y = targetVal;
          else if (label === 'centerY') snapped.y = targetVal - dragH / 2;
          else snapped.y = targetVal - dragH;
        }
      }
    }
  }
  return { guides, snapped };
}

// ═══════════════════════════════════════════════════════════════
// DSL GENERATOR
// ═══════════════════════════════════════════════════════════════
function generateDSL(ws) {
  const lines = [];
  const indent = (n) => '  '.repeat(n);
  lines.push(`workspace "${ws.name || 'Untitled'}" "${ws.description || ''}" {`);
  lines.push(`${indent(1)}model {`);

  ws.model.persons.forEach(p => {
    lines.push(`${indent(2)}${p.id} = person "${p.name}" "${p.description || ''}"`);
  });
  if (ws.model.persons.length > 0) lines.push('');

  ws.model.softwareSystems.forEach(s => {
    const hasChildren = (s.containers || []).length > 0;
    if (hasChildren) {
      lines.push(`${indent(2)}${s.id} = softwareSystem "${s.name}" "${s.description || ''}" {`);
      (s.containers || []).forEach(c => {
        const hasComps = (c.components || []).length > 0;
        if (hasComps) {
          lines.push(`${indent(3)}${c.id} = container "${c.name}" "${c.description || ''}" "${c.technology || ''}" {`);
          (c.components || []).forEach(co => {
            lines.push(`${indent(4)}${co.id} = component "${co.name}" "${co.description || ''}" "${co.technology || ''}"`);
          });
          lines.push(`${indent(3)}}`);
        } else {
          lines.push(`${indent(3)}${c.id} = container "${c.name}" "${c.description || ''}" "${c.technology || ''}"`);
        }
      });
      lines.push(`${indent(2)}}`);
    } else {
      lines.push(`${indent(2)}${s.id} = softwareSystem "${s.name}" "${s.description || ''}"`);
    }
  });
  if (ws.model.softwareSystems.length > 0) lines.push('');

  ws.model.relationships.forEach(r => {
    lines.push(`${indent(2)}${r.from} -> ${r.to} "${r.label || ''}" "${r.technology || ''}"`);
  });

  lines.push(`${indent(1)}}`);

  // Deployment
  if ((ws.model.deploymentNodes || []).length > 0) {
    lines.push('');
    lines.push(`${indent(1)}deploymentEnvironment "Default" {`);
    (ws.model.deploymentNodes || []).forEach(dn => {
      const hasCi = (dn.containerInstances || []).length > 0;
      if (hasCi) {
        lines.push(`${indent(2)}deploymentNode "${dn.name}" "${dn.description || ''}" "${dn.technology || ''}" {`);
        (dn.containerInstances || []).forEach(ci => {
          lines.push(`${indent(3)}containerInstance ${ci.containerId}`);
        });
        lines.push(`${indent(2)}}`);
      } else {
        lines.push(`${indent(2)}deploymentNode "${dn.name}" "${dn.description || ''}" "${dn.technology || ''}"`);
      }
    });
    lines.push(`${indent(1)}}`);
  }

  lines.push('');
  lines.push(`${indent(1)}views {`);

  ws.model.softwareSystems.filter(s => s.internal).forEach(s => {
    lines.push(`${indent(2)}systemContext ${s.id} "${s.id}Context" {`);
    lines.push(`${indent(3)}include *`);
    lines.push(`${indent(3)}autoLayout tb`);
    lines.push(`${indent(2)}}`);
    if ((s.containers || []).length > 0) {
      lines.push(`${indent(2)}container ${s.id} "${s.id}Containers" {`);
      lines.push(`${indent(3)}include *`);
      lines.push(`${indent(3)}autoLayout tb`);
      lines.push(`${indent(2)}}`);
      (s.containers || []).filter(c => (c.components || []).length > 0).forEach(c => {
        lines.push(`${indent(2)}component ${c.id} "${c.id}Components" {`);
        lines.push(`${indent(3)}include *`);
        lines.push(`${indent(3)}autoLayout tb`);
        lines.push(`${indent(2)}}`);
      });
    }
  });

  if ((ws.model.deploymentNodes || []).length > 0) {
    lines.push(`${indent(2)}deployment * "Default" "defaultDeployment" {`);
    lines.push(`${indent(3)}include *`);
    lines.push(`${indent(3)}autoLayout tb`);
    lines.push(`${indent(2)}}`);
  }

  lines.push('');
  lines.push(`${indent(2)}styles {`);
  lines.push(`${indent(3)}element "Person" {`);
  lines.push(`${indent(4)}shape Person`);
  lines.push(`${indent(4)}background #08427b`);
  lines.push(`${indent(4)}color #ffffff`);
  lines.push(`${indent(3)}}`);
  lines.push(`${indent(3)}element "Software System" {`);
  lines.push(`${indent(4)}background #1168bd`);
  lines.push(`${indent(4)}color #ffffff`);
  lines.push(`${indent(3)}}`);
  lines.push(`${indent(3)}element "Container" {`);
  lines.push(`${indent(4)}background #438dd5`);
  lines.push(`${indent(4)}color #ffffff`);
  lines.push(`${indent(3)}}`);
  lines.push(`${indent(3)}element "Component" {`);
  lines.push(`${indent(4)}background #85bbf0`);
  lines.push(`${indent(4)}color #000000`);
  lines.push(`${indent(3)}}`);
  lines.push(`${indent(2)}}`);
  lines.push(`${indent(1)}}`);
  lines.push('}');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// DSL PARSER
// ═══════════════════════════════════════════════════════════════
function parseDSL(text) {
  const ws = { name: 'Imported Workspace', description: '', meta: {}, model: { persons: [], softwareSystems: [], relationships: [], deploymentNodes: [] } };
  const lines = text.split('\n');
  const idMap = {}; // declared id → element ref
  const contextStack = []; // stack of { type, id, ref }
  let inViews = false;
  let viewsDepth = 0;
  let inProperties = false;
  let propertiesDepth = 0;

  // Extract quoted strings from a line
  function extractQuoted(str) {
    const matches = [];
    const re = /"([^"]*)"/g;
    let m;
    while ((m = re.exec(str)) !== null) matches.push(m[1]);
    return matches;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Count braces on this line
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;

    // Track properties blocks — skip their contents
    if (inProperties) {
      propertiesDepth += openBraces - closeBraces;
      if (propertiesDepth <= 0) { inProperties = false; propertiesDepth = 0; }
      continue;
    }
    if (/^\s*properties\s*\{/.test(raw)) {
      inProperties = true; propertiesDepth = 1;
      continue;
    }

    // Handle !element directive (company pattern)
    if (trimmed.startsWith('!element ')) {
      const elemMatch = trimmed.match(/^!element\s+(\w+)/);
      if (elemMatch) {
        const trigram = elemMatch[1];
        ws.meta.trigram = trigram;
        // Find or create the system to attach containers to
        let sys = ws.model.softwareSystems.find(s => s.id === trigram);
        if (!sys) {
          sys = { id: trigram, name: trigram, description: '', internal: true, containers: [] };
          ws.model.softwareSystems.push(sys);
          idMap[trigram] = sys;
        }
        if (openBraces > closeBraces) contextStack.push({ type: 'system', id: trigram, ref: sys });
      }
      continue;
    }

    // Handle !constant
    if (trimmed.startsWith('!const')) {
      const constMatch = trimmed.match(/^!const(?:ant)?\s+(\w+)\s+"([^"]*)"/);
      if (constMatch) {
        if (!ws.meta.constants) ws.meta.constants = {};
        ws.meta.constants[constMatch[1]] = constMatch[2];
      }
      continue;
    }

    // Handle !include (skip)
    if (trimmed.startsWith('!include')) continue;

    // Skip other directives and tags
    if (trimmed.startsWith('!') || trimmed.startsWith('tags ') || trimmed === 'tags') continue;

    // Track views block — skip its contents
    if (inViews) {
      viewsDepth += openBraces - closeBraces;
      if (viewsDepth <= 0) { inViews = false; viewsDepth = 0; }
      continue;
    }

    // Detect views or configuration block start — skip their contents
    if (/^\s*(views|configuration)\s*(\{|$)/.test(raw)) {
      if (trimmed.includes('{')) { inViews = true; viewsDepth = 1; }
      else { inViews = true; viewsDepth = 0; }
      continue;
    }

    // Workspace declaration (supports "workspace extends <path> {")
    const wsMatch = trimmed.match(/^workspace\s/);
    if (wsMatch) {
      // Check for extends pattern
      const extendsMatch = trimmed.match(/^workspace\s+extends\s+(\S+)/);
      if (extendsMatch) {
        ws.meta.extendsPath = extendsMatch[1];
      }
      const q = extractQuoted(trimmed);
      if (q[0]) ws.name = q[0];
      if (q[1]) ws.description = q[1];
      if (openBraces > closeBraces) contextStack.push({ type: 'workspace' });
      continue;
    }

    // name / description standalone keywords
    if (trimmed.startsWith('name ')) {
      const q = extractQuoted(trimmed);
      if (q[0]) ws.name = q[0];
      continue;
    }
    if (trimmed.startsWith('description ') && contextStack.length <= 2) {
      const q = extractQuoted(trimmed);
      if (q[0]) ws.description = q[0];
      continue;
    }

    // Model block
    if (trimmed === 'model {' || trimmed === 'model') {
      if (trimmed.includes('{')) contextStack.push({ type: 'model' });
      continue;
    }

    // deploymentEnvironment
    if (trimmed.startsWith('deploymentEnvironment ')) {
      const q = extractQuoted(trimmed);
      if (openBraces > closeBraces) contextStack.push({ type: 'deploymentEnvironment', name: q[0] || 'Default' });
      continue;
    }

    // Relationship: <id> -> <id> "label" "tech"  (supports dotted hierarchical IDs like ss.wa)
    const relMatch = trimmed.match(/^([\w.]+)\s*->\s*([\w.]+)\s*(.*)/);
    if (relMatch) {
      const fromRaw = relMatch[1];
      const toRaw = relMatch[2];
      const q = extractQuoted(relMatch[3] || '');
      // Resolve hierarchical IDs: "ss.wa" → use last segment "wa" if it exists in idMap, else try full
      const resolveId = (dotId) => {
        if (idMap[dotId]) return dotId;
        const parts = dotId.split('.');
        const lastPart = parts[parts.length - 1];
        if (idMap[lastPart]) return lastPart;
        return lastPart; // fallback to last segment
      };
      ws.model.relationships.push({ from: resolveId(fromRaw), to: resolveId(toRaw), label: q[0] || '', technology: q[1] || '' });
      continue;
    }

    // Person: <id> = person "name" "desc"
    const personMatch = trimmed.match(/^(\w+)\s*=\s*person\s+(.*)/);
    if (personMatch) {
      const id = personMatch[1];
      const q = extractQuoted(personMatch[2]);
      const person = { id, name: q[0] || id, description: q[1] || '' };
      ws.model.persons.push(person);
      idMap[id] = person;
      continue;
    }

    // Software System: <id> = softwareSystem "name" "desc"
    const sysMatch = trimmed.match(/^(\w+)\s*=\s*softwareSystem\s+(.*)/);
    if (sysMatch) {
      const id = sysMatch[1];
      const q = extractQuoted(sysMatch[2]);
      const sys = { id, name: q[0] || id, description: q[1] || '', internal: true, containers: [] };
      ws.model.softwareSystems.push(sys);
      idMap[id] = sys;
      if (trimmed.includes('{')) contextStack.push({ type: 'softwareSystem', id, ref: sys });
      continue;
    }

    // Container: <id> = container "name" "desc" "tech"
    const contMatch = trimmed.match(/^(\w+)\s*=\s*container\s+(.*)/);
    if (contMatch) {
      const id = contMatch[1];
      const q = extractQuoted(contMatch[2]);
      const cont = { id, name: q[0] || id, description: q[1] || '', technology: q[2] || '', components: [] };
      // Find parent system from context stack
      const parentSys = [...contextStack].reverse().find(c => c.type === 'softwareSystem');
      if (parentSys && parentSys.ref) {
        parentSys.ref.containers.push(cont);
      }
      idMap[id] = cont;
      if (trimmed.includes('{')) contextStack.push({ type: 'container', id, ref: cont });
      continue;
    }

    // Component: <id> = component "name" "desc" "tech"
    const compMatch = trimmed.match(/^(\w+)\s*=\s*component\s+(.*)/);
    if (compMatch) {
      const id = compMatch[1];
      const q = extractQuoted(compMatch[2]);
      const comp = { id, name: q[0] || id, description: q[1] || '', technology: q[2] || '' };
      // Find parent container from context stack
      const parentCont = [...contextStack].reverse().find(c => c.type === 'container');
      if (parentCont && parentCont.ref) {
        parentCont.ref.components.push(comp);
      }
      idMap[id] = comp;
      continue;
    }

    // Deployment environment
    const depEnvMatch = trimmed.match(/^deploymentEnvironment\s+(.*)/);
    if (depEnvMatch) {
      if (trimmed.includes('{')) contextStack.push({ type: 'deploymentEnvironment' });
      continue;
    }

    // Deployment node: deploymentNode "name" "desc" "tech"  OR  id = deploymentNode ...
    const depNodeMatch = trimmed.match(/^(?:(\w+)\s*=\s*)?deploymentNode\s+(.*)/);
    if (depNodeMatch) {
      const q = extractQuoted(depNodeMatch[2]);
      const dnName = q[0] || 'Node';
      const dnId = depNodeMatch[1] || toCamelCase(dnName) || ('dn' + (ws.model.deploymentNodes.length + 1));
      const dn = { id: dnId, name: dnName, description: q[1] || '', technology: q[2] || '', containerInstances: [] };
      ws.model.deploymentNodes.push(dn);
      idMap[dnId] = dn;
      if (trimmed.includes('{')) contextStack.push({ type: 'deploymentNode', id: dnId, ref: dn });
      continue;
    }

    // Container instance: containerInstance <containerId>
    const ciMatch = trimmed.match(/^containerInstance\s+(\w+)/);
    if (ciMatch) {
      const containerId = ciMatch[1];
      const parentDn = [...contextStack].reverse().find(c => c.type === 'deploymentNode');
      if (parentDn && parentDn.ref) {
        const ciId = containerId + 'Instance' + (parentDn.ref.containerInstances.length + 1);
        parentDn.ref.containerInstances.push({ id: ciId, containerId });
      }
      continue;
    }

    // Handle closing braces — pop context
    if (closeBraces > openBraces) {
      for (let b = 0; b < closeBraces - openBraces; b++) {
        if (contextStack.length > 0) contextStack.pop();
      }
      continue;
    }

    // Handle opening braces on lines we didn't match (generic blocks)
    if (openBraces > closeBraces && !relMatch && !personMatch && !sysMatch && !contMatch && !compMatch && !depNodeMatch) {
      contextStack.push({ type: 'unknown' });
    }
  }

  // Mark external systems: systems with no containers that are only referenced as targets
  const sourceIds = new Set(ws.model.relationships.map(r => r.from));
  ws.model.softwareSystems.forEach(s => {
    if (s.containers.length === 0 && !sourceIds.has(s.id)) {
      s.internal = false;
    }
  });

  return ws;
}

function validateWorkspace(ws) {
  const warnings = [];
  const ids = allIdsFromWorkspace(ws);
  ws.model.relationships.forEach(r => {
    if (!ids.has(r.from)) warnings.push(`Relationship source '${r.from}' not found`);
    if (!ids.has(r.to)) warnings.push(`Relationship target '${r.to}' not found`);
  });
  const relIds = new Set();
  ws.model.relationships.forEach(r => { relIds.add(r.from); relIds.add(r.to); });
  ws.model.persons.forEach(p => { if (!relIds.has(p.id)) warnings.push(`Person '${p.name}' has no relationships`); });
  ws.model.softwareSystems.forEach(s => { if (!relIds.has(s.id)) warnings.push(`System '${s.name}' has no relationships`); });
  return warnings;
}

function highlightDSL(text, selectedId) {
  const KEYWORDS = new Set(['workspace','model','views','styles','person','softwareSystem','container','component','systemContext','autoLayout','include','element','shape','background','color','tb']);
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const isSelected = selectedId && line.includes(selectedId + ' =');
    // Tokenize the line character by character
    const tokens = [];
    let j = 0;
    while (j < line.length) {
      // String literal
      if (line[j] === '"') {
        let end = j + 1;
        while (end < line.length && line[end] !== '"') { if (line[end] === '\\') end++; end++; }
        if (end < line.length) end++;
        tokens.push({ type: 'string', text: line.slice(j, end) });
        j = end; continue;
      }
      // Arrow
      if (line[j] === '-' && line[j + 1] === '>') {
        tokens.push({ type: 'arrow', text: '->' });
        j += 2; continue;
      }
      // Word
      if (/[a-zA-Z_]/.test(line[j])) {
        let end = j;
        while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) end++;
        const word = line.slice(j, end);
        // Check if this is an identifier (word followed by spaces then =)
        const rest = line.slice(end);
        const isId = /^\s*=/.test(rest);
        if (isId) tokens.push({ type: 'identifier', text: word });
        else if (KEYWORDS.has(word)) tokens.push({ type: 'keyword', text: word });
        else tokens.push({ type: 'text', text: word });
        j = end; continue;
      }
      // Other characters
      tokens.push({ type: 'text', text: line[j] });
      j++;
    }
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = tokens.map(t => {
      const e = esc(t.text);
      if (t.type === 'string') return `<span style="color:#ce9178">${e}</span>`;
      if (t.type === 'arrow') return `<span style="color:#d4d4d4;font-weight:bold">${e}</span>`;
      if (t.type === 'keyword') return `<span style="color:#569cd6;font-weight:bold">${e}</span>`;
      if (t.type === 'identifier') return `<span style="color:#9cdcfe">${e}</span>`;
      return e;
    }).join('');
    return { html, isSelected, lineNum: i + 1 };
  });
}

// ═══════════════════════════════════════════════════════════════
// SVG ELEMENT RENDERERS
// ═══════════════════════════════════════════════════════════════
function PersonSVG({ node, pos, selected, hovered, onClick, onHover, editMode, onContextMenu, onConnectorDown, onElementDragStart }) {
  const x = pos.x, y = pos.y;
  return (
    <g transform={`translate(${x},${y})`}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={editMode ? (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(node.id, e); } : undefined}
      onMouseDown={editMode ? (e) => { if (e.button === 0) { e.stopPropagation(); onElementDragStart(node.id, e); } } : undefined}
      style={{ cursor: editMode ? 'move' : 'pointer' }}>
      {(selected || hovered) && <rect x={-8} y={-8} width={116} height={116} rx={12} fill="none" stroke={selected ? '#3b82f6' : '#93c5fd'} strokeWidth={2} strokeDasharray={selected ? 'none' : '4 2'} />}
      <circle cx={50} cy={18} r={14} fill={COLORS.person} stroke="white" strokeWidth={2}/>
      <line x1={50} y1={32} x2={50} y2={60} stroke={COLORS.person} strokeWidth={2}/>
      <line x1={30} y1={42} x2={70} y2={42} stroke={COLORS.person} strokeWidth={2}/>
      <line x1={50} y1={60} x2={30} y2={80} stroke={COLORS.person} strokeWidth={2}/>
      <line x1={50} y1={60} x2={70} y2={80} stroke={COLORS.person} strokeWidth={2}/>
      <text x={50} y={92} textAnchor="middle" fill="#333" fontSize={11} fontWeight={600}>{truncateText(node.name, 16)}</text>
      <text x={50} y={104} textAnchor="middle" fill="#666" fontSize={9}>{truncateText(node.description, 20)}</text>
      {editMode && <>{[[50, -4, 'top'], [104, 50, 'right'], [50, 104, 'bottom'], [-4, 50, 'left']].map(([cx, cy, side]) =>
        <circle key={side} cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="white" strokeWidth={1.5} style={{ cursor: 'crosshair', opacity: 0.7 }}
          onMouseDown={(e) => { e.stopPropagation(); onConnectorDown(node.id, x + cx, y + cy, e); }} />
      )}</>}
    </g>
  );
}

function SystemBoxSVG({ node, pos, selected, hovered, onClick, onHover, onDrill, editMode, onContextMenu, onConnectorDown, onElementDragStart }) {
  const fill = node.type === 'system' ? COLORS.systemInt : COLORS.systemExt;
  const x = pos.x, y = pos.y, w = node.w || 180, h = node.h || 100;
  return (
    <g transform={`translate(${x},${y})`}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={editMode ? (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(node.id, e); } : undefined}
      onMouseDown={editMode ? (e) => { if (e.button === 0) { e.stopPropagation(); onElementDragStart(node.id, e); } } : undefined}
      style={{ cursor: editMode ? 'move' : 'pointer' }}>
      {(selected || hovered) && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={12} fill="none" stroke={selected ? '#3b82f6' : '#93c5fd'} strokeWidth={2} />}
      <rect width={w} height={h} rx={8} fill={fill} />
      <text x={w / 2} y={24} textAnchor="middle" fill="white" fontSize={12} fontWeight={700}>{truncateText(node.name, 20)}</text>
      <text x={w / 2} y={42} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={9}>[Software System]</text>
      <text x={w / 2} y={60} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={9}>{truncateText(node.description, 24)}</text>
      {node.drillable && !editMode && hovered && (
        <g onClick={(e) => { e.stopPropagation(); onDrill(node.id); }} style={{ cursor: 'pointer' }}>
          <circle cx={w - 14} cy={h - 14} r={10} fill="rgba(255,255,255,0.25)"/>
          <text x={w - 14} y={h - 10} textAnchor="middle" fill="white" fontSize={12}>⊕</text>
        </g>
      )}
      {editMode && <>{[[w / 2, -4, 'top'], [w + 4, h / 2, 'right'], [w / 2, h + 4, 'bottom'], [-4, h / 2, 'left']].map(([cx, cy, side]) =>
        <circle key={side} cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="white" strokeWidth={1.5} style={{ cursor: 'crosshair', opacity: 0.7 }}
          onMouseDown={(e) => { e.stopPropagation(); onConnectorDown(node.id, x + cx, y + cy, e); }} />
      )}</>}
    </g>
  );
}

function ContainerBoxSVG({ node, pos, selected, hovered, onClick, onHover, onDrill, editMode, onContextMenu, onConnectorDown, onElementDragStart }) {
  const w = node.w || 170, h = node.h || 100;
  const fill = node.drillable ? '#438dd5' : '#5a9bd5';
  const x = pos.x, y = pos.y;
  return (
    <g transform={`translate(${x},${y})`}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={editMode ? (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(node.id, e); } : undefined}
      onMouseDown={editMode ? (e) => { if (e.button === 0) { e.stopPropagation(); onElementDragStart(node.id, e); } } : undefined}
      style={{ cursor: editMode ? 'move' : 'pointer' }}>
      {(selected || hovered) && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={12} fill="none" stroke={selected ? '#3b82f6' : '#93c5fd'} strokeWidth={2} />}
      <rect width={w} height={h} rx={8} fill={fill} />
      <rect x={8} y={6} width={16} height={12} rx={2} fill="rgba(255,255,255,0.3)"/>
      <text x={w / 2} y={28} textAnchor="middle" fill="white" fontSize={12} fontWeight={700}>{truncateText(node.name, 18)}</text>
      <text x={w / 2} y={44} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={9}>[Container]</text>
      <text x={w / 2} y={60} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={9}>{truncateText(node.description, 22)}</text>
      {node.technology && <><rect x={10} y={h - 22} width={w - 20} height={18} rx={9} fill="rgba(0,0,0,0.2)"/><text x={w / 2} y={h - 10} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={8}>{truncateText(node.technology, 22)}</text></>}
      {node.drillable && !editMode && hovered && (
        <g onClick={(e) => { e.stopPropagation(); onDrill(node.id); }} style={{ cursor: 'pointer' }}>
          <circle cx={w - 14} cy={h - 14} r={10} fill="rgba(255,255,255,0.25)"/>
          <text x={w - 14} y={h - 10} textAnchor="middle" fill="white" fontSize={12}>⊕</text>
        </g>
      )}
      {editMode && <>{[[w / 2, -4, 'top'], [w + 4, h / 2, 'right'], [w / 2, h + 4, 'bottom'], [-4, h / 2, 'left']].map(([cx, cy, side]) =>
        <circle key={side} cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="white" strokeWidth={1.5} style={{ cursor: 'crosshair', opacity: 0.7 }}
          onMouseDown={(e) => { e.stopPropagation(); onConnectorDown(node.id, x + cx, y + cy, e); }} />
      )}</>}
    </g>
  );
}

function ComponentBoxSVG({ node, pos, selected, hovered, onClick, onHover, editMode, onContextMenu, onConnectorDown, onElementDragStart }) {
  const w = node.w || 170, h = node.h || 100;
  const x = pos.x, y = pos.y;
  return (
    <g transform={`translate(${x},${y})`}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={editMode ? (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(node.id, e); } : undefined}
      onMouseDown={editMode ? (e) => { if (e.button === 0) { e.stopPropagation(); onElementDragStart(node.id, e); } } : undefined}
      style={{ cursor: editMode ? 'move' : 'pointer' }}>
      {(selected || hovered) && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={12} fill="none" stroke={selected ? '#3b82f6' : '#93c5fd'} strokeWidth={2} />}
      <rect width={w} height={h} rx={8} fill={COLORS.component} />
      <g transform="translate(8,6)"><rect width={16} height={12} rx={2} fill="rgba(0,0,0,0.15)"/><rect x={-4} y={2} width={8} height={3} rx={1} fill="rgba(0,0,0,0.15)"/><rect x={-4} y={7} width={8} height={3} rx={1} fill="rgba(0,0,0,0.15)"/></g>
      <text x={w / 2} y={28} textAnchor="middle" fill="#1a1a1a" fontSize={12} fontWeight={700}>{truncateText(node.name, 18)}</text>
      <text x={w / 2} y={44} textAnchor="middle" fill="rgba(0,0,0,0.5)" fontSize={9}>[Component]</text>
      <text x={w / 2} y={60} textAnchor="middle" fill="rgba(0,0,0,0.7)" fontSize={9}>{truncateText(node.description, 22)}</text>
      {node.technology && <><rect x={10} y={h - 22} width={w - 20} height={18} rx={9} fill="rgba(0,0,0,0.1)"/><text x={w / 2} y={h - 10} textAnchor="middle" fill="rgba(0,0,0,0.6)" fontSize={8}>{truncateText(node.technology, 22)}</text></>}
      {editMode && <>{[[w / 2, -4, 'top'], [w + 4, h / 2, 'right'], [w / 2, h + 4, 'bottom'], [-4, h / 2, 'left']].map(([cx, cy, side]) =>
        <circle key={side} cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="white" strokeWidth={1.5} style={{ cursor: 'crosshair', opacity: 0.7 }}
          onMouseDown={(e) => { e.stopPropagation(); onConnectorDown(node.id, x + cx, y + cy, e); }} />
      )}</>}
    </g>
  );
}

function DeploymentNodeSVG({ node, pos, selected, hovered, onClick, onHover, editMode, onContextMenu, onConnectorDown, onElementDragStart }) {
  const w = node.w || 200, h = node.h || 120;
  const x = pos.x, y = pos.y;
  return (
    <g transform={`translate(${x},${y})`}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={editMode ? (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(node.id, e); } : undefined}
      onMouseDown={editMode ? (e) => { if (e.button === 0) { e.stopPropagation(); onElementDragStart(node.id, e); } } : undefined}
      style={{ cursor: editMode ? 'move' : 'pointer' }}>
      {(selected || hovered) && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={12} fill="none" stroke={selected ? '#3b82f6' : '#93c5fd'} strokeWidth={2} />}
      <rect width={w} height={h} rx={8} fill={COLORS.deploymentNode} strokeDasharray="6 3" stroke="#b8865a" strokeWidth={1.5}/>
      <g transform="translate(10,8)"><rect width={14} height={10} rx={2} fill="rgba(255,255,255,0.4)"/><rect x={2} y={12} width={10} height={2} rx={1} fill="rgba(255,255,255,0.3)"/></g>
      <text x={w / 2} y={30} textAnchor="middle" fill="white" fontSize={12} fontWeight={700}>{truncateText(node.name, 22)}</text>
      <text x={w / 2} y={46} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={9}>[Deployment Node]</text>
      <text x={w / 2} y={64} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={9}>{truncateText(node.description, 26)}</text>
      {node.technology && <><rect x={12} y={h - 24} width={w - 24} height={18} rx={9} fill="rgba(0,0,0,0.15)"/><text x={w / 2} y={h - 12} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={8}>{truncateText(node.technology, 24)}</text></>}
      {editMode && <>{[[w / 2, -4, 'top'], [w + 4, h / 2, 'right'], [w / 2, h + 4, 'bottom'], [-4, h / 2, 'left']].map(([cx, cy, side]) =>
        <circle key={side} cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="white" strokeWidth={1.5} style={{ cursor: 'crosshair', opacity: 0.7 }}
          onMouseDown={(e) => { e.stopPropagation(); onConnectorDown(node.id, x + cx, y + cy, e); }} />
      )}</>}
    </g>
  );
}

function ContainerInstanceSVG({ node, pos, selected, hovered, onClick, onHover, editMode, onContextMenu, onConnectorDown, onElementDragStart }) {
  const w = node.w || 160, h = node.h || 90;
  const x = pos.x, y = pos.y;
  return (
    <g transform={`translate(${x},${y})`}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={editMode ? (e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(node.id, e); } : undefined}
      onMouseDown={editMode ? (e) => { if (e.button === 0) { e.stopPropagation(); onElementDragStart(node.id, e); } } : undefined}
      style={{ cursor: editMode ? 'move' : 'pointer' }}>
      {(selected || hovered) && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={12} fill="none" stroke={selected ? '#3b82f6' : '#93c5fd'} strokeWidth={2} />}
      <rect width={w} height={h} rx={8} fill={COLORS.containerInstance} />
      <text x={w / 2} y={22} textAnchor="middle" fill="white" fontSize={11} fontWeight={700}>{truncateText(node.name, 20)}</text>
      <text x={w / 2} y={38} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={8}>&#171;instance&#187;</text>
      <text x={w / 2} y={54} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={9}>{truncateText(node.description, 22)}</text>
      {node.technology && <><rect x={10} y={h - 20} width={w - 20} height={16} rx={8} fill="rgba(0,0,0,0.2)"/><text x={w / 2} y={h - 9} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={8}>{truncateText(node.technology, 20)}</text></>}
      {editMode && <>{[[w / 2, -4, 'top'], [w + 4, h / 2, 'right'], [w / 2, h + 4, 'bottom'], [-4, h / 2, 'left']].map(([cx, cy, side]) =>
        <circle key={side} cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="white" strokeWidth={1.5} style={{ cursor: 'crosshair', opacity: 0.7 }}
          onMouseDown={(e) => { e.stopPropagation(); onConnectorDown(node.id, x + cx, y + cy, e); }} />
      )}</>}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOOLBOX PANEL
// ═══════════════════════════════════════════════════════════════
function ToolboxPanel({ level, collapsed, setCollapsed, catalogSections }) {
  const sections = catalogSections || TOOLBOX_ITEMS[level] || [];
  const [openSections, setOpenSections] = useState(() => new Set(sections.map(s => s.section)));
  const [toolboxSearch, setToolboxSearch] = useState('');

  useEffect(() => { setOpenSections(new Set(sections.map(s => s.section))); }, [level, sections]);

  const toggleSection = (name) => setOpenSections(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const levelLabels = { 1: 'System Context', 2: 'Container', 3: 'Component', 4: 'Deployment' };

  const onDragStart = (e, item) => {
    e.dataTransfer.setData('application/c4-element', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!toolboxSearch) return sections;
    const q = toolboxSearch.toLowerCase();
    return sections.map(sec => ({
      ...sec,
      items: sec.items.filter(item =>
        item.label.toLowerCase().includes(q) ||
        (item.subtitle || '').toLowerCase().includes(q) ||
        (item.catalogRef || '').toLowerCase().includes(q) ||
        (item.archetypeKeyword || '').toLowerCase().includes(q)
      ),
    })).filter(sec => sec.items.length > 0);
  }, [sections, toolboxSearch]);

  const hasManyItems = sections.reduce((sum, s) => sum + s.items.length, 0) > 12;

  return (
    <div className="w-[220px] bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0 z-10 relative">
      <div className="bg-gray-800 text-white px-3 py-2 text-xs font-bold tracking-wide">
        Toolbox — {levelLabels[level] || 'Unknown'}
      </div>
      {/* Search (shown when catalog has many items) */}
      {hasManyItems && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={toolboxSearch}
              onChange={e => setToolboxSearch(e.target.value)}
              placeholder="Filter..."
              className="w-full bg-white border border-gray-200 rounded pl-7 pr-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSections.map(sec => (
          <div key={sec.section}>
            <button onClick={() => toggleSection(sec.section)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100 rounded">
              {sec.section}
              {openSections.has(sec.section) ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            </button>
            {openSections.has(sec.section) && (
              <div className="space-y-1 mt-1">
                {sec.items.map((item, i) => (
                  <div key={i} draggable onDragStart={(e) => onDragStart(e, item)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg cursor-grab hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm transition-all active:opacity-50 active:cursor-grabbing">
                    <span className="text-lg leading-none">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{item.label}</div>
                      <div className="text-[10px] text-gray-400 truncate">{item.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {toolboxSearch && filteredSections.length === 0 && (
          <div className="text-center py-4 text-gray-400 text-xs">No items match "{toolboxSearch}"</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ELEMENT FORM (post-drop or edit)
// ═══════════════════════════════════════════════════════════════
function ElementForm({ item, screenX, screenY, onSubmit, onCancel, editData }) {
  const [name, setName] = useState(editData?.name || '');
  const [description, setDescription] = useState(editData?.description || item?.preset?.description || '');
  const [technology, setTechnology] = useState(editData?.technology || item?.preset?.technology || '');
  const [tags, setTags] = useState(editData?.tags || '');
  const formRef = useRef(null);

  useEffect(() => { const el = formRef.current?.querySelector('input'); if (el) el.focus(); }, []);

  const handleSubmit = (e) => { e?.preventDefault(); if (name.trim()) onSubmit({ name: name.trim(), description, technology, tags }); };

  return (
    <div ref={formRef} className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72"
      style={{ left: Math.min(screenX, window.innerWidth - 320), top: Math.min(screenY, window.innerHeight - 340) }}
      onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{item?.icon || '📦'}</span>
        <span className="font-bold text-sm text-gray-800">{editData ? 'Edit Element' : (item?.label || 'New Element')}</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Element name"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none" />
        </div>
        {(item?.type === 'container' || item?.type === 'component' || item?.type === 'extContainer' || item?.type === 'deploymentNode' || technology) && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Technology</label>
            <input value={technology} onChange={e => setTechnology(e.target.value)} placeholder="e.g. React, Spring Boot"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none" />
          </div>
        )}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Tags</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Comma-separated"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
          <button type="submit" disabled={!name.trim()} className="px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed">
            {editData ? 'Save' : 'Add to canvas'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTAINER INSTANCE FORM (dropdown selector)
// ═══════════════════════════════════════════════════════════════
function ContainerInstanceForm({ screenX, screenY, containers, onSubmit, onCancel }) {
  const [selectedContainerId, setSelectedContainerId] = useState(containers[0]?.id || '');
  const formRef = useRef(null);

  const handleSubmit = (e) => { e?.preventDefault(); if (selectedContainerId) onSubmit({ containerId: selectedContainerId, name: '' }); };

  return (
    <div ref={formRef} className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72"
      style={{ left: Math.min(screenX, window.innerWidth - 320), top: Math.min(screenY, window.innerHeight - 260) }}
      onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔗</span>
        <span className="font-bold text-sm text-gray-800">Add Container Instance</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Select Container *</label>
          <select value={selectedContainerId} onChange={e => setSelectedContainerId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none">
            {containers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.technology || 'no tech'})</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
          <button type="submit" disabled={!selectedContainerId} className="px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-40">Add instance</button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP MODAL
// ═══════════════════════════════════════════════════════════════
function RelationshipModal({ fromName, toName, onSubmit, onCancel, presetLabel }) {
  const [label, setLabel] = useState(presetLabel || '');
  const [technology, setTechnology] = useState('');
  const ref = useRef(null);
  useEffect(() => { const el = ref.current?.querySelector('input'); if (el) el.focus(); }, []);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div ref={ref} className="bg-white rounded-xl shadow-2xl p-5 w-96" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">New Relationship</h3>
        <div className="text-xs text-gray-500 mb-1">From: <span className="font-semibold text-gray-800">{fromName}</span></div>
        <div className="text-xs text-gray-500 mb-3">To: <span className="font-semibold text-gray-800">{toName}</span></div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Label *</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Sends requests to"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
              onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onSubmit({ label: label.trim(), technology }); }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Technology</label>
            <input value={technology} onChange={e => setTechnology(e.target.value)} placeholder="e.g. HTTPS / REST"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
          <button onClick={() => { if (label.trim()) onSubmit({ label: label.trim(), technology }); }} disabled={!label.trim()}
            className="px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-40">Add</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EDIT PROPERTIES PANEL (inline right-side panel in edit mode)
// ═══════════════════════════════════════════════════════════════
function EditPropertiesSection({ element, relationships, findElement, onUpdate, onDelete, onDuplicate, onDrill, drillLabel, onDeselect }) {
  const [name, setName] = useState(element.name || '');
  const [description, setDescription] = useState(element.description || '');
  const [technology, setTechnology] = useState(element.technology || '');
  const prevId = useRef(element.id);

  useEffect(() => {
    if (prevId.current !== element.id) {
      setName(element.name || '');
      setDescription(element.description || '');
      setTechnology(element.technology || '');
      prevId.current = element.id;
    }
  }, [element]);

  const hasTech = ['container', 'component', 'deploymentNode'].includes(element._type);
  const typeLabel = element._type === 'person' ? 'Person' : element._type === 'softwareSystem' ? 'Software System' : element._type === 'container' ? 'Container' : element._type === 'deploymentNode' ? 'Deployment Node' : element._type === 'containerInstance' ? 'Container Instance' : 'Component';
  const badgeColor = element._type === 'person' ? 'bg-blue-800' : element._type === 'softwareSystem' ? 'bg-blue-600' : element._type === 'container' ? 'bg-teal-600' : element._type === 'deploymentNode' ? 'bg-orange-600' : element._type === 'containerInstance' ? 'bg-teal-600' : 'bg-green-600';

  const applyChanges = () => {
    const changes = { name, description };
    if (hasTech) changes.technology = technology;
    onUpdate(element.id, changes);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${badgeColor}`}>{typeLabel}</span>
        <button onClick={onDeselect} className="text-gray-500 hover:text-white text-[10px]"><X size={12}/></button>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={applyChanges}
          onKeyDown={e => { if (e.key === 'Enter') applyChanges(); }}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"/>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={applyChanges}
          rows={2}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"/>
      </div>
      {hasTech && (
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Technology</label>
          <input value={technology} onChange={e => setTechnology(e.target.value)} onBlur={applyChanges}
            onKeyDown={e => { if (e.key === 'Enter') applyChanges(); }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"/>
        </div>
      )}
      {drillLabel && (
        <button onClick={() => onDrill(element.id)} className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center justify-center gap-1">
          <span>⊕</span> Open {drillLabel} View
        </button>
      )}
      {relationships.length > 0 && (
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase">Relationships</span>
          <div className="mt-1 space-y-1">
            {relationships.map((r, i) => (
              <div key={i} className="text-[11px] text-gray-400 py-0.5">
                <span className="text-gray-200">{findElement(r.from)?.name || r.from}</span>
                <span> → {r.label} → </span>
                <span className="text-gray-200">{findElement(r.to)?.name || r.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onDuplicate(element.id)} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs flex items-center justify-center gap-1"><Copy size={11}/> Duplicate</button>
        <button onClick={() => onDelete(element.id)} className="flex-1 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 rounded text-xs flex items-center justify-center gap-1"><Trash2 size={11}/> Delete</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════════════════
function ContextMenuPopup({ x, y, onEdit, onDelete, onDuplicate, onSetScope, showScope, onClose }) {
  useEffect(() => {
    const handler = () => onClose();
    const tid = setTimeout(() => window.addEventListener('click', handler), 50);
    return () => { clearTimeout(tid); window.removeEventListener('click', handler); };
  }, [onClose]);

  return (
    <div className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-44"
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 200) }}
      onClick={e => e.stopPropagation()}>
      <button onClick={onEdit} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2"><Edit3 size={12}/> Edit properties</button>
      {showScope && <button onClick={onSetScope} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2"><ExternalLink size={12}/> Set as scope</button>}
      <button onClick={onDuplicate} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2"><Copy size={12}/> Duplicate</button>
      <hr className="my-1"/>
      <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={12}/> Delete element</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROPERTIES SIDEBAR (edit mode — right side)
// ═══════════════════════════════════════════════════════════════
function EditSidebar({ element, relationships, findElement, onUpdate, onDelete, onDuplicate, onDrill, drillLabel, onDeselect }) {
  const [collapsed, setCollapsed] = useState(false);
  const [propsOpen, setPropsOpen] = useState(true);
  const prevElId = useRef(element?.id);

  useEffect(() => {
    if (element && element.id !== prevElId.current) { setPropsOpen(true); if (collapsed) setCollapsed(false); }
    prevElId.current = element?.id;
  }, [element, collapsed]);

  if (!element) return null;

  if (collapsed) {
    return (
      <div className="w-8 bg-gray-900 flex flex-col items-center flex-shrink-0 border-l border-gray-700">
        <button onClick={() => setCollapsed(false)} className="mt-2 p-1 text-gray-400 hover:text-white" title="Expand sidebar">
          <ChevronLeft size={14}/>
        </button>
        <span className="text-[9px] text-gray-500 mt-2" style={{ writingMode: 'vertical-rl' }}>Properties</span>
      </div>
    );
  }

  return (
    <div className="w-[280px] bg-gray-900 flex flex-col flex-shrink-0 border-l border-gray-700">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <span className="text-[10px] font-bold text-gray-400 uppercase">Properties</span>
        <button onClick={() => setCollapsed(true)} className="p-1 text-gray-400 hover:text-white" title="Collapse sidebar"><ChevronRight size={13}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div>
          <button onClick={() => setPropsOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 border-b border-gray-700 text-xs font-bold text-gray-300">
            <span>{element.name || 'Element'}</span>
            {propsOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
          {propsOpen && (
            <div className="px-3 py-3 border-b border-gray-700">
              <EditPropertiesSection
                element={element} relationships={relationships} findElement={findElement}
                onUpdate={onUpdate} onDelete={onDelete} onDuplicate={onDuplicate}
                onDrill={onDrill} drillLabel={drillLabel} onDeselect={onDeselect}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DSL FOOTER (edit mode — bottom panel)
// ═══════════════════════════════════════════════════════════════
function DslFooter({ workspace, selectedId }) {
  const { catalog } = useCatalog();
  const dsl = useMemo(() => {
    if (catalog) return generateCompanyDSL(workspace, catalog);
    return generateDSL(workspace);
  }, [workspace, catalog]);
  const highlighted = useMemo(() => highlightDSL(dsl, selectedId), [dsl, selectedId]);
  const baseWarnings = useMemo(() => validateWorkspace(workspace), [workspace]);
  const companyWarnings = useMemo(() => catalog ? validateCompanyCompliance(workspace, catalog) : [], [workspace, catalog]);
  const warnings = useMemo(() => [...baseWarnings, ...companyWarnings], [baseWarnings, companyWarnings]);
  const [open, setOpen] = useState(true);
  const [height, setHeight] = useState(200);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(200);

  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = height;
    const onMove = (ev) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY;
      setHeight(Math.max(80, Math.min(window.innerHeight * 0.7, startH.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height]);

  const copyDSL = () => { navigator.clipboard.writeText(dsl).catch(() => {}); };
  const downloadDSL = () => {
    const blob = new Blob([dsl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'workspace.dsl'; a.click();
    URL.revokeObjectURL(url);
  };
  const openPlayground = () => { navigator.clipboard.writeText(dsl).catch(() => {}); window.open('https://structurizr.com/dsl', '_blank'); };

  return (
    <div className="bg-gray-900 border-t border-gray-700 flex flex-col flex-shrink-0">
      {/* Resize handle */}
      {open && (
        <div onMouseDown={onResizeStart}
          className="h-1 bg-gray-700 hover:bg-blue-500 cursor-ns-resize flex-shrink-0 transition-colors"
          title="Drag to resize" />
      )}
      {/* Header bar */}
      <div onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between px-4 py-1.5 bg-gray-800 cursor-pointer select-none">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-300">Structurizr DSL</span>
          {warnings.length === 0 ? (
            <span className="flex items-center gap-1 text-green-400 text-[10px]"><Check size={10}/> Valid</span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 text-[10px]"><AlertCircle size={10}/> {warnings.length} warning{warnings.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); copyDSL(); }} className="p-1 text-gray-500 hover:text-white" title="Copy DSL"><Clipboard size={12}/></button>
          <button onClick={(e) => { e.stopPropagation(); downloadDSL(); }} className="p-1 text-gray-500 hover:text-white" title="Download .dsl"><Download size={12}/></button>
          <button onClick={(e) => { e.stopPropagation(); openPlayground(); }} className="p-1 text-gray-500 hover:text-white" title="Open in Playground"><ExternalLink size={12}/></button>
          {open ? <ChevronDown size={13} className="text-gray-400 ml-1"/> : <ChevronUp size={13} className="text-gray-400 ml-1"/>}
        </div>
      </div>
      {/* Code area */}
      {open && (
        <div className="overflow-auto font-mono text-[11px] leading-[18px] bg-gray-900" style={{ height }}>
          <table className="w-full border-collapse">
            <tbody>
              {highlighted.map((line, i) => (
                <tr key={i} className={line.isSelected ? 'bg-yellow-500/20' : ''}>
                  <td className="text-right pr-2 pl-3 text-gray-600 select-none w-8 align-top">{line.lineNum}</td>
                  <td className="text-gray-300 pr-3 whitespace-pre" dangerouslySetInnerHTML={{ __html: line.html }}/>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// IMPORT PANEL (modal overlay)
// ═══════════════════════════════════════════════════════════════
function ImportPanel({ onImport, onClose }) {
  const [dslText, setDslText] = useState('');
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);

  const handleParse = () => {
    setError(null); setPreview(null); setParsed(null);
    const trimmed = dslText.trim();
    if (!trimmed) { setError('Please paste a DSL string first.'); return; }
    try {
      const ws = parseDSL(trimmed);
      const persons = ws.model.persons.length;
      const systems = ws.model.softwareSystems.length;
      const containers = ws.model.softwareSystems.reduce((n, s) => n + (s.containers || []).length, 0);
      const components = ws.model.softwareSystems.reduce((n, s) => n + (s.containers || []).reduce((m, c) => m + (c.components || []).length, 0), 0);
      const rels = ws.model.relationships.length;
      if (persons + systems === 0) { setError('No elements found. Check your DSL syntax.'); return; }
      setPreview({ persons, systems, containers, components, rels, name: ws.name });
      setParsed(ws);
    } catch (e) {
      setError('Parse error: ' + (e.message || 'Unknown error'));
    }
  };

  const handleImport = () => { if (parsed) { onImport(parsed); onClose(); } };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <span className="text-sm font-bold text-white">Import Structurizr DSL</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
          <textarea
            className="w-full h-[280px] bg-gray-800 border border-gray-600 rounded-lg p-3 text-gray-200 text-xs font-mono resize-none focus:outline-none focus:border-blue-500"
            placeholder={'Paste Structurizr DSL here...\n\nworkspace "My System" "Description" {\n  model {\n    user = person "User" "A user"\n    sys = softwareSystem "System" "My system" {\n      web = container "Web App" "" "React"\n    }\n    user -> sys "Uses" "HTTPS"\n  }\n  views { ... }\n}'}
            value={dslText}
            onChange={e => { setDslText(e.target.value); setError(null); setPreview(null); setParsed(null); }}
          />

          {/* Error */}
          {error && <div className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12}/> {error}</div>}

          {/* Preview */}
          {preview && (
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs">
              <div className="text-green-400 font-semibold mb-1 flex items-center gap-1"><Check size={12}/> Parsed successfully</div>
              <div className="text-gray-300">
                <span className="font-semibold text-white">{preview.name}</span>
                <span className="text-gray-500 ml-2">—</span>
                <span className="ml-2">{preview.persons} person{preview.persons !== 1 ? 's' : ''}</span>
                <span className="ml-2">· {preview.systems} system{preview.systems !== 1 ? 's' : ''}</span>
                {preview.containers > 0 && <span className="ml-2">· {preview.containers} container{preview.containers !== 1 ? 's' : ''}</span>}
                {preview.components > 0 && <span className="ml-2">· {preview.components} component{preview.components !== 1 ? 's' : ''}</span>}
                <span className="ml-2">· {preview.rels} relationship{preview.rels !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600">Cancel</button>
          <button onClick={handleParse} className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-500">Parse</button>
          <button onClick={handleImport} disabled={!parsed}
            className="px-3 py-1.5 text-xs text-white bg-green-600 rounded hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed">Import</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UNDO TOAST
// ═══════════════════════════════════════════════════════════════
function UndoToast({ message, onUndo, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-16 right-4 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-3 text-xs animate-in">
      <span>{message}</span>
      <button onClick={onUndo} className="text-blue-400 font-semibold hover:text-blue-300">Undo</button>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-200"><X size={12}/></button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function C4Viewer() {
  // Navigation
  const [level, setLevel] = useState(1);
  const [systemId, setSystemId] = useState(null);
  const [containerId, setContainerId] = useState(null);
  const [transitioning, setTransitioning] = useState(false);

  // Canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Selection
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredRel, setHoveredRel] = useState(null);
  const [relTooltip, setRelTooltip] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [state, dispatch] = useReducer(workspaceReducer, { workspace: cloneWs(DEMO_WORKSPACE), past: [], future: [], dirty: false });

  // Company catalog integration
  const { catalog } = useCatalog();
  const [catalogPanelOpen, setCatalogPanelOpen] = useState(false);
  const catalogToolboxSections = useMemo(
    () => catalog ? buildToolboxItems(level, catalog, TOOLBOX_ITEMS) : null,
    [level, catalog]
  );

  // Drag & drop from toolbox
  const [dropPending, setDropPending] = useState(null);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);

  // Element repositioning
  const [draggingElement, setDraggingElement] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [alignmentGuides, setAlignmentGuides] = useState([]);
  const [manualPositionsByView, setManualPositionsByView] = useState({});
  const viewKey = `${level}-${systemId || ''}-${containerId || ''}`;
  const manualPositions = manualPositionsByView[viewKey] || {};
  const setManualPositions = useCallback((updater) => {
    setManualPositionsByView(prev => ({ ...prev, [viewKey]: typeof updater === 'function' ? updater(prev[viewKey] || {}) : updater }));
  }, [viewKey]);

  // Relationship creation
  const [connectingRel, setConnectingRel] = useState(null);
  const [connectMode, setConnectMode] = useState(null);
  const [relModalData, setRelModalData] = useState(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);

  // Editing element
  const [editingElement, setEditingElement] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);

  // Import panel
  const [importPanelOpen, setImportPanelOpen] = useState(false);

  // Computed data
  const workspace = state.workspace;
  const viewData = useMemo(() => computeViewData(workspace, level, systemId, containerId), [workspace, level, systemId, containerId]);
  const layout = useMemo(() => computeLayout(viewData), [viewData]);
  const effectivePositions = useMemo(() => ({ ...layout.positions, ...manualPositions }), [layout.positions, manualPositions]);

  const findElement = useCallback((id) => findElementInWorkspace(workspace, id), [workspace]);

  // Navigation
  const navigate = useCallback((newLevel, newSysId, newContId) => {
    setTransitioning(true);
    setTimeout(() => {
      setLevel(newLevel); setSystemId(newSysId || null); setContainerId(newContId || null);
      setSelectedId(null); setDetailOpen(false); setRelTooltip(null); setContextMenu(null);
      setDropPending(null); setConnectingRel(null); setConnectMode(null); setEditingElement(null);
      setZoom(1); setPan({ x: 0, y: 0 });
      setTimeout(() => setTransitioning(false), 50);
    }, 150);
  }, []);

  const drillDown = useCallback((id) => {
    if (level === 1) navigate(2, id, null);
    else if (level === 2) navigate(3, systemId, id);
  }, [level, systemId, navigate]);

  // Auto-fit
  const fitToScreen = useCallback(() => {
    if (!canvasRef.current || viewData.nodes.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    viewData.nodes.forEach(n => {
      const p = effectivePositions[n.id]; if (!p) return;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + (n.w || 170)); maxY = Math.max(maxY, p.y + (n.h || 100));
    });
    if (layout.boundaryRect) {
      const br = layout.boundaryRect;
      minX = Math.min(minX, br.x); minY = Math.min(minY, br.y);
      maxX = Math.max(maxX, br.x + br.w); maxY = Math.max(maxY, br.y + br.h);
    }
    const cw = maxX - minX + 80, ch = maxY - minY + 80;
    const availW = rect.width, availH = rect.height - 40;
    const newZoom = Math.min(Math.max(availW / cw, 0.4), Math.min(availH / ch, 2.5), 2.5);
    const finalZoom = Math.max(0.4, Math.min(newZoom, 2.5));
    setPan({ x: (availW - cw * finalZoom) / 2 - (minX - 40) * finalZoom, y: (availH - ch * finalZoom) / 2 - (minY - 40) * finalZoom });
    setZoom(finalZoom);
  }, [viewData, effectivePositions, layout.boundaryRect]);

  useEffect(() => { const t = setTimeout(fitToScreen, 200); return () => clearTimeout(t); }, [viewData]);

  // Zoom via wheel
  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.4, Math.min(2.5, z + (e.deltaY < 0 ? 0.08 : -0.08))));
  }, []);

  // Canvas panning
  const onCanvasMouseDown = useCallback((e) => {
    if (editMode && e.button === 0 && !e.target.closest('g[transform]')) {
      // Click on empty canvas in edit mode: deselect
      setSelectedId(null); setDetailOpen(false); setContextMenu(null); setRelTooltip(null);
      if (connectMode) { setConnectMode(null); return; }
    }
    if ((!editMode && e.button === 0) || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [editMode, pan, connectMode]);

  const onCanvasMouseMove = useCallback((e) => {
    if (draggingElement && canvasRef.current) {
      const { x, y } = screenToSvg(e.clientX, e.clientY, canvasRef.current, pan, zoom);
      let newX = x - draggingElement.offsetX;
      let newY = y - draggingElement.offsetY;

      if (snapEnabled) {
        newX = snapToGrid(newX, GRID_SIZE);
        newY = snapToGrid(newY, GRID_SIZE);

        const dragNode = viewData.nodes.find(n => n.id === draggingElement.id);
        const dragW = dragNode?.w || 170, dragH = dragNode?.h || 100;
        const { guides, snapped } = computeAlignmentGuides(
          draggingElement.id, newX, newY, dragW, dragH,
          viewData.nodes, effectivePositions, SNAP_THRESHOLD
        );
        newX = snapped.x;
        newY = snapped.y;
        setAlignmentGuides(guides);
      } else {
        setAlignmentGuides([]);
      }

      setManualPositions(prev => ({
        ...prev,
        [draggingElement.id]: { x: newX, y: newY },
      }));
      return;
    }
    if (connectingRel && canvasRef.current) {
      const { x, y } = screenToSvg(e.clientX, e.clientY, canvasRef.current, pan, zoom);
      setConnectingRel(prev => ({ ...prev, currentX: x, currentY: y }));
      return;
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [draggingElement, connectingRel, isPanning, panStart, pan, zoom, setManualPositions, snapEnabled, viewData.nodes, effectivePositions]);

  const onCanvasMouseUp = useCallback((e) => {
    if (draggingElement) {
      dispatch({ type: 'UPDATE_POSITIONS' });
      setDraggingElement(null);
      setAlignmentGuides([]);
      return;
    }
    if (connectingRel && canvasRef.current) {
      // Check if we released on a node
      const { x, y } = screenToSvg(e.clientX, e.clientY, canvasRef.current, pan, zoom);
      let targetId = null;
      for (const n of viewData.nodes) {
        const p = effectivePositions[n.id]; if (!p) continue;
        if (x >= p.x && x <= p.x + (n.w || 170) && y >= p.y && y <= p.y + (n.h || 100)) {
          if (n.id !== connectingRel.fromId) { targetId = n.id; break; }
        }
      }
      if (targetId) {
        const fromEl = findElement(connectingRel.fromId);
        const toEl = findElement(targetId);
        setRelModalData({ fromId: connectingRel.fromId, toId: targetId, fromName: fromEl?.name || connectingRel.fromId, toName: toEl?.name || targetId, presetLabel: connectingRel.presetLabel || '' });
      }
      setConnectingRel(null);
      return;
    }
    setIsPanning(false);
  }, [draggingElement, connectingRel, isPanning, pan, zoom, viewData.nodes, effectivePositions, findElement]);

  // Element selection
  const selectElement = useCallback((id) => {
    if (connectMode) {
      if (connectMode.stage === 'pickSource') {
        setConnectMode({ stage: 'pickTarget', sourceId: id, presetLabel: connectMode.presetLabel });
        return;
      }
      if (connectMode.stage === 'pickTarget' && id !== connectMode.sourceId) {
        const fromEl = findElement(connectMode.sourceId);
        const toEl = findElement(id);
        setRelModalData({ fromId: connectMode.sourceId, toId: id, fromName: fromEl?.name || connectMode.sourceId, toName: toEl?.name || id, presetLabel: connectMode.presetLabel || '' });
        setConnectMode(null);
        return;
      }
      return;
    }
    setSelectedId(id); setDetailOpen(true); setRelTooltip(null); setContextMenu(null);
  }, [connectMode, findElement]);

  // Element drag start (reposition)
  const onElementDragStart = useCallback((id, e) => {
    if (!editMode || !canvasRef.current) return;
    const { x, y } = screenToSvg(e.clientX, e.clientY, canvasRef.current, pan, zoom);
    const pos = effectivePositions[id] || { x: 0, y: 0 };
    setDraggingElement({ id, offsetX: x - pos.x, offsetY: y - pos.y });
  }, [editMode, pan, zoom, effectivePositions]);

  // Connector dot mouse down (relationship drawing)
  const onConnectorDown = useCallback((nodeId, cx, cy, e) => {
    if (!editMode) return;
    setConnectingRel({ fromId: nodeId, startX: cx, startY: cy, currentX: cx, currentY: cy });
  }, [editMode]);

  // Context menu
  const onContextMenuHandler = useCallback((id, e) => {
    setContextMenu({ elementId: id, x: e.clientX, y: e.clientY });
    setSelectedId(id);
  }, []);

  // Drop from toolbox
  const onCanvasDragOver = useCallback((e) => {
    if (!editMode) return;
    if (e.dataTransfer.types.includes('application/c4-element')) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverCanvas(true);
    }
  }, [editMode]);

  const onCanvasDragLeave = useCallback(() => setDragOverCanvas(false), []);

  const onCanvasDrop = useCallback((e) => {
    if (!editMode || !canvasRef.current) return;
    e.preventDefault(); setDragOverCanvas(false);
    const raw = e.dataTransfer.getData('application/c4-element');
    if (!raw) return;
    const item = JSON.parse(raw);
    if (item.type === 'rel') {
      // Check if dropped on a node
      const { x, y } = screenToSvg(e.clientX, e.clientY, canvasRef.current, pan, zoom);
      let targetId = null;
      for (const n of viewData.nodes) {
        const p = effectivePositions[n.id]; if (!p) continue;
        if (x >= p.x && x <= p.x + (n.w || 170) && y >= p.y && y <= p.y + (n.h || 100)) { targetId = n.id; break; }
      }
      if (targetId) {
        setConnectMode({ stage: 'pickTarget', sourceId: targetId, presetLabel: item.preset || '' });
      } else {
        setConnectMode({ stage: 'pickSource', presetLabel: item.preset || '' });
      }
      return;
    }
    const screenPos = { x: e.clientX, y: e.clientY };
    const svgPos = screenToSvg(e.clientX, e.clientY, canvasRef.current, pan, zoom);
    setDropPending({ item, svgX: svgPos.x, svgY: svgPos.y, screenX: screenPos.x, screenY: screenPos.y, isContainerInstance: item.type === 'containerInstance' });
  }, [editMode, pan, zoom, viewData.nodes, effectivePositions]);

  // Submit new element from form
  const handleElementFormSubmit = useCallback((formData) => {
    if (!dropPending && !editingElement) return;
    const ids = allIdsFromWorkspace(workspace);

    if (editingElement) {
      dispatch({ type: 'UPDATE_ELEMENT', payload: { id: editingElement.id, changes: { name: formData.name, description: formData.description, technology: formData.technology } } });
      setEditingElement(null);
      return;
    }

    const item = dropPending.item;
    const newId = generateId(formData.name, ids);
    const el = { id: newId, name: formData.name, description: formData.description || '' };
    if (formData.technology) el.technology = formData.technology;

    if (item.type === 'person') {
      dispatch({ type: 'ADD_PERSON', payload: el });
    } else if (item.type === 'softwareSystem') {
      dispatch({ type: 'ADD_SOFTWARE_SYSTEM', payload: { ...el, internal: true, containers: [] } });
    } else if (item.type === 'externalSystem') {
      dispatch({ type: 'ADD_SOFTWARE_SYSTEM', payload: { ...el, internal: false, containers: [] } });
    } else if (item.type === 'container') {
      if (systemId) dispatch({ type: 'ADD_CONTAINER', payload: { systemId, container: { ...el, components: [] } } });
    } else if (item.type === 'component') {
      if (containerId) dispatch({ type: 'ADD_COMPONENT', payload: { containerId, component: el } });
    } else if (item.type === 'extContainer') {
      // Add as a container to the current system
      if (systemId) dispatch({ type: 'ADD_CONTAINER', payload: { systemId, container: { ...el, components: [] } } });
    } else if (item.type === 'boundary') {
      // Enterprise boundary: add as a software system marked internal
      dispatch({ type: 'ADD_SOFTWARE_SYSTEM', payload: { ...el, internal: true, containers: [] } });
    } else if (item.type === 'deploymentNode') {
      dispatch({ type: 'ADD_DEPLOYMENT_NODE', payload: { ...el, containerInstances: [] } });
    } else if (item.type === 'containerInstance') {
      // formData.containerId is set by the ContainerInstanceForm
      if (formData.containerId) {
        // Find a deployment node to add to — use the first one, or create one if none
        const dns = workspace.model.deploymentNodes || [];
        if (dns.length > 0) {
          dispatch({ type: 'ADD_CONTAINER_INSTANCE', payload: { deploymentNodeId: dns[0].id, instance: { id: newId, containerId: formData.containerId } } });
        }
      }
    }

    setManualPositions(prev => ({ ...prev, [newId]: { x: dropPending.svgX, y: dropPending.svgY } }));
    setDropPending(null);
  }, [dropPending, editingElement, workspace, systemId, containerId, setManualPositions]);

  // Context menu actions
  const handleDeleteElement = useCallback((id) => {
    const el = findElement(id);
    dispatch({ type: 'DELETE_ELEMENT', payload: { id } });
    setContextMenu(null); setSelectedId(null); setDetailOpen(false);
    setToast({ message: `Deleted "${el?.name || id}"`, action: () => dispatch({ type: 'UNDO' }) });
  }, [findElement]);

  const handleDuplicateElement = useCallback((id) => {
    const ids = allIdsFromWorkspace(workspace);
    const el = findElement(id);
    const newId = generateId((el?.name || 'copy'), ids);
    dispatch({ type: 'DUPLICATE_ELEMENT', payload: { id, newId } });
    const pos = effectivePositions[id];
    if (pos) setManualPositions(prev => ({ ...prev, [newId]: { x: pos.x + 40, y: pos.y + 40 } }));
    setContextMenu(null);
  }, [workspace, findElement, effectivePositions, setManualPositions]);

  const handleEditElement = useCallback((id) => {
    const el = findElement(id);
    if (!el) return;
    const pos = effectivePositions[id];
    const screen = canvasRef.current ? svgToScreen(pos?.x || 0, pos?.y || 0, canvasRef.current, pan, zoom) : { x: 300, y: 300 };
    setEditingElement({ id, name: el.name, description: el.description, technology: el.technology, screenX: screen.x, screenY: screen.y, _type: el._type });
    setContextMenu(null);
  }, [findElement, effectivePositions, pan, zoom]);

  // Relationship modal submit
  const handleRelSubmit = useCallback((data) => {
    dispatch({ type: 'ADD_RELATIONSHIP', payload: { from: relModalData.fromId, to: relModalData.toId, label: data.label, technology: data.technology } });
    setRelModalData(null);
  }, [relModalData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (!editMode) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); dispatch({ type: 'REDO' }); }
      if (e.key === 'Delete' && selectedId && !dropPending && !editingElement && !relModalData) {
        handleDeleteElement(selectedId);
      }
      if (e.key === 'Escape') {
        setConnectingRel(null); setConnectMode(null); setDropPending(null); setContextMenu(null); setEditingElement(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, selectedId, dropPending, editingElement, relModalData, handleDeleteElement]);

  // View-mode element detail
  const selectedElement = selectedId ? findElement(selectedId) : null;
  const selectedRels = useMemo(() => selectedId ? workspace.model.relationships.filter(r => r.from === selectedId || r.to === selectedId) : [], [selectedId, workspace]);

  // Breadcrumb data
  const currentSystem = systemId ? workspace.model.softwareSystems.find(s => s.id === systemId) : null;
  const currentContainer = containerId ? (() => { for (const s of workspace.model.softwareSystems) { const c = (s.containers || []).find(c => c.id === containerId); if (c) return c; } return null; })() : null;

  const badgeColors = { 1: 'bg-blue-600', 2: 'bg-teal-600', 3: 'bg-green-600', 4: 'bg-orange-600' };
  const badgeLabels = { 1: 'System Context', 2: 'Container', 3: 'Component', 4: 'Deployment' };

  // Build list of all navigable views
  const availableViews = useMemo(() => {
    const views = [{ label: '🏠 System Context', level: 1, sysId: null, contId: null, color: 'bg-blue-600' }];
    workspace.model.softwareSystems.forEach(s => {
      if (s.internal && (s.containers || []).length > 0) {
        views.push({ label: `📦 ${s.name}`, level: 2, sysId: s.id, contId: null, color: 'bg-teal-600', sublabel: 'Container' });
        (s.containers || []).forEach(c => {
          if ((c.components || []).length > 0) {
            views.push({ label: `⚙️ ${c.name}`, level: 3, sysId: s.id, contId: c.id, color: 'bg-green-600', sublabel: 'Component' });
          }
        });
      }
    });
    if ((workspace.model.deploymentNodes || []).length > 0) {
      views.push({ label: '🚀 Deployment', level: 4, sysId: null, contId: null, color: 'bg-orange-600' });
    }
    return views;
  }, [workspace]);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);

  // Minimap
  const minimapW = 160, minimapH = 120;
  const minimapData = useMemo(() => {
    if (viewData.nodes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    viewData.nodes.forEach(n => {
      const p = effectivePositions[n.id]; if (!p) return;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + (n.w || 170)); maxY = Math.max(maxY, p.y + (n.h || 100));
    });
    if (layout.boundaryRect) {
      const br = layout.boundaryRect;
      minX = Math.min(minX, br.x); minY = Math.min(minY, br.y);
      maxX = Math.max(maxX, br.x + br.w); maxY = Math.max(maxY, br.y + br.h);
    }
    const dw = maxX - minX + 60, dh = maxY - minY + 60;
    const scale = Math.min(minimapW / dw, minimapH / dh);
    return { minX: minX - 30, minY: minY - 30, scale, dw, dh };
  }, [viewData, effectivePositions, layout.boundaryRect]);

  // ─── RENDER ───
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 select-none overflow-hidden">
      {/* ═══ TOP BAR ═══ */}
      <div className="h-12 bg-gray-900 flex items-center justify-between px-4 flex-shrink-0">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => navigate(1)} className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors">
            <span>🏠</span><span>System Context</span>
          </button>
          {level >= 2 && currentSystem && <>
            <ChevronRight size={14} className="text-gray-500"/>
            <button onClick={() => navigate(2, systemId)} className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors">
              <span>📦</span><span>{currentSystem.name}</span>
            </button>
          </>}
          {level >= 3 && level !== 4 && currentContainer && <>
            <ChevronRight size={14} className="text-gray-500"/>
            <span className="flex items-center gap-1 text-gray-100"><span>⚙️</span><span>{currentContainer.name}</span></span>
          </>}
          {level === 4 && <>
            <ChevronRight size={14} className="text-gray-500"/>
            <span className="flex items-center gap-1 text-gray-100"><span>🚀</span><span>Deployment</span></span>
          </>}
        </div>

        {/* Center title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-white font-bold text-sm">{viewData.title || 'C4 Viewer'}</div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {editMode && <>
            <button onClick={() => dispatch({ type: 'UNDO' })} disabled={state.past.length === 0}
              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo2 size={14}/></button>
            <button onClick={() => dispatch({ type: 'REDO' })} disabled={state.future.length === 0}
              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30" title="Redo (Ctrl+Y)"><Redo2 size={14}/></button>
            <button onClick={() => dispatch({ type: 'LOAD_WORKSPACE', payload: DEMO_WORKSPACE })}
              className="px-2 py-1 text-[10px] text-gray-300 bg-gray-700 rounded hover:bg-gray-600">📥 Load Demo</button>
            <button onClick={() => { if (confirm('Clear all elements?')) dispatch({ type: 'CLEAR_WORKSPACE' }); }}
              className="px-2 py-1 text-[10px] text-gray-300 bg-gray-700 rounded hover:bg-gray-600">🗑 Clear</button>
            <button onClick={() => setImportPanelOpen(true)}
              className="px-2 py-1 text-[10px] text-gray-300 bg-gray-700 rounded hover:bg-gray-600">📋 Import DSL</button>
            <button onClick={() => setSnapEnabled(s => !s)}
              className={`px-2 py-1 text-[10px] rounded font-semibold transition-colors ${snapEnabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'}`}
              title={snapEnabled ? 'Snap to grid enabled' : 'Snap to grid disabled'}>
              {snapEnabled ? '🧲 Snap' : '🧲 Free'}
            </button>
          </>}
          {/* Catalog button */}
          <button onClick={() => setCatalogPanelOpen(true)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${catalog ? 'bg-green-800 text-green-200 hover:bg-green-700' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            title={catalog ? `Catalog: ${catalog.systems.internal.length + catalog.systems.external.length} systems` : 'Connect company catalog'}>
            <BookOpen size={12}/>
            {catalog ? 'Catalog' : 'Catalog'}
            {catalog && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>}
          </button>
          <button onClick={() => { setEditMode(m => !m); setContextMenu(null); setDropPending(null); setConnectingRel(null); setConnectMode(null); setEditingElement(null); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${editMode ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {editMode ? <><Edit3 size={13}/> Editing</> : <><Eye size={13}/> Viewing</>}
          </button>
          <div className="relative">
            <button onClick={() => setViewDropdownOpen(o => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${badgeColors[level]} text-white hover:brightness-110`}>
              {badgeLabels[level]}
              <ChevronDown size={12}/>
            </button>
            {viewDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setViewDropdownOpen(false)}/>
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 py-1 min-w-[220px] max-h-[320px] overflow-y-auto">
                  {availableViews.map((v, i) => {
                    const active = v.level === level && v.sysId === systemId && v.contId === containerId;
                    return (
                      <button key={i} onClick={() => { navigate(v.level, v.sysId, v.contId); setViewDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors ${active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                        <span className="truncate">{v.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex-shrink-0 ${v.color}`}>{v.sublabel || badgeLabels[v.level]}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-h-0" style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 150ms' }}>
      <div className="flex-1 flex relative overflow-hidden min-h-0">
        {/* Toolbox */}
        {editMode && <ToolboxPanel level={level} catalogSections={catalogToolboxSections} />}

        {/* Canvas */}
        <div ref={canvasRef}
          className={`flex-1 relative overflow-hidden ${dragOverCanvas ? 'ring-2 ring-blue-400 ring-dashed' : ''} ${connectMode ? 'cursor-crosshair' : ''}`}
          onMouseDown={onCanvasMouseDown} onMouseMove={onCanvasMouseMove} onMouseUp={onCanvasMouseUp}
          onWheel={onWheel}
          onDragOver={onCanvasDragOver} onDragLeave={onCanvasDragLeave} onDrop={onCanvasDrop}
          onContextMenu={(e) => { if (editMode) e.preventDefault(); }}>
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: '4000px', height: '4000px' }}>
            <svg width="4000" height="4000" overflow="visible" style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* Grid dots */}
              {editMode && snapEnabled && (
                <g>
                  <defs>
                    <pattern id="gridDots" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                      <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={0.8} fill="rgba(0,0,0,0.12)" />
                    </pattern>
                  </defs>
                  <rect width="4000" height="4000" fill="url(#gridDots)" />
                </g>
              )}
              {/* Alignment guides */}
              {alignmentGuides.map((g, i) => (
                <line key={`guide-${i}`}
                  x1={g.axis === 'x' ? g.pos : 0} y1={g.axis === 'y' ? g.pos : 0}
                  x2={g.axis === 'x' ? g.pos : 4000} y2={g.axis === 'y' ? g.pos : 4000}
                  stroke="#3b82f6" strokeWidth={0.8} strokeDasharray="4 4" opacity={0.7} />
              ))}
              {/* Boundary */}
              {viewData.boundary && layout.boundaryRect && (
                <g>
                  <rect x={layout.boundaryRect.x} y={layout.boundaryRect.y} width={layout.boundaryRect.w} height={layout.boundaryRect.h}
                    rx={12} fill="rgba(67,141,213,0.04)" stroke="#438dd5" strokeWidth={1.5} strokeDasharray="8 4"/>
                  <text x={layout.boundaryRect.x + 12} y={layout.boundaryRect.y + 18} fill="#438dd5" fontSize={11} fontWeight={600}>{viewData.boundary.name}</text>
                  {viewData.boundary.technology && <text x={layout.boundaryRect.x + 12} y={layout.boundaryRect.y + 32} fill="#438dd5" fontSize={9} fontStyle="italic">[{viewData.boundary.technology}]</text>}
                  {viewData.boundary.description && <text x={layout.boundaryRect.x + 12} y={layout.boundaryRect.y + (viewData.boundary.technology ? 44 : 32)} fill="rgba(67,141,213,0.7)" fontSize={9}>{truncateText(viewData.boundary.description, 50)}</text>}
                </g>
              )}

              {/* Edges */}
              {viewData.edges.map((edge, i) => {
                const ep = computeEdgePath(edge.from, edge.to, viewData.nodes, effectivePositions);
                if (!ep) return null;
                const isHovered = hoveredRel === i;
                const isSelected = selectedId && (edge.from === selectedId || edge.to === selectedId);
                return (
                  <g key={`edge-${i}`}>
                    <path d={ep.path} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredRel(i)} onMouseLeave={() => setHoveredRel(null)}
                      onClick={(e) => { e.stopPropagation(); setRelTooltip({ edge, x: ep.lx, y: ep.ly }); }} />
                    <path d={ep.path} fill="none" stroke={isHovered ? '#3b82f6' : '#707070'} strokeWidth={1.5}
                      strokeDasharray={isHovered ? 'none' : '6 3'}
                      markerEnd={isHovered ? 'url(#arrowBlue)' : 'url(#arrowGray)'}/>
                    <rect x={ep.lx - 55} y={ep.ly - 14} width={110} height={28} rx={4} fill="white" fillOpacity={0.85}/>
                    <text x={ep.lx} y={ep.ly - 2} textAnchor="middle" fill={isHovered ? '#3b82f6' : '#555'} fontSize={9} fontWeight={500}>{truncateText(edge.label, 22)}</text>
                    <text x={ep.lx} y={ep.ly + 10} textAnchor="middle" fill="#999" fontSize={8} fontStyle="italic">[{truncateText(edge.technology, 18)}]</text>
                  </g>
                );
              })}

              {/* Rubber-band line for relationship creation */}
              {connectingRel && (
                <line x1={connectingRel.startX} y1={connectingRel.startY} x2={connectingRel.currentX} y2={connectingRel.currentY}
                  stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" pointerEvents="none"/>
              )}

              {/* Arrow markers */}
              <defs>
                <marker id="arrowGray" markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto"><path d="M0,0 L8,3 L0,6" fill="#707070"/></marker>
                <marker id="arrowBlue" markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto"><path d="M0,0 L8,3 L0,6" fill="#3b82f6"/></marker>
              </defs>

              {/* Nodes */}
              {viewData.nodes.map(node => {
                const pos = effectivePositions[node.id];
                if (!pos) return null;
                const sel = selectedId === node.id;
                const hov = hoveredId === node.id;
                const commonProps = { node, pos, selected: sel, hovered: hov, onClick: selectElement, onHover: setHoveredId, editMode, onContextMenu: onContextMenuHandler, onConnectorDown, onElementDragStart };
                if (node.type === 'person') return <PersonSVG key={node.id} {...commonProps}/>;
                if (node.type === 'system' || node.type === 'systemExt') return <SystemBoxSVG key={node.id} {...commonProps} onDrill={drillDown}/>;
                if (node.type === 'container') return <ContainerBoxSVG key={node.id} {...commonProps} onDrill={drillDown}/>;
                if (node.type === 'component') return <ComponentBoxSVG key={node.id} {...commonProps}/>;
                if (node.type === 'deploymentNode') return <DeploymentNodeSVG key={node.id} {...commonProps}/>;
                if (node.type === 'containerInstance') return <ContainerInstanceSVG key={node.id} {...commonProps}/>;
                return null;
              })}
            </svg>
          </div>

          {/* Connect mode indicator */}
          {connectMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg z-40">
              {connectMode.stage === 'pickSource' ? 'Click source element' : 'Click target element'} · ESC to cancel
            </div>
          )}
        </div>

        {/* Detail panel (view mode) */}
        {!editMode && detailOpen && selectedElement && (
          <div className="w-[280px] bg-white border-l border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${selectedElement._type === 'person' ? 'bg-blue-800' : selectedElement._type === 'softwareSystem' ? 'bg-blue-600' : selectedElement._type === 'container' ? 'bg-teal-600' : selectedElement._type === 'deploymentNode' ? 'bg-orange-600' : selectedElement._type === 'containerInstance' ? 'bg-teal-600' : 'bg-green-600'}`}>
                {selectedElement._type === 'person' ? 'Person' : selectedElement._type === 'softwareSystem' ? 'Software System' : selectedElement._type === 'container' ? 'Container' : selectedElement._type === 'deploymentNode' ? 'Deployment Node' : selectedElement._type === 'containerInstance' ? 'Container Instance' : 'Component'}
              </span>
              <button onClick={() => { setDetailOpen(false); setSelectedId(null); }} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
            </div>
            <div className="p-3">
              <h3 className="font-bold text-base">{selectedElement.name}</h3>
              <p className="text-gray-500 text-sm mt-1">{selectedElement.description}</p>
              {selectedElement.technology && <div className="mt-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Technology</span><div className="text-sm">{selectedElement.technology}</div></div>}
              <div className="mt-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Tags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px]">Element</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px]">{selectedElement._type === 'person' ? 'person' : selectedElement._type === 'softwareSystem' ? 'Software System' : selectedElement._type === 'container' ? 'container' : selectedElement._type === 'deploymentNode' ? 'Deployment Node' : selectedElement._type === 'containerInstance' ? 'Container Instance' : 'component'}</span>
                </div>
              </div>
              {/* Drill button */}
              {((level === 1 && selectedElement._type === 'softwareSystem' && selectedElement.internal && (selectedElement.containers || []).length > 0) ||
                (level === 2 && selectedElement._type === 'container' && (selectedElement.components || []).length > 0)) && (
                <button onClick={() => drillDown(selectedId)} className="w-full mt-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                  <span>⊕</span> Open {level === 1 ? 'Container' : 'Component'} View
                </button>
              )}
              {/* Relationships */}
              {selectedRels.length > 0 && (
                <div className="mt-4"><span className="text-[10px] font-bold text-gray-400 uppercase">Relationships</span>
                  <div className="mt-1 space-y-2">
                    {selectedRels.map((r, i) => (
                      <div key={i} className="text-xs text-gray-600 py-1">
                        <span className="font-semibold">{findElement(r.from)?.name || r.from}</span>
                        <span className="text-gray-400"> → {r.label} → </span>
                        <span className="font-semibold">{findElement(r.to)?.name || r.to}</span>
                        {r.technology && <span className="text-gray-400 ml-1">[{r.technology}]</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit sidebar (edit mode) — properties only */}
        {editMode && detailOpen && selectedElement && (
          <EditSidebar
            element={selectedElement}
            relationships={selectedRels}
            findElement={findElement}
            onUpdate={(id, changes) => dispatch({ type: 'UPDATE_ELEMENT', payload: { id, changes } })}
            onDelete={(id) => { handleDeleteElement(id); setSelectedId(null); setDetailOpen(false); }}
            onDuplicate={(id) => { dispatch({ type: 'DUPLICATE_ELEMENT', payload: { id } }); }}
            onDrill={drillDown}
            drillLabel={
              selectedElement && (level === 1 && selectedElement._type === 'softwareSystem' && selectedElement.internal && (selectedElement.containers || []).length > 0) ? 'Container' :
              selectedElement && (level === 2 && selectedElement._type === 'container' && (selectedElement.components || []).length > 0) ? 'Component' : null
            }
            onDeselect={() => { setSelectedId(null); setDetailOpen(false); }}
          />
        )}

      {/* ═══ MINIMAP ═══ */}
      {minimapData && (
        <div className="absolute bottom-3 right-3 bg-white/90 border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          style={{ width: minimapW, height: minimapH, zIndex: 20 }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const cx = (e.clientX - rect.left) / minimapData.scale + minimapData.minX;
            const cy = (e.clientY - rect.top) / minimapData.scale + minimapData.minY;
            if (canvasRef.current) {
              const cr = canvasRef.current.getBoundingClientRect();
              setPan({ x: cr.width / 2 - cx * zoom, y: cr.height / 2 - cy * zoom });
            }
          }}>
          <svg width={minimapW} height={minimapH}>
            {layout.boundaryRect && <rect x={(layout.boundaryRect.x - minimapData.minX) * minimapData.scale} y={(layout.boundaryRect.y - minimapData.minY) * minimapData.scale}
              width={layout.boundaryRect.w * minimapData.scale} height={layout.boundaryRect.h * minimapData.scale} fill="rgba(67,141,213,0.05)" stroke="#438dd5" strokeWidth={0.5} rx={2}/>}
            {viewData.nodes.map(n => {
              const p = effectivePositions[n.id]; if (!p) return null;
              const c = n.type === 'person' ? COLORS.person : n.type === 'system' ? COLORS.systemInt : n.type === 'systemExt' ? COLORS.systemExt : n.type === 'container' ? COLORS.container : n.type === 'deploymentNode' ? COLORS.deploymentNode : n.type === 'containerInstance' ? COLORS.containerInstance : COLORS.component;
              return <rect key={n.id} x={(p.x - minimapData.minX) * minimapData.scale} y={(p.y - minimapData.minY) * minimapData.scale} width={(n.w || 170) * minimapData.scale} height={(n.h || 100) * minimapData.scale} fill={c} rx={1}/>;
            })}
            {canvasRef.current && (() => {
              const cr = canvasRef.current.getBoundingClientRect();
              const vx = (-pan.x / zoom - minimapData.minX) * minimapData.scale;
              const vy = (-pan.y / zoom - minimapData.minY) * minimapData.scale;
              const vw = (cr.width / zoom) * minimapData.scale;
              const vh = (cr.height / zoom) * minimapData.scale;
              return <rect x={vx} y={vy} width={vw} height={vh} fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={1} rx={1}/>;
            })()}
          </svg>
        </div>
      )}

      {/* ═══ RELATIONSHIP TOOLTIP ═══ */}
      {relTooltip && (
        <div className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-30" style={{ left: relTooltip.x * zoom + pan.x + (editMode ? 220 : 0) - 80, top: relTooltip.y * zoom + pan.y + 48 + 20, minWidth: 180 }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs">Relationship</span>
            <button onClick={() => setRelTooltip(null)} className="text-gray-400 hover:text-gray-600"><X size={12}/></button>
          </div>
          <div className="text-xs">
            <span className="font-semibold">{findElement(relTooltip.edge.from)?.name || relTooltip.edge.from}</span>
            <span className="text-gray-400"> → </span>
            <span className="font-semibold">{findElement(relTooltip.edge.to)?.name || relTooltip.edge.to}</span>
          </div>
          <div className="text-gray-500 mt-0.5 text-xs">{relTooltip.edge.label}</div>
          {relTooltip.edge.technology && <div className="text-gray-400 mt-0.5 italic text-xs">[{relTooltip.edge.technology}]</div>}
          {editMode && (
            <button onClick={() => { dispatch({ type: 'DELETE_RELATIONSHIP', payload: relTooltip.edge }); setRelTooltip(null); setToast({ message: `Deleted relationship`, action: () => dispatch({ type: 'UNDO' }) }); }}
              className="mt-2 text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={10}/> Delete</button>
          )}
        </div>
      )}
      </div>{/* end inner horizontal row */}

      {/* ═══ DSL FOOTER ═══ */}
      <DslFooter workspace={workspace} selectedId={selectedId} />
      </div>{/* end outer main area wrapper */}

      {/* ═══ STATUS BAR ═══ */}
      <div className="h-8 bg-gray-800 flex items-center justify-between px-4 flex-shrink-0 text-gray-400 text-[11px]">
        <div className="flex items-center gap-1">
          <span>C4 Model · </span>
          <span className="text-gray-300">{viewData.title}</span>
          <span> · </span><span className="text-gray-300">{viewData.nodes.length}</span><span> elements · </span>
          <span className="text-gray-300">{viewData.edges.length}</span><span> relationships</span>
          {editMode && connectMode && <span className="ml-2 text-blue-400 font-semibold"> · Connect mode active</span>}
        </div>
        <div className="flex items-center gap-1">
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="p-0.5 hover:text-white"><ZoomOut size={13}/></button>
          <button onClick={fitToScreen} className="p-0.5 hover:text-white" title="Fit to screen"><Maximize2 size={13}/></button>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="p-0.5 hover:text-white"><ZoomIn size={13}/></button>
        </div>
      </div>

      {/* ═══ OVERLAYS ═══ */}
      {/* Element form (post-drop or edit) */}
      {dropPending && !dropPending.isContainerInstance && <ElementForm item={dropPending.item} screenX={dropPending.screenX} screenY={dropPending.screenY} onSubmit={handleElementFormSubmit} onCancel={() => setDropPending(null)}/>}
      {dropPending && dropPending.isContainerInstance && (() => {
        const allConts = [];
        workspace.model.softwareSystems.forEach(s => (s.containers || []).forEach(c => allConts.push(c)));
        return allConts.length > 0 ? (
          <ContainerInstanceForm screenX={dropPending.screenX} screenY={dropPending.screenY} containers={allConts}
            onSubmit={(data) => handleElementFormSubmit({ ...data, name: data.containerId, containerId: data.containerId })}
            onCancel={() => setDropPending(null)}/>
        ) : (
          <div className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72"
            style={{ left: dropPending.screenX, top: dropPending.screenY }}>
            <p className="text-sm text-gray-600">No containers available. Add containers first.</p>
            <button onClick={() => setDropPending(null)} className="mt-2 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Close</button>
          </div>
        );
      })()}
      {editingElement && <ElementForm item={{ type: editingElement._type, icon: '📝' }} screenX={editingElement.screenX} screenY={editingElement.screenY}
        editData={editingElement} onSubmit={handleElementFormSubmit} onCancel={() => setEditingElement(null)}/>}

      {/* Relationship modal */}
      {relModalData && <RelationshipModal fromName={relModalData.fromName} toName={relModalData.toName} presetLabel={relModalData.presetLabel} onSubmit={handleRelSubmit} onCancel={() => { setRelModalData(null); setConnectMode(null); }}/>}

      {/* Context menu */}
      {contextMenu && <ContextMenuPopup x={contextMenu.x} y={contextMenu.y}
        onEdit={() => handleEditElement(contextMenu.elementId)}
        onDelete={() => handleDeleteElement(contextMenu.elementId)}
        onDuplicate={() => handleDuplicateElement(contextMenu.elementId)}
        showScope={level === 1 && findElement(contextMenu.elementId)?._type === 'softwareSystem'}
        onSetScope={() => { drillDown(contextMenu.elementId); setContextMenu(null); }}
        onClose={() => setContextMenu(null)}/>}

      {/* Undo toast */}
      {toast && <UndoToast message={toast.message} onUndo={() => { toast.action(); setToast(null); }} onDismiss={() => setToast(null)}/>}

      {/* Import panel */}
      {importPanelOpen && <ImportPanel onImport={(ws) => dispatch({ type: 'LOAD_WORKSPACE', payload: ws })} onClose={() => setImportPanelOpen(false)}/>}

      {/* Catalog panel */}
      {catalogPanelOpen && (
        <CatalogPanel
          onClose={() => setCatalogPanelOpen(false)}
          onAddSystem={(system) => {
            dispatch({ type: 'ADD_CATALOG_SYSTEM', payload: { system } });
          }}
        />
      )}
    </div>
  );
}
