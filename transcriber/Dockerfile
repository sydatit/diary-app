# --- Stage 1: put the model at /models/whisper (CTranslate2 int8) ---
FROM python:3.12-slim AS model
ENV PIP_NO_CACHE_DIR=1 HF_HOME=/hf
WORKDIR /build

# phowhisper-<size> = vinai/PhoWhisper-<size> (Vietnamese fine-tune), converted here.
# Anything else (small, base, medium...) is a stock faster-whisper model, downloaded ready-made.
ARG WHISPER_MODEL=phowhisper-small
COPY convert.py .
RUN set -e; \
    case "$WHISPER_MODEL" in \
      phowhisper-*) \
        pip install ctranslate2==4.9.1 torch==2.6.0 transformers==4.57.1; \
        python convert.py "vinai/PhoWhisper-${WHISPER_MODEL#phowhisper-}" /models/whisper ;; \
      *) \
        pip install faster-whisper==1.2.1; \
        python -c "import sys; from faster_whisper import download_model; download_model(sys.argv[1], output_dir='/models/whisper')" "$WHISPER_MODEL" ;; \
    esac

# --- Stage 2: runtime ---
FROM python:3.12-slim
WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 PYTHONUNBUFFERED=1 HF_HUB_OFFLINE=1

COPY requirements.txt .
RUN pip install -r requirements.txt

# The model lives in the image, so the container runs without network access.
ARG WHISPER_MODEL=phowhisper-small
ENV WHISPER_MODEL=${WHISPER_MODEL} WHISPER_MODEL_DIR=/models/whisper
COPY --from=model /models/whisper /models/whisper

COPY app.py .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
