import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
  type Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- Job type definitions ---

export type JobType = "full-time" | "part-time" | "contract" | "substitute";

export const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "full-time", label: "Full-Time" },
  { value: "part-time", label: "Part-Time" },
  { value: "contract", label: "Contract" },
  { value: "substitute", label: "Substitute" },
];

// --- Firestore schema ---

export interface Job {
  id: string;
  title: string;
  organization: string; // school / org name
  location: string;     // city, state / country
  gradeLevel: string;
  subject: string;
  jobType: JobType;
  description: string;
  applyURL: string;     // external link or in-app action
  postedBy: string;     // uid
  createdAt: Timestamp | null;
  isActive: boolean;
}

export type JobInput = Omit<Job, "id" | "createdAt" | "isActive">;

// --- Helpers ---

export function jobSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug}--${id}`;
}

export function parseJobSlug(slug: string): string {
  const idx = slug.lastIndexOf("--");
  return idx !== -1 ? slug.slice(idx + 2) : slug;
}

// --- CRUD ---

export async function createJob(input: JobInput): Promise<Job> {
  if (!db) throw new Error("Firestore is not initialized");
  const ref = doc(collection(db, "jobs"));
  const job: Omit<Job, "id"> = {
    ...input,
    isActive: true,
    createdAt: null,
  };
  await setDoc(ref, { ...job, createdAt: serverTimestamp() });
  return { id: ref.id, ...job };
}

export async function getJob(id: string): Promise<Job | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "jobs", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Job, "id">) };
}

export interface JobFilters {
  gradeLevel?: string;
  subject?: string;
  jobType?: JobType;
  location?: string; // simple text-match filter applied client-side
}

export async function getJobs(
  filters: JobFilters,
  pageSize = 10,
  cursor: DocumentSnapshot | null = null
): Promise<{ jobs: Job[]; cursor: DocumentSnapshot | null }> {
  if (!db) return { jobs: [], cursor: null };

  const constraints: QueryConstraint[] = [
    where("isActive", "==", true),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  ];

  if (filters.gradeLevel) constraints.unshift(where("gradeLevel", "==", filters.gradeLevel));
  if (filters.subject) constraints.unshift(where("subject", "==", filters.subject));
  if (filters.jobType) constraints.unshift(where("jobType", "==", filters.jobType));

  if (cursor) constraints.push(startAfter(cursor));

  const q = query(collection(db, "jobs"), ...constraints);
  const snap = await getDocs(q);

  let jobs: Job[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Job, "id">),
  }));

  // Client-side location filter (Firestore doesn't support substring search)
  if (filters.location) {
    const loc = filters.location.toLowerCase();
    jobs = jobs.filter((j) => j.location.toLowerCase().includes(loc));
  }

  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  const nextCursor = snap.docs.length === pageSize ? lastDoc : null;

  return { jobs, cursor: nextCursor };
}
