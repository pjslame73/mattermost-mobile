// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Motivos de reporte de contenido.
 *
 * Lista cerrada, no texto libre: el valor viaja al puente, de ahi a Moodle, se
 * guarda y se muestra en el panel de moderacion. Texto libre en ese recorrido
 * es una via de inyeccion gratuita, y ademas no le sirve a nadie para priorizar.
 * El puente valida contra esta misma lista (server/reportar.go).
 */
export const ReportReason = {
    Offensive: 'ofensivo',
    Harassment: 'acoso',
    Spam: 'spam',
    Other: 'otro',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ReportReason = typeof ReportReason[keyof typeof ReportReason];
