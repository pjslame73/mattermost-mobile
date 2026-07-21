// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Coincide con lo que manda mod_secuenciadidacticamm (mm_enviar_descripcion() en
// lib.php): props.html es el HTML de TinyMCE ya procesado por
// html_a_html_enriquecido() -- imagen/audio/video ya extraídos como adjunto nativo,
// ecuaciones LaTeX dejadas como texto crudo para renderizar acá con KaTeX.
export type SecuenciaHtmlProps = {
    html: string;
};
