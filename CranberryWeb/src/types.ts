export interface UserProfile {
  userId: string
  userName: string
  email: string
  detoxStartDate: string | null
  baselinePickups: number
  dailyPickupGoal: number
}

export interface DetoxSetup {
  detoxStartDate: string
  baselinePickups: number
  dailyPickupGoal: number
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
  pickups: number
  dayReflection: string | null
  gratitude: string | null
  win: string | null
  improvement: string | null
  userId: string
}

export type JournalInput = Pick<
  Journal,
  'date' | 'mood' | 'urgeLevel' | 'pickups' | 'dayReflection' | 'gratitude' | 'win' | 'improvement'
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
