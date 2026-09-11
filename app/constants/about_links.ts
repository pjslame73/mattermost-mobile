// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Links legales de Socratix.
//
// Se dejan hardcodeados a proposito, aunque el ClientConfig del server expone
// PrivacyPolicyLink y TermsOfServiceLink: hoy esos campos en chat.conversa.site
// tienen los defaults de Mattermost, asi que leerlos mostraria las paginas de
// Mattermost. Hardcodeado no depende de como quede configurado el server.
export default {

    // Terminos propios de Socratix, firmados por Fundacion FUNPEI. Apple los
    // exige por la guia 1.2: tienen que decir explicitamente que no hay
    // tolerancia para contenido objetable ni usuarios abusivos, y el revisor
    // abre este enlace sin cuenta, asi que la pagina no puede pedir login.
    TERMS_OF_SERVICE: 'https://miportafoliodigital.com/terminos-de-uso-de-socratix/',

    PRIVACY_POLICY: 'https://miportafoliodigital.com/politica-de-privacidad-plataforma-formativa/',

    // Baja de cuenta y borrado de datos. Play lo exige como URL declarada en la
    // ficha, y Apple espera que el camino sea alcanzable DESDE la app: una
    // pagina que el alumno no encuentra no es un mecanismo. Por eso ademas se
    // enlaza desde Ajustes -> Acerca de.
    DELETE_ACCOUNT: 'https://miportafoliodigital.com/eliminar-cuenta-socratix/',

    // La pantalla share_feedback abre esto. Antes iba a forum.mattermost.com.
    FEEDBACK_FORUM: 'https://miportafoliodigital.com/support-portal/',
};
