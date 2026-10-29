'use strict';
/*
 * Generador de código Python a partir de los bloques.
 * Cada línea guarda el id del bloque que la produjo, para resaltarla al ejecutar.
 */

const PREC = { ATOMO: 0, LLAMADA: 1, POT: 2, UNARIO: 3, MUL: 4, SUMA: 5, BAND: 6, BXOR: 7, BOR: 8, REL: 9, NOT: 10, AND: 11, OR: 12, NADA: 99 };
const PREC_OP = { '+': PREC.SUMA, '-': PREC.SUMA, '*': PREC.MUL, '/': PREC.MUL, '//': PREC.MUL, '%': PREC.MUL, '**': PREC.POT, '|': PREC.BOR, '&': PREC.BAND, '^': PREC.BXOR };
const SANGRIA = '    ';

function textoPy(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
}

class GeneradorPython {
  generar(ws) {
    this.imports = new Set();
    this.cuerpo = [];
    const tops = ws.getTopBlocks(true).filter(b => b.isEnabled() && !b.outputConnection);
    const defs = tops.filter(esDefinicion);
    const principal = tops.filter(b => !esDefinicion(b));

    for (const d of defs) { this.definicion(d); this.linea(0, '', null); }
    for (const b of principal) this.secuencia(b, 0);

    const lineas = [{ t: '# Programa generado con el Simulador de Estructuras de Datos', id: null }];
    if (this.imports.has('random')) lineas.push({ t: 'import random', id: null });
    if (this.imports.has('deque')) lineas.push({ t: 'from collections import deque', id: null });
    lineas.push({ t: '', id: null });
    lineas.push(...this.cuerpo);
    while (lineas.length && lineas[lineas.length - 1].t === '') lineas.pop();
    if (!this.cuerpo.length) lineas.push({ t: '# (arrastra bloques al área de trabajo para generar código)', id: null });
    return { lineas, texto: lineas.map(l => l.t).join('\n') + '\n' };
  }

  linea(n, t, id) { this.cuerpo.push({ t: t ? SANGRIA.repeat(n) + t : '', id }); }

  nom(b, campo = 'VAR') { return pyName(b.getField(campo).getText()); }

  secuencia(b, n) {
    let hubo = false;
    while (b) {
      if (b.isEnabled()) { this.sentencia(b, n); hubo = true; }
      b = b.getNextBlock();
    }
    return hubo;
  }

  bloqueInterno(b, entrada, n) {
    if (!this.secuencia(b.getInputTargetBlock(entrada), n)) this.linea(n, 'pass', null);
  }

  // Código de una entrada de valor, con paréntesis si la precedencia lo exige.
  v(b, entrada, prec = PREC.NADA, defecto = 'None', estricto = false) {
    const hijo = b.getInputTargetBlock(entrada);
    if (!hijo) return defecto;
    const [codigo, p] = this.expr(hijo);
    return p > prec || (estricto && p === prec) ? '(' + codigo + ')' : codigo;
  }

  definicion(d) {
    const nombre = pyName(d.getFieldValue('NAME'));
    const params = d.getVars().map(pyName);
    this.linea(0, `def ${nombre}(${params.join(', ')}):`, d.id);
    const hubo = this.secuencia(d.getInputTargetBlock('STACK'), 1);
    if (d.type === 'procedures_defreturn' && d.getInputTargetBlock('RETURN')) {
      this.linea(1, 'return ' + this.v(d, 'RETURN'), d.id + ':ret');
    } else if (!hubo) {
      this.linea(1, 'pass', null);
    }
  }

  llamada(b) {
    const nombre = pyName(b.getFieldValue('NAME'));
    const n = b.getVars().length;
    const args = [];
    for (let i = 0; i < n; i++) args.push(this.v(b, 'ARG' + i));
    return `${nombre}(${args.join(', ')})`;
  }

