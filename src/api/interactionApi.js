import { apiFetch } from './http';

/**
 * @param {string|number} userId Kullanıcı id (path: `/api/interactions/{userId}/wishlist`).
 * GET /api/interactions/{userId}/wishlist — beğenilen ürünler (paged, ProductSearchResultDto).
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/controller/InteractionController.java
 */
export async function getUserWishlist(
  userId,
  { page = 0, size = 50, signal } = {}
) {
  const qs = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  return apiFetch(
    `/api/interactions/${encodeURIComponent(String(userId))}/wishlist?${qs.toString()}`,
    {
      method: 'GET',
      signal,
      forceIdTokenRefresh: true,
    }
  );
}
