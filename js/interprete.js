'use strict';
/*
 * Intérprete que recorre los bloques con la semántica de Python.
 * Antes de cada sentencia (y en cada vuelta de un ciclo) llama a ui.paso(),
 * que actualiza el escenario, resalta el bloque y la línea, y espera.
 */

class SenalBreak {}
class SenalContinue {}
class SenalStop {}
class SenalReturn { constructor(valor) { this.valor = valor; } }

const LIMITE_PASOS = 300000;
const LIMITE_RECURSION = 150;

const METODOS = {
  list: ['append', 'insert', 'remove', 'extend', 'sort', 'reverse', 'clear', 'pop', 'index', 'count'],
  deque: ['append', 'appendleft', 'pop', 'popleft', 'remove', 'extend', 'insert', 'reverse', 'clear', 'index', 'count'],
  dict: ['get', 'keys', 'values', 'items', 'pop', 'clear'],
  set: ['add', 'discard', 'remove', 'pop', 'clear'],
};

const esDefinicion = b => b.type === 'procedures_defnoreturn' || b.type === 'procedures_defreturn';

class Interprete {
  constructor(ws, ui) {
    this.ws = ws;
    this.ui = ui;
    this.globales = new Map();
    this.marcos = [];
    this.pasos = 0;
    this.detener = false;
    this.actual = null;
  }

  // ---------- variables ----------
  vars() { return this.marcos.length ? this.marcos[this.marcos.length - 1].vars : this.globales; }

  leer(nombre) {
    if (this.marcos.length) {
      const m = this.marcos[this.marcos.length - 1].vars;
      if (m.has(nombre)) return m.get(nombre);
    }
    if (this.globales.has(nombre)) return this.globales.get(nombre);
    throw new PyError('NameError', `name '${nombre}' is not defined`);
  }

  escribir(nombre, v) { this.vars().set(nombre, v); }

  nom(b, campo = 'VAR') { return pyName(b.getField(campo).getText()); }

  objeto(b, metodo) {
    const v = this.leer(this.nom(b));
    const tipo = Py.tipo(v);
    if (!(METODOS[tipo] || []).includes(metodo)) {
      throw new PyError('AttributeError', `'${tipo}' object has no attribute '${metodo}'`);
    }
    return v;
  }

  marca(o, m) { this.ui.escenario.marcar(o, m); }
  async salida(o, sel) { await this.ui.escenario.salida(o, sel); }

  // ---------- ejecución ----------
  async correr() {
    const tops = this.ws.getTopBlocks(true).filter(b => b.isEnabled() && !b.outputConnection && !esDefinicion(b));
    try {
      for (const b of tops) await this.secuencia(b);
    } catch (e) {
      if (e instanceof SenalBreak || e instanceof SenalContinue) {
        throw new PyError('SyntaxError', `'${e instanceof SenalBreak ? 'break' : 'continue'}' outside loop`);
      }
      throw e;
    }
  }

  async paso(b, clave) {
    if (this.detener) throw new SenalStop();
    if (++this.pasos > LIMITE_PASOS) {
      throw new PyError('RuntimeError', `el programa superó ${LIMITE_PASOS.toLocaleString('es')} pasos`);
    }
    this.actual = b;
    await this.ui.paso(b, clave || b.id, this);
    if (this.detener) throw new SenalStop();
  }

  async secuencia(b) {
    while (b) {
      if (b.isEnabled()) await this.sentencia(b);
      b = b.getNextBlock();
    }
  }

  async cuerpo(b, nombre) { await this.secuencia(b.getInputTargetBlock(nombre)); }

  async val(b, nombre) {
    const t = b.getInputTargetBlock(nombre);
    if (!t) throw new PyError('Bloque incompleto', `falta conectar un valor en «${b.toString().replace(/\s+/g, ' ').trim()}»`);
    return this.expr(t);
  }

  async opc(b, nombre, defecto) {
    const t = b.getInputTargetBlock(nombre);
    return t ? this.expr(t) : defecto;
  }

  async ciclo(b, valores, alEntrar) {
    for (let i = 0; i < valores.length; i++) {
      if (i > 0) await this.paso(b);
      alEntrar(valores[i], i);
      try {
        await this.cuerpo(b, 'DO');
      } catch (e) {
        if (e instanceof SenalBreak) break;
        if (e instanceof SenalContinue) continue;
        throw e;
      }
    }
  }

