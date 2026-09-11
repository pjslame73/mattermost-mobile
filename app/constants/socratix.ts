// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Interruptores de simplificacion de la interfaz para Socratix.
//
// Van aca y no en el servidor porque Mattermost no expone configuracion para
// estas piezas. Se dejan como flags en vez de borrar el codigo: asi cada merge
// con upstream toca una linea y no un bloque eliminado (RM-04), y volver atras
// es cambiar un booleano.

/**
 * Boton "+" del encabezado del menu lateral.
 *
 * Abre un menu con crear curso, explorar cursos, invitar gente y abrir un
 * mensaje directo. Los tres primeros ya se apagan con permisos de rol desde
 * System Console, pero "abrir un mensaje directo" no tiene ningun gate
 * (plus_menu/index.tsx) y el boton se renderiza sin condicion, asi que quitar
 * los permisos deja el "+" visible con una sola opcion.
 *
 * En Socratix el alumno no crea cursos ni se manda mensajes directos con
 * companeros: entra por Magic Link al canal donde lo espera el motor socratico.
 */
export const SHOW_PLUS_MENU: boolean = false;

/**
 * Seccion de usuarios en la busqueda de "Encontrar Cursos".
 *
 * Esa pantalla lista personas ademas de canales y ofrece abrir un mensaje
 * directo con ellas. El servidor ya lo tiene cerrado por dos vias
 * (create_direct_channel revocado y RestrictDirectMessage=team), pero las filas
 * salen de una consulta SQL contra la tabla local de usuarios
 * (observeNotDirectChannelsByTerm), que conserva los perfiles sincronizados
 * cuando Town Square todavia tenia a todos los alumnos como miembros. Esa
 * cache no se limpia con actualizar la app: solo desinstalando.
 *
 * Apagarlo del lado del cliente es la unica forma de corregir los dispositivos
 * ya instalados, y ademas hace que el aislamiento no dependa de que nadie
 * toque la configuracion del servidor mas adelante.
 *
 * En Socratix la pantalla se llama "Encontrar Cursos": ahi se buscan cursos, no
 * personas.
 */
export const SHOW_USERS_IN_CHANNEL_SEARCH: boolean = false;

/**
 * server_error_id con el que el puente avisa que faltan los terminos de uso.
 *
 * Lo define server/terminos.go del plugin com.conversa.mm-bridge. Se compara
 * contra esto y no contra el texto del mensaje, que se puede reescribir del
 * lado del servidor sin que nadie se acuerde de esta pantalla.
 */
export const TERMS_REQUIRED_ERROR_ID = 'terms_required';

/**
 * Valor que el cliente manda para confirmar la aceptacion.
 *
 * El puente lo trata como una intencion, no como una version: cualquier valor
 * no vacio significa "el alumno toco Acepto", y la version que queda registrada
 * la pone el servidor desde su configuracion. Si la mandara el cliente, una app
 * vieja podria registrar la aceptacion de unos terminos que ya no existen.
 */
export const ACEPTO_TERMINOS = '1';
