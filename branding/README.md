# Marca Socratix

Personalización de marca de esta app (fork de mattermost-mobile).

| Dato | Valor |
| --- | --- |
| Nombre visible | Socratix |
| Bundle ID / applicationId | `site.conversa.chat` |
| Servidor | `https://chat.conversa.site` |
| Deep link | `socratix://` |
| Callback SSO | `socratixauth://` |
| Apple Team ID | `MQYA69HPUQ` |
| Proyecto Firebase | `conversa-lcp` |

## Fuente de la marca

Todo sale de un solo archivo: **`branding/socratix-logo.png`** (1024×1024, RGBA).
Para cambiar la marca, reemplazá ese PNG y volvé a correr el generador.

```bash
python3 branding/generate-brand-assets.py   # logo -> assets/override/
python3 branding/generate-i18n-overrides.py # textos -> assets/override/i18n/
node scripts/generate-assets.js             # assets/base + override -> dist/assets
```

## Importante: `assets/override/` está en .gitignore

Es la primera línea del `.gitignore` de Mattermost, y lo dejamos así a propósito.
Lo que se commitea es el logo fuente + el generador; `assets/override/` es un
artefacto derivado.

**Consecuencia: después de un clone limpio hay que correr el generador antes de
compilar**, o el build sale con la marca de Mattermost sin avisar:

```bash
python3 branding/generate-brand-assets.py
python3 branding/generate-i18n-overrides.py
npm install     # postinstall.sh ya corre generate-assets.js
```

Lo mismo aplica en CI: el paso del generador va antes de `npm install`.

## Qué genera

75 archivos, todos con las dimensiones exactas de su equivalente en `assets/base/`:

- **Iconos iOS** (15): aplanados sobre blanco, **sin canal alpha** — con alpha
  App Store Connect rechaza el binario.
- **Iconos Android** (25, 5 densidades): legacy con esquinas redondeadas, round
  circular, foreground adaptativo al 52 % (el sistema recorta ~18 % por lado),
  background sólido, y `ic_notification` como **silueta blanca** — Android tinta
  ese icono, cualquier color se ve como una mancha sólida.
- **Splash** (33): Android light + night, iOS light + dark, fondos sólidos
  (`#FFFFFF` / `#090A0B`).
- **Logos in-app** (2): `images/logo.png`, `images/icon.png`.

Trampa del mecanismo de override: `scripts/generate-assets.js` itera sobre los
archivos de `assets/base/` y busca su par en `override/`. **Un archivo que exista
solo en `override/` se ignora en silencio.** El generador valida esto y aborta si
apunta a una ruta que no existe en base.

## Builds de desarrollo

`npm run ios` / `npm run android` no corren el lane `replace_assets` de Fastlane,
así que el icono y el splash **nativos** quedan los de Mattermost. Los assets de
JS (`@assets` → `dist/assets`) sí se toman solos.

```bash
source branding/dev-env.sh   # node 24 / ruby brew / pod 1.16.1 / ANDROID_HOME
npm run brand                # genera + fusiona + copia a ios/ y android/
```

El nombre visible tambien es cosa de Fastlane en release, asi que para dev se
seteo a mano en los dos lados. Si no, el build de desarrollo dice "Mattermost
Beta" abajo del icono:

- Android: `android/app/src/main/res/values/strings.xml` -> `app_name`
- iOS: `CFBundleDisplayName` en `ios/Mattermost/Info.plist` y en
  `ios/MattermostShare/Info.plist`

Fastlane los sobreescribe con `APP_NAME` en release, asi que no hay conflicto.

## Builds de release

Los identificadores los reescribe Fastlane, no están hardcodeados:

```bash
bundle exec fastlane ios build --env ios.socratix
bundle exec fastlane android build --env android.socratix
```

El lane `update_identifiers` reescribe `applicationId`, `namespace`, mueve el
paquete Java y arregla los imports; en iOS reescribe bundle IDs, App Groups,
keychain groups, URL schemes y Team ID. Por eso **`namespace` en
`android/app/build.gradle` se queda en `com.mattermost.rnbeta`**: Fastlane lo
busca en esa ruta hardcodeada (`android/app/src/main/java/com/mattermost/rnbeta/`)
para mover el paquete. Si lo cambiás a mano, el build de release se rompe.

