/** @returns {'active' | 'suspend' | 'unknown'} */
export function toStatusKind(user) {
  const active =
    user?.active ?? user?.isActive ?? user?.is_active ?? user?.accountActive ?? user?.account_active;
  if (active === true || active === 'true' || active === 1) return 'active';
  if (active === false || active === 'false' || active === 0) return 'suspend';

  const enabled = user?.enabled ?? user?.isEnabled ?? user?.is_enabled;
  if (enabled === false || enabled === 'false' || enabled === 0) return 'suspend';

  const statusRaw = user?.status ?? user?.accountStatus ?? user?.account_status;
  if (typeof statusRaw === 'string') {
    const s = statusRaw.trim().toLowerCase();
    if (s === 'active' || s === 'enabled' || s === 'activated') return 'active';
    if (
      s === 'inactive' ||
      s === 'suspended' ||
      s === 'disabled' ||
      s === 'deactivated' ||
      s === 'deactivate'
    ) {
      return 'suspend';
    }
  }

  return 'unknown';
}

export function statusLabelFromKind(kind) {
  if (kind === 'active') return 'Active';
  if (kind === 'suspend') return 'Suspended';
  return '—';
}

export function toUsernameLabel(user) {
  const raw = user?.userName ?? user?.username ?? user?.handle ?? user?.name;
  if (!raw) return '—';
  return String(raw).startsWith('@') ? String(raw) : `@${raw}`;
}

export function toEmailLabel(user) {
  const raw = user?.email ?? user?.mail;
  return raw ? String(raw) : '—';
}

/**
 * @param {object} u
 * @param {number} idx
 * @param {number} page
 */
export function mapAdminUserDtoToTableRow(u, idx, page) {
  const idRaw = u?.id ?? u?.userId ?? u?.uid ?? `${page}-${idx}`;
  const statusKind = toStatusKind(u);
  return {
    id: String(idRaw),
    username: toUsernameLabel(u),
    email: toEmailLabel(u),
    statusKind,
    statusLabel: statusLabelFromKind(statusKind),
  };
}
