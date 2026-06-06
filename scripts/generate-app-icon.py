#!/usr/bin/env python3
"""Generate Tickpic app icons from the Sidebar branding (primary blue + Layers mark)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / "resources"
SIZE = 1024
PRIMARY = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)
CORNER_RADIUS = 230
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def scale_points(points: list[tuple[float, float]], scale: float, offset: tuple[float, float]) -> list[tuple[float, float]]:
    ox, oy = offset
    return [(ox + (x - 12) * scale, oy + (y - 12) * scale) for x, y in points]


def draw_layers_icon(draw: ImageDraw.ImageDraw, center: tuple[float, float]) -> None:
    scale = 30
    ox, oy = center
    top = [(12, 2), (2, 7), (12, 12), (22, 7)]
    middle = [(2, 12), (12, 17), (22, 12)]
    bottom = [(2, 17), (12, 22), (22, 17)]

    draw.polygon(scale_points(top, scale, (ox, oy - 90)), fill=WHITE)
    draw.line(scale_points(middle, scale, (ox, oy - 90)), fill=WHITE, width=max(12, int(scale * 0.45)), joint="curve")
    draw.line(scale_points(bottom, scale, (ox, oy - 90)), fill=WHITE, width=max(12, int(scale * 0.45)), joint="curve")


def create_icon_image() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=CORNER_RADIUS, fill=PRIMARY)
    draw_layers_icon(draw, (SIZE / 2, SIZE / 2 + 40))
    return image


def main() -> None:
    RESOURCES.mkdir(parents=True, exist_ok=True)
    icon = create_icon_image()
    png_path = RESOURCES / "icon.png"
    ico_path = RESOURCES / "icon.ico"
    public_png_path = ROOT / "public" / "icon.png"

    icon.save(png_path, format="PNG")
    public_png_path.parent.mkdir(parents=True, exist_ok=True)
    icon.save(public_png_path, format="PNG")

    resized = {size: icon.resize((size, size), Image.Resampling.LANCZOS) for size in ICO_SIZES}
    ordered = [resized[size] for size in ICO_SIZES]
    ordered[-1].save(
        ico_path,
        format="ICO",
        sizes=[(size, size) for size in ICO_SIZES],
        append_images=ordered[:-1],
    )

    print(f"Wrote {png_path}")
    print(f"Wrote {public_png_path}")
    print(f"Wrote {ico_path}")


if __name__ == "__main__":
    main()
