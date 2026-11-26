import { useState } from 'react'
import {
  getAuthRedirectUrl,
  getSupabaseConfigError,
  isSupabaseConfigured,
  supabase,
} from '../../shared/services/supabase.js'
import PasswordStrength from './PasswordStrength.jsx'
import PasswordVisibilityToggle from './PasswordVisibilityToggle.jsx'

function SignUp({ onAuthenticated }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [messageRole, setMessageRole] = useState('alert')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerificationRequired, setIsVerificationRequired] = useState(false)

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
        setMessage(error.code ? `${error.message} (${error.code})` : error.message)
      } else if (data.session) {
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) {
          setMessage(`Email confirmation is disabled in Supabase, and the new session could not be cleared: ${signOutError.message}`)
        } else {
          setMessage('Email confirmation is disabled in Supabase. Enable email confirmation to require verification before account access.')
        }
      } else if (!data.user) {
        setMessage('Supabase returned no new user or session. Check the Supabase Auth logs for this signup request.')
      } else if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setMessage('Supabase did not start a new signup or email verification for this address. If it is already registered, sign in or reset your password.')
      } else {
        setVerificationEmail(trimmedEmail)
        setIsVerificationRequired(true)
        setMessageRole('status')
        setMessage(`Supabase accepted your signup request for ${trimmedEmail}. Check your inbox and spam folder for the verification code.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault()
    setMessage('')
    setMessageRole('alert')

    const trimmedCode = verificationCode.trim()
    if (!trimmedCode) {
      setFieldErrors((current) => ({ ...current, verificationCode: 'Enter the verification code from your email.' }))
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: verificationEmail,
        token: trimmedCode,
        type: 'signup',
      })

      if (error) {
        setMessage(error.message)
      } else if (data.session) {
        onAuthenticated(data.session.user)
      } else {
        setMessage('Email verification completed, but no account session was created. Please sign in.')
        setMessageRole('status')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not verify your email. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendCode() {
    setMessage('')
    setMessageRole('alert')
    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: verificationEmail,
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessageRole('status')
        setMessage(`A new verification code was sent to ${verificationEmail}.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not resend the verification code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isVerificationRequired) {
    return (
      <section className="auth-panel">
        <p className="eyebrow">Verify your email</p>
        <h1>Enter your code</h1>
        <form className="auth-form" onSubmit={handleVerifyCode} noValidate>
          <label htmlFor="signup-verification-code">Verification code</label>
          <input
            id="signup-verification-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={verificationCode}
            onChange={(event) => {
              setVerificationCode(event.target.value)
              setFieldErrors((current) => ({ ...current, verificationCode: '' }))
              setMessage('')
            }}
            required
            aria-invalid={Boolean(fieldErrors.verificationCode)}
            aria-describedby={fieldErrors.verificationCode ? 'signup-verification-code-error' : undefined}
          />
          {fieldErrors.verificationCode && (
            <span className="auth-field-error" id="signup-verification-code-error">{fieldErrors.verificationCode}</span>
          )}
          <button className="primary-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Verify email'}
          </button>
        </form>
        <button className="text-btn" type="button" onClick={handleResendCode} disabled={isSubmitting}>
          Resend code
        </button>
        {message && <p className="auth-message" role={messageRole}>{message}</p>}
      </section>
    )
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
        <div className="auth-password-field">
          <input id="signup-password" type={isPasswordVisible ? 'text' : 'password'} autoComplete="new-password" minLength={6} value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: '', confirmPassword: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'signup-password-error signup-password-guidance' : 'signup-password-guidance'} />
          <PasswordVisibilityToggle
            isVisible={isPasswordVisible}
            onToggle={() => setIsPasswordVisible((visible) => !visible)}
            hiddenLabel="Show password"
            visibleLabel="Hide password"
          />
        </div>
        {fieldErrors.password && <span className="auth-field-error" id="signup-password-error">{fieldErrors.password}</span>}
        <PasswordStrength password={password} id="signup-password" />
        <label htmlFor="signup-confirm-password">Confirm password</label>
        <div className="auth-password-field">
          <input id="signup-confirm-password" type={isConfirmPasswordVisible ? 'text' : 'password'} autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldErrors((current) => ({ ...current, confirmPassword: '' })); setMessage('') }} required aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? 'signup-confirm-password-error' : undefined} />
          <PasswordVisibilityToggle
            isVisible={isConfirmPasswordVisible}
            onToggle={() => setIsConfirmPasswordVisible((visible) => !visible)}
            hiddenLabel="Show confirmation password"
            visibleLabel="Hide confirmation password"
          />
        </div>
        {fieldErrors.confirmPassword && <span className="auth-field-error" id="signup-confirm-password-error">{fieldErrors.confirmPassword}</span>}
        <button className="primary-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Sign up'}</button>
      </form>
      {message && <p className="auth-message" role={messageRole}>{message}</p>}
    </section>
  )
}

export default SignUp