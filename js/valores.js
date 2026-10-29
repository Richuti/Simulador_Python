'use strict';
/*
 * Modelo de valores de Python usado por el intérprete del simulador.
 * Reproduce la semántica de Python (int/float, listas, tuplas, dict, set,
 * deque) y sus mensajes de error, para que lo que se ve en el simulador
 * sea lo mismo que pasaría al ejecutar el código exportado.
 */

class PyFloat { constructor(v) { this.v = v; } }
class PyList { constructor(items = [], kind = 'lista') { this.items = items; this.kind = kind; this.vista = null; } }
class PyTuple { constructor(items = []) { this.items = items; } }
class PyDict { constructor() { this.map = new Map(); } }
class PySet { constructor() { this.map = new Map(); } }
class PyType { constructor(nombre) { this.nombre = nombre; } }
class PyError extends Error { constructor(tipo, msg) { super(msg); this.tipo = tipo; } }

const PALABRAS_PY = new Set(('False None True and as assert async await break class continue def del elif else ' +
  'except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield').split(' '));

function pyName(nombre) {
  let n = String(nombre).trim().replace(/[^\p{L}\p{N}_]+/gu, '_');
  if (!n) n = '_';
  if (/^\p{N}/u.test(n)) n = '_' + n;
  if (PALABRAS_PY.has(n)) n += '_';
  return n;
}

function parsearNumero(t) {
  t = String(t).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) throw new PyError('SyntaxError', `número no válido: ${t}`);
  const n = Number(t);
  return /[.eE]/.test(t) ? new PyFloat(n) : n;
}

