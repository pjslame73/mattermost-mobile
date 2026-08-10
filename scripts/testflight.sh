#!/usr/bin/env bash
#
# Publica un build de Socratix a TestFlight.
#
#   npm run testflight:ios
#
# Hace lo mismo que hace el CI de upstream para sus builds beta, pero con el
# entorno ios.socratix y en tu Mac: `fastlane ios build` y despues
# `fastlane ios deploy`. Son dos lanes separadas a proposito — la variable
# SUBMIT_IOS_TO_TESTFLIGHT que aparece en los .env NO la lee nadie.
#
# Variables utiles:
#   SKIP_SETUP=1   saltea npm clean/install y pods. Para reintentos, cuando ya
#                  corriste el build completo una vez y solo cambio codigo JS.
#   SKIP_UPLOAD=1  compila el .ipa pero no lo sube. Para probar la firma sin
#                  gastar un numero de build en App Store Connect.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FASTLANE_ENV_NAME='ios.socratix'
ENV_FILE="$ROOT/fastlane/.env"

# ---------------------------------------------------------------- preflight
# Fallar aca cuesta segundos; fallar despues de gym cuesta veinte minutos.

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: falta fastlane/.env"
    echo "       Copialo de fastlane/.env.example y completa los secretos."
    exit 1
fi

missing=()
for var in IOS_API_KEY_ID IOS_API_ISSUER_ID IOS_API_KEY MATCH_GIT_URL MATCH_PASSWORD; do
    # Se lee con grep en vez de sourcear el archivo: .env tiene secretos con
    # caracteres que el shell interpretaria, y no hace falta su valor, solo
    # saber si esta.
    if ! grep -qE "^${var}=.+" "$ENV_FILE"; then
        missing+=("$var")
    fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
    echo "ERROR: faltan variables en fastlane/.env:"
    printf '       %s\n' "${missing[@]}"
    echo
    echo "       Cada una esta documentada en fastlane/.env.example."
    exit 1
fi

if ! grep -qE '^SYNC_PROVISIONING_PROFILES=true' "$ROOT/fastlane/.env.$FASTLANE_ENV_NAME"; then
    echo "ERROR: SYNC_PROVISIONING_PROFILES esta en false en"
    echo "       fastlane/.env.$FASTLANE_ENV_NAME."
    echo "       Sin eso, match no baja los perfiles y gym firma con lo que"
    echo "       haya en el llavero — que en una maquina limpia es nada."
    exit 1
fi

BUILD_NUMBER=$(grep -m1 -A1 '<key>CFBundleVersion</key>' "$ROOT/ios/Mattermost/Info.plist" | grep -oE '[0-9]+' | tail -1)
echo "==> Build number: $BUILD_NUMBER"
echo "    App Store Connect rechaza subir dos veces el mismo build number para"
echo "    una misma version. Si este ya se subio, bumpealo antes de seguir."
echo

# -------------------------------------------------------------------- build

echo "==> Compilando con --env $FASTLANE_ENV_NAME"
FASTLANE_ENV="$FASTLANE_ENV_NAME" "$ROOT/scripts/build.sh" ipa

cd "$ROOT"

# gym deja el .ipa en la raiz del repo, con el nombre de APP_NAME.
IPA=$(find "$ROOT" -maxdepth 1 -name '*.ipa' -type f -print0 | xargs -0 ls -t 2>/dev/null | head -1 || true)

if [[ -z "$IPA" ]]; then
    echo "ERROR: el build no dejo ningun .ipa en $ROOT"
    exit 1
fi

echo "==> IPA: $IPA"

# ------------------------------------------------------------------- upload

if [[ -n "${SKIP_UPLOAD:-}" ]]; then
    echo "==> SKIP_UPLOAD activo: no se sube a TestFlight."
else
    echo "==> Subiendo a TestFlight"
    cd "$ROOT/fastlane"
    NODE_ENV=production bundle exec fastlane ios deploy file:"$IPA" --env "$FASTLANE_ENV_NAME"
    cd "$ROOT"
fi

# ------------------------------------------------------------------ limpieza
# get_apple_api_key() vuelca IOS_API_KEY como <KEY_ID>.p8 en la raiz del repo.
# Esta en .gitignore, pero no hay razon para que una clave privada siga en el
# disco despues del build.

KEY_ID=$(grep -m1 -E '^IOS_API_KEY_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
if [[ -n "$KEY_ID" && -f "$ROOT/$KEY_ID.p8" ]]; then
    rm -f "$ROOT/$KEY_ID.p8"
    echo "==> Borrada la copia temporal de $KEY_ID.p8"
fi

echo
echo "Listo. El build tarda unos minutos en procesarse en App Store Connect"
echo "antes de aparecer en TestFlight."
