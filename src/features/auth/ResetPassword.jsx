import { useState } from 'react'
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
  supabase,
} from '../../shared/services/supabase.js'
import PasswordStrength from './PasswordStrength.jsx'
import PasswordVisibilityToggle from './PasswordVisibilityToggle.jsx'

function ResetPassword({ hasSession, onPasswordUpdated, onBackToSignIn }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    if (!isSupabaseConfigured) {
      setMessage(getSupabaseConfigError())
      return
    }

    if (!hasSession) {
      setMessage('This password reset link is invalid or expired. Request a new reset link and open it again.')
      return
    }

    const errors = {}
    if (!password) {
      errors.password = 'Create a new password.'
    } else if (password.length < 6) {
      errors.password = 'Your password must be at least 6 characters.'
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your password.'
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)

    let passwordUpdated = false

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setMessage(error.message)
      } else {
        passwordUpdated = true
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })

        if (signOutError) {
          setMessage(`Your password was updated, but automatic sign-out failed. Please sign out and sign in with your new password. ${signOutError.message}`)
        } else {
          onPasswordUpdated()
        }
      }
    } catch (error) {
      setMessage(passwordUpdated
        ? 'Your password was updated, but automatic sign-out failed. Please sign out and sign in with your new password.'
        : error instanceof Error ? error.message : 'Could not update your password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!hasSession) {
    return (
      <section className="auth-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password</h1>
        <p className="auth-message" role="alert">
          This reset link is invalid or expired. Request a new reset link and open it again.
        </p>
        <button className="text-btn" type="button" onClick={onBackToSignIn}>Back to sign in</button>
      </section>
    )
  }

  return (
    <section className="auth-panel">
      <p className="eyebrow">Account recovery</p>
      <h1>Choose a new password</h1>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="reset-new-password">New password</label>
        <div className="auth-password-field">
          <input
            id="reset-new-password"
            type={isPasswordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setFieldErrors((current) => ({ ...current, password: '' }))
              setMessage('')
            }}
            minLength={6}
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'reset-new-password-error reset-new-password-guidance' : 'reset-new-password-guidance'}
          />
          <PasswordVisibilityToggle
            isVisible={isPasswordVisible}
            onToggle={() => setIsPasswordVisible((visible) => !visible)}
            hiddenLabel="Show new password"
            visibleLabel="Hide new password"
          />
        </div>
        {fieldErrors.password && <span className="auth-field-error" id="reset-new-password-error">{fieldErrors.password}</span>}
        <PasswordStrength password={password} id="reset-new-password" />
        <label htmlFor="reset-confirm-password">Confirm new password</label>
        <div className="auth-password-field">
          <input
            id="reset-confirm-password"
            type={isConfirmPasswordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              setFieldErrors((current) => ({ ...current, confirmPassword: '' }))
              setMessage('')
            }}
            minLength={6}
            required
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? 'reset-confirm-password-error' : undefined}
          />
          <PasswordVisibilityToggle
            isVisible={isConfirmPasswordVisible}
            onToggle={() => setIsConfirmPasswordVisible((visible) => !visible)}
            hiddenLabel="Show confirmation password"
            visibleLabel="Hide confirmation password"
          />
        </div>
        {fieldErrors.confirmPassword && <span className="auth-field-error" id="reset-confirm-password-error">{fieldErrors.confirmPassword}</span>}
        <button className="primary-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
      {message && <p className="auth-message" role="alert">{message}</p>}
    </section>
  )
}

export default ResetPassword