const Py = {
  tipo(v) {
    if (v === null || v === undefined) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return 'int';
    if (typeof v === 'string') return 'str';
    if (v instanceof PyFloat) return 'float';
    if (v instanceof PyList) return v.kind === 'cola' ? 'deque' : (v.vista || 'list');
    if (v instanceof PyTuple) return 'tuple';
    if (v instanceof PyDict) return 'dict';
    if (v instanceof PySet) return 'set';
    if (v instanceof PyType) return 'type';
    return 'object';
  },

  esNum(v) { return typeof v === 'number' || typeof v === 'boolean' || v instanceof PyFloat; },
  num(v) { return v instanceof PyFloat ? v.v : +v; },
  haz(x, flotante) { return flotante ? new PyFloat(x) : x; },
  esEntero(v) { return typeof v === 'number' || typeof v === 'boolean'; },

  reprFloat(x) {
    if (Number.isNaN(x)) return 'nan';
    if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
    if (Number.isInteger(x) && Math.abs(x) < 1e16) return (x < 0 || Object.is(x, -0) ? '-' : '') + Math.abs(x).toFixed(1);
    return String(x);
  },

  reprStr(s) {
    const q = s.includes("'") && !s.includes('"') ? '"' : "'";
    let r = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    if (q === "'") r = r.replace(/'/g, "\\'");
    return q + r + q;
  },

  repr(v, prof = 0) {
    if (prof > 40) return '...';
    const r = x => Py.repr(x, prof + 1);
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return Py.reprStr(v);
    if (v instanceof PyFloat) return Py.reprFloat(v.v);
    if (v instanceof PyList) {
      const dentro = '[' + v.items.map(r).join(', ') + ']';
      if (v.kind === 'cola') return 'deque(' + dentro + ')';
      if (v.vista) return v.vista + '(' + dentro + ')';
      return dentro;
    }
    if (v instanceof PyTuple) return v.items.length === 1 ? '(' + r(v.items[0]) + ',)' : '(' + v.items.map(r).join(', ') + ')';
    if (v instanceof PyDict) return '{' + [...v.map.values()].map(([k, x]) => r(k) + ': ' + r(x)).join(', ') + '}';
    if (v instanceof PySet) return v.map.size ? '{' + [...v.map.values()].map(r).join(', ') + '}' : 'set()';
    if (v instanceof PyType) return `<class '${v.nombre}'>`;
    return String(v);
  },

  str(v) { return typeof v === 'string' ? v : Py.repr(v); },

  clave(v) {
    if (v === null || v === undefined) return 'N';
    if (typeof v === 'boolean') return 'n' + (+v);
    if (typeof v === 'number') return 'n' + v;
    if (v instanceof PyFloat) return 'n' + v.v;
    if (typeof v === 'string') return 's' + v;
    if (v instanceof PyTuple) return 't(' + v.items.map(Py.clave).join(',') + ')';
    throw new PyError('TypeError', `unhashable type: '${Py.tipo(v)}'`);
  },

  igual(a, b) {
    if (Py.esNum(a) && Py.esNum(b)) return Py.num(a) === Py.num(b);
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    if (a === null || b === null || a === undefined || b === undefined) return a == b;
    if (Py.tipo(a) !== Py.tipo(b)) return false;
    if (a instanceof PyList || a instanceof PyTuple) {
      return a.items.length === b.items.length && a.items.every((x, i) => Py.igual(x, b.items[i]));
    }
    if (a instanceof PyDict) {
      if (a.map.size !== b.map.size) return false;
      for (const [h, [, x]] of a.map) { const e = b.map.get(h); if (!e || !Py.igual(x, e[1])) return false; }
      return true;
    }
    if (a instanceof PySet) return a.map.size === b.map.size && [...a.map.keys()].every(h => b.map.has(h));
    if (a instanceof PyType) return a.nombre === b.nombre;
    return a === b;
  },

  orden(a, b, op = '<') {
    if (Py.esNum(a) && Py.esNum(b)) { const x = Py.num(a), y = Py.num(b); return x < y ? -1 : x > y ? 1 : 0; }
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
    if ((a instanceof PyList && b instanceof PyList) || (a instanceof PyTuple && b instanceof PyTuple)) {
      const n = Math.min(a.items.length, b.items.length);
      for (let i = 0; i < n; i++) {
        if (!Py.igual(a.items[i], b.items[i])) return Py.orden(a.items[i], b.items[i], op);
      }
      return a.items.length - b.items.length;
    }
    throw new PyError('TypeError', `'${op}' not supported between instances of '${Py.tipo(a)}' and '${Py.tipo(b)}'`);
  },

  comparar(op, a, b) {
    switch (op) {
      case '==': return Py.igual(a, b);
      case '!=': return !Py.igual(a, b);
      case '<': return Py.orden(a, b, op) < 0;
      case '<=': return Py.orden(a, b, op) <= 0;
      case '>': return Py.orden(a, b, op) > 0;
      case '>=': return Py.orden(a, b, op) >= 0;
    }
  },

  verdad(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v instanceof PyFloat) return v.v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (v instanceof PyList || v instanceof PyTuple) return v.items.length > 0;
    if (v instanceof PyDict || v instanceof PySet) return v.map.size > 0;
    return true;
  },

  len(v) {
    if (typeof v === 'string') return [...v].length;
    if (v instanceof PyList || v instanceof PyTuple) return v.items.length;
    if (v instanceof PyDict || v instanceof PySet) return v.map.size;
    throw new PyError('TypeError', `object of type '${Py.tipo(v)}' has no len()`);
  },

  iterar(v) {
    if (typeof v === 'string') return [...v];
    if (v instanceof PyList || v instanceof PyTuple) return v.items.slice();
    if (v instanceof PyDict) return [...v.map.values()].map(e => e[0]);
    if (v instanceof PySet) return [...v.map.values()];
    throw new PyError('TypeError', `'${Py.tipo(v)}' object is not iterable`);
  },

  binop(op, a, b) {
    if (Py.esNum(a) && Py.esNum(b)) {
      const x = Py.num(a), y = Py.num(b), f = a instanceof PyFloat || b instanceof PyFloat;
      switch (op) {
        case '+': return Py.haz(x + y, f);
        case '-': return Py.haz(x - y, f);
        case '*': return Py.haz(x * y, f);
        case '/':
          if (y === 0) throw new PyError('ZeroDivisionError', 'division by zero');
          return new PyFloat(x / y);
        case '//':
          if (y === 0) throw new PyError('ZeroDivisionError', f ? 'float floor division by zero' : 'integer division or modulo by zero');
          return Py.haz(Math.floor(x / y), f);
        case '%':
          if (y === 0) throw new PyError('ZeroDivisionError', f ? 'float modulo' : 'integer division or modulo by zero');
          return Py.haz(((x % y) + y) % y, f);
        case '**':
          if (!f && y >= 0) return Math.pow(x, y);
          if (x === 0 && y < 0) throw new PyError('ZeroDivisionError', '0.0 cannot be raised to a negative power');
          return new PyFloat(Math.pow(x, y));
        case '|': case '&': case '^':
          if (!f) return op === '|' ? x | y : op === '&' ? x & y : x ^ y;
      }
    }
    if (typeof a === 'string' && typeof b === 'string' && op === '+') return a + b;
    if (op === '*' && typeof a === 'string' && Py.esEntero(b)) return a.repeat(Math.max(0, +b));
    if (op === '*' && Py.esEntero(a) && typeof b === 'string') return b.repeat(Math.max(0, +a));
    if (a instanceof PyList && b instanceof PyList && op === '+' && Py.tipo(a) === Py.tipo(b)) return new PyList([...a.items, ...b.items], a.kind === 'cola' ? 'cola' : 'lista');
    if (a instanceof PyTuple && b instanceof PyTuple && op === '+') return new PyTuple([...a.items, ...b.items]);
    if (op === '*' && (a instanceof PyList || a instanceof PyTuple) && Py.esEntero(b)) {
      const items = [];
      for (let i = 0; i < +b; i++) items.push(...a.items);
      return a instanceof PyTuple ? new PyTuple(items) : new PyList(items, 'lista');
    }
    if (a instanceof PySet && b instanceof PySet && '|&-^'.includes(op)) {
      const r = new PySet();
      for (const [h, x] of a.map) {
        const en = b.map.has(h);
        if (op === '|' || (op === '&' && en) || ((op === '-' || op === '^') && !en)) r.map.set(h, x);
      }
      if (op === '|' || op === '^') for (const [h, x] of b.map) if (!a.map.has(h)) r.map.set(h, x);
      return r;
    }
    if (op === '+' && typeof a === 'string') {
      throw new PyError('TypeError', `can only concatenate str (not "${Py.tipo(b)}") to str`);
    }
    if (op === '+' && a instanceof PyList && !(a.kind === 'cola')) {
      throw new PyError('TypeError', `can only concatenate list (not "${Py.tipo(b)}") to list`);
    }
    throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${Py.tipo(a)}' and '${Py.tipo(b)}'`);
  },

  entero(i, cont) {
    if (Py.esEntero(i)) return +i;
    throw new PyError('TypeError', `${cont} indices must be integers or slices, not ${Py.tipo(i)}`);
  },

  posicion(i, n, cont) {
    let k = Py.entero(i, cont);
    if (k < 0) k += n;
    if (k < 0 || k >= n) throw new PyError('IndexError', `${cont} index out of range`);
    return k;
  },

  // Devuelve [valor, índice normalizado o clave hash] para poder resaltarlo en el escenario.
  getitem(c, k) {
    if (typeof c === 'string') { const ch = [...c]; const i = Py.posicion(k, ch.length, 'string'); return [ch[i], i]; }
    if (c instanceof PyList || c instanceof PyTuple) { const i = Py.posicion(k, c.items.length, Py.tipo(c)); return [c.items[i], i]; }
    if (c instanceof PyDict) {
      const h = Py.clave(k), e = c.map.get(h);
      if (!e) throw new PyError('KeyError', Py.repr(k));
      return [e[1], h];
    }
    throw new PyError('TypeError', `'${Py.tipo(c)}' object is not subscriptable`);
  },

  rebanada(c, a, b) {
    const norm = (x, n, def) => {
      if (x === undefined || x === null) return def;
      x = Py.entero(x, 'slice');
      if (x < 0) x = Math.max(0, x + n);
      return Math.min(x, n);
    };
    if (typeof c === 'string') { const ch = [...c]; return ch.slice(norm(a, ch.length, 0), norm(b, ch.length, ch.length)).join(''); }
    if (c instanceof PyList || c instanceof PyTuple) {
      const n = c.items.length, items = c.items.slice(norm(a, n, 0), norm(b, n, n));
      return c instanceof PyTuple ? new PyTuple(items) : new PyList(items, c.kind === 'cola' ? 'cola' : 'lista');
    }
    throw new PyError('TypeError', `'${Py.tipo(c)}' object is not subscriptable`);
  },

  // Devuelve -1/false si no está; si está, el índice o la clave hash.
  buscar(c, x) {
    if (typeof c === 'string') {
      if (typeof x !== 'string') throw new PyError('TypeError', `'in <string>' requires string as left operand, not ${Py.tipo(x)}`);
      return c.includes(x) ? true : false;
    }
    if (c instanceof PyList || c instanceof PyTuple) { const i = c.items.findIndex(y => Py.igual(x, y)); return i < 0 ? false : i; }
    if (c instanceof PyDict || c instanceof PySet) { const h = Py.clave(x); return c.map.has(h) ? h : false; }
    throw new PyError('TypeError', `argument of type '${Py.tipo(c)}' is not iterable`);
  },

  dictSet(d, k, v) {
    const h = Py.clave(k), e = d.map.get(h);
    if (e) e[1] = v; else d.map.set(h, [k, v]);
    return h;
  },

  setAdd(s, x) { const h = Py.clave(x); if (!s.map.has(h)) s.map.set(h, x); return h; },

  funcion(fn, a) {
    switch (fn) {
      case 'len': return Py.len(a);
      case 'str': return Py.str(a);
      case 'repr': return Py.repr(a);
      case 'bool': return Py.verdad(a);
      case 'type': return new PyType(Py.tipo(a));
      case 'int':
        if (typeof a === 'string') {
          if (!/^\s*[-+]?\d+\s*$/.test(a)) throw new PyError('ValueError', `invalid literal for int() with base 10: ${Py.reprStr(a)}`);
          return parseInt(a, 10);
        }
        if (Py.esNum(a)) return Math.trunc(Py.num(a));
        throw new PyError('TypeError', `int() argument must be a string, a bytes-like object or a real number, not '${Py.tipo(a)}'`);
      case 'float':
        if (typeof a === 'string') {
          const t = a.trim().toLowerCase();
          if (/^[-+]?(inf|infinity)$/.test(t)) return new PyFloat(t.startsWith('-') ? -Infinity : Infinity);
          if (/^[-+]?nan$/.test(t)) return new PyFloat(NaN);
          if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/.test(t)) throw new PyError('ValueError', `could not convert string to float: ${Py.reprStr(a)}`);
          return new PyFloat(Number(t));
        }
        if (Py.esNum(a)) return new PyFloat(Py.num(a));
        throw new PyError('TypeError', `float() argument must be a string or a real number, not '${Py.tipo(a)}'`);
      case 'abs':
        if (!Py.esNum(a)) throw new PyError('TypeError', `bad operand type for abs(): '${Py.tipo(a)}'`);
        return Py.haz(Math.abs(Py.num(a)), a instanceof PyFloat);
      case 'round': {
        if (!Py.esNum(a)) throw new PyError('TypeError', `type ${Py.tipo(a)} doesn't define __round__ method`);
        const x = Py.num(a);
        // Python redondea al par más cercano cuando está exactamente a la mitad.
        return Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x);
      }
      case 'sorted': return new PyList(Py.iterar(a).sort((x, y) => Py.orden(x, y)), 'lista');
      case 'sum': return Py.iterar(a).reduce((s, x) => Py.binop('+', s, x), 0);
      case 'max': case 'min': {
        const xs = Py.iterar(a);
        if (!xs.length) throw new PyError('ValueError', `${fn}() iterable argument is empty`);
        return xs.reduce((m, x) => (fn === 'max' ? Py.orden(x, m, '>') > 0 : Py.orden(x, m, '<') < 0) ? x : m);
      }
      case 'list': return new PyList(Py.iterar(a), 'lista');
      case 'tuple': return new PyTuple(Py.iterar(a));
      case 'set': { const s = new PySet(); for (const x of Py.iterar(a)) Py.setAdd(s, x); return s; }
    }
    throw new PyError('NameError', `name '${fn}' is not defined`);
  },

  metodoTexto(s, m, arg) {
    if (typeof s !== 'string') throw new PyError('AttributeError', `'${Py.tipo(s)}' object has no attribute '${m}'`);
    const pedirStr = () => {
      if (typeof arg !== 'string') throw new PyError('TypeError', `must be str, not ${Py.tipo(arg)}`);
      return arg;
    };
    switch (m) {
      case 'upper': return s.toUpperCase();
      case 'lower': return s.toLowerCase();
      case 'strip': return s.trim();
      case 'title': return s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
      case 'capitalize': return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      case 'isdigit': return /^\d+$/.test(s);
      case 'isalpha': return /^\p{L}+$/u.test(s);
      case 'split':
        if (arg === undefined || arg === null) return new PyList(s.split(/\s+/).filter(Boolean), 'lista');
        if (pedirStr() === '') throw new PyError('ValueError', 'empty separator');
        return new PyList(s.split(arg), 'lista');
      case 'join': {
        const xs = Py.iterar(arg);
        xs.forEach((x, i) => {
          if (typeof x !== 'string') throw new PyError('TypeError', `sequence item ${i}: expected str instance, ${Py.tipo(x)} found`);
        });
        return xs.join(s);
      }
      case 'count': pedirStr(); return arg === '' ? [...s].length + 1 : s.split(arg).length - 1;
      case 'find': return s.indexOf(pedirStr());
      case 'startswith': return s.startsWith(pedirStr());
      case 'endswith': return s.endsWith(pedirStr());
    }
    throw new PyError('AttributeError', `'str' object has no attribute '${m}'`);
  },
};

