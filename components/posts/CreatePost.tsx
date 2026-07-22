"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createPost, type PostType, type MentionedUserRef } from "@/lib/firestore/posts";
import { notifyMention } from "@/lib/notifications";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { TextButton } from "@/components/ui";
import Tag from "@/components/ui/Tag";
import MentionInput, { type MentionedUser, type MentionInputHandle } from "@/components/ui/MentionInput";
import LinkAttacher, { type AttachedLink } from "@/components/ui/LinkAttacher";
import { normalizeMultilineText } from "@/lib/utils";

const MAX_POST_LENGTH = 4000;
const MAX_POST_LINES = 40;
const MAX_POST_BLANK_RUN = 2;

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: "idea", label: "💡 Idea" },
  { value: "resource", label: "📚 Resource" },
  { value: "discussion", label: "💬 Discussion" },
  { value: "general", label: "🌐 General" },
  { value: "question", label: "❓ Question" },
  { value: "other", label: "💭 Other" },
];

const TAG_OPTIONS = [
  "Classroom Management",
  "Lesson Planning",
  "Student Engagement",
  "Technology",
  "Assessment",
  "Differentiation",
  "SEL",
  "STEM",
  "Literacy",
  "Professional Development",
];

const GRADE_OPTIONS = [
  "Kindergarten",
  "Elementary",
  "Middle School",
  "High School",
  "Higher Education",
];

interface CreatePostProps {
  onPostCreated?: () => void;
  embedded?: boolean;
}

export default function CreatePost({ onPostCreated, embedded = false }: CreatePostProps) {
  const { user } = useAuth();
  const mentionInputRef = useRef<MentionInputHandle>(null);
  const [content, setContent] = useState("");
  const [mentions, setMentions] = useState<MentionedUser[]>([]);
  const [links, setLinks] = useState<AttachedLink[]>([]);
  const [type, setType] = useState<PostType>("general");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [gradeLevel, setGradeLevel] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
    const normalized = normalizeMultilineText(content, {
      maxLength: MAX_POST_LENGTH,
      maxLines: MAX_POST_LINES,
      maxConsecutiveBlankLines: MAX_POST_BLANK_RUN,
    });

    if (!normalized) {
      setError("Post content cannot be empty.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const postId = await createPost({
        authorId: user!.uid,
        authorName: user!.displayName || "Anonymous",
        authorPhotoURL: user!.photoURL,
        content: normalized,
        type,
        tags: selectedTags,
        gradeLevel,
        links,
        mentionedUsers: mentions.map((m): MentionedUserRef => ({ uid: m.uid, displayName: m.displayName })),
      });
      // Send mention notifications (fire-and-forget)
      mentions.forEach((m) => {
        notifyMention({
          recipientId: m.uid,
          actorId: user!.uid,
          actorName: user!.displayName || "Anonymous",
          actorPhotoURL: user!.photoURL,
          linkURL: `/home?post=${postId}`,
        }).catch(() => {});
      });
      void postId;
      setContent("");
      setMentions([]);
      setLinks([]);
      setType("general");
      setSelectedTags([]);
      setGradeLevel("");
      setExpanded(false);
      onPostCreated?.();
    } catch {
      setError("Failed to create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={embedded
      ? "rounded-2xl border border-secondary-200 bg-surface-hover/85 p-4"
      : "rounded-xl border border-border bg-surface shadow-card p-4"}>
      <div className="flex gap-3">
        <Avatar
          src={user.photoURL}
          alt={user.displayName || "You"}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <MentionInput
            ref={mentionInputRef}
            multiline
            value={content}
            onChange={setContent}
            onMentionsChange={setMentions}
            onFocus={() => setExpanded(true)}
            placeholder="Share an idea, resource, or start a discussion... (type @ to mention someone)"
            rows={expanded ? 4 : 2}
            className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${embedded ? "border-secondary-200 bg-white hover:border-border-strong focus-visible:border-primary-300" : "border-border bg-white hover:border-border-strong focus-visible:border-primary-300"}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Toolbar: @Mention + attach link - immediately below textarea */}
          <div className="flex flex-wrap items-start gap-4 border-b border-border pb-3">
            <TextButton
              type="button"
              onClick={() => mentionInputRef.current?.insertText("@")}
              className="gap-1 px-0 py-0 text-xs"
              title="Mention someone"
            >
              <span className="text-base leading-none">@</span>
              <span>Mention</span>
            </TextButton>
            <LinkAttacher links={links} onChange={setLinks} />
          </div>

          {/* Post type selector */}
          <div className="flex flex-wrap gap-2">
            {POST_TYPES.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setType(pt.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  type === pt.value
                    ? "border-primary-300 bg-primary-50 text-primary-900"
                    : "border-primary-100 bg-surface text-primary-800 hover:border-primary-200 hover:bg-surface-hover"
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* Grade level */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Grade Level (optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GRADE_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeLevel(gradeLevel === g ? "" : g)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                    gradeLevel === g
                      ? "border-primary-300 bg-primary-50 text-primary-900"
                      : "border-primary-100 bg-surface text-primary-800 hover:border-primary-200 hover:bg-surface-hover"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Tags (optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_OPTIONS.map((tag) => (
                <Tag
                  key={tag}
                  label={tag}
                  selected={selectedTags.includes(tag)}
                  onToggle={() => toggleTag(tag)}
                />
              ))}
            </div>
          </div>

          {/* Error + submit */}
          {error && <p className="text-xs text-error-500">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpanded(false);
                setContent("");
                setSelectedTags([]);
                setGradeLevel("");
                setLinks([]);
                setType("general");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900"
              onClick={handleSubmit}
              isLoading={submitting}
              disabled={!content.trim()}
            >
              Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
