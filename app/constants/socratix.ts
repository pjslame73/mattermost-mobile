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
