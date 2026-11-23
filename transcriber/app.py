"""Speech-to-text for voice diary notes: upload an audio file, get the transcript back segment by segment.

Internal service, only the API container calls it. Reply is NDJSON, one object per line:
  {"text": "..."}                                  one per segment, as soon as it is decoded
  {"done": true, "durationSeconds": 12.3, "elapsedSeconds": 4.5}
  {"error": "..."}                                 instead of "done" if it broke
"""
import json
import logging
import os
import shutil
import tempfile
import threading
import time

from fastapi import FastAPI, UploadFile
from fastapi.responses import StreamingResponse
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "phowhisper-small")
MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR", "/models/whisper")
LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "vi")
BEAM_SIZE = int(os.environ.get("WHISPER_BEAM", "1"))
# 0 = use every CPU.
THREADS = int(os.environ.get("WHISPER_THREADS", "0"))

log = logging.getLogger("uvicorn.error")
model = WhisperModel(MODEL_DIR, device="cpu", compute_type="int8", cpu_threads=THREADS)
# One file at a time: two runs in parallel only make both slower.
lock = threading.Lock()
app = FastAPI()


def line(obj) -> str:
    return json.dumps(obj, ensure_ascii=False) + "\n"


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/transcribe")
def transcribe(file: UploadFile):
    suffix = os.path.splitext(file.filename or "")[1][:8]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name

    def run():
        started = time.monotonic()
        try:
            with lock:
                segments, info = model.transcribe(
                    path,
                    language=LANGUAGE,
                    vad_filter=True,  # skip silence and noise instead of "hearing" words in them
                    beam_size=BEAM_SIZE,
                    condition_on_previous_text=False,  # one misheard stretch must not drag the next ones along
                )
                for segment in segments:
                    text = segment.text.strip()
                    if text:
                        yield line({"text": text})
            elapsed = round(time.monotonic() - started, 1)
            log.info("Transcribed %.1fs of audio in %.1fs", info.duration, elapsed)
            yield line({"done": True, "durationSeconds": round(info.duration, 3), "elapsedSeconds": elapsed})
        except Exception as ex:  # noqa: BLE001 - e.g. a file PyAV cannot decode
            log.exception("Transcription failed")
            yield line({"error": str(ex) or type(ex).__name__})
        finally:
            os.unlink(path)

    return StreamingResponse(run(), media_type="application/x-ndjson")
