// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {DeviceEventEmitter} from 'react-native';

import FormattedText from '@components/formatted_text';
import StatusIndicator from '@components/post_draft/status_indicator';
import {Events} from '@constants';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

type Props = {
    channelId: string;
    rootId: string;
}

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        typing: {
            color: changeOpacity(theme.centerChannelColor, 0.7),
            paddingHorizontal: 10,
            ...typography('Body', 75),
        },
    };
});

function Typing({
    channelId,
    rootId,
}: Props) {
    const typing = useRef<Array<{id: string; now: number; username: string}>>([]);
    const timeoutToDisappear = useRef<NodeJS.Timeout | undefined>(undefined);
    const mounted = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [refresh, setRefresh] = useState(0); // Used to trigger re-renders when typing state changes

    const theme = useTheme();
    const style = getStyleSheet(theme);

    const onUserStartTyping = useCallback((msg: any) => {
        if (channelId !== msg.channelId) {
            return;
        }

        const msgRootId = msg.parentId || msg.rootId || '';
        if (rootId !== msgRootId) {
            return;
        }

        typing.current = typing.current.filter(({id}) => id !== msg.userId);
        typing.current.push({id: msg.userId, now: msg.now, username: msg.username});
        if (timeoutToDisappear.current) {
            clearTimeout(timeoutToDisappear.current);
            timeoutToDisappear.current = undefined;
        }
        if (mounted.current) {
            setRefresh(Date.now());
        }
    }, [channelId, rootId]);

    const onUserStopTyping = useCallback((msg: any) => {
        if (channelId !== msg.channelId) {
            return;
        }

        const msgRootId = msg.parentId || msg.rootId || '';
        if (rootId !== msgRootId) {
            return;
        }

        // Un apagado VIEJO no puede matar un aviso mas nuevo.
        //
        // Cada aviso de "esta escribiendo" programa su propio apagado a los
        // TimeBetweenUserTypingUpdatesMilliseconds (5 s), reusando el mismo
        // `now` del aviso que lo genero. Con la condicion anterior --que unia
        // las dos comparaciones con && -- alcanzaba con que coincidiera el id
        // para borrar, asi que ese apagado diferido borraba la entrada que
        // hubiera dejado un aviso POSTERIOR.
        //
        // Con una persona escribiendo casi no se nota, porque el cliente manda
        // los avisos con ese mismo intervalo y los dos quedan alineados. Pero el
        // indicador del bot lo late el plugin cada 4 s (a proposito, para que no
        // se apague solo), y ahi el apagado de un latido caia siempre 1 s
        // DESPUES del latido siguiente y lo mataba: se veia los primeros 5
        // segundos y despues parpadeaba un segundo cada cuatro, que es
        // indistinguible de "no aparece".
        //
        // Ahora la entrada sobrevive si es de otro usuario O si es mas nueva que
        // el apagado que esta llegando. El apagado por post del bot sigue
        // funcionando: usa Date.now(), asi que siempre es el mas nuevo.
        typing.current = typing.current.filter(({id, now}) => id !== msg.userId || now > msg.now);

        if (timeoutToDisappear.current) {
            clearTimeout(timeoutToDisappear.current);
            timeoutToDisappear.current = undefined;
        }

        if (typing.current.length === 0) {
            timeoutToDisappear.current = setTimeout(() => {
                if (mounted.current) {
                    setRefresh(Date.now());
                }
                timeoutToDisappear.current = undefined;
            }, 500);
        } else if (mounted.current) {
            setRefresh(Date.now());
        }
    }, [channelId, rootId]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        const listener = DeviceEventEmitter.addListener(Events.USER_TYPING, onUserStartTyping);
        return () => {
            listener.remove();
        };
    }, [onUserStartTyping]);

    useEffect(() => {
        const listener = DeviceEventEmitter.addListener(Events.USER_STOP_TYPING, onUserStopTyping);
        return () => {
            listener.remove();
        };
    }, [onUserStopTyping]);

    useEffect(() => {
        typing.current = [];
        if (timeoutToDisappear.current) {
            clearTimeout(timeoutToDisappear.current);
            timeoutToDisappear.current = undefined;
        }
    }, [channelId, rootId]);

    const renderTyping = () => {
        const nextTyping = typing.current.map(({username}) => username);

        // Max three names
        nextTyping.splice(3);

        const numUsers = nextTyping.length;

        switch (numUsers) {
            case 0:
                return null;
            case 1:
                return (
                    <FormattedText
                        id='msg_typing.isTyping'
                        defaultMessage='{user} is typing...'
                        style={style.typing}
                        ellipsizeMode='tail'
                        numberOfLines={1}
                        values={{
                            user: nextTyping[0],
                        }}
                    />
                );
            default: {
                const last = nextTyping.pop();
                return (
                    <FormattedText
                        id='msg_typing.areTyping'
                        defaultMessage='{users} and {last} are typing...'
                        style={style.typing}
                        ellipsizeMode='tail'
                        numberOfLines={1}
                        values={{
                            users: (nextTyping.join(', ')),
                            last,
                        }}
                    />
                );
            }
        }
    };

    const isVisible = typing.current.length > 0;

    return (
        <StatusIndicator visible={isVisible}>
            {renderTyping()}
        </StatusIndicator>
    );
}

export default React.memo(Typing);
