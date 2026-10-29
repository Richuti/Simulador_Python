'use strict';
/*
 * Escenario: dibuja cada variable como una tarjeta movible.
 * Las pilas, colas, listas, diccionarios, tuplas y conjuntos tienen su propia forma;
 * los valores simples se agrupan en la tarjeta «Variables».
 */

const esEstructura = v => v instanceof PyList || v instanceof PyTuple || v instanceof PyDict || v instanceof PySet;

function infoEstructura(v) {
  if (v instanceof PyList) {
    if (v.kind === 'pila') return { clase: 'pila', tipo: 'pila', py: 'list' };
    if (v.kind === 'cola') return { clase: 'cola', tipo: 'cola', py: 'deque' };
    return { clase: 'lista', tipo: v.vista ? 'vista' : 'lista', py: v.vista || 'list' };
  }
  if (v instanceof PyTuple) return { clase: 'tupla', tipo: 'tupla', py: 'tuple' };
  if (v instanceof PyDict) return { clase: 'dic', tipo: 'diccionario', py: 'dict' };
  return { clase: 'conj', tipo: 'conjunto', py: 'set' };
}

const corto = (s, n = 28) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function celdaValor(v) {
  const t = Py.tipo(v);
  const clase = t === 'str' ? 'v-str' : t === 'int' || t === 'float' ? 'v-num' : t === 'bool' || t === 'NoneType' ? 'v-const' : 'v-obj';
  const r = Py.repr(v);
  return `<span class="val ${clase}" title="${escaparHTML(r)}">${escaparHTML(corto(r))}</span>`;
}

class Escenario {
  constructor(contenedor, lienzo) {
    this.contenedor = contenedor;
    this.lienzo = lienzo;
    this.tarjetas = new Map();
    this.marcas = new Map();
    this.capa = 10;
    this.dur = 380;
    this.posiciones = {};
    try { this.posiciones = JSON.parse(localStorage.getItem('simulador:posiciones') || '{}'); } catch { /* sin almacenamiento */ }
  }

  setDuracion(ms) {
    this.dur = ms;
    this.lienzo.style.setProperty('--dur', ms + 'ms');
  }

  limpiar() {
    for (const t of this.tarjetas.values()) t.el.remove();
    this.tarjetas.clear();
    this.marcas.clear();
    this.ajustarLienzo();
  }

  marcar(o, m) {
    if (!o || typeof o !== 'object') return;
    if (!this.marcas.has(o)) this.marcas.set(o, []);
    this.marcas.get(o).push(m);
  }

  // Anima la salida de un elemento antes de que el intérprete lo quite.
  async salida(o, sel) {
    if (!this.dur) return;
    let alguno = false;
    for (const t of this.tarjetas.values()) {
      if (t.valor !== o) continue;
      const el = [...t.cuerpo.querySelectorAll('[data-i],[data-k]')].find(e =>
        sel.i !== undefined ? e.dataset.i === String(sel.i) : e.dataset.k === sel.k);
      if (!el) continue;
      const clase = o.kind === 'pila' ? 'sale-arriba' : o.kind === 'cola' && sel.i === 0 ? 'sale-izquierda' : 'sale';
      el.classList.add(clase);
      alguno = true;
    }
    if (alguno) await new Promise(r => setTimeout(r, this.dur));
  }

  sincronizar(it) {
    const vivas = new Set();
    const escalares = [];
    const estructuras = [];
    for (const [n, v] of it.globales) (esEstructura(v) ? estructuras.push(['g:' + n, n, v, null]) : escalares.push([n, v]));
    const marco = it.marcos[it.marcos.length - 1];
    const locales = [];
    if (marco) {
      for (const [n, v] of marco.vars) (esEstructura(v) ? estructuras.push(['l:' + n, n, v, marco.nombre]) : locales.push([n, v]));
    }

    this.tarjetaVariables('_vars', 'Variables', 'globales', escalares, vivas);
    if (marco) this.tarjetaVariables('_locales', `Locales de ${marco.nombre}()`, 'función', locales, vivas);
    if (it.marcos.length) this.tarjetaLlamadas(it.marcos, vivas);
    for (const [clave, nombre, valor, funcion] of estructuras) this.tarjetaEstructura(clave, nombre, valor, funcion, vivas);

    for (const [clave, t] of this.tarjetas) {
      if (!vivas.has(clave)) { t.el.remove(); this.tarjetas.delete(clave); }
    }
    this.marcas.clear();
    this.ajustarLienzo();
  }

