// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useThemeByAppearanceWithDefault} from '@context/theme';
import {getLoginFlowHeaderOptions, useNavigationHeader} from '@hooks/navigation_header';
import {usePropsFromParams} from '@hooks/props_from_params';
import TermsGateScreen, {type TermsGateProps} from '@screens/terms_gate';

export default function TermsGateRoute() {
    const {theme: themeProp, ...props} = usePropsFromParams<TermsGateProps>();
    const theme = useThemeByAppearanceWithDefault(themeProp);

    useNavigationHeader({
        showWhenPushed: true,
        showWhenRoot: false,
        headerOptions: getLoginFlowHeaderOptions(theme),
    });

    return (
        <TermsGateScreen
            {...props}
            theme={theme}
        />
    );
}