Los secretos van en `fastlane/.env` (gitignored), no en los `.env.*.socratix`.

## Pendiente antes de publicar

1. ~~**Apple Developer portal**~~: HECHO. Los tres App IDs, el App Group
   `group.site.conversa.chat` asignado a los tres, y las capabilities.
   **iCloud no se usa**: las 4 claves se sacaron de `Mattermost.entitlements` y
   el Fastfile solo llama a `update_icloud_container_identifiers` si
   `IOS_ICLOUD_CONTAINER` tiene valor (en `.env.ios.socratix` va vacio).
   `aps-environment` quedo en `production`. La autenticacion con APNs es por
   auth key `.p8` (`FXS872S6QY`), no por certificados.
2. **Push proxy**: `SendPushNotifications` no esta habilitado en
   `chat.conversa.site` (verificado en `/api/v4/config/client?format=old`). Hay
   que prenderlo y apuntarlo al push proxy propio; Mattermost self-compiled no
   puede usar el hosted de Mattermost. Es lo que hace saltar el cartel "No se
   han podido recibir notificaciones de este servidor".
3. **Match**: repo privado de provisioning profiles, después
   `SYNC_PROVISIONING_PROFILES=true`.
4. **Google Play**: falta `SUPPLY_JSON_KEY` (service account). El keystore ya
   esta configurado, ver abajo.
5. **Links legales** (`app/constants/about_links.ts`): privacidad y soporte ya
   apuntan a miportafoliodigital.com. Solo falta `TERMS_OF_SERVICE`, que sigue
   en Mattermost porque no existe todavia la pagina de terminos.
6. **Config del server** (chat.conversa.site): `SiteName` ya dice `Socratix`.
   Faltan los links de soporte, que siguen con los defaults de Mattermost. Los
   lee el cliente web y desktop (la app movil usa los hardcodeados de
   `about_links.ts`). Valores a dejar:

   | Setting | Valor |
   | --- | --- |
   | `TeamSettings.SiteName` | `Socratix` |
   | `SupportSettings.PrivacyPolicyLink` | `https://miportafoliodigital.com/politica-de-privacidad-plataforma-formativa/` |
   | `SupportSettings.HelpLink` | `https://miportafoliodigital.com/support-portal/` |
   | `SupportSettings.ReportAProblemLink` | `https://miportafoliodigital.com/support-portal/` |
   | `SupportSettings.AboutLink` | `https://miportafoliodigital.com/support-portal/` |
   | `SupportSettings.TermsOfServiceLink` | pendiente |
7. **Licencia**: Apache 2.0 permite el fork pero no usar la marca Mattermost.
   El branding visual y los textos ya estan hechos; quedan los puntos 5 y 6.

## Textos: que se rebrandeo y que no

`branding/generate-i18n-overrides.py` genera `assets/override/i18n/*.json` con
solo las claves que cambian, en los 63 idiomas (269 claves en 34 locales tienen
la marca). No se edita `assets/base/i18n/`, asi que Weblate y los merges con
upstream quedan limpios.

Se hace por override y no editando en.json a mano porque `es.json` tenia 14
menciones propias: un usuario con el telefono en espanol seguia viendo
"Mattermost" aunque en.json estuviera perfecto.

### Traducciones al espanol que faltan en upstream

`assets/base/i18n/es.json` trae 1112 claves contra 1703 de `en.json`: **591 sin
traducir**. react-intl cae al `defaultMessage` del codigo, asi que esas cadenas
se ven en ingles.

`branding/es-translations.json` cubre 448 de esas claves. El generador las
mergea al override y les aplica el rebranding, asi que **al traducir se escribe
"Mattermost" normal y sale "Socratix"** — no hay que pensarlo por cadena.

Quedan 143 sin traducir a proposito: 142 son de `playbooks` (el plugin no
arranca, requiere licencia professional) y `about.planNameLearn` es atribucion.

Reglas al agregar traducciones:

- Editar **`branding/es-translations.json`**, nunca `assets/override/i18n/es.json`:
  ese lo genera el script y se pisa en cada corrida.
- El generador aborta si una clave no existe en `en.json` (typo o cadena que
  upstream elimino).
