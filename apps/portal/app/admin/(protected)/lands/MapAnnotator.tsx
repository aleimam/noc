'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Arrow, Line, Transformer } from 'react-konva';
import type Konva from 'konva';

// Highlight-mark editor for a single map image. Admins drop rectangles / circles, draw
// arrows or freehand strokes, then save — the stage is flattened to one image, uploaded,
// and re-attached (which regenerates the brand-stamped copies).

export type Shape = {
  id: string;
  type: 'rect' | 'circle' | 'arrow' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[]; // arrow: [x1,y1,x2,y2]; line: [x1,y1,x2,y2,…]
  stroke: string;
};

type Tool = 'select' | 'arrow' | 'draw';

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#000000', '#ffffff'];
const MAX_DISPLAY = 820;
const MAX_EXPORT = 2200;
let seq = 0;

export function MapAnnotator({
  src,
  initialShapes,
  onClose,
  onSaved,
}: {
  src: string;
  initialShapes?: Shape[];
  onClose: () => void;
  onSaved: (attachmentId: string, shapes: Shape[]) => Promise<void> | void;
}) {
  const t = useTranslations('lands');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [display, setDisplay] = useState({ w: 0, h: 0 });
  const [shapes, setShapes] = useState<Shape[]>(initialShapes ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [color, setColor] = useState<string>(COLORS[0]!);
  const [tool, setTool] = useState<Tool>('select');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const drawingId = useRef<string | null>(null);

  // Continue the id counter past any pre-loaded shapes so new ones don't collide.
  useEffect(() => {
    for (const s of initialShapes ?? []) {
      const n = parseInt(s.id.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > seq) seq = n;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_DISPLAY / Math.max(image.naturalWidth, image.naturalHeight));
      setDisplay({ w: Math.round(image.naturalWidth * scale), h: Math.round(image.naturalHeight * scale) });
      setImg(image);
    };
    image.onerror = () => setError('load');
    image.src = src;
  }, [src]);

  // Transformer only handles the box shapes (rect / circle); arrows and freehand are drawn.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const sh = shapes.find((s) => s.id === selectedId);
    const node = selectedId && sh && (sh.type === 'rect' || sh.type === 'circle') ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, shapes]);

  const strokeW = Math.max(2, Math.round(display.w * 0.006));

  function addBox(type: 'rect' | 'circle') {
    const id = `s${++seq}`;
    const w = Math.max(60, Math.round(display.w * 0.22));
    setShapes((s) => [...s, { id, type, x: display.w / 2 - w / 2, y: display.h / 2 - w / 2, width: w, height: w, points: [], stroke: color }]);
    setSelectedId(id);
    setTool('select');
  }
  function patch(id: string, p: Partial<Shape>) {
    setShapes((s) => s.map((sh) => (sh.id === id ? { ...sh, ...p } : sh)));
  }
  function removeSelected() {
    if (!selectedId) return;
    setShapes((s) => s.filter((sh) => sh.id !== selectedId));
    setSelectedId(null);
  }
  function recolor(c: string) {
    setColor(c);
    if (selectedId) patch(selectedId, { stroke: c });
  }

  // Drawing (arrow / freehand) — press, drag, release on the canvas.
  function onDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool === 'select') {
      if (e.target === e.target.getStage() || e.target.name() === 'bg') setSelectedId(null);
      return;
    }
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const id = `s${++seq}`;
    drawingId.current = id;
    setSelectedId(null);
    setShapes((s) => [
      ...s,
      { id, type: tool === 'arrow' ? 'arrow' : 'line', x: 0, y: 0, width: 0, height: 0, points: [pos.x, pos.y, pos.x, pos.y], stroke: color },
    ]);
  }
  function onMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!drawingId.current) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setShapes((s) =>
      s.map((sh) => {
        if (sh.id !== drawingId.current) return sh;
        if (sh.type === 'arrow') return { ...sh, points: [sh.points[0]!, sh.points[1]!, pos.x, pos.y] };
        return { ...sh, points: [...sh.points, pos.x, pos.y] };
      }),
    );
  }
  function onUp() {
    if (drawingId.current) {
      // Drop zero-length accidental taps.
      setShapes((s) => s.filter((sh) => !(sh.id === drawingId.current && sh.points.length <= 4 && sh.points[0] === sh.points[2] && sh.points[1] === sh.points[3])));
      drawingId.current = null;
      setTool('select');
    }
  }

  async function save() {
    const stage = stageRef.current;
    if (!stage || !img) return;
    setBusy(true);
    setError('');
    setSelectedId(null);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const exportScale = Math.min(img.naturalWidth, MAX_EXPORT) / display.w;
      const dataUrl = stage.toDataURL({ pixelRatio: exportScale, mimeType: 'image/png' });
      // Decode the data URL manually — `fetch(dataUrl)` is governed by the CSP
      // connect-src (which deliberately excludes data:) and gets blocked.
      const b64 = dataUrl.split(',')[1] ?? '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'map.png', { type: 'image/png' });
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'upload');
      await onSaved(json.attachment.id as string, shapes);
    } catch {
      setError('save');
      setBusy(false);
    }
  }

  const toolBtn = (active: boolean) => `rounded-lg px-3 py-1.5 text-sm font-bold ${active ? 'bg-primary text-soft' : 'border border-graphite/25'}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => addBox('rect')} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-soft">▭ {t('annotRect')}</button>
          <button type="button" onClick={() => addBox('circle')} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-soft">◯ {t('annotCircle')}</button>
          <button type="button" onClick={() => setTool((x) => (x === 'arrow' ? 'select' : 'arrow'))} className={toolBtn(tool === 'arrow')}>↗ {t('annotArrow')}</button>
          <button type="button" onClick={() => setTool((x) => (x === 'draw' ? 'select' : 'draw'))} className={toolBtn(tool === 'draw')}>✎ {t('annotDraw')}</button>
          <span className="mx-1 flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => recolor(c)} aria-label={c} className={`h-6 w-6 rounded-full ring-2 ${color === c ? 'ring-primary' : 'ring-graphite/20'}`} style={{ backgroundColor: c }} />
            ))}
          </span>
          <button type="button" onClick={removeSelected} disabled={!selectedId} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-40">✕ {t('annotDelete')}</button>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-graphite/25 px-3 py-1.5 text-sm">{t('annotCancel')}</button>
            <button type="button" onClick={save} disabled={busy || !img} className="rounded-lg bg-green px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">{busy ? t('annotSaving') : t('annotSave')}</button>
          </div>
        </div>

        <p className="mb-2 text-xs opacity-60">{tool === 'select' ? t('annotHint') : t('annotDrawHint')}</p>
        {error && <p className="mb-2 text-sm text-red-600">{error === 'load' ? t('annotLoadErr') : t('annotSaveErr')}</p>}

        <div className="flex justify-center overflow-auto">
          {img && (
            <Stage
              ref={stageRef}
              width={display.w}
              height={display.h}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onTouchStart={onDown}
              onTouchMove={onMove}
              onTouchEnd={onUp}
              className="ring-1 ring-graphite/20"
              style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
            >
              <Layer>
                <KonvaImage image={img} width={display.w} height={display.h} name="bg" />
                {shapes.map((sh) => {
                  const selected = sh.id === selectedId;
                  const sw = strokeW + (selected ? 2 : 0);
                  if (sh.type === 'rect')
                    return (
                      <Rect
                        key={sh.id}
                        ref={(n) => { if (n) nodeRefs.current[sh.id] = n; }}
                        x={sh.x} y={sh.y} width={sh.width} height={sh.height} stroke={sh.stroke} strokeWidth={sw}
                        draggable onClick={() => setSelectedId(sh.id)} onTap={() => setSelectedId(sh.id)}
                        onDragEnd={(e) => patch(sh.id, { x: e.target.x(), y: e.target.y() })}
                        onTransformEnd={(e) => {
                          const node = e.target as Konva.Rect; const sx = node.scaleX(); const sy = node.scaleY();
                          node.scaleX(1); node.scaleY(1);
                          patch(sh.id, { x: node.x(), y: node.y(), width: Math.max(10, node.width() * sx), height: Math.max(10, node.height() * sy) });
                        }}
                      />
                    );
                  if (sh.type === 'circle')
                    return (
                      <Circle
                        key={sh.id}
                        ref={(n) => { if (n) nodeRefs.current[sh.id] = n; }}
                        x={sh.x + sh.width / 2} y={sh.y + sh.height / 2} radius={sh.width / 2} stroke={sh.stroke} strokeWidth={sw}
                        draggable onClick={() => setSelectedId(sh.id)} onTap={() => setSelectedId(sh.id)}
                        onDragEnd={(e) => patch(sh.id, { x: e.target.x() - sh.width / 2, y: e.target.y() - sh.height / 2 })}
                        onTransformEnd={(e) => {
                          const node = e.target as Konva.Circle; const s = node.scaleX();
                          node.scaleX(1); node.scaleY(1);
                          const d = Math.max(10, node.radius() * 2 * s);
                          patch(sh.id, { width: d, height: d, x: node.x() - d / 2, y: node.y() - d / 2 });
                        }}
                      />
                    );
                  if (sh.type === 'arrow')
                    return (
                      <Arrow key={sh.id} points={sh.points} stroke={sh.stroke} fill={sh.stroke} strokeWidth={sw} pointerLength={sw * 3} pointerWidth={sw * 3} onClick={() => setSelectedId(sh.id)} onTap={() => setSelectedId(sh.id)} />
                    );
                  return (
                    <Line key={sh.id} points={sh.points} stroke={sh.stroke} strokeWidth={sw} lineCap="round" lineJoin="round" tension={0.3} onClick={() => setSelectedId(sh.id)} onTap={() => setSelectedId(sh.id)} />
                  );
                })}
                <Transformer ref={trRef} rotateEnabled={false} ignoreStroke borderStroke="#2563eb" anchorStroke="#2563eb" />
              </Layer>
            </Stage>
          )}
        </div>
      </div>
    </div>
  );
}
