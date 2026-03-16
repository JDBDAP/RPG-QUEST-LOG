// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPA_URL || !SUPA_KEY)
  console.warn('[Supabase] Missing env vars — running localStorage-only mode')

export const supabase = SUPA_URL && SUPA_KEY
  ? createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

// Column map: cx_ localStorage key → Supabase column name
export const KEY_MAP = {
  cx_settings:    'settings',
  cx_tasks:       'tasks',
  cx_quests:      'quests',
  cx_skills:      'skills',
  cx_meds:        'meds',
  cx_ptypes:      'practice_types',
  cx_xp:          'xp',
  cx_streaks:     'streaks',
  cx_seen:        'seen_tabs',
  cx_journal:     'journal',
  cx_xplog:       'xp_log',
  cx_aimem:       'ai_memory',
  cx_advisor:     'advisor_log',
  cx_grades:      'day_grades',
  cx_habits:      'habits',
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(email, password) {
  if (!supabase) return { error: { message: 'Supabase not configured' } }
  return supabase.auth.signUp({ email, password })
}
export async function signIn(email, password) {
  if (!supabase) return { error: { message: 'Supabase not configured' } }
  return supabase.auth.signInWithPassword({ email, password })
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

// ── Data ──────────────────────────────────────────────────────────────────────

export async function loadUserData(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('id', userId)
    .single()
  if (error && error.code !== 'PGRST116') {
    console.error('loadUserData:', error)
    return null
  }
  return data ?? null
}

export async function saveField(userId, field, value) {
  if (!supabase || !userId) return
  const { error } = await supabase
    .from('user_data')
    .upsert({ id: userId, [field]: value, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) console.error(`saveField(${field}):`, error)
}

export async function saveFields(userId, fields) {
  if (!supabase || !userId) return
  const { error } = await supabase
    .from('user_data')
    .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) console.error('saveFields:', error)
}

// ── Realtime subscription ─────────────────────────────────────────────────────
// Listens for UPDATE on user_data for this userId.
// onUpdate(row, serverUpdatedAt) is called when another device writes.
// Returns unsubscribe function.

export function subscribeToChanges(userId, onUpdate) {
  if (!supabase || !userId) return () => {}
  const channel = supabase
    .channel(`user_data:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'user_data', filter: `id=eq.${userId}` },
      (payload) => {
        if (payload.new) onUpdate(payload.new, payload.new.updated_at)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[Realtime] Connected')
      else if (status === 'CHANNEL_ERROR') console.warn('[Realtime] Channel error')
    })
  return () => supabase.removeChannel(channel)
}

// ── Migration ─────────────────────────────────────────────────────────────────

export async function migrateLocalStorage(userId) {
  if (!supabase || !userId) return
  const payload = { id: userId, updated_at: new Date().toISOString() }
  let hasData = false
  for (const [lsKey, col] of Object.entries(KEY_MAP)) {
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw !== null) { payload[col] = JSON.parse(raw); hasData = true }
    } catch {}
  }
  if (!hasData) return
  const { error } = await supabase.from('user_data').upsert(payload, { onConflict: 'id' })
  if (!error) {
    console.log('[Supabase] Migration complete')
    Object.keys(KEY_MAP).forEach(k => localStorage.removeItem(k))
  } else {
    console.error('Migration failed:', error)
  }
}
