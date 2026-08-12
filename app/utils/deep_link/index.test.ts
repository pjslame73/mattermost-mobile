// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';
import {Alert} from 'react-native';

import {joinIfNeededAndSwitchToChannel, makeDirectChannel} from '@actions/remote/channel';
import {showPermalink} from '@actions/remote/permalink';
import {hasLiveSession, magicLinkLogin} from '@actions/remote/session';
import {fetchUsersByUsernames} from '@actions/remote/user';
import {DeepLink, Launch, Preferences, Screens} from '@constants';
import DatabaseManager from '@database/manager';
import WebsocketManager from '@managers/websocket_manager';
import {fetchPlaybookRun} from '@playbooks/actions/remote/runs';
import {getPlaybookRunById} from '@playbooks/database/queries/run';
import {fetchIsPlaybooksEnabled} from '@playbooks/database/queries/version';
import {goToPlaybookRun} from '@playbooks/screens/navigation';
import {getActiveServerUrl} from '@queries/app/servers';
import {getCurrentUser, queryUsersByUsername} from '@queries/servers/user';
import {navigateToRoot} from '@screens/navigation';
import {NavigationStore} from '@store/navigation_store';
import TestHelper from '@test/test_helper';
import {logError} from '@utils/log';
import {addNewServer} from '@utils/server';

import {alertErrorWithFallback, errorBadChannel, errorUnkownUser} from '../draft';

import {alertInvalidDeepLink, extractServerUrl, getLaunchPropsFromDeepLink, parseAndHandleDeepLink, parseDeepLink} from './index';

jest.mock('@actions/remote/user', () => ({
    fetchUsersByUsernames: jest.fn(),
}));

jest.mock('@actions/remote/permalink', () => ({
    showPermalink: jest.fn(),
}));

jest.mock('@queries/app/servers', () => ({
    getActiveServerUrl: jest.fn(),
}));

jest.mock('@queries/servers/user', () => ({
    getCurrentUser: jest.fn(),
    queryUsersByUsername: jest.fn(() => ({fetchIds: jest.fn(() => ['user-id'])})),
}));

jest.mock('@database/manager', () => ({
    searchUrl: jest.fn(),
    setActiveServerDatabase: jest.fn(),
    getServerDatabaseAndOperator: jest.fn(() => ({database: {}, operator: {}})),
}));

jest.mock('@managers/websocket_manager', () => ({
    initializeClient: jest.fn(),
}));

jest.mock('@store/navigation_store', () => ({
    NavigationStore: {
        getVisibleScreen: jest.fn(),
        hasModalsOpened: jest.fn(() => false),
        waitUntilScreenHasLoaded: jest.fn(),
        getScreensInStack: jest.fn().mockReturnValue([]),
    },
}));

jest.mocked(NavigationStore.getVisibleScreen).mockReturnValue(Screens.HOME);

jest.mock('@utils/server', () => ({
    addNewServer: jest.fn(),
}));

jest.mock('@actions/remote/channel', () => ({
    makeDirectChannel: jest.fn(),
    joinIfNeededAndSwitchToChannel: jest.fn(),
}));

jest.mock('@utils/draft', () => ({
    errorBadChannel: jest.fn(),
    errorUnkownUser: jest.fn(),
    alertErrorWithFallback: jest.fn(),
}));

jest.mock('@utils/log', () => ({
    logError: jest.fn(),
}));

jest.mock('@actions/remote/session', () => ({
    magicLinkLogin: jest.fn(() => ({error: undefined})),
    hasLiveSession: jest.fn(() => true),
}));

jest.mock('@i18n', () => ({
    DEFAULT_LOCALE: 'en',
    getTranslations: jest.fn(() => ({})),
    t: jest.fn((id) => id),
}));

jest.mock('@playbooks/database/queries/version');
jest.mock('@playbooks/database/queries/run');
jest.mock('@playbooks/actions/remote/runs');
jest.mock('@playbooks/screens/navigation');
jest.mock('@screens/navigation');