  async sentencia(b) {
    await this.paso(b);
    switch (b.type) {
      case 'py_comment':
      case 'py_pass':
        return;

      case 'variables_set':
        this.escribir(this.nom(b), await this.val(b, 'VALUE'));
        return;

      case 'math_change': {
        const n = this.nom(b), op = b.getFieldValue('OP') || '+=';
        const d = await this.val(b, 'DELTA');
        const actual = this.leer(n);
        if (op === '+=' && actual instanceof PyList) {
          for (const x of Py.iterar(d)) { actual.items.push(x); this.marca(actual, { t: 'in', i: actual.items.length - 1 }); }
          return;
        }
        this.escribir(n, Py.binop(op.slice(0, -1), actual, d));
        return;
      }

      case 'py_print':
        this.ui.imprimir(Py.str(await this.opc(b, 'VALUE', '')));
        return;

      case 'py_print2': {
        const a = await this.val(b, 'A'), c = await this.val(b, 'B');
        this.ui.imprimir(Py.str(a) + ' ' + Py.str(c));
        return;
      }

      case 'controls_if': {
        const n = b.elseifCount_ || 0;
        for (let i = 0; i <= n; i++) {
          if (Py.verdad(await this.val(b, 'IF' + i))) { await this.cuerpo(b, 'DO' + i); return; }
        }
        if (b.elseCount_) await this.cuerpo(b, 'ELSE');
        return;
      }

      case 'py_while': {
        for (let vuelta = 0; ; vuelta++) {
          if (vuelta > 0) await this.paso(b);
          if (!Py.verdad(await this.val(b, 'COND'))) return;
          try {
            await this.cuerpo(b, 'DO');
          } catch (e) {
            if (e instanceof SenalBreak) return;
            if (e instanceof SenalContinue) continue;
            throw e;
          }
        }
      }

      case 'py_for_range': {
        const ent = v => {
          if (!Py.esEntero(v)) throw new PyError('TypeError', `'${Py.tipo(v)}' object cannot be interpreted as an integer`);
          return +v;
        };
        const ini = ent(await this.opc(b, 'START', 0)), fin = ent(await this.val(b, 'END')), paso = ent(await this.opc(b, 'STEP', 1));
        if (paso === 0) throw new PyError('ValueError', 'range() arg 3 must not be zero');
        const valores = [];
        for (let i = ini; paso > 0 ? i < fin : i > fin; i += paso) {
          valores.push(i);
          if (valores.length > LIMITE_PASOS) break;
        }
        const n = this.nom(b);
        await this.ciclo(b, valores, x => this.escribir(n, x));
        return;
      }

      case 'py_for_each': {
        const it = await this.val(b, 'ITER');
        const n = this.nom(b);
        const valores = Py.iterar(it);
        const llaves = it instanceof PyDict ? [...it.map.keys()] : it instanceof PySet ? [...it.map.keys()] : null;
        await this.ciclo(b, valores, (x, i) => {
          if (it instanceof PyList || it instanceof PyTuple) this.marca(it, { t: 'lee', i });
          else if (llaves) this.marca(it, { t: 'lee', k: llaves[i] });
          this.escribir(n, x);
        });
        return;
      }

      case 'py_for_items': {
        const d = await this.val(b, 'DICT');
        if (!(d instanceof PyDict)) throw new PyError('AttributeError', `'${Py.tipo(d)}' object has no attribute 'items'`);
        const k = this.nom(b, 'K'), v = this.nom(b, 'V');
        const pares = [...d.map.entries()];
        await this.ciclo(b, pares, ([h, [clave, valor]]) => {
          this.marca(d, { t: 'lee', k: h });
          this.escribir(k, clave);
          this.escribir(v, valor);
        });
        return;
      }

      case 'py_break':
        throw b.getFieldValue('KW') === 'break' ? new SenalBreak() : new SenalContinue();

      case 'py_return':
        if (!this.marcos.length) throw new PyError('SyntaxError', "'return' outside function");
        throw new SenalReturn(await this.opc(b, 'VALUE', null));

      case 'procedures_ifreturn':
        if (!this.marcos.length) throw new PyError('SyntaxError', "'return' outside function");
        if (Py.verdad(await this.val(b, 'CONDITION'))) {
          throw new SenalReturn(b.hasReturnValue_ ? await this.val(b, 'VALUE') : null);
        }
        return;

      case 'procedures_callnoreturn':
        await this.llamar(b);
        return;

      // ----- listas, pilas y colas -----
      case 'py_list_append':
      case 'py_stack_push':
      case 'py_queue_enqueue': {
        const o = this.objeto(b, 'append');
        if (b.type === 'py_stack_push' && o.kind === 'lista') o.kind = 'pila';
        const v = await this.val(b, 'VALUE');
        o.items.push(v);
        this.marca(o, { t: 'in', i: o.items.length - 1 });
        return;
      }

      case 'py_list_insert': {
        const o = this.objeto(b, 'insert');
        const pos = await this.val(b, 'INDEX'), v = await this.val(b, 'VALUE');
        let i = Py.entero(pos, 'list'), n = o.items.length;
        if (i < 0) i = Math.max(0, n + i);
        i = Math.min(i, n);
        o.items.splice(i, 0, v);
        this.marca(o, { t: 'in', i });
        return;
      }

      case 'py_list_remove': {
        const o = this.objeto(b, 'remove');
        const v = await this.val(b, 'VALUE');
        const i = o.items.findIndex(x => Py.igual(x, v));
        if (i < 0) throw new PyError('ValueError', `${Py.tipo(o)}.remove(x): x not in ${Py.tipo(o)}`);
        await this.salida(o, { i });
        o.items.splice(i, 1);
        return;
      }

      case 'py_list_extend': {
        const o = this.objeto(b, 'extend');
        for (const x of Py.iterar(await this.val(b, 'VALUE'))) {
          o.items.push(x);
          this.marca(o, { t: 'in', i: o.items.length - 1 });
        }
        return;
      }

      case 'py_list_method0': {
        const m = b.getFieldValue('M');
        const o = this.objeto(b, m);
        if (m === 'sort') o.items.sort((x, y) => Py.orden(x, y));
        else if (m === 'reverse') o.items.reverse();
        else o.items.length = 0;
        this.marca(o, { t: 'todo' });
        return;
      }

      case 'py_list_pop_stmt':
      case 'py_stack_pop_stmt':
      case 'py_queue_dequeue_stmt':
        await this.sacar(b);
        return;

      case 'py_setitem':
      case 'py_dict_set': {
        const v = await this.val(b, 'VALUE');
        const o = this.leer(this.nom(b));
        const k = await this.val(b, 'KEY');
        if (o instanceof PyDict) {
          const existia = o.map.has(Py.clave(k));
          const h = Py.dictSet(o, k, v);
          this.marca(o, { t: existia ? 'escribe' : 'in', k: h });
        } else if (o instanceof PyList) {
          const i = Py.posicion(k, o.items.length, Py.tipo(o));
          o.items[i] = v;
          this.marca(o, { t: 'escribe', i });
        } else {
          throw new PyError('TypeError', `'${Py.tipo(o)}' object does not support item assignment`);
        }
        return;
      }

      case 'py_delitem':
      case 'py_dict_del': {
        const o = this.leer(this.nom(b));
        const k = await this.val(b, 'KEY');
        if (o instanceof PyDict) {
          const h = Py.clave(k);
          if (!o.map.has(h)) throw new PyError('KeyError', Py.repr(k));
          await this.salida(o, { k: h });
          o.map.delete(h);
        } else if (o instanceof PyList) {
          const i = Py.posicion(k, o.items.length, Py.tipo(o));
          await this.salida(o, { i });
          o.items.splice(i, 1);
        } else {
          throw new PyError('TypeError', `'${Py.tipo(o)}' object doesn't support item deletion`);
        }
        return;
      }

      // ----- conjuntos -----
      case 'py_set_add': {
        const o = this.objeto(b, 'add');
        const v = await this.val(b, 'VALUE');
        const h = Py.clave(v);
        const nuevo = !o.map.has(h);
        Py.setAdd(o, v);
        this.marca(o, { t: nuevo ? 'in' : 'lee', k: h });
        return;
      }

      case 'py_set_remove': {
        const m = b.getFieldValue('M');
        const o = this.objeto(b, m);
        const v = await this.val(b, 'VALUE');
        const h = Py.clave(v);
        if (!o.map.has(h)) {
          if (m === 'remove') throw new PyError('KeyError', Py.repr(v));
          return;
        }
        await this.salida(o, { k: h });
        o.map.delete(h);
        return;
      }

      case 'py_unpack': {
        const partes = Py.iterar(await this.val(b, 'VALUE'));
        if (partes.length > 2) throw new PyError('ValueError', 'too many values to unpack (expected 2)');
        if (partes.length < 2) throw new PyError('ValueError', `not enough values to unpack (expected 2, got ${partes.length})`);
        this.escribir(this.nom(b, 'A'), partes[0]);
        this.escribir(this.nom(b, 'B'), partes[1]);
        return;
      }
    }
    throw new PyError('Bloque no soportado', b.type);
  }

