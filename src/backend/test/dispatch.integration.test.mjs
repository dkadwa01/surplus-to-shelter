import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/app.js";
import { prisma } from "../dist/config/prisma.js";
import { hashPassword } from "../dist/modules/auth/crypto.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = "DispatchIntegrationPass579!";
const emails = ["donor", "recipient", "driver-one", "driver-two", "unverified", "outsider", "admin"].map((name) => `dispatch-${name}-${suffix}@example.test`);
let server; let baseUrl; let donor; let recipient; let driverOne; let driverTwo; let unverified; let outsider; let admin; let recipientProfileId;
const future = (hours = 30) => new Date(Date.now() + hours * 3_600_000).toISOString();
async function request(method, path, cookie, body) {
  return fetch(`${baseUrl}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function register(email, role) {
  const response = await request("POST", "/api/auth/register", null, { fullName: "Dispatch Test User", email, password, role });
  assert.equal(response.status, 201);
  return { id: (await response.json()).user.id, cookie: response.headers.get("set-cookie").split(";")[0] };
}
async function verify(user, driver = false) {
  const submitted = await request("POST", "/api/verification/requests", user.cookie, driver ? { vehicleType: "VAN" } : {});
  assert.equal(submitted.status, 201);
  const { id } = await submitted.json();
  const reviewed = await request("PATCH", `/api/verification/admin/requests/${id}`, admin.cookie, { action: "VERIFIED" });
  assert.equal(reviewed.status, 200);
}
async function createDriverProfile(user, setAvailable = true) {
  const response = await request("PUT", "/api/dispatch/drivers/profile", user.cookie, { vehicleType: "Van", capacityQuantity: 100, capacityUnit: "KG", serviceArea: "Dispatch District" });
  assert.equal(response.status, 200);
  if (setAvailable) {
    const available = await request("PATCH", "/api/dispatch/drivers/availability", user.cookie, { availability: "AVAILABLE" });
    assert.equal(available.status, 200);
  }
}
before(async () => {
  server = app.listen(0); await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); }); baseUrl = `http://127.0.0.1:${server.address().port}`;
  donor = await register(emails[0], "DONOR"); recipient = await register(emails[1], "RECIPIENT");
  driverOne = await register(emails[2], "DRIVER"); driverTwo = await register(emails[3], "DRIVER"); unverified = await register(emails[4], "DRIVER"); outsider = await register(emails[5], "DONOR");
  const adminRow = await prisma.user.create({ data: { fullName: "Dispatch Test Admin", email: emails[6], passwordHash: await hashPassword(password), role: "ADMIN" } });
  const adminLogin = await request("POST", "/api/auth/login", null, { email: emails[6], password }); admin = { id: adminRow.id, cookie: adminLogin.headers.get("set-cookie").split(";")[0] };
  const profile = await request("POST", "/api/recipients", recipient.cookie, { organizationName: "Dispatch Test Shelter", recipientType: "SHELTER", address: "12 Shelter Street", serviceArea: "Dispatch District", acceptedCategories: ["PRODUCE"], capacityQuantity: 80, capacityUnit: "KG", isActive: true, isAcceptingDonations: true });
  assert.equal(profile.status, 201); recipientProfileId = (await profile.json()).id;
  await verify(donor); await verify(recipient); await verify(driverOne, true); await verify(driverTwo, true);
  await createDriverProfile(driverOne); await createDriverProfile(driverTwo);
  await createDriverProfile(unverified, false);
  assert.equal((await request("PATCH", "/api/dispatch/drivers/availability", unverified.cookie, { availability: "AVAILABLE" })).status, 403);
});
after(async () => {
  const ids = [donor?.id, recipient?.id, driverOne?.id, driverTwo?.id, unverified?.id, outsider?.id, admin?.id].filter(Boolean);
  if (ids.length) {
    await prisma.dispatchAssignment.deleteMany({ where: { OR: [{ createdById: { in: ids } }, { assignedDriverId: { in: ids } }, { recipientProfile: { userId: { in: ids } } }] } });
    await prisma.communityContribution.deleteMany({ where: { OR: [{ contributorId: { in: ids } }, { communityDonation: { creatorId: { in: ids } } }] } });
    await prisma.communityDonation.deleteMany({ where: { creatorId: { in: ids } } });
    await prisma.donation.deleteMany({ where: { donorId: { in: ids } } });
    await prisma.driverProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.recipientProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.verificationRequest.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect(); if (server) await new Promise((resolve) => server.close(resolve));
});

test("dispatch reserves matched food, enforces driver trust and ownership, and completes lifecycle", async () => {
  const donation = await request("POST", "/api/donations", donor.cookie, { foodName: "Fresh produce", category: "PRODUCE", quantity: 12, unit: "KG", expiresAt: future(), pickupAddress: "4 Market Road", pickupArea: "Dispatch District" });
  assert.equal(donation.status, 201); const donationId = (await donation.json()).id;
  const assignmentResponse = await request("POST", "/api/dispatch", donor.cookie, { sourceType: "DONATION", sourceId: donationId, recipientProfileId });
  assert.equal(assignmentResponse.status, 201); const assignment = await assignmentResponse.json();
  assert.equal((await prisma.donation.findUnique({ where: { id: donationId } })).status, "RESERVED");
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/accept`, unverified.cookie)).status, 403);
  assert.equal((await request("GET", `/api/dispatch/${assignment.id}`, outsider.cookie)).status, 404);
  assert.equal((await request("GET", "/api/dispatch/available", driverOne.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/accept`, driverOne.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/pickup/confirm`, driverOne.cookie)).status, 409);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/accept`, driverTwo.cookie)).status, 409);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/pickup/start`, driverTwo.cookie)).status, 404);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/pickup/start`, driverOne.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/pickup/confirm`, driverOne.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/transit/start`, driverOne.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/delivery/confirm`, driverOne.cookie)).status, 200);
  assert.equal((await prisma.donation.findUnique({ where: { id: donationId } })).status, "DELIVERED");
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/complete`, driverOne.cookie)).status, 200);
  assert.equal((await prisma.driverProfile.findUnique({ where: { userId: driverOne.id } })).availability, "AVAILABLE");
});

