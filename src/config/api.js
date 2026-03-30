/** Empty in dev → same-origin `/api` (Vite proxy). Else full API origin, no trailing slash. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}
