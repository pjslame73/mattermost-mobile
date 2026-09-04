// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fetchCommands} from '@actions/remote/command';
import {Screens} from '@constants';
import {navigateToScreen} from '@screens/navigation';

const TIME_TO_REFETCH_COMMANDS = 60000; // 1 minute
class ServerIntegrationsManager {
    private serverUrl: string;
    private commandsLastFetched: {[teamId: string]: number | undefined} = {};
    private commands: {[teamId: string]: Command[] | undefined} = {};

    private triggerId = '';
    private storedDialog?: InteractiveDialogConfig;

    // Canal del post que disparo el dialogo.
    //
    // Hace falta porque InteractiveDialogConfig no trae el canal (ver
    // types/api/integrations.d.ts) y el envio SI lo necesita. Sin esto,
    // submitInteractiveDialog() lo completaba con getCurrentChannelId(), o sea con el
    // canal que el usuario esta MIRANDO, que no tiene por que ser el del dialogo: si
    // entro por la pestana de Hilos sin pasar por un canal, va vacio o viejo y el
    // servidor rechaza el envio antes de llamar a la integracion. El sintoma es "Fallo
    // el envio" sin ningun detalle, y del lado de la integracion no queda rastro
    // porque la peticion nunca le llega.
    private triggerChannelId = '';

    constructor(serverUrl: string) {
        this.serverUrl = serverUrl;
    }

    public async fetchCommands(teamId: string) {
        const lastFetched = this.commandsLastFetched[teamId] || 0;
        const lastCommands = this.commands[teamId];
        if (lastCommands && lastFetched + TIME_TO_REFETCH_COMMANDS > Date.now()) {
            return lastCommands;
        }

        try {
            const res = await fetchCommands(this.serverUrl, teamId);
            if ('error' in res) {
                return [];
            }
            this.commands[teamId] = res.commands;
            this.commandsLastFetched[teamId] = Date.now();
            return res.commands;
        } catch {
            return [];
        }
    }

    public setTriggerId(id: string, channelId = '') {
        this.triggerId = id;
        if (channelId) {
            this.triggerChannelId = channelId;
        }
        if (this.storedDialog?.trigger_id === id) {
            this.showDialog();
        }
    }

    /**
     * Canal del post que disparo el dialogo abierto, o cadena vacia si no se conoce.
     * Lo usa submitInteractiveDialog() en vez del canal que el usuario esta mirando.
     */
    public getTriggerChannelId() {
        return this.triggerChannelId;
    }

    public setDialog(dialog: InteractiveDialogConfig) {
        this.storedDialog = dialog;
        if (this.triggerId === dialog.trigger_id) {
            this.showDialog();
        }
    }

    private showDialog() {
        const config = this.storedDialog;
        if (!config) {
            return;
        }

        navigateToScreen(Screens.DIALOG_ROUTER, {title: config.dialog.title, config});
    }
}

class IntegrationsManagerSingleton {
    private serverManagers: {[serverUrl: string]: ServerIntegrationsManager | undefined} = {};
    public getManager(serverUrl: string): ServerIntegrationsManager {
        if (!this.serverManagers[serverUrl]) {
            this.serverManagers[serverUrl] = new ServerIntegrationsManager(serverUrl);
        }

        return this.serverManagers[serverUrl]!;
    }
}

const IntegrationsManager = new IntegrationsManagerSingleton();
export default IntegrationsManager;
