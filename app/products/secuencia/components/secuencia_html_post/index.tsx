// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isSecuenciaHtmlProps} from '@secuencia/utils/types';
import React, {useMemo, useState} from 'react';
import {WebView, type WebViewMessageEvent} from 'react-native-webview';

import Markdown from '@components/markdown';
import {makeStyleSheetFromTheme} from '@utils/theme';

import {construirDocumentoHtml} from './build_document';
import SecuenciaHtmlErrorBoundary from './error_boundary';

import type PostModel from '@typings/database/models/servers/post';
import type {AvailableScreens} from '@typings/screens/navigation';

type Props = {
    location: AvailableScreens;
    post: PostModel;
    theme: Theme;
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        message: {
            color: theme.centerChannelColor,
        },
    };
});

const ALTURA_INICIAL = 24;

// Alturas ya medidas, por id de post.
//
// El WebView no puede saber cuanto mide hasta que renderiza: arranca en
// ALTURA_INICIAL y crece cuando reporta la real por onMessage. Eso esta bien la
// primera vez, pero la lista del hilo es INVERTIDA y el post raiz vive al final
// del contenido: cuando varias respuestas crecen de golpe despues del layout, el
// root se desplaza hacia arriba y queda fuera de la pantalla, sin forma de
// traerlo con el scroll.
//
// Guardando la altura medida, la segunda vez que se monta el mismo post -- que es
// el caso habitual, porque el alumno entra y sale del hilo -- arranca directo con
// el valor bueno y no hay salto.
//
// El mapa crece con los posts vistos en la sesion y no se limpia: son un id y un
// numero por post, y se va entero cuando se cierra la app.
const alturasMedidas = new Map<string, number>();

const SecuenciaHtmlPost = ({location, post, theme}: Props) => {
    const style = getStyleSheet(theme);
    const [altura, setAltura] = useState(() => alturasMedidas.get(post.id) ?? ALTURA_INICIAL);

    const documento = useMemo(() => {
        if (!isSecuenciaHtmlProps(post.props)) {
            return null;
        }
        return construirDocumentoHtml(post.props.html, theme.centerChannelColor);
    }, [post.props, theme.centerChannelColor]);

    const onMessage = (event: WebViewMessageEvent) => {
        const alturaReportada = Number(event.nativeEvent.data);
        if (!Number.isNaN(alturaReportada) && alturaReportada > 0) {
            alturasMedidas.set(post.id, alturaReportada);
            setAltura(alturaReportada);
        }
    };

    const fallbackMarkdown = (
        <Markdown
            baseTextStyle={style.message}
            channelId={post.channelId}
            postId={post.id}
            value={post.message}
            theme={theme}
            location={location}
        />
    );

    if (documento === null) {
        // No debería pasar (mm_enviar_descripcion() siempre manda props.html para
        // este tipo de post) pero si falta, degradamos al mensaje en Markdown en
        // vez de mostrar un post vacío.
        return fallbackMarkdown;
    }

    return (
        <SecuenciaHtmlErrorBoundary fallback={fallbackMarkdown}>
            <WebView
                originWhitelist={['*']}
                source={{html: documento}}
                onMessage={onMessage}
                style={{height: altura, width: '100%', backgroundColor: 'transparent'}}
                scrollEnabled={false}
                javaScriptEnabled={true}
                setSupportMultipleWindows={false}
            />
        </SecuenciaHtmlErrorBoundary>
    );
};

export default SecuenciaHtmlPost;
