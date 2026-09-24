import { ApiErrorResponseSchema, AuthResponseSchema, LoginRequestSchema, RegistrationRequestSchema, type ApiErrorResponse, type AuthResponse, type LoginRequest, type RegistrationRequest } from "@surplus/shared";

export class AuthApiError extends Error {
  constructor(public readonly code: ApiErrorResponse["error"]["code"], message: string) {
    super(message);
    this.name = "AuthApiError";
  }
}

async function authRequest(path: string, body?: unknown): Promise<AuthResponse> {
  const response = await fetch(`/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorResponseSchema.safeParse(payload);
    throw error.success
      ? new AuthApiError(error.data.error.code, error.data.error.message)
      : new Error("The request could not be completed.");
  }
  return AuthResponseSchema.parse(payload);
}

export async function register(input: RegistrationRequest) {
  return authRequest("/register", RegistrationRequestSchema.parse(input));
}
export async function login(input: LoginRequest) {
  return authRequest("/login", LoginRequestSchema.parse(input));
}
export async function currentUser() {
  try {
    return (await authRequest("/me")).user;
  } catch (error) {
    if (error instanceof AuthApiError && error.code === "UNAUTHORIZED") return null;
    throw error;
  }
}
export async function logout() {
  const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  if (!response.ok) throw new Error("Unable to sign out. Please try again.");
}
