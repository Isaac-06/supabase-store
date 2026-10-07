import { useState } from 'react'
import { getAuthRedirectUrl, setRememberSession, supabase } from '../supabase.js'

function Login({ onAuthenticated, isPasswordRecovery = false, onPasswordUpdated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isResetRequest, setIsResetRequest] = useState(false)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    setRememberSession(rememberMe)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setIsSubmitting(false)

    if (error) {
      setMessage(error.message)
    } else {
      onAuthenticated(data.user)
    }
  }

  async function handleResetRequest(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl(),
    })
    setIsSubmitting(false)
    setMessage(error ? error.message : 'Check your email for a password reset link.')
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault()
    setMessage('')

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Your password has been updated.')
      onPasswordUpdated()
    }
  }

  if (isPasswordRecovery) {
    return (
      <section className="auth-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        <form className="auth-form" onSubmit={handlePasswordUpdate}>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          <label htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
          <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'}</button>
        </form>
        {message && <p className="auth-message" role="alert">{message}</p>}
      </section>
    )
  }

  if (isResetRequest) {
    return (
      <section className="auth-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password</h1>
        <form className="auth-form" onSubmit={handleResetRequest}>
          <label htmlFor="reset-email">Email</label>
          <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send reset link'}</button>
        </form>
        <button className="text-btn" type="button" onClick={() => { setIsResetRequest(false); setMessage('') }}>Back to sign in</button>
        {message && <p className="auth-message" role={message.startsWith('Check your email') ? 'status' : 'alert'}>{message}</p>}
      </section>
    )
  }

  return (
    <section className="auth-panel">
      <p className="eyebrow">Welcome back</p>
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <div className="login-options">
          <label className="remember-option" htmlFor="remember-me">
            <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Remember me
          </label>
          <button className="text-btn" type="button" onClick={() => { setIsResetRequest(true); setMessage('') }}>Forgot password?</button>
        </div>
        <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
      {message && <p className="auth-message" role="alert">{message}</p>}
    </section>
  )
}

export default Login