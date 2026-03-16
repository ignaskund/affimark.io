/**
 * Supabase fetch with exponential backoff retry.
 * Retries on transient network errors and 5xx responses.
 * Up to 3 attempts: immediate → 1s → 2s.
 */
export async function supabaseFetch(
  url: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  const DELAYS = [0, 1000, 2000]; // ms before each attempt

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (DELAYS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, DELAYS[attempt]));
    }
    try {
      const res = await fetch(url, options);
      // Retry on server errors only (5xx). Client errors (4xx) are final.
      if (res.status >= 500 && attempt < maxAttempts - 1) {
        console.warn(`[supabaseFetch] ${res.status} on attempt ${attempt + 1}, retrying...`);
        lastError = new Error(`Supabase returned ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        console.warn(`[supabaseFetch] Network error on attempt ${attempt + 1}, retrying...`, err);
      }
    }
  }
  throw lastError;
}