  // pop(), pop(i) y popleft() comparten la animación de salida.
  async sacar(b) {
    const izquierda = b.type === 'py_queue_dequeue' || b.type === 'py_queue_dequeue_stmt';
    const o = this.objeto(b, izquierda ? 'popleft' : 'pop');
    if ((b.type === 'py_stack_pop' || b.type === 'py_stack_pop_stmt') && o.kind === 'lista') o.kind = 'pila';
    const n = o.items.length;
    if (!n) throw new PyError('IndexError', o.kind === 'cola' ? 'pop from an empty deque' : 'pop from empty list');
    let i = n - 1;
    if (izquierda) i = 0;
    else if (b.getInput('INDEX')) {
      const pos = await this.opc(b, 'INDEX', undefined);
      if (pos !== undefined) {
        i = Py.entero(pos, 'list');
        if (i < 0) i += n;
        if (i < 0 || i >= n) throw new PyError('IndexError', 'pop index out of range');
      }
    }
    await this.salida(o, { i });
    return o.items.splice(i, 1)[0];
  }

  async llamar(b) {
    const nombre = b.getFieldValue('NAME');
    const def = Blockly.Procedures.getDefinition(nombre, this.ws);
    if (!def || !def.isEnabled()) throw new PyError('NameError', `name '${pyName(nombre)}' is not defined`);
    const params = def.getVars().map(pyName);
    const args = [];
    for (let i = 0; i < params.length; i++) args.push(await this.val(b, 'ARG' + i));
    if (this.marcos.length >= LIMITE_RECURSION) throw new PyError('RecursionError', 'maximum recursion depth exceeded');
    const marco = { nombre: pyName(nombre), vars: new Map(params.map((p, i) => [p, args[i]])), args: params.map((p, i) => [p, args[i]]) };
    const anterior = this.actual;
    this.marcos.push(marco);
    let resultado = null;
    try {
      await this.cuerpo(def, 'STACK');
      if (def.type === 'procedures_defreturn' && def.getInputTargetBlock('RETURN')) {
        await this.paso(def, def.id + ':ret');
        resultado = await this.val(def, 'RETURN');
      }
    } catch (e) {
      if (e instanceof SenalReturn) resultado = e.valor;
      else if (e instanceof SenalBreak || e instanceof SenalContinue) throw new PyError('SyntaxError', "'break' outside loop");
      else throw e;
    } finally {
      this.marcos.pop();
    }
    this.actual = anterior;
    return resultado;
  }

