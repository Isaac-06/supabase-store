
//Brings in Supabase tools for connectivity
import { createClient } from '@supabase/supabase-js'

//Gets the URL and anon_key from the env file
//URL = Supabase address,anon-key = pass for user to enter Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

//Serves as a reminder to know if Remember me was used during login
const rememberSessionKey = 'neoncart-remember-session'
let rememberSession = typeof window !== 'undefined'
  && window.localStorage.getItem(rememberSessionKey) === 'true'

  //Tells Supabase where to save login information
const authStorage = {
  
  //Checks whether there is any saved login,
  //Makes use of either localStorage or sessionStorage if there is any
  getItem(key) {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
  },
  setItem(key, value) {
    const storage = rememberSession ? window.localStorage : window.sessionStorage
    const otherStorage = rememberSession ? window.sessionStorage : window.localStorage
    
    //If the user unchecks Remember me,the old session is removed
    otherStorage.removeItem(key)
   
   //Saves the login information
    storage.setItem(key, value)
  },

  //Deletes the login details completely when logging out
  removeItem(key) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}
//If the Supabase URL or anon_key is not found,the app crashes with a helpful error
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')
}
//Called when the user ticks or unticks Remember me checkbox 
export function setRememberSession(shouldRemember) {
 
  //Changes the value in memory
  rememberSession = shouldRemember
 
  //Stores either true or false in browser
  window.localStorage.setItem(rememberSessionKey, String(shouldRemember))
}
//After email confirmation or password reset, Supabase needs to know where to return the user
export function getAuthRedirectUrl() {
  return import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin
}

//Actual connection to Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage },
})