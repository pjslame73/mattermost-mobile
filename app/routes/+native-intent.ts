// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Linking} from 'react-native';

import {DeepLink, Launch, Screens, Sso} from '@constants';
import DatabaseManager from '@database/manager';
import {DEFAULT_LOCALE} from '@i18n';
import {navigateToScreen} from '@screens/navigation';
import {CONVERSA_MAGIC_PATH, alertInvalidDeepLink, handleDeepLink, parseAndHandleDeepLink, parseDeepLink} from '@utils/deep_link';
import {getIntlShape} from '@utils/general';

/**
 * Custom native intent handler for expo-router
 * This replaces expo-router's default deep link handling with our custom logic
 *
 * Expo-router will use this instead of setting up its own Linking.addEventListener
 * This prevents the "multiple linking configurations" error
 */

/**
 * Set up custom deep link event listener
 * Expo-router calls this function to subscribe to URL events
 */
export const addEventListener = () => {
    // Set up our custom deep link listener
    const handleUrl = async (event: {url: string}) => {
        // Ignore SSO redirect URLs
        if (event.url?.startsWith(Sso.REDIRECT_URL_SCHEME) ||
            event.url?.startsWith(Sso.REDIRECT_URL_SCHEME_DEV)) {
            return;
        }

        if (event.url) {
            const {error} = await parseAndHandleDeepLink(
                event.url,
                undefined,
                undefined,
                true,
            );

            if (error) {
                alertInvalidDeepLink(getIntlShape(DEFAULT_LOCALE));
            }
        }
    };

    // Subscribe to URL events
    const subscription = Linking.addEventListener('url', handleUrl);

    // Return unsubscribe function
    return () => {
        subscription.remove();
    };
};

/**
 * Optional: Redirect system paths if needed
 * We don't need custom redirection, so just return the path as-is
 *
 * Exception: SSO callback URLs (mmauth://, mmauthbeta://) are consumed by the
 * SSO screen's own Linking listener. If they reach expo-router they resolve to
 * an unregistered route. Returning null keeps the app on its current path.
 */
export function redirectSystemPath(options: {path: string; initial: boolean}) {
    if (options.path?.startsWith(Sso.REDIRECT_URL_SCHEME) ||
        options.path?.startsWith(Sso.REDIRECT_URL_SCHEME_DEV)) {
        return null;
    }

    // El acceso por enlace (magic link) llega como una ruta del plugin del
    // servidor -- /plugins/com.conversa.mm-bridge/magic -- que no corresponde a
    // ningun archivo de app/routes. Devolverla tal cual hace que expo-router
    // muestre "Unmatched Route" ANTES de que nadie la procese, con el token
    // intacto y el alumno mirando un 404 dentro de la app.
    //
    // Se manda a la raiz, que es donde vive determineInitialExpoRoute(): esa
    // funcion lee Linking.getInitialURL() y arma las launch props del deep link,
    // que es el camino que el resto de la app ya sabe recorrer.
    //
    // Que esa URL sea la correcta depende de MainActivity.onNewIntent(), que
    // llama a setIntent(): sin eso, getInitialURL() devuelve para siempre el
    // enlace que ABRIO la app y con la app ya abierta se canjea siempre el
    // primero. Los dos cabos van juntos; ver el comentario de MainActivity.kt.
    //
    // El mismo problema tendria el endpoint nativo /login/one_time_link, que
    // tampoco tiene archivo de ruta.
    if (options.path?.includes(CONVERSA_MAGIC_PATH)) {
        // Arranque en frio: NO se canjea aca. La URL sigue viva en el intent, y
        // launch.ts la lee con getInitialURL() para armar las launch props; el
        // canje lo hace use_home_effects al montar Home. Canjearlo tambien aca
        // seria quemar el token dos veces.
        if (options.initial) {
            return '/';
        }

        // En caliente es al reves: NADIE mas lo va a leer. El unico consumidor
        // del intent es use_home_effects, y usa useDidMount, o sea que corre al
        // MONTAR Home y nunca mas. Con la app ya abierta en Home no hay
        // remontaje, asi que devolver '/' aca hacia desaparecer el enlace sin
        // ruido: ni canje, ni error, ni pantalla. Y es el caso mas comun del
        // alumno, que tiene la app abierta cuando le llega el correo.
        //
        // El handler exportado mas abajo (addEventListener) no cubre esto:
        // expo-router busca legacy_subscribe y nunca lo llama, asi que es
        // codigo muerto. Esta funcion es el unico punto por el que la URL en
        // caliente pasa de verdad -- y linking.js SI espera su promesa, por eso
        // se puede canjear desde aca.
        return handleWarmMagicLink(options.path);
    }

    return options.path;
}

/**
 * Canje del enlace de acceso con la app ya abierta.
 *
 * Devuelve null siempre: la ruta del plugin no existe en app/routes, asi que no
 * hay path que devolverle a expo-router. La navegacion posterior al canje se
 * hace a mano, ver abajo.
 *
 * Se separa en una funcion aparte para que redirectSystemPath siga siendo
 * sincrona en el camino de arranque en frio: getLinkingConfig.js asigna su
 * retorno a initialUrl sin esperarlo, y volverla async devolveria una promesa
 * donde el codigo de expo-router espera una cadena.
 *
 * @param path URL completa del evento de Linking.
 * @return null, para no navegar por la via de expo-router.
 */
async function handleWarmMagicLink(path: string) {
    // Se parsea antes de manejar para poder distinguir dos fallas que se
    // comunican distinto: una URL que no parsea (token cortado por el cliente
    // de correo) no muestra nada por su cuenta y necesita el aviso generico;
    // un rechazo del servidor ya muestra su propio motivo, y avisar de nuevo
    // taparia "la cuenta esta desactivada" con un "enlace no valido" que
    // miente sobre lo que paso.
    const parsed = parseDeepLink(path, true);
    if (parsed.type === DeepLink.Invalid) {
        alertInvalidDeepLink(getIntlShape(DEFAULT_LOCALE));
        return null;
    }

    const {error} = await handleDeepLink(parsed);

    // Canjear no alcanza: hay que LLEVAR a la app adentro.
    //
    // En frio no hace falta porque launch.ts decide la ruta DESPUES de loguear,
    // asi que el alumno aterriza en Home solo. En caliente no hay nadie que
    // navegue, y sin esto el canje salia perfecto --sesion creada, credencial
    // guardada, loginEntry ok-- y el alumno se quedaba mirando la pantalla de
    // "Conectemonos a un servidor", ya logueado y sin saberlo. Se verifico en
    // dispositivo con la instrumentacion puesta.
    //
    // Se navega como Launch.Normal y SIN extra a proposito: con Launch.DeepLink,
    // el useDidMount de use_home_effects volveria a canjear el MISMO token que
    // se acaba de quemar, y fuera de la ventana de gracia eso da "este enlace ya
    // se uso" sobre un ingreso que estuvo bien.
    if (!error) {
        const serverUrl = await DatabaseManager.getActiveServerUrl();
        navigateToScreen(Screens.HOME, {serverUrl, launchType: Launch.Normal}, true);
    }

    return null;
}
