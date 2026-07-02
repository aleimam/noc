'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Transformer } from 'react-konva';
import type Konva from 'konva';

// Highlight-mark editor for a single map image. The admin drops outline rectangles /
// circles, drags/resizes them, then saves — the stage is flattened to one image and
// uploaded; the caller re-attaches it (which regenerates the brand-stamped copies).

type Shape = {
  id: string;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
};

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#000000', '#ffffff'];
const MAX_DISPLAY = 820; // longest display edge (px)
const MAX_EXPORT = 2200; // cap the saved image's longest edge (keeps file size sane)
let seq = 0;

export function MapAnnotator({
  src,
  onClose,
  onSaved,
}: {
  src: string;
  onClose: () => void;
  onSaved: (attachmentId: string) => Promise<void> | void;
}) {
  const t = useTranslations('lands');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [display, setDisplay] = useState({ w: 0, h: 0, scale: 1 });
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [color, setColor] = useState<string>(COLORS[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});

  // Load the source image and compute a display size that fits the modal.
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_DISPLAY / Math.max(image.naturalWidth, image.naturalHeight));
      setDisplay({ w: Math.round(image.naturalWidth * scale), h: Math.round(image.naturalHeight * scale), scale });
      setImg(image);
    };
    image.onerror = () => setError('load');
    image.src = src;
  }, [src]);

  // Attach the transformer to the selected shape.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, shapes]);

  function addShape(type: 'rect' | 'circle') {
    const id = `s${++seq}`;
    const w = Math.max(60, Math.round(display.w * 0.22));
    setShapes((s) => [
      ...s,
      { id, type, x: display.w / 2 - w / 2, y: display.h / 2 - w / 2, width: w, height: w, stroke: color },
    ]);
    setSelectedId(id);
  }

  function patch(id: string, p: Partial<Shape>) {
    setShapes((s) => s.map((sh) => (sh.id === id ? { ...sh, ...p } : sh)));
  }

  function removeSelected() {
    if (!selectedId) return;
    setShapes((s) => s.filter((sh) => sh.id !== selectedId));
    setSelectedId(null);
  }

  function recolorSelected(c: string) {
    setColor(c);
    if (selectedId) patch(selectedId, { stroke: c });
  }

  async function save() {
    const stage = stageRef.current;
    if (!stage || !img) return;
    setBusy(true);
    setError('');
    setSelectedId(null); // detach the transformer so its handles aren't baked in
    // Let React flush the deselect before exporting.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const exportScale = Math.min(img.naturalWidth, MAX_EXPORT) / display.w;
      const dataUrl = stage.toDataURL({ pixelRatio: exportScale, mimeType: 'image/png' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'map.png', { type: 'image/png' });
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'upload');
      await onSaved(json.attachment.id as string);
    } catch {
      setError('save');
      setBusy(false);
    }
  }

  const strokeW = Math.max(2, Math.round(display.w * 0.006));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => addShape('rect')} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-soft">▭ {t('annotRect')}</button>
          <button type="button" onClick={() => addShape('circle')} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-soft">◯ {t('annotCircle')}</button>
          <span className="mx-1 flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => recolorSelected(c)}
                aria-label={c}
                className={`h-6 w-6 rounded-full ring-2 ${color === c ? 'ring-primary' : 'ring-graphite/20'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </span>
          <button type="button" onClick={removeSelected} disabled={!selectedId} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-40">✕ {t('annotDelete')}</button>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-graphite/25 px-3 py-1.5 text-sm">{t('annotCancel')}</button>
            <button type="button" onClick={save} disabled={busy || !img} className="rounded-lg bg-green px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">{busy ? t('annotSaving') : t('annotSave')}</button>
          </div>
        </div>

        <p className="mb-2 text-xs opacity-60">{t('annotHint')}</p>
        {error && <p className="mb-2 text-sm text-red-600">{error === 'load' ? t('annotLoadErr') : t('annotSaveErr')}</p>}

        <div className="flex justify-center overflow-auto">
          {img && (
            <Stage
              ref={stageRef}
              width={display.w}
              height={display.h}
              onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
              onTouchStart={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
              className="ring-1 ring-graphite/20"
            >
              <Layer>
                <KonvaImage image={img} width={display.w} height={display.h} listening={false} />
                {shapes.map((sh) =>
                  sh.type === 'rect' ? (
                    <Rect
                      key={sh.id}
                      ref={(n) => { if (n) nodeRefs.current[sh.id] = n; }}
                      x={sh.x}
                      y={sh.y}
                      width={sh.width}
                      height={sh.height}
                      stroke={sh.stroke}
                      strokeWidth={strokeW}
                      draggable
                      onClick={() => setSelectedId(sh.id)}
                      onTap={() => setSelectedId(sh.id)}
                      onDragEnd={(e) => patch(sh.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Rect;
                        const sx = node.scaleX();
                        const sy = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);
                        patch(sh.id, { x: node.x(), y: node.y(), width: Math.max(10, node.width() * sx), height: Math.max(10, node.height() * sy) });
                      }}
                    />
                  ) : (
                    <Circle
                      key={sh.id}
                      ref={(n) => { if (n) nodeRefs.current[sh.id] = n; }}
                      x={sh.x + sh.width / 2}
                      y={sh.y + sh.height / 2}
                      radius={sh.width / 2}
                      stroke={sh.stroke}
                      strokeWidth={strokeW}
                      draggable
                      onClick={() => setSelectedId(sh.id)}
                      onTap={() => setSelectedId(sh.id)}
                      onDragEnd={(e) => patch(sh.id, { x: e.target.x() - sh.width / 2, y: e.target.y() - sh.height / 2 })}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Circle;
                        const s = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        const d = Math.max(10, node.radius() * 2 * s);
                        patch(sh.id, { width: d, height: d, x: node.x() - d / 2, y: node.y() - d / 2 });
                      }}
                    />
                  ),
                )}
                <Transformer ref={trRef} rotateEnabled={false} ignoreStroke borderStroke="#2563eb" anchorStroke="#2563eb" />
              </Layer>
            </Stage>
          )}
        </div>
      </div>
    </div>
  );
}
