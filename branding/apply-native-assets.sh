#!/usr/bin/env bash
#
# Aplica la marca de Socratix a los proyectos nativos para builds de desarrollo.
#
# Por que hace falta: los lanes `replace_assets` del Fastfile solo corren en
# builds de release (REPLACE_ASSETS=true). Con `npm run ios` / `npm run android`
# no corren, asi que el icono y el splash nativos quedarian los de Mattermost.
# Los assets de JS (@assets -> dist/assets) si se toman solos, no hacen falta aca.
#
# Uso:  ./branding/apply-native-assets.sh
#
# Ojo: escribe dentro de ios/ y android/. Son cambios trackeados por git.
# Para un build de release NO uses este script: Fastlane hace lo mismo y ademas
# reescribe identificadores.

set -euo pipefail
cd "$(dirname "$0")/.."

# El generador de imagenes necesita PIL. `python3` a secas no sirve: brew
# instalo python@3.14 como dependencia de watchman y quedo primero en el PATH,
# sin PIL. El del sistema (/usr/bin/python3) si lo tiene. Buscamos uno que
# funcione en vez de asumir.
PY=""
for cand in python3 /usr/bin/python3 python3.13 python3.12; do
    if command -v "$cand" > /dev/null 2>&1 && "$cand" -c 'import PIL' > /dev/null 2>&1; then
        PY="$cand"
        break
    fi
done
if [ -z "$PY" ]; then
    echo "ERROR: no hay ningun python3 con Pillow instalado." >&2
    echo "       Instalalo con:  /usr/bin/python3 -m pip install --user pillow" >&2
    exit 1
fi
echo "==> Usando $PY ($("$PY" -V 2>&1))"

echo "==> Generando assets de marca desde branding/socratix-logo.png"
"$PY" branding/generate-brand-assets.py > /dev/null

echo "==> Generando overrides de i18n (marca + traducciones al espanol)"
"$PY" branding/generate-i18n-overrides.py > /dev/null

echo "==> Fusionando assets/base + assets/override -> dist/assets"
node scripts/generate-assets.js > /dev/null

echo "==> Copiando a iOS"
cp -R dist/assets/release/icons/ios/* ios/Mattermost/Images.xcassets/AppIcon.appiconset/
cp -R dist/assets/release/splash_screen/ios/LaunchScreen.storyboard ios/SplashScreenResource/LaunchScreen.storyboard
cp -R dist/assets/release/splash_screen/ios/SplashBackground.imageset ios/Mattermost/Images.xcassets/
cp -R dist/assets/release/splash_screen/ios/SplashIcon.imageset ios/Mattermost/Images.xcassets/

echo "==> Copiando a Android"
cp -R dist/assets/release/icons/android/* android/app/src/main/res/
cp -R dist/assets/release/splash_screen/android/* android/app/src/main/res/

echo "==> Listo."
echo "    iOS:     borra la app del simulador antes de reinstalar (cachea el icono)."
echo "    Android: ./android/gradlew -p android clean  si el icono no cambia."
