# C4 Builder

An interactive, browser-based C4 architecture diagram builder with real-time Structurizr DSL generation. Design system landscapes visually and export standards-compliant DSL — with optional company catalog integration for enterprise teams.

## Features

### Visual Diagram Editor
- **Drag-and-drop** elements from a categorized toolbox onto an infinite canvas
- **All four C4 levels**: System Context, Container, Component, and Deployment views
- **Drill-down navigation** between levels via breadcrumb or double-click
- **Relationship drawing** by dragging between elements
- **Snap-to-grid** for clean layouts
- **Pan & zoom** with mouse wheel and drag
- **Minimap** for navigating large diagrams
- **Undo / Redo** with full history

### Structurizr DSL
- **Live DSL preview** in a resizable footer panel, updated as you edit
- **DSL import** — paste any valid Structurizr DSL and the builder recreates the diagram
- **Workspace validation** with inline warnings
- **Load Demo** to explore a fully-wired e-commerce architecture

### Company Catalog Integration
Connect to your company's shared Structurizr DSL monorepo (`common/` folder) to:
- **Populate the toolbox** with company-approved archetypes, systems, and platform components
- **Browse the system catalog** — search internal/external systems by trigram, name, or domain
- **Generate compliant DSL** using `workspace extends`, `!element`, exchange codes, environment constants, and `!include` directives
- **Validate compliance** against company naming conventions and archetype usage

## Quick Start

```bash
git clone https://github.com/mazen313/c4-builder.git
cd c4-builder
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

Click **Load Demo** in the toolbar to load a sample e-commerce architecture, or start from scratch in **Editing** mode.

## Usage

### Editing Mode

Click the **Editing** toggle in the toolbar to open the toolbox sidebar. From there:

1. **Click** any toolbox item to place it on the canvas
2. **Drag** elements to reposition them
3. **Double-click** a software system to drill down into its containers
4. **Draw relationships** by dragging from one element to another
5. **Click** an element or relationship to select it, then edit its properties in the side panel
6. Toggle **Snap** to align elements to a grid

### View Navigation

Use the **view dropdown** (top-right) to switch between:
- **System Context** — actors, systems, and their interactions
- **Container** — internal structure of a system (APIs, databases, queues, etc.)
- **Component** — classes/modules within a container
- **Deployment** — infrastructure nodes and container instances

### DSL Panel

The bottom panel shows the live Structurizr DSL output:
- **Copy** the DSL to paste into Structurizr or other C4 tools
- **Import DSL** to load an existing workspace
- Validation badges show warnings for missing descriptions, orphaned elements, etc.

## Company Catalog Integration

For enterprise teams that maintain a shared Structurizr DSL monorepo, the catalog feature replaces the default toolbox with company-specific items.

### Connecting a Catalog

1. Click the **Catalog** button in the toolbar
2. Go to the **Settings** tab
3. Enter the base URL of your `common/` folder (static file server, git raw, or API)
4. Click **Connect**

Or click **Load Sample Catalog** to try it with built-in demo data.

### Expected Folder Structure

The catalog loader expects this layout under your base URL:

```
common/
  systemcatalog/
    cmdb.dsl              # Internal systems (ID = softwareSystem "Name" "Desc")
    externalprovider.dsl   # External systems
    person.dsl             # Actor definitions
  archetypes/
    container.dsl          # Container archetypes (WEB_APP, API_REST, DB_POSTGRES, ...)
    deploymentnode.dsl     # Deployment node archetypes (DN_K8S_CLUSTER, DN_VM_LINUX, ...)
    relationship.dsl       # Relationship archetypes (REL_HTTP, REL_MQ, ...)
  constants/
    environments.dsl       # !const ENV_DEV "Development", ENV_PRD "Production", ...
    exchanges.dsl          # Exchange property constants
    protocols.dsl          # Network protocol constants (TCP_443, TCP_5432, ...)
  platform/
    keycloak.dsl           # Shared platform component definitions
    kafka.dsl
    mq.dsl
    ...
  styles/
    styles.dsl             # Shared visual styles
```

Files that return 404 are silently skipped — only `systemcatalog/` is required.

### What Changes with Catalog

| Feature | Without Catalog | With Catalog |
|---------|----------------|--------------|
| **Toolbox** | Generic items (Person, Software System, Container, ...) | Company archetypes grouped by domain/section |
| **System Context level** | Add generic software systems | Add named systems from CMDB, grouped by domain |
| **Container level** | Generic container/API/database | 12+ archetypes (WEB_APP, API_REST, DB_POSTGRES, ...) + platform components |
| **Deployment level** | Generic cloud/server/K8s nodes | Typed nodes (DN_K8S_CLUSTER, DN_VM_LINUX, ...) + named environments |
| **DSL output** | Standard `workspace { ... }` | `workspace extends`, `!element`, `!include`, exchange codes |
| **Validation** | Basic warnings | + Company compliance warnings (missing trigrams, archetypes, exchange codes) |

### Custom Manifest (Optional)

Place a `catalog-manifest.json` at the base URL to control which files are loaded:

```json
{
  "files": [
    "platform/keycloak.dsl",
    "platform/kafka.dsl",
    "deploymentsnode/servers.dsl"
  ]
}
```

## Tech Stack

- **React 19** with hooks and context
- **Tailwind CSS v4** via Vite plugin
- **Vite 6** for dev server and builds
- **Lucide React** for icons
- **SVG** canvas with custom pan/zoom/drag engine
- Zero backend — runs entirely in the browser

## Project Structure

```
src/
  main.jsx                      # App entry point with CatalogProvider
  C4Viewer.jsx                  # Main component: canvas, toolbox, reducer, DSL parser/generator
  C4Builder.jsx                 # Legacy/alternative builder component
  index.css                     # Tailwind imports
  catalog/
    CatalogContext.jsx           # React Context for catalog state
    CatalogPanel.jsx             # Catalog browser UI (Browse, Archetypes, Constants, Settings)
    catalogDslParser.js          # Parses company DSL files into structured data
    catalogLoader.js             # Fetches and parses catalog from URL, includes sample data
    buildToolboxItems.js         # Builds dynamic toolbox sections from catalog per C4 level
  dsl/
    generateCompanyDSL.js        # Company-compliant DSL generator + compliance validator
```

## Building for Production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server.

## License

ISC
