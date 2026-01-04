"""
Style transfer pipeline using img2img with style prompts.
"""
import io
import logging
from typing import Optional, List, Dict, Any
import torch
from PIL import Image
from diffusers import AutoPipelineForImage2Image

logger = logging.getLogger(__name__)

# Predefined style configurations
STYLE_PRESETS: Dict[str, Dict[str, Any]] = {
    "oil_painting": {
        "prompt_suffix": ", oil painting style, thick brush strokes, rich textures, classical art",
        "negative_prompt": "photo, realistic, modern, digital",
        "strength": 0.65,
        "guidance_scale": 7.5,
    },
    "watercolor": {
        "prompt_suffix": ", watercolor painting, soft edges, translucent colors, paper texture",
        "negative_prompt": "photo, realistic, sharp edges, digital",
        "strength": 0.7,
        "guidance_scale": 7.0,
    },
    "anime": {
        "prompt_suffix": ", anime style, cel shading, vibrant colors, clean lines, japanese animation",
        "negative_prompt": "photo, realistic, western, 3d render",
        "strength": 0.75,
        "guidance_scale": 8.0,
    },
    "manga": {
        "prompt_suffix": ", manga style, black and white, screentone, japanese comic, detailed linework",
        "negative_prompt": "photo, color, realistic, western",
        "strength": 0.8,
        "guidance_scale": 7.5,
    },
    "sketch": {
        "prompt_suffix": ", pencil sketch, hand drawn, graphite, detailed linework, artistic",
        "negative_prompt": "photo, color, realistic, digital",
        "strength": 0.75,
        "guidance_scale": 7.0,
    },
    "pop_art": {
        "prompt_suffix": ", pop art style, bold colors, halftone dots, andy warhol inspired, comic book",
        "negative_prompt": "photo, muted colors, realistic, subtle",
        "strength": 0.7,
        "guidance_scale": 8.0,
    },
    "impressionist": {
        "prompt_suffix": ", impressionist painting, visible brush strokes, light effects, monet style",
        "negative_prompt": "photo, realistic, sharp, modern",
        "strength": 0.65,
        "guidance_scale": 7.0,
    },
    "cyberpunk": {
        "prompt_suffix": ", cyberpunk style, neon lights, futuristic, dark atmosphere, high tech",
        "negative_prompt": "natural, daylight, vintage, simple",
        "strength": 0.6,
        "guidance_scale": 8.5,
    },
    "vintage": {
        "prompt_suffix": ", vintage style, sepia tones, old photograph, nostalgic, film grain",
        "negative_prompt": "modern, digital, vibrant colors, sharp",
        "strength": 0.55,
        "guidance_scale": 6.5,
    },
    "minimalist": {
        "prompt_suffix": ", minimalist style, clean design, simple shapes, limited colors, modern",
        "negative_prompt": "complex, detailed, realistic, ornate",
        "strength": 0.7,
        "guidance_scale": 7.5,
    },
    "fantasy": {
        "prompt_suffix": ", fantasy art style, magical, ethereal lighting, dreamlike, epic",
        "negative_prompt": "realistic, mundane, modern, ordinary",
        "strength": 0.65,
        "guidance_scale": 8.0,
    },
    "gothic": {
        "prompt_suffix": ", gothic art style, dark atmosphere, dramatic lighting, mysterious, ornate",
        "negative_prompt": "bright, cheerful, modern, simple",
        "strength": 0.65,
        "guidance_scale": 7.5,
    },
}


