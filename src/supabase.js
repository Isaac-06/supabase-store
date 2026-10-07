

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const rememberSessionKey = 'neoncart-remember-session'
let rememberSession = typeof window !== 'undefined'
  && window.localStorage.getItem(rememberSessionKey) === 'true'

const authStorage = {
  getItem(key) {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
  },
  setItem(key, value) {
    const storage = rememberSession ? window.localStorage : window.sessionStorage
    const otherStorage = rememberSession ? window.sessionStorage : window.localStorage
    otherStorage.removeItem(key)
    storage.setItem(key, value)
  },
  removeItem(key) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')
}

export function setRememberSession(shouldRemember) {
  rememberSession = shouldRemember
  window.localStorage.setItem(rememberSessionKey, String(shouldRemember))
}

export function getAuthRedirectUrl() {
  return import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage },
})