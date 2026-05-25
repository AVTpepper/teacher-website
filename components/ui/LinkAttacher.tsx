"use client";

import { useState } from "react";

export interface AttachedLink {
  url: string;
  label: string;
}

interface LinkAttacherProps {
  links: AttachedLink[];
  onChange: (links: AttachedLink[]) => void;
  max?: number;
}

/** Validates that a URL uses only http/https (prevents javascript: etc.) */
function isSafeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function LinkAttacher({ links, onChange, max = 5 }: LinkAttacherProps) {
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [error, setError] = useState("");

  function handleAdd() {
    const raw = urlInput.trim();
    if (!raw) { setError("URL is required."); return; }

    // Auto-prefix https:// if missing scheme
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    if (!isSafeUrl(normalized)) {
      setError("Please enter a valid http/https URL.");
      return;
    }

    if (links.some((l) => l.url === normalized)) {
      setError("This URL is already attached.");
      return;
    }

    onChange([...links, { url: normalized, label: labelInput.trim() || normalized }]);
    setUrlInput("");
    setLabelInput("");
    setError("");
    setOpen(false);
  }

  function handleRemove(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {/* Existing chips */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-info-50 text-info-700 border border-info-200 max-w-[280px]"
            >
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline"
                title={link.url}
              >
                {link.label}
              </a>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="shrink-0 text-info-500 hover:text-error-500 transition-colors cursor-pointer ml-0.5"
                aria-label={`Remove link: ${link.label}`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add link button */}
      {!open && links.length < max && (
        <button
          type="button"
          onClick={() => { setOpen(true); setError(""); }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Attach link
        </button>
      )}

      {/* Inline form */}
      {open && (
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="https://example.com"
              className="flex-1 min-w-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong"
              autoFocus
            />
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="Label (optional)"
              className="w-32 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong"
            />
          </div>
          {error && <p className="text-xs text-error-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-1 rounded-md bg-primary-900 text-white text-xs font-medium hover:bg-primary-800 transition-colors cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setUrlInput(""); setLabelInput(""); setError(""); }}
              className="px-3 py-1 rounded-md text-xs font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
