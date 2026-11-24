import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../shared/services/supabase.js'

export function useAuth(setCurrentView) {
  const [user, setUser] = useState(null)
  const [authInitialized, setAuthInitialized] = useState(!isSupabaseConfigured)
  const [authMode, setAuthMode] = useState('login')
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const activeUserId = useRef(null)
  const logoutDialogRef = useRef(null)

  const applyAuthSession = useCallback((session) => {
    const nextUser = session?.user ?? null
    activeUserId.current = nextUser?.id ?? null
    setUser(nextUser)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        applyAuthSession(data.session)
        setAuthInitialized(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const wasLoggedOut = !activeUserId.current
        applyAuthSession(session)
        setAuthInitialized(true)

        if (event === 'SIGNED_IN' && wasLoggedOut) setCurrentView('home')
        if (event === 'PASSWORD_RECOVERY') {
          setAuthMode('reset')
          setCurrentView('account')
        }
        if (event === 'SIGNED_OUT') {
          setAuthMode('login')
          setCurrentView('account')
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [applyAuthSession, setCurrentView])

  useEffect(() => {
    const dialog = logoutDialogRef.current
    if (!dialog) return

    if (isLogoutDialogOpen && !dialog.open) dialog.showModal()
    else if (!isLogoutDialogOpen && dialog.open) dialog.close()
  }, [isLogoutDialogOpen])

  const handleLogout = useCallback(async () => {
    setIsSigningOut(true)
    setLogoutError('')

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Could not sign out:', error.message)
        setLogoutError(error.message)
        return
      }

      setIsLogoutDialogOpen(false)
      setAuthMode('login')
      setCurrentView('account')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
      console.error('Could not sign out:', error)
      setLogoutError(message)
    } finally {
      setIsSigningOut(false)
    }
  }, [setCurrentView])

  const displayName = typeof user?.user_metadata?.name === 'string'
    ? user.user_metadata.name.trim()
    : ''

  return {
    user,
    authInitialized,
    authMode,
    setAuthMode,
    displayName,
    isLogoutDialogOpen,
    setIsLogoutDialogOpen,
    isSigningOut,
    logoutError,
    setLogoutError,
    logoutDialogRef,
    handleLogout,
  }
}
