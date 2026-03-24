/**
 * Thin fetch wrapper that automatically attaches the x-business-id header
 * required by every API route. Import and use instead of raw fetch() in all
 * client components so the header is never accidentally omitted.
 */
const BIZ_ID = process.env.NEXT_PUBLIC_BUSINESS_ID!;

export function bizFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "x-business-id": BIZ_ID,
      ...init?.headers,
    },
  });
}
