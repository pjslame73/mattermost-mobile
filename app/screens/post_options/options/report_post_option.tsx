// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {defineMessage} from 'react-intl';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {BaseOption} from '@components/common_post_options';
import {ITEM_HEIGHT} from '@components/slide_up_panel_item';
import {isEdgeToEdge} from '@constants/device';
import {NOT_EDGE_TO_EDGE_BOTTOM_SHEET_MARGIN} from '@constants/view';
import {bottomSheet, dismissBottomSheet} from '@screens/navigation';
import ReportPostSheet, {REPORT_SHEET_HEADER_HEIGHT, REPORT_SHEET_ITEMS} from '@secuencia/components/report_post_sheet';
import {bottomSheetSnapPoint} from '@utils/helpers';

type Props = {
    postId: string;
}

const message = defineMessage({
    id: 'mobile.post_info.report',
    defaultMessage: 'Report',
});

/**
 * "Reportar" en el menu de un mensaje.
 *
 * Existe por la guia 1.2 de la App Store, que exige un mecanismo para marcar
 * contenido objetable. En Socratix lo mas reportable no es un companero --el
 * canal tiene dos miembros, el alumno y el bot-- sino la salida del motor
 * socratico, que la genera un LLM. Por eso la opcion aparece sobre cualquier
 * mensaje que no sea propio, sin mirar quien lo escribio.
 */
const ReportPostOption = ({postId}: Props) => {
    const {bottom} = useSafeAreaInsets();

    const onPress = useCallback(async () => {
        // Hay que cerrar el menu del post ANTES de abrir la hoja del motivo: son
        // dos bottom sheets y no se pueden apilar. dismissBottomSheet() espera a
        // que la pantalla salga del stack antes de devolver.
        await dismissBottomSheet();

        const snapBottom = isEdgeToEdge ? bottom : NOT_EDGE_TO_EDGE_BOTTOM_SHEET_MARGIN;

        bottomSheet(
            () => (
                <ReportPostSheet postId={postId}/>
            ),
            [1, bottomSheetSnapPoint(REPORT_SHEET_ITEMS, ITEM_HEIGHT) + REPORT_SHEET_HEADER_HEIGHT + snapBottom],
        );
    }, [bottom, postId]);

    return (
        <BaseOption
            message={message}
            iconName='alert-circle-outline'
            onPress={onPress}
            testID='post_options.report_post.option'
        />
    );
};

export default ReportPostOption;