describe('extractServerUrl', () => {
    it('should extract the sanitized server url', () => {
        expect(extractServerUrl('example.com:8080//path/to///login')).toEqual('example.com:8080/path/to');
        expect(extractServerUrl('localhost:3000/signup')).toEqual('localhost:3000');
        expect(extractServerUrl('192.168.0.1/admin_console')).toEqual('192.168.0.1');
        expect(extractServerUrl('example.com/path//to/resource')).toEqual('example.com/path/to/resource');
        expect(extractServerUrl('my.local.network/.../resource/admin_console')).toEqual('my.local.network/resource');
        expect(extractServerUrl('my.local.network//ad-1/channels/%252f%252e.town-square')).toEqual(null);
        expect(extractServerUrl('example.com:8080')).toEqual('example.com:8080');
        expect(extractServerUrl('example.com:8080/')).toEqual('example.com:8080');
    });
});

describe('parseAndHandleDeepLink', () => {
    const intl = createIntl({locale: 'en', messages: {}});

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return error for invalid deep link', async () => {
        const result = await parseAndHandleDeepLink('invalid-url');
        expect(result).toEqual({error: true});
    });

    it('should add new server if not existing', async () => {
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://currentserver.com');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('');
        const result = await parseAndHandleDeepLink('https://newserver.com/team/channels/town-square');
        expect(addNewServer).toHaveBeenCalledWith(Preferences.THEMES.denim, 'newserver.com', undefined, {type: DeepLink.Channel,
            data: {
                serverUrl: 'newserver.com',
                channelName: 'town-square',
                teamName: 'team',
            },
            url: 'https://newserver.com/team/channels/town-square',
        });
        expect(result).toEqual({error: false});
    });

    it('should handle existing server and switch to home screen', async () => {
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://currentserver.com');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        const result = await parseAndHandleDeepLink('https://existingserver.com/team/channels/town-square');
        expect(navigateToRoot).toHaveBeenCalled();
        expect(DatabaseManager.setActiveServerDatabase).toHaveBeenCalledWith('https://existingserver.com');
        expect(WebsocketManager.initializeClient).toHaveBeenCalledWith('https://existingserver.com', 'DeepLink');
        expect(result).toEqual({error: false});
    });

    it('should not display the new server modal if the server screen is on the stack but not as the visible screen', async () => {
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://currentserver.com');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce(undefined);

        jest.mocked(NavigationStore.getVisibleScreen).mockReturnValueOnce(Screens.LOGIN);
        jest.mocked(NavigationStore.getScreensInStack).mockReturnValueOnce([Screens.SERVER, Screens.LOGIN]);
        const result = await parseAndHandleDeepLink('https://currentserver.com/team/channels/town-square', undefined, undefined, true);
        expect(addNewServer).not.toHaveBeenCalled();
        expect(result).toEqual({error: false});
    });

    it('should switch to channel by name for Channel deep link', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        const result = await parseAndHandleDeepLink('https://existingserver.com/team/channels/town-square', intl);
        expect(joinIfNeededAndSwitchToChannel).toHaveBeenCalledWith('https://existingserver.com', {name: 'town-square'}, {name: 'team'}, errorBadChannel, intl);
        expect(result).toEqual({error: false});
    });

    it('should create direct message for DirectMessage deep link', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        (queryUsersByUsername as jest.Mock).mockReturnValueOnce(TestHelper.fakeQuery([TestHelper.fakeUserModel({id: 'user-id'})]));
        const result = await parseAndHandleDeepLink('https://existingserver.com/team/messages/@user-id', intl);
        expect(makeDirectChannel).toHaveBeenCalledWith('https://existingserver.com', 'user-id', '', true);
        expect(result).toEqual({error: false});
    });

    it('should fetch user and create direct message if user not found locally', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        jest.mocked(fetchUsersByUsernames).mockResolvedValueOnce({users: [TestHelper.fakeUser({id: 'user-id'})]});
        jest.mocked(queryUsersByUsername).mockReturnValueOnce(TestHelper.fakeQuery([]));
        const result = await parseAndHandleDeepLink('https://existingserver.com/team/messages/@user-id', intl);
        expect(makeDirectChannel).toHaveBeenCalledWith('https://existingserver.com', 'user-id', '', true);
        expect(result).toEqual({error: false});
    });

    it('should show unknown user error if user not found', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        jest.mocked(queryUsersByUsername).mockReturnValueOnce(TestHelper.fakeQuery([]));
        jest.mocked(fetchUsersByUsernames).mockResolvedValueOnce({users: []});
        const result = await parseAndHandleDeepLink('https://existingserver.com/team/messages/@user-id', intl);
        expect(errorUnkownUser).toHaveBeenCalledWith(intl);
        expect(result).toEqual({error: false});
    });

    it('should switch to group message channel for GroupMessage deep link', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        const result = await parseAndHandleDeepLink('https://existingserver.com/team/messages/7b35c77a645e1906e03a2c330f89203385db102f', intl);
        expect(joinIfNeededAndSwitchToChannel).toHaveBeenCalledWith('https://existingserver.com', {name: '7b35c77a645e1906e03a2c330f89203385db102f'}, {name: 'team'}, errorBadChannel, intl);
        expect(result).toEqual({error: false});
    });

    it('should show permalink for Permalink deep link', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        const postid = '7b35c77a645e1906e03a2c330f';
        const result = await parseAndHandleDeepLink(`https://existingserver.com/team/pl/${postid}`, intl);
        expect(showPermalink).toHaveBeenCalledWith('https://existingserver.com', 'team', postid);
        expect(result).toEqual({error: false});
    });

    it('should log error and return error true on failure', async () => {
        jest.mocked(getActiveServerUrl).mockImplementationOnce(() => {
            throw new Error('DB does not exist error');
        });
        const result = await parseAndHandleDeepLink('https://existingserver.com/team/messages/7b35c77a645e1906e03a2c330f89203385db102f');
        expect(logError).toHaveBeenCalledWith('Failed to open channel from deeplink', expect.any(Error), undefined);
        expect(result).toEqual({error: true});
    });

    it('should alert when Playbooks deep link is used', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        await parseAndHandleDeepLink('https://existingserver.com/playbooks/playbooks/7b35c77a645e1906e03a2c330f', intl);
        expect(alertSpy).toHaveBeenCalledWith(
            intl.formatMessage({id: 'playbooks.only_runs_available.title', defaultMessage: 'Playbooks not available'}),
            intl.formatMessage({id: 'playbooks.only_runs_available.description', defaultMessage: 'Only Playbook Checklists are available on mobile. To access the Playbook, please use the desktop or web app.'}),
            [{text: intl.formatMessage({id: 'playbooks.only_runs_available.ok', defaultMessage: 'OK'})}],
        );
    });

    it('should alert when PlaybookRunsRetrospective deep link is used', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        await parseAndHandleDeepLink('https://existingserver.com/playbooks/runs/7b35c77a645e1906e03a2c330f/retrospective', intl);
        expect(alertSpy).toHaveBeenCalledWith(
            intl.formatMessage({id: 'playbooks.retrospective_not_available.title', defaultMessage: 'Playbooks Retrospective not available'}),
            intl.formatMessage({id: 'playbooks.retrospective_not_available.description', defaultMessage: 'Only Playbook Checklists are available on mobile. To fill the Run Retrospective, please use the desktop or web app.'}),
            [{text: intl.formatMessage({id: 'playbooks.retrospective_not_available.ok', defaultMessage: 'OK'})}],
        );
    });

    it('should go to playbook run if enabled and playbook exists', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        jest.mocked(fetchIsPlaybooksEnabled).mockResolvedValue(true);
        jest.mocked(getPlaybookRunById).mockResolvedValue(TestHelper.fakePlaybookRunModel({id: '7b35c77a645e1906e03a2c330f'}));
        jest.mocked(goToPlaybookRun).mockImplementation(jest.fn());

        // Re-import to apply mocks
        await parseAndHandleDeepLink('https://existingserver.com/playbooks/runs/7b35c77a645e1906e03a2c330f', intl);
        expect(goToPlaybookRun).toHaveBeenCalledWith('7b35c77a645e1906e03a2c330f');
    });

    it('should fetch playbook run if not found locally and show error if fetch fails', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        jest.mocked(fetchIsPlaybooksEnabled).mockResolvedValue(true);
        jest.mocked(getPlaybookRunById).mockResolvedValue(undefined);
        jest.mocked(fetchPlaybookRun).mockResolvedValue({error: true});

        // Re-import to apply mocks
        await parseAndHandleDeepLink('https://existingserver.com/playbooks/runs/7b35c77a645e1906e03a2c330f', intl);
        expect(alertSpy).toHaveBeenCalledWith(
            intl.formatMessage({id: 'playbooks.fetch_error.title', defaultMessage: 'Unable to open Checklist'}),
            intl.formatMessage({id: 'playbooks.fetch_error.description', defaultMessage: "You don't have permission to view this, or it may no longer exist."}),
            [{text: intl.formatMessage({id: 'playbooks.fetch_error.OK', defaultMessage: 'Okay'})}],
        );
    });

    it('should alert if playbooks are not enabled or version not supported', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://existingserver.com');
        jest.mocked(getActiveServerUrl).mockResolvedValueOnce('https://existingserver.com');
        jest.mocked(fetchIsPlaybooksEnabled).mockResolvedValue(false);

        // Re-import to apply mocks
        await parseAndHandleDeepLink('https://existingserver.com/playbooks/runs/7b35c77a645e1906e03a2c330f', intl);
        expect(alertSpy).toHaveBeenCalledWith(
            intl.formatMessage({id: 'playbooks.not_enabled_or_unsupported.title', defaultMessage: 'Playbooks not available'}),
            intl.formatMessage({id: 'playbooks.not_enabled_or_unsupported.description', defaultMessage: 'Playbooks are either not enabled on this server or the Playbooks version is not supported. Please contact your system administrator.'}),
            [{text: intl.formatMessage({id: 'playbooks.not_enabled_or_unsupported.OK', defaultMessage: 'OK'})}],
        );
    });
});

describe('getLaunchPropsFromDeepLink', () => {
    it('should return launch props with launchError when deep link is invalid', () => {
        const result = getLaunchPropsFromDeepLink('invalid-url');

        expect(result).toEqual({
            launchType: Launch.DeepLink,
            coldStart: false,
            launchError: true,
            extra: {
                type: DeepLink.Invalid,
                url: 'invalid-url',
            },
        });
    });

    it('should return launch props with extra data when deep link is valid', () => {
        const extraData = {
            type: DeepLink.Channel,
            data: {
                channelName: 'town-square',
                serverUrl: 'existingserver.com',
                teamName: 'team',
            },
            url: 'https://existingserver.com/team/channels/town-square',
        };
        const result = getLaunchPropsFromDeepLink('https://existingserver.com/team/channels/town-square', true);

        expect(result).toEqual({
            launchType: Launch.DeepLink,
            coldStart: true,
            extra: extraData,
        });
    });

    it('should return launch props with extra data to add a new server when opened from cold start', () => {
        const extraData = {
            type: DeepLink.Server,
            data: {
                serverUrl: 'existingserver.com',
            },
            url: 'https://existingserver.com/login',
        };
        const result = getLaunchPropsFromDeepLink('https://existingserver.com/login', true);

        expect(result).toEqual({
            launchType: Launch.DeepLink,
            coldStart: true,
            extra: extraData,
        });
    });
});

