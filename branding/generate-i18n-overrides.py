#!/usr/bin/env python3
"""Genera assets/override/i18n/*.json reemplazando la marca en los 63 idiomas.

Por que asi y no editando assets/base/i18n/:

- La regla del repo es tocar solo en.json; editar los otros idiomas rompe la
  sincronizacion con Weblate. Pero si solo tocamos en.json, un usuario con el
  telefono en espanol sigue viendo "Mattermost" (es.json tiene 14 menciones).
- generate-assets.js mergea los JSON con Object.assign. Los archivos de i18n son
  planos (clave -> string), asi que el merge shallow alcanza: el override solo
  necesita las claves que cambian.
- Resultado: assets/base/ queda intacto (merges con upstream limpios) y la marca
  se aplica en los 63 idiomas.

Uso:
    python3 branding/generate-i18n-overrides.py
"""

import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_I18N = os.path.join(ROOT, 'assets', 'base', 'i18n')
OUT_I18N = os.path.join(ROOT, 'assets', 'override', 'i18n')

OLD = 'Mattermost'
NEW = 'Socratix'

# Claves que NO se tocan. No es prolijidad: es la atribucion que exige la
# licencia Apache 2.0 y las referencias a Mattermost como producto real.
KEEP = {
    # Aviso de copyright. Apache 2.0 seccion 4(c) obliga a conservarlo.
    'settings.about.copyright',

    # "{site} is powered by Mattermost". about.tsx la renderiza SOLO cuando el
    # bundle id no es de Mattermost, o sea justo en forks como este. Es la
    # atribucion que Mattermost diseno para builds rebrandeados.
    'settings.about.powered_by',

    # Aviso de software open source, linkea a los NOTICE.txt.
    'settings.notice_text',

    # Hablan de Mattermost el producto (ediciones, comunidad) y linkean a
    # mattermost.com. Renombrarlas seria directamente incorrecto.
    'about.planNameLearn',
    'about.teamEditionLearn',
}


def load_es_translations():
    """Traducciones al espanol que faltan en upstream (branding/es-translations.json).

    Se cargan desde un archivo aparte, versionado, en vez de escribirse directo
    en assets/override/i18n/es.json: ese archivo lo genera este script, asi que
    editarlo a mano se perderia en la proxima corrida.

    Se valida que cada clave exista en en.json. Una clave que no este ahi es un
    typo o una string que upstream elimino, y no sirve de nada.
    """
    path = os.path.join(ROOT, 'branding', 'es-translations.json')
    if not os.path.exists(path):
        return {}

    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)

    data.pop('_comment', None)

    with open(os.path.join(BASE_I18N, 'en.json'), encoding='utf-8') as fh:
        en = json.load(fh)

    huerfanas = sorted(set(data) - set(en))
    if huerfanas:
        raise SystemExit('ERROR: es-translations.json tiene %d claves que no '
                         'existen en en.json: %s' % (len(huerfanas), huerfanas[:5]))

    return data


def main():
    os.makedirs(OUT_I18N, exist_ok=True)
    total_keys = 0
    locales = 0
    es_extra = load_es_translations()

    for path in sorted(glob.glob(os.path.join(BASE_I18N, '*.json'))):
        name = os.path.basename(path)
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)

        # Las traducciones propias van al override SIEMPRE (son claves que no
        # existen en base). El resto de las claves solo si tienen la marca.
        extra = es_extra if name == 'es.json' else {}

        overrides = {}
        for key, value in {**data, **extra}.items():
            if not isinstance(value, str):
                # El merge de generate-assets.js es shallow: si algun dia
                # aparece un valor anidado, este script no lo cubre.
                raise SystemExit('ERROR: %s tiene un valor no-string en %s' % (name, key))
            if key in KEEP:
                continue
            if key not in extra and OLD not in value:
                continue
            # El rebranding se aplica tambien a las traducciones propias, asi
            # que al traducir se escribe "Mattermost" normal y sale "Socratix".
            overrides[key] = value.replace(OLD, NEW)

        dest = os.path.join(OUT_I18N, name)
        if not overrides:
            # Un override vacio solo agrega ruido al merge.
            if os.path.exists(dest):
                os.remove(dest)
            continue

        with open(dest, 'w', encoding='utf-8') as fh:
            json.dump(overrides, fh, ensure_ascii=False, indent=2, sort_keys=True)
            fh.write('\n')

        locales += 1
        total_keys += len(overrides)
        print('  %-14s %2d claves' % (name, len(overrides)))

    print('\n%d idiomas, %d claves rebrandeadas.' % (locales, total_keys))
    print('Sin tocar (atribucion): %s' % ', '.join(sorted(KEEP)))


if __name__ == '__main__':
    main()
