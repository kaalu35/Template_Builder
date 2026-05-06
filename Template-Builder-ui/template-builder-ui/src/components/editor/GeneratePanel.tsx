// src/components/editor/GeneratePanel.tsx
import { useState } from 'react';
import { generateDocument, getJobStatus, saveJobLocally } from '../../api/documents';
import type { JobStatus } from '../../api/documents';
import type { OutputTarget } from '../../types/api';

interface Props {
  templateId: string;
  templateName: string;
  outputTarget: OutputTarget;
  onClose: () => void;
}

const FORMAT_META: Record<string, { icon: string; color: string; bg: string }> = {
  pdf:  { icon: '📄', color: '#b91c1c', bg: '#fee2e2' },
  docx: { icon: '📝', color: '#1d4ed8', bg: '#dbeafe' },
  html: { icon: '🌐', color: '#854d0e', bg: '#fef9c3' },
  xlsx: { icon: '📊', color: '#166534', bg: '#dcfce7' },
  md:   { icon: '📋', color: '#6d28d9', bg: '#f3e8ff' },
};

// Common parameter suggestions
const PARAM_SUGGESTIONS = [
  { key: 'customer_id', placeholder: 'e.g. 1', hint: 'Customer ID' },
  { key: 'customer_name', placeholder: 'e.g. John Valid', hint: 'Customer Name' },
  { key: 'month', placeholder: 'e.g. March 2026', hint: 'Statement Month' },
  { key: 'loan_account', placeholder: 'e.g. LN12345', hint: 'Loan Account' },
  { key: 'email', placeholder: 'e.g. john@example.com', hint: 'Email' },
];