  // ---------- tarjetas ----------
  obtener(clave, clase) {
    let t = this.tarjetas.get(clave);
    if (t) return t;
    const el = document.createElement('article');
    el.className = 'tarjeta ' + clase;
    el.innerHTML = '<header class="tarjeta-cab" title="Arrastra para mover"><span class="t-nombre"></span><span class="t-tipo"></span><span class="t-len"></span></header><div class="tarjeta-cuerpo"></div>';
    this.lienzo.appendChild(el);
    t = { el, cab: el.firstChild, cuerpo: el.lastChild, firma: null, colocada: false, x: 0, y: 0, clase };
    this.tarjetas.set(clave, t);
    this.hacerMovible(clave, t);
    return t;
  }

  pintar(clave, t, nombre, tipo, len, html, firma) {
    if (t.firma !== firma) {
      t.cab.children[0].textContent = nombre;
      t.cab.children[1].textContent = tipo;
      t.cab.children[2].textContent = len;
      t.cuerpo.innerHTML = html;
      t.firma = firma;
    }
    if (!t.colocada) this.colocar(clave, t);
  }

  tarjetaVariables(clave, titulo, ambito, pares, vivas) {
    vivas.add(clave);
    const t = this.obtener(clave, 't-vars');
    const filas = pares.map(([n, v]) => `<tr><th>${escaparHTML(n)}</th><td>${celdaValor(v)}</td><td class="tipo">${Py.tipo(v)}</td></tr>`).join('');
    const html = pares.length ? `<table class="tabla-vars"><tbody>${filas}</tbody></table>` : '<p class="vacio">sin variables</p>';
    this.pintar(clave, t, titulo, ambito, '', html, html);
  }

  tarjetaLlamadas(marcos, vivas) {
    vivas.add('_llamadas');
    const t = this.obtener('_llamadas', 't-llamadas');
    const items = marcos.map((m, i) => {
      const args = m.args.map(([n, v]) => `${escaparHTML(n)}=${escaparHTML(corto(Py.repr(v), 14))}`).join(', ');
      return `<div class="llamada${i === marcos.length - 1 ? ' activa' : ''}">${escaparHTML(m.nombre)}(${args})</div>`;
    }).join('');
    const html = `<div class="pila-llamadas">${items}</div><p class="nota">La llamada activa está arriba: así funciona la recursión.</p>`;
    this.pintar('_llamadas', t, 'Pila de llamadas', 'call stack', `${marcos.length}`, html, html);
  }

  tarjetaEstructura(clave, nombre, v, funcion, vivas) {
    vivas.add(clave);
    const info = infoEstructura(v);
    const t = this.obtener(clave, 't-' + info.clase);
    if (t.clase !== 't-' + info.clase) {
      t.el.classList.replace(t.clase, 't-' + info.clase);
      t.clase = 't-' + info.clase;
    }
    const marcas = this.marcas.get(v) || [];
    const html = this.cuerpoEstructura(v, info, marcas);
    const titulo = funcion ? `${nombre} · en ${funcion}()` : nombre;
    this.pintar(clave, t, titulo, `${info.tipo} · ${info.py}`, `len ${Py.len(v)}`, html, info.clase + Py.repr(v) + JSON.stringify(marcas));
    t.valor = v;
  }

  cuerpoEstructura(v, info, marcas) {
    const clasesDe = (sel, entrada) => marcas
      .filter(m => m.t === 'todo' || (sel.i !== undefined ? m.i === sel.i : m.k === sel.k))
      .map(m => (m.t === 'in' ? entrada : m.t === 'lee' ? 'lee' : 'escribe'))
      .join(' ');

    if (v instanceof PyList && v.kind === 'pila') {
      const n = v.items.length, desde = Math.max(0, n - 14);
      const items = v.items.slice(desde).map((x, j) => {
        const i = desde + j;
        return `<div class="item ${clasesDe({ i }, 'entra-arriba')}${i === n - 1 ? ' es-tope' : ''}" data-i="${i}"><span class="idx">${i}</span>${celdaValor(x)}</div>`;
      }).join('');
      return `<div class="pila-vista"><div class="pila-tubo">${items || '<p class="vacio">pila vacía</p>'}</div>` +
        (desde ? `<p class="nota">+${desde} más abajo</p>` : '') + '<div class="pila-base">base</div></div>';
    }

    if (v instanceof PyList && v.kind === 'cola') {
      const n = v.items.length;
      const items = v.items.map((x, i) =>
        `<div class="item ${clasesDe({ i }, 'entra-derecha')}" data-i="${i}">${celdaValor(x)}${i === 0 ? '<small class="marca-pos">frente</small>' : ''}${i === n - 1 && n > 1 ? '<small class="marca-pos">final</small>' : ''}</div>`).join('');
      return `<div class="cola-vista"><span class="extremo">sale<br>←</span><div class="cola-tubo">${items || '<p class="vacio">cola vacía</p>'}</div><span class="extremo">←<br>entra</span></div>`;
    }

    if (v instanceof PyList || v instanceof PyTuple) {
      const items = v.items.map((x, i) =>
        `<div class="celda ${clasesDe({ i }, 'entra')}" data-i="${i}"><small class="idx">${i}</small>${celdaValor(x)}</div>`).join('');
      const vacio = v instanceof PyTuple ? 'tupla vacía ( )' : 'lista vacía [ ]';
      return `<div class="secuencia ${v instanceof PyTuple ? 'es-tupla' : ''}">${items || `<p class="vacio">${vacio}</p>`}</div>` +
        (v instanceof PyTuple ? '<p class="nota">inmutable: no se puede cambiar</p>' : '');
    }

    if (v instanceof PyDict) {
      const filas = [...v.map.entries()].map(([h, [k, x]]) =>
        `<div class="fila-dic ${clasesDe({ k: h }, 'entra')}" data-k="${escaparHTML(h)}"><span class="clave">${celdaValor(k)}</span><span class="flecha">→</span><span class="valor">${celdaValor(x)}</span></div>`).join('');
      return `<div class="dic-vista">${filas || '<p class="vacio">diccionario vacío { }</p>'}</div>`;
    }

    const items = [...v.map.entries()].map(([h, x]) =>
      `<div class="ficha ${clasesDe({ k: h }, 'entra')}" data-k="${escaparHTML(h)}">${celdaValor(x)}</div>`).join('');
    return `<div class="conj-vista">${items || '<p class="vacio">conjunto vacío set()</p>'}</div>` +
      '<p class="nota">sin orden fijo y sin repetidos</p>';
  }

