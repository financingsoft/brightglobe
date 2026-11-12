#!/usr/bin/env python3
"""Download and optimize CC BY 4.0 Earth textures for the BrightGlobe app."""

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
LICENSE = "https://creativecommons.org/licenses/by/4.0/"

SOURCES = {
    "earth-day.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_daymap.jpg",
    "earth-night.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_nightmap.jpg",
    "earth-clouds.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_clouds.jpg",
    "earth-normal.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_normal_map.tif",
    "earth-specular.jpg": "https://play.solarsystemscope.com/textures/download/2k_earth_specular_map.tif",
}


def download(url: str) -> bytes:
    request = Request(
        url,
        headers={"User-Agent": "BrightGlobe-EarthAssetBuilder/1.0"},
    )
    with urlopen(request, timeout=60) as response:
        content_type = response.headers.get("Content-Type", "")
        payload = response.read()

    if "image/" not in content_type.lower():
        raise RuntimeError(f"Unexpected non-image response from {url}: {content_type}")
    if len(payload) < 20_000 or len(payload) > 20_000_000:
        raise RuntimeError(f"Unexpected image size from {url}: {len(payload)} bytes")

    # Let Pillow verify the actual file signature; the pack includes both JPEG and TIFF.
    with Image.open(io.BytesIO(payload)) as image:
        image.verify()
    return payload


def process(name: str, url: str) -> dict[str, object]:
    payload = download(url)

    with Image.open(io.BytesIO(payload)) as source:
        original_size = list(source.size)
        if source.width / source.height < 1.98 or source.width / source.height > 2.02:
            raise RuntimeError(f"{name} is not a 2:1 equirectangular texture: {source.size}")

        source.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)

        if name in {"earth-clouds.jpg", "earth-specular.jpg"}:
            image = source.convert("L")
            quality = 90
        else:
            # Preserve RGB channels for the tangent-space normal map.
            image = source.convert("RGB")
            quality = 95 if name == "earth-normal.jpg" else 92

        destination = OUTPUT / name
        image.save(destination, "JPEG", quality=quality, optimize=True, progressive=False)

    data = destination.read_bytes()
    return {
        "file": name,
        "source": url,
        "original_dimensions": original_size,
        "bundled_dimensions": list(image.size),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "license": "CC BY 4.0",
        "color_space": "linear-data" if name in {"earth-normal.jpg", "earth-specular.jpg", "earth-clouds.jpg"} else "sRGB",
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "license": "CC BY 4.0",
        "license_url": LICENSE,
        "attribution": "Solar System Scope — https://www.solarsystemscope.com/textures/",
        "changes": "Downloaded from the official Solar System Scope texture pack; resized to at most 2048x1024 and optimized as JPEG for BrightGlobe. Normal map RGB channels are preserved; cloud and specular maps are converted to grayscale.",
        "assets": [process(name, url) for name, url in SOURCES.items()],
    }

    (OUTPUT / "ASSET_MANIFEST.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    (OUTPUT / "ATTRIBUTION.md").write_text(
        "# Earth texture attribution\n\n"
        "Earth Day Map, Earth Night Map, Earth Clouds, Earth Normal Map, and "
        "Earth Specular Map are provided by "
        "[Solar System Scope](https://www.solarsystemscope.com/textures/).\n\n"
        "These textures are distributed under the "
        "[Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/). "
        "They may be adapted and used commercially with attribution.\n\n"
        "Changes made for BrightGlobe: images are resized to a maximum of 2048×1024; "
        "the normal map retains its RGB channels; cloud and specular maps are converted "
        "to grayscale; all images are optimized as JPEGs.\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
