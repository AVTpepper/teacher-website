"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Select } from "@/components/ui";
import { GRADE_LEVELS } from "@/lib/constants";
import { SUBJECTS } from "@/lib/firestore/users";
import { PROFESSIONAL_ROLES } from "@/lib/onboarding";

type PublicEducatorCard = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  professionalRole: string;
  gradeLevel: string;
  country: string;
  subjects: string[];
  bio: string;
};

interface PublicEducatorDirectoryProps {
  showAccessNotice?: boolean;
}

function contains(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle);
}

export default function PublicEducatorDirectory({
  showAccessNotice = true,
}: PublicEducatorDirectoryProps) {
  const [educators, setEducators] = useState<PublicEducatorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetch("/api/public/educators", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          educators?: PublicEducatorCard[];
        };
        if (!response.ok) {
          throw new Error("Unable to load educators.");
        }
        if (!cancelled) {
          setEducators(Array.isArray(payload.educators) ? payload.educators : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEducators([]);
          setLoadError("We could not load the educator directory right now.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return educators.filter((educator) => {
      if (role && educator.professionalRole !== role) return false;
      if (grade && educator.gradeLevel !== grade) return false;
      if (subject && !educator.subjects.includes(subject)) return false;

      if (!q) return true;

      const haystack = [
        educator.displayName,
        educator.professionalRole,
        educator.gradeLevel,
        educator.country,
        educator.bio,
        ...educator.subjects,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return contains(haystack, q);
    });
  }, [educators, grade, role, search, subject]);

  return (
    <div className="space-y-6 pb-8">
      <DiscoveryShell
        eyebrow="Educator Directory"
        title="Explore educators on VistaTeacher"
        subtitle={
          showAccessNotice
            ? "Browse public educator cards with basic profile context. Create an account to view full profiles and connect."
            : "Browse educator cards and use filters to discover people by role, grade, and subject."
        }
      />

      {showAccessNotice && (
        <Card padding="md" className="border-primary-100 bg-primary-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Restricted view: public cards only.
            </p>
            <div className="flex gap-2">
              <Link href="/auth/login">
                <Button variant="outline" size="sm">Log in</Button>
              </Link>
              <Link href="/auth/signup?redirect=/explore-educators">
                <Button size="sm">Create account</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      <Card padding="lg" className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, role, subject"
          />
          <Select
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            options={[{ value: "", label: "All roles" }, ...PROFESSIONAL_ROLES.map((item) => ({ value: item, label: item }))]}
          />
          <Select
            label="Grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            options={[{ value: "", label: "All grades" }, ...GRADE_LEVELS.map((item) => ({ value: item, label: item }))]}
          />
          <Select
            label="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            options={[{ value: "", label: "All subjects" }, ...SUBJECTS.map((item) => ({ value: item, label: item }))]}
          />
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} padding="md" className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded-full bg-secondary-100" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-secondary-100" />
              <div className="h-3 w-32 animate-pulse rounded-full bg-secondary-100" />
            </Card>
          ))}
        </div>
      ) : loadError ? (
        <ErrorState message={loadError} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔎"
          title="No educators match these filters"
          description="Try broader filters or create an account to connect with educators directly."
        />
      ) : (
        <>
          <p className="text-sm text-muted">{filtered.length} educators found</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((educator) => (
              <Card key={educator.uid} padding="md" className="h-full border-primary-100">
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Avatar
                      src={educator.photoURL}
                      alt={educator.displayName}
                      size="md"
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">{educator.displayName}</p>
                      <p className="line-clamp-1 text-xs text-muted">{educator.professionalRole || "Educator"}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    {educator.gradeLevel || "Profile details available after sign in"}
                  </p>
                  {educator.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {educator.subjects.slice(0, 3).map((item) => (
                        <Badge key={item} variant="default">{item}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
