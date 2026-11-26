function PasswordVisibilityToggle({ isVisible, onToggle, hiddenLabel, visibleLabel }) {
  return (
    <button
      className="auth-password-toggle"
      type="button"
      aria-label={isVisible ? visibleLabel : hiddenLabel}
      aria-pressed={isVisible}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
        {!isVisible && <path d="m3 3 18 18" />}
      </svg>
    </button>
  )
}

export default PasswordVisibilityToggle
