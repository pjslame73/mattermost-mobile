// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Alert, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {magicLinkLogin} from '@actions/remote/session';
import Button from '@components/button';
import FormattedText from '@components/formatted_text';
import AboutLinks from '@constants/about_links';
import {ACEPTO_TERMINOS} from '@constants/socratix';
import useAndroidHardwareBackHandler from '@hooks/android_back_handler';
import {usePreventDoubleTap} from '@hooks/utils';
import Background from '@screens/background';
import {navigateBack} from '@screens/navigation';
import {getFullErrorMessage} from '@utils/errors';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';
import {tryOpenURL} from '@utils/url';

export type TermsGateProps = {
    serverUrl: string;
    token: string;
    theme: Theme;
}

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    flex: {
        flex: 1,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    centered: {
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
    },
    title: {
        color: theme.centerChannelColor,
        marginBottom: 12,
        ...typography('Heading', 1000, 'SemiBold'),
    },
    description: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        marginBottom: 24,
        ...typography('Body', 200, 'Regular'),
    },
    readButton: {
        marginBottom: 12,
    },
    hint: {
        color: changeOpacity(theme.centerChannelColor, 0.6),
        marginTop: 20,
        ...typography('Body', 75, 'Regular'),
    },
}));

const messages = defineMessages({
    title: {
        id: 'terms_gate.title',
        defaultMessage: 'Terms of Use',
    },
    description: {
        id: 'terms_gate.description',
        defaultMessage: 'Before you get in, you need to read and accept the Terms of Use. They explain what is expected of you in Socratix and what happens with objectionable content.',
    },
    read: {
        id: 'terms_gate.read',
        defaultMessage: 'Read the Terms of Use',
    },
    accept: {
        id: 'terms_gate.accept',
        defaultMessage: 'I accept and want to get in',
    },
    hint: {
        id: 'terms_gate.hint',
        defaultMessage: 'By tapping "I accept and want to get in" you confirm that you have read the Terms of Use and that you agree to them.',
    },
    errorTitle: {
        id: 'terms_gate.error.title',
        defaultMessage: 'We could not open your session',
    },
    ok: {
        id: 'terms_gate.error.ok',
        defaultMessage: 'OK',
    },
});

/**
 * Aceptacion de los terminos antes de abrir sesion.
 *
 * La guia 1.2 de la App Store exige que los terminos se acepten ANTES de
 * iniciar sesion. En Socratix el alumno no ve ninguna pantalla de login --entra
 * por magic link-- asi que el gate no puede estar ahi: lo impone el puente en
 * el canje del enlace, y esta pantalla es lo que el alumno ve cuando el canje
 * responde que faltan los terminos.
 *
 * El enlace NO se gasto al llegar aca: el puente frena antes de quemar el jti,
 * asi que leer los terminos con calma no deja al alumno afuera.
 */
const TermsGate = ({serverUrl, token, theme}: TermsGateProps) => {
    const intl = useIntl();
    const styles = getStyleSheet(theme);
    const [enviando, setEnviando] = useState(false);

    useAndroidHardwareBackHandler(undefined, navigateBack);

    const onLeer = useCallback(() => {
        tryOpenURL(AboutLinks.TERMS_OF_SERVICE);
    }, []);

    const onAceptar = usePreventDoubleTap(useCallback(async () => {
        setEnviando(true);

        // Es el MISMO canje, ahora con la aceptacion puesta. No hay un endpoint
        // aparte que registre el consentimiento: la sesion y la aceptacion se
        // resuelven en la misma llamada, asi que no existe el estado
        // intermedio de "acepto pero no entro".
        const {error} = await magicLinkLogin(serverUrl, token, ACEPTO_TERMINOS);

        if (error) {
            setEnviando(false);
            Alert.alert(
                intl.formatMessage(messages.errorTitle),
                getFullErrorMessage(error, intl),
                [{text: intl.formatMessage(messages.ok)}],
            );
        }

        // Sin error no se apaga el spinner ni se navega: magicLinkLogin deja la
        // sesion activa y el arranque de la app se lleva la pantalla puesta.
    }, [intl, serverUrl, token]));

    return (
        <View style={styles.flex}>
            <Background theme={theme}/>
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <FormattedText
                        {...messages.title}
                        style={styles.title}
                    />
                    <FormattedText
                        {...messages.description}
                        style={styles.description}
                    />
                    <Button
                        backgroundStyle={styles.readButton}
                        emphasis='tertiary'
                        onPress={onLeer}
                        size='lg'
                        testID='terms_gate.read.button'
                        text={intl.formatMessage(messages.read)}
                        theme={theme}
                    />
                    <Button
                        disabled={enviando}
                        onPress={onAceptar}
                        showLoader={enviando}
                        size='lg'
                        testID='terms_gate.accept.button'
                        text={intl.formatMessage(messages.accept)}
                        theme={theme}
                    />
                    <FormattedText
                        {...messages.hint}
                        style={styles.hint}
                    />
                </View>
            </SafeAreaView>
        </View>
    );
};

export default TermsGate;
