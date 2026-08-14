import { describe, expect, it } from 'vitest'
import { displayLoginIdentity, isSharedLogin, resolveLoginIdentity } from './loginIdentity'

describe('shared login identities', () => {
  it('maps shared usernames to internal Supabase email identities', () => {
    expect(resolveLoginIdentity(' CRPGrant ')).toBe('crpgrant@crp-meeting-hub.invalid')
    expect(resolveLoginIdentity('ADMIN')).toBe('admin@crp-meeting-hub.invalid')
  })

  it('keeps personal email sign-in available', () => {
    expect(resolveLoginIdentity(' Member@Example.com ')).toBe('member@example.com')
  })

  it('identifies accounts whose passwords are centrally managed', () => {
    expect(isSharedLogin('crpgrant')).toBe(true)
    expect(isSharedLogin('admin')).toBe(true)
    expect(isSharedLogin('member@example.com')).toBe(false)
  })

  it('does not treat inherited object property names as shared usernames', () => {
    expect(isSharedLogin('constructor')).toBe(false)
    expect(resolveLoginIdentity('constructor')).toBe('constructor')
  })

  it('shows shared usernames instead of internal email identities', () => {
    expect(displayLoginIdentity('crpgrant@crp-meeting-hub.invalid')).toBe('crpgrant')
    expect(displayLoginIdentity('admin@crp-meeting-hub.invalid')).toBe('admin')
    expect(displayLoginIdentity('member@example.com')).toBe('member@example.com')
  })
})
