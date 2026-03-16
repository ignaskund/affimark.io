/**
 * Product Finder Search V2 API
 * Explicit V2 route — delegates to the same handler as /api/finder/search,
 * which already proxies to the backend /api/finder/search-v2 endpoint.
 */
export { POST } from '../search/route';