  // ---------- posición y arrastre ----------
  colocar(clave, t) {
    const guardada = this.posiciones[clave];
    const pos = guardada || this.huecoLibre(t);
    this.mover(t, pos.x, pos.y);
    t.colocada = true;
  }

  huecoLibre(t) {
    const ancho = Math.max(this.contenedor.clientWidth, 320);
    const w = t.el.offsetWidth, h = t.el.offsetHeight, m = 14;
    const otras = [...this.tarjetas.values()].filter(o => o !== t && o.colocada)
      .map(o => ({ x: o.x, y: o.y, w: o.el.offsetWidth, h: o.el.offsetHeight }));
    for (let y = m; y < 6000; y += 12) {
      for (let x = m; x === m || x + w + m <= ancho; x += 12) {
        if (!otras.some(r => x < r.x + r.w + m && x + w + m > r.x && y < r.y + r.h + m && y + h + m > r.y)) return { x, y };
      }
    }
    return { x: m, y: m };
  }

  mover(t, x, y) {
    t.x = Math.max(0, Math.round(x));
    t.y = Math.max(0, Math.round(y));
    t.el.style.transform = `translate(${t.x}px, ${t.y}px)`;
  }

  hacerMovible(clave, t) {
    t.cab.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      t.cab.setPointerCapture(e.pointerId);
      t.el.style.zIndex = ++this.capa;
      t.el.classList.add('arrastrando');
      const x0 = e.clientX, y0 = e.clientY, tx = t.x, ty = t.y;
      const mover = ev => this.mover(t, tx + ev.clientX - x0, ty + ev.clientY - y0);
      const soltar = () => {
        t.cab.removeEventListener('pointermove', mover);
        t.cab.removeEventListener('pointerup', soltar);
        t.cab.removeEventListener('pointercancel', soltar);
        t.el.classList.remove('arrastrando');
        this.posiciones[clave] = { x: t.x, y: t.y };
        this.guardarPosiciones();
        this.ajustarLienzo();
      };
      t.cab.addEventListener('pointermove', mover);
      t.cab.addEventListener('pointerup', soltar);
      t.cab.addEventListener('pointercancel', soltar);
    });
  }

  ordenar() {
    this.posiciones = {};
    this.guardarPosiciones();
    for (const t of this.tarjetas.values()) t.colocada = false;
    for (const [clave, t] of this.tarjetas) this.colocar(clave, t);
    this.ajustarLienzo();
  }

  guardarPosiciones() {
    try { localStorage.setItem('simulador:posiciones', JSON.stringify(this.posiciones)); } catch { /* sin almacenamiento */ }
  }

  ajustarLienzo() {
    let w = 0, h = 0;
    for (const t of this.tarjetas.values()) {
      w = Math.max(w, t.x + t.el.offsetWidth);
      h = Math.max(h, t.y + t.el.offsetHeight);
    }
    this.lienzo.style.width = w ? w + 24 + 'px' : '';
    this.lienzo.style.height = h ? h + 24 + 'px' : '';
    this.contenedor.classList.toggle('sin-tarjetas', this.tarjetas.size === 0);
  }
}
