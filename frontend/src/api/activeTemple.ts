// The "active temple" an admin is currently acting on. Persisted in localStorage
// and attached to every API request as the X-Temple-Id header (see axios.ts).
const KEY = 'activeTempleId'

export function getActiveTempleId(): number | null {
  const v = localStorage.getItem(KEY)
  return v ? Number(v) : null
}

export function setActiveTempleId(id: number | null): void {
  if (id == null) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, String(id))
}
