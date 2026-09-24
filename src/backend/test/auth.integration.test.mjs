import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../dist/app.js";
import { prisma } from "../dist/config/prisma.js";
import { requireRole } from "../dist/middleware/auth.middleware.js";

const testEmail = `auth-test-${Date.now()}@example.test`;
const testPassword = "RescueTestPassphrase42";
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  const user = await prisma.user.findUnique({ where: { email: testEmail } });
  if (user) {
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function post(path, body, cookie) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function responseJson(response) {
  return response.json();
}

test("registration, duplicate prevention, login, and protected session", async (t) => {
  await t.test("rejects invalid password and invalid phone", async () => {
    const invalid = await post("/api/auth/register", {
      fullName: "Test Donor", email: testEmail, phone: "not-a-phone", password: "short", role: "DONOR",
    });
    assert.equal(invalid.status, 400);
    assert.equal((await responseJson(invalid)).error.code, "INVALID_INPUT");
  });

  await t.test("registers a user without exposing password material", async () => {
    const response = await post("/api/auth/register", {
      fullName: "Test Donor", email: testEmail.toUpperCase(), phone: "+14155552671", password: testPassword, role: "DONOR",
    });
    assert.equal(response.status, 201);
    const result = await responseJson(response);
    assert.equal(result.user.email, testEmail);
    assert.equal(result.user.role, "DONOR");
    assert.equal("password" in result.user, false);
    assert.equal("passwordHash" in result.user, false);
    const stored = await prisma.user.findUnique({ where: { email: testEmail }, select: { passwordHash: true } });
    assert.ok(stored?.passwordHash.startsWith("scrypt$32768$8$1$"));
    assert.notEqual(stored?.passwordHash, testPassword);
    const token = response.headers.get("set-cookie")?.split(";")[0]?.split("=")[1];
    const session = await prisma.authSession.findFirst({ where: { userId: result.user.id } });
    assert.ok(session?.tokenHash);
    assert.notEqual(session?.tokenHash, token);
    assert.match(response.headers.get("set-cookie") ?? "", /^s2s_session=.*HttpOnly/);
  });

  await t.test("rejects duplicate registration", async () => {
    const response = await post("/api/auth/register", {
      fullName: "Test Donor", email: testEmail, password: testPassword, role: "DONOR",
    });
    assert.equal(response.status, 409);
    assert.equal((await responseJson(response)).error.code, "DUPLICATE_ACCOUNT");
  });

  await t.test("prevents public administrator registration", async () => {
    const response = await post("/api/auth/register", {
      fullName: "Test Admin", email: `admin-${testEmail}`, password: testPassword, role: "ADMIN",
    });
    assert.equal(response.status, 400);
    assert.equal((await responseJson(response)).error.code, "INVALID_INPUT");
  });

  await t.test("rejects invalid credentials and logs in valid credentials", async () => {
    const wrong = await post("/api/auth/login", { email: testEmail, password: "IncorrectPassword123" });
    assert.equal(wrong.status, 401);
    assert.equal((await responseJson(wrong)).error.code, "INVALID_CREDENTIALS");
    const valid = await post("/api/auth/login", { email: testEmail.toUpperCase(), password: testPassword });
    assert.equal(valid.status, 200);
    const result = await responseJson(valid);
    assert.equal(result.user.email, testEmail);
    assert.equal("passwordHash" in result.user, false);
  });

  await t.test("protects current-user endpoint and accepts the session cookie", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(unauthenticated.status, 401);
    assert.equal((await responseJson(unauthenticated)).error.code, "UNAUTHORIZED");
    const login = await post("/api/auth/login", { email: testEmail, password: testPassword });
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    const authenticated = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(authenticated.status, 200);
    assert.equal((await responseJson(authenticated)).user.email, testEmail);
    const logout = await post("/api/auth/logout", {}, cookie);
    assert.equal(logout.status, 204);
    const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(afterLogout.status, 401);
  });
});

test("requireRole allows only configured roles", () => {
  function runMiddleware(role) {
    const request = { authUser: { role } };
    const response = {
      statusCode: 200,
      payload: undefined,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };
    let nextError;
    requireRole("ADMIN")(request, response, (error) => { nextError = error; });
    return { response, nextError };
  }
  const donor = runMiddleware("DONOR");
  assert.equal(donor.nextError?.status, 403);
  assert.equal(donor.nextError?.code, "FORBIDDEN");
  const admin = runMiddleware("ADMIN");
  assert.equal(admin.nextError, undefined);
});