- Registro: tuteo, que es lo que predomina en el es.json existente (109 formas
  con "tu" contra 38 con "usted").
- Validar la sintaxis ICU antes de commitear:

  ```bash
  node -e "const{parse}=require('@formatjs/icu-messageformat-parser');
  const t=require('./branding/es-translations.json');delete t._comment;
  for(const[k,v]of Object.entries(t)){try{parse(v)}catch(e){console.log(k,e.message)}}"
  ```

### El error MISSING_TRANSLATION

`app/i18n/index.ts` exporta `handleIntlError`, conectado a los tres
`IntlProvider` (dos en `app/context/user_locale/index.tsx`, uno en
`app/routes/_layout.tsx`). Sin el, react-intl hace `console.error` por cada
clave sin traducir y eso dispara el LogBox rojo al abrir la app.

Solo silencia `MISSING_TRANSLATION`; cualquier otro error de i18n (sintaxis ICU
rota, formatos invalidos) sigue yendo a `logError`. Vale aclarar que el LogBox
solo se renderiza con `__DEV__`, asi que ese cartel nunca llegaba a produccion.

### Atribucion

Estas 5 claves quedan **intactas a proposito** — son atribucion, no marca:

| Clave | Por que |
| --- | --- |
| `settings.about.copyright` | Aviso de copyright. Apache 2.0 seccion 4(c) obliga a conservarlo. |
| `settings.about.powered_by` | `about.tsx:325` la muestra solo si el bundle id no es de Mattermost, o sea justo en forks como este. Es la atribucion que Mattermost diseno para builds rebrandeados. |
| `settings.notice_text` | Aviso de software open source, linkea a los NOTICE.txt. |
| `about.planNameLearn` | Habla de las ediciones reales de Mattermost. |
| `about.teamEditionLearn` | Linkea a la comunidad de Mattermost. |

## Firma de Android

Keystore: `/Users/pablo.slame/Documents/Certificados MoodleAPP/nuevaapp-upload-key.jks`,
alias `nuevaapp-upload-key`. Es la upload key que ya se usa en las apps Moodle
(AppISAM, CampusUCH, Milicic). Certificado valido hasta **2053-09-01**, muy por
encima del minimo de 2033 que pide Google Play.

Huellas del certificado de subida (`upload_certificate.pem`), para registrar en
Play Console:

```
SHA-1    7A:F7:DF:9C:BE:9E:21:5A:7B:74:45:E4:36:1D:FE:59:2D:B2:69:7E
SHA-256  B7:16:1B:93:64:A5:57:40:AF:09:AF:B9:2C:E1:39:4A:93:C7:7E:8C:81:36:A1:6E:E5:D2:B9:A3:2B:B8:47:96
```

Las credenciales van en `~/.gradle/gradle.properties` (modo 600), **no** en
`android/gradle.properties`: ese archivo del repo no esta en .gitignore, un
secreto ahi termina commiteado.

```properties
MATTERMOST_RELEASE_STORE_FILE=/Users/pablo.slame/Documents/Certificados MoodleAPP/nuevaapp-upload-key.jks
MATTERMOST_RELEASE_KEY_ALIAS=nuevaapp-upload-key
MATTERMOST_RELEASE_PASSWORD=<la password>
```

### Dos trampas de `android/app/build.gradle`

**1. Una sola password para las dos cosas.** El bloque de firma usa
`MATTERMOST_RELEASE_PASSWORD` tanto para `storePassword` como para `keyPassword`.
Si el keystore tiene passwords distintas, el build falla. Se igualan con:

```bash
keytool -keypasswd -keystore "<ruta>.jks" -alias nuevaapp-upload-key
```

**2. Fallback silencioso a la debug key.** La linea es:

```groovy
def useReleaseKey = project.hasProperty('MATTERMOST_RELEASE_STORE_FILE')
```

Si esa propiedad no esta definida, el build de release **se firma con la debug
key sin emitir ningun error**. No se rompe nada visible: sale un AAB que Play
rechaza recien al subirlo. Para verificar antes de subir:

```bash
keytool -printcert -jarfile <archivo>.aab | grep -A1 "SHA1:"
```

Tiene que coincidir con el SHA-1 de arriba. Si da
`SHA1: ...` de `CN=Android Debug`, se firmo con la debug key.