describe('alertInvalidDeepLink', () => {
    it('should call alertErrorWithFallback with correct arguments', () => {
        const intl = createIntl({locale: 'en', messages: {}});
        const message = {
            id: 'mobile.deep_link.invalid',
            defaultMessage: 'This link you are trying to open is invalid.',
        };

        alertInvalidDeepLink(intl);

        expect(alertErrorWithFallback).toHaveBeenCalledWith(intl, {}, message);
    });
});

describe('parseDeepLink — acceso por enlace de Conversa', () => {
    // Token real emitido por el PHP de Moodle (local_sms_start_mm\local\magic_link),
    // el mismo fixture que usa magic_test.go del plugin. Se usa uno de verdad y
    // no uno inventado para que el test pruebe el formato que va a llegar.
    const TOKEN = 'eyJraWQiOjEsInN1YiI6InU0eDlrMm03bjFwM3E1cjhzMHQydjR3Nnk4IiwianRpIjoiYTFiMmMzZDRlNWY2MDcxODI5M2E0YjVjNmQ3ZThmOTAiLCJpYXQiOjE3ODAwMDAwMDAsImV4cCI6MTc4MDE3MjgwMH0.GUC0LkSiJCQFs2LyB1rnyGZ2MKUtT2i9DLD2MzX5yzo';
    const BASE = 'https://chat.conversa.site/plugins/com.conversa.mm-bridge/magic';

    it('rutea la URL del plugin como MagicLink y extrae el token de ?t=', () => {
        const result = parseDeepLink(`${BASE}?t=${TOKEN}`);

        expect(result.type).toBe(DeepLink.MagicLink);
        const data = result.data as {serverUrl: string; token: string};
        expect(data.token).toBe(TOKEN);
        expect(data.serverUrl).toBe('chat.conversa.site');
    });

    it('rutea tambien por el esquema mattermost://, que es como se prueba sin assetlinks.json', () => {
        const result = parseDeepLink(`mattermost://chat.conversa.site/plugins/com.conversa.mm-bridge/magic?t=${TOKEN}`);

        expect(result.type).toBe(DeepLink.MagicLink);
        const data = result.data as {serverUrl: string; token: string};
        expect(data.token).toBe(TOKEN);
        expect(data.serverUrl).toBe('chat.conversa.site');
    });

    it('sigue aceptando el formato nativo de Mattermost (64 hexadecimales)', () => {
        const nativo = 'a'.repeat(64);
        const result = parseDeepLink(`${BASE}?t=${nativo}`);

        expect(result.type).toBe(DeepLink.MagicLink);
        expect((result.data as {token: string}).token).toBe(nativo);
    });

    it('rechaza la URL sin token', () => {
        expect(parseDeepLink(BASE).type).toBe(DeepLink.Invalid);
    });

    it('rechaza un token con caracteres fuera de base64url', () => {
        expect(parseDeepLink(`${BASE}?t=no valido!.firma`).type).toBe(DeepLink.Invalid);
    });

    it('rechaza un token sin los dos segmentos', () => {
        expect(parseDeepLink(`${BASE}?t=soloUnSegmento`).type).toBe(DeepLink.Invalid);
    });

    it('ya no rutea el endpoint nativo /login/one_time_link', () => {
        const result = parseDeepLink(`https://chat.conversa.site/login/one_time_link?t=${TOKEN}`);

        expect(result.type).not.toBe(DeepLink.MagicLink);
    });
});

