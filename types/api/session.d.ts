// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

interface Session {
    id: string;
    create_at: number;
    device_id?: string;
    expires_at: number;
    user_id: string;
    props?: {
        os: string;
        csrf: string;
    };
}

interface LoginActionResponse {
    error?: unknown;
    failed: boolean;

    // El canje del magic link se freno porque faltan los terminos de uso
    // (guia 1.2 de la App Store). No es un fallo: el enlace NO se gasto y el
    // mismo canje vuelve a intentarse con la aceptacion puesta.
    termsRequired?: boolean;
}
