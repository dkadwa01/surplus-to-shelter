import { z } from "zod";

export const LocationSearchQuerySchema = z.object({ query: z.string().trim().min(3).max(180) });
export const LocationSearchResultSchema = z.object({
  id: z.number().int(), address: z.string().min(1).max(240), area: z.string().max(120),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
});
export const LocationSearchResponseSchema = z.array(LocationSearchResultSchema).max(5);
export type LocationSearchResult = z.infer<typeof LocationSearchResultSchema>;
