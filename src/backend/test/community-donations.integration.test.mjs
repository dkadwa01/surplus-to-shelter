import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/app.js";
import { prisma } from "../dist/config/prisma.js";
import { hashPassword } from "../dist/modules/auth/crypto.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = "CommunityModuleIntegrationPass482!";
const emails = ["organizer", "contributor", "unverified", "admin", "caterer"].map((name) => `community-${name}-${suffix}@example.test`);
let server; let baseUrl; let organizer; let contributor; let unverified; let admin; let caterer; let previousThreshold; let otherContributionId;
const future = (days = 2) => new Date(Date.now() + days * 86400000).toISOString();
const groupFields = (overrides = {}) => ({ title: "Neighborhood food collection", pickupArea: "North Community", deadline: future(), ...overrides });
const contributionFields = (overrides = {}) => ({ foodName: "Fresh vegetables", category: "PRODUCE", quantity: 0.5, unit: "KG", expiresAt: future(), note: "Sealed and chilled", ...overrides });
async function post(path, body, cookie) { return fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }
async function jsonRequest(path, method, body, cookie) { return fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
async function register(email, role = "DONOR", donorType) {
  const response = await post("/api/auth/register", { fullName: "Community Test Household", email, password, role, ...(donorType ? { donorType } : {}) });
  assert.equal(response.status, 201);
  return { id: (await response.json()).user.id, cookie: response.headers.get("set-cookie").split(";")[0] };
}
async function verify(userId) {
  await prisma.verificationRequest.create({ data: { userId, participantType: "DONOR", status: "VERIFIED" } });
}
before(async () => {
  server = app.listen(0); await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  organizer = await register(emails[0]); contributor = await register(emails[1]); unverified = await register(emails[2]);
  const adminUser = await prisma.user.create({ data: { fullName: "Community Test Admin", email: emails[3], passwordHash: await hashPassword(password), role: "ADMIN" } });
  const login = await post("/api/auth/login", { email: emails[3], password });
  admin = { id: adminUser.id, cookie: login.headers.get("set-cookie").split(";")[0] };
  await verify(organizer.id); await verify(contributor.id);
  previousThreshold = await prisma.individualContributionThreshold.findUnique({ where: { category_unit: { category: "PRODUCE", unit: "KG" } } });
});
after(async () => {
  const ids = [organizer?.id, contributor?.id, unverified?.id, admin?.id, caterer?.id].filter(Boolean);
  if (ids.length) {
    await prisma.communityContribution.deleteMany({ where: { contributorId: { in: ids } } });
    await prisma.communityDonation.deleteMany({ where: { creatorId: { in: ids } } });
    await prisma.donation.deleteMany({ where: { donorId: { in: ids } } });
    await prisma.verificationRecord.deleteMany({ where: { request: { userId: { in: ids } } } });
    await prisma.verificationRequest.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  if (previousThreshold) await prisma.individualContributionThreshold.update({ where: { id: previousThreshold.id }, data: { minimumQuantity: previousThreshold.minimumQuantity } });
  else await prisma.individualContributionThreshold.deleteMany({ where: { category: "PRODUCE", unit: "KG" } });
  await prisma.$disconnect(); if (server) await new Promise((resolve) => server.close(resolve));
});

test("community donations preserve contributions, privacy, ownership and lifecycle", async (t) => {
  let groupId; let firstContributionId;
  await t.test("requires authentication, donor role and persisted verification", async () => {
    assert.equal((await post("/api/community-donations", groupFields())).status, 401);
    assert.equal((await post("/api/community-donations", groupFields(), unverified.cookie)).status, 403);
    assert.equal((await jsonRequest("/api/community-donations", "POST", groupFields(), admin.cookie)).status, 403);
    const created = await post("/api/community-donations", groupFields({ creatorId: contributor.id }), organizer.cookie);
    assert.equal(created.status, 201);
    const createdGroup = await created.json();
    assert.equal(createdGroup.isOrganizer, true);
    assert.equal((await prisma.communityDonation.findUnique({ where: { id: createdGroup.id } })).creatorId, organizer.id);
  });
  await t.test("validates target grouping and quantities before persistence", async () => {
    const partialTarget = await post("/api/community-donations", groupFields({ targetQuantity: 5 }), organizer.cookie);
    assert.equal(partialTarget.status, 400);
    const created = await post("/api/community-donations", groupFields({ targetQuantity: 2, targetCategory: "PRODUCE", targetUnit: "KG" }), organizer.cookie);
    assert.equal(created.status, 201); const data = await created.json(); groupId = data.id;
    assert.equal(data.isOrganizer, true); assert.equal(data.status, "OPEN"); assert.equal(data.targetProgressPercent, 0);
    const invalid = await post(`/api/community-donations/${groupId}/contributions`, contributionFields({ quantity: 0 }), contributor.cookie);
    assert.equal(invalid.status, 400); assert.equal((await invalid.json()).error.code, "INVALID_INPUT");
  });
  await t.test("thresholds are admin-configured and below-minimum community portions are accepted", async () => {
    const unauthorized = await jsonRequest("/api/community-donations/admin/thresholds", "PUT", { category: "PRODUCE", unit: "KG", minimumQuantity: 1 }, organizer.cookie);
    assert.equal(unauthorized.status, 403);
    const configured = await jsonRequest("/api/community-donations/admin/thresholds", "PUT", { category: "PRODUCE", unit: "KG", minimumQuantity: 1 }, admin.cookie);
    assert.equal(configured.status, 200);
    const individual = await post("/api/donations", { foodName: "Small vegetable portion", category: "PRODUCE", quantity: 0.5, unit: "KG", expiresAt: future(), pickupAddress: "2 Community Lane", pickupArea: "North Community" }, organizer.cookie);
    assert.equal(individual.status, 400); assert.equal((await individual.json()).error.code, "INVALID_INPUT");
    const response = await post(`/api/community-donations/${groupId}/contributions`, { ...contributionFields(), contributorId: contributor.id }, organizer.cookie);
    assert.equal(response.status, 201); const result = await response.json(); firstContributionId = result.id;
    assert.equal((await prisma.communityContribution.findUnique({ where: { id: result.id } })).contributorId, organizer.id);
    assert.equal(result.belowIndividualThreshold, true); assert.equal(result.quantity, 0.5);
  });
  await t.test("multiple households contribute, progress stays unit-aware, and private identity is omitted", async () => {
    const response = await post(`/api/community-donations/${groupId}/contributions`, contributionFields({ quantity: 1.5, note: "Private note" }), contributor.cookie);
    assert.equal(response.status, 201); otherContributionId = (await response.clone().json()).id;
    const detail = await fetch(`${baseUrl}/api/community-donations/${groupId}`, { headers: { cookie: contributor.cookie } });
    assert.equal(detail.status, 200); const group = await detail.json();
    assert.equal(group.status, "TARGET_REACHED"); assert.equal(group.targetProgressPercent, 100); assert.equal(group.contributorCount, 2);
    assert.equal(group.totals.length, 1); assert.equal(group.totals[0].quantity, 2);
    assert.equal(group.contributions.find((entry) => entry.isMine).note, "Private note");
    const other = group.contributions.find((entry) => !entry.isMine);
    assert.equal(other.note, null); assert.equal("contributorId" in other, false);
    assert.equal((await post(`/api/community-donations/${groupId}/contributions`, contributionFields(), organizer.cookie)).status, 409);
  });
  await t.test("contribution access is owner-scoped and closed groups reject changes", async () => {
    assert.equal((await fetch(`${baseUrl}/api/community-donations/contributions/${otherContributionId}`, { headers: { cookie: contributor.cookie } })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/community-donations/contributions/${otherContributionId}`, { headers: { cookie: organizer.cookie } })).status, 404);
    const denied = await jsonRequest(`/api/community-donations/contributions/${otherContributionId}`, "PUT", contributionFields({ foodName: "Tampered item" }), organizer.cookie);
    assert.equal(denied.status, 404);
    const closed = await post(`/api/community-donations/${groupId}/close`, {}, contributor.cookie);
    assert.equal(closed.status, 404);
    const closedByOwner = await post(`/api/community-donations/${groupId}/close`, {}, organizer.cookie);
    assert.equal(closedByOwner.status, 200); assert.equal((await closedByOwner.json()).status, "CLOSED");
    assert.equal((await post(`/api/community-donations/${groupId}/contributions`, contributionFields(), organizer.cookie)).status, 409);
    const cancellable = await post("/api/community-donations", groupFields({ title: "Collection to cancel" }), organizer.cookie);
    const cancellableId = (await cancellable.json()).id;
    assert.equal((await post(`/api/community-donations/${cancellableId}/cancel`, {}, contributor.cookie)).status, 404);
    assert.equal((await post(`/api/community-donations/${cancellableId}/cancel`, {}, organizer.cookie)).status, 200);
    assert.equal((await post(`/api/community-donations/${cancellableId}/contributions`, contributionFields(), contributor.cookie)).status, 409);
  });
  await t.test("deadline expiration is enforced, and area discovery returns no private donor data", async () => {
    const expiring = await post("/api/community-donations", groupFields({ title: "Expiring neighborhood collection" }), organizer.cookie);
    const expiringId = (await expiring.json()).id;
    await prisma.communityDonation.update({ where: { id: expiringId }, data: { deadline: new Date(Date.now() - 1000) } });
    const expired = await fetch(`${baseUrl}/api/community-donations/${expiringId}`, { headers: { cookie: organizer.cookie } });
    assert.equal((await expired.json()).status, "EXPIRED");
    assert.equal((await post(`/api/community-donations/${expiringId}/contributions`, contributionFields(), contributor.cookie)).status, 409);
    const discoverableResponse = await post("/api/community-donations", groupFields({ title: "Open area collection" }), organizer.cookie);
    const discoverableId = (await discoverableResponse.json()).id;
    const list = await fetch(`${baseUrl}/api/community-donations?pickupArea=North`, { headers: { cookie: contributor.cookie } });
    assert.equal(list.status, 200); const groups = await list.json();
    assert.ok(groups.some((entry) => entry.id === discoverableId));
    assert.equal("creatorId" in groups[0], false); assert.equal("contributorId" in groups[0], false);
  });
  await t.test("mixed units are not combined and contributors may withdraw while open", async () => {
    const groupResponse = await post("/api/community-donations", groupFields({ title: "Mixed item collection" }), organizer.cookie);
    const mixedId = (await groupResponse.json()).id;
    const kg = await post(`/api/community-donations/${mixedId}/contributions`, contributionFields({ quantity: 5 }), organizer.cookie);
    const kgItem = await kg.json();
    const edited = await jsonRequest(`/api/community-donations/contributions/${kgItem.id}`, "PUT", contributionFields({ foodName: "Fresh carrots", quantity: 4 }), organizer.cookie);
    assert.equal(edited.status, 200); assert.equal((await edited.json()).foodName, "Fresh carrots");
    await post(`/api/community-donations/${mixedId}/contributions`, contributionFields({ foodName: "Milk", category: "DAIRY", quantity: 10, unit: "LITRES" }), contributor.cookie);
    const summary = await (await fetch(`${baseUrl}/api/community-donations/${mixedId}`, { headers: { cookie: organizer.cookie } })).json();
    assert.equal(summary.totals.length, 2); assert.equal(summary.targetProgressPercent, null);
    assert.equal(summary.totals.find((total) => total.unit === "KG").quantity, 4);
    assert.equal((await post(`/api/community-donations/contributions/${kgItem.id}/withdraw`, {}, organizer.cookie)).status, 200);
  });
  await t.test("wedding and event caterer registers, completes verification, creates bulk donation, and joins community donation", async () => {
    caterer = await register(emails[4], "DONOR", "CATERER");

    // 1. Verify caterer registration preserves donorType
    const catererMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: caterer.cookie } });
    assert.equal(catererMe.status, 200);
    const { user: catererMeData } = await catererMe.json();
    assert.equal(catererMeData.role, "DONOR");
    assert.equal(catererMeData.donorType, "CATERER");

    // 2. Unverified caterer cannot create a community collection or contribute yet
    const unverifiedCommunityAttempt = await post("/api/community-donations", groupFields({ title: "Caterer Collection Attempt" }), caterer.cookie);
    assert.equal(unverifiedCommunityAttempt.status, 403);
    assert.equal((await unverifiedCommunityAttempt.json()).error.code, "VERIFICATION_REQUIRED");

    // 3. Caterer must provide business/organization name for verification
    const missingOrgName = await post("/api/verification/requests", { additionalInfo: "Event catering service" }, caterer.cookie);
    assert.equal(missingOrgName.status, 400);
    assert.equal((await missingOrgName.json()).error.code, "INVALID_INPUT");

    // 4. Caterer submits verification with organizationName
    const verificationSubmission = await post("/api/verification/requests", {
      organizationName: "Grand Ballroom Wedding & Banquet Catering",
      additionalInfo: "Licensed commercial event kitchen for wedding banquets and corporate galas",
    }, caterer.cookie);
    assert.equal(verificationSubmission.status, 201);
    const catererReq = await verificationSubmission.json();
    assert.equal(catererReq.status, "PENDING");
    assert.equal(catererReq.organizationName, "Grand Ballroom Wedding & Banquet Catering");

    // 5. Admin reviews and approves the caterer
    const adminReview = await jsonRequest(`/api/verification/admin/requests/${catererReq.id}`, "PATCH", { action: "VERIFIED" }, admin.cookie);
    assert.equal(adminReview.status, 200);
    assert.equal((await adminReview.json()).status, "VERIFIED");

    // 6. Verified caterer creates a bulk food donation (using the same standard donation system)
    const bulkDonation = await post("/api/donations", {
      foodName: "Post-Wedding Reception Entrees (Roast Beef & Salmon)",
      category: "PREPARED_MEALS",
      quantity: 80,
      unit: "SERVINGS",
      preparedAt: new Date().toISOString(),
      expiresAt: future(2),
      pickupAddress: "100 Grand Ballroom Way",
      pickupArea: "North Community",
      description: "Chilled in hotel pans, ready for immediate pickup.",
    }, caterer.cookie);
    assert.equal(bulkDonation.status, 201);
    const donationData = await bulkDonation.json();
    assert.equal(donationData.donorType, "CATERER");
    assert.equal(donationData.quantity, 80);
    assert.equal(donationData.status, "AVAILABLE");

    // 7. Verified caterer also contributes bulk portions to a community collection
    const catererDrive = await post("/api/community-donations", groupFields({ title: "Caterer-led Wedding Surplus Drive" }), caterer.cookie);
    assert.equal(catererDrive.status, 201);
    const catererDriveData = await catererDrive.json();
    assert.equal(catererDriveData.isOrganizer, true);

    // Caterer contributes bakery pastries to their own drive
    const catererContribution = await post(`/api/community-donations/${catererDriveData.id}/contributions`, {
      foodName: "Wedding Dinner Bread Rolls & Pastries",
      category: "BAKERY",
      quantity: 50,
      unit: "ITEMS",
      expiresAt: future(2),
      note: "Leftover from wedding dinner, baked fresh today",
    }, caterer.cookie);
    assert.equal(catererContribution.status, 201);
    const contributionData = await catererContribution.json();
    assert.equal(contributionData.quantity, 50);
    assert.equal(contributionData.unit, "ITEMS");

    // Another household joins the caterer-led collection
    const householdContribution = await post(`/api/community-donations/${catererDriveData.id}/contributions`, {
      foodName: "Gluten-Free Bread",
      category: "BAKERY",
      quantity: 10,
      unit: "ITEMS",
      expiresAt: future(2),
    }, contributor.cookie);
    assert.equal(householdContribution.status, 201);

    // Verify aggregated totals
    const groupView = await (await fetch(`${baseUrl}/api/community-donations/${catererDriveData.id}`, { headers: { cookie: contributor.cookie } })).json();
    assert.equal(groupView.contributorCount, 2);
    const bakeryTotal = groupView.totals.find((t) => t.category === "BAKERY" && t.unit === "ITEMS");
    assert.ok(bakeryTotal);
    assert.equal(bakeryTotal.quantity, 60);

    // Verify privacy: contributor cannot see caterer's private note or caterer ID
    const catererItemSeenByHousehold = groupView.contributions.find((c) => c.id === contributionData.id);
    assert.ok(catererItemSeenByHousehold);
    assert.equal(catererItemSeenByHousehold.isMine, false);
    assert.equal(catererItemSeenByHousehold.note, null);
    assert.equal("contributorId" in catererItemSeenByHousehold, false);
    assert.equal("email" in catererItemSeenByHousehold, false);
    assert.equal("phone" in catererItemSeenByHousehold, false);
  });
});
