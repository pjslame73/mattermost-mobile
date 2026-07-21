// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {logError} from '@utils/log';

type Props = {
    children: React.ReactNode;
    fallback: React.ReactNode;
};

type State = {
    hasError: boolean;
};

// Si react-native-render-html (o KaTeX adentro) no puede parsear/pintar un HTML
// puntual, preferimos degradar a Markdown en vez de mostrar el post entero como un
// "hubo un error" -- un error boundary de React solo puede escribirse como clase.
export default class SecuenciaHtmlErrorBoundary extends React.PureComponent<Props, State> {
    state: State = {hasError: false};

    static getDerivedStateFromError() {
        return {hasError: true};
    }

    componentDidCatch(error: Error) {
        logError('error on SecuenciaHtmlPost render, falling back to Markdown', error);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}
