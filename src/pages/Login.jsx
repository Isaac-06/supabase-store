import { useState } from 'react'
import {
  getAuthRedirectUrl,
  getSupabaseConfigError,
  isSupabaseConfigured,
  setRememberSession,
  supabase,
} from '../supabase.js'

function Login({ onAuthenticated, isPasswordRecovery = false, onPasswordUpdated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isResetRequest, setIsResetRequest] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    if (!isSupabaseConfigured) {
      setMessage(getSupabaseConfigError())
      return
    }
    const trimmedEmail = email.trim()
    const errors = {}

    if (!trimmedEmail) {
      errors.email = 'Enter your email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address, such as name@example.com.'
    }
    if (!password) errors.password = 'Enter your password.'

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)

    try {
      setRememberSession(rememberMe)
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })

      if (error) {
        setMessage(error.message)
      } else {
        onAuthenticated(data.user)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetRequest(event) {
    event.preventDefault()
    setMessage('')
    if (!isSupabaseConfigured) {
      setMessage(getSupabaseConfigError())
      return
    }
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
    if (!isSupabaseConfigured) {
      setMessage(getSupabaseConfigError())
      return
    }

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
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'login-email-error' : undefined} />
        {fieldErrors.email && <span className="auth-field-error" id="login-email-error">{fieldErrors.email}</span>}
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} />
        {fieldErrors.password && <span className="auth-field-error" id="login-password-error">{fieldErrors.password}</span>}
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