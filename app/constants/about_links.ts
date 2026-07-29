// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Links legales de Socratix.
//
// Se dejan hardcodeados a proposito, aunque el ClientConfig del server expone
// PrivacyPolicyLink y TermsOfServiceLink: hoy esos campos en chat.conversa.site
// tienen los defaults de Mattermost, asi que leerlos mostraria las paginas de
// Mattermost. Hardcodeado no depende de como quede configurado el server.
export default {

    // TODO: falta la pagina de terminos de Socratix. Sigue apuntando a
    // Mattermost, que es incorrecto para una app de marca propia.
    TERMS_OF_SERVICE: 'https://about.mattermost.com/default-terms/',

    PRIVACY_POLICY: 'https://miportafoliodigital.com/politica-de-privacidad-plataforma-formativa/',

    // La pantalla share_feedback abre esto. Antes iba a forum.mattermost.com.
    FEEDBACK_FORUM: 'https://miportafoliodigital.com/support-portal/',
};
