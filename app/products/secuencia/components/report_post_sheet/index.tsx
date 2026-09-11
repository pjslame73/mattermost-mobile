// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Alert, View} from 'react-native';

import FormattedText from '@components/formatted_text';
import SlideUpPanelItem from '@components/slide_up_panel_item';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {dismissBottomSheet} from '@screens/navigation';
import {reportPost} from '@secuencia/actions/remote/report';
import {ReportReason} from '@secuencia/types/report';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import type {CompassIconName} from '@components/compass_icon';

/**
 * Alto del encabezado de la hoja: titulo mas su margen. Lo necesita quien la
 * abre para calcular el snap point, porque el alto real no se puede medir antes
 * de renderizar.
 */
export const REPORT_SHEET_HEADER_HEIGHT = 68;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    header: {
        marginBottom: 12,
    },
    title: {
        color: theme.centerChannelColor,
        ...typography('Heading', 600, 'SemiBold'),
    },
    subtitle: {
        color: changeOpacity(theme.centerChannelColor, 0.64),
        marginTop: 4,
        ...typography('Body', 75, 'Regular'),
    },
}));

const messages = defineMessages({
    title: {
        id: 'secuencia.report.title',
        defaultMessage: 'Report this message',
    },
    subtitle: {
        id: 'secuencia.report.subtitle',
        defaultMessage: 'We review reports within 24 hours.',
    },
    ofensivo: {
        id: 'secuencia.report.reason.offensive',
        defaultMessage: 'Offensive content',
    },
    acoso: {
        id: 'secuencia.report.reason.harassment',
        defaultMessage: 'Harassment or abuse',
    },
    spam: {
        id: 'secuencia.report.reason.spam',
        defaultMessage: 'Spam',
    },
    otro: {
        id: 'secuencia.report.reason.other',
        defaultMessage: 'Something else',
    },
    sentTitle: {
        id: 'secuencia.report.sent.title',
        defaultMessage: 'Report sent',
    },
    sentBody: {
        id: 'secuencia.report.sent.body',
        defaultMessage: 'Thanks for letting us know. We review reports within 24 hours and remove content that breaks the rules.',
    },
    errorTitle: {
        id: 'secuencia.report.error.title',
        defaultMessage: 'We could not send your report',
    },
    errorBody: {
        id: 'secuencia.report.error.body',
        defaultMessage: 'Check your connection and try again.',
    },
    ok: {
        id: 'secuencia.report.ok',
        defaultMessage: 'OK',
    },
});

type Opcion = {
    reason: ReportReason;
    icon: CompassIconName;
};

/**
 * Las cuatro opciones, en el orden en que se muestran. Constante de modulo para
 * que no se arme un array nuevo por render.
 */
const OPCIONES: Opcion[] = [
    {reason: ReportReason.Offensive, icon: 'alert-circle-outline'},
    {reason: ReportReason.Harassment, icon: 'account-minus-outline'},
    {reason: ReportReason.Spam, icon: 'email-outline'},
    {reason: ReportReason.Other, icon: 'dots-horizontal'},
];

export const REPORT_SHEET_ITEMS = OPCIONES.length;

type Props = {
    postId: string;
}

/**
 * Hoja de seleccion del motivo del reporte.
 *
 * El motivo no es decorativo: viaja hasta el panel de moderacion de Moodle y es
 * con lo que se prioriza la cola. La lista es cerrada y la valida tambien el
 * puente (server/reportar.go).
 */
const ReportPostSheet = ({postId}: Props) => {
    const intl = useIntl();
    const theme = useTheme();
    const serverUrl = useServerUrl();
    const styles = getStyleSheet(theme);

    const onSelect = useCallback(async (reason: ReportReason) => {
        await dismissBottomSheet();

        const {error} = await reportPost(serverUrl, postId, reason);

        // El acuse de recibo NO es un adorno. Sin el, el alumno no sabe si paso
        // algo, y el revisor de Apple lo cuenta como que el mecanismo no
        // funciona.
        if (error) {
            Alert.alert(
                intl.formatMessage(messages.errorTitle),
                intl.formatMessage(messages.errorBody),
                [{text: intl.formatMessage(messages.ok)}],
            );
            return;
        }

        Alert.alert(
            intl.formatMessage(messages.sentTitle),
            intl.formatMessage(messages.sentBody),
            [{text: intl.formatMessage(messages.ok)}],
        );
    }, [intl, postId, serverUrl]);

    return (
        <View>
            <View style={styles.header}>
                <FormattedText
                    {...messages.title}
                    style={styles.title}
                />
                <FormattedText
                    {...messages.subtitle}
                    style={styles.subtitle}
                />
            </View>
            {OPCIONES.map((opcion) => (
                <ReportReasonItem
                    key={opcion.reason}
                    icon={opcion.icon}
                    onSelect={onSelect}
                    reason={opcion.reason}
                />
            ))}
        </View>
    );
};

type ItemProps = Opcion & {
    onSelect: (reason: ReportReason) => void;
};

/**
 * Componente aparte y no una flecha en linea dentro del map: asi el padre pasa
 * una sola referencia memoizada de onSelect y el hijo le agrega el motivo.
 */
const ReportReasonItem = ({icon, onSelect, reason}: ItemProps) => {
    const intl = useIntl();

    const onPress = useCallback(() => {
        onSelect(reason);
    }, [onSelect, reason]);

    return (
        <SlideUpPanelItem
            leftIcon={icon}
            onPress={onPress}
            testID={`post_options.report_post.reason.${reason}`}
            text={intl.formatMessage(messages[reason])}
        />
    );
};

export default ReportPostSheet;
