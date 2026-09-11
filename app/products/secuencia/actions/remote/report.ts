// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import NetworkManager from '@managers/network_manager';
import {getFullErrorMessage} from '@utils/errors';
import {logError} from '@utils/log';

import type {ReportReason} from '@secuencia/types/report';

/**
 * Reporta un mensaje por contenido objetable.
 *
 * El puente responde sincronicamente: si Moodle no recibio el reporte, devuelve
 * error y el alumno tiene que enterarse. Un "recibimos tu reporte" falso es peor
 * que un error, porque el alumno se queda tranquilo y nadie va a mirar nada.
 *
 * @param serverUrl
 * @param postId  post_id del mensaje reportado.
 * @param reason  Motivo, de la lista cerrada que valida el puente.
 * @returns {data: true} si el reporte quedo encaminado, {error} si no.
 */
export const reportPost = async (serverUrl: string, postId: string, reason: ReportReason) => {
    try {
        const client = NetworkManager.getClient(serverUrl);
        await client.reportPost(postId, reason);
        return {data: true};
    } catch (error) {
        logError('error on reportPost', getFullErrorMessage(error));
        return {error};
    }
};
