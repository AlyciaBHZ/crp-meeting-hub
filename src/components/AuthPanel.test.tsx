import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthPanel } from './AuthPanel'

const baseProps = {
  onPasswordSignIn: vi.fn(() => Promise.resolve()),
  onPasswordLink: vi.fn(() => Promise.resolve()),
  onPasswordUpdate: vi.fn(() => Promise.resolve()),
  onSignOut: vi.fn(),
}

describe('AuthPanel', () => {
  it('signs in with an approved email and password', async () => {
    const onPasswordSignIn = vi.fn(() => Promise.resolve())
    render(<AuthPanel {...baseProps} user={null} needsPasswordSetup={false} onPasswordSignIn={onPasswordSignIn} />)

    await userEvent.type(screen.getByLabelText('Username or email'), 'Member@Example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery staple')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(onPasswordSignIn).toHaveBeenCalledWith('member@example.com', 'correct horse battery staple')
  })

  it('accepts the shared member username', async () => {
    const onPasswordSignIn = vi.fn(() => Promise.resolve())
    render(<AuthPanel {...baseProps} user={null} needsPasswordSetup={false} onPasswordSignIn={onPasswordSignIn} />)

    await userEvent.type(screen.getByLabelText('Username or email'), 'crpgrant')
    await userEvent.type(screen.getByLabelText('Password'), 'shared password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(onPasswordSignIn).toHaveBeenCalledWith('crpgrant', 'shared password')
  })

  it('sends a setup or reset link to the entered email', async () => {
    const onPasswordLink = vi.fn(() => Promise.resolve())
    render(<AuthPanel {...baseProps} user={null} needsPasswordSetup={false} onPasswordLink={onPasswordLink} />)

    await userEvent.type(screen.getByLabelText('Username or email'), 'member@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Set up or reset password' }))

    expect(onPasswordLink).toHaveBeenCalledWith('member@example.com')
    expect(await screen.findByText('Check your email to continue password setup.')).toBeInTheDocument()
  })

  it('sets a new password after the member opens the email link', async () => {
    const onPasswordUpdate = vi.fn(() => Promise.resolve())
    render(<AuthPanel {...baseProps} user={{ email: 'member@example.com' }} needsPasswordSetup onPasswordUpdate={onPasswordUpdate} />)

    await userEvent.type(screen.getByLabelText('New password'), 'a secure password')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))

    expect(onPasswordUpdate).toHaveBeenCalledWith('a secure password')
    expect(await screen.findByText('Password saved.')).toBeInTheDocument()
  })

  it('shows the signed-in member and account commands', () => {
    render(<AuthPanel {...baseProps} user={{ email: 'member@example.com' }} needsPasswordSetup={false} />)
    expect(screen.getByText('member@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
