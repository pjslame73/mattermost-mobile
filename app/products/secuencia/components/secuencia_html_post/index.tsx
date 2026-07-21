// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {WebView, type WebViewMessageEvent} from 'react-native-webview';

import Markdown from '@components/markdown';
import {isSecuenciaHtmlProps} from '@secuencia/utils/types';
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

const SecuenciaHtmlPost = ({location, post, theme}: Props) => {
    const style = getStyleSheet(theme);
    const [altura, setAltura] = useState(ALTURA_INICIAL);

    const documento = useMemo(() => {
        if (!isSecuenciaHtmlProps(post.props)) {
            return null;
        }
        return construirDocumentoHtml(post.props.html, theme.centerChannelColor);
    }, [post.props, theme.centerChannelColor]);

    const onMessage = (event: WebViewMessageEvent) => {
        const alturaReportada = Number(event.nativeEvent.data);
        if (!Number.isNaN(alturaReportada) && alturaReportada > 0) {
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
