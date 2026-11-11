import { api } from './client'

/** Journal prompt a voice note is for; matches the API's whitelist. */
export type DiarySection = 'reflection' | 'gratitude' | 'win' | 'improvement'

export const diaryApi = {
  /** Upload a voice recording; the API returns AI-written bullet lines. */
  voiceToDiary: async (audio: Blob, section?: DiarySection) => {
    const type = audio.type || 'audio/webm'
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm'
    const fd = new FormData()
    fd.append('file', audio, `voice.${ext}`)
    if (section) fd.append('section', section)
    return (await api<{ summary: string }>('/api/diary/voice-to-diary', { method: 'POST', body: fd })).summary
  },
}
