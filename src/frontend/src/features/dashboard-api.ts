import { ApiErrorResponseSchema, DashboardSummarySchema } from "@surplus/shared";
export async function getDashboardSummary() {
  const response = await fetch("/api/dashboard/summary", { credentials: "include" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorResponseSchema.safeParse(body);
    throw new Error(error.success ? error.data.error.message : "Unable to load dashboard data.");
  }
  return DashboardSummarySchema.parse(body);
}
