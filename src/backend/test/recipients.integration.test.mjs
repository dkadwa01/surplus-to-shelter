import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/app.js";
import { prisma } from "../dist/config/prisma.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const recipientEmail = `recipient-one-${suffix}@example.test`;
const otherRecipientEmail = `recipient-two-${suffix}@example.test`;
const donorEmail = `recipient-donor-${suffix}@example.test`;
const password = "RecipientTestingPassword473!";
let server; let baseUrl; let recipientId; let otherRecipientId; let donorId; let recipientCookie; let otherRecipientCookie; let donorCookie; let profileId;
const profile = (overrides = {}) => ({
  organizationName: "Northside Community Shelter", recipientType: "SHELTER", description: "A local overnight shelter.",
  address: "44 Shelter Road", serviceArea: "North District", latitude: 40.7128, longitude: -74.006,
  serviceRadiusKm: 15, acceptedCategories: ["PREPARED_MEALS", "PRODUCE"], capacityQuantity: 80,
  capacityUnit: "MEALS", dietaryRestrictions: "No shellfish", availabilityNotes: "Weekday collection before 8 PM",
  isAcceptingDonations: true, isActive: true, ...overrides,
});
async function post(path, body, cookie) { return fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }
async function register(email, role) {
  const response = await post("/api/auth/register", { fullName: "Recipient Test Contact", email, password, role });
  assert.equal(response.status, 201);
  return { id: (await response.json()).user.id, cookie: response.headers.get("set-cookie").split(";")[0] };
}
let adminId; let adminCookie; let driverId; let driverCookie;
before(async () => {
  server = app.listen(0); await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  ({ id: recipientId, cookie: recipientCookie } = await register(recipientEmail, "RECIPIENT"));
  ({ id: otherRecipientId, cookie: otherRecipientCookie } = await register(otherRecipientEmail, "RECIPIENT"));
  ({ id: donorId, cookie: donorCookie } = await register(donorEmail, "DONOR"));
  ({ id: driverId, cookie: driverCookie } = await register(`recipient-driver-${suffix}@example.test`, "DRIVER"));
  ({ id: adminId, cookie: adminCookie } = await register(`recipient-admin-${suffix}@example.test`, "DONOR"));
  await prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
});
after(async () => {
  const userIds = [recipientId, otherRecipientId, donorId, driverId, adminId].filter(Boolean);
  await prisma.recipientProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.donation.deleteMany({ where: { donorId: { in: userIds } } });
  await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect(); if (server) await new Promise((resolve) => server.close(resolve));
});