export default function GeneratePanel({ templateId, templateName, outputTarget, onClose }: Props) {
  const [isGenerating, setIsGenerating]   = useState(false);
  const [job, setJob]                     = useState<JobStatus | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [format, setFormat]               = useState<string>(outputTarget);
  const [params, setParams]               = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null);
  const [showApiPreview, setShowApiPreview]   = useState(false);

  function addParam() { setParams(p => [...p, { key: '', value: '' }]); }
  function updateParam(i: number, field: 'key' | 'value', val: string) {
    setParams(p => p.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
  }
  function removeParam(i: number) { setParams(p => p.filter((_, idx) => idx !== i)); }
  function buildRuntimeParams(): Record<string, string> {
    const r: Record<string, string> = {};
    params.forEach(({ key, value }) => { if (key.trim()) r[key.trim()] = value.trim(); });
    return r;
  }

  function getApiPreview(): string {
    const rp = buildRuntimeParams();
    return JSON.stringify({
      template_id: templateId,
      output_target: format,
      runtime_params: Object.keys(rp).length > 0 ? rp : { customer_id: "1", month: "March 2026" }
    }, null, 2);
  }

  // ── Generate ──────────────────────────────────────────────────────
  async function handleGenerate() {
    setIsGenerating(true); setError(null); setJob(null);
    try {
      const res = await generateDocument({
        template_id: templateId, output_target: format,
        locale: 'en', runtime_params: buildRuntimeParams(),
      });
      let jobData: JobStatus | null = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        jobData = await getJobStatus(res.job_id);
        if (jobData.status === 'success' || jobData.status === 'error') break;
      }
      if (jobData) {
        setJob(jobData);
        if (jobData.status === 'success') {
          saveJobLocally({
            job_id: jobData.job_id, template_id: templateId, template_name: templateName,
            output_target: jobData.output_target, status: jobData.status,
            runtime_params: buildRuntimeParams(),
            created_at: jobData.created_at ?? new Date().toISOString(),
            result_location: jobData.result_location,
          });
        }
      } else { setError('Job timed out — please try again'); }
    } catch (err) { setError((err as Error).message); }
    finally { setIsGenerating(false); }
  }

  // ── Download ──────────────────────────────────────────────────────
  async function handleDownload() {
    if (!job) return;
    setIsDownloading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE}/documents/jobs/${job.job_id}/download`,
        { headers: { 'x-user-id': localStorage.getItem('tb_user_id') ?? 'dev_user' } }
      );
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${templateName.replace(/\s+/g, '_')}_${job.job_id.slice(0, 8)}.${format}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { setError((err as Error).message); }
    finally { setIsDownloading(false); }
  }

  // ── View ──────────────────────────────────────────────────────────
  async function handleView() {
    if (!job) return;
    if (format === 'docx') { alert('Word documents (.docx) cannot be previewed in the browser.\nClick "Download DOCX" to open it in Microsoft Word.'); return; }
    if (format === 'xlsx') { alert('Excel files (.xlsx) cannot be previewed in the browser.\nClick "Download XLSX" to open it in Microsoft Excel.'); return; }
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE}/documents/jobs/${job.job_id}/download`,
        { headers: { 'x-user-id': localStorage.getItem('tb_user_id') ?? 'dev_user' } }
      );
      const blob = await response.blob();
      const mimeType = format === 'pdf' ? 'application/pdf' : format === 'html' ? 'text/html' : 'text/markdown';
      const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { setError('Could not open preview'); }
  }

  const activeParams = params.filter(p => p.key.trim());


  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .gp-panel { animation: fadeInUp 0.25s ease; }
        .gp-fmt-btn { transition: all 0.15s ease; }
        .gp-fmt-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .gp-param-row { transition: all 0.15s ease; }
        .gp-param-row:hover { background: #fafbff !important; }
        .gp-suggest-item:hover { background: #ede9fe !important; color: #4f46e5 !important; }
        .gp-gen-btn { transition: all 0.2s ease; }
        .gp-gen-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(79,70,229,0.4) !important; filter: brightness(1.08); }
        .gp-dl-btn { transition: all 0.15s ease; }
        .gp-dl-btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .gp-add-btn:hover { border-color: #818cf8 !important; color: #4f46e5 !important; background: #f5f3ff !important; }
        .gp-copy-btn:hover { background: #ede9fe !important; }
      `}</style>

      <div style={S.overlay} onClick={onClose}>
        <div className="gp-panel" style={S.panel} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={S.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
              <div>
                <h2 style={S.title}>Generate Document</h2>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{templateName}</p>
              </div>
            </div>
            <button style={S.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div style={S.body}>

            {/* Format selector */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <span style={S.sectionIcon}>🎯</span>
                <label style={S.sectionTitle}>Output Format</label>
              </div>
              <div style={S.formatGrid}>
                {(['pdf', 'docx', 'html', 'xlsx', 'md'] as const).map(f => {
                  const m = FORMAT_META[f];
                  const isActive = format === f;
                  return (
                    <button key={f} className="gp-fmt-btn"
                      style={{ ...S.formatBtn, ...(isActive ? { backgroundColor: m.bg, color: m.color, borderColor: m.color + '60', boxShadow: `0 2px 8px ${m.color}20` } : {}) }}
                      onClick={() => { setFormat(f); setJob(null); setError(null); }}>
                      <span style={{ fontSize: 14 }}>{m.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{f.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Runtime Parameters — Advanced Builder */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <span style={S.sectionIcon}>⚙</span>
                <label style={S.sectionTitle}>Runtime Parameters</label>
                <span style={S.sectionBadge}>{activeParams.length} active</span>
                <button className="gp-copy-btn"
                  style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#64748b', cursor: 'pointer' }}
                  onClick={() => setShowApiPreview(!showApiPreview)}>
                  {showApiPreview ? '▲ Hide API' : '{ } API Preview'}
                </button>
              </div>

              {/* API Preview */}
              {showApiPreview && (
                <div style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: '12px 14px', marginBottom: 10, position: 'relative' }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>POST /v1/documents/generate</div>
                  <pre style={{ fontSize: 11, color: '#a5f3fc', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap' }}>{getApiPreview()}</pre>
                  <button style={{ position: 'absolute', top: 10, right: 10, background: '#1e293b', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 10, color: '#94a3b8', cursor: 'pointer' }}
                    onClick={() => navigator.clipboard.writeText(getApiPreview())}>
                    Copy
                  </button>
                </div>
              )}

              {/* Param rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {params.map((p, i) => (
                  <div key={i} className="gp-param-row" style={S.paramCard}>
                    {/* Key */}
                    <div style={{ position: 'relative', flex: 1 }}>
                      <div style={S.paramLabel}>PARAMETER</div>
                      <input style={S.paramKeyInput}
                        placeholder="e.g. customer_id"
                        value={p.key}
                        onChange={e => { updateParam(i, 'key', e.target.value); setShowSuggestions(i); }}
                        onFocus={() => setShowSuggestions(i)}
                        onBlur={() => setTimeout(() => setShowSuggestions(null), 150)} />
                      {/* Suggestions dropdown */}
                      {showSuggestions === i && p.key === '' && (
                        <div style={S.suggestionsBox}>
                          <div style={{ fontSize: 10, color: '#94a3b8', padding: '6px 10px 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Common Parameters</div>
                          {PARAM_SUGGESTIONS.map(s => (
                            <div key={s.key} className="gp-suggest-item"
                              style={S.suggestItem}
                              onMouseDown={() => { updateParam(i, 'key', s.key); setShowSuggestions(null); }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{s.key}</span>
                              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>— {s.hint}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <div style={{ fontSize: 16, color: '#c7d2fe', fontWeight: 700, paddingTop: 16 }}>→</div>

                    {/* Value */}
                    <div style={{ flex: 1 }}>
                      <div style={S.paramLabel}>VALUE</div>
                      <input style={S.paramValueInput}
                        placeholder={PARAM_SUGGESTIONS.find(s => s.key === p.key)?.placeholder ?? 'Enter value...'}
                        value={p.value}
                        onChange={e => updateParam(i, 'value', e.target.value)} />
                    </div>

                    {/* Remove */}
                    <button style={{ ...S.removeBtn, marginTop: 16 }}
                      onClick={() => removeParam(i)} disabled={params.length === 1}>✕</button>
                  </div>
                ))}
              </div>

              {/* Add param button */}
              <button className="gp-add-btn" style={S.addParamBtn} onClick={addParam}>
                + Add Parameter
              </button>

              {/* Hint */}
              <div style={S.hintBox}>
                <span style={{ fontSize: 14 }}>💡</span>
                <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.6 }}>
                  Parameters like <code style={{ backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>customer_id</code> or <code style={{ backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>customer_name</code> are injected into SQL at generation time — fetching real data from kasetti_bank automatically.
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={S.errorBox}>
                <span style={{ fontSize: 16 }}>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Success result */}
            {job?.status === 'success' && (
              <div style={S.resultBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>{format.toUpperCase()} Generated Successfully!</div>
                </div>
                <p style={{ fontSize: 12, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>
                  Your document is ready with {activeParams.length > 0 ? `${activeParams.length} runtime parameter${activeParams.length > 1 ? 's' : ''}` : 'sample values'}.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="gp-dl-btn"
                    style={{ ...S.downloadBtn, opacity: isDownloading ? 0.7 : 1 }}
                    onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? '⟳ Downloading...' : `⬇ Download ${format.toUpperCase()}`}
                  </button>
                  <button className="gp-dl-btn" style={S.viewBtn} onClick={handleView}>
                    {format === 'html' ? '👁 View' : format === 'pdf' ? '👁 View' : format === 'md' ? '👁 View' : 'ℹ Info'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>Also available in the Documents page</p>
              </div>
            )}

            {/* Error result */}
            {job?.status === 'error' && (
              <div style={{ ...S.resultBox, borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>✗ Generation Failed</div>
                <p style={{ fontSize: 12, color: '#b91c1c' }}>{job.logs ?? 'Unknown error'}</p>
              </div>
            )}

            {/* Generate button */}
            {!job && (
              <button className="gp-gen-btn"
                style={{ ...S.generateBtn, background: `linear-gradient(135deg, #4f46e5, #7c3aed)`, opacity: isGenerating ? 0.8 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}
                onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ animation: 'pulse 1s infinite' }}>⟳</span>
                    Generating {format.toUpperCase()}...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span>⚡</span>
                    Generate {format.toUpperCase()}
                    {activeParams.length > 0 && <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{activeParams.length} params</span>}
                  </span>
                )}
              </button>
            )}

            {/* Try again */}
            {job && (
              <button style={S.retryBtn} onClick={() => { setJob(null); setError(null); }}>
                ↺ Generate Another
              </button>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay:       { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)', padding: 20 },
  panel:         { backgroundColor: '#fff', borderRadius: 16, width: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(15,23,42,0.25)', display: 'flex', flexDirection: 'column', border: '1px solid #f0f2f8' },
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1, background: 'linear-gradient(135deg, #fafbff, #f5f3ff)', borderRadius: '16px 16px 0 0' },
  title:         { fontSize: 15, fontWeight: 800, color: '#0f172a' },
  closeBtn:      { background: '#f1f5f9', border: 'none', fontSize: 12, color: '#64748b', cursor: 'pointer', padding: '6px 8px', borderRadius: 7 },
  body:          { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  section:       { backgroundColor: '#fafbff', border: '1px solid #e8edf5', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  sectionIcon:   { fontSize: 14 },
  sectionTitle:  { fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em' },
  sectionBadge:  { backgroundColor: '#ede9fe', color: '#4f46e5', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999 },
  formatGrid:    { display: 'flex', gap: 6 },
  formatBtn:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 6px', border: '1.5px solid #e2e8f0', borderRadius: 10, backgroundColor: '#fff', cursor: 'pointer' },
  paramCard:     { display: 'flex', alignItems: 'flex-end', gap: 8, backgroundColor: '#fff', border: '1.5px solid #e8edf5', borderRadius: 10, padding: '10px 12px' },
  paramLabel:    { fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' },
  paramKeyInput: { width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: '#4f46e5', backgroundColor: '#f5f3ff', outline: 'none', boxSizing: 'border-box' },
  paramValueInput:{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#1e293b', outline: 'none', boxSizing: 'border-box' },
  removeBtn:     { background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 7px', fontSize: 11, color: '#ef4444', cursor: 'pointer', flexShrink: 0 },
  addParamBtn:   { background: 'none', border: '1.5px dashed #c7d2fe', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#818cf8', cursor: 'pointer', width: '100%', fontWeight: 600, transition: 'all 0.15s' },
  suggestionsBox:{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 10, overflow: 'hidden', marginTop: 4 },
  suggestItem:   { padding: '8px 10px', cursor: 'pointer', fontSize: 12, transition: 'all 0.1s', borderRadius: 0 },
  hintBox:       { display: 'flex', gap: 8, alignItems: 'flex-start', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' },
  errorBox:      { display: 'flex', gap: 8, alignItems: 'center', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b91c1c' },
  resultBox:     { border: '1px solid #86efac', borderRadius: 10, padding: '14px 16px', backgroundColor: '#f0fdf4' },
  downloadBtn:   { flex: 1, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center' },
  viewBtn:       { flex: 1, backgroundColor: '#fff', color: '#4f46e5', border: '1.5px solid #c4b5fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center' },
  generateBtn:   { color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' },
  retryBtn:      { backgroundColor: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '10px', fontSize: 13, color: '#64748b', cursor: 'pointer', textAlign: 'center', fontWeight: 600 },
};