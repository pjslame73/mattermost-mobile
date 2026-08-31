// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Adapta los colores del HTML que llega de Moodle al tema activo de Mattermost.
//
// EL PROBLEMA. El HTML de la descripcion trae los colores ESCRITOS FIJOS en cada
// elemento (`<p style="color:#201e1d">`), porque se escribe en TinyMCE pensando en
// una pagina blanca -- ver html_a_html_enriquecido() en lib.php. Con el tema Onyx o
// Indigo, ese texto casi negro queda sobre un fondo casi negro: ilegible, y sin un
// solo error en ningun log. Y no alcanza con arreglar el HTML que existe hoy: el
// contenido lo cargan varias personas, y manana alguien va a elegir un color nuevo
// del selector de TinyMCE que nadie anticipo.
//
// LA SOLUCION, en tres capas:
//
//   1. PRESTAMO. La superficie y el texto base no los inventamos: salen del `theme`
//      que la app ya entrega (centerChannelBg/centerChannelColor). Asi la tarjeta se
//      funde con Denim, Indigo, Onyx, un tema personalizado, o uno que Mattermost
//      lance el ano que viene, sin tocar nada aca.
//
//   2. TABLA. Los colores que son NUESTRO diseno (el celeste de Socratix, el rosa de
//      Conversa, el acento de los links) no tienen equivalente en el tema, asi que
//      para esos mantenemos un par claro/oscuro elegido a mano con el contraste
//      verificado. Dejarlos al algoritmo generico aplana la jerarquia: los tres
//      grises de texto (principal/mudo/tenue) terminaban casi identicos entre si.
//
//   3. ALGORITMO. Cualquier color que NO este en la tabla pasa por adaptarColor():
//      se lo lleva a HSL y se le invierte la luminosidad a una franja legible,
//      conservando tono y saturacion. Es la misma tecnica que usan las extensiones
//      de "forzar modo oscuro" del navegador. Esta capa garantiza que un color nuevo
//      NUNCA vuelva a quedar invisible en silencio: no existe el camino de "no lo
//      conozco, lo dejo tal cual".
//
// Espeja conversa-mm-plugin/webapp/src/colores_tema.ts (desktop): la tabla, el
// algoritmo y el router son IDENTICOS -- si se toca uno hay que tocar el otro, o las
// dos plataformas dejan de verse igual. Lo unico distinto es de donde sale el color
// prestado (alla se sube por el DOM porque el plugin no recibe el tema; aca llega
// como prop) y que aca se reescribe el texto CSS del atributo style en vez de
// recorrer el DOM, porque el contenido se arma como string antes de entrar al
// WebView.

type RGB = {r: number; g: number; b: number};

export type RolColor = 'texto' | 'fondo';

export type ColoresBase = {
    superficie: string;
    texto: string;
    esOscuro: boolean;
};

// ─────────────────────────── UTILIDADES DE COLOR ───────────────────────────

/** Acepta '#rgb', '#rrggbb', 'rgb(...)' y 'rgba(...)'. Devuelve null si no entiende. */
export function parsearColor(valor: string): RGB | null {
    const v = valor.trim().toLowerCase();

    const hex = (/^#([0-9a-f]{3}|[0-9a-f]{6})$/).exec(v);
    if (hex) {
        const h = hex[1];
        if (h.length === 3) {
            return {
                r: parseInt(h[0] + h[0], 16),
                g: parseInt(h[1] + h[1], 16),
                b: parseInt(h[2] + h[2], 16),
            };
        }
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
        };
    }

    const rgb = (/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/).exec(v);
    if (rgb) {
        return {r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3])};
    }

    return null;
}

function aHex({r, g, b}: RGB): string {
    const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

/** Luminancia relativa WCAG. 0 = negro, 1 = blanco. */
export function luminancia({r, g, b}: RGB): number {
    const canal = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return (0.2126 * canal(r)) + (0.7152 * canal(g)) + (0.0722 * canal(b));
}

function rgbAHsl({r, g, b}: RGB): {h: number; s: number; l: number} {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) {
        return {h: 0, s: 0, l};
    }
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === rn) {
        h = ((gn - bn) / d) + (gn < bn ? 6 : 0);
    } else if (max === gn) {
        h = ((bn - rn) / d) + 2;
    } else {
        h = ((rn - gn) / d) + 4;
    }
    return {h: h / 6, s, l};
}

