import { getApiBaseUrl } from '../config/api';

export function adminLogin(idToken) {
  return fetch(`${getApiBaseUrl()}/api/auth/login/admin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });
}