  // ---------- expresiones ----------
  async expr(b) {
    switch (b.type) {
      case 'py_number': return parsearNumero(b.getFieldValue('NUM'));
      case 'math_number': { const n = Number(b.getFieldValue('NUM')); return Number.isInteger(n) ? n : new PyFloat(n); }
      case 'py_text': return b.getFieldValue('TEXT');
      case 'py_bool': return b.getFieldValue('BOOL') === 'True';
      case 'logic_boolean': return b.getFieldValue('BOOL') === 'TRUE';
      case 'py_none': return null;
      case 'variables_get': return this.leer(this.nom(b));

      case 'py_arith':
      case 'py_set_op': {
        const a = await this.val(b, 'A'), c = await this.val(b, 'B');
        const op = b.getFieldValue('OP');
        if (b.type === 'py_set_op' && !(a instanceof PySet && c instanceof PySet)) {
          throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${Py.tipo(a)}' and '${Py.tipo(c)}'`);
        }
        return Py.binop(op, a, c);
      }

      case 'py_compare': {
        const a = await this.val(b, 'A'), c = await this.val(b, 'B');
        return Py.comparar(b.getFieldValue('OP'), a, c);
      }

      case 'py_logic': {
        const a = await this.val(b, 'A');
        const y = b.getFieldValue('OP') === 'and';
        if (y ? !Py.verdad(a) : Py.verdad(a)) return a;
        return this.val(b, 'B');
      }

      case 'py_not': return !Py.verdad(await this.val(b, 'A'));

      case 'py_in': {
        const a = await this.val(b, 'A'), c = await this.val(b, 'B');
        const r = Py.buscar(c, a);
        if (r !== false && typeof r === 'number') this.marca(c, { t: 'lee', i: r });
        else if (r !== false && typeof r === 'string') this.marca(c, { t: 'lee', k: r });
        const esta = r !== false;
        return b.getFieldValue('OP') === 'in' ? esta : !esta;
      }

      case 'py_func1': return Py.funcion(b.getFieldValue('FUNC'), await this.val(b, 'A'));

      case 'py_random': {
        const a = await this.val(b, 'A'), c = await this.val(b, 'B');
        if (!Py.esEntero(a) || !Py.esEntero(c)) throw new PyError('TypeError', 'randint() solo acepta enteros');
        if (+a > +c) throw new PyError('ValueError', `empty range in randrange(${+a}, ${+c + 1})`);
        return +a + Math.floor(Math.random() * (+c - +a + 1));
      }

      case 'py_input': return this.ui.leer(Py.str(await this.opc(b, 'PROMPT', '')));

      case 'py_getitem': {
        const c = await this.val(b, 'SEQ'), k = await this.val(b, 'KEY');
        const [v, donde] = Py.getitem(c, k);
        if (c instanceof PyDict) this.marca(c, { t: 'lee', k: donde });
        else if (typeof c !== 'string') this.marca(c, { t: 'lee', i: donde });
        return v;
      }

      case 'py_slice': {
        const c = await this.val(b, 'SEQ');
        return Py.rebanada(c, await this.opc(b, 'A', null), await this.opc(b, 'B', null));
      }

      case 'py_lit_lista':
      case 'py_lit_dic':
      case 'py_lit_tupla':
      case 'py_lit_conj':
        return parsearLiteral(b.getFieldValue('LIT'));

      case 'py_list_empty': return new PyList([], 'lista');
      case 'py_stack_new': return new PyList([], 'pila');
      case 'py_queue_new': return new PyList([], 'cola');
      case 'py_dict_empty': return new PyDict();
      case 'py_set_empty': return new PySet();

      case 'py_list_pop':
      case 'py_stack_pop':
      case 'py_queue_dequeue':
        return this.sacar(b);

      case 'py_stack_peek':
      case 'py_queue_front':
      case 'py_queue_back': {
        const o = this.leer(this.nom(b));
        if (b.type === 'py_stack_peek' && o instanceof PyList && o.kind === 'lista') o.kind = 'pila';
        const [v, i] = Py.getitem(o, b.type === 'py_queue_front' ? 0 : -1);
        this.marca(o, { t: 'lee', i });
        return v;
      }

      case 'py_isempty':
      case 'py_isempty_cola':
        return Py.len(this.leer(this.nom(b))) === 0;

      case 'py_list_query': {
        const m = b.getFieldValue('M');
        const o = this.objeto(b, m);
        const v = await this.val(b, 'VALUE');
        if (m === 'count') return o.items.filter(x => Py.igual(x, v)).length;
        const i = o.items.findIndex(x => Py.igual(x, v));
        if (i < 0) throw new PyError('ValueError', `${Py.repr(v)} is not in list`);
        this.marca(o, { t: 'lee', i });
        return i;
      }

      case 'py_dict_get': {
        const o = this.objeto(b, 'get');
        const k = await this.val(b, 'KEY');
        const def = await this.opc(b, 'DEFAULT', null);
        const h = Py.clave(k), e = o.map.get(h);
        if (e) { this.marca(o, { t: 'lee', k: h }); return e[1]; }
        return def;
      }

      case 'py_dict_view': {
        const m = b.getFieldValue('M');
        const o = this.objeto(b, m);
        const pares = [...o.map.values()];
        const items = m === 'keys' ? pares.map(p => p[0]) : m === 'values' ? pares.map(p => p[1]) : pares.map(p => new PyTuple([p[0], p[1]]));
        const r = new PyList(items, 'lista');
        r.vista = 'dict_' + m;
        return r;
      }

      case 'py_dict_pop': {
        const o = this.objeto(b, 'pop');
        const k = await this.val(b, 'KEY');
        const h = Py.clave(k), e = o.map.get(h);
        if (!e) throw new PyError('KeyError', Py.repr(k));
        await this.salida(o, { k: h });
        o.map.delete(h);
        return e[1];
      }

      case 'py_tuple_pack': return new PyTuple([await this.val(b, 'A'), await this.val(b, 'B')]);

      case 'py_str_method': return Py.metodoTexto(await this.val(b, 'A'), b.getFieldValue('M'));
      case 'py_str_method1': {
        const s = await this.val(b, 'A');
        return Py.metodoTexto(s, b.getFieldValue('M'), await this.val(b, 'B'));
      }
      case 'py_str_replace': {
        const s = await this.val(b, 'A'), x = await this.val(b, 'B'), y = await this.val(b, 'C');
        if (typeof s !== 'string') throw new PyError('AttributeError', `'${Py.tipo(s)}' object has no attribute 'replace'`);
        if (typeof x !== 'string' || typeof y !== 'string') throw new PyError('TypeError', 'replace() argument must be str');
        return s.split(x).join(y);
      }

      case 'procedures_callreturn': return this.llamar(b);
    }
    throw new PyError('Bloque no soportado', b.type);
  }
}