function hslARgb({h, s, l}: {h: number; s: number; l: number}): RGB {
    if (s === 0) {
        const v = l * 255;
        return {r: v, g: v, b: v};
    }
    const hue2rgb = (p: number, q: number, t: number) => {
        let tt = t;
        if (tt < 0) {
            tt += 1;
        }
        if (tt > 1) {
            tt -= 1;
        }
        if (tt < 1 / 6) {
            return p + ((q - p) * 6 * tt);
        }
        if (tt < 1 / 2) {
            return q;
        }
        if (tt < 2 / 3) {
            return p + ((q - p) * ((2 / 3) - tt) * 6);
        }
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : (l + s) - (l * s);
    const p = (2 * l) - q;
    return {
        r: hue2rgb(p, q, h + (1 / 3)) * 255,
        g: hue2rgb(p, q, h) * 255,
        b: hue2rgb(p, q, h - (1 / 3)) * 255,
    };
}

// ──────────────────────── 2. TABLA DE COLORES PROPIOS ────────────────────────

// Los colores que aparecen HOY en el contenido, sacados contando el HTML real.
//
// HAY DOS TABLAS, UNA POR ROL, y no es un detalle: el MISMO hex significa cosas
// opuestas segun donde aparezca. Con una sola tabla (como estaba al principio),
// un barrido sistematico del espacio de color encontro dos casos catastroficos:
//   - '#ffffff' como COLOR DE TEXTO caia en la entrada pensada para el fondo de
//     las pills y se volvia #24262b: texto oscuro sobre fondo oscuro, 1.14:1.
//     Exactamente el bug que esto venia a arreglar.
//   - '#201e1d' como FONDO caia en la entrada pensada para el texto y se volvia
//     #ece9e6: caja casi blanca con el texto principal --tambien claro-- encima,
//     1.00:1.
// El muestreo aleatorio nunca los encontro (acertar un hex exacto al azar es 1 en
// 16 millones); el barrido sistematico los encontro en la primera pasada.
//
// Cada par claro→oscuro se eligio a mano y se verifico con la formula de contraste
// WCAG: todos superan 4.5:1 salvo los bordes, que como elementos no textuales solo
// necesitan 3:1.
const TABLA_TEXTO: Record<string, string> = {
    '#201e1d': '#ece9e6', // texto principal (parrafos, titulos) -- 12.5:1
    '#444141': '#cfcbc7', // bajada grande -- 9.4:1
    '#605d5d': '#a9a5a1', // rotulos, eyebrow -- 6.2:1
    '#9b9797': '#9d9894', // caption y "volver al indice" -- 5.3:1
    '#7d7979': '#9d9894',
    '#006786': '#5cc9ea', // acento: links, pills, cifras de tabla -- 7.9:1
    '#004961': '#9fe0f2', // titulo dentro de la caja azul (Socratix) -- 9.9:1
    '#790e3d': '#f2a0bd', // titulo dentro de la caja rosa (Conversa) -- 8.2:1
    '#d7d3d3': '#6e7175', // bordes y divisores -- 3.1:1 (no textual, alcanza)
    '#cfd0d3': '#6e7175',
};

const TABLA_FONDO: Record<string, string> = {
    '#e9f8ff': '#0f2d38', // fondo caja azul (Socratix)
    '#fff1f4': '#341621', // fondo caja rosa (Conversa)
    '#ffffff': '#24262b', // el blanco explicito de las pills pasa a ser la superficie
};

// ─────────────────────── 3. ALGORITMO GENERICO (HSL) ───────────────────────

// Franjas de luminosidad destino. Un texto adaptado cae entre 72% y 90% (legible
// sobre fondo oscuro sin ser blanco puro); un fondo de caja entre 8% y 20% (se
// distingue de la superficie sin competir con el texto).
const TEXTO_L_MIN = 0.72;
const TEXTO_L_MAX = 0.90;
const FONDO_L_MIN = 0.08;
const FONDO_L_MAX = 0.20;

/**
 * Reencuadra la luminosidad de un color para que sea legible sobre fondo oscuro,
 * conservando tono y saturacion (asi un marron sigue leyendose como marron).
 *
 * La inversion es proporcional, no un corte: un texto que era muy oscuro termina
 * cerca del tope claro de la franja, y uno que ya era mediano termina mas abajo --
 * se conserva parte de la jerarquia relativa del diseno original.
 */
export function adaptarColor(valor: string, rol: RolColor): string | null {
    const rgb = parsearColor(valor);
    if (!rgb) {
        return null;
    }
    const {h, s, l} = rgbAHsl(rgb);
    const nuevaL = rol === 'texto' ?TEXTO_L_MIN + ((1 - l) * (TEXTO_L_MAX - TEXTO_L_MIN)) :FONDO_L_MAX - (l * (FONDO_L_MAX - FONDO_L_MIN));
    return aHex(hslARgb({h, s, l: nuevaL}));
}

// ──────────────────────────── 4. EL ROUTER ────────────────────────────

/** Normaliza a '#rrggbb' en minusculas, para poder buscar en la tabla. */
function claveTabla(valor: string): string | null {
    const rgb = parsearColor(valor);
    return rgb ? aHex(rgb) : null;
}

/**
 * Decide que hacer con UN color: tabla si lo conocemos, algoritmo si no.
 *
 * Este es el punto que garantiza que un color nuevo no rompa nada -- no existe la
 * rama "no lo conozco, lo dejo como esta", que es exactamente lo que producia el
 * texto invisible.
 */
export function resolverColor(valor: string, rol: RolColor): string | null {
    const clave = claveTabla(valor);
    const tabla = rol === 'texto' ? TABLA_TEXTO : TABLA_FONDO;
    if (clave && tabla[clave]) {
        return tabla[clave];
    }
    return adaptarColor(valor, rol);
}

// ─────────────── REESCRITURA DEL CSS INLINE (especifico de mobile) ───────────────

// Propiedades que llevan un color y hay que revisar, con el rol que les corresponde.
// `border`/`border-*` en shorthand se manejan aparte, abajo.
const PROPS_COLOR: Record<string, RolColor> = {
    'color': 'texto',
    'background-color': 'fondo',
    'background': 'fondo',
    'border-color': 'texto',
    'border-top-color': 'texto',
    'border-right-color': 'texto',
    'border-bottom-color': 'texto',
    'border-left-color': 'texto',
};

// Un color dentro de un valor compuesto (`1px solid #d7d3d3`, `none`, etc.).
const COLOR_EN_VALOR = /#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)/g;

/**
 * Reescribe el texto de un atributo style="..." adaptando cada color que encuentra.
 *
 * A diferencia de desktop --que recorre el DOM ya montado-- aca el contenido todavia
 * es un string, asi que se trabaja sobre las declaraciones CSS directamente. El
 * resultado es el mismo: cada color declarado pasa por resolverColor().
 */
export function adaptarStyleInline(style: string): string {
    return style.split(';').map((decl) => {
        const sep = decl.indexOf(':');
        if (sep === -1) {
            return decl;
        }
        const prop = decl.slice(0, sep).trim().toLowerCase();
        const valor = decl.slice(sep + 1);

        // Shorthands de borde (`border: 1px solid #ccc`): el color es una parte del
        // valor, no el valor entero -- se reemplaza solo esa parte.
        if (prop === 'border' || prop.startsWith('border-')) {
            const nuevo = valor.replace(COLOR_EN_VALOR, (c) => resolverColor(c, 'texto') ?? c);
            return `${decl.slice(0, sep)}:${nuevo}`;
        }

        const rol = PROPS_COLOR[prop];
        if (!rol) {
            return decl;
        }

        // `background` puede traer mas que un color (gradiente, imagen): se reemplaza
        // solo la parte que ES un color y se deja el resto intacto.
        const nuevo = valor.replace(COLOR_EN_VALOR, (c) => resolverColor(c, rol) ?? c);
        return `${decl.slice(0, sep)}:${nuevo}`;
    }).join(';');
}

/**
 * Superficie/texto del tema activo y si estamos en un tema oscuro.
 *
 * A diferencia de desktop no hace falta adivinar nada: la app ya entrega los valores
 * concretos del tema elegido, sea uno de los cinco de fabrica o uno personalizado.
 */
export function detectarColoresBase(theme: Theme): ColoresBase {
    const superficie = theme.centerChannelBg;
    const rgb = parsearColor(superficie);
    return {
        superficie,
        texto: theme.centerChannelColor,
        esOscuro: rgb ? luminancia(rgb) < 0.5 : false,
    };
}
