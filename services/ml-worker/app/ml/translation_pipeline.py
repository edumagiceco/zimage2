import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from typing import Optional
import logging
import re
import unicodedata

from app.config import settings

logger = logging.getLogger(__name__)


def contains_korean(text: str) -> bool:
    """Check if text contains Korean characters"""
    for char in text:
        if 'HANGUL' in unicodedata.name(char, ''):
            return True
    return False


def contains_cjk(text: str) -> bool:
    """Check if text contains CJK (Chinese, Japanese, Korean) characters"""
    for char in text:
        name = unicodedata.name(char, '')
        if any(lang in name for lang in ['HANGUL', 'CJK', 'HIRAGANA', 'KATAKANA']):
            return True
    return False


class TranslationPipeline:
    """Translation Pipeline using Qwen2.5-3B-Instruct"""

    _instance: Optional['TranslationPipeline'] = None
    _model = None
    _tokenizer = None
    _is_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._is_loaded and settings.ENABLE_TRANSLATION:
            self._load_model()

    def _load_model(self):
        """Load translation model"""
        logger.info("Loading translation model...")
        logger.info(f"Model: {settings.TRANSLATION_MODEL_NAME}")

        try:
            self._tokenizer = AutoTokenizer.from_pretrained(
                settings.TRANSLATION_MODEL_NAME,
                cache_dir=settings.HF_HOME,
                trust_remote_code=True,
            )

            self._model = AutoModelForCausalLM.from_pretrained(
                settings.TRANSLATION_MODEL_NAME,
                torch_dtype=torch.float16,
                device_map="auto",
                cache_dir=settings.HF_HOME,
                trust_remote_code=True,
            )

            self._is_loaded = True
            logger.info("Translation model loaded successfully!")

        except Exception as e:
            logger.error(f"Failed to load translation model: {e}")
            self._is_loaded = False

    def translate_to_english(self, text: str) -> str:
        """
        Translate text to English if it contains non-English characters.

        Args:
            text: Input text (potentially in Korean or other languages)

        Returns:
            English translation or original text if already in English
        """
        if not self._is_loaded:
            logger.warning("Translation model not loaded, returning original text")
            return text

        # Check if translation is needed
        if not contains_cjk(text):
            logger.info("Text is already in English, skipping translation")
            return text

        logger.info(f"Translating: {text[:50]}...")

        try:
            # Create translation prompt
            system_prompt = """You are a professional translator. Translate the following text to English.
Only output the translation, nothing else. Keep the meaning and style intact.
For image generation prompts, ensure the translation is descriptive and detailed."""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Translate to English: {text}"}
            ]

            # Apply chat template
            prompt = self._tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True
            )

            # Tokenize
            inputs = self._tokenizer(prompt, return_tensors="pt").to(self._model.device)

            # Generate
            with torch.inference_mode():
                outputs = self._model.generate(
                    **inputs,
                    max_new_tokens=256,
                    do_sample=True,
                    temperature=0.3,
                    top_p=0.9,
                    pad_token_id=self._tokenizer.eos_token_id,
                )

            # Decode
            generated_text = self._tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:],
                skip_special_tokens=True
            ).strip()

            # Clean up the response
            translated = self._clean_translation(generated_text)

            logger.info(f"Translated to: {translated[:50]}...")
            return translated

        except Exception as e:
            logger.error(f"Translation failed: {e}")
            return text

    def _clean_translation(self, text: str) -> str:
        """Clean up translation output"""
        # Remove common prefixes
        prefixes_to_remove = [
            "Translation:",
            "English:",
            "Here is the translation:",
            "The translation is:",
        ]

        result = text.strip()
        for prefix in prefixes_to_remove:
            if result.lower().startswith(prefix.lower()):
                result = result[len(prefix):].strip()

        # Remove quotes if present
        if (result.startswith('"') and result.endswith('"')) or \
           (result.startswith("'") and result.endswith("'")):
            result = result[1:-1]

        return result.strip()

    def cleanup(self):
        """Clean up GPU memory"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("Translation model GPU memory cleared")


# Singleton accessor
_translation_instance: Optional[TranslationPipeline] = None


def get_translation_pipeline() -> TranslationPipeline:
    """Get the singleton translation pipeline instance"""
    global _translation_instance
    if _translation_instance is None:
        _translation_instance = TranslationPipeline()
    return _translation_instance


def translate_prompt(text: str) -> tuple[str, bool]:
    """
    Convenience function to translate a prompt.

    Args:
        text: Input text

    Returns:
        Tuple of (translated_text, was_translated)
    """
    if not settings.ENABLE_TRANSLATION:
        return text, False

    if not contains_cjk(text):
        return text, False

    pipeline = get_translation_pipeline()
    translated = pipeline.translate_to_english(text)

    return translated, translated != text
