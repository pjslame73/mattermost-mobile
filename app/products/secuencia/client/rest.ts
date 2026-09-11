// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReportReason} from '@secuencia/types/report';

export interface ClientSecuenciaMix {
    getBridgeRoute: () => string;
    reportPost: (postId: string, reason: ReportReason) => Promise<{status: string}>;
}

const ClientSecuencia = (superclass: any) => class extends superclass {
    getBridgeRoute = () => {
        return '/plugins/com.conversa.mm-bridge';
    };

    /**
     * Reporta un mensaje por contenido objetable.
     *
     * El puente autentica con la sesion del propio alumno --Mattermost le pone
     * la cabecera Mattermost-User-Id a la peticion-- y comprueba que sea miembro
     * del canal del post antes de aceptar nada. Desde aca solo van el id y el
     * motivo.
     */
    reportPost = async (postId: string, reason: ReportReason) => {
        return this.doFetch(
            `${this.getBridgeRoute()}/reportar`,
            {
                method: 'post',
                body: {post_id: postId, reason},
            },
        );
    };
};

export default ClientSecuencia;
