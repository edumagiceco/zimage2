import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, MarianMTModel, MarianTokenizer
from typing import Optional
import logging
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
    """Translation Pipeline - supports multiple backends"""

    _instance: Optional['TranslationPipeline'] = None
    _model = None
    _tokenizer = None
    _is_loaded = False
    _model_type = None  # 'marian' or 'causal'

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._is_loaded and settings.ENABLE_TRANSLATION:
            self._load_model()

    def _load_model(self):
        """Load translation model"""
        model_name = settings.TRANSLATION_MODEL_NAME
        logger.info("Loading translation model...")
        logger.info(f"Model: {model_name}")

        try:
            # Determine model type based on model name
            if 'opus-mt' in model_name.lower() or 'marian' in model_name.lower():
                self._model_type = 'marian'
                self._load_marian_model(model_name)
            elif 'gemma' in model_name.lower():
                self._model_type = 'gemma'
                self._load_gemma_model(model_name)
            else:
                self._model_type = 'causal'
                self._load_causal_model(model_name)

            self._is_loaded = True
            logger.info(f"Translation model loaded successfully! (type: {self._model_type})")

        except Exception as e:
            logger.error(f"Failed to load translation model: {e}")
            self._is_loaded = False

    def _load_marian_model(self, model_name: str):
        """Load MarianMT model (Helsinki-NLP)"""
        self._tokenizer = MarianTokenizer.from_pretrained(
            model_name,
            cache_dir=settings.HF_HOME,
        )
        self._model = MarianMTModel.from_pretrained(
            model_name,
            cache_dir=settings.HF_HOME,
        )
        # Move to GPU if available
        if torch.cuda.is_available():
            self._model = self._model.to("cuda")

    def _load_gemma_model(self, model_name: str):
        """Load Gemma model"""
        self._tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=settings.HF_HOME,
        )
        self._model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto",
            cache_dir=settings.HF_HOME,
        )

    def _load_causal_model(self, model_name: str):
        """Load Causal LM model (Qwen, etc.)"""
        self._tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=settings.HF_HOME,
            trust_remote_code=True,
        )
        self._model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto",
            cache_dir=settings.HF_HOME,
            trust_remote_code=True,
        )

    def translate_to_english(self, text: str) -> str:
        """
        Translate text to English if it contains non-English characters.
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
            if self._model_type == 'marian':
                translated = self._translate_marian(text)
            elif self._model_type == 'gemma':
                translated = self._translate_gemma(text)
            else:
                translated = self._translate_causal(text)

            logger.info(f"Translated to: {translated[:50]}...")
            return translated

        except Exception as e:
            logger.error(f"Translation failed: {e}")
            return text

    def _translate_marian(self, text: str) -> str:
        """Translate using MarianMT model"""
        # Tokenize
        inputs = self._tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)

        # Move to GPU if available
        if torch.cuda.is_available():
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

        # Generate translation
        with torch.inference_mode():
            outputs = self._model.generate(
                **inputs,
                max_length=512,
                num_beams=4,
                early_stopping=True,
            )

        # Decode
        translated = self._tokenizer.decode(outputs[0], skip_special_tokens=True)
        return translated.strip()

    def _translate_gemma(self, text: str) -> str:
        """Translate using Gemma model"""
        prompt = f"""Translate the following Korean text to English. Only output the English translation, nothing else.

Korean: {text}
English:"""

        # Tokenize
        inputs = self._tokenizer(prompt, return_tensors="pt").to(self._model.device)

        # Generate
        with torch.inference_mode():
            outputs = self._model.generate(
                **inputs,
                max_new_tokens=256,
                do_sample=False,
                temperature=0.1,
                pad_token_id=self._tokenizer.eos_token_id,
            )

        # Decode - get only the generated part
        generated_text = self._tokenizer.decode(
            outputs[0][inputs['input_ids'].shape[1]:],
            skip_special_tokens=True
        ).strip()

        # Clean up the response
        return self._clean_translation(generated_text)

    def _translate_causal(self, text: str) -> str:
        """Translate using Causal LM model (Qwen, etc.)"""
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

        return self._clean_translation(generated_text)

    def _clean_translation(self, text: str) -> str:
        """Clean up translation output"""
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
