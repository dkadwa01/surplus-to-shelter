import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/app.js";
import { prisma } from "../dist/config/prisma.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const donorEmail = `donation-donor-${suffix}@example.test`;
const otherEmail = `donation-other-${suffix}@example.test`;
const recipientEmail = `donation-recipient-${suffix}@example.test`;
const password = "RescueDonationTestPassword42";
let server; let baseUrl; let donorCookie; let otherCookie; let recipientCookie; let donorId; let otherId; let recipientId;
const validDonation = (overrides = {}) => ({ foodName: "Vegetable biryani", category: "PREPARED_MEALS", quantity: 35, unit: "SERVINGS", expiresAt: new Date(Date.now() + 3_600_000).toISOString(), pickupAddress: "12 Garden Street", pickupArea: "North District", description: "Packed in sealed containers", ...overrides });
async function post(path, body, cookie) { return fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); }
async function register(email, role = "DONOR", donorType = "INDIVIDUAL") {
  const response = await post("/api/auth/register", { fullName: "Donation Test", email, password, role, ...(role === "DONOR" ? { donorType } : {}) });
  assert.equal(response.status, 201);
  return { id: (await response.json()).user.id, cookie: response.headers.get("set-cookie").split(";")[0] };
}
before(async () => {
  server = app.listen(0); await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  ({ id: donorId, cookie: donorCookie } = await register(donorEmail, "DONOR", "CATERER"));
  ({ id: otherId, cookie: otherCookie } = await register(otherEmail));
  ({ id: recipientId, cookie: recipientCookie } = await register(recipientEmail, "RECIPIENT"));
});
after(async () => {
  const ids = [donorId, otherId].filter(Boolean);
  if (ids.length) await prisma.donation.deleteMany({ where: { donorId: { in: ids } } });
  await prisma.authSession.deleteMany({ where: { userId: { in: [...ids, ...(recipientId ? [recipientId] : [])] } } });
  await prisma.user.deleteMany({ where: { email: { in: [donorEmail, otherEmail, recipientEmail] } } });
  await prisma.$disconnect(); if (server) await new Promise((resolve) => server.close(resolve));
});

test("donation API enforces validation, role, ownership and lifecycle", async (t) => {
  let donationId;
  await t.test("requires an authenticated donor and rejects non-donor roles", async () => {
    assert.equal((await post("/api/donations", validDonation())).status, 401);
    const recipient = await post("/api/donations", validDonation(), recipientCookie);
    assert.equal(recipient.status, 403);
    assert.equal((await recipient.json()).error.code, "FORBIDDEN");
  });
  await t.test("validates quantities, required fields and expiry", async () => {
    const invalid = await post("/api/donations", validDonation({ quantity: 0 }), donorCookie);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_INPUT");
    const expired = await post("/api/donations", validDonation({ expiresAt: new Date(Date.now() - 10000).toISOString() }), donorCookie);
    assert.equal(expired.status, 400);
  });
  await t.test("creates a listing using the signed-in donor and profile type", async () => {
    const response = await post("/api/donations", validDonation(), donorCookie);
    assert.equal(response.status, 201);
    const donation = await response.json(); donationId = donation.id;
    assert.equal(donation.donorId, donorId);
    assert.equal(donation.donorType, "CATERER");
    assert.equal(donation.status, "AVAILABLE");
  });
  await t.test("donors list and retrieve only their own records", async () => {
    const list = await fetch(`${baseUrl}/api/donations`, { headers: { cookie: donorCookie } });
    assert.equal(list.status, 200); assert.ok((await list.json()).some((item) => item.id === donationId));
    const own = await fetch(`${baseUrl}/api/donations/${donationId}`, { headers: { cookie: donorCookie } });
    assert.equal(own.status, 200);
    const hidden = await fetch(`${baseUrl}/api/donations/${donationId}`, { headers: { cookie: otherCookie } });
    assert.equal(hidden.status, 404);
  });
  await t.test("owner can update; another donor cannot", async () => {
    const denied = await fetch(`${baseUrl}/api/donations/${donationId}`, { method: "PUT", headers: { cookie: otherCookie, "content-type": "application/json" }, body: JSON.stringify(validDonation({ foodName: "Unauthorized edit" })) });
    assert.equal(denied.status, 404);
    const updated = await fetch(`${baseUrl}/api/donations/${donationId}`, { method: "PUT", headers: { cookie: donorCookie, "content-type": "application/json" }, body: JSON.stringify(validDonation({ foodName: "Updated biryani" })) });
    assert.equal(updated.status, 200); assert.equal((await updated.json()).foodName, "Updated biryani");
  });
  await t.test("owner cancels; terminal listing cannot be edited again", async () => {
    const cancelled = await post(`/api/donations/${donationId}/cancel`, {}, donorCookie);
    assert.equal(cancelled.status, 200); assert.equal((await cancelled.json()).status, "CANCELLED");
    const update = await fetch(`${baseUrl}/api/donations/${donationId}`, { method: "PUT", headers: { cookie: donorCookie, "content-type": "application/json" }, body: JSON.stringify(validDonation()) });
    assert.equal(update.status, 409); assert.equal((await update.json()).error.code, "INVALID_STATE");
  });
  await t.test("records already past their use-by time as expired", async () => {
    const response = await post("/api/donations", validDonation(), donorCookie);
    const item = await response.json();
    await prisma.donation.update({ where: { id: item.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await fetch(`${baseUrl}/api/donations/${item.id}`, { headers: { cookie: donorCookie } });
    assert.equal((await expired.json()).status, "EXPIRED");
  });
});
