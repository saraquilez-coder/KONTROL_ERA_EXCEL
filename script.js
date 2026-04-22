let intervencion = JSON.parse(localStorage.getItem('bvg_int_data')) || null;
let eqs = JSON.parse(localStorage.getItem('eq_bvg_timer_fix')) || [];
let idS = -1; 
let audioCtx = null;

// Registro PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
    });
}

function manejarHistorial() { history.pushState({page: "activo"}, "", ""); }
manejarHistorial();

window.addEventListener('popstate', function(event) {
    if (intervencion) {
        if (confirm("¿Seguro que quieres salir? Se perderán los datos activos.")) {
        } else { manejarHistorial(); }
    }
});

window.addEventListener('beforeunload', (e) => {
    if (intervencion) { e.preventDefault(); e.returnValue = ''; }
});

function iniciarIntervencion() {
    let n = document.getElementById('int-nom').value;
    let d = document.getElementById('int-dir').value;
    if(!n) return;
    intervencion = { nombre: n, direccion: d };
    localStorage.setItem('bvg_int_data', JSON.stringify(intervencion));
    manejarHistorial();
    checkActiva();
}

function checkActiva() {
    if(intervencion) {
        document.getElementById('setup-intervencion').style.display='none';
        document.getElementById('panel-control').style.display='block';
        document.getElementById('display-intervencion').style.display='block';
        document.getElementById('txt-int-nom').innerText = intervencion.nombre.toUpperCase();
        document.getElementById('txt-int-dir').innerText = intervencion.direccion.toUpperCase();
        render();
    } else {
        document.getElementById('setup-intervencion').style.display='block';
        document.getElementById('panel-control').style.display='none';
        document.getElementById('display-intervencion').style.display='none';
    }
}

function finalizarTodo() {
    if(confirm("¿FINALIZAR INTERVENCIÓN TOTAL? Se guardará en el historial y se reseteará la App.")) {
        let historial = JSON.parse(localStorage.getItem('bvg_historial')) || [];
        
        // Aquí es donde ocurre la magia: guardamos TODO el array 'eqs' de golpe
        historial.push({
            id: Date.now(),
            info: JSON.parse(JSON.stringify(intervencion)),
            equipos: JSON.parse(JSON.stringify(eqs)), 
            fecha: new Date().toLocaleString()
        });
        localStorage.setItem('bvg_historial', JSON.stringify(historial));

        // Limpieza y reseteo
        localStorage.removeItem('bvg_int_data');
        localStorage.removeItem('eq_bvg_timer_fix');
        intervencion = null; eqs = [];
        window.location.href = window.location.origin + window.location.pathname;
    }
}

