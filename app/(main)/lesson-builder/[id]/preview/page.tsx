"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getLesson, trackLessonDownload, type Lesson } from "@/lib/firestore/lessons";
import { Button, Card } from "@/components/ui";
import { pdf } from "@react-pdf/renderer";
import LessonPDFDocument from "@/components/lessons/LessonPDFDocument";

export default function LessonPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      try {
        const data = await getLesson(id);
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setLesson(data);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLesson();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  async function handleDownload() {
    if (!lesson) return;

    if (user) {
      trackLessonDownload(lesson.id, user.uid).catch(() => {});
    }

    const blob = await pdf(<LessonPDFDocument lesson={lesson} authorName={lesson.authorName} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lesson.title.replace(/[^a-zA-Z0-9 ]/g, "").trim()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted">Loading preview...</div>
    );
  }

  if (notFound || !lesson) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Lesson Not Found</h1>
        <p className="mt-2 text-sm text-muted">This preview could not be loaded.</p>
        <Link href="/lesson-builder">
          <Button variant="outline" className="mt-4">Back to Lesson Builder</Button>
        </Link>
      </div>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-5xl py-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link href="/lesson-builder" className="hover:text-foreground transition-colors">
            Lesson Builder
          </Link>
          <span>/</span>
          <Link href={`/lesson-builder/${lesson.id}`} className="hover:text-foreground transition-colors">
            {lesson.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">Preview</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
              return;
            }
            router.push(`/lesson-builder/${lesson.id}`);
          }}
        >
          Back
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Preview: {lesson.title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>Download PDF</Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <Card className="p-8 space-y-6">
        <div className="border-b border-secondary-200 pb-4">
          <div className="mb-2 flex flex-wrap gap-2">
            {lesson.gradeLevel && (
              <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-secondary-700">
                {lesson.gradeLevel}
              </span>
            )}
            {lesson.subject && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {lesson.subject}
              </span>
            )}
          </div>
          <h2 className="text-3xl font-bold text-foreground">{lesson.title}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary-500">
            <span><strong className="text-secondary-700">Author:</strong> {lesson.authorName}</span>
            {lesson.duration && (
              <span><strong className="text-secondary-700">Duration:</strong> {lesson.duration}</span>
            )}
          </div>
        </div>

        {lesson.objectives.length > 0 && (
          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">Learning Objectives</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
              {lesson.objectives.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </section>
        )}

        {lesson.materials.length > 0 && (
          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">Materials Needed</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
              {lesson.materials.map((mat, i) => (
                <li key={i}>{mat}</li>
              ))}
            </ul>
          </section>
        )}

        {lesson.steps.length > 0 && (
          <section>
            <h3 className="mb-3 text-base font-semibold text-foreground">Lesson Plan</h3>
            <div className="space-y-4">
              {lesson.steps.map((step, i) => (
                <div key={i} className="border-l-2 border-secondary-300 pl-4">
                  <p className="text-sm font-semibold text-foreground">
                    Step {i + 1}{step.title ? `: ${step.title}` : ""}
                    {step.duration && (
                      <span className="ml-2 font-normal text-secondary-500">({step.duration})</span>
                    )}
                  </p>
                  {step.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-secondary-600">{step.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {lesson.checkForUnderstanding.filter(Boolean).length > 0 && (
          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">Check for Understanding</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
              {lesson.checkForUnderstanding.filter(Boolean).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {lesson.assessments.filter(Boolean).length > 0 && (
          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">Assessment</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
              {lesson.assessments.filter(Boolean).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="border-t border-secondary-200 pt-4 text-center text-xs text-secondary-400">
          © {year} {lesson.authorName}. All rights reserved. Created on TeacherlyConnect.
        </div>
      </Card>
    </div>
  );
}