  sentencia(b, n) {
    const L = t => this.linea(n, t, b.id);
    const nom = this.nom.bind(this, b);
    switch (b.type) {
      case 'variables_set': {
        const valor = b.getInputTargetBlock('VALUE');
        const nota = valor && valor.type === 'py_stack_new' ? '  # pila (LIFO)' : valor && valor.type === 'py_queue_new' ? '  # cola (FIFO)' : '';
        return L(`${nom()} = ${this.v(b, 'VALUE')}${nota}`);
      }
      case 'math_change': return L(`${nom()} ${b.getFieldValue('OP') || '+='} ${this.v(b, 'DELTA', PREC.NADA, '1')}`);
      case 'py_comment': return L('# ' + b.getFieldValue('TEXT'));
      case 'py_pass': return L('pass');
      case 'py_print': return L(`print(${this.v(b, 'VALUE', PREC.NADA, '')})`);
      case 'py_print2': return L(`print(${this.v(b, 'A')}, ${this.v(b, 'B')})`);

      case 'controls_if': {
        const k = b.elseifCount_ || 0;
        for (let i = 0; i <= k; i++) {
          this.linea(n, `${i ? 'elif' : 'if'} ${this.v(b, 'IF' + i, PREC.NADA, 'False')}:`, i ? null : b.id);
          this.bloqueInterno(b, 'DO' + i, n + 1);
        }
        if (b.elseCount_) {
          this.linea(n, 'else:', null);
          this.bloqueInterno(b, 'ELSE', n + 1);
        }
        return;
      }
      case 'py_while':
        L(`while ${this.v(b, 'COND', PREC.NADA, 'False')}:`);
        return this.bloqueInterno(b, 'DO', n + 1);
      case 'py_for_range': {
        const ini = b.getInputTargetBlock('START'), paso = b.getInputTargetBlock('STEP');
        const esNum = (x, val) => x && (x.type === 'py_number' || x.type === 'math_number') && String(x.getFieldValue('NUM')) === val;
        const fin = this.v(b, 'END', PREC.NADA, '0');
        let args;
        if (esNum(paso, '1') || !paso) args = esNum(ini, '0') || !ini ? fin : `${this.v(b, 'START')}, ${fin}`;
        else args = `${this.v(b, 'START', PREC.NADA, '0')}, ${fin}, ${this.v(b, 'STEP')}`;
        L(`for ${nom()} in range(${args}):`);
        return this.bloqueInterno(b, 'DO', n + 1);
      }
      case 'py_for_each':
        L(`for ${nom()} in ${this.v(b, 'ITER', PREC.NADA, '[]')}:`);
        return this.bloqueInterno(b, 'DO', n + 1);
      case 'py_for_items':
        L(`for ${nom('K')}, ${nom('V')} in ${this.v(b, 'DICT', PREC.LLAMADA, '{}')}.items():`);
        return this.bloqueInterno(b, 'DO', n + 1);
      case 'py_break': return L(b.getFieldValue('KW'));
      case 'py_return': {
        const hay = b.getInputTargetBlock('VALUE');
        return L(hay ? 'return ' + this.v(b, 'VALUE') : 'return');
      }
      case 'procedures_callnoreturn': return L(this.llamada(b));
      case 'procedures_ifreturn':
        L(`if ${this.v(b, 'CONDITION', PREC.NADA, 'False')}:`);
        return this.linea(n + 1, b.hasReturnValue_ ? 'return ' + this.v(b, 'VALUE') : 'return', null);

      case 'py_list_append':
      case 'py_stack_push':
      case 'py_queue_enqueue':
        return L(`${nom()}.append(${this.v(b, 'VALUE')})`);
      case 'py_list_insert': return L(`${nom()}.insert(${this.v(b, 'INDEX', PREC.NADA, '0')}, ${this.v(b, 'VALUE')})`);
      case 'py_list_remove': return L(`${nom()}.remove(${this.v(b, 'VALUE')})`);
      case 'py_list_extend': return L(`${nom()}.extend(${this.v(b, 'VALUE', PREC.NADA, '[]')})`);
      case 'py_list_method0': return L(`${nom()}.${b.getFieldValue('M')}()`);
      case 'py_list_pop_stmt': return L(`${nom()}.pop(${this.v(b, 'INDEX', PREC.NADA, '')})`);
      case 'py_stack_pop_stmt': return L(`${nom()}.pop()`);
      case 'py_queue_dequeue_stmt': return L(`${nom()}.popleft()`);
      case 'py_setitem':
      case 'py_dict_set':
        return L(`${nom()}[${this.v(b, 'KEY')}] = ${this.v(b, 'VALUE')}`);
      case 'py_delitem':
      case 'py_dict_del':
        return L(`del ${nom()}[${this.v(b, 'KEY')}]`);
      case 'py_set_add': return L(`${nom()}.add(${this.v(b, 'VALUE')})`);
      case 'py_set_remove': return L(`${nom()}.${b.getFieldValue('M')}(${this.v(b, 'VALUE')})`);
      case 'py_unpack': return L(`${nom('A')}, ${nom('B')} = ${this.v(b, 'VALUE')}`);
    }
    return L(`# bloque no soportado: ${b.type}`);
  }

