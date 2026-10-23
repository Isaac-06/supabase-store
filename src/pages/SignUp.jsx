import { useState } from 'react'
import {
  getAuthRedirectUrl,
  getSupabaseConfigError,
  isSupabaseConfigured,
  supabase,
} from '../supabase.js'

function SignUp({ onAuthenticated }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageRole, setMessageRole] = useState('alert')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setMessageRole('alert')
    if (!isSupabaseConfigured) {
      setMessage(getSupabaseConfigError())
      return
    }

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const phoneDigits = trimmedPhone.replace(/\D/g, '')
    const trimmedEmail = email.trim()
    const errors = {}

    if (!trimmedName) {
      errors.name = 'Enter your name.'
    }

    if (!/^[+()\d\s.-]+$/.test(trimmedPhone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.phone = 'Enter a phone number with 7 to 15 digits.'
    }

    if (!trimmedEmail) {
      errors.email = 'Enter your email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address, such as name@example.com.'
    }

    if (!password) {
      errors.password = 'Create a password.'
    } else if (password.length < 6) {
      errors.password = 'Your password must be at least 6 characters.'
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your password.'
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: { name: trimmedName, phone: trimmedPhone },
        },
      })

      if (error) {
        setMessage(error.message)
      } else if (data.session) {
        onAuthenticated(data.session.user)
      } else {
        setMessageRole('status')
        setMessage('Check your email to confirm your account, then sign in.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-panel">
      <p className="eyebrow">Create your account</p>
      <h1>Join NeonCart</h1>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="signup-name">Name</label>
        <input id="signup-name" type="text" autoComplete="name" maxLength={120} value={name} onChange={(event) => { setName(event.target.value); setFieldErrors((current) => ({ ...current, name: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'signup-name-error' : undefined} />
        {fieldErrors.name && <span className="auth-field-error" id="signup-name-error">{fieldErrors.name}</span>}
        <label htmlFor="signup-phone">Phone number</label>
        <input id="signup-phone" type="tel" autoComplete="tel" inputMode="tel" aria-describedby={fieldErrors.phone ? 'signup-phone-error' : 'signup-phone-hint'} value={phone} onChange={(event) => { setPhone(event.target.value); setFieldErrors((current) => ({ ...current, phone: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.phone)} />
        {fieldErrors.phone
          ? <span className="auth-field-error" id="signup-phone-error">{fieldErrors.phone}</span>
          : <span className="auth-hint" id="signup-phone-hint"></span>}
        <label htmlFor="signup-email">Email</label>
        <input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined} />
        {fieldErrors.email && <span className="auth-field-error" id="signup-email-error">{fieldErrors.email}</span>}
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: '', confirmPassword: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined} />
        {fieldErrors.password && <span className="auth-field-error" id="signup-password-error">{fieldErrors.password}</span>}
        <label htmlFor="signup-confirm-password">Confirm password</label>
        <input id="signup-confirm-password" type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldErrors((current) => ({ ...current, confirmPassword: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? 'signup-confirm-password-error' : undefined} />
        {fieldErrors.confirmPassword && <span className="auth-field-error" id="signup-confirm-password-error">{fieldErrors.confirmPassword}</span>}
        <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Sign up'}</button>
      </form>
      {message && <p className="auth-message" role={messageRole}>{message}</p>}
    </section>
  )
}

export default SignUp