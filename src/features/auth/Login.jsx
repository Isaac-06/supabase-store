import { useState } from 'react'
import {
  getAuthRedirectUrl,
  getSupabaseConfigError,
  isSupabaseConfigured,
  setRememberSession,
  supabase,
} from '../../shared/services/supabase.js'
import PasswordVisibilityToggle from './PasswordVisibilityToggle.jsx'

function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isResetRequest, setIsResetRequest] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setFieldErrors({})
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
  console.error("Login error:", error)
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

    const trimmedEmail = email.trim()
    const errors = {}
    if (!trimmedEmail) {
      errors.email = 'Enter your email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address, such as name@example.com.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)

    try {
      const redirectTo = new URL('/reset-password', getAuthRedirectUrl()).toString()
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      })

      setMessage(error
        ? error.message
        : 'If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send a password reset link. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isResetRequest) {
    return (
      <section className="auth-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password</h1>
        <form className="auth-form" onSubmit={handleResetRequest} noValidate>
          <label htmlFor="reset-email">Email</label>
          <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'reset-email-error' : undefined} />
          {fieldErrors.email && <span className="auth-field-error" id="reset-email-error">{fieldErrors.email}</span>}
          <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send reset link'}</button>
        </form>
        <button className="text-btn" type="button" onClick={() => { setIsResetRequest(false); setMessage(''); setFieldErrors({}) }}>Back to sign in</button>
        {message && <p className="auth-message" role={message.startsWith('If an account exists') ? 'status' : 'alert'}>{message}</p>}
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
        <div className="auth-password-field">
          <input id="login-password" type={isPasswordVisible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} />
          <PasswordVisibilityToggle
            isVisible={isPasswordVisible}
            onToggle={() => setIsPasswordVisible((visible) => !visible)}
            hiddenLabel="Show password"
            visibleLabel="Hide password"
          />
        </div>
        {fieldErrors.password && <span className="auth-field-error" id="login-password-error">{fieldErrors.password}</span>}
        <div className="login-options">
          <label className="remember-option" htmlFor="remember-me">
            <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Remember me
          </label>
          <button className="text-btn" type="button" onClick={() => { setIsResetRequest(true); setMessage(''); setFieldErrors({}) }}>Forgot password?</button>
        </div>
        <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
      </form>
      {message && <p className="auth-message" role="alert">{message}</p>}
    </section>
  )
}

export default Login