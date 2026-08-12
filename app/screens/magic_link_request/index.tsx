// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Keyboard, Platform, Text, View} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';

import {requestMagicLink} from '@actions/remote/session';
import Button from '@components/button';
import FloatingTextInput from '@components/floating_input/floating_text_input_label';
import FormattedText from '@components/formatted_text';
import {Screens} from '@constants';
import useAndroidHardwareBackHandler from '@hooks/android_back_handler';
import {useScreenTransitionAnimation} from '@hooks/screen_transition_animation';
import {usePreventDoubleTap} from '@hooks/utils';
import Background from '@screens/background';
import LinkSent from '@screens/login/link_sent';
import {navigateBack} from '@screens/navigation';
import {isErrorWithStatusCode} from '@utils/errors';
import {isEmail} from '@utils/helpers';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

export type MagicLinkRequestProps = {
    serverUrl: string;
    theme: Theme;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;

const AnimatedSafeArea = Animated.createAnimatedComponent(SafeAreaView);

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    centered: {
        width: '100%',
        maxWidth: 600,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        marginTop: Platform.select({android: 56}),
    },
    flex: {
        flex: 1,
    },
    form: {
        marginTop: 20,
    },
    header: {
        color: theme.centerChannelColor,
        marginBottom: 12,
        ...typography('Heading', 1000, 'SemiBold'),
    },
    hint: {
        color: changeOpacity(theme.centerChannelColor, 0.6),
        marginTop: 20,
        ...typography('Body', 75, 'Regular'),
    },
    innerContainer: {
        alignItems: 'center',
        height: '100%',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    returnButtonContainer: {
        marginTop: 32,
    },
    subheader: {
        color: changeOpacity(theme.centerChannelColor, 0.6),
        marginBottom: 12,
        ...typography('Body', 200, 'Regular'),
    },
    successContainer: {
        alignItems: 'center',
        paddingHorizontal: 24,
        justifyContent: 'center',
        flex: 1,
    },
    successText: {
        color: changeOpacity(theme.centerChannelColor, 0.75),
        ...typography('Body', 200, 'Regular'),
        textAlign: 'center',
    },
    successTitle: {
        color: theme.centerChannelColor,
        marginTop: 24,
        marginBottom: 12,
        ...typography('Heading', 1000),
    },
}));

const messages = defineMessages({
    title: {
        id: 'magic_link_request.title',
        defaultMessage: "Can't get in?",
    },
    description: {
        id: 'magic_link_request.description',
        defaultMessage: 'Enter your email and we will send you a new link to get in.',
    },
    submit: {
        id: 'magic_link_request.submit',
        defaultMessage: 'Send me the link',
    },
    hint: {
        id: 'magic_link_request.hint',
        defaultMessage: 'Use the same email where you got the link the first time. If you enter a different one, we will not be able to find your account.',
    },
    invalidEmail: {
        id: 'magic_link_request.error.invalid_email',
        defaultMessage: 'Please enter a valid email address.',
    },
    rateLimited: {
        id: 'magic_link_request.error.rate_limited',
        defaultMessage: 'Too many requests. Wait a few minutes and try again.',
    },
    genericError: {
        id: 'magic_link_request.error.generic',
        defaultMessage: 'We could not send the link. Check your connection and try again.',
    },
    sentTitle: {
        id: 'magic_link_request.sent.title',
        defaultMessage: 'Check your email',
    },
    sentDescription: {
        id: 'magic_link_request.sent.description',
        defaultMessage: 'If that address belongs to a student with active courses, you will get an email with the link shortly. It expires in 5 minutes, so open it as soon as it arrives.',
    },
    return: {
        id: 'magic_link_request.return',
        defaultMessage: 'Back',
    },
});

/**
 * Pantalla donde el alumno pide su propio enlace de acceso.
 *
 * Existe porque en este producto el alumno NUNCA entra a Moodle y nunca tuvo
 * contrasena: si su enlace vence, cambia de telefono o borra la app, el
 * formulario de usuario y contrasena de la pantalla de login no le sirve de
 * nada y se queda afuera sin ningun camino de vuelta.
 *
 * Se llega desde dos lados, y hacen falta los dos: el enlace de la pantalla de
 * login (cubre al del telefono nuevo, que nunca vio fallar nada) y el rechazo
 * de un enlace vencido (cubre al que todavia tiene el correo).
 */
const MagicLinkRequest = ({serverUrl, theme}: MagicLinkRequestProps) => {
    const [email, setEmail] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [sending, setSending] = useState<boolean>(false);
    const [sent, setSent] = useState<boolean>(false);
    const {formatMessage} = useIntl();
    const styles = getStyleSheet(theme);

    const animatedStyles = useScreenTransitionAnimation();

    const changeEmail = useCallback((address: string) => {
        setEmail(address);
        setError('');
    }, []);

    const onReturn = useCallback(() => {
        navigateBack();
    }, []);

    const submit = usePreventDoubleTap(useCallback(async () => {
        Keyboard.dismiss();

        // Se valida antes de salir a la red para no gastar el limite por IP del
        // servidor en un correo mal escrito, que es el error mas comun de todos.
        if (!isEmail(email)) {
            setError(formatMessage(messages.invalidEmail));
            return;
        }

        setSending(true);
        const {error: requestError} = await requestMagicLink(serverUrl, email);
        setSending(false);

        if (requestError) {
            if (isErrorWithStatusCode(requestError)) {
                // El servidor valida mas estricto que isEmail(): un 400 es
                // "arreglá lo que escribiste", no "revisá tu conexión". Mandar
                // al alumno a mirar la conexión cuando el problema es el correo
                // lo hace buscar en el lugar equivocado.
                if (requestError.status_code === HTTP_BAD_REQUEST) {
                    setError(formatMessage(messages.invalidEmail));
                    return;
                }
                if (requestError.status_code === HTTP_TOO_MANY_REQUESTS) {
                    setError(formatMessage(messages.rateLimited));
                    return;
                }
            }
            setError(formatMessage(messages.genericError));
            return;
        }

        setSent(true);
    }, [email, formatMessage, serverUrl]));

    useAndroidHardwareBackHandler(Screens.MAGIC_LINK_REQUEST, onReturn);

    const getCenterContent = () => {
        // El mensaje es CONDICIONAL a proposito: "si esa direccion corresponde
        // a un alumno". El servidor contesta lo mismo exista o no la cuenta,
        // asi que prometer un correo que puede no salir dejaria al alumno
        // esperando en vez de revisar que direccion escribio.
        if (sent) {
            return (
                <View
                    style={styles.successContainer}
                    testID='magic_link_request.link.sent'
                >
                    <LinkSent/>
                    <FormattedText
                        {...messages.sentTitle}
                        style={styles.successTitle}
                    />
                    <FormattedText
                        {...messages.sentDescription}
                        style={styles.successText}
                    />
                    <Text style={styles.successText}>
                        {email}
                    </Text>
                    <View style={styles.returnButtonContainer}>
                        <Button
                            testID='magic_link_request.return'
                            onPress={onReturn}
                            size='lg'
                            theme={theme}
                            text={formatMessage(messages.return)}
                        />
                    </View>
                </View>
            );
        }

        return (
            <KeyboardAwareScrollView
                bounces={false}
                contentContainerStyle={styles.innerContainer}
                keyboardDismissMode='on-drag'
                keyboardShouldPersistTaps='handled'
                scrollToOverflowEnabled={true}
                style={styles.flex}
                mode='layout'
            >
                <View
                    style={styles.centered}
                    testID='magic_link_request.form'
                >
                    <FormattedText
                        {...messages.title}
                        testID='magic_link_request.title'
                        style={styles.header}
                    />
                    <FormattedText
                        {...messages.description}
                        style={styles.subheader}
                    />
                    <View style={styles.form}>
                        <FloatingTextInput
                            rawInput={true}
                            blurOnSubmit={true}
                            disableFullscreenUI={true}
                            enablesReturnKeyAutomatically={true}
                            error={error}
                            keyboardType='email-address'
                            label={formatMessage({id: 'login.email', defaultMessage: 'Email'})}
                            onChangeText={changeEmail}
                            onSubmitEditing={submit}
                            returnKeyType='send'
                            testID='magic_link_request.email'
                            theme={theme}
                            value={email}
                        />
                        <View style={styles.returnButtonContainer}>
                            <Button
                                testID='magic_link_request.button'
                                disabled={!email || sending}
                                onPress={submit}
                                showLoader={sending}
                                size='lg'
                                text={formatMessage(messages.submit)}
                                theme={theme}
                            />
                        </View>
                        <FormattedText
                            {...messages.hint}
                            style={styles.hint}
                        />
                    </View>
                </View>
            </KeyboardAwareScrollView>
        );
    };

    return (
        <View style={styles.flex}>
            <Background theme={theme}/>
            <AnimatedSafeArea
                testID='magic_link_request.screen'
                style={[styles.container, animatedStyles]}
            >
                {getCenterContent()}
            </AnimatedSafeArea>
        </View>
    );
};

export default MagicLinkRequest;
