function getPasswordStrength(password) {
  const characterTypes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z\d]/.test(password),
  ].filter(Boolean).length

  if (password.length >= 12 && characterTypes >= 3) {
    return { label: 'Strong', score: 3 }
  }
  if (password.length >= 8 && characterTypes >= 2) {
    return { label: 'Fair', score: 2 }
  }
  return { label: 'Weak', score: 1 }
}

function PasswordStrength({ password, id }) {
  const meetsMinimum = password.length >= 6
  const strength = password ? getPasswordStrength(password) : null

  return (
    <div className="password-guidance" id={`${id}-guidance`} aria-live="polite">
      <span className={meetsMinimum ? 'password-requirement is-met' : 'password-requirement'}>
        {meetsMinimum ? '✓ Minimum length met' : `At least 6 characters (${password.length}/6)`}
      </span>
      {strength && (
        <div className={`password-strength is-${strength.label.toLowerCase()}`}>
          <span
            className="password-strength-meter"
            role="meter"
            aria-label="Password strength"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={strength.score}
            aria-valuetext={strength.label}
          >
            <span />
            <span />
            <span />
          </span>
          <span>Password strength: {strength.label}</span>
        </div>
      )}
    </div>
  )
}

export default PasswordStrength
