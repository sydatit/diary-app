export interface UserProfile {
  userId: string
  userName: string
  email: string
  detoxStartDate: string | null
}

export interface DetoxSetup {
  detoxStartDate: string
}

export interface RegisterInput extends DetoxSetup {
  email: string
  userName: string
  password: string
}

export interface Journal {
  journalId: number
  date: string
  mood: number
  urgeLevel: number
  /** No longer shown; kept so editing an old entry doesn't wipe it. */
  pickups: number
  stressLevel: number | null
  /** "HH:mm" (24h) the user went to sleep the night before; null when not logged. */
  bedtime: string | null
  dayReflection: string | null
  gratitude: string | null
  win: string | null
  improvement: string | null
  userId: string
}

export type JournalInput = Pick<
  Journal,
  'date' | 'mood' | 'urgeLevel' | 'stressLevel' | 'bedtime' | 'pickups' | 'dayReflection' | 'gratitude' | 'win' | 'improvement'
>

export interface Wrapped<T> {
  status: string
  message: string
  data: T
}

export interface AuthResult {
  token: string
  userId: string
}
