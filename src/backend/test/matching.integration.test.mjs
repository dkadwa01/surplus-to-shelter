import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/app.js";
import { prisma } from "../dist/config/prisma.js";
import { hashPassword } from "../dist/modules/auth/crypto.js";
import { haversineDistanceKm, sortMatches } from "../dist/modules/matching/matching.logic.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = "MatchingEngineIntegrationPass573!";
const emails = ["donor", "other-donor", "good-recipient", "wrong-category", "wrong-unit", "remote-recipient", "pending-recipient", "admin"].map((name) => `matching-${name}-${suffix}@example.test`);
let server; let baseUrl; let donor; let otherDonor; let good; let wrongCategory; let wrongUnit; let remote; let pending; let noCoordsUser; let admin; let contributionId; let communityId;
const future = (hours = 12) => new Date(Date.now() + hours * 3_600_000).toISOString();
const donationFields = (overrides = {}) => ({ foodName: "Fresh vegetables", category: "PRODUCE", quantity: 5, unit: "KG", expiresAt: future(36), pickupAddress: "42 Garden Road", pickupArea: "Matching District", latitude: 40.713, longitude: -74.006, ...overrides });
async function post(path, body, cookie) { return fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }
async function register(email, role = "DONOR") {
  const response = await post("/api/auth/register", { fullName: "Matching Test Participant", email, password, role }, undefined);
  assert.equal(response.status, 201);
  return { id: (await response.json()).user.id, cookie: response.headers.get("set-cookie").split(";")[0] };
}
async function profile(user, fields = {}) {
  const response = await post("/api/recipients", {
    organizationName: `Matching ${user.id.slice(-6)} Shelter`, recipientType: "SHELTER", address: "11 Private Shelter Street",
    serviceArea: "Matching District", latitude: 40.7128, longitude: -74.006, serviceRadiusKm: 15,
    acceptedCategories: ["PRODUCE"], capacityQuantity: 8, capacityUnit: "KG", isActive: true, isAcceptingDonations: true,
    ...fields,
  }, user.cookie);
  assert.equal(response.status, 201);
  return response.json();
}
async function approveRecipient(user, profileId) {
  const submitted = await post("/api/verification/requests", {}, user.cookie);
  assert.equal(submitted.status, 201);
  const requestId = (await submitted.json()).id;
  const decision = await fetch(`${baseUrl}/api/verification/admin/requests/${requestId}`, {
    method: "PATCH", headers: { cookie: admin.cookie, "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }),
  });
  assert.equal(decision.status, 200);
  assert.equal((await prisma.recipientProfile.findUnique({ where: { id: profileId } })).verificationStatus, "VERIFIED");
}
async function approveDonor(user) {
  const submitted = await post("/api/verification/requests", {}, user.cookie);
  assert.equal(submitted.status, 201);
  const requestId = (await submitted.json()).id;
  const decision = await fetch(`${baseUrl}/api/verification/admin/requests/${requestId}`, {
    method: "PATCH", headers: { cookie: admin.cookie, "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }),
  });
  assert.equal(decision.status, 200);
}
before(async () => {
  server = app.listen(0); await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  donor = await register(emails[0]); otherDonor = await register(emails[1]);
  const adminUser = await prisma.user.create({ data: { fullName: "Matching Test Admin", email: emails[7], passwordHash: await hashPassword(password), role: "ADMIN" } });
  const login = await post("/api/auth/login", { email: emails[7], password }); admin = { id: adminUser.id, cookie: login.headers.get("set-cookie").split(";")[0] };
  const goodUser = await register(emails[2], "RECIPIENT"); const goodProfile = await profile(goodUser); good = { ...goodUser, profileId: goodProfile.id }; await approveRecipient(good, good.profileId);
  const categoryUser = await register(emails[3], "RECIPIENT"); const categoryProfile = await profile(categoryUser, { acceptedCategories: ["BAKERY"] }); wrongCategory = { ...categoryUser, profileId: categoryProfile.id }; await approveRecipient(wrongCategory, wrongCategory.profileId);
  const unitUser = await register(emails[4], "RECIPIENT"); const unitProfile = await profile(unitUser, { capacityUnit: "PACKAGES" }); wrongUnit = { ...unitUser, profileId: unitProfile.id }; await approveRecipient(wrongUnit, wrongUnit.profileId);
  const remoteUser = await register(emails[5], "RECIPIENT"); const remoteProfile = await profile(remoteUser, { latitude: 34.0522, longitude: -118.2437, serviceArea: "West District" }); remote = { ...remoteUser, profileId: remoteProfile.id }; await approveRecipient(remote, remote.profileId);
  const pendingUser = await register(emails[6], "RECIPIENT"); const pendingProfile = await profile(pendingUser); pending = { ...pendingUser, profileId: pendingProfile.id };
});
after(async () => {
  const userIds = [donor?.id, otherDonor?.id, good?.id, wrongCategory?.id, wrongUnit?.id, remote?.id, pending?.id, noCoordsUser?.id, admin?.id].filter(Boolean);
  if (userIds.length) {
    await prisma.communityContribution.deleteMany({ where: { OR: [{ contributorId: { in: userIds } }, { communityDonation: { creatorId: { in: userIds } } }] } });
    await prisma.communityDonation.deleteMany({ where: { creatorId: { in: userIds } } });
    await prisma.donation.deleteMany({ where: { donorId: { in: userIds } } });
    await prisma.recipientProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.verificationRequest.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.$disconnect(); if (server) await new Promise((resolve) => server.close(resolve));
});

test("matching considers safety, trust, categories, quantities, location and collective food", async (t) => {
  let donationId;
  await t.test("requires authenticated donor/recipient roles and protects donation ownership", async () => {
    assert.equal((await fetch(`${baseUrl}/api/matching/recipients/me/donations`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/matching/donations/not-a-real-id/recipients`, { headers: { cookie: donor.cookie } })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/matching/donations/not-a-real-id/recipients`, { headers: { cookie: good.cookie } })).status, 403);
  });
  await t.test("exact category and compatible capacity match; incompatible category, unit, radius and pending verification do not", async () => {
    const created = await post("/api/donations", donationFields(), donor.cookie); assert.equal(created.status, 201); donationId = (await created.json()).id;
    const response = await fetch(`${baseUrl}/api/matching/donations/${donationId}/recipients`, { headers: { cookie: donor.cookie } });
    assert.equal(response.status, 200); const data = await response.json();
    assert.deepEqual(data.matches.map((match) => match.recipient.recipientProfileId), [good.profileId]);
    const match = data.matches[0];
    assert.equal(match.eligible, true); assert.equal(match.quantityCompatibility, "WITHIN_CAPACITY");
    assert.equal(match.locationCompatibility, "WITHIN_SERVICE_RADIUS"); assert.equal(match.distanceKm, 0);
    assert.equal(match.recipient.verificationStatus, "VERIFIED"); assert.equal(match.suggestionOnly, true);
    assert.equal("donorId" in match.source, false); assert.equal("address" in match.recipient, false);
    const categoryDetail = await fetch(`${baseUrl}/api/matching/details/DONATION/${donationId}/recipients/${wrongCategory.profileId}`, { headers: { cookie: donor.cookie } });
    assert.equal((await categoryDetail.json()).eligible, false);
    const unitDetail = await fetch(`${baseUrl}/api/matching/details/DONATION/${donationId}/recipients/${wrongUnit.profileId}`, { headers: { cookie: donor.cookie } });
    assert.equal((await unitDetail.json()).quantityCompatibility, "UNIT_INCOMPATIBLE");
    const remoteDetail = await fetch(`${baseUrl}/api/matching/details/DONATION/${donationId}/recipients/${remote.profileId}`, { headers: { cookie: donor.cookie } });
    assert.equal((await remoteDetail.json()).locationCompatibility, "OUTSIDE_SERVICE_RADIUS");
    const pendingDetail = await fetch(`${baseUrl}/api/matching/details/DONATION/${donationId}/recipients/${pending.profileId}`, { headers: { cookie: donor.cookie } });
    assert.equal(pendingDetail.status, 404);
    const pendingFeed = await fetch(`${baseUrl}/api/matching/recipients/me/donations`, { headers: { cookie: pending.cookie } });
    assert.equal(pendingFeed.status, 403); assert.equal((await pendingFeed.json()).error.code, "VERIFICATION_REQUIRED");
    const idor = await fetch(`${baseUrl}/api/matching/donations/${donationId}/recipients`, { headers: { cookie: otherDonor.cookie } });
    assert.equal(idor.status, 404);
  });
  await t.test("capacity overflow, future preparation, cancelled and expired sources are not suggested", async () => {
    const tooLarge = await post("/api/donations", donationFields({ quantity: 9 }), donor.cookie); const tooLargeId = (await tooLarge.json()).id;
    const overCapacity = await fetch(`${baseUrl}/api/matching/donations/${tooLargeId}/recipients`, { headers: { cookie: donor.cookie } });
    assert.deepEqual((await overCapacity.json()).matches, []);
    const preparedLater = await post("/api/donations", donationFields({ preparedAt: future(1), expiresAt: future(3) }), donor.cookie); const preparedId = (await preparedLater.json()).id;
    const notReady = await fetch(`${baseUrl}/api/matching/donations/${preparedId}/recipients`, { headers: { cookie: donor.cookie } });
    assert.deepEqual((await notReady.json()).matches, []);
    const cancelled = await post(`/api/donations/${donationId}/cancel`, {}, donor.cookie); assert.equal(cancelled.status, 200);
    const unavailable = await fetch(`${baseUrl}/api/matching/donations/${donationId}/recipients`, { headers: { cookie: donor.cookie } });
    assert.equal(unavailable.status, 409);
    const expired = await prisma.donation.create({ data: { donorId: donor.id, ...donationFields(), expiresAt: new Date(Date.now() - 1000), status: "AVAILABLE" } });
    const expiredMatch = await fetch(`${baseUrl}/api/matching/donations/${expired.id}/recipients`, { headers: { cookie: donor.cookie } });
    assert.equal(expiredMatch.status, 409); assert.equal((await prisma.donation.findUnique({ where: { id: expired.id } })).status, "EXPIRED");
  });
  await t.test("recipient endpoint requires its own current verified profile and handles missing coordinates", async () => {
    const pendingFeed = await fetch(`${baseUrl}/api/matching/recipients/me/donations`, { headers: { cookie: pending.cookie } });
    assert.equal(pendingFeed.status, 403); assert.equal((await pendingFeed.json()).error.code, "VERIFICATION_REQUIRED");
    noCoordsUser = await register(`matching-no-coords-${suffix}@example.test`, "RECIPIENT");
    const noCoordsProfile = await profile(noCoordsUser, { latitude: undefined, longitude: undefined, serviceRadiusKm: undefined });
    await approveRecipient(noCoordsUser, noCoordsProfile.id);
    const source = await post("/api/donations", donationFields({ pickupArea: "Matching District" }), donor.cookie); const sourceId = (await source.json()).id;
    const feed = await fetch(`${baseUrl}/api/matching/recipients/me/donations`, { headers: { cookie: noCoordsUser.cookie } });
    const matches = (await feed.json()).matches.filter((match) => match.source.sourceId === sourceId);
    assert.equal(matches.length, 1); assert.equal(matches[0].distanceKm, null); assert.ok(matches[0].warnings.some((warning) => warning.includes("Coordinates are incomplete")));
  });
  await t.test("ready community collections match each verified, active contribution independently", async () => {
    await approveDonor(donor);
    const group = await prisma.communityDonation.create({ data: { creatorId: donor.id, title: "Ready food collection", pickupArea: "Matching District", latitude: 40.713, longitude: -74.006, targetQuantity: 3, targetCategory: "PRODUCE", targetUnit: "KG", deadline: new Date(future(24)), status: "TARGET_REACHED" } });
    communityId = group.id;
    const produce = await prisma.communityContribution.create({ data: { communityDonationId: group.id, contributorId: donor.id, foodName: "Community carrots", category: "PRODUCE", quantity: 3, unit: "KG", expiresAt: new Date(future(8)), status: "ACTIVE" } }); contributionId = produce.id;
    const bakery = await prisma.communityContribution.create({ data: { communityDonationId: group.id, contributorId: donor.id, foodName: "Community bread", category: "BAKERY", quantity: 10, unit: "ITEMS", expiresAt: new Date(future(6)), status: "ACTIVE" } });
    const response = await fetch(`${baseUrl}/api/matching/community-donations/${group.id}/recipients`, { headers: { cookie: donor.cookie } });
    assert.equal(response.status, 200); const data = await response.json();
    assert.equal(data.sources.length, 2);
    assert.ok(data.sources.find((entry) => entry.source.sourceId === produce.id).matches.some((match) => match.recipient.recipientProfileId === good.profileId));
    assert.deepEqual(data.sources.find((entry) => entry.source.sourceId === bakery.id).matches, []);
    assert.equal((await prisma.communityContribution.findUnique({ where: { id: produce.id } })).quantity, 3);
    const opened = await prisma.communityDonation.create({ data: { creatorId: donor.id, title: "Still collecting", pickupArea: "Matching District", deadline: new Date(future(24)), status: "OPEN" } });
    const notReady = await fetch(`${baseUrl}/api/matching/community-donations/${opened.id}/recipients`, { headers: { cookie: donor.cookie } }); assert.equal(notReady.status, 409);
    const outsider = await fetch(`${baseUrl}/api/matching/community-donations/${group.id}/recipients`, { headers: { cookie: otherDonor.cookie } }); assert.equal(outsider.status, 404);
    const deadlinePassed = await prisma.communityDonation.create({ data: { creatorId: donor.id, title: "Expired target collection", pickupArea: "Matching District", deadline: new Date(Date.now() - 1000), status: "TARGET_REACHED" } });
    const expiredItem = await prisma.communityContribution.create({ data: { communityDonationId: deadlinePassed.id, contributorId: donor.id, foodName: "Expired group carrots", category: "PRODUCE", quantity: 1, unit: "KG", expiresAt: new Date(future(4)), status: "ACTIVE" } });
    const expiredDetail = await fetch(`${baseUrl}/api/matching/details/COMMUNITY_CONTRIBUTION/${expiredItem.id}/recipients/${good.profileId}`, { headers: { cookie: good.cookie } });
    assert.equal(expiredDetail.status, 409); assert.equal((await prisma.communityDonation.findUnique({ where: { id: deadlinePassed.id } })).status, "EXPIRED");
    const recipientFeed = await fetch(`${baseUrl}/api/matching/recipients/me/donations`, { headers: { cookie: good.cookie } });
    assert.ok((await recipientFeed.json()).matches.some((match) => match.source.sourceId === produce.id));
  });
  await t.test("match scores and ordering are deterministic, and straight-line distance is measured safely", async () => {
    assert.ok(haversineDistanceKm(40.7128, -74.006, 40.713, -74.006) < 0.1);
    const response = await fetch(`${baseUrl}/api/matching/donations/${donationId}/recipients`, { headers: { cookie: donor.cookie } });
    assert.equal(response.status, 409); // the source was cancelled above
    const candidates = [{ score: 70, source: { expiresAt: future(10), sourceId: "b" }, recipient: { organizationName: "Shelter B" } }, { score: 70, source: { expiresAt: future(10), sourceId: "a" }, recipient: { organizationName: "Shelter A" } }];
    const order = (items) => sortMatches(items).map(({ source }) => source.sourceId);
    assert.deepEqual(order(candidates), order([...candidates].reverse()));
  });
});
