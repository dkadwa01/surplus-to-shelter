import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/app.js";
import { prisma } from "../dist/config/prisma.js";
import { hashPassword } from "../dist/modules/auth/crypto.js";
import { isUserVerified } from "../dist/modules/verification/verification.service.js";
import { requireVerifiedUser } from "../dist/modules/verification/verification.middleware.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const donorEmail = `verify-donor-${suffix}@example.test`;
const recipientEmail = `verify-recipient-${suffix}@example.test`;
const driverEmail = `verify-driver-${suffix}@example.test`;
const adminEmail = `verify-admin-${suffix}@example.test`;
const password = "TrustModuleIntegrationPass473!";
let server; let baseUrl; let donorId; let recipientId; let driverId; let adminId; let unconfiguredRecipientId;
let donorCookie; let recipientCookie; let driverCookie; let adminCookie; let donorRequestId; let recipientRequestId; let driverRequestId;
async function post(path, body, cookie) { return fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }
async function register(email, role, donorType) {
  const response = await post("/api/auth/register", { fullName: "Trust Test Participant", email, password, role, ...(donorType ? { donorType } : {}) });
  assert.equal(response.status, 201);
  return { id: (await response.json()).user.id, cookie: response.headers.get("set-cookie").split(";")[0] };
}
const recipientProfile = { organizationName: "Trust Test Shelter", recipientType: "SHELTER", address: "55 Trust Avenue", serviceArea: "Central District", acceptedCategories: ["PREPARED_MEALS"], isAcceptingDonations: true, isActive: true };
before(async () => {
  server = app.listen(0); await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); }); baseUrl = `http://127.0.0.1:${server.address().port}`;
  ({ id: donorId, cookie: donorCookie } = await register(donorEmail, "DONOR", "FOOD_BUSINESS"));
  ({ id: recipientId, cookie: recipientCookie } = await register(recipientEmail, "RECIPIENT"));
  ({ id: driverId, cookie: driverCookie } = await register(driverEmail, "DRIVER"));
  const profile = await post("/api/recipients", recipientProfile, recipientCookie); assert.equal(profile.status, 201);
  const admin = await prisma.user.create({ data: { fullName: "Trust Test Admin", email: adminEmail, passwordHash: await hashPassword(password), role: "ADMIN" } }); adminId = admin.id;
  const login = await post("/api/auth/login", { email: adminEmail, password }); assert.equal(login.status, 200); adminCookie = login.headers.get("set-cookie").split(";")[0];
});
after(async () => {
  const ids = [donorId, recipientId, driverId, adminId, unconfiguredRecipientId].filter(Boolean);
  await prisma.donation.deleteMany({ where: { donorId: { in: ids } } });
  await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect(); if (server) await new Promise((resolve) => server.close(resolve));
});

