'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { compressImage } from '@noc/ui';
import { useLocale } from 'next-intl';

const FONT_SIZES = ['', '14px', '16px', '20px', '28px'];

function Btn({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded px-2 py-1 text-sm ${active ? 'bg-primary text-soft' : 'hover:bg-graphite/10'}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  async function addImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const fd = new FormData();
      fd.append('file', await compressImage(f));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.attachment?.path) editor.chain().focus().setImage({ src: j.attachment.path }).run();
    };
    input.click();
  }
  function addLink() {
    const url = prompt(L('رابط (URL):', 'Link (URL):'), 'https://');
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    else editor.chain().focus().unsetLink().run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-graphite/15 p-2">
      <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
      <span className="mx-1 h-5 w-px bg-graphite/20" />
      <Btn title="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn title="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
      <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
      <span className="mx-1 h-5 w-px bg-graphite/20" />
      <Btn title="Right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>⇥</Btn>
      <Btn title="Center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>≡</Btn>
      <Btn title="Left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>⇤</Btn>
      <span className="mx-1 h-5 w-px bg-graphite/20" />
      <input type="color" title="Color" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} className="h-7 w-7 cursor-pointer rounded border border-graphite/20" />
      <select
        title="Font size"
        onChange={(e) => (e.target.value ? editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run() : editor.chain().focus().setMark('textStyle', { fontSize: null }).run())}
        className="rounded border border-graphite/20 bg-transparent px-1 py-1 text-sm"
      >
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s || L('حجم', 'Size')}</option>)}
      </select>
      <span className="mx-1 h-5 w-px bg-graphite/20" />
      <Btn title="Link" active={editor.isActive('link')} onClick={addLink}>🔗</Btn>
      <Btn title="Image" onClick={addImage}>🖼</Btn>
      <Btn title="Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</Btn>
      <span className="mx-1 h-5 w-px bg-graphite/20" />
      <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
      <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
    </div>
  );
}

export function RichEditor({ value, onChange, dir = 'rtl' }: { value: string; onChange: (html: string) => void; dir?: 'rtl' | 'ltr' }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: 'tiptap min-h-56 p-3 focus:outline-none', dir } },
  });

  if (!editor) return <div className="rounded-lg border border-graphite/20 p-3 text-sm opacity-50">…</div>;
  return (
    <div className="rounded-lg border border-graphite/20">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
