// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DeepLink, Launch, Screens} from '@constants';
import {navigateToScreen} from '@screens/navigation';
import {alertInvalidDeepLink, handleDeepLink, parseDeepLink} from '@utils/deep_link';

import {redirectSystemPath} from './+native-intent';

jest.mock('@utils/deep_link', () => ({
    CONVERSA_MAGIC_PATH: '/plugins/com.conversa.mm-bridge/magic',
    alertInvalidDeepLink: jest.fn(),
    handleDeepLink: jest.fn(() => ({error: false})),
    parseAndHandleDeepLink: jest.fn(),
    parseDeepLink: jest.fn(),
}));

jest.mock('@screens/navigation', () => ({navigateToScreen: jest.fn()}));

jest.mock('@database/manager', () => ({
    __esModule: true,
    default: {getActiveServerUrl: jest.fn(() => 'https://chat.conversa.site')},
}));

jest.mock('react-native', () => ({Linking: {addEventListener: jest.fn()}}));

describe('redirectSystemPath', () => {
    // El caso que motiva el desvio: la ruta del plugin no existe como archivo
    // en app/routes, asi que devolverla tal cual hace que expo-router muestre
    // "Unmatched Route" y el alumno vea un 404 dentro de la app, con el token
    // sin canjear. Mandarla a la raiz deja que determineInitialExpoRoute() lea
    // la URL inicial y siga el camino normal de deep link.
    it('should send the Conversa magic link to the root route', () => {
        const path = 'mattermost://chat.conversa.site/plugins/com.conversa.mm-bridge/magic?t=abc.def';

        expect(redirectSystemPath({path, initial: true})).toBe('/');
    });

    it('should send the magic link to the root regardless of the scheme', () => {
        const path = 'socratix://chat.conversa.site/plugins/com.conversa.mm-bridge/magic?t=abc.def';

        expect(redirectSystemPath({path, initial: true})).toBe('/');
    });

    it('should leave any other path untouched', () => {
        const path = 'mattermost://chat.conversa.site/socratix/channels/town-square';

        expect(redirectSystemPath({path, initial: true})).toBe(path);
    });
});

describe('redirectSystemPath — con la app ya abierta', () => {
    const PATH = 'socratix://chat.conversa.site/plugins/com.conversa.mm-bridge/magic?t=abc.def';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Antes esta rama devolvia '/' igual que en frio, y el enlace se perdia sin
    // dejar rastro: ni canje, ni error, ni pantalla. Se comprobo en dispositivo
    // -- Android confirmo "intent has been delivered to currently running
    // top-most instance" y la app no hizo nada.
    //
    // La causa: el unico consumidor del intent es use_home_effects, con
    // useDidMount. Corre al MONTAR Home. Con la app ya en Home no hay
    // remontaje, asi que devolver '/' no despierta a nadie.
    //
    // Un comentario anterior aca desaconsejaba ramificar por options.initial
    // porque "fue un camino sin salida". Era cierto ENTONCES y por otro motivo:
    // se intento antes de que MainActivity.onNewIntent() llamara a setIntent(),
    // o sea sin ninguna URL nueva que leer. Con el intent ya actualizado, esta
    // es la unica rama por la que la URL en caliente pasa de verdad.
    it('canjea el enlace en vez de perderlo', async () => {
        jest.mocked(parseDeepLink).mockReturnValueOnce({type: DeepLink.MagicLink} as never);

        const result = await redirectSystemPath({path: PATH, initial: false});

        expect(handleDeepLink).toHaveBeenCalled();
        expect(result).toBeNull();
    });

    // Canjear no alcanza. Se vio en dispositivo con la instrumentacion puesta:
    // sesion creada, credencial guardada, loginEntry ok... y el alumno mirando
    // "Conectemonos a un servidor", ya logueado y sin enterarse. En frio navega
    // launch.ts despues de loguear; en caliente no hay nadie que lo haga.
    it('lleva la app a Home despues de canjear', async () => {
        jest.mocked(parseDeepLink).mockReturnValueOnce({type: DeepLink.MagicLink} as never);

        await redirectSystemPath({path: PATH, initial: false});

        expect(navigateToScreen).toHaveBeenCalledWith(
            Screens.HOME,
            {serverUrl: 'https://chat.conversa.site', launchType: Launch.Normal},
            true,
        );
    });

    // Con Launch.DeepLink, el useDidMount de use_home_effects volveria a canjear
    // el mismo token recien quemado.
    it('no navega como deep link, para no recanjear el token', async () => {
        jest.mocked(parseDeepLink).mockReturnValueOnce({type: DeepLink.MagicLink} as never);

        await redirectSystemPath({path: PATH, initial: false});

        const props = jest.mocked(navigateToScreen).mock.calls[0][1];
        expect(props?.launchType).not.toBe(Launch.DeepLink);
        expect(props?.extra).toBeUndefined();
    });

    it('no navega si el canje fallo', async () => {
        jest.mocked(parseDeepLink).mockReturnValueOnce({type: DeepLink.MagicLink} as never);
        jest.mocked(handleDeepLink).mockResolvedValueOnce({error: true});

        await redirectSystemPath({path: PATH, initial: false});

        expect(navigateToScreen).not.toHaveBeenCalled();
    });

    // En frio NO se canjea aca: launch.ts lee la URL con getInitialURL() y el
    // canje lo hace use_home_effects al montar Home. Hacerlo en los dos lados
    // quemaria el token dos veces, y el segundo canje daria "este enlace ya se
    // uso" sobre el ingreso legitimo del alumno.
    it('en frio sigue desviando a la raiz, sin canjear', () => {
        expect(redirectSystemPath({path: PATH, initial: true})).toBe('/');
        expect(handleDeepLink).not.toHaveBeenCalled();
    });

    // Un token cortado por el cliente de correo no llega a hablar con el
    // servidor, asi que nadie muestra un motivo: sin este aviso el alumno toca
    // el boton y no pasa absolutamente nada.
    it('avisa cuando la URL no parsea', async () => {
        jest.mocked(parseDeepLink).mockReturnValueOnce({type: DeepLink.Invalid} as never);

        const result = await redirectSystemPath({path: PATH, initial: false});

        expect(alertInvalidDeepLink).toHaveBeenCalled();
        expect(handleDeepLink).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });
});
