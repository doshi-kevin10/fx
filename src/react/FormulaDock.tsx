// <FormulaDock> — the minimal floating picker. Two entry points (by name, by
// quantity) share one compact result list. Selecting a formula reveals a tight
// action footer: the dimensional-verified badge + the full copy/export matrix
// (LaTeX, MathML, Unicode, PNG, SVG, Word), all loaded on demand so the idle
// footprint stays tiny. Users can also add their own named LaTeX formulas.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Domain, Formula, QuantityData, SearchResult, Weights } from '../core/types.js';
import { isRenderable } from '../core/renderPreview.js';
import { takenNames } from '../core/customFormulas.js';
import { getFormat, copyResult, downloadResult, type FormatKind } from '../core/formats.js';
import { createQuantityIndex } from '../core/quantitySearch.js';
import { useFormulaSearch } from './useFormulaSearch.js';
import { useCustomFormulas, type CustomFormulaStore } from './useCustomFormulas.js';
import { QuantityChips } from './QuantityChips.js';
import { CalculatorPanel } from './CalculatorPanel.js';
import { Tex } from './Tex.js';

export type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface FormulaDockProps {
  index: Formula[];
  embeddings?: Record<string, number[]>;
  /** Enables the "by quantity" mode when provided (dist/quantities.json). */
  quantities?: QuantityData;
  onSelect?: (formula: Formula) => void;
  domains?: Domain[];
  enableSemantic?: boolean;
  enableImageExport?: boolean;
  /**
   * Render a formula PNG. Defaults to in-page rasterization (fine on normal
   * pages). The extension passes an offscreen-document renderer so it works on
   * strict-CSP sites (e.g. Google Docs) where in-page canvas is blocked.
   */
  renderPng?: (latex: string, scale?: number) => Promise<Blob>;
  enableCustom?: boolean;
  storageKey?: string;
  /** Custom persistence backend. Overrides `storageKey` (e.g. chrome.storage). */
  customStore?: CustomFormulaStore;
  weights?: Partial<Weights>;
  limit?: number;
  placeholder?: string;
  corner?: Corner;
  /** Persist a corner the user picked (defaults become the initial corner). */
  onCornerChange?: (corner: Corner) => void;
  defaultOpen?: boolean;
  hotkey?: string | null;
  pillLabel?: string;
  className?: string;
}

const DOMAINS: Domain[] = ['math', 'physics', 'astrophysics', 'chemistry'];
type Mode = 'name' | 'quantity';
type View = 'search' | 'add';

