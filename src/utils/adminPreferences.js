const STORAGE_KEY = 'favo.admin.preferences.v1';

const DEFAULTS = {
  tablePageSize: 15,
};

/** @type {number[]} */
export const TABLE_PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(partial) {
  const next = { ...read(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getTablePageSize() {
  const n = Number(read().tablePageSize);
  return TABLE_PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULTS.tablePageSize;
}

/**
 * @param {number} size
 */
export function setTablePageSize(size) {
  const n = Number(size);
  if (!TABLE_PAGE_SIZE_OPTIONS.includes(n)) return;
  write({ tablePageSize: n });
}