  expr(b) {
    const nom = (campo = 'VAR') => this.nom(b, campo);
    const binario = (op, p) => {
      const derechaAsoc = op === '**';
      return [`${this.v(b, 'A', p, 'None', derechaAsoc)} ${op} ${this.v(b, 'B', p, 'None', !derechaAsoc)}`, p];
    };
    switch (b.type) {
      case 'py_number': {
        const t = String(b.getFieldValue('NUM'));
        return [t, t.startsWith('-') ? PREC.UNARIO : PREC.ATOMO];
      }
      case 'math_number': { const t = String(b.getFieldValue('NUM')); return [t, t.startsWith('-') ? PREC.UNARIO : PREC.ATOMO]; }
      case 'py_text': return [textoPy(b.getFieldValue('TEXT')), PREC.ATOMO];
      case 'py_bool': return [b.getFieldValue('BOOL'), PREC.ATOMO];
      case 'logic_boolean': return [b.getFieldValue('BOOL') === 'TRUE' ? 'True' : 'False', PREC.ATOMO];
      case 'py_none': return ['None', PREC.ATOMO];
      case 'variables_get': return [nom(), PREC.ATOMO];

      case 'py_arith':
      case 'py_set_op': {
        const op = b.getFieldValue('OP');
        return binario(op, PREC_OP[op]);
      }
      case 'py_compare':
        return [`${this.v(b, 'A', PREC.REL, 'None', true)} ${b.getFieldValue('OP')} ${this.v(b, 'B', PREC.REL, 'None', true)}`, PREC.REL];
      case 'py_logic': {
        const op = b.getFieldValue('OP'), p = op === 'and' ? PREC.AND : PREC.OR;
        return [`${this.v(b, 'A', p, 'False')} ${op} ${this.v(b, 'B', p, 'False', true)}`, p];
      }
      case 'py_not': return [`not ${this.v(b, 'A', PREC.NOT, 'False')}`, PREC.NOT];
      case 'py_in':
        return [`${this.v(b, 'A', PREC.REL, 'None', true)} ${b.getFieldValue('OP')} ${this.v(b, 'B', PREC.REL, '[]', true)}`, PREC.REL];
      case 'py_func1': return [`${b.getFieldValue('FUNC')}(${this.v(b, 'A', PREC.NADA, '')})`, PREC.LLAMADA];
      case 'py_random':
        this.imports.add('random');
        return [`random.randint(${this.v(b, 'A', PREC.NADA, '0')}, ${this.v(b, 'B', PREC.NADA, '0')})`, PREC.LLAMADA];
      case 'py_input': return [`input(${this.v(b, 'PROMPT', PREC.NADA, '')})`, PREC.LLAMADA];

      case 'py_getitem': return [`${this.v(b, 'SEQ', PREC.LLAMADA)}[${this.v(b, 'KEY')}]`, PREC.LLAMADA];
      case 'py_slice': return [`${this.v(b, 'SEQ', PREC.LLAMADA)}[${this.v(b, 'A', PREC.NADA, '')}:${this.v(b, 'B', PREC.NADA, '')}]`, PREC.LLAMADA];

      case 'py_lit_lista':
      case 'py_lit_dic':
      case 'py_lit_tupla':
      case 'py_lit_conj':
        return [String(b.getFieldValue('LIT')).trim(), PREC.ATOMO];

      case 'py_list_empty':
      case 'py_stack_new':
        return ['[]', PREC.ATOMO];
      case 'py_queue_new':
        this.imports.add('deque');
        return ['deque()', PREC.LLAMADA];
      case 'py_dict_empty': return ['{}', PREC.ATOMO];
      case 'py_set_empty': return ['set()', PREC.LLAMADA];

      case 'py_list_pop': return [`${nom()}.pop(${this.v(b, 'INDEX', PREC.NADA, '')})`, PREC.LLAMADA];
      case 'py_stack_pop': return [`${nom()}.pop()`, PREC.LLAMADA];
      case 'py_queue_dequeue': return [`${nom()}.popleft()`, PREC.LLAMADA];
      case 'py_stack_peek':
      case 'py_queue_back':
        return [`${nom()}[-1]`, PREC.LLAMADA];
      case 'py_queue_front': return [`${nom()}[0]`, PREC.LLAMADA];
      case 'py_isempty':
      case 'py_isempty_cola':
        return [`len(${nom()}) == 0`, PREC.REL];
      case 'py_list_query': return [`${nom()}.${b.getFieldValue('M')}(${this.v(b, 'VALUE')})`, PREC.LLAMADA];

      case 'py_dict_get': {
        const def = b.getInputTargetBlock('DEFAULT') ? ', ' + this.v(b, 'DEFAULT') : '';
        return [`${nom()}.get(${this.v(b, 'KEY')}${def})`, PREC.LLAMADA];
      }
      case 'py_dict_view': return [`${nom()}.${b.getFieldValue('M')}()`, PREC.LLAMADA];
      case 'py_dict_pop': return [`${nom()}.pop(${this.v(b, 'KEY')})`, PREC.LLAMADA];
      case 'py_tuple_pack': return [`(${this.v(b, 'A')}, ${this.v(b, 'B')})`, PREC.ATOMO];

      case 'py_str_method': return [`${this.v(b, 'A', PREC.LLAMADA, '""')}.${b.getFieldValue('M')}()`, PREC.LLAMADA];
      case 'py_str_method1': return [`${this.v(b, 'A', PREC.LLAMADA, '""')}.${b.getFieldValue('M')}(${this.v(b, 'B')})`, PREC.LLAMADA];
      case 'py_str_replace':
        return [`${this.v(b, 'A', PREC.LLAMADA, '""')}.replace(${this.v(b, 'B', PREC.NADA, '""')}, ${this.v(b, 'C', PREC.NADA, '""')})`, PREC.LLAMADA];

      case 'procedures_callreturn': return [this.llamada(b), PREC.LLAMADA];
    }
    return [`None  # bloque no soportado: ${b.type}`, PREC.ATOMO];
  }
}

// Coloreado sencillo de sintaxis para el panel de código.
const RE_PY = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(def|return|if|elif|else|while|for|in|not|and|or|break|continue|pass|import|from|del|is)\b|\b(True|False|None)\b|\b(\d+(?:\.\d+)?)\b|\b(print|input|len|range|int|float|str|bool|abs|round|type|sorted|sum|max|min|list|tuple|set|deque|random)\b(?=\s*[(.])/g;

function escaparHTML(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colorearPython(linea) {
  let r = '', ultimo = 0, m;
  RE_PY.lastIndex = 0;
  while ((m = RE_PY.exec(linea))) {
    r += escaparHTML(linea.slice(ultimo, m.index));
    const clase = m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-kw' : m[4] ? 'c-const' : m[5] ? 'c-num' : 'c-fn';
    r += `<span class="${clase}">${escaparHTML(m[0])}</span>`;
    ultimo = m.index + m[0].length;
    if (!m[0].length) RE_PY.lastIndex++;
  }
  return r + escaparHTML(linea.slice(ultimo));
}
