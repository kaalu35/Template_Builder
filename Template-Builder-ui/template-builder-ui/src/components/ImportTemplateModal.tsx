// src/components/ImportTemplateModal.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const INDUSTRIES = ['', 'Banking', 'Insurance', 'Healthcare', 'Finance', 'Manufacturing', 'Legal', 'Real Estate', 'Education', 'Other'];
const OUTPUT_TARGETS = [{ value: 'html', label: 'HTML' }, { value: 'docx', label: 'DOCX' }, { value: 'pdf', label: 'PDF' }, { value: 'xlsx', label: 'XLSX' }];
const FILE_META: Record<string, { icon: string; color: string }> = {
  pdf:  { icon: '📄', color: '#ef4444' },
  docx: { icon: '📝', color: '#3b82f6' },
  html: { icon: '🌐', color: '#f59e0b' },
  htm:  { icon: '🌐', color: '#f59e0b' },
};
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function ImportTemplateModal({ onClose, onImported }: Props) {
  const navigate   = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab]           = useState<'file' | 'url'>('file');
  const [name, setName]         = useState('');
  const [industry, setIndustry] = useState('');
  const [outputTarget, setOutputTarget] = useState('html');
  const [file, setFile]         = useState<File | null>(null);
  const [url, setUrl]           = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  function handleFileSelect(selectedFile: File) {
    setError(null);
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File too large. Max 20MB.`);
      return;
    }
    setFile(selectedFile);
    if (!name) {
      const base = selectedFile.name.replace(/\.(pdf|docx|html|htm)$/i, '');
      setName(base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }

  function validate(): boolean {
    if (!name.trim()) { setError('Template name is required.'); return false; }
    if (tab === 'file' && !file) { setError('Please select a file.'); return false; }
    if (tab === 'url' && !url.trim()) { setError('Please enter a URL.'); return false; }
    return true;
  }

  async function handleImport() {
    setError(null);
    if (!validate()) return;
    if (tab === 'file') await importFile();
    else await importFromUrl();
  }

  async function importFile() {
    if (!file) return;
    setIsImporting(true); setIsSuccess(false);
    setProgress('Uploading and parsing...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      formData.append('industry', industry);
      formData.append('output_target', outputTarget);
      const response = await apiClient.post('/templates/import/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      const data = response.data;
      setIsSuccess(true);
      setProgress(`✓ Imported ${data.block_count} blocks!`);
      setTimeout(() => { onImported(); onClose(); navigate(`/templates/${data.template_id}`); }, 900);
    } catch (err) {
      setError(extractError(err)); setIsImporting(false); setProgress('');
    }
  }

  async function importFromUrl() {
    setIsImporting(true); setIsSuccess(false);
    setProgress('Fetching URL and parsing content...');
    try {
      const formData = new FormData();
      formData.append('url', url.trim());
      formData.append('name', name.trim());
      formData.append('industry', industry);
      formData.append('output_target', outputTarget);
      const response = await apiClient.post('/templates/import/url', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });
      const data = response.data;
      setIsSuccess(true);
      setProgress(`✓ Imported ${data.block_count} blocks!`);
      setTimeout(() => { onImported(); onClose(); navigate(`/templates/${data.template_id}`); }, 900);
    } catch (err) {
      setError(extractError(err)); setIsImporting(false); setProgress('');
    }
  }

  function extractError(err: unknown): string {
    const e = err as Record<string, unknown>;
    const resp = e?.['response'] as Record<string, unknown> | undefined;
    if (resp) {
      const data = resp['data'] as Record<string, unknown> | undefined;
      if (data?.detail) return String(data.detail);
      const s = Number(resp['status']);
      if (s === 500) return 'Server error. Check Docker is running.';
      if (s === 413) return 'File too large (max 20MB).';
      if (s === 422) return 'Could not parse this file format.';
      if (s === 408) return 'Request timed out. Try a smaller file or URL.';
      if (s === 400) return String((resp['data'] as Record<string, string>)?.detail || 'Bad request');
    }
    if (err instanceof Error) return err.message;
    return 'Import failed. Please try again.';
  }

  const fileExt = file?.name.split('.').pop()?.toLowerCase() ?? '';
  const fileMeta = FILE_META[fileExt] ?? { icon: '📂', color: '#475569' };

  return (
    <>
      <style>{`@keyframes tb-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={S.header}>
            <div>
              <h2 style={S.title}>↑ Import Template</h2>
              <p style={S.subtitle}>Import from PDF, DOCX, HTML file or any public URL</p>
            </div>
            <button style={S.closeBtn} onClick={onClose} disabled={isImporting}>✕</button>
          </div>

          <div style={S.body}>

            {error && <div style={S.errorBox}><span>⚠</span><span>{error}</span></div>}

            {progress && !error && (
              <div style={{ ...S.progressBox, background: isSuccess ? '#f0fdf4' : '#eff6ff', borderColor: isSuccess ? '#86efac' : '#bfdbfe', color: isSuccess ? '#166534' : '#1d4ed8' }}>
                {isImporting && !isSuccess && (
                  <span style={{ width: 14, height: 14, border: '2px solid #bfdbfe', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'tb-spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                )}
                <span>{progress}</span>
              </div>
            )}

            {/* Metadata */}
            <div style={S.grid}>
              <div style={S.field}>
                <label style={S.label}>Template Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input style={S.input} value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Loan Offer Letter" disabled={isImporting} />
              </div>
              <div style={S.field}>
                <label style={S.label}>Industry</label>
                <select style={S.select} value={industry} onChange={e => setIndustry(e.target.value)} disabled={isImporting}>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i || 'Select industry'}</option>)}
                </select>
              </div>
              <div style={S.field}>
                <label style={S.label}>Output Format</label>
                <select style={S.select} value={outputTarget} onChange={e => setOutputTarget(e.target.value)} disabled={isImporting}>
                  {OUTPUT_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div style={S.tabs}>
              {(['file', 'url'] as const).map(t => (
                <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
                  onClick={() => { setTab(t); setError(null); }} disabled={isImporting}>
                  {t === 'file' ? '📁 Upload File' : '🔗 Import from URL'}
                </button>
              ))}
            </div>

            {/* File tab */}
            {tab === 'file' && (
              <div>
                <div style={{ ...S.dropZone, borderColor: isDragging ? '#4f46e5' : file ? '#22c55e' : '#e2e8f0', backgroundColor: isDragging ? '#ede9fe' : file ? '#f0fdf4' : '#f8fafc', cursor: isImporting ? 'not-allowed' : 'pointer' }}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => !isImporting && fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.html,.htm"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                  {file ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{fileMeta.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: fileMeta.color, marginBottom: 4 }}>{file.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>{(file.size / 1024).toFixed(1)} KB</div>
                      {!isImporting && <button style={S.changeBtn} onClick={e => { e.stopPropagation(); setFile(null); setError(null); }}>Change file</button>}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#475569', margin: '0 0 4px' }}>
                        {isDragging ? 'Drop here' : 'Click to upload or drag & drop'}
                      </p>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>PDF, DOCX, HTML · Max 20MB</p>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
                  {[{ e: 'PDF', c: '#ef4444', b: '#fee2e2' }, { e: 'DOCX', c: '#3b82f6', b: '#dbeafe' }, { e: 'HTML', c: '#f59e0b', b: '#fef3c7' }]
                    .map(f => (
                      <span key={f.e} style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: f.c, background: f.b }}>{f.e}</span>
                    ))}
                </div>
              </div>
            )}

            {/* URL tab */}
            {tab === 'url' && (
              <div style={S.field}>
                <label style={S.label}>Public URL</label>
                <input style={{ ...S.input, fontFamily: 'monospace', fontSize: 13 }}
                  value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... or any public URL"
                  disabled={isImporting} />

                {/* Supported URLs */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>✅ All these URLs work automatically:</div>
                  {[
                    { icon: '🟣', label: 'Google Drive', hint: 'paste the share link — auto converted' },
                    { icon: '🔵', label: 'Dropbox', hint: 'paste the share link — auto converted' },
                    { icon: '🟦', label: 'OneDrive / SharePoint', hint: 'paste the share link — auto converted' },
                    { icon: '📄', label: 'Direct PDF / DOCX / HTML', hint: 'any URL ending in .pdf .docx .html' },
                    { icon: '🌐', label: 'Any public webpage', hint: 'headings and paragraphs extracted' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4, alignItems: 'center' }}>
                      <span>{item.icon}</span>
                      <span style={{ color: '#0f172a', fontWeight: 600, minWidth: 160 }}>{item.label}</span>
                      <span style={{ color: '#94a3b8' }}>— {item.hint}</span>
                    </div>
                  ))}
                </div>

                {/* Google Drive tip */}
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 6 }}>
                    📁 Google Drive — Make sure file is public
                  </div>
                  <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.8 }}>
                    1. Open file in Drive → Click <strong>Share</strong><br />
                    2. Change to <strong>"Anyone with the link"</strong><br />
                    3. Click <strong>Copy link</strong> → Paste here ✓
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={S.footer}>
            <button style={S.cancelBtn} onClick={onClose} disabled={isImporting}>Cancel</button>
            <button style={{ ...S.importBtn, opacity: isImporting ? 0.7 : 1, cursor: isImporting ? 'not-allowed' : 'pointer' }}
              onClick={handleImport} disabled={isImporting}>
              {isImporting ? '⟳ Importing...' : '↑ Import Template'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' },
  modal:       { background: '#fff', borderRadius: 16, width: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.25)' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 26px 16px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg, #fafbff, #f5f3ff)', borderRadius: '16px 16px 0 0' },
  title:       { fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 2 },
  subtitle:    { fontSize: 13, color: '#94a3b8' },
  closeBtn:    { background: '#f1f5f9', border: 'none', fontSize: 14, color: '#94a3b8', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, lineHeight: 1 },
  body:        { flex: 1, overflowY: 'auto', padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 14 },
  errorBox:    { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b91c1c', display: 'flex', gap: 8 },
  progressBox: { border: '1px solid', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  grid:        { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 },
  field:       { display: 'flex', flexDirection: 'column', gap: 8 },
  label:       { fontSize: 13, fontWeight: 600, color: '#374151' },
  input:       { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', color: '#1e293b', transition: 'border-color 0.15s' },
  select:      { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', color: '#1e293b' },
  tabs:        { display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 },
  tab:         { flex: 1, padding: 9, border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, color: '#64748b', background: 'transparent', cursor: 'pointer' },
  tabActive:   { background: '#fff', color: '#4f46e5', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', fontWeight: 700 },
  dropZone:    { border: '2px dashed', borderRadius: 10, padding: '32px 20px', textAlign: 'center', transition: 'all 0.15s' },
  changeBtn:   { background: 'none', border: '1px solid #e2e8f0', borderRadius: 5, padding: '4px 12px', fontSize: 12, color: '#64748b', cursor: 'pointer' },
  footer:      { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 26px', borderTop: '1px solid #f1f5f9' },
  cancelBtn:   { background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '10px 20px', fontSize: 14, color: '#64748b', cursor: 'pointer', fontWeight: 600 },
  importBtn:   { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' },
};