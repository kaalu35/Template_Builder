// src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import TemplatesPage from './pages/TemplatesPage';
import EditorPage from './pages/EditorPage';
import PlaceholderRegistryPage from './pages/PlaceholderRegistryPage';
import MarketplacePage from './pages/MarketplacePage';
import AuditLogPage from './pages/AuditLogPage';
import DocumentsPage from './pages/DocumentsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/*
          All routes share the AppLayout (sidebar + main area).
          The matching page renders inside <Outlet /> in AppLayout.
        */}
        <Route element={<AppLayout />}>

          {/* Redirect root to /templates */}
          <Route path="/" element={<Navigate to="/templates" replace />} />

          {/* Templates list */}
          <Route path="/templates" element={<TemplatesPage />} />

          {/* Template editor — :id is the template's UUID */}
          <Route path="/templates/:id" element={<EditorPage />} />

          {/* Placeholder registry */}
          <Route path="/registry/placeholders" element={<PlaceholderRegistryPage />} />

          {/* Marketplace */}
          <Route path="/marketplace" element={<MarketplacePage />} />

          {/* Audit log */}
          <Route path="/audit" element={<AuditLogPage />} />

          
          <Route path="/documents" element={<DocumentsPage />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}