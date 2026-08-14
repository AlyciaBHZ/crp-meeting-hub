import { KeyRound, LogIn, LogOut, Mail } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { displayLoginIdentity } from '../services/loginIdentity'

interface AuthPanelProps {
  user: { email?: string } | null
  needsPasswordSetup: boolean
  onPasswordSignIn: (email: string, password: string) => Promise<void>
  onPasswordLink: (email: string) => Promise<void>
  onPasswordUpdate: (password: string) => Promise<void>
  onSignOut: () => Promise<void> | void
}

export function AuthPanel({
  user,
  needsPasswordSetup,
  onPasswordSignIn,
  onPasswordLink,
  onPasswordUpdate,
  onSignOut,
}: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<'sign-in' | 'link' | 'password' | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setPending('sign-in')
    setMessage(null)
    try {
      await onPasswordSignIn(email.trim().toLowerCase(), password)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in.')
    } finally {
      setPending(null)
    }
  }

  async function sendPasswordLink() {
    if (!email.trim()) {
      setMessage('Enter your approved email address first.')
      return
    }
    setPending('link')
    setMessage(null)
    try {
      await onPasswordLink(email.trim().toLowerCase())
      setMessage('Check your email to continue password setup.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send the password link.')
    } finally {
      setPending(null)
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    setPending('password')
    setMessage(null)
    try {
      await onPasswordUpdate(password)
      setPassword('')
      setChangingPassword(false)
      setMessage('Password saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the password.')
    } finally {
      setPending(null)
    }
  }

  if (user && (needsPasswordSetup || changingPassword)) {
    return (
      <form className="password-form" onSubmit={savePassword}>
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="sign-in-button" type="submit" disabled={pending !== null}>
          <KeyRound aria-hidden="true" size={16} /> {pending === 'password' ? 'Saving...' : 'Save password'}
        </button>
        {!needsPasswordSetup && (
          <button className="text-button" type="button" onClick={() => setChangingPassword(false)}>Cancel</button>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}
      </form>
    )
  }

  if (user) {
    return (
      <div className="auth-member">
        <span>{displayLoginIdentity(user.email)}</span>
        <button className="quiet-button" type="button" onClick={() => setChangingPassword(true)} aria-label="Change password">
          <KeyRound aria-hidden="true" size={16} />
        </button>
        <button className="quiet-button" type="button" onClick={() => void onSignOut()} aria-label="Sign out">
          <LogOut aria-hidden="true" size={16} />
        </button>
        {message && <p className="auth-message" role="status">{message}</p>}
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={signIn}>
      <label htmlFor="member-email">Username or email</label>
      <input
        id="member-email"
        type="text"
        required
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Username or email"
      />
      <label htmlFor="member-password">Password</label>
      <input
        id="member-password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="sign-in-button" type="submit" disabled={pending !== null}>
        <LogIn aria-hidden="true" size={16} /> {pending === 'sign-in' ? 'Signing in...' : 'Sign in'}
      </button>
      <button className="password-link-button" type="button" disabled={pending !== null} onClick={() => void sendPasswordLink()}>
        <Mail aria-hidden="true" size={15} /> {pending === 'link' ? 'Sending...' : 'Set up or reset password'}
      </button>
      {message && <p className="auth-message" role="status">{message}</p>}
    </form>
  )
}
