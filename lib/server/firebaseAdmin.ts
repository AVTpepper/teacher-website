import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAdminConfig() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function isFirebaseAdminConfigured(): boolean {
  return getAdminConfig() !== null;
}

let appSingleton: App | null = null;

export function getFirebaseAdminApp(): App {
  if (appSingleton) return appSingleton;

  const config = getAdminConfig();
  if (!config) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }

  if (getApps().length > 0) {
    appSingleton = getApps()[0]!;
    return appSingleton;
  }

  appSingleton = initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
    }),
    projectId: config.projectId,
  });

  return appSingleton;
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

// Backward-compatible lazy exports used by some route modules.
// Proxy defers Firebase Admin initialization until a property is accessed.
export const adminAuth = new Proxy({} as ReturnType<typeof getFirebaseAdminAuth>, {
  get(_target, prop, receiver) {
    const auth = getFirebaseAdminAuth() as unknown as Record<string, unknown>;
    const value = Reflect.get(auth, prop, receiver);
    return typeof value === "function" ? value.bind(auth) : value;
  },
});

export const adminDb = new Proxy({} as ReturnType<typeof getFirebaseAdminDb>, {
  get(_target, prop, receiver) {
    const db = getFirebaseAdminDb() as unknown as Record<string, unknown>;
    const value = Reflect.get(db, prop, receiver);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export function getFirebaseProjectId(): string {
  return getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
}
