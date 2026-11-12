#!/usr/bin/env python3
"""Download, validate, and optimize CC BY 4.0 Earth textures."""

from __future__ import annotations

import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "earth"
MAX_SIZE = (2048, 1024)
LOW_SIZE = (1024, 512)
LICENSE = "https://creativecommons.org/licenses/by/4.0/"

SOURCES = {
    "earth-day.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_daymap.jpg",
    "earth-night.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_nightmap.jpg",
    "earth-clouds.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_clouds.jpg",
    "earth-normal.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_normal_map.tif",
    "earth-specular.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_specular_map.tif",
}


def download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "BrightGlobe-EarthAssetBuilder/1.0"})
    with urlopen(request, timeout=60) as response:
        content_type = response.headers.get("Content-Type", "")
        payload = response.read()

    if "image/" not in content_type.lower():
        raise RuntimeError(f"Unexpected non-image response from {url}: {content_type}")
    if len(payload) < 20_000 or len(payload) > 20_000_000:
        raise RuntimeError(f"Unexpected image size from {url}: {len(payload)} bytes")

    with Image.open(io.BytesIO(payload)) as image:
        image.verify()
    return payload


def convert_image(name: str, source: Image.Image) -> Image.Image:
    if name in {"earth-clouds.jpg", "earth-specular.jpg"}:
        return source.convert("L")
    # Keep RGB channels for the tangent-space normal map.
    return source.convert("RGB")


def save_jpeg(image: Image.Image, path: Path, quality: int) -> dict[str, object]:
    image.save(path, "JPEG", quality=quality, optimize=True, progressive=False)
    data = path.read_bytes()
    return {
        "file": path.name,
        "dimensions": list(image.size),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def process(name: str, url: str) -> dict[str, object]:
    payload = download(url)

    with Image.open(io.BytesIO(payload)) as source:
        original_size = list(source.size)
        if not 1.98 <= source.width / source.height <= 2.02:
            raise RuntimeError(f"{name} is not a 2:1 equirectangular texture: {source.size}")

        source.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
        optimized = convert_image(name, source)
        high_quality = 95 if name == "earth-normal.jpg" else 92
        standard = save_jpeg(optimized, OUTPUT / name, high_quality)

        low_image = optimized.copy()
        low_image.thumbnail(LOW_SIZE, Image.Resampling.LANCZOS)
        low_name = f"{Path(name).stem}-1k.jpg"
        low = save_jpeg(low_image, OUTPUT / low_name, 88)

    return {
        "source": url,
        "original_dimensions": original_size,
        "license": "CC BY 4.0",
        "color_space": "sRGB" if name in {"earth-day.jpg", "earth-night.jpg"} else "linear-data",
        "standard": standard,
        "low_memory": low,
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assets = {name: process(name, url) for name, url in SOURCES.items()}
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "license": "CC BY 4.0",
        "license_url": LICENSE,
        "attribution": "Solar System Scope — https://www.solarsystemscope.com/textures/",
        "changes": (
            "Standard images are optimized to 2048x1024; low-memory copies are "
            "resized to 1024x512. The normal map retains RGB channels; cloud and "
            "specular masks are converted to grayscale."
        ),
        "assets": assets,
    }

    (OUTPUT / "ASSET_MANIFEST.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (OUTPUT / "ATTRIBUTION.md").write_text(
        "# Earth texture attribution\n\n"
        "Earth Day Map, Earth Night Map, Earth Clouds, Earth Normal Map, and "
        "Earth Specular Map are provided by "
        "[Solar System Scope](https://www.solarsystemscope.com/textures/).\n\n"
        "These textures are distributed under the "
        "[Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/). "
        "They may be adapted and used commercially with attribution.\n\n"
        "Changes made for BrightGlobe: standard textures are optimized to 2048×1024; "
        "low-memory copies are resized to 1024×512; the normal map retains RGB "
        "channels; cloud and specular masks are grayscale.\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
