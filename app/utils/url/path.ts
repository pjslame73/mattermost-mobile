// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ID_PATH_PATTERN = '[a-z0-9]{26}';

export const TOKEN_PATH_PATTERN = '[a-z0-9]{64}';

// Token del acceso por enlace de Conversa: dos segmentos base64url sin relleno
// separados por un punto (payload.firma). No entra en TOKEN_PATH_PATTERN, que
// describe el formato nativo de Mattermost -- 64 caracteres hexadecimales.
//
// Esto es solo un filtro barato antes de salir a la red. La validacion real es
// el HMAC del lado del servidor, asi que aceptar de mas aca no abre nada.
export const CONVERSA_MAGIC_TOKEN_PATTERN = '[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+';

// This should cover:
// - Team name (lowercase english characters, numbers or -)
// - Two ids separated by __ (userID__userID)
export const TEAM_NAME_PATH_PATTERN = '[a-z0-9\\-_]+';

// This should cover:
// - Channel name
// - Channel ID
// - Group Channel Name (40 length UID)
// - DM Name (userID__userID)
// - Username prefixed by a @
// - Username prefixed by a @, with colon and remote name e.g. @username:companyname
// - User ID
// - Email
export const IDENTIFIER_PATH_PATTERN = '[@a-zA-Z\\-_0-9][@a-zA-Z\\-_0-9.:]*';