const COPY_FORMATS: { kind: FormatKind; label: string; title: string }[] = [
  { kind: 'latex', label: 'TeX', title: 'Copy LaTeX' },
  { kind: 'mathml', label: 'MML', title: 'Copy MathML' },
  { kind: 'unicode', label: 'Uni~', title: 'Copy Unicode (approximate)' },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function matchesHotkey(e: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const mod = e.metaKey || e.ctrlKey;
  return (
    e.key.toLowerCase() === key &&
    (!parts.includes('mod') || mod) &&
    (!parts.includes('shift') || e.shiftKey) &&
    (!parts.includes('alt') || e.altKey)
  );
}

export function FormulaDock({
  index,
  embeddings,
  quantities,
  onSelect,
  domains,
  enableSemantic = true,
  enableImageExport = true,
  renderPng,
  enableCustom = true,
  storageKey,
  customStore,
  weights,
  limit = 6,
  placeholder = 'Search a formula…',
  corner: cornerProp = 'top-right',
  onCornerChange,
  defaultOpen = false,
  hotkey = 'mod+k',
  pillLabel = 'ƒx',
  className,
}: FormulaDockProps) {
  const [open, setOpen] = useState(defaultOpen);
  // Corner is local state seeded by the prop; adopt the prop when it changes
  // (e.g. the extension's persisted value arrives async after mount).
  const [corner, setCorner] = useState<Corner>(cornerProp);
  useEffect(() => setCorner(cornerProp), [cornerProp]);
  const cycleCorner = useCallback(() => {
    const order: Corner[] = ['top-right', 'bottom-right', 'bottom-left', 'top-left'];
    setCorner((c) => {
      const next = order[(order.indexOf(c) + 1) % order.length];
      onCornerChange?.(next);
      return next;
    });
  }, [onCornerChange]);

  // Drag the closed pill anywhere; on release it snaps to the nearest corner
  // (which the layout is built around) and persists via onCornerChange.
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const onPillPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId); // absent in jsdom
  }, []);
  const onPillPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 6 && Math.abs(e.clientY - d.startY) < 6) return;
    d.moved = true;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, []);
  const onPillPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDragPos(null);
      if (!d) return;
      if (!d.moved) {
        setOpen(true); // a plain click opens the dock
        return;
      }
      const vertical = e.clientY < window.innerHeight / 2 ? 'top' : 'bottom';
      const horizontal = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
      const next = `${vertical}-${horizontal}` as Corner;
      setCorner(next);
      onCornerChange?.(next);
    },
    [onCornerChange]
  );

  const [view, setView] = useState<View>('search');
  const [mode, setMode] = useState<Mode>('name');
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Formula | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  // PNG data URL of the selected formula, used for drag-and-drop into docs.
  const [dragImg, setDragImg] = useState<string | null>(null);
  // The rendered PNG behind dragImg, kept for click-to-copy / download (no
  // re-rasterizing on the host page, which strict-CSP sites block).
  const dragBlobRef = useRef<Blob | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { custom, merged, add, remove } = useCustomFormulas(index, storageKey, customStore);

  // Render a formula PNG. Prefer renderPng (offscreen, CSP-immune) when given,
  // but fall back to in-page rasterization if it errors — so we get an image by
  // whichever path works.
  const renderFormulaPng = useCallback(
    async (latex: string): Promise<Blob> => {
      const inPage = async () => (await import('../core/exportImage.js')).toPNG(latex, { scale: 3 });
      if (!renderPng) return inPage();
      try {
        return await renderPng(latex, 3);
      } catch (offscreenErr) {
        console.error('[Formulyze] OFFSCREEN render failed', offscreenErr);
        try {
          return await inPage();
        } catch {
          // In-page can't work on strict-CSP sites; surface the OFFSCREEN error,
          // which is the one that actually needs fixing.
          throw offscreenErr instanceof Error
            ? new Error(`offscreen: ${offscreenErr.message}`)
            : new Error(`offscreen: ${String(offscreenErr)}`);
        }
      }
    },
    [renderPng]
  );

  // Entry point 1 — by name.
  const { query, setQuery, results: nameResults, modelStatus } = useFormulaSearch({
    index: merged,
    embeddings,
    enableSemantic,
    weights,
    domains,
    limit,
  });

  // Entry point 2 — by quantity (only when a quantities index is supplied).
  const quantityIndex = useMemo(
    () => (quantities ? createQuantityIndex({ index: merged, quantities }) : null),
    [merged, quantities]
  );
  const [have, setHave] = useState<string[]>([]);
  const [want, setWant] = useState<string | undefined>(undefined);
  const quantityResults = useMemo<SearchResult[]>(
    () => (quantityIndex ? quantityIndex.search(have, want, { limit }) : []),
    [quantityIndex, have, want, limit]
  );

  const results = mode === 'quantity' ? quantityResults : nameResults;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setFallbackText(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(() => {
    if (!hotkey) return;
    const handler = (e: KeyboardEvent) => {
      if (matchesHotkey(e, hotkey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hotkey]);

  // Render a PNG of the selected formula for the drag handle + click-to-copy.
  useEffect(() => {
    if (!enableImageExport || !selected) {
      setDragImg(null);
      dragBlobRef.current = null;
      return;
    }
    let alive = true;
    setDragImg(null);
    dragBlobRef.current = null;
    void (async () => {
      try {
        // Transparent + tight to the formula's own bounding box — drops as just
        // the glyphs, not a white rectangle. (Word page shows through as white.)
        const blob = await renderFormulaPng(selected.latex);
        const dataUrl = await blobToDataUrl(blob);
        if (alive) {
          dragBlobRef.current = blob;
          setDragImg(dataUrl);
        }
      } catch (err) {
        console.error('[Formulyze] drag image failed', err);
        if (alive) setDragImg(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selected, enableImageExport, renderFormulaPng]);

  useEffect(() => {
    if (open && view === 'search' && mode === 'name') requestAnimationFrame(() => inputRef.current?.focus());
    if (open && view === 'add') requestAnimationFrame(() => nameRef.current?.focus());
  }, [open, view, mode]);

  useEffect(() => {
    setActive((a) => (results.length === 0 ? 0 : Math.min(a, results.length - 1)));
  }, [results]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), []);

  const choose = useCallback(
    (f: Formula) => {
      setSelected(f);
      // Auto-reveal the calculator for formulas that support it.
      setShowCalc(Boolean(f.relation));
      onSelect?.(f);
      // Single-click still grabs the LaTeX — the most common action.
      void (async () => {
        try {
          const r = await getFormat(f, 'latex');
          const out = await copyResult(r);
          flash(out.ok ? 'LaTeX copied' : 'Selected');
        } catch {
          flash('Selected');
        }
      })();
    },
    [onSelect, flash]
  );

  const deleteCustom = useCallback(
    (f: Formula) => {
      remove(f.id);
      setSelected((s) => (s?.id === f.id ? null : s));
      flash('Removed');
    },
    [remove, flash]
  );

  const runFormat = useCallback(
    async (f: Formula, kind: FormatKind, action: 'copy' | 'download') => {
      try {
        const r = await getFormat(f, kind);
        if (action === 'download') {
          downloadResult(r);
          flash(`Saved ${r.filename ?? kind}${r.note ? ' (text)' : ''}`);
        } else {
          const out = await copyResult(r);
          if (out.ok) flash(`Copied ${kind}${r.approximate ? ' ~' : ''}`);
          else {
            setToast(out.note ?? 'Copy blocked');
            setFallbackText(out.fallbackText ?? null);
          }
        }
      } catch (err) {
        console.error('[Formulyze] format failed', kind, err);
        flash('Could not produce that format');
      }
    },
    [flash]
  );

  // Image copy/download reuse the pre-rendered blob (dragBlobRef); if it isn't
  // ready yet (or that render failed), render on demand and SURFACE the real
  // error — rendering happens off the host page via renderPng in the extension.
  const ensureImageBlob = useCallback(async (): Promise<Blob | null> => {
    if (dragBlobRef.current) return dragBlobRef.current;
    if (!selected) return null;
    try {
      const blob = await renderFormulaPng(selected.latex);
      dragBlobRef.current = blob;
      return blob;
    } catch (err) {
      console.error('[Formulyze] image render failed', err);
      flash(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, [selected, renderFormulaPng, flash]);

  const copyImage = useCallback(async () => {
    const blob = await ensureImageBlob();
    if (!blob) return;
    const out = await copyResult({ kind: 'png', tier: 'guaranteed', mime: 'image/png', blob });
    if (out.ok) flash('Image copied — paste (⌘/Ctrl+V) into your doc');
    else {
      setToast(out.note ?? 'Copy blocked');
      setFallbackText(null);
    }
  }, [ensureImageBlob, flash]);

  const downloadImage = useCallback(async () => {
    const blob = await ensureImageBlob();
    if (!blob) return;
    downloadResult({ kind: 'png', tier: 'guaranteed', mime: 'image/png', blob, filename: `${selected?.id ?? 'formula'}.png` });
    flash('Saved PNG');
  }, [ensureImageBlob, flash, selected]);

  const onNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (query) setQuery('');
        else setOpen(false);
        return;
      }
      if (results.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active].formula); }
    },
    [results, active, choose, query, setQuery]
  );

  const openAdd = useCallback((prefillName = '') => {
    setView('add');
    setDraft({ name: prefillName, latex: '', domain: 'math' });
    setAddError(null);
  }, []);

  // ---- add-formula draft ----
  const [draft, setDraft] = useState<{ name: string; latex: string; domain: Domain }>({ name: '', latex: '', domain: 'math' });
  const [addError, setAddError] = useState<string | null>(null);
  const takenSet = useMemo(() => takenNames(merged), [merged]);
  const nameTaken = draft.name.trim() !== '' && takenSet.has(draft.name.trim().toLowerCase());
  const latexOk = draft.latex.trim() !== '' && isRenderable(draft.latex);
  const canSave = draft.name.trim() !== '' && draft.latex.trim() !== '' && !nameTaken && latexOk;

  const saveDraft = useCallback(() => {
    const res = add({ name: draft.name, latex: draft.latex, domain: draft.domain });
    if (!res.ok) { setAddError(res.message ?? 'Could not add formula.'); return; }
    if (res.formula) { setSelected(res.formula); onSelect?.(res.formula); }
    setView('search');
    setMode('name');
    setQuery('');
    flash('Formula added');
  }, [add, draft, onSelect, setQuery, flash]);

  const rootCls = ['fzd', `fzd-${corner}`, open ? 'fzd-open' : 'fzd-closed', className].filter(Boolean).join(' ');

  if (!open) {
    // While dragging, pin the pill to the cursor; otherwise the corner class positions it.
    const dragStyle = dragPos
      ? ({ top: dragPos.y, left: dragPos.x, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' } as const)
      : undefined;
    return (
      <div className={rootCls} style={dragStyle}>
        <button className="fzd-pill" aria-label="Open formula search (drag to move)"
          onPointerDown={onPillPointerDown} onPointerMove={onPillPointerMove} onPointerUp={onPillPointerUp}
          title={`Drag to move · click to open${hotkey ? ` (${hotkey.replace('mod', '⌘/Ctrl')})` : ''}`}>
          <span className="fzd-pill-ripple" aria-hidden="true" />
          <svg className="fzd-pill-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {/* stylized ƒ(x): a function curve through light axes */}
            <path d="M4 20 Q4 5 12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M2.5 12.5 H10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M13.5 9 L20.5 18 M20.5 9 L13.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          </svg>
          <span className="fzd-pill-label" aria-hidden="true">{pillLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={rootCls} role="dialog" aria-label="Formula search">
      <div className="fzd-card">
        {view === 'search' ? (
          <>
            <div className="fzd-head">
              {quantityIndex ? (
                <div className="fzd-modes" role="tablist">
                  <button role="tab" aria-selected={mode === 'name'} className={`fzd-mode ${mode === 'name' ? 'fzd-mode-on' : ''}`} onClick={() => setMode('name')}>Name</button>
                  <button role="tab" aria-selected={mode === 'quantity'} className={`fzd-mode ${mode === 'quantity' ? 'fzd-mode-on' : ''}`} onClick={() => setMode('quantity')}>Quantity</button>
                </div>
              ) : (
                <span className="fzd-title">Formulas{modelStatus === 'loading' && <span className="fzd-warm">•</span>}</span>
              )}
              <div className="fzd-head-actions">
                {enableCustom && <button className="fzd-add-btn" onClick={() => openAdd()} title="Add your own formula">+ New</button>}
                <button className="fzd-x" onClick={cycleCorner} title={`Move to another corner (now: ${corner.replace('-', ' ')})`} aria-label="Move to another corner">⤢</button>
                <button className="fzd-x" onClick={() => setOpen(false)} aria-label="Collapse">×</button>
              </div>
            </div>

            {mode === 'name' ? (
              <input
                ref={inputRef}
                className="fzd-input"
                type="text"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onNameKeyDown}
              />
            ) : (
              quantityIndex && (
                <div className="fzd-quantity">
                  <QuantityChips quantityIndex={quantityIndex} have={have} onChangeHave={setHave} want={want} onChangeWant={setWant} suggestionLimit={5} />
                </div>
              )
            )}

            {results.length > 0 && (
              <ul className="fzd-list" role="listbox" ref={listRef}>
                {results.map((r, i) => (
                  <li key={r.formula.id} data-idx={i} role="option" aria-selected={i === active}
                    className={['fzd-row', i === active ? 'fzd-row-active' : ''].filter(Boolean).join(' ')}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => { e.preventDefault(); choose(r.formula); }}>
                    <span className={`fzd-dot fzd-dot-${r.formula.domain}`} title={r.formula.domain} />
                    <span className="fzd-row-body">
                      <span className="fzd-row-name">
                        {r.formula.custom && <span className="fzd-star" title="Your formula">★</span>}
                        {r.formula.name}
                        {r.formula.dimCheck === 'consistent' && <span className="fzd-check" title="Dimensionally verified">✓</span>}
                      </span>
                      <Tex latex={r.formula.latex} className="fzd-row-tex" />
                    </span>
                    {r.formula.custom && (
                      <button className="fzd-row-del" title="Delete your formula" aria-label={`Delete ${r.formula.name}`}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); deleteCustom(r.formula); }}>×</button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {mode === 'name' && query && results.length === 0 && (
              <div className="fzd-empty">
                <span>No match for “{query.trim()}”.</span>
                {enableCustom && (
                  <button className="fzd-add-cta" onMouseDown={(e) => { e.preventDefault(); openAdd(query.trim()); }}>
                    + Add “{query.trim()}” as your own
                  </button>
                )}
              </div>
            )}
            {mode === 'quantity' && (have.length > 0 || want) && results.length === 0 && (
              <div className="fzd-empty">No formula uses those quantities together.</div>
            )}

            {selected && (
              <div className="fzd-preview">
                <div className="fzd-preview-top">
                  <span className="fzd-preview-name">{selected.name}</span>
                  {selected.dimCheck === 'consistent' && <span className="fzd-verified" title="Both sides reduce to the same physical dimension">✓ verified</span>}
                </div>
                <div className="fzd-preview-render"><Tex latex={selected.latex} display /></div>
                {enableImageExport && dragImg && (
                  <div className="fzd-drag">
                    <img
                      className="fzd-drag-img"
                      src={dragImg}
                      alt={selected.name}
                      draggable
                      // Click = copy to clipboard: the ONE path that works into
                      // Google Docs and Word (both reject dragged images — Docs'
                      // canvas editor and native Word only take a paste).
                      onClick={copyImage}
                      onDragStart={(e) => {
                        // Stop the host page (e.g. Docs) from cancelling the drag.
                        e.stopPropagation();
                        const dt = e.dataTransfer;
                        dt.effectAllowed = 'copy';
                        // Editors that accept dropped HTML (Notion, Gmail, many
                        // CMSs) get the image inline; others fall back to LaTeX.
                        dt.setData('text/html', `<img src="${dragImg}" alt="">`);
                        dt.setData('text/plain', selected.latex);
                        dt.setData('DownloadURL', `image/png:${selected.id}.png:${dragImg}`);
                      }}
                      title="Click to copy, then paste (⌘/Ctrl+V) into Docs or Word. Or drag into an editor that accepts images."
                    />
                    <span className="fzd-drag-hint">Click to copy → paste into Docs/Word · or drag into Notion/email</span>
                  </div>
                )}
                <div className="fzd-fmts">
                  <span className="fzd-fmts-label">Copy</span>
                  {COPY_FORMATS.map((f) => (
                    <button key={f.kind} className="fzd-fmt" title={f.title} onClick={() => runFormat(selected, f.kind, 'copy')}>{f.label}</button>
                  ))}
                  {enableImageExport && <button className="fzd-fmt" title="Copy image" onClick={copyImage}>Img</button>}
                </div>
                {enableImageExport && (
                  <div className="fzd-fmts">
                    <span className="fzd-fmts-label">Save</span>
                    <button className="fzd-fmt" onClick={downloadImage}>PNG</button>
                    <button className="fzd-fmt" onClick={() => runFormat(selected, 'svg', 'download')}>SVG</button>
                    <button className="fzd-fmt fzd-fmt-effort" title="Editable Word equation (best-effort), with a text fallback" onClick={() => runFormat(selected, 'word', 'download')}>Word*</button>
                  </div>
                )}
                {fallbackText != null && (
                  <textarea className="fzd-fallback" readOnly value={fallbackText} onFocus={(e) => e.currentTarget.select()} />
                )}
                {selected.relation && (
                  <div className="fzd-calc">
                    <button className={`fzd-calc-toggle ${showCalc ? 'fzd-calc-on' : ''}`} onClick={() => setShowCalc((v) => !v)} aria-expanded={showCalc}>
                      <span className="fzd-calc-ic">∑</span> Calculator
                      <span className="fzd-calc-caret">{showCalc ? '▾' : '▸'}</span>
                    </button>
                    {showCalc && <CalculatorPanel formula={selected} />}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ---- add-formula view ---- */
          <div className="fzd-add">
            <div className="fzd-head">
              <button className="fzd-back" onClick={() => setView('search')} aria-label="Back">←</button>
              <span className="fzd-title">New formula</span>
              <button className="fzd-x" onClick={() => setOpen(false)} aria-label="Collapse">×</button>
            </div>
            <label className="fzd-label" htmlFor="fzd-name">Name</label>
            <input ref={nameRef} id="fzd-name" className={['fzd-input', nameTaken ? 'fzd-input-err' : ''].filter(Boolean).join(' ')}
              type="text" spellCheck={false} placeholder="e.g. My drag equation" value={draft.name}
              onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setAddError(null); }} />
            {nameTaken && <div className="fzd-hint fzd-hint-err">That name is already taken.</div>}
            <label className="fzd-label" htmlFor="fzd-latex">LaTeX</label>
            <textarea id="fzd-latex" className="fzd-textarea" spellCheck={false} rows={2}
              placeholder="e.g. F_d = \tfrac{1}{2} \rho v^2 C_d A" value={draft.latex}
              onChange={(e) => { setDraft((d) => ({ ...d, latex: e.target.value })); setAddError(null); }} />
            <label className="fzd-label" htmlFor="fzd-domain">Category</label>
            <select id="fzd-domain" className="fzd-select" value={draft.domain} onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value as Domain }))}>
              {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="fzd-live">
              {draft.latex.trim() === '' ? <span className="fzd-live-empty">Preview appears here…</span>
                : latexOk ? <Tex latex={draft.latex} display />
                : <span className="fzd-live-err">Doesn’t render yet — check the syntax.</span>}
            </div>
            {addError && <div className="fzd-hint fzd-hint-err">{addError}</div>}
            <div className="fzd-add-actions">
              <button className="fzd-btn fzd-btn-key" disabled={!canSave} onClick={saveDraft}>Save formula</button>
              <button className="fzd-btn" onClick={() => setView('search')}>Cancel</button>
            </div>
            {custom.length > 0 && <div className="fzd-hint">{custom.length} of your formula{custom.length === 1 ? '' : 's'} saved.</div>}
          </div>
        )}

        {toast && <div className="fzd-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}
