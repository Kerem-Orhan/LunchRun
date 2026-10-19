"""
Generates the app icons and link-preview image in /public.
Run once (needs Pillow):  python scripts/make-icons.py

Icon = the LunchRun mark: dark tile, clock ring with an ember "time used" arc, lime center dot.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PUBLIC = Path(__file__).resolve().parent.parent / 'public'
INK = (14, 12, 11)
TRACK = (42, 36, 32)
EMBER = (255, 106, 61)
LIME = (198, 243, 107)
CREAM = (246, 239, 231)
MUTED = (163, 154, 145)

def mark(size: int, padding: float) -> Image.Image:
    """The ring mark on a transparent square, drawn 4x larger then downscaled for smooth edges."""
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = s * padding
    width = int(s * 0.11)
    box = [pad, pad, s - pad, s - pad]
    d.ellipse(box, outline=TRACK, width=width)
    d.arc(box, start=-90, end=150, fill=EMBER, width=width)  # "time used" arc
    r = s * 0.08
    c = s / 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=LIME)
    return img.resize((size, size), Image.LANCZOS)

def app_icon(size: int, maskable: bool) -> Image.Image:
    """Dark tile + mark. Maskable icons keep the mark inside the safe zone (Android crops to circles)."""
    tile = Image.new('RGBA', (size, size), INK + (255,))
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([size * 0.15, size * 0.05, size * 0.85, size * 0.75], fill=EMBER + (70,))
    tile.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size * 0.12)))
    tile.alpha_composite(mark(size, 0.26 if maskable else 0.17))
    return tile

for size, name, maskable in [(192, 'icon-192.png', False), (512, 'icon-512.png', False), (512, 'icon-maskable-512.png', True), (180, 'apple-touch-icon.png', False)]:
    app_icon(size, maskable).convert('RGB').save(PUBLIC / name)

# Link preview (Open Graph) image, 1200x630
W, H = 1200, 630
og = Image.new('RGBA', (W, H), INK + (255,))
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([-200, -300, 600, 400], fill=EMBER + (110,))
gd.ellipse([800, 250, 1400, 850], fill=(139, 108, 255, 60))
og.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
og.alpha_composite(mark(300, 0.08), (800, 165))

fonts = Path('C:/Windows/Fonts')
bold = ImageFont.truetype(str(fonts / 'segoeuib.ttf'), 96)
reg = ImageFont.truetype(str(fonts / 'segoeui.ttf'), 40)
d = ImageDraw.Draw(og)
d.text((90, 190), 'Lunch', font=bold, fill=CREAM)
d.text((90 + d.textlength('Lunch', font=bold), 190), 'Run', font=bold, fill=EMBER)
d.text((90, 320), 'Pick lunch together —', font=reg, fill=MUTED)
d.text((90, 372), 'only places you can make it back from.', font=reg, fill=MUTED)
d.text((90, 480), 'Free · no accounts', font=ImageFont.truetype(str(fonts / 'segoeui.ttf'), 30), fill=(107, 99, 92))
og.convert('RGB').save(PUBLIC / 'og.png', optimize=True)
print('icons written to', PUBLIC)
