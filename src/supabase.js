// src/supabase.js  — drop in src/ folder
import { createClient } from '@supabase/supabase-js'

const URL  = import.meta.env.VITE_SUPABASE_URL
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) console.warn('[Supabase] Missing env vars — running localStorage-only mode')

export const supabase = URL && KEY ? createClient(URL, KEY) : null

/* ── Auth helpers ─────────────────────────────────────────────────────────── */

export async function signUp(email, password) {
  if (!supabase) return { error: { message: 'Supabase not configured' } }
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}

export async function signIn(email, password) {
  if (!supabase) return { error: { message: 'Supabase not configured' } }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

export function onAuthChange(cb) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
  return () => subscription.unsubscribe()
}

/* ── Data helpers ─────────────────────────────────────────────────────────── */

// Load all user data in one round-trip
export async function loadUserData(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('id', userId)
    .single()
  if (error && error.code !== 'PGRST116') { // PGRST116 = row not found (new user)
    console.error('loadUserData:', error)
    return null
  }
  return data ?? null
}

// Save a single field (e.g. 'tasks', 'skills', 'xp')
export async function saveField(userId, field, value) {
  if (!supabase || !userId) return
  const { error } = await supabase
    .from('user_data')
    .upsert({ id: userId, [field]: value, updated_at: new Date().toISOString() })
  if (error) console.error(`saveField(${field}):`, error)
}

// Save multiple fields at once (used for migration / bulk updates)
export async function saveFields(userId, fields) {
  if (!supabase || !userId) return
  const { error } = await supabase
    .from('user_data')
    .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() })
  if (error) console.error('saveFields:', error)
}

// Migrate existing localStorage data to Supabase on first login
export async function migrateLocalStorage(userId) {
  if (!supabase || !userId) return
  const keys = {
    settings:       'cx_settings',
    tasks:          'cx_tasks',
    quests:         'cx_quests',
    skills:         'cx_skills',
    meds:           'cx_meds',
    practice_types: 'cx_ptypes',
    xp:             'cx_xp',
    streaks:        'cx_streaks',
    seen_tabs:      'cx_seen',
    journal:        'cx_journal',
    xp_log:         'cx_xplog',
  }
  const payload = { id: userId }
  let hasData = false
  for (const [field, lsKey] of Object.entries(keys)) {
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw !== null) { payload[field] = JSON.parse(raw); hasData = true }
    } catch {}
  }
  if (!hasData) return
  const { error } = await supabase.from('user_data').upsert(payload)
  if (!error) {
    console.log('[Supabase] Migration complete')
    // Clear localStorage after successful migration
    Object.values(keys).forEach(k => localStorage.removeItem(k))
  } else {
    console.error('Migration failed:', error)
  }
}
