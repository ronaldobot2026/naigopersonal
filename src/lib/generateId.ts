/**
 * Gera um UUID v4.
 * Usa `crypto.randomUUID()` quando disponível (HTTPS / localhost seguro).
 * Em contextos HTTP inseguros (iOS Safari, por exemplo), cai para uma
 * implementação baseada em `Math.random` + `crypto.getRandomValues` quando
 * disponível — segura o suficiente para IDs de sessão e rascunhos locais.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Polyfill RFC 4122 v4
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