function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playAlertSound() {
    initAudio();
    let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'square'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

function formatHora(f) { 
    let d = new Date(f); 
    return d.getHours().toString().padStart(2,'0') + ":" + d.getMinutes().toString().padStart(2,'0'); 
}

function formatTimeMS(ms) { return Math.floor(ms/60000) + "m " + Math.floor((ms%60000)/1000) + "s"; }


function addEquipo() {
    initAudio();
    let n = document.getElementById('nom').value; 
    let b = document.getElementById('bar').value;
    if(!n || !b) return;

    let p = [
        document.getElementById('np1').value || "-", 
        document.getElementById('np2').value || "-", 
        document.getElementById('np3').value || "-"
    ];
    
    let ah = Date.now(); 
    let barNum = parseInt(b);

    eqs.push({ 
        n: n, pE: barNum, pA: barNum, prof: p, 
        sit: document.getElementById('sit').value || "---", 
        obj: document.getElementById('obj').value || "---",
        hE: formatHora(ah), 
        hS55: formatHora(ah + (((barNum-50)*6/55)*60000)), 
        hSMed: "--:--", 
        hSalida: "--:--",
        pSegReg: Math.round((barNum / 2) + 25),
        tI: ah, 
        tU: ah, 
        hUltActualizacion: formatHora(ah), // <--- ESTA LÍNEA ARREGLA EL UNDEFINED
        tAcumuladoPrevio: 0, 
        rMed: 0,  
        autMed: 0, 
        activo: true, 
        alerta: false, 
        silenciado: false, 
        informadoRegreso: false,
        tramos: [] 
    });

    sync(); 
    render();
    ["nom","bar","np1","np2","np3","sit","obj"].forEach(id => document.getElementById(id).value="");
}


function render() {
    if(!intervencion) return;
    let hZ = ""; let hF = ""; let hJump = ""; let ah = Date.now();
    let cS = false; let cV = false;

    eqs.forEach((e, i) => {
        let tAct = e.activo ? (ah - e.tI) : 0; 
        let minT = Math.floor(tAct / 60000);
        let sU = Math.floor((ah - e.tU)/1000); 
        let preA = e.alerta;

        let alertaMinutos = [5,10,15,20].includes(minT) && sU > 55;
        let alertaReserva = e.pA <= 50;
        let avisoRegreso = (e.pA <= e.pSegReg) && !e.informadoRegreso;

        e.alerta = e.activo && (alertaMinutos || alertaReserva || avisoRegreso);

        if (e.alerta) { 
            cV = true; 
            if (!e.silenciado) cS = true; 
            if (!preA) { e.silenciado = false; document.getElementById('card-'+i)?.scrollIntoView({behavior:'smooth'}); } 
        }

        if (e.activo) hJump += `<div class="btn-jump" onclick="document.getElementById('card-${i}').scrollIntoView({behavior:'smooth'})">${e.n} ${e.alerta?'⚠️':''}</div>`;

        let msgDisplay = "¡REVISIÓN REQUERIDA!";
        if (alertaMinutos) msgDisplay = `ACTUALIZACIÓN DE PRESIÓN ${minT} MINUTOS TRABAJO`;
        if (avisoRegreso) msgDisplay = "¡AVISO! PRESIÓN DE REGRESO ALCANZADA (INFORMAR A EQUIPO)";
        if (e.pA <= 50) msgDisplay = "¡ALERTA! EQUIPO PRÓXIMO A RESERVA - SALIDA INMEDIATA";

        let cardHtml = `
            <div id="card-${i}" class="card ${e.activo?'':'fuera'} ${e.alerta?'alerta-equipo':''}">
                <div class="msg-alerta">${msgDisplay}</div>
                <div class="card-name">${e.n}</div>
                <div class="n-prof-display">Nº PROF: ${e.prof.filter(p=>p!=="-").join(" | ")}</div>
                <div class="mision-box">
                    <div><b>LOCALIZACIÓN:</b> ${e.sit.toUpperCase()}</div>
                    <div><b>OBJETIVO:</b> ${e.obj.toUpperCase()}</div>
                </div>
                <div class="seccion">
                    <div class="dato"><span>Hora / Presión Entrada:</span> <span class="val">${e.hE} / ${Math.round(e.pE)} bar</span></div>
                    <div class="dato"><span>Previsión Salida (55 l/min):</span> <span class="val destacado-rojo">${e.hS55}</span></div>
                    <div class="dato"><span>Previsión Salida (consumo medio):</span> <span class="val destacado-verde">${e.hSMed}</span></div>
                    <div class="dato"><span>Presión Seguridad Regreso:</span> <span class="val destacado-rojo">${Math.round(e.pSegReg)} bar</span></div>
                </div>
                <div class="seccion">
                    <div class="dato"><span>Presión Actual:</span> <span class="val destacado-azul">${Math.round(e.pA)} bar</span></div>
                    <div class="dato"><span>Tiempo Trabajo Actual:</span> <span class="val">${formatTimeMS(tAct)}</span></div>
                    <div class="dato"><span>Tiempo Trabajo Total:</span> <span class="val destacado-rojo">${formatTimeMS(e.activo ? (ah - e.tI + e.tAcumuladoPrevio) : e.tAcumuladoPrevio)}</span></div>
                    <div class="dato"><span>Última Actualización Presión:</span> <span class="val">${e.activo ? e.hUltActualizacion : 'PARADO'}</span></div>
                </div>
                <div class="seccion">
                    <div class="dato"><span>Consumo Medio:</span> <span class="val">${Math.round(e.rMed)} l/min</span></div>
                    <div class="dato"><span>Autonomía (55 l/min):</span> <span class="val destacado-rojo">${e.pA<=50?'SALIDA':Math.round(((e.pA-50)*6)/55)+' min'}</span></div>
                    <div class="dato"><span>Autonomía Consumo Medio:</span> <span class="val destacado-verde">${e.pA<=50?'SALIDA':(e.rMed>0?Math.round(e.autMed)+' min':'--')}</span></div>
                </div>
                ${e.activo ? `
                    <button class="btn btn-orange" onclick="showModal(${i})">ACTUALIZAR DATOS</button>
                    ${e.alerta ? `<button class="btn btn-silence" onclick="eqs[${i}].silenciado=true;render();">SILENCIAR ALARMA</button>` : ''}
                    <button class="btn btn-dark" onclick="setEstado(${i}, false)">FIN EQUIPO (SALIDA)</button>
                ` : `
                    <button class="btn btn-blue" style="background:#28a745" onclick="reactivarEquipo(${i})">RE-ACTIVAR</button>
                `}
            </div>`;
        if(e.activo) hZ += cardHtml; else hF += cardHtml;
    });

    document.getElementById('quick-access').innerHTML = hJump;
    document.getElementById('L_ZONA').innerHTML = hZ;
    document.getElementById('L_FUERA').innerHTML = hF != "" ? `
    <div class="separador" style="
        background-color: #28a745; 
        color: white; 
        margin-top: 40px; 
        padding: 15px; 
        border-radius: 8px; 
        font-weight: bold; 
        text-align: center;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    ">
        EQUIPOS FUERA DE ZONA
    </div>${hF}` : "";
    let tB = document.getElementById('timer-box');
    if (cV) { tB.className = 'global-alerta'; tB.innerText = '¡CONTROL PENDIENTE!'; if (cS && ah % 2000 < 1000) playAlertSound(); } else { tB.className = ''; tB.innerText = ''; }

    
}

function setEstado(i, activo) { 
    if (!activo) {
        let ahora = Date.now();
        eqs[i].hSalida = formatHora(ahora); 
        eqs[i].tAcumuladoPrevio += (ahora - eqs[i].tI);
        eqs[i].activo = false;
        
        // Creamos el array de tramos si no existe y guardamos esta misión
        if(!eqs[i].tramos) eqs[i].tramos = [];
        eqs[i].tramos.push(JSON.parse(JSON.stringify(eqs[i])));
    }
    sync(); render(); 

    {
   
    // --- BLOQUE DEL BOTÓN FINALIZAR ---
    // Intentamos buscar si ya existe el contenedor del botón
    let zonaBoton = document.getElementById('contenedor-fijo-finalizar');
    
    // Si no existe en el HTML, lo creamos nosotros por código ahora mismo
    if (!zonaBoton) {
        zonaBoton = document.createElement('div');
        zonaBoton.id = 'contenedor-fijo-finalizar';
        document.body.appendChild(zonaBoton); // Lo pegamos al final de la página
    }

    // Lógica para mostrarlo solo si hay equipos
    if (eqs && eqs.length > 0) {
        zonaBoton.innerHTML = `
            <div style="margin: 50px 15px 30px 15px; text-align: center;">
                <button class="btn btn-reset" onclick="finalizarTodo()" 
                    style="background-color: #d32f2f !important; 
                           width: 100%; 
                           height: 65px; 
                           font-weight: bold; 
                           font-size: 1.2rem; 
                           color: white;
                           border: 3px solid #ffffff; 
                           border-radius: 12px; 
                           box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                           cursor: pointer;
                           display: block;">
                    FINALIZAR INTERVENCIÓN Y GUARDAR
                </button>
            </div>`;
    } else {
        // Si estamos en la pantalla de inicio (0 equipos), lo borramos
        zonaBoton.innerHTML = "";
    }
}
 

}

// function reactivarEquipo(i) {
//     let b = prompt(`Bares Entrada:`, Math.round(eqs[i].pA));
//     if(b) {
//         let ah = Date.now();
//         let barNum = parseInt(b);
        
//         // Sincronizamos presiones y tiempos
//         eqs[i].pE = eqs[i].pA = barNum;
//         eqs[i].tI = ah; 
//         eqs[i].tU = ah; 
//         eqs[i].hE = formatHora(ah);
//         eqs[i].hUltActualizacion = formatHora(ah);
//         eqs[i].hSalida = "--:--";
        
//         // Recalculamos parámetros de seguridad
//         eqs[i].pSegReg = Math.round((barNum / 2) + 25);
//         eqs[i].hS55 = formatHora(ah + (((barNum - 50) * 6 / 55) * 60000));
        
//         // MANTENEMOS el tAcumuladoPrevio (no se resetea a 0)
//         eqs[i].activo = true; 
//         eqs[i].alerta = false; 
//         eqs[i].silenciado = false; 
//         eqs[i].informadoRegreso = false; 
        
//         sync(); 
//         render();
//     }
// }

function reactivarEquipo(i) {
    let b = prompt(`Bares Entrada:`, Math.round(eqs[i].pA));
    if(b) {
        let ah = Date.now();
        eqs[i].pE = eqs[i].pA = parseInt(b);
        eqs[i].tI = ah; 
        eqs[i].tU = ah; 
        eqs[i].hE = formatHora(ah);
        eqs[i].hUltActualizacion = formatHora(ah); // Reiniciamos hora de actualización
        eqs[i].hSalida = "--:--";
        eqs[i].activo = true; 
        eqs[i].informadoRegreso = false;
        
        // NO ponemos tAcumuladoPrevio a cero para que el tiempo total no se borre
        
        sync(); 
        render();
    }
}

function showModal(i) { 
    idS = i; 
    let e = eqs[i];
    document.getElementById('mTit').innerText = e.n; 
    document.getElementById('nB').value = Math.round(e.pA); 
    document.getElementById('nSit').value = e.sit; 
    document.getElementById('nObj').value = e.obj;
    
    // Carga los nombres actuales en los 3 cuadritos nuevos
    document.getElementById('nnp1').value = e.prof[0] !== "-" ? e.prof[0] : "";
    document.getElementById('nnp2').value = e.prof[1] !== "-" ? e.prof[1] : "";
    document.getElementById('nnp3').value = e.prof[2] !== "-" ? e.prof[2] : "";

    let alertaReg = e.pA <= e.pSegReg;
    document.getElementById('alerta-check-container').style.display = alertaReg ? 'block' : 'none';
    document.getElementById('checkInformado').checked = e.informadoRegreso;

    document.getElementById('modal').style.display = 'flex'; 
}

// function showModal(i) { 
//     idS=i; 
//     document.getElementById('mTit').innerText=eqs[i].n; 
//     document.getElementById('nB').value=Math.round(eqs[i].pA); 
//     document.getElementById('nSit').value=eqs[i].sit; 
//     document.getElementById('nObj').value=eqs[i].obj;
    
//     let alertaReg = eqs[i].pA <= eqs[i].pSegReg;
//     document.getElementById('alerta-check-container').style.display = alertaReg ? 'block' : 'none';
//     document.getElementById('checkInformado').checked = eqs[i].informadoRegreso;

//     document.getElementById('modal').style.display='flex'; 
// }

function hideModal() { document.getElementById('modal').style.display='none'; }

// function saveData() {
//     let b = document.getElementById('nB').value;
//     if (b !== "" && idS !== -1) {
//         let ah = Date.now(); 
//         let v = parseInt(b);
//         let e = eqs[idS];
        
//         // Actualizar check de información
//         e.informadoRegreso = document.getElementById('checkInformado').checked;

//         // CÁLCULO DE DATOS (Solo si cambias la presión)
//         if (v !== e.pA) {
//             let tTotal = (ah - e.tI) / 60000;
//             if (tTotal > 0.1) {
//                 e.rMed = ((e.pE - v) * 6) / tTotal;
//                 if (e.rMed > 0) {
//                     e.autMed = ((v - 50) * 6) / e.rMed;
//                     e.hSMed = formatHora(ah + (e.autMed * 60000));
//                 }
//             }
//             e.rInst = ((e.pA - v) * 6) / ((ah - e.tU) / 60000);
//             e.tU = ah; 
//             e.pA = v;
//         }

//         // CAMBIAR LOS INTERVINIENTES 
//         e.prof = [
//             document.getElementById('nnp1').value || "-",
//             document.getElementById('nnp2').value || "-",
//             document.getElementById('nnp3').value || "-"
//         ];

//         e.sit = document.getElementById('nSit').value; 
//         e.obj = document.getElementById('nObj').value;
        
//         hideModal(); 
//         sync(); 
//         render();
//     }
// }


// function saveData() {
//     let b = document.getElementById('nB').value;
//     if(b && idS != -1) {
//         let ah = Date.now(); let v = parseInt(b);
        
//         eqs[idS].informadoRegreso = document.getElementById('checkInformado').checked;
//         if(eqs[idS].informadoRegreso) eqs[idS].silenciado = true;

//         if (v !== eqs[idS].pA) {
//             let tMin = (ah - eqs[idS].tI) / 60000;
//             if(tMin > 0.1) {
//                 eqs[idS].rMed = ((eqs[idS].pE - v) * 6) / tMin;
//                 eqs[idS].autMed = ((v - 50) * 6) / eqs[idS].rMed;
//                 eqs[idS].hSMed = formatHora(ah + (eqs[idS].autMed * 60000));
//             }
//             eqs[idS].rInst = ((eqs[idS].pA - v) * 6) / ((ah - eqs[idS].tU) / 60000);
//             eqs[idS].tU = ah; 
//             eqs[idS].hUltActualizacion = formatHora(ah); 
//             eqs[idS].pA = v;
//         }

//         if(v > eqs[idS].pSegReg) {
//             eqs[idS].informadoRegreso = false;
//             eqs[idS].silenciado = false;
//         }

//         eqs[idS].sit = document.getElementById('nSit').value; 
//         eqs[idS].obj = document.getElementById('nObj').value;
        
//         hideModal(); sync(); render();
//     }
// }

// function saveData() {
//     let b = document.getElementById('nB').value;
//     if (b !== "" && idS !== -1) {
//         let ah = Date.now(); 
//         let v = parseInt(b);
//         let e = eqs[idS];

//         // 1. Actualizamos la hora de actualización SIEMPRE
//         e.hUltActualizacion = formatHora(ah); 
//         e.tU = ah; 

//         // 2. Cálculos de consumo (Solo si cambia la presión)
//         if (v !== e.pA) {
//             let tTotal = (ah - e.tI) / 60000;
//             if (tTotal > 0.1) {
//                 e.rMed = ((e.pE - v) * 6) / tTotal;
//                 if (e.rMed > 0) {
//                     e.autMed = ((v - 50) * 6) / e.rMed;
//                     e.hSMed = formatHora(ah + (e.autMed * 60000));
//                 }
//             }
//             e.rInst = ((e.pA - v) * 6) / ((ah - e.tU) / 60000);
//             e.pA = v;
//         }

//         // 3. ACTUALIZAR ESTADO DE ALARMA
//         // Leemos si el checkbox está marcado
//         e.informadoRegreso = document.getElementById('checkInformado').checked;
        
//         if (e.informadoRegreso) {
//             e.alerta = false;   // Apagamos la alerta visual (rojo)
//             e.silenciado = true; // Apagamos el sonido
//         }

//         // 4. Guardar los nombres de los intervinientes (NP1, NP2, NP3)
//         e.prof = [
//             document.getElementById('nnp1').value || "-",
//             document.getElementById('nnp2').value || "-",
//             document.getElementById('nnp3').value || "-"
//         ];

//         e.sit = document.getElementById('nSit').value; 
//         e.obj = document.getElementById('nObj').value;
        
//         hideModal(); 
//         sync(); 
//         render();
//     }
// }

function saveData() {
    let b = document.getElementById('nB').value;
    if (b !== "" && idS !== -1) {
        let ah = Date.now(); 
        let v = parseInt(b);
        let e = eqs[idS];

        // 1. Actualizamos la hora de actualización SIEMPRE
        e.hUltActualizacion = formatHora(ah); 
        e.tU = ah; 

        // 2. Cálculos de consumo (Solo si cambia la presión)
        if (v !== e.pA) {
            let tTotal = (ah - e.tI) / 60000;
            if (tTotal > 0.1) {
                e.rMed = ((e.pE - v) * 6) / tTotal;
                if (e.rMed > 0) {
                    e.autMed = ((v - 50) * 6) / e.rMed;
                    e.hSMed = formatHora(ah + (e.autMed * 60000));
                }
            }
            // HE ELIMINADO LA LÍNEA DE e.rInst QUE ESTABA AQUÍ
            e.pA = v;
        }

        // 3. ACTUALIZAR ESTADO DE ALARMA
        e.informadoRegreso = document.getElementById('checkInformado').checked;
        
        if (e.informadoRegreso) {
            e.alerta = false;   
            e.silenciado = true; 
        }

        // 4. Guardar los nombres de los intervinientes (NP1, NP2, NP3)
        e.prof = [
            document.getElementById('nnp1').value || "-",
            document.getElementById('nnp2').value || "-",
            document.getElementById('nnp3').value || "-"
        ];

        e.sit = document.getElementById('nSit').value; 
        e.obj = document.getElementById('nObj').value;
        
        hideModal(); 
        sync(); 
        render();
    }
}

function sync() { localStorage.setItem('eq_bvg_timer_fix', JSON.stringify(eqs)); }

function toggleHistorial() {
    const div = document.getElementById('seccion-historial');
    div.style.display = (div.style.display === 'none') ? 'block' : 'none';
    if(div.style.display === 'block') renderHistorial();
}

function renderHistorial() {
    let historial = JSON.parse(localStorage.getItem('bvg_historial')) || [];
    let html = "";
    historial.slice().reverse().forEach((reg, index) => {
        let originalIdx = historial.length - 1 - index;
        html += `
            <div style="background:white; padding:10px; margin-bottom:10px; color:black; border-radius:5px; border-left:5px solid #d32f2f; display:flex; justify-content:space-between; align-items:center;">
                <div><b>${reg.fecha}</b><br>${reg.info.nombre.toUpperCase()}</div>
                <button class="btn btn-blue" style="width:auto; padding:5px 10px; font-size:0.7rem;" onclick="descargarIntervencion(${originalIdx})">EXCEL</button>
            </div>`;
    });
    document.getElementById('lista-historial').innerHTML = html || "No hay intervenciones.";
}

function descargarIntervencion(idx) {
    let historial = JSON.parse(localStorage.getItem('bvg_historial')) || [];
    let reg = historial[idx];
    if(!reg) return;

    // Cabeceras del Excel
    let columnas = ["Fecha", "Intervención", "Dirección", "Equipo", "Profesionales", "Localización", "Objetivo", "Entrada", "Salida", "P. Inicial", "P. Final", "Consumo bar", "Consumo Medio", "Tiempo Trabajo"];
    let csvContent = columnas.join(";") + "\n";

    // Recorremos los equipos y, de cada equipo, sus tramos (reactivaciones)
    reg.equipos.forEach(equipoPrincipal => {
        if (equipoPrincipal.tramos && equipoPrincipal.tramos.length > 0) {
            equipoPrincipal.tramos.forEach(t => {
                let fila = [
                    reg.fecha,
                    reg.info.nombre,
                    reg.info.direccion,
                    t.n,
                    t.prof.filter(p => p !== "-").join("/"),
                    t.sit,
                    t.obj,
                    t.hE,
                    t.hSalida,
                    t.pE,
                    t.pA,
                    (t.pE - t.pA),
                    Math.round(t.rMed),
                    formatTimeMS(t.tAcumuladoPrevio)
                ].join(";");
                csvContent += fila + "\n";
            });
        }
    });

    let BOM = "\uFEFF";
    let blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
 let link = document.createElement("a");
    
    // Obtenemos el nombre de la intervención y limpiamos espacios raros
    let nombreLimpio = reg.info.nombre.replace(/ /g, "_");
    
    // Configuramos el nombre del archivo: Intervencion_Nombre.csv
    link.setAttribute("download", `Intervencion_${nombreLimpio}.csv`);
    
    link.setAttribute("href", url);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


setInterval(render, 1000);
window.onload = checkActiva;
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });