import { api, apiStream, ApiError } from './client'

function voiceForm(audio: Blob) {
  const type = audio.type || 'audio/webm'
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm'
  const fd = new FormData()
  fd.append('file', audio, `voice.${ext}`)
  return fd
}

/** Read the API's diary SSE reply: `data: {text}` pieces, then `event: done` (or `event: error`). */
async function readDiaryStream(path: string, body: unknown, onText: (soFar: string) => void) {
  let text = ''
  let done = false
  await apiStream(path, body, (event, data) => {
    const d = (data ?? {}) as { text?: string; message?: string }
    if (event === 'error') throw new ApiError(502, d.message || 'The recording could not be transcribed.', d, d.message ? undefined : 'voice.failed')
    if (event === 'done') done = true
    else if (typeof d.text === 'string') {
      text += d.text
      onText(text)
    }
  })
  // Connection dropped before the server said "done": don't pass off half an answer as the result.
  if (!done) throw new ApiError(0, 'Cannot reach the server. Check your connection.', undefined, 'error.network')
  return text
}

export const diaryApi = {
  /** Upload a voice recording; the API returns what was said, one line per spoken segment. */
  voiceToDiary: async (audio: Blob) =>
    (await api<{ summary: string }>('/api/diary/voice-to-diary', { method: 'POST', body: voiceForm(audio) })).summary,

  /**
   * Same as voiceToDiary, but the text arrives in pieces while the rest is still being transcribed.
   * `onText` gets the whole text so far after each piece; resolves with the final text.
   */
  voiceToDiaryStream: (audio: Blob, onText: (soFar: string) => void) =>
    readDiaryStream('/api/diary/voice-to-diary/stream', voiceForm(audio), onText),
}
