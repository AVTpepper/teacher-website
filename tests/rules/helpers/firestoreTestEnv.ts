import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const TEST_PROJECT_ID = "vistateacher-rules-test";

let rulesEnv: RulesTestEnvironment | null = null;

function getEmulatorHostAndPort(): { host: string; port: number } {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. Run rules tests with `npm run test:rules` to start the Firestore emulator."
    );
  }

  const [host, portString] = emulatorHost.split(":");
  const port = Number(portString ?? "8080");
  if (!host || Number.isNaN(port)) {
    throw new Error(`Invalid FIRESTORE_EMULATOR_HOST value: ${emulatorHost}`);
  }

  return { host, port };
}

export async function getRulesEnv(): Promise<RulesTestEnvironment> {
  if (rulesEnv) {
    return rulesEnv;
  }

  const { host, port } = getEmulatorHostAndPort();
  const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");

  rulesEnv = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      host,
      port,
      rules,
    },
  });

  return rulesEnv;
}

export async function clearRulesData(): Promise<void> {
  const env = await getRulesEnv();
  await env.clearFirestore();
}

export async function cleanupRulesEnv(): Promise<void> {
  if (!rulesEnv) return;
  await rulesEnv.cleanup();
  rulesEnv = null;
}

export async function dbAsUser(uid: string) {
  const env = await getRulesEnv();
  return env.authenticatedContext(uid).firestore();
}

export async function dbAsAnonymous() {
  const env = await getRulesEnv();
  return env.unauthenticatedContext().firestore();
}

export async function seedUserProfile(uid: string, overrides: Record<string, unknown> = {}): Promise<void> {
  const env = await getRulesEnv();

  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("users").doc(uid).set({
      uid,
      displayName: `User ${uid}`,
      displayNameLower: `user ${uid}`,
      role: "user",
      tier: "free",
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides,
    });
  });
}

export const assertAllowed = assertSucceeds;
export const assertDenied = assertFails;
