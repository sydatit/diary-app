"""Build step: convert a Hugging Face Whisper checkpoint (e.g. vinai/PhoWhisper-small) to CTranslate2 int8.

Usage: python convert.py <hf-model-id> <output-dir>
"""
import os
import shutil
import sys
import tempfile

from ctranslate2.converters import TransformersConverter
from huggingface_hub import hf_hub_download
from transformers import WhisperTokenizerFast

model_id, out_dir = sys.argv[1], sys.argv[2]

TransformersConverter(model_id).convert(out_dir, quantization="int8", force=True)

# faster-whisper needs tokenizer.json next to the model, or it downloads one at runtime.
with tempfile.TemporaryDirectory() as tmp:
    WhisperTokenizerFast.from_pretrained(model_id).save_pretrained(tmp)
    shutil.copy(os.path.join(tmp, "tokenizer.json"), out_dir)

# Mel settings (80 mel bins for small); faster-whisper falls back to defaults if it is missing.
try:
    shutil.copy(hf_hub_download(model_id, "preprocessor_config.json"), out_dir)
except Exception as ex:  # noqa: BLE001
    print(f"preprocessor_config.json not copied: {ex}")

print("Converted", model_id, "->", sorted(os.listdir(out_dir)))