test("verification submissions, admin reviews, history and trust status", async (t) => {
  await t.test("requires a participant session and rejects forged identity/role fields", async () => {
    assert.equal((await post("/api/verification/requests", {})).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/verification/me`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/verification/admin/requests`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/verification/admin/requests/test-id`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }) })).status, 401);

    const forged = await post("/api/verification/requests", { userId: recipientId, participantType: "RECIPIENT" }, donorCookie);
    assert.equal(forged.status, 400); assert.equal((await forged.json()).error.code, "INVALID_INPUT");
    const forgedStatus = await post("/api/verification/requests", { vehicleType: "VAN", status: "VERIFIED" }, driverCookie);
    assert.equal(forgedStatus.status, 400);
    const adminSubmit = await post("/api/verification/requests", {}, adminCookie);
    assert.equal(adminSubmit.status, 403);

    // Recipient without profile cannot submit verification
    let unconfiguredRecipientCookie;
    ({ id: unconfiguredRecipientId, cookie: unconfiguredRecipientCookie } = await register(`unconfigured-${suffix}@example.test`, "RECIPIENT"));
    const noProfileAttempt = await post("/api/verification/requests", {}, unconfiguredRecipientCookie);
    assert.equal(noProfileAttempt.status, 409);
    assert.equal((await noProfileAttempt.json()).error.code, "INVALID_STATE");
  });
  await t.test("validates type-specific submission details and avoids duplicate active requests", async () => {
    assert.equal((await post("/api/verification/requests", {}, donorCookie)).status, 400);
    assert.equal((await post("/api/verification/requests", {}, driverCookie)).status, 400);
    const submitted = await post("/api/verification/requests", { organizationName: "Fresh Table Catering", additionalInfo: "Registered local food business." }, donorCookie);
    assert.equal(submitted.status, 201); const request = await submitted.json(); donorRequestId = request.id;
    assert.equal(request.participantType, "DONOR"); assert.equal(request.status, "PENDING");
    assert.equal("userId" in request, false); assert.equal("activeUserId" in request, false);
    const duplicate = await post("/api/verification/requests", { organizationName: "Fresh Table Catering" }, donorCookie);
    assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).error.code, "INVALID_STATE");
  });
  await t.test("participants can read only their own verification status and cannot review requests", async () => {
    const own = await fetch(`${baseUrl}/api/verification/me`, { headers: { cookie: donorCookie } });
    assert.equal(own.status, 200); const status = await own.json(); assert.equal(status.status, "PENDING"); assert.equal(status.request.id, donorRequestId);
    const other = await fetch(`${baseUrl}/api/verification/me`, { headers: { cookie: driverCookie } });
    assert.deepEqual(await other.json(), { status: "NOT_SUBMITTED", request: null });

    // Non-admin attempting admin list
    const adminListBlocked = await fetch(`${baseUrl}/api/verification/admin/requests`, { headers: { cookie: driverCookie } });
    assert.equal(adminListBlocked.status, 403);

    const privateRequest = await fetch(`${baseUrl}/api/verification/admin/requests/${donorRequestId}`, { headers: { cookie: driverCookie } });
    assert.equal(privateRequest.status, 403);
    const normalReview = await fetch(`${baseUrl}/api/verification/admin/requests/${donorRequestId}`, { method: "PATCH", headers: { cookie: donorCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }) });
    assert.equal(normalReview.status, 403);
  });
  await t.test("an administrator cannot review a request owned by the same account", async () => {
    const selfRequest = await prisma.verificationRequest.create({ data: { userId: adminId, activeUserId: adminId, participantType: "DONOR", status: "PENDING" } });
    const response = await fetch(`${baseUrl}/api/verification/admin/requests/${selfRequest.id}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }) });
    assert.equal(response.status, 403); assert.equal((await response.json()).error.code, "FORBIDDEN");
    await prisma.verificationRequest.delete({ where: { id: selfRequest.id } });
  });
  await t.test("admin reviews, approves, records history, and cannot repeat invalid transitions", async () => {
    const list = await fetch(`${baseUrl}/api/verification/admin/requests`, { headers: { cookie: adminCookie } });
    assert.equal(list.status, 200); assert.ok((await list.json()).some((entry) => entry.id === donorRequestId));
    const detail = await fetch(`${baseUrl}/api/verification/admin/requests/${donorRequestId}`, { headers: { cookie: adminCookie } });
    assert.equal(detail.status, 200); assert.equal((await detail.json()).applicant.email, donorEmail);

    // Invalid transition PENDING -> SUSPENDED
    const invalidSkip = await fetch(`${baseUrl}/api/verification/admin/requests/${donorRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "SUSPENDED", reason: "Direct suspension not allowed" }) });
    assert.equal(invalidSkip.status, 409);

    const review = await fetch(`${baseUrl}/api/verification/admin/requests/${donorRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "UNDER_REVIEW" }) });
    assert.equal(review.status, 200); assert.equal((await review.json()).status, "UNDER_REVIEW");
    const approved = await fetch(`${baseUrl}/api/verification/admin/requests/${donorRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }) });
    assert.equal(approved.status, 200); const result = await approved.json(); assert.equal(result.status, "VERIFIED"); assert.equal(result.records.length, 3);
    assert.equal(await isUserVerified(donorId), true);
    const invalid = await fetch(`${baseUrl}/api/verification/admin/requests/${donorRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "REJECTED", reason: "Invalid follow-up transition" }) });
    assert.equal(invalid.status, 409); assert.equal((await invalid.json()).error.code, "INVALID_STATE");
    const alreadyVerified = await post("/api/verification/requests", { organizationName: "Fresh Table Catering" }, donorCookie);
    assert.equal(alreadyVerified.status, 409);
  });
  await t.test("recipient approval synchronizes profile trust and admin can suspend", async () => {
    const submitted = await post("/api/verification/requests", { additionalInfo: "Recipient profile contains our organization information." }, recipientCookie);
    assert.equal(submitted.status, 201); recipientRequestId = (await submitted.json()).id;
    const adminDetail = await fetch(`${baseUrl}/api/verification/admin/requests/${recipientRequestId}`, { headers: { cookie: adminCookie } });
    assert.equal((await adminDetail.json()).applicant.recipientProfile.address, "55 Trust Avenue");

    // Before approval, recipient is not in discovery
    const discoveryBefore = await fetch(`${baseUrl}/api/recipients?serviceArea=Central`, { headers: { cookie: donorCookie } });
    assert.equal(discoveryBefore.status, 200);
    assert.equal((await discoveryBefore.json()).length, 0);

    const approved = await fetch(`${baseUrl}/api/verification/admin/requests/${recipientRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }) });
    assert.equal(approved.status, 200); assert.equal(await isUserVerified(recipientId), true);
    const recipientProfileStatus = await prisma.recipientProfile.findUnique({ where: { userId: recipientId }, select: { verificationStatus: true } });
    assert.equal(recipientProfileStatus.verificationStatus, "VERIFIED");

    // After approval, recipient is visible in discovery
    const discoveryAfter = await fetch(`${baseUrl}/api/recipients?serviceArea=Central`, { headers: { cookie: donorCookie } });
    assert.equal(discoveryAfter.status, 200);
    assert.equal((await discoveryAfter.json()).length, 1);

    const suspended = await fetch(`${baseUrl}/api/verification/admin/requests/${recipientRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "SUSPENDED", reason: "Repeated unsafe pickup coordination." }) });
    assert.equal(suspended.status, 200); assert.equal((await suspended.json()).status, "SUSPENDED"); assert.equal(await isUserVerified(recipientId), false);
    const updatedProfile = await prisma.recipientProfile.findUnique({ where: { userId: recipientId }, select: { verificationStatus: true } });
    assert.equal(updatedProfile.verificationStatus, "RESTRICTED");
    const selfStatus = await fetch(`${baseUrl}/api/verification/me`, { headers: { cookie: recipientCookie } });
    assert.equal((await selfStatus.json()).status, "SUSPENDED");

    // After suspension, recipient is no longer visible in discovery
    const discoverySuspended = await fetch(`${baseUrl}/api/recipients?serviceArea=Central`, { headers: { cookie: donorCookie } });
    assert.equal(discoverySuspended.status, 200);
    assert.equal((await discoverySuspended.json()).length, 0);

    // Suspended account cannot re-submit
    const suspendedResubmit = await post("/api/verification/requests", { additionalInfo: "Trying again" }, recipientCookie);
    assert.equal(suspendedResubmit.status, 409);

    // Suspended request cannot be transitioned to VERIFIED
    const suspendedToVerified = await fetch(`${baseUrl}/api/verification/admin/requests/${recipientRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "VERIFIED" }) });
    assert.equal(suspendedToVerified.status, 409);
  });
  await t.test("reject requires a reason and rejected users may resubmit", async () => {
    const submitted = await post("/api/verification/requests", { vehicleType: "VAN", additionalInfo: "Volunteer delivery vehicle." }, driverCookie);
    assert.equal(submitted.status, 201); driverRequestId = (await submitted.json()).id;

    // Missing reason
    const missingReason = await fetch(`${baseUrl}/api/verification/admin/requests/${driverRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "REJECTED" }) });
    assert.equal(missingReason.status, 400);

    // Short reason (< 10 chars)
    const shortReason = await fetch(`${baseUrl}/api/verification/admin/requests/${driverRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "REJECTED", reason: "Too short" }) });
    assert.equal(shortReason.status, 400);

    const rejected = await fetch(`${baseUrl}/api/verification/admin/requests/${driverRequestId}`, { method: "PATCH", headers: { cookie: adminCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "REJECTED", reason: "Vehicle information needs clarification." }) });
    assert.equal(rejected.status, 200);
    const status = await fetch(`${baseUrl}/api/verification/me`, { headers: { cookie: driverCookie } });
    const result = await status.json(); assert.equal(result.status, "REJECTED"); assert.match(result.request.reviewReason, /clarification/);
    const resubmitted = await post("/api/verification/requests", { vehicleType: "CAR" }, driverCookie);
    assert.equal(resubmitted.status, 201); assert.notEqual((await resubmitted.json()).id, driverRequestId);
  });
  await t.test("the reusable verified-user guard checks the persisted status", async () => {
    async function guardError(userId) {
      return new Promise((resolve) => requireVerifiedUser({ authUser: { id: userId } }, {}, (error) => resolve(error)));
    }
    assert.equal(await guardError(donorId), undefined);
    const pendingError = await guardError(driverId);
    assert.equal(pendingError.status, 403); assert.equal(pendingError.code, "VERIFICATION_REQUIRED");
    const suspendedError = await guardError(recipientId);
    assert.equal(suspendedError.code, "VERIFICATION_REQUIRED");
  });
  await t.test("existing donations flow works seamlessly alongside verification", async () => {
    const validDonation = { foodName: "Trust Veggie Bowls", category: "PREPARED_MEALS", quantity: 15, unit: "SERVINGS", expiresAt: new Date(Date.now() + 3_600_000).toISOString(), pickupAddress: "123 Trust St", pickupArea: "Central District" };
    const createDonation = await post("/api/donations", validDonation, donorCookie);
    assert.equal(createDonation.status, 201);
    const donation = await createDonation.json();
    assert.equal(donation.foodName, "Trust Veggie Bowls");
    assert.equal(donation.status, "AVAILABLE");

    const getDonation = await fetch(`${baseUrl}/api/donations/${donation.id}`, { headers: { cookie: donorCookie } });
    assert.equal(getDonation.status, 200);
  });
});
