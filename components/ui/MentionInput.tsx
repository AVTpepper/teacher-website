"use client";

import { useState, useRef, useEffect } from "react";
import { searchUsersByDisplayName } from "@/lib/firestore/users";
import Avatar from "@/components/ui/Avatar";

export interface MentionedUser {
  uid: string;
  displayName: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: MentionedUser[]) => void;
  placeholder?: string;
  className?: string;
  /** Render a <textarea> instead of <input>. */
  multiline?: boolean;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: () => void;
}

type SearchResult = { uid: string; displayName: string; photoURL: string | null };

export default function MentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  className,
  multiline = false,
  rows = 3,
  onKeyDown,
  onFocus,
}: MentionInputProps) {
  const [dropdownUsers, setDropdownUsers] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentions, setMentions] = useState<MentionedUser[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getEl() {
    return multiline
      ? (textareaRef.current as HTMLTextAreaElement | null)
      : (inputRef.current as HTMLInputElement | null);
  }

  // Derive an @mention query from text at the given cursor position.
  function getMentionAt(text: string, cursor: number): { query: string; start: number } | null {
    let i = cursor - 1;
    while (i >= 0 && text[i] !== "@" && text[i] !== " " && text[i] !== "\n") {
      i--;
    }
    if (i < 0 || text[i] !== "@") return null;
    const q = text.slice(i + 1, cursor);
    if (q.includes(" ") || q.includes("\n")) return null;
    return { query: q, start: i };
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart ?? newValue.length;
    onChange(newValue);

    // Reset mentions if text is cleared
    if (!newValue) {
      const empty: MentionedUser[] = [];
      setMentions(empty);
      onMentionsChange?.(empty);
      setShowDropdown(false);
      return;
    }

    const mention = getMentionAt(newValue, cursor);
    if (mention && mention.query.length > 0) {
      setMentionStart(mention.start);
      setSelectedIndex(0);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        try {
          const results = await searchUsersByDisplayName(mention.query);
          setDropdownUsers(results);
          setShowDropdown(results.length > 0);
        } catch {
          setShowDropdown(false);
        }
      }, 250);
    } else {
      setShowDropdown(false);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    }
  }

  function handleSelect(user: SearchResult) {
    const el = getEl();
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const inserted = `@${user.displayName} `;
    const newValue = `${before}${inserted}${after}`;
    onChange(newValue);
    setShowDropdown(false);

    const newMentions = [
      ...mentions.filter((m) => m.uid !== user.uid),
      { uid: user.uid, displayName: user.displayName },
    ];
    setMentions(newMentions);
    onMentionsChange?.(newMentions);

    const newCursor = before.length + inserted.length;
    setTimeout(() => {
      const el2 = getEl();
      if (el2) {
        el2.focus();
        el2.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, dropdownUsers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && dropdownUsers[selectedIndex]) {
        e.preventDefault();
        handleSelect(dropdownUsers[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowDropdown(false);
        return;
      }
    }
    onKeyDown?.(e);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const sharedProps = {
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onFocus,
    placeholder,
    className,
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      {multiline ? (
        <textarea ref={textareaRef} rows={rows} {...sharedProps} />
      ) : (
        <input ref={inputRef} type="text" {...sharedProps} />
      )}

      {showDropdown && dropdownUsers.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {dropdownUsers.map((u, idx) => (
            <button
              key={u.uid}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before select
                handleSelect(u);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                idx === selectedIndex
                  ? "bg-primary-900 text-white"
                  : "hover:bg-surface-hover text-foreground"
              }`}
            >
              <Avatar src={u.photoURL} alt={u.displayName} size="sm" />
              <span className="font-medium truncate">{u.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
