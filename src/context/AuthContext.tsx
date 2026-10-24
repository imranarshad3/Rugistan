import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/react'
import { supabase, readableError, setSupabaseTokenProvider } from '../lib/supabase'
import type { Profile } from '../lib/types'

type AppUser = { id: string; email: string; last_sign_in_at: string | null }
type ProfilePatch = Partial<Pick<Profile, 'first_name' | 'last_name' | 'phone' | 'avatar_url'>>
type AuthApi = {
  user: AppUser | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  manageAccount: () => void
  updateProfile: (patch: ProfilePatch) => Promise<void>
  refreshProfile: () => Promise<void>
}
const Ctx = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, user: clerkUser } = useUser()
  const { getToken } = useClerkAuth()
  const clerk = useClerk()
  const identity = useRef(clerkUser?.id)
  useLayoutEffect(() => {
    identity.current = clerkUser?.id
  }, [clerkUser?.id])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    setSupabaseTokenProvider(() => getToken())
    return () => setSupabaseTokenProvider(null)
  }, [getToken])

  const loadProfile = useCallback(async () => {
    if (!clerkUser) {
      setProfile(null)
      setError(null)
      return
    }
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''
    // Ignore existing rows so sign-in never resets a role or overwrites saved preferences.
    const { error: insertError } = await supabase.from('profiles').upsert(
      {
        id: clerkUser.id,
        email,
        first_name: clerkUser.firstName ?? '',
        last_name: clerkUser.lastName ?? '',
        phone: clerkUser.primaryPhoneNumber?.phoneNumber ?? '',
        avatar_url: clerkUser.imageUrl || null,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (insertError)
      throw new Error(readableError(insertError, 'Your account could not be connected to the store.'))
    const { data, error: readError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', clerkUser.id)
      .single()
    if (readError) throw new Error(readableError(readError))
    if (identity.current !== clerkUser.id) return
    if (clerkUser.primaryEmailAddress?.verification.status === 'verified' && data.email !== email) {
      const { error: emailError } = await supabase.from('profiles').update({ email }).eq('id', clerkUser.id)
      if (emailError) throw new Error('Your store email could not be synchronized. Please try again.')
      data.email = email
    }
    if (identity.current !== clerkUser.id) return
    setProfile(data)
    setError(null)
  }, [clerkUser])

  useEffect(() => {
    if (!isLoaded) return
    let active = true
    setProfileLoading(true)
    setProfile(null)
    void loadProfile()
      .catch((err) => {
        if (active) setError(readableError(err))
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })
    return () => {
      active = false
    }
  }, [isLoaded, loadProfile])

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      await loadProfile()
    } catch (err) {
      setError(readableError(err))
    } finally {
      setProfileLoading(false)
    }
  }, [loadProfile])
  const signOut = useCallback(async () => {
    await clerk.signOut()
    setProfile(null)
    setError(null)
  }, [clerk])
  const manageAccount = useCallback(() => {
    clerk.openUserProfile()
  }, [clerk])
  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!clerkUser) throw new Error('Please sign in and try again.')
      if (patch.first_name !== undefined || patch.last_name !== undefined) {
        await clerkUser.update({ firstName: patch.first_name, lastName: patch.last_name })
      }
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', clerkUser.id)
        .select('*')
        .single()
      if (updateError) throw new Error(readableError(updateError))
      if (identity.current === clerkUser.id) setProfile(data)
    },
    [clerkUser],
  )
  const user = useMemo<AppUser | null>(
    () =>
      clerkUser
        ? {
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
            last_sign_in_at: clerkUser.lastSignInAt?.toISOString() ?? null,
          }
        : null,
    [clerkUser],
  )
  const value = useMemo<AuthApi>(
    () => ({
      user,
      profile: profile?.id === user?.id ? profile : null,
      isAdmin: !!user && profile?.id === user.id && profile.role === 'admin',
      loading: !isLoaded || profileLoading,
      error,
      signOut,
      manageAccount,
      updateProfile,
      refreshProfile,
    }),
    [user, profile, isLoaded, profileLoading, error, signOut, manageAccount, updateProfile, refreshProfile],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
