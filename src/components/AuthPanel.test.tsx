import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthPanel } from './AuthPanel'

describe('AuthPanel', () => {
  it('sends a magic link to a valid member email', async () => {
    const signIn = vi.fn(() => Promise.resolve())
    render(<AuthPanel user={null} onMagicLink={signIn} onSignOut={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Email address'), 'member@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))

    expect(signIn).toHaveBeenCalledWith('member@example.com')
    expect(await screen.findByText('Check your email for the secure sign-in link.')).toBeInTheDocument()
  })

  it('shows the signed-in member and sign-out command', () => {
    render(<AuthPanel user={{ email: 'member@example.com' }} onMagicLink={vi.fn()} onSignOut={vi.fn()} />)
    expect(screen.getByText('member@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
