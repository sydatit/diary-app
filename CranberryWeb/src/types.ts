export interface UserProfile {
  userId: string
  userName: string
  quitDate: string | null
  avgSmokedDaily: number
  pricePerPack: number
  cigsPerPack: number
}

export interface Habits {
  quitDate: string
  avgSmokedDaily: number
  pricePerPack: number
  cigsPerPack: number
}

export interface RegisterInput extends Habits {
  email: string
  userName: string
  password: string
}

export interface Journal {
  journalId: number
  date: string
  cravingIntensity: number
  cigsSmoked: number
  notes: string | null
  userId: string
}

export type JournalInput = Pick<Journal, 'date' | 'cravingIntensity' | 'cigsSmoked' | 'notes'>

export interface Wrapped<T> {
  status: string
  message: string
  data: T
}
