// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import sanitizeHtml from 'sanitize-html';

// Mismo criterio de lista blanca que el plugin webapp de desktop
// (conversa-mm-plugin/webapp/src/components/secuencia_html_post.tsx) -- es el
// subconjunto de HTML que produce TinyMCE. sanitize-html corre sin DOM (a
// diferencia de DOMPurify), por eso es el que usamos acá.
const ALLOWED_TAGS = [
    'p', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'sup', 'sub',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'code', 'pre', 'font',
];

function sanitizar(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {
            '*': ['style', 'class'],
            a: ['href', 'target', 'rel'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            td: ['colspan', 'rowspan'],
            th: ['colspan', 'rowspan'],
        },
        allowedSchemes: ['http', 'https', 'data'],
    });
}

const KATEX_VERSION = '0.18.1';

// Documento HTML autocontenido para el WebView -- KaTeX vía CDN (igual que
// styles.ts del lado desktop) renderiza $$..$$/\(..\)/\[..\] directo en el texto,
// sin necesidad de ningún preprocesamiento propio (a diferencia del intento
// anterior con react-native-render-html + tags custom).
export function construirDocumentoHtml(html: string, textColor: string): string {
    const contenido = sanitizar(html);
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js"></script>
<style>
html, body { margin: 0; padding: 0; background: transparent; color: ${textColor}; font-family: sans-serif; font-size: 15px; word-wrap: break-word; }
table { border-collapse: collapse; margin: 8px 0; max-width: 100%; }
th, td { border: 1px solid rgba(128,128,128,0.4); padding: 4px 10px; text-align: left; }
th { font-weight: 600; }
img { max-width: 100%; height: auto; }
pre { overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
/* El user-agent stylesheet le pone margen arriba/abajo a p/headings/listas por
   defecto -- eso se veía como un salto de línea extra antes del texto, cosa
   que el componente Markdown nativo no tiene. */
#secuencia-content > *:first-child { margin-top: 0; }
#secuencia-content > *:last-child { margin-bottom: 0; }
</style>
</head>
<body>
<div id="secuencia-content">${contenido}</div>
<script>
var ultimaAlturaReportada = 0;
function reportarAltura() {
    var actual = document.body.scrollHeight;
    if (actual !== ultimaAlturaReportada && window.ReactNativeWebView) {
        ultimaAlturaReportada = actual;
        window.ReactNativeWebView.postMessage(String(actual));
    }
}
document.addEventListener('DOMContentLoaded', function () {
    try {
        renderMathInElement(document.body, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '\\\\(', right: '\\\\)', display: false},
                {left: '\\\\[', right: '\\\\]', display: true}
            ],
            throwOnError: false
        });
    } catch (e) {
        // Si KaTeX no llegó a cargar (sin red, CDN caído), el texto crudo de la
        // ecuación queda tal cual -- degradación aceptable, no un post vacío.
    }
    reportarAltura();
    // ResizeObserver detecta CUALQUIER cambio de layout (fuentes de KaTeX
    // cargando, imágenes asentando su tamaño real, etc.) en vez de apostar a un
    // tiempo fijo -- soluciona el corte al final que pasaba con un solo setTimeout.
    if (window.ResizeObserver) {
        new ResizeObserver(reportarAltura).observe(document.body);
    } else {
        [100, 300, 600, 1000, 2000].forEach(function (ms) {
            setTimeout(reportarAltura, ms);
        });
    }
});
window.addEventListener('resize', reportarAltura);
</script>
</body>
</html>`;
}
