import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Switch between C4Builder (drag-and-drop DSL builder) and C4Viewer (interactive drill-down viewer)
// by changing the import below:
import C4Viewer from './C4Viewer.jsx'
import { CatalogProvider } from './catalog/CatalogContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CatalogProvider>
      <C4Viewer />
    </CatalogProvider>
  </React.StrictMode>
)
