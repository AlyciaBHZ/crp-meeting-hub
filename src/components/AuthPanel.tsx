import { LogIn, LogOut } from 'lucide-react'
import { FormEvent, useState } from 'react'

interface AuthPanelProps {
  user: { email?: string } | null
  onMagicLink: (email: string) => Promise<void>
  onSignOut: () => Promise<void> | void
}
export function AuthPanel({ user, onMagicLink, onSignOut }: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await onMagicLink(email.trim().toLowerCase())
      setMessage('Check your email for the secure sign-in link.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send the sign-in link.')
    } finally {
      setPending(false)
    }
  }

  if (user) {
    return (
      <div className="auth-member">
        <span>{user.email}</span>
        <button className="quiet-button" type="button" onClick={() => void onSignOut()} aria-label="Sign out">
          <LogOut aria-hidden="true" size={16} />
        </button>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="member-email">Email address</label>
      <input
        id="member-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="name@institution.edu"
      />
      <button className="sign-in-button" type="submit" disabled={pending}>
        <LogIn aria-hidden="true" size={16} />
        {pending ? 'Sending...' : 'Send sign-in link'}
      </button>
      {message && <p className="auth-message" role="status">{message}</p>}
    </form>
  )
}