test("declining releases an assignment for a second driver; unavailable sources cannot duplicate", async () => {
  const donation = await request("POST", "/api/donations", donor.cookie, { foodName: "Seasonal produce", category: "PRODUCE", quantity: 5, unit: "KG", expiresAt: future(), pickupAddress: "4 Market Road", pickupArea: "Dispatch District" });
  const donationId = (await donation.json()).id;
  const created = await request("POST", "/api/dispatch", donor.cookie, { sourceType: "DONATION", sourceId: donationId, recipientProfileId });
  const assignment = await created.json();
  assert.equal((await request("POST", "/api/dispatch", donor.cookie, { sourceType: "DONATION", sourceId: donationId, recipientProfileId })).status, 409);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/accept`, driverOne.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/decline`, driverOne.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/accept`, driverTwo.cookie)).status, 200);
  assert.equal((await request("POST", `/api/dispatch/${assignment.id}/cancel`, donor.cookie)).status, 200);
  assert.equal((await prisma.donation.findUnique({ where: { id: donationId } })).status, "AVAILABLE");

  const cancelled = await request("POST", "/api/donations", donor.cookie, { foodName: "Cancelled vegetables", category: "PRODUCE", quantity: 4, unit: "KG", expiresAt: future(), pickupAddress: "4 Market Road", pickupArea: "Dispatch District" });
  const cancelledId = (await cancelled.json()).id;
  assert.equal((await request("POST", `/api/donations/${cancelledId}/cancel`, donor.cookie)).status, 200);
  assert.equal((await request("POST", "/api/dispatch", donor.cookie, { sourceType: "DONATION", sourceId: cancelledId, recipientProfileId })).status, 409);
});

test("community contributions use the same match and dispatch workflow", async () => {
  const group = await prisma.communityDonation.create({ data: { creatorId: donor.id, title: "Neighborhood food collection", pickupArea: "Dispatch District", deadline: new Date(future()), status: "CLOSED" } });
  const contribution = await prisma.communityContribution.create({ data: { communityDonationId: group.id, contributorId: donor.id, foodName: "Community vegetables", category: "PRODUCE", quantity: 9, unit: "KG", expiresAt: new Date(future()) } });
  const response = await request("POST", "/api/dispatch", donor.cookie, { sourceType: "COMMUNITY_CONTRIBUTION", sourceId: contribution.id, recipientProfileId });
  assert.equal(response.status, 201); assert.equal((await prisma.communityContribution.findUnique({ where: { id: contribution.id } })).status, "RESERVED");
});