describe('handleDeepLink — canje del enlace de acceso de Conversa', () => {
    const TOKEN = 'eyJraWQiOjEsInN1YiI6InU0eDlrMm03bjFwM3E1cjhzMHQydjR3Nnk4IiwianRpIjoiYTFiMmMzZDRlNWY2MDcxODI5M2E0YjVjNmQ3ZThmOTAiLCJpYXQiOjE3ODAwMDAwMDAsImV4cCI6MTc4MDE3MjgwMH0.GUC0LkSiJCQFs2LyB1rnyGZ2MKUtT2i9DLD2MzX5yzo';
    const URL = `https://chat.conversa.site/plugins/com.conversa.mm-bridge/magic?t=${TOKEN}`;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getActiveServerUrl).mockResolvedValue('https://chat.conversa.site');
    });

    // El caso que estaba roto. La app se distribuye apuntando a un unico
    // servidor propio, asi que queda registrado desde el primer ingreso: si el
    // canje dependiera de que el servidor sea desconocido, el enlace serviria
    // una sola vez por dispositivo.
    it('canjea aunque el servidor ya este registrado, si no hay sesion', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://chat.conversa.site');
        jest.mocked(getCurrentUser).mockResolvedValueOnce(undefined);

        const result = await parseAndHandleDeepLink(URL);

        expect(magicLinkLogin).toHaveBeenCalledWith('chat.conversa.site', TOKEN);
        expect(result).toEqual({error: false});
    });

    it('canjea tambien con el servidor sin registrar (primer ingreso)', async () => {
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('');

        const result = await parseAndHandleDeepLink(URL);

        expect(magicLinkLogin).toHaveBeenCalledWith('chat.conversa.site', TOKEN);
        expect(addNewServer).not.toHaveBeenCalled();
        expect(result).toEqual({error: false});
    });

    // El aviso queda reservado para la unica situacion en que es cierto. Antes
    // salia con solo tener el servidor registrado, o sea tambien para el alumno
    // que NO tenia sesion: le decia lo contrario de lo que pasaba y lo dejaba
    // sin salida, porque nunca entra a Moodle.
    it('avisa "ya iniciaste sesion" con sesion viva, y no quema el token', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://chat.conversa.site');
        jest.mocked(getCurrentUser).mockResolvedValueOnce(TestHelper.fakeUserModel({locale: 'es'}));
        jest.mocked(hasLiveSession).mockResolvedValueOnce(true);

        const result = await parseAndHandleDeepLink(URL);

        expect(magicLinkLogin).not.toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalled();
        expect(result).toEqual({error: false});
    });

    // El usuario cacheado NO prueba que haya sesion: sale de la base local, que
    // sobrevive hasta que un 401 dispara el logout. En esa ventana el alumno
    // recibia "ya iniciaste sesion" sin tenerla, el enlace no se canjeaba, y al
    // ir a Home el 401 lo devolvia a la pantalla de servidor. Intermitente
    // porque dependia de si el 401 ya se habia disparado.
    it('canjea igual si quedo un usuario cacheado pero el servidor ya no reconoce la sesion', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://chat.conversa.site');
        jest.mocked(getCurrentUser).mockResolvedValueOnce(TestHelper.fakeUserModel({locale: 'es'}));
        jest.mocked(hasLiveSession).mockResolvedValueOnce(false);

        const result = await parseAndHandleDeepLink(URL);

        expect(magicLinkLogin).toHaveBeenCalledWith('chat.conversa.site', TOKEN);
        expect(alertSpy).not.toHaveBeenCalled();
        expect(result).toEqual({error: false});
    });

    // El servidor manda el motivo ya redactado para el alumno. Antes moria en
    // logcat y la app se quedaba muda: sin esto, "no pasa nada" es
    // indistinguible de "el enlace ya se uso".
    it('muestra el motivo que devuelve el servidor cuando el canje falla', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        const motivo = 'Este enlace ya se uso. Pedi uno nuevo desde la pantalla de ingreso.';
        jest.mocked(DatabaseManager.searchUrl).mockReturnValueOnce('https://chat.conversa.site');
        jest.mocked(getCurrentUser).mockResolvedValueOnce(undefined);
        jest.mocked(magicLinkLogin).mockResolvedValueOnce({error: new Error(motivo), failed: true});

        const result = await parseAndHandleDeepLink(URL);

        expect(logError).toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith(expect.any(String), motivo, expect.any(Array));
        expect(result).toEqual({error: true});
    });
});
