// Store format: +91XXXXXXXXXX (E.164)
// Display format: +91 XXXXX XXXXX (standard Indian 5+5 split)

export function formatPhone(e164: string): string {
  if (!e164?.startsWith('+91') || e164.length !== 13) return e164 ?? '—'
  const d = e164.slice(3)
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
}

export function toE164(tenDigits: string): string {
  const digits = tenDigits.replace(/\D/g, '').slice(0, 10)
  return digits.length === 10 ? `+91${digits}` : ''
}

export function fromE164(e164: string): string {
  return e164?.startsWith('+91') ? e164.slice(3) : (e164 ?? '')
}
