const sharedLogins = {
  crpgrant: 'crpgrant@crp-meeting-hub.invalid',
  admin: 'admin@crp-meeting-hub.invalid',
} as const

function hasSharedLogin(identity: string): identity is keyof typeof sharedLogins {
  return Object.prototype.hasOwnProperty.call(sharedLogins, identity)
}

export function isSharedLogin(identity: string): boolean {
  return hasSharedLogin(identity.trim().toLowerCase())
}

export function resolveLoginIdentity(identity: string): string {
  const normalized = identity.trim().toLowerCase()
  return hasSharedLogin(normalized) ? sharedLogins[normalized] : normalized
}

export function displayLoginIdentity(email?: string): string {
  const normalized = email?.trim().toLowerCase() ?? ''
  const sharedUsername = Object.entries(sharedLogins).find(([, sharedEmail]) => sharedEmail === normalized)?.[0]
  return sharedUsername ?? normalized
}
