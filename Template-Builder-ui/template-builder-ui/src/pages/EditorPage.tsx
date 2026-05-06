// src/pages/EditorPage.tsx

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getTemplate,
  updateTemplate,
  publishTemplate,
  bindPlaceholder,
} from '../api/templates';
import { listPlaceholders } from '../api/placeholders';
import apiClient from '../api/client';
import type { Template, OutputTarget, LayoutBlock, Placeholder, TableColumn } from '../types/api';
import EditorTopBar from '../components/editor/EditorTopBar';
import PlaceholderPalette from '../components/editor/PlaceholderPalette';
import BlockCanvas from '../components/editor/BlockCanvas';
import InspectorPanel from '../components/editor/InspectorPanel';
import PreviewBar from '../components/editor/PreviewBar';
import PreviewPane from '../components/editor/PreviewPane';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ErrorAlert from '../components/shared/ErrorAlert';
import GeneratePanel from '../components/editor/GeneratePanel';
import VersionHistoryPanel from '../components/editor/VersionHistoryPanel';
import TestsPanel from '../components/editor/TestsPanel';
import AIToolsPanel from '../components/editor/AIToolsPanel';
import '../styles/editor-page.css';

interface FocusedCell {
  blockId: string;
  type: 'binding';
  colIndex: number;
  rowIndex?: never;
}
interface FocusedDataCell {
  blockId: string;
  type: 'cell';
  colIndex: number;
  rowIndex: number;
}
type FocusedTableTarget = FocusedCell | FocusedDataCell | null;

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();

  const [template, setTemplate]               = useState<Template | null>(null);
  const [blocks, setBlocks]                   = useState<LayoutBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading]             = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [isSaving, setIsSaving]               = useState(false);
  const [isDirty, setIsDirty]                 = useState(false);
  const [isRefreshing, setIsRefreshing]       = useState(false);
  const [placeholders, setPlaceholders]       = useState<Placeholder[]>([]);
  const [showGenerate, setShowGenerate]       = useState(false);
  const [previewFormat, setPreviewFormat]     = useState('HTML');
  const [previewDevice, setPreviewDevice]     = useState('Desktop');
  const [showPreview, setShowPreview]         = useState(false);
  const [showVersions, setShowVersions]       = useState(false);
  const [showTests, setShowTests]             = useState(false);
  const [showAITools, setShowAITools]         = useState(false);
  const [focusedCell, setFocusedCell]         = useState<FocusedTableTarget>(null);

  // ── Load template ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const templateId = id;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTemplate(templateId);
        setTemplate(data);
        const layoutJson = (data as unknown as {
          layout_json?: { blocks?: LayoutBlock[] };
        }).layout_json;
        setBlocks(layoutJson?.blocks ?? data.root_layout_json ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  // ── Load placeholders ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadPlaceholders() {
      try {
        const data = await listPlaceholders();
        setPlaceholders(data);
      } catch {
        setPlaceholders([]);
      }
    }
    loadPlaceholders();
  }, []);

  // ── Block changes ──────────────────────────────────────────────────────────
  function handleBlocksChange(updated: LayoutBlock[]) {
    setBlocks(updated);
    setIsDirty(true);
  }

  function handleNameChange(name: string) {
    if (!template) return;
    setTemplate({ ...template, name });
    setIsDirty(true);
  }

  function handleTargetChange(target: OutputTarget) {
    if (!template) return;
    setTemplate({ ...template, output_target: target });
    setIsDirty(true);
  }

  // ── Insert token from palette ──────────────────────────────────────────────
  function handleInsertToken(tokenName: string) {
    if (!selectedBlockId) return;

    const token = `{{${tokenName}}}`;
    const currentBlock = blocks.find((item) => item.block_id === selectedBlockId);
    if (!currentBlock) return;

    if (currentBlock.type === 'table') {
      if (!focusedCell || focusedCell.blockId !== selectedBlockId) return;

      if (focusedCell.type === 'binding') {
        const updatedColumns = (currentBlock.columns ?? []).map(
          (col: TableColumn, i: number) =>
            i === focusedCell.colIndex ? { ...col, binding: token } : col
        );
        handleBlocksChange(
          blocks.map((item) =>
            item.block_id === selectedBlockId
              ? { ...item, columns: updatedColumns }
              : item
          )
        );
      } else if (focusedCell.type === 'cell') {
        const currentRows = currentBlock.rows ?? [];
        const updatedRows = currentRows.map((row, ri) =>
          ri === focusedCell.rowIndex
            ? row.map((cell, ci) => ci === focusedCell.colIndex ? token : cell)
            : row
        );
        handleBlocksChange(
          blocks.map((item) =>
            item.block_id === selectedBlockId
              ? { ...item, rows: updatedRows }
              : item
          )
        );
      }
      return;
    }

    if (currentBlock.type !== 'text') return;

    const activeEl = document.activeElement as HTMLTextAreaElement | null;
    const currentContent = currentBlock.content ?? '';
    let newContent: string;

    if (
      activeEl &&
      (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') &&
      activeEl.selectionStart !== null
    ) {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd ?? start;
      newContent = currentContent.slice(0, start) + token + currentContent.slice(end);
      const newCursor = start + token.length;
      setTimeout(() => {
        activeEl.selectionStart = newCursor;
        activeEl.selectionEnd = newCursor;
        activeEl.focus();
      }, 0);
    } else {
      newContent = currentContent + token;
    }

    handleBlocksChange(
      blocks.map((item) =>
        item.block_id === selectedBlockId ? { ...item, content: newContent } : item
      )
    );

    const placeholder = placeholders.find((item) => item.name === tokenName);
    if (placeholder && template) {
      bindPlaceholder(template.template_id, placeholder.registry_id, placeholder.sample_value)
        .catch(() => {});
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!template || !id) return;
    setIsSaving(true);
    try {
      const updated = await updateTemplate(id, {
        name: template.name,
        output_target: template.output_target,
        root_layout_json: blocks,
      });
      setTemplate(updated);
      const savedLayout = (updated as unknown as {
        layout_json?: { blocks?: LayoutBlock[] };
      }).layout_json;
      if (savedLayout?.blocks) setBlocks(savedLayout.blocks);
      setIsDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  async function handleMakeDraft() {
    if (!template) return;
    if (!window.confirm('Revert to draft? The published version will be preserved in Version History.')) return;
    try {
      const response = await apiClient.post(`/templates/${template.template_id}/revert-to-draft`);
      setTemplate(response.data);
    } catch {
      alert('Failed to revert to draft. Please try again.');
    }
  }

  async function handlePublish() {
    if (!id) return;
    const summary = window.prompt('Enter a change summary (optional):');
    if (summary === null) return;
    setIsSaving(true);
    try {
      await publishTemplate(id, summary || undefined);
      const updated = await getTemplate(id);
      setTemplate(updated);
      setIsDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  async function handleRefreshPreview() {
    setIsRefreshing(true);
    setShowPreview(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setIsRefreshing(false);
  }

  if (isLoading) {
    return (
      <div className="editor-page__centered">
        <LoadingSpinner message="Loading template..." />
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="editor-page__error-shell">
        <ErrorAlert message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="editor-page">
      <EditorTopBar
        template={template}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={handleSave}
        onPublish={handlePublish}
        onMakeDraft={handleMakeDraft}
        onNameChange={handleNameChange}
        onTargetChange={handleTargetChange}
        onGenerate={() => setShowGenerate(true)}
        onViewVersions={() => setShowVersions(true)}
        onViewTests={() => setShowTests(true)}
        onAITools={() => setShowAITools(true)}
      />

      {error && (
        <div className="editor-page__inline-error">
          <ErrorAlert message={error} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="editor-page__main">
        <div className="editor-page__panels">

          <PlaceholderPalette
            placeholders={placeholders}
            selectedBlockId={selectedBlockId}
            onInsertToken={handleInsertToken}
            blocks={blocks}
          />

          {/* Pass placeholders so TextBlock can show red underline for unknown tokens */}
          <BlockCanvas
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onBlocksChange={handleBlocksChange}
            placeholders={placeholders}
            onColumnFocus={(blockId, colIndex) =>
              setFocusedCell({ blockId, type: 'binding', colIndex })
            }
            onCellFocus={(blockId, rowIndex, colIndex) =>
              setFocusedCell({ blockId, type: 'cell', rowIndex, colIndex })
            }
          />

          <InspectorPanel
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            placeholders={placeholders}
            onBlockChange={(blockId, changes) =>
              handleBlocksChange(
                blocks.map((item) =>
                  item.block_id === blockId ? { ...item, ...changes } : item
                )
              )
            }
          />
        </div>

        {showPreview && (
          <div className="editor-page__preview-section">
            <button
              type="button"
              className="editor-page__close-preview"
              onClick={() => setShowPreview(false)}
            >
              Close preview
            </button>
            <PreviewPane
              blocks={blocks}
              placeholders={placeholders}
              device={previewDevice}
              format={previewFormat}
              templateId={template?.template_id ?? ''}
            />
          </div>
        )}
      </div>

      <PreviewBar
        onRefresh={handleRefreshPreview}
        isRefreshing={isRefreshing}
        format={previewFormat}
        onFormatChange={setPreviewFormat}
        device={previewDevice}
        onDeviceChange={setPreviewDevice}
      />

      {showGenerate && template && (
        <GeneratePanel
          templateId={template.template_id}
          templateName={template.name}
          outputTarget={template.output_target}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {showVersions && template && (
        <VersionHistoryPanel
          templateId={template.template_id}
          onClose={() => setShowVersions(false)}
          onRestore={(restoredBlocks) => {
            setBlocks(restoredBlocks);
            setShowVersions(false);
          }}
        />
      )}

      {showTests && template && (
        <TestsPanel templateId={template.template_id} onClose={() => setShowTests(false)} />
      )}

      {showAITools && template && (
        <AIToolsPanel
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onBlocksChange={handleBlocksChange}
          onClose={() => setShowAITools(false)}
        />
      )}
    </div>
  );
}