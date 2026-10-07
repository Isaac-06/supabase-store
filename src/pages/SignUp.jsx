import { useState } from 'react'
import { getAuthRedirectUrl, supabase } from '../supabase.js'

function SignUp({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    })
    setIsSubmitting(false)

    if (error) {
      setMessage(error.message)
    } else if (data.session) {
      onAuthenticated(data.session.user)
    } else {
      setMessage('Check your email to confirm your account, then sign in.')
    }
  }

  return (
    <section className="auth-panel">
      <p className="eyebrow">Create your account</p>
      <h1>Join NeonCart</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="signup-email">Email</label>
        <input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Sign up'}</button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}
    </section>
  )
}

export default SignUp