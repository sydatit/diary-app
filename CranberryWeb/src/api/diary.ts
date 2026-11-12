import { api, apiStream, ApiError } from './client'

/** Journal prompt a voice note is for; matches the API's whitelist. */
export type DiarySection = 'reflection' | 'gratitude' | 'win' | 'improvement'

function voiceForm(audio: Blob, section?: DiarySection) {
  const type = audio.type || 'audio/webm'
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm'
  const fd = new FormData()
  fd.append('file', audio, `voice.${ext}`)
  if (section) fd.append('section', section)
  return fd
}

export const diaryApi = {
  /** Upload a voice recording; the API returns AI-written bullet lines. */
  voiceToDiary: async (audio: Blob, section?: DiarySection) =>
    (await api<{ summary: string }>('/api/diary/voice-to-diary', { method: 'POST', body: voiceForm(audio, section) })).summary,

  /**
   * Same as voiceToDiary, but the text arrives in pieces while the AI is still writing.
   * `onText` gets the whole text so far after each piece; resolves with the final text.
   */
  voiceToDiaryStream: async (audio: Blob, section: DiarySection | undefined, onText: (soFar: string) => void) => {
    let text = ''
    let done = false
    await apiStream('/api/diary/voice-to-diary/stream', voiceForm(audio, section), (event, data) => {
      const d = (data ?? {}) as { text?: string; message?: string }
      if (event === 'error') throw new ApiError(502, d.message || 'The AI could not process the recording.', d, d.message ? undefined : 'voice.failed')
      if (event === 'done') done = true
      else if (typeof d.text === 'string') {
        text += d.text
        onText(text)
      }
    })
    // Connection dropped before the server said "done": don't pass off half an answer as the result.
    if (!done) throw new ApiError(0, 'Cannot reach the server. Check your connection.', undefined, 'error.network')
    return text
  },
}
