// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SecuenciaHtmlProps} from '@secuencia/types/post';

export function isSecuenciaHtmlProps(props: unknown): props is SecuenciaHtmlProps {
    if (typeof props !== 'object' || props === null) {
        return false;
    }

    if (!('html' in props) || typeof props.html !== 'string') {
        return false;
    }

    return true;
}
