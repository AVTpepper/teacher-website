import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertAllowed,
  assertDenied,
  cleanupRulesEnv,
  clearRulesData,
  dbAsAnonymous,
  dbAsUser,
  getRulesEnv,
  seedUserProfile,
} from "./helpers/firestoreTestEnv";

describe("firestore rules baseline", () => {
  beforeAll(async () => {
    await getRulesEnv();
  });

  beforeEach(async () => {
    await clearRulesData();
  });

  afterAll(async () => {
    await cleanupRulesEnv();
  });

  it("denies unauthenticated writes to protected user profile updates", async () => {
    await seedUserProfile("owner-1");
    const anonDb = await dbAsAnonymous();

    await expect(
      assertDenied(anonDb.collection("users").doc("owner-1").update({ bio: "new bio" }))
    ).resolves.toBeDefined();
  });

  it("allows authenticated users to update their own allowed profile fields", async () => {
    await seedUserProfile("owner-1", { bio: "before" });
    const ownerDb = await dbAsUser("owner-1");

    await expect(
      assertAllowed(ownerDb.collection("users").doc("owner-1").update({ bio: "after" }))
    ).resolves.toBeDefined();
  });

  it("denies authenticated users from modifying another user protected data", async () => {
    await seedUserProfile("owner-1", { bio: "original" });
    await seedUserProfile("other-2");

    const otherDb = await dbAsUser("other-2");

    await expect(
      assertDenied(otherDb.collection("users").doc("owner-1").update({ bio: "tampered" }))
    ).resolves.toBeDefined();
  });

  it("allows public reads on user profiles where rules intentionally permit it", async () => {
    await seedUserProfile("owner-1", { bio: "visible" });
    const anonDb = await dbAsAnonymous();

    await expect(assertAllowed(anonDb.collection("users").doc("owner-1").get())).resolves.toBeDefined();
  });

  it("denies owner from changing protected tier and role fields", async () => {
    await seedUserProfile("owner-1");
    const ownerDb = await dbAsUser("owner-1");

    await expect(
      assertDenied(
        ownerDb.collection("users").doc("owner-1").update({
          tier: "plus",
          role: "admin",
          isVerified: true,
        })
      )
    ).resolves.toBeDefined();
  });

  it("allows owner to update onboarding fields on own profile", async () => {
    await seedUserProfile("owner-1");
    const ownerDb = await dbAsUser("owner-1");

    await expect(
      assertAllowed(
        ownerDb.collection("users").doc("owner-1").update({
          professionalRole: "Primary Teacher",
          professionalHeadline: "Primary Teacher | IB PYP",
          onboardingCurrentStep: 3,
          onboardingVersion: 1,
          networkingGoals: ["Connect with educators"],
        })
      )
    ).resolves.toBeDefined();
  });

  it("documents current broad public read behavior for lessons", async () => {
    const env = await getRulesEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("lessons").doc("lesson-1").set({
        title: "Draft lesson",
        authorId: "owner-1",
        isPublic: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });

    const anonDb = await dbAsAnonymous();
    await expect(assertAllowed(anonDb.collection("lessons").doc("lesson-1").get())).resolves.toBeDefined();
  });

  it("denies unauthenticated reads for connections", async () => {
    const env = await getRulesEnv();
    await seedUserProfile("owner-a");
    await seedUserProfile("owner-b");

    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("connections").doc("key-1").set({
        participantIds: ["owner-a", "owner-b"],
        participantKey: "key-1",
        requesterId: "owner-a",
        recipientId: "owner-b",
        status: "pending",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });

    const anonDb = await dbAsAnonymous();
    await expect(assertDenied(anonDb.collection("connections").doc("key-1").get())).resolves.toBeDefined();
  });

  it("allows connection participants to read and denies unrelated user", async () => {
    const env = await getRulesEnv();
    await seedUserProfile("owner-a");
    await seedUserProfile("owner-b");
    await seedUserProfile("owner-c");

    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("connections").doc("key-1").set({
        participantIds: ["owner-a", "owner-b"],
        participantKey: "key-1",
        requesterId: "owner-a",
        recipientId: "owner-b",
        status: "accepted",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });

    const dbA = await dbAsUser("owner-a");
    const dbB = await dbAsUser("owner-b");
    const dbC = await dbAsUser("owner-c");

    await expect(assertAllowed(dbA.collection("connections").doc("key-1").get())).resolves.toBeDefined();
    await expect(assertAllowed(dbB.collection("connections").doc("key-1").get())).resolves.toBeDefined();
    await expect(assertDenied(dbC.collection("connections").doc("key-1").get())).resolves.toBeDefined();
  });

  it("denies direct writes to connections and quota docs", async () => {
    await seedUserProfile("owner-a");
    await seedUserProfile("owner-b");
    const dbA = await dbAsUser("owner-a");

    await expect(
      assertDenied(
        dbA.collection("connections").doc("key-2").set({
          participantIds: ["owner-a", "owner-b"],
          participantKey: "key-2",
          requesterId: "owner-a",
          recipientId: "owner-b",
          status: "accepted",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ),
    ).resolves.toBeDefined();

    await expect(
      assertDenied(
        dbA.collection("users").doc("owner-a").collection("connectionRequestUsage").doc("2026-07").set({
          uid: "owner-a",
          periodKey: "2026-07",
          count: 99,
        }),
      ),
    ).resolves.toBeDefined();

    await expect(
      assertDenied(
        dbA.collection("users").doc("owner-a").collection("messageUsage").doc("2026-07").set({
          uid: "owner-a",
          periodKey: "2026-07",
          count: 99,
        }),
      ),
    ).resolves.toBeDefined();
  });

  it("allows conversation and message reads only for participants", async () => {
    const env = await getRulesEnv();
    await seedUserProfile("owner-a");
    await seedUserProfile("owner-b");
    await seedUserProfile("owner-c");

    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("conversations").doc("conv-1").set({
        conversationId: "conv-1",
        participantIds: ["owner-a", "owner-b"],
        participantKey: "key-1",
        status: "active",
      });

      await context
        .firestore()
        .collection("conversations")
        .doc("conv-1")
        .collection("messages")
        .doc("m-1")
        .set({
          senderUid: "owner-a",
          body: "hello",
          messageType: "text",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        });
    });

    const dbA = await dbAsUser("owner-a");
    const dbB = await dbAsUser("owner-b");
    const dbC = await dbAsUser("owner-c");

    await expect(assertAllowed(dbA.collection("conversations").doc("conv-1").get())).resolves.toBeDefined();
    await expect(assertAllowed(dbB.collection("conversations").doc("conv-1").get())).resolves.toBeDefined();
    await expect(assertDenied(dbC.collection("conversations").doc("conv-1").get())).resolves.toBeDefined();

    await expect(
      assertAllowed(
        dbA.collection("conversations").doc("conv-1").collection("messages").doc("m-1").get(),
      ),
    ).resolves.toBeDefined();
    await expect(
      assertDenied(
        dbC.collection("conversations").doc("conv-1").collection("messages").doc("m-1").get(),
      ),
    ).resolves.toBeDefined();
  });

  it("denies direct conversation and message writes", async () => {
    await seedUserProfile("owner-a");
    await seedUserProfile("owner-b");

    const dbA = await dbAsUser("owner-a");

    await expect(
      assertDenied(
        dbA.collection("conversations").doc("conv-2").set({
          conversationId: "conv-2",
          participantIds: ["owner-a", "owner-b"],
          participantKey: "key-2",
          status: "active",
        }),
      ),
    ).resolves.toBeDefined();

    await expect(
      assertDenied(
        dbA.collection("conversations").doc("conv-2").collection("messages").doc("m-1").set({
          senderUid: "owner-a",
          body: "hello",
          messageType: "text",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ),
    ).resolves.toBeDefined();
  });
});
