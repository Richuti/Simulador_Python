'use strict';
/* Conecta el editor de bloques, el intérprete, el escenario, la consola y el panel de código. */

(function () {
  const $ = sel => document.querySelector(sel);
  const RETARDOS = [1400, 800, 420, 160, 0];
  const PISTAS = {
    NameError: 'Usaste una variable o función antes de crearla. Revisa que se le asigne un valor primero.',
    TypeError: 'La operación no es válida para esos tipos de datos (por ejemplo, sumar texto con número). Usa str() o int() para convertir.',
    IndexError: 'Intentaste usar una posición que no existe, o sacar de una estructura vacía.',
    KeyError: 'Esa clave no existe en el diccionario (o el valor no está en el conjunto).',
    ValueError: 'El valor no es el esperado (por ejemplo, int("hola") o quitar algo que no está en la lista).',
    ZeroDivisionError: 'No se puede dividir entre cero.',
    AttributeError: 'Ese tipo de dato no tiene ese método. Por ejemplo, popleft() solo existe en una cola (deque).',
    RecursionError: 'La función se llamó a sí misma demasiadas veces. Revisa el caso base.',
    RuntimeError: 'Probablemente hay un ciclo infinito: revisa que la condición del while llegue a ser False.',
    SyntaxError: 'Hay algo mal escrito o un bloque fuera de lugar.',
    'Bloque incompleto': 'Conecta un bloque en el hueco vacío.',
  };

  let ws, escenario, generador, mapaLineas = new Map(), codigoActual = '';
  let interp = null, modoPaso = false, avanzar = null, entradaPendiente = null;
  let velocidad = 3;

  const almacen = {
    leer(k) { try { return localStorage.getItem(k); } catch { return null; } },
    escribir(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  const enMarco = (() => { try { return window.self !== window.top; } catch { return true; } })();

  // ---------- tema ----------
  const oscuro = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };

  function crearTemas() {
    const estilos = {
      logic_blocks: { colourPrimary: COLOR.logica },
      procedure_blocks: { colourPrimary: COLOR.funciones },
      variable_blocks: { colourPrimary: COLOR.variables },
      loop_blocks: { colourPrimary: COLOR.ciclos },
      math_blocks: { colourPrimary: COLOR.numeros },
      text_blocks: { colourPrimary: COLOR.texto },
      list_blocks: { colourPrimary: COLOR.lista },
    };
    const fuente = { family: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', weight: '600', size: 11 };
    return {
      claro: Blockly.Theme.defineTheme('simulador-claro', {
        base: Blockly.Themes.Classic, blockStyles: estilos, fontStyle: fuente, startHats: false,
        componentStyles: {
          workspaceBackgroundColour: '#f6f8fb', toolboxBackgroundColour: '#ffffff', toolboxForegroundColour: '#1d2633',
          flyoutBackgroundColour: '#e9eef5', flyoutForegroundColour: '#3b4656', flyoutOpacity: 0.97,
          scrollbarColour: '#b9c2cf', scrollbarOpacity: 0.7, insertionMarkerColour: '#1d2633', insertionMarkerOpacity: 0.25,
        },
      }),
      oscuro: Blockly.Theme.defineTheme('simulador-oscuro', {
        base: Blockly.Themes.Classic, blockStyles: estilos, fontStyle: fuente, startHats: false,
        componentStyles: {
          workspaceBackgroundColour: '#141a23', toolboxBackgroundColour: '#1a212c', toolboxForegroundColour: '#dbe2ec',
          flyoutBackgroundColour: '#212a37', flyoutForegroundColour: '#c5cedb', flyoutOpacity: 0.97,
          scrollbarColour: '#3c4757', scrollbarOpacity: 0.8, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.3,
          cursorColour: '#dbe2ec',
        },
      }),
    };
  }

  // ---------- diálogos propios (el visor no muestra prompt/confirm del navegador) ----------
  function dialogo({ mensaje, valor = null, aceptar = 'Aceptar', cancelar = 'Cancelar' }) {
    return new Promise(resolve => {
      const capa = $('#dialogo'), campo = $('#dialogo-campo');
      $('#dialogo-mensaje').textContent = mensaje;
      campo.hidden = valor === null;
      campo.value = valor ?? '';
      $('#dialogo-aceptar').textContent = aceptar;
      $('#dialogo-cancelar').hidden = cancelar === null;
      $('#dialogo-cancelar').textContent = cancelar || '';
      capa.hidden = false;
      (valor === null ? $('#dialogo-aceptar') : campo).focus();
      if (valor !== null) campo.select();
      const cerrar = r => {
        capa.hidden = true;
        $('#dialogo-form').onsubmit = null;
        $('#dialogo-cancelar').onclick = null;
        capa.onkeydown = null;
        resolve(r);
      };
      $('#dialogo-form').onsubmit = e => { e.preventDefault(); cerrar(valor === null ? true : campo.value); };
      $('#dialogo-cancelar').onclick = () => cerrar(null);
      capa.onkeydown = e => { if (e.key === 'Escape') cerrar(null); };
    });
  }

  function configurarDialogos() {
    Blockly.dialog.setPrompt((mensaje, defecto, cb) => dialogo({ mensaje, valor: defecto || '' }).then(cb));
    Blockly.dialog.setConfirm((mensaje, cb) => dialogo({ mensaje }).then(r => cb(r !== null)));
    Blockly.dialog.setAlert((mensaje, cb) => dialogo({ mensaje, cancelar: null }).then(() => cb && cb()));
  }

  function aviso(texto) {
    const t = $('#aviso');
    t.textContent = texto;
    t.hidden = false;
    clearTimeout(aviso.temporizador);
    aviso.temporizador = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ---------- consola ----------
  const consola = {
    limpiar() { $('#salida').innerHTML = ''; },
    agregar(texto, clase) {
      const linea = document.createElement('div');
      linea.className = 'linea-salida ' + (clase || '');
      linea.textContent = texto;
      $('#salida').appendChild(linea);
      $('#salida').scrollTop = $('#salida').scrollHeight;
      return linea;
    },
  };

  function leerEntrada(mensaje) {
    return new Promise((resolve, reject) => {
      const fila = document.createElement('form');
      fila.className = 'linea-salida entrada';
      fila.innerHTML = '<span class="prompt"></span><input type="text" id="entrada-programa" autocomplete="off" aria-label="Respuesta para input()"><button type="submit">Enviar</button>';
      fila.querySelector('.prompt').textContent = mensaje;
      $('#salida').appendChild(fila);
      $('#salida').scrollTop = $('#salida').scrollHeight;
      const campo = fila.querySelector('input');
      campo.focus();
      estado('Esperando que escribas una respuesta en la consola…');
      entradaPendiente = { reject, fila };
      fila.onsubmit = e => {
        e.preventDefault();
        const texto = campo.value;
        fila.innerHTML = '';
        fila.textContent = mensaje + texto;
        fila.classList.add('respondida');
        entradaPendiente = null;
        resolve(texto);
      };
    });
  }

  function estado(texto) { $('#estado').textContent = texto; }

  // ---------- código Python ----------
  function regenerarCodigo() {
    const { lineas, texto } = generador.generar(ws);
    codigoActual = texto;
    mapaLineas = new Map();
    const html = lineas.map((l, i) => {
      if (l.id && !mapaLineas.has(l.id)) mapaLineas.set(l.id, i + 1);
      return `<div class="ln" data-n="${i + 1}"><span class="num">${i + 1}</span><code>${colorearPython(l.t) || ' '}</code></div>`;
    }).join('');
    $('#codigo').innerHTML = html;
  }

  function resaltarLinea(n, clase = 'activa') {
    for (const el of $('#codigo').querySelectorAll('.ln.activa, .ln.error')) el.classList.remove('activa', 'error');
    if (!n) return;
    const el = $('#codigo').querySelector(`.ln[data-n="${n}"]`);
    if (el) {
      el.classList.add(clase);
      const caja = $('#codigo');
      const top = el.offsetTop, alto = el.offsetHeight;
      if (top < caja.scrollTop || top + alto > caja.scrollTop + caja.clientHeight) caja.scrollTop = top - caja.clientHeight / 3;
    }
  }

  // ---------- ejecución ----------
  const ui = {
    get escenario() { return escenario; },
    imprimir(texto) { consola.agregar(texto); },
    leer(mensaje) { return leerEntrada(mensaje); },
    async paso(bloque, clave, it) {
      escenario.sincronizar(it);
      ws.highlightBlock(bloque.id);
      resaltarLinea(mapaLineas.get(clave));
      estado(`Paso ${it.pasos} · línea ${mapaLineas.get(clave) || '—'}${modoPaso ? ' · pulsa «Siguiente paso»' : ''}`);
      if (modoPaso) {
        await new Promise(r => { avanzar = r; });
        avanzar = null;
      } else {
        const d = RETARDOS[velocidad - 1];
        if (d) await new Promise(r => setTimeout(r, d));
        else if (it.pasos % 150 === 0) await new Promise(r => setTimeout(r, 0));
      }
    },
  };

  function ajustarVelocidad() {
    const d = RETARDOS[velocidad - 1];
    escenario.setDuracion(d ? Math.min(450, Math.round(d * 0.75)) : 0);
    $('#velocidad-texto').textContent = ['Muy lenta', 'Lenta', 'Normal', 'Rápida', 'Instantánea'][velocidad - 1];
  }

  function actualizarBotones() {
    const corriendo = !!interp;
    const bEjec = $('#btn-ejecutar'), bPaso = $('#btn-paso'), bDet = $('#btn-detener');
    bEjec.querySelector('span').textContent = !corriendo ? 'Ejecutar' : modoPaso ? 'Continuar' : 'Ejecutando…';
    bEjec.disabled = corriendo && !modoPaso;
    bPaso.querySelector('span').textContent = !corriendo ? 'Paso a paso' : modoPaso ? 'Siguiente paso' : 'Pausar';
    bDet.disabled = !corriendo;
    document.body.classList.toggle('corriendo', corriendo);
  }

  async function ejecutar(enPasos) {
    if (interp) {
      if (enPasos) {
        if (modoPaso && avanzar) avanzar();
        modoPaso = true;
      } else {
        modoPaso = false;
        if (avanzar) avanzar();
      }
      actualizarBotones();
      return;
    }
    regenerarCodigo();
    modoPaso = enPasos;
    consola.limpiar();
    escenario.limpiar();
    const it = new Interprete(ws, ui);
    interp = it;
    actualizarBotones();
    try {
      await it.correr();
      escenario.sincronizar(it);
      consola.agregar(`Programa terminado en ${it.pasos} pasos.`, 'sistema');
      estado('Listo. Cambia los bloques o pulsa Ejecutar otra vez.');
      ws.highlightBlock(null);
      resaltarLinea(null);
    } catch (e) {
      escenario.sincronizar(it);
      mostrarError(e, it);
    } finally {
      interp = null;
      modoPaso = false;
      avanzar = null;
      actualizarBotones();
    }
  }

  function mostrarError(e, it) {
    if (e instanceof SenalStop) {
      consola.agregar('Ejecución detenida.', 'sistema');
      estado('Detenido.');
      ws.highlightBlock(null);
      resaltarLinea(null);
      return;
    }
    let tipo = 'Error interno', msg = String((e && e.message) || e);
    if (e instanceof PyError) { tipo = e.tipo; msg = e.message; } else console.error(e);
    const b = it.actual;
    const n = b ? mapaLineas.get(b.id) : null;
    consola.agregar(`${n ? `Línea ${n} · ` : ''}${tipo}: ${msg}`, 'error');
    if (PISTAS[tipo]) consola.agregar(PISTAS[tipo], 'pista');
    estado('El programa se detuvo por un error. El bloque que falló está resaltado.');
    if (b) {
      ws.highlightBlock(b.id);
      resaltarLinea(n, 'error');
    }
  }

  function detener(motivo) {
    if (!interp) return;
    interp.detener = true;
    if (avanzar) avanzar();
    if (entradaPendiente) {
      entradaPendiente.fila.remove();
      entradaPendiente.reject(new SenalStop());
      entradaPendiente = null;
    }
    if (motivo) consola.agregar(motivo, 'sistema');
  }

  // ---------- proyecto ----------
  function guardarLocal() {
    try { almacen.escribir('simulador:proyecto', JSON.stringify(Blockly.serialization.workspaces.save(ws))); } catch { /* nada */ }
  }

  function cargar(json) {
    Blockly.Events.disable();
    try {
      ws.clear();
      Blockly.serialization.workspaces.load(json, ws);
    } finally {
      Blockly.Events.enable();
    }
    regenerarCodigo();
    guardarLocal();
  }

  async function cargarEjemplo(id) {
    const ej = EJEMPLOS.find(e => e.id === id);
    if (!ej) return;
    if (interp) detener();
    if (ws.getAllBlocks(false).length) {
      const ok = await dialogo({ mensaje: `Se reemplazarán los bloques actuales por el ejemplo «${ej.nombre}». ¿Continuar?`, aceptar: 'Cargar ejemplo' });
      if (ok === null) return;
    }
    cargar(ej.crear());
    ws.cleanUp();
    escenario.limpiar();
    consola.limpiar();
    consola.agregar(`Ejemplo cargado: ${ej.nombre}. Pulsa Ejecutar o Paso a paso.`, 'sistema');
    ajustarZoom();
  }

  function descargar(nombre, texto, tipo) {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      aviso('Código copiado. Pégalo en un archivo .py');
    } catch {
      const area = $('#copia-manual');
      area.hidden = false;
      area.value = texto;
      area.select();
      aviso('Selecciona el texto y cópialo con Ctrl+C');
    }
  }

  // ---------- interfaz ----------
  // Muestra el programa desde su esquina superior izquierda, a una escala cómoda.
  function ajustarZoom() {
    const ancho = $('#blockly').clientWidth;
    ws.setScale(ancho < 600 ? 0.62 : 0.78);
    const contenido = ws.getMetricsManager().getContentMetrics();
    ws.scroll(28 - contenido.left, 28 - contenido.top);
  }

  function configurarDivisor() {
    const div = $('#divisor'), area = $('.area');
    div.addEventListener('pointerdown', e => {
      e.preventDefault();
      div.setPointerCapture(e.pointerId);
      const mover = ev => {
        const r = area.getBoundingClientRect();
        const ancho = Math.min(Math.max(r.right - ev.clientX, 320), r.width - 360);
        area.style.setProperty('--panel', ancho + 'px');
        Blockly.svgResize(ws);
      };
      const soltar = () => {
        div.removeEventListener('pointermove', mover);
        div.removeEventListener('pointerup', soltar);
        almacen.escribir('simulador:panel', area.style.getPropertyValue('--panel'));
      };
      div.addEventListener('pointermove', mover);
      div.addEventListener('pointerup', soltar);
    });
    div.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const actual = $('.panel').getBoundingClientRect().width;
      area.style.setProperty('--panel', Math.max(320, actual + (e.key === 'ArrowLeft' ? 40 : -40)) + 'px');
      Blockly.svgResize(ws);
    });
    const guardado = almacen.leer('simulador:panel');
    if (guardado) area.style.setProperty('--panel', guardado);
  }

  async function iniciar() {
    try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch { /* sin fuentes */ }
    definirBloques();
    configurarDialogos();
    const temas = crearTemas();

    ws = Blockly.inject('blockly', {
      toolbox: crearToolbox(),
      renderer: 'zelos',
      theme: oscuro() ? temas.oscuro : temas.claro,
      grid: { spacing: 28, length: 2, colour: '#8794a833', snap: true },
      zoom: { controls: false, wheel: true, startScale: 0.78, maxScale: 2, minScale: 0.35, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: false },
      trashcan: false,
      sounds: false,
      media: 'vendor/blockly/media/',
    });
    registrarCategorias(ws);
    generador = new GeneradorPython();
    escenario = new Escenario($('#escenario'), $('#lienzo'));

    const actualizarTema = () => ws.setTheme(oscuro() ? temas.oscuro : temas.claro);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', actualizarTema);
    new MutationObserver(actualizarTema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let temporizador;
    ws.addChangeListener(e => {
      if (e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) return;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { regenerarCodigo(); guardarLocal(); }, 120);
      const cambiaPrograma = e.type === Blockly.Events.BLOCK_CHANGE || e.type === Blockly.Events.BLOCK_CREATE ||
        e.type === Blockly.Events.BLOCK_DELETE || (e.type === Blockly.Events.BLOCK_MOVE && (e.newParentId !== e.oldParentId || e.newInputName !== e.oldInputName));
      if (interp && cambiaPrograma) detener('Se detuvo la ejecución porque cambiaste los bloques.');
    });

    new ResizeObserver(() => Blockly.svgResize(ws)).observe($('#blockly'));

    // Ejemplos
    const sel = $('#ejemplos');
    for (const ej of EJEMPLOS) {
      const o = document.createElement('option');
      o.value = ej.id;
      o.textContent = ej.nombre;
      sel.appendChild(o);
    }
    sel.addEventListener('change', async () => {
      const id = sel.value;
      sel.value = '';
      await cargarEjemplo(id);
    });

    // Controles
    $('#btn-ejecutar').addEventListener('click', () => ejecutar(false));
    $('#btn-paso').addEventListener('click', () => ejecutar(true));
    $('#btn-detener').addEventListener('click', () => detener());
    const vel = $('#velocidad');
    velocidad = Number(almacen.leer('simulador:velocidad')) || 3;
    vel.value = velocidad;
    vel.addEventListener('input', () => {
      velocidad = Number(vel.value);
      almacen.escribir('simulador:velocidad', String(velocidad));
      ajustarVelocidad();
    });

    $('#btn-zoom-mas').addEventListener('click', () => ws.zoomCenter(1));
    $('#btn-zoom-menos').addEventListener('click', () => ws.zoomCenter(-1));
    $('#btn-centrar').addEventListener('click', () => { ws.cleanUp(); ajustarZoom(); });
    $('#btn-ordenar').addEventListener('click', () => escenario.ordenar());

    $('#btn-nuevo').addEventListener('click', async () => {
      if (ws.getAllBlocks(false).length && (await dialogo({ mensaje: 'Se borrarán todos los bloques. ¿Empezar un programa nuevo?', aceptar: 'Borrar todo' })) === null) return;
      detener();
      cargar({ blocks: { languageVersion: 0, blocks: [] } });
      escenario.limpiar();
      consola.limpiar();
    });

    $('#btn-abrir').addEventListener('click', () => $('#archivo').click());
    $('#archivo').addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        cargar(JSON.parse(await f.text()));
        ajustarZoom();
        aviso(`Proyecto «${f.name}» abierto`);
      } catch {
        dialogo({ mensaje: 'No se pudo abrir el archivo. Debe ser un proyecto .json guardado con este simulador.', cancelar: null });
      }
    });
    $('#btn-guardar').addEventListener('click', () => {
      descargar('mi_programa.json', JSON.stringify(Blockly.serialization.workspaces.save(ws), null, 2), 'application/json');
    });
    $('#btn-copiar').addEventListener('click', () => copiar(codigoActual));
    $('#btn-descargar').addEventListener('click', () => descargar('mi_programa.py', codigoActual, 'text/x-python'));
    if (enMarco) {
      // El visor incrustado no permite descargas: se ofrece copiar el código en su lugar.
      $('#btn-descargar').hidden = true;
      $('#btn-guardar').hidden = true;
    }

    configurarDivisor();

    document.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select, .blocklyWidgetDiv') || !$('#dialogo').hidden) return;
      if (e.key === 'F8' || (e.key === 'Enter' && e.ctrlKey)) { e.preventDefault(); ejecutar(e.key === 'F8'); }
    });

    // Proyecto inicial: lo último guardado o el primer ejemplo.
    let inicial = null;
    try { inicial = JSON.parse(almacen.leer('simulador:proyecto') || 'null'); } catch { inicial = null; }
    const tieneBloques = inicial && inicial.blocks && inicial.blocks.blocks && inicial.blocks.blocks.length;
    try {
      cargar(tieneBloques ? inicial : EJEMPLOS[0].crear());
    } catch {
      cargar(EJEMPLOS[0].crear());
    }
    ajustarVelocidad();
    actualizarBotones();
    ajustarZoom();
    consola.agregar(tieneBloques ? 'Se recuperó tu último programa.' : `Ejemplo cargado: ${EJEMPLOS[0].nombre}. Pulsa Ejecutar o Paso a paso.`, 'sistema');
    estado('Arma tu programa con bloques y pulsa Ejecutar.');
    document.body.classList.add('listo');
  }

  iniciar();
})();
