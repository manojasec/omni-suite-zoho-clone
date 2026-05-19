"use client";

import * as React from "react";
import { sanitizeRichHtml } from "./richtext";

export type RichTextEditorProps = {
  /** Initial HTML (will be sanitised). */
  value?: string;
  /** Called with sanitised HTML on every change (debounced caller-side). */
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Hidden input name — when provided the sanitised HTML is mirrored
   *  into this input so the editor can be used inside a `<form action>`. */
  name?: string;
  /** Hide the toolbar (read-only render). */
  readOnly?: boolean;
};

const COMMANDS: { label: string; cmd: string; arg?: string; aria: string }[] = [
  { label: "B", cmd: "bold", aria: "Bold" },
  { label: "I", cmd: "italic", aria: "Italic" },
  { label: "U", cmd: "underline", aria: "Underline" },
  { label: "S", cmd: "strikeThrough", aria: "Strikethrough" },
  { label: "H1", cmd: "formatBlock", arg: "H1", aria: "Heading 1" },
  { label: "H2", cmd: "formatBlock", arg: "H2", aria: "Heading 2" },
  { label: "“ ”", cmd: "formatBlock", arg: "BLOCKQUOTE", aria: "Blockquote" },
  { label: "•", cmd: "insertUnorderedList", aria: "Bulleted list" },
  { label: "1.", cmd: "insertOrderedList", aria: "Numbered list" },
  { label: "</>", cmd: "formatBlock", arg: "PRE", aria: "Code block" },
];

/**
 * Zero-dep rich-text editor backed by `contenteditable` + `document.execCommand`.
 * Output is sanitised through `sanitizeRichHtml` before reaching the parent.
 *
 * `execCommand` is deprecated but still works in every modern browser; for a
 * production-grade editor swap this for Tiptap/Lexical. The sanitiser remains
 * useful regardless.
 */
export function RichTextEditor(props: RichTextEditorProps) {
  const { value, onChange, placeholder, className, name, readOnly } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const hiddenRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const sanitised = sanitizeRichHtml(value ?? "");
    if (ref.current.innerHTML !== sanitised) {
      ref.current.innerHTML = sanitised;
    }
    if (hiddenRef.current) hiddenRef.current.value = sanitised;
    // We intentionally only sync on `value` prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit() {
    const html = sanitizeRichHtml(ref.current?.innerHTML ?? "");
    if (hiddenRef.current) hiddenRef.current.value = html;
    onChange?.(html);
  }

  function exec(cmd: string, arg?: string) {
    if (readOnly) return;
    ref.current?.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, arg);
    emit();
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const insert = html ? sanitizeRichHtml(html) : escapeForInsert(text);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand("insertHTML", false, insert);
    emit();
  }

  return (
    <div className={["rounded-md border bg-background", className].filter(Boolean).join(" ")}>
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-1 border-b p-1">
          {COMMANDS.map((c) => (
            <button
              key={c.label}
              type="button"
              aria-label={c.aria}
              title={c.aria}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(c.cmd, c.arg)}
              className="rounded px-2 py-1 text-xs hover:bg-accent"
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            aria-label="Link"
            title="Link"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const url = window.prompt("URL");
              if (!url) return;
              exec("createLink", url);
            }}
            className="rounded px-2 py-1 text-xs hover:bg-accent"
          >
            🔗
          </button>
          <button
            type="button"
            aria-label="Clear formatting"
            title="Clear formatting"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("removeFormat")}
            className="rounded px-2 py-1 text-xs hover:bg-accent"
          >
            ⌫
          </button>
        </div>
      ) : null}
      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Write something…"}
        onInput={emit}
        onPaste={onPaste}
        className={[
          "min-h-[120px] px-3 py-2 text-sm outline-none",
          "[&_h1]:text-2xl [&_h1]:font-semibold",
          "[&_h2]:text-xl [&_h2]:font-semibold",
          "[&_h3]:text-lg [&_h3]:font-semibold",
          "[&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:italic",
          "[&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs",
          "[&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal",
          "[&_a]:text-blue-600 [&_a]:underline",
          "[&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)]",
        ].join(" ")}
      />
      {name ? <input ref={hiddenRef} type="hidden" name={name} /> : null}
    </div>
  );
}

function escapeForInsert(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}
