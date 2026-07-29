#!/usr/bin/env python3
"""Genera todos los assets de marca de Socratix en assets/override/.

Fuente: branding/socratix-logo.png (1024x1024, RGBA con fondo transparente).

Uso:
    python3 branding/generate-brand-assets.py

Ojo: generate-assets.js solo copia archivos que YA existen en assets/base/.
Cada ruta generada aca abajo tiene que existir en base o se ignora en silencio.
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'branding', 'socratix-logo.png')
BASE = os.path.join(ROOT, 'assets', 'base')
OUT = os.path.join(ROOT, 'assets', 'override')

# El logo es negro monocromo. Sobre fondo oscuro hay que invertirlo a blanco:
# Mattermost hace lo mismo, su SplashIcon_Dark.png es blanco.
WHITE = (255, 255, 255)
SPLASH_BG_LIGHT = (255, 255, 255)
SPLASH_BG_DARK = (9, 10, 11)    # #090A0B, mismo que usa Mattermost en values-night

_logo = None


def logo():
    """Logo recortado a su bounding box real (el PNG tiene mucho aire)."""
    global _logo
    if _logo is None:
        im = Image.open(SRC).convert('RGBA')
        bbox = im.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()
        _logo = im.crop(bbox)
    return _logo


def tinted(img, color):
    """Recolorea el logo a un color solido conservando el alpha.

    El logo es negro puro (#000000-#030303) y sus lineas internas son huecos
    transparentes, no pixeles blancos. Por eso alcanza con pintar el alpha:
    sobre fondo oscuro queda una silueta blanca limpia, no una mancha.
    """
    out = Image.new('RGBA', img.size, color + (0,))
    out.putalpha(img.getchannel('A'))
    return out


def square(size, scale, bg=None, circle=False, rounded=0, tint=None):
    """Logo centrado en un canvas cuadrado.

    scale: fraccion del lado que ocupa el lado mayor del logo.
    bg:    None = transparente; si no, color RGB de fondo.
    tint:  None = logo tal cual; si no, lo recolorea (para fondos oscuros).
    """
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    if bg is not None:
        if circle:
            layer = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
            ImageDraw.Draw(layer).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=bg + (255,))
            canvas.alpha_composite(layer.resize((size, size), Image.LANCZOS))
        elif rounded:
            layer = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
            ImageDraw.Draw(layer).rounded_rectangle(
                [0, 0, size * 4 - 1, size * 4 - 1], radius=rounded * 4, fill=bg + (255,))
            canvas.alpha_composite(layer.resize((size, size), Image.LANCZOS))
        else:
            canvas = Image.new('RGBA', (size, size), bg + (255,))

    src = logo()
    if tint is not None:
        src = tinted(src, tint)
    target = max(1, int(round(size * scale)))
    ratio = min(target / src.width, target / src.height)
    w, h = max(1, int(round(src.width * ratio))), max(1, int(round(src.height * ratio)))
    canvas.alpha_composite(src.resize((w, h), Image.LANCZOS),
                           ((size - w) // 2, (size - h) // 2))
    return canvas


def silhouette(size, scale):
    """Silueta blanca sobre transparente.

    Android tinta los iconos de notificacion: cualquier color se renderiza como
    una mancha solida. Tiene que ser blanco + alpha.
    """
    icon = square(size, scale)
    white = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    white.putalpha(icon.getchannel('A'))
    return white


def solid(size, color):
    return Image.new('RGBA', (size, size), color + (255,))


def save(img, *path, opaque=False, bg=(255, 255, 255)):
    dest = os.path.join(OUT, *path)
    expected = os.path.join(BASE, *path)
    if not os.path.exists(expected):
        raise SystemExit('ERROR: %s no existe en assets/base/ -> el override se '
                         'ignoraria en silencio' % os.path.join(*path))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if opaque:
        # Los iconos de iOS no pueden tener canal alpha (App Store los rechaza).
        flat = Image.new('RGB', img.size, bg)
        flat.paste(img, mask=img.getchannel('A'))
        img = flat
    img.save(dest)
    print('  %s (%dx%d)' % (os.path.join(*path), img.size[0], img.size[1]))


# ---------------------------------------------------------------- iOS icons
print('iOS app icons')
IOS_ICONS = {
    '20.png': 20, '20@2x.png': 40, '20@3x.png': 60,
    '29.png': 29, '29@2x.png': 58, '29@3x.png': 87,
    '40.png': 40, '40@2x.png': 80, '40@3x.png': 120,
    '76.png': 76, '76@2x.png': 152,
    '83.5@2x.png': 167,
    'Icon-60@2x.png': 120, 'Icon-60@3x.png': 180,
    'iTunesArtwork@2x.png': 1024,
}
for name, size in IOS_ICONS.items():
    save(square(size, 0.78, bg=SPLASH_BG_LIGHT), 'release', 'icons', 'ios', name,
         opaque=True)

# ------------------------------------------------------------ Android icons
print('Android launcher icons')
DENSITIES = {
    'mipmap-mdpi': (48, 108, 22),
    'mipmap-hdpi': (72, 162, 33),
    'mipmap-xhdpi': (96, 216, 44),
    'mipmap-xxhdpi': (144, 324, 66),
    'mipmap-xxxhdpi': (192, 432, 88),
}
for density, (legacy, adaptive, notif) in DENSITIES.items():
    d = ('release', 'icons', 'android', density)
    # Legacy (pre-Android 8): icono completo con su propia forma.
    save(square(legacy, 0.68, bg=SPLASH_BG_LIGHT, rounded=int(legacy * 0.22)),
         *d, 'ic_launcher.png')
    save(square(legacy, 0.66, bg=SPLASH_BG_LIGHT, circle=True),
         *d, 'ic_launcher_round.png')
    # Adaptive (Android 8+): el sistema recorta ~18% por lado, de ahi el 0.52.
    save(square(adaptive, 0.52), *d, 'ic_launcher_foreground.png')
    save(solid(adaptive, SPLASH_BG_LIGHT), *d, 'ic_launcher_background.png')
    # Notificacion: silueta blanca, la tinta el sistema.
    save(silhouette(notif, 0.92), *d, 'ic_notification.png')

# ---------------------------------------------------------- Android splash
print('Android splash')
SPLASH = {
    'drawable-mdpi': (96, 896),
    'drawable-hdpi': (192, 1792),
    'drawable-xhdpi': (288, 2688),
    'drawable-xxhdpi': (384, 2688),
    'drawable-xxxhdpi': (480, 2688),
}
for density, (icon, bg) in SPLASH.items():
    d = ('release', 'splash_screen', 'android', density)
    save(square(icon, 1.0), *d, 'splash.png')
    save(solid(bg, SPLASH_BG_LIGHT), *d, 'splash_background.png')

    # Modo oscuro: fondo #090A0B. El logo negro seria invisible ahi, va blanco.
    night = ('release', 'splash_screen', 'android',
             density.replace('drawable-', 'drawable-night-'))
    save(square(icon, 1.0, tint=WHITE), *night, 'splash.png')
    save(solid(bg, SPLASH_BG_DARK), *night, 'splash_background.png')

# -------------------------------------------------------------- iOS splash
print('iOS splash')
save(square(667, 0.62), 'release', 'splash_screen', 'ios', 'splash.png')
for suffix, size in (('', 300), ('@2x', 600), ('@3x', 900)):
    d = ('release', 'splash_screen', 'ios', 'SplashIcon.imageset')
    save(square(size, 1.0), *d, 'SplashIcon%s.png' % suffix)
    # Variante para modo oscuro de iOS: blanca, igual que la de Mattermost.
    save(square(size, 1.0, tint=WHITE), *d, 'SplashIcon_Dark%s.png' % suffix)
for suffix, size in (('', 896), ('@2x', 1792), ('@3x', 2688)):
    d = ('release', 'splash_screen', 'ios', 'SplashBackground.imageset')
    save(solid(size, SPLASH_BG_LIGHT), *d, 'SplashBackground%s.png' % suffix)
    save(solid(size, SPLASH_BG_DARK), *d, 'SplashBackgroundDark%s.png' % suffix)

# ------------------------------------------------------------- In-app logos
print('Logos in-app')
save(square(667, 0.85), 'images', 'logo.png')
# icon.png es el avatar de 36px de las notificaciones in-app, recortado en
# circulo (in_app_notification/icon.tsx). El de base es 100% opaco; le damos
# fondo blanco para que el logo negro se lea sobre cualquier tema.
save(square(152, 0.72, bg=SPLASH_BG_LIGHT), 'images', 'icon.png', opaque=True)

print('\nListo. Ahora corre: node scripts/generate-assets.js')