test("recipient profiles enforce role, ownership, validation and pending verification", async (t) => {
  await t.test("requires authentication and the recipient role", async () => {
    assert.equal((await post("/api/recipients", profile())).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/recipients/me`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/recipients`)).status, 401);

    const deniedPost = await post("/api/recipients", profile(), donorCookie);
    assert.equal(deniedPost.status, 403); assert.equal((await deniedPost.json()).error.code, "FORBIDDEN");
    const deniedRead = await fetch(`${baseUrl}/api/recipients/me`, { headers: { cookie: donorCookie } });
    assert.equal(deniedRead.status, 403);
    const deniedPatch = await fetch(`${baseUrl}/api/recipients/me`, { method: "PATCH", headers: { cookie: donorCookie, "content-type": "application/json" }, body: JSON.stringify({ organizationName: "Hacked" }) });
    assert.equal(deniedPatch.status, 403);

    const driverPost = await post("/api/recipients", profile(), driverCookie);
    assert.equal(driverPost.status, 403);

    // Recipient role cannot access recipient discovery
    const recipientDiscovery = await fetch(`${baseUrl}/api/recipients`, { headers: { cookie: recipientCookie } });
    assert.equal(recipientDiscovery.status, 403);

    // Profile not found before creation
    const notYetCreated = await fetch(`${baseUrl}/api/recipients/me`, { headers: { cookie: recipientCookie } });
    assert.equal(notYetCreated.status, 404);
  });
  await t.test("rejects invalid coordinates and mismatched location/capacity data", async () => {
    // Coordinate range checks
    assert.equal((await post("/api/recipients", profile({ latitude: 91 }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ latitude: -91 }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ longitude: 181 }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ longitude: -181 }), recipientCookie)).status, 400);

    // Paired coordinates
    assert.equal((await post("/api/recipients", profile({ longitude: undefined }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ latitude: undefined, longitude: -74.006 }), recipientCookie)).status, 400);

    // Service radius requires coordinates
    assert.equal((await post("/api/recipients", profile({ latitude: undefined, longitude: undefined, serviceRadiusKm: 15 }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ serviceRadiusKm: -5 }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ serviceRadiusKm: 0 }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ serviceRadiusKm: 300 }), recipientCookie)).status, 400);

    // Capacity pairing and bounds
    assert.equal((await post("/api/recipients", profile({ capacityUnit: undefined }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ capacityQuantity: undefined, capacityUnit: "MEALS" }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ capacityQuantity: 0 }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ capacityQuantity: -10 }), recipientCookie)).status, 400);

    // Required fields and food categories
    assert.equal((await post("/api/recipients", profile({ organizationName: " " }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ address: "123" }), recipientCookie)).status, 400);
    assert.equal((await post("/api/recipients", profile({ acceptedCategories: ["BAKERY", "BAKERY"] }), recipientCookie)).status, 400);
  });
  await t.test("creates a profile for the session user and defaults to pending", async () => {
    const response = await post("/api/recipients", { ...profile(), userId: otherRecipientId, verificationStatus: "VERIFIED" }, recipientCookie);
    assert.equal(response.status, 201);
    const created = await response.json(); profileId = created.id;
    assert.equal(created.userId, recipientId); assert.equal(created.verificationStatus, "PENDING");
    assert.equal(created.contact.email, recipientEmail);
    assert.equal("passwordHash" in created, false);
    const duplicate = await post("/api/recipients", profile(), recipientCookie);
    assert.equal(duplicate.status, 409);
  });
  await t.test("retrieves and updates only the current profile", async () => {
    const own = await fetch(`${baseUrl}/api/recipients/me`, { headers: { cookie: recipientCookie } });
    assert.equal(own.status, 200); assert.equal((await own.json()).id, profileId);

    // Reject empty update
    const emptyUpdate = await fetch(`${baseUrl}/api/recipients/me`, { method: "PATCH", headers: { cookie: recipientCookie, "content-type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(emptyUpdate.status, 400);

    const updated = await fetch(`${baseUrl}/api/recipients/me`, { method: "PATCH", headers: { cookie: recipientCookie, "content-type": "application/json" }, body: JSON.stringify({ organizationName: "Northside Food Shelter", acceptedCategories: ["BAKERY"], verificationStatus: "VERIFIED", userId: otherRecipientId }) });
    assert.equal(updated.status, 200);
    const result = await updated.json();
    assert.equal(result.organizationName, "Northside Food Shelter"); assert.deepEqual(result.acceptedCategories, ["BAKERY"]);
    assert.equal(result.verificationStatus, "PENDING"); assert.equal(result.userId, recipientId);
    const noProfileIdRoute = await fetch(`${baseUrl}/api/recipients/${profileId}`, { method: "PATCH", headers: { cookie: otherRecipientCookie, "content-type": "application/json" }, body: JSON.stringify({ organizationName: "Hijacked" }) });
    assert.notEqual(noProfileIdRoute.status, 200);
  });
  await t.test("discovery exposes only verified active profiles and applies filters", async () => {
    const pendingList = await fetch(`${baseUrl}/api/recipients?recipientType=SHELTER&serviceArea=North`, { headers: { cookie: donorCookie } });
    assert.equal(pendingList.status, 200); assert.deepEqual(await pendingList.json(), []);
    await prisma.recipientProfile.update({ where: { id: profileId }, data: { verificationStatus: "VERIFIED" } });
    const result = await fetch(`${baseUrl}/api/recipients?recipientType=SHELTER&serviceArea=North&category=BAKERY`, { headers: { cookie: donorCookie } });
    assert.equal(result.status, 200);
    const items = await result.json(); assert.equal(items.length, 1); assert.equal(items[0].id, profileId);
    assert.equal("address" in items[0], false); assert.equal("contact" in items[0], false);
    assert.equal("userId" in items[0], false); assert.equal("verificationStatus" in items[0], false);

    // Driver can also discover recipients
    const driverDiscovery = await fetch(`${baseUrl}/api/recipients`, { headers: { cookie: driverCookie } });
    assert.equal(driverDiscovery.status, 200);

    const unavailable = await fetch(`${baseUrl}/api/recipients?serviceArea=North&accepting=false`, { headers: { cookie: donorCookie } });
    assert.deepEqual(await unavailable.json(), []);
    const hiddenInactive = await fetch(`${baseUrl}/api/recipients?active=false`, { headers: { cookie: donorCookie } });
    assert.equal(hiddenInactive.status, 403);

    // Admin can discover inactive profiles
    const adminDiscovery = await fetch(`${baseUrl}/api/recipients?active=false`, { headers: { cookie: adminCookie } });
    assert.equal(adminDiscovery.status, 200);
  });
  await t.test("a different recipient's /me endpoint remains scoped to that account", async () => {
    const created = await post("/api/recipients", profile({ organizationName: "Other Local NGO", recipientType: "NGO" }), otherRecipientCookie);
    assert.equal(created.status, 201);
    const other = await fetch(`${baseUrl}/api/recipients/me`, { headers: { cookie: otherRecipientCookie } });
    assert.equal((await other.json()).organizationName, "Other Local NGO");
    const original = await fetch(`${baseUrl}/api/recipients/me`, { headers: { cookie: recipientCookie } });
    assert.equal((await original.json()).organizationName, "Northside Food Shelter");
  });
  await t.test("donation module remains functional and isolated", async () => {
    const donationPayload = { foodName: "Rice & Beans", category: "GRAINS", quantity: 20, unit: "SERVINGS", expiresAt: new Date(Date.now() + 7_200_000).toISOString(), pickupAddress: "50 Warehouse Way", pickupArea: "Central District" };
    const donationRes = await post("/api/donations", donationPayload, donorCookie);
    assert.equal(donationRes.status, 201);
    const donation = await donationRes.json();
    assert.equal(donation.donorId, donorId);

    // Recipient cannot create donation
    const recipientDonation = await post("/api/donations", donationPayload, recipientCookie);
    assert.equal(recipientDonation.status, 403);
  });
});