class StylePipeline:
    """Style transfer pipeline using SDXL img2img."""

    _instance = None
    _is_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        self._pipeline = None
        self._device = None

    def _load_model(self):
        """Load img2img pipeline lazily."""
        if self._is_loaded:
            return

        try:
            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            logger.info(f"Loading style transfer model on {self._device}...")

            self._pipeline = AutoPipelineForImage2Image.from_pretrained(
                "stabilityai/sdxl-turbo",
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                variant="fp16" if torch.cuda.is_available() else None,
            )

            if torch.cuda.is_available():
                self._pipeline.enable_model_cpu_offload()

            self._is_loaded = True
            logger.info("Style transfer model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load style transfer model: {e}")
            raise

    def apply_style(
        self,
        image: Image.Image,
        style: str,
        prompt: str = "",
        strength: Optional[float] = None,
        guidance_scale: Optional[float] = None,
        num_inference_steps: int = 8,
        seed: Optional[int] = None,
    ) -> bytes:
        """
        Apply style to image.

        Args:
            image: PIL Image
            style: Style preset name (e.g., 'oil_painting', 'anime')
            prompt: Optional additional prompt
            strength: Override style strength
            guidance_scale: Override guidance scale
            num_inference_steps: Number of diffusion steps
            seed: Random seed for reproducibility

        Returns:
            PNG bytes of styled image
        """
        self._load_model()

        # Get style preset
        if style not in STYLE_PRESETS:
            raise ValueError(f"Unknown style: {style}. Available: {list(STYLE_PRESETS.keys())}")

        preset = STYLE_PRESETS[style]

        # Build prompt
        full_prompt = prompt + preset["prompt_suffix"] if prompt else f"an image{preset['prompt_suffix']}"
        negative_prompt = preset["negative_prompt"]

        # Get parameters
        style_strength = strength if strength is not None else preset["strength"]
        style_guidance = guidance_scale if guidance_scale is not None else preset["guidance_scale"]

        logger.info(f"Applying {style} style with strength {style_strength}")

        # Prepare image
        image = image.convert("RGB")

        # Resize if too large (max 1024 for speed)
        max_size = 1024
        if image.width > max_size or image.height > max_size:
            ratio = min(max_size / image.width, max_size / image.height)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.LANCZOS)

        # Ensure dimensions are divisible by 8
        width = (image.width // 8) * 8
        height = (image.height // 8) * 8
        if width != image.width or height != image.height:
            image = image.resize((width, height), Image.LANCZOS)

        # Set seed
        generator = None
        if seed is not None:
            generator = torch.Generator(device=self._device).manual_seed(seed)

        # Generate
        result = self._pipeline(
            prompt=full_prompt,
            negative_prompt=negative_prompt,
            image=image,
            strength=style_strength,
            guidance_scale=style_guidance,
            num_inference_steps=num_inference_steps,
            generator=generator,
        )

        # Get result image
        result_image = result.images[0]

        # Save to bytes
        buffer = io.BytesIO()
        result_image.save(buffer, format="PNG")

        logger.info(f"Style {style} applied successfully")
        return buffer.getvalue()

    def get_available_styles(self) -> List[Dict[str, str]]:
        """Get list of available styles with descriptions."""
        styles = []
        descriptions = {
            "oil_painting": "유화 스타일 - 클래식한 브러시 터치",
            "watercolor": "수채화 스타일 - 부드러운 색감",
            "anime": "애니메이션 스타일 - 일본 애니메이션 느낌",
            "manga": "만화 스타일 - 흑백 일본 만화",
            "sketch": "스케치 스타일 - 연필 드로잉",
            "pop_art": "팝아트 스타일 - 대담한 색상과 점",
            "impressionist": "인상파 스타일 - 빛과 색의 표현",
            "cyberpunk": "사이버펑크 스타일 - 네온과 미래",
            "vintage": "빈티지 스타일 - 오래된 사진 느낌",
            "minimalist": "미니멀리스트 스타일 - 단순하고 깔끔",
            "fantasy": "판타지 스타일 - 마법적이고 몽환적",
            "gothic": "고딕 스타일 - 어둡고 신비로운",
        }

        for style_id in STYLE_PRESETS:
            styles.append({
                "id": style_id,
                "name": style_id.replace("_", " ").title(),
                "description": descriptions.get(style_id, ""),
            })

        return styles

    def cleanup(self):
        """Clean up GPU memory."""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


# Singleton instance
_style_pipeline: Optional[StylePipeline] = None


def get_style_pipeline() -> StylePipeline:
    """Get style pipeline singleton."""
    global _style_pipeline
    if _style_pipeline is None:
        _style_pipeline = StylePipeline()
    return _style_pipeline


def get_available_styles() -> List[Dict[str, str]]:
    """Get available styles without loading pipeline."""
    pipeline = StylePipeline()
    return pipeline.get_available_styles()
