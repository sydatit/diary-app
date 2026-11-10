import { api } from './client'

export const diaryApi = {
  /** Upload a voice recording; the API returns AI-written bullet lines. */
  voiceToDiary: async (audio: Blob) => {
    const type = audio.type || 'audio/webm'
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm'
    const fd = new FormData()
    fd.append('file', audio, `voice.${ext}`)
    return (await api<{ summary: string }>('/api/diary/voice-to-diary', { method: 'POST', body: fd })).summary
  },
}