function parsearLiteral(texto) {
  const s = String(texto);
  let i = 0;
  const err = m => { throw new PyError('SyntaxError', `literal no válido (${m}): ${s}`); };
  const esp = () => { while (i < s.length && /\s/.test(s[i])) i++; };

  function valor() {
    esp();
    const c = s[i];
    if (c === '[') { i++; return new PyList(secuencia(']').vals, 'lista'); }
    if (c === '(') {
      i++;
      const r = secuencia(')');
      return r.vals.length === 1 && !r.coma ? r.vals[0] : new PyTuple(r.vals);
    }
    if (c === '{') { i++; return llaves(); }
    if (c === '"' || c === "'") return cadena();
    if (c !== undefined && /[-+\d.]/.test(c)) return numero();
    const m = /^(True|False|None)\b/.exec(s.slice(i));
    if (m) { i += m[0].length; return m[0] === 'True' ? true : m[0] === 'False' ? false : null; }
    err(c === undefined ? 'falta un valor' : `no se esperaba «${c}»`);
  }

  function secuencia(cierre) {
    const vals = [];
    let coma = false;
    esp();
    if (s[i] === cierre) { i++; return { vals, coma }; }
    for (;;) {
      vals.push(valor());
      esp();
      if (s[i] === ',') {
        i++; coma = true; esp();
        if (s[i] === cierre) { i++; return { vals, coma }; }
        continue;
      }
      if (s[i] === cierre) { i++; return { vals, coma }; }
      err(`falta «${cierre}» o «,»`);
    }
  }

  function llaves() {
    esp();
    if (s[i] === '}') { i++; return new PyDict(); }
    const primero = valor();
    esp();
    if (s[i] === ':') {
      const d = new PyDict();
      i++;
      Py.dictSet(d, primero, valor());
      esp();
      while (s[i] === ',') {
        i++; esp();
        if (s[i] === '}') break;
        const k = valor();
        esp();
        if (s[i] !== ':') err('falta «:»');
        i++;
        Py.dictSet(d, k, valor());
        esp();
      }
      if (s[i] !== '}') err('falta «}»');
      i++;
      return d;
    }
    const st = new PySet();
    Py.setAdd(st, primero);
    esp();
    while (s[i] === ',') {
      i++; esp();
      if (s[i] === '}') break;
      Py.setAdd(st, valor());
      esp();
    }
    if (s[i] !== '}') err('falta «}»');
    i++;
    return st;
  }

  function cadena() {
    const q = s[i++];
    let r = '';
    while (i < s.length && s[i] !== q) {
      if (s[i] === '\\') { i++; const e = s[i++]; r += e === 'n' ? '\n' : e === 't' ? '\t' : e; }
      else r += s[i++];
    }
    if (s[i] !== q) err('texto sin cerrar');
    i++;
    return r;
  }

  function numero() {
    const m = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(s.slice(i));
    if (!m) err('número mal escrito');
    i += m[0].length;
    return parsearNumero(m[0]);
  }

  const v = valor();
  esp();
  if (i < s.length) err(`sobra «${s.slice(i)}»`);
  return v;
}
