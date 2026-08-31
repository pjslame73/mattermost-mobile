// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Máscara HH:MM para el campo del diálogo "Horario de arranque" de
// mod_secuenciadidacticamm.
//
// POR QUE HACE FALTA. Los dialogos interactivos de Mattermost no tienen un tipo "hora":
// los subtipos posibles son number, email, password, url y textarea, nada mas. Asi que
// Moodle manda un campo de texto comun (abrirDialogoHorario() en webhook.php) y el
// comportamiento de reloj se agrega del lado del cliente.
//
// Sin esto, en el celular pasaban dos cosas feas: el teclado que abria era el alfabetico
// completo --letras para escribir una hora-- y lo que se tipeaba quedaba crudo ("950" se
// guardaba tal cual y rebotaba en la validacion).
//
// Espeja conversa-mm-plugin/webapp/src/dialogo_horario.ts (escritorio): la funcion de
// formateo es IDENTICA, para que la hora se escriba igual en las dos plataformas. Si se
// toca una hay que tocar la otra.

// El nombre del campo lo define Moodle en abrirDialogoHorario(). Se compara por nombre
// porque un dialogo interactivo no tiene forma de marcar un campo como "de hora": no hay
// metadato libre en el protocolo, solo los atributos fijos de DialogElement.
const NOMBRE_CAMPO_HORARIO = 'horario';

/**
 * ¿Este campo del diálogo es el del horario de arranque?
 *
 * Vive acá y no en apps_form_field.tsx para que el archivo de Mattermost no tenga que
 * saber nada de secuenciadidacticamm: solo pregunta.
 */
export function esCampoHorarioSecuencia(nombre: string): boolean {
    return nombre === NOMBRE_CAMPO_HORARIO;
}

/**
 * Deja el texto en forma de reloj: solo digitos, los dos puntos en su lugar, y un cero
 * adelante si el primer digito no puede abrir una hora.
 *
 * Los dos puntos los pone la mascara y no se pueden borrar sueltos: el retroceso saca un
 * digito, y los dos puntos desaparecen solos cuando ya no hacen falta.
 */
export function formatearHorario(valor: string): string {
    let digitos = valor.replace(/\D/g, '');

    // Ninguna hora empieza con 3..9 (van de 00 a 23), asi que ese digito es en realidad
    // las unidades: "9" quiere decir "09". Sin esto, escribir 9 y 30 daba "93:0", que
    // despues rebotaba en la validacion del servidor.
    if (digitos.length >= 1 && Number(digitos[0]) > 2) {
        digitos = `0${digitos}`;
    }

    digitos = digitos.slice(0, 4);
    return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}
