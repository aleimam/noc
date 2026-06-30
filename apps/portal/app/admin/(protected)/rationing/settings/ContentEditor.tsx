'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveConfig } from './actions';
import type { RationingConfig, WatermarkPosition } from '../../../../../lib/rationing/settings';

const POSITIONS: WatermarkPosition[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1.5 text-sm';

export function ContentEditor({ config }: { config: RationingConfig }) {
  const t = useTranslations('rationing');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [c, setC] = useState<RationingConfig>(config);

  const setText = (loc: 'ar' | 'en', key: 'heroTitle' | 'heroSubtitle', v: string) =>
    setC((s) => ({ ...s, text: { ...s.text, [loc]: { ...s.text?.[loc], [key]: v } } }));

  const setWm = (patch: Partial<RationingConfig['watermark']>) => setC((s) => ({ ...s, watermark: { ...s.watermark, ...patch } }));
  const [logoBusy, setLogoBusy] = useState(false);

  async function uploadLogo(file: File) {
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.attachment?.path) setWm({ logoPath: json.attachment.path });
    } finally {
      setLogoBusy(false);
    }
  }

  const wm = c.watermark;
  const posCss = (() => {
    const [v, h] = wm.position.split('-');
    return {
      alignItems: v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center',
      justifyContent: h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center',
    } as React.CSSProperties;
  })();

  function save() {
    setSaved(false);
    start(async () => {
      const r = await saveConfig(c);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  type BoolKey = 'didYouMeanEnabled' | 'showSourceSheets' | 'showDashboard' | 'showBrowseAll';
  const Toggle = ({ k, label }: { k: BoolKey; label: string }) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={c[k]} onChange={(e) => setC((s) => ({ ...s, [k]: e.target.checked }))} />
      {label}
    </label>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2.5 rounded-lg border border-graphite/15 p-4">
        <h3 className="font-semibold text-primary">{t('cfgToggles')}</h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Toggle k="didYouMeanEnabled" label={t('cfgDidYouMean')} />
          <Toggle k="showBrowseAll" label={t('cfgBrowseAll')} />
          <Toggle k="showSourceSheets" label={t('cfgSourceSheets')} />
          <Toggle k="showDashboard" label={t('cfgDashboard')} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h3 className="font-semibold text-primary">{t('cfgTexts')}</h3>
        <p className="text-xs opacity-60">{t('cfgTextsHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{t('cfgHeroTitleAr')}<input value={c.text?.ar?.heroTitle ?? ''} onChange={(e) => setText('ar', 'heroTitle', e.target.value)} className={inp} /></label>
          <label className="text-sm">{t('cfgHeroTitleEn')}<input value={c.text?.en?.heroTitle ?? ''} onChange={(e) => setText('en', 'heroTitle', e.target.value)} dir="ltr" className={inp} /></label>
          <label className="text-sm">{t('cfgHeroSubAr')}<input value={c.text?.ar?.heroSubtitle ?? ''} onChange={(e) => setText('ar', 'heroSubtitle', e.target.value)} className={inp} /></label>
          <label className="text-sm">{t('cfgHeroSubEn')}<input value={c.text?.en?.heroSubtitle ?? ''} onChange={(e) => setText('en', 'heroSubtitle', e.target.value)} dir="ltr" className={inp} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h3 className="font-semibold text-primary">{t('cfgAppearance')}</h3>
        <label className="flex items-center gap-3 text-sm">
          {t('cfgAccentColor')}
          <input type="color" value={c.accentColor} onChange={(e) => setC((s) => ({ ...s, accentColor: e.target.value }))} className="h-8 w-14 rounded border border-graphite/20" />
          <span dir="ltr" className="font-mono text-xs opacity-60">{c.accentColor}</span>
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary">{t('cfgWatermark')}</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wm.enabled} onChange={(e) => setWm({ enabled: e.target.checked })} /> {t('cfgWmEnabled')}</label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} className="text-sm" />
              {logoBusy && <span className="text-xs opacity-60">…</span>}
            </div>
            <div>
              <div className="mb-1 text-sm">{t('cfgWmPosition')}</div>
              <div className="grid w-24 grid-cols-3 gap-1">
                {POSITIONS.map((p) => (
                  <button key={p} onClick={() => setWm({ position: p })} aria-label={p}
                    className={`h-7 rounded border ${wm.position === p ? 'border-primary bg-primary/15' : 'border-graphite/20'}`} />
                ))}
              </div>
            </div>
            <label className="block text-sm">{t('cfgWmOpacity')}: {Math.round(wm.opacity * 100)}%
              <input type="range" min={10} max={100} step={5} value={Math.round(wm.opacity * 100)} onChange={(e) => setWm({ opacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
            </label>
            <label className="block text-sm">{t('cfgWmScale')}: {wm.scale}%
              <input type="range" min={5} max={50} step={1} value={wm.scale} onChange={(e) => setWm({ scale: parseInt(e.target.value, 10) })} className="w-full" />
            </label>
          </div>
          <div>
            <div className="mb-1 text-sm opacity-60">{t('cfgWmPreview')}</div>
            <div className="relative flex h-40 rounded border border-graphite/20 bg-[repeating-linear-gradient(45deg,#f3f3f1,#f3f3f1_10px,#eaeae6_10px,#eaeae6_20px)] p-2" style={posCss}>
              {wm.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={wm.logoPath} alt="" style={{ width: `${wm.scale * 2}%`, opacity: wm.enabled ? wm.opacity : 0.15 }} />
              ) : (
                <span className="m-auto text-xs opacity-50">{t('cfgWmNoLogo')}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{pending ? tc('save') + '…' : tc('save')}</button>
        {saved && <span className="text-sm text-green">{t('cfgSaved')}</span>}
      </div>
    </div>
  );
}
