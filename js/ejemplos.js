'use strict';
/*
 * Programas de ejemplo, descritos con pequeñas funciones que arman el JSON de Blockly.
 */

const EJEMPLOS = (() => {
  const conEntradas = obj => {
    const r = {};
    for (const [k, v] of Object.entries(obj)) if (v) r[k] = { block: v };
    return r;
  };
  const b = (type, fields, inputs, extra) => ({
    type,
    ...(fields ? { fields } : {}),
    ...(inputs ? { inputs: conEntradas(inputs) } : {}),
    ...(extra || {}),
  });
  const seq = (...bs) => {
    for (let i = 0; i < bs.length - 1; i++) bs[i].next = { block: bs[i + 1] };
    return bs[0];
  };
  const V = name => ({ name });
  const num = n => b('py_number', { NUM: String(n) });
  const txt = s => b('py_text', { TEXT: s });
  const get = n => b('variables_get', { VAR: V(n) });
  const set = (n, v) => b('variables_set', { VAR: V(n) }, { VALUE: v });
  const print = v => b('py_print', null, { VALUE: v });
  const print2 = (x, y) => b('py_print2', null, { A: x, B: y });
  const op = (o, x, y) => b('py_arith', { OP: o }, { A: x, B: y });
  const cmp = (o, x, y) => b('py_compare', { OP: o }, { A: x, B: y });
  const si = (cond, hacer, sino) => b('controls_if', null, { IF0: cond, DO0: hacer, ELSE: sino }, sino ? { extraState: { hasElse: true } } : null);
  const fn = (f, x) => b('py_func1', { FUNC: f }, { A: x });
  const programa = (...tops) => ({ blocks: { languageVersion: 0, blocks: tops } });
  const en = (x, y, bloque) => Object.assign(bloque, { x, y });

  return [
    {
      id: 'pila-invertir',
      nombre: 'Pila: invertir una palabra',
      crear: () => programa(en(30, 30, seq(
        b('py_comment', { TEXT: 'Una pila saca primero lo último que entró' }),
        set('pila', b('py_stack_new')),
        set('palabra', txt('ROMA')),
        b('py_for_each', { VAR: V('letra') }, {
          ITER: get('palabra'),
          DO: b('py_stack_push', { VAR: V('pila') }, { VALUE: get('letra') }),
        }),
        set('invertida', txt('')),
        b('py_while', null, {
          COND: b('py_not', null, { A: b('py_isempty', { VAR: V('pila') }) }),
          DO: set('invertida', op('+', get('invertida'), b('py_stack_pop', { VAR: V('pila') }))),
        }),
        print2(txt('Al revés:'), get('invertida')),
      ))),
    },
    {
      id: 'pila-parentesis',
      nombre: 'Pila: paréntesis balanceados',
      crear: () => programa(en(30, 30, seq(
        set('expresion', txt('(a+b)*(c-(d))')),
        set('pila', b('py_stack_new')),
        set('correcto', b('py_bool', { BOOL: 'True' })),
        b('py_for_each', { VAR: V('c') }, {
          ITER: get('expresion'),
          DO: b('controls_if', null, {
            IF0: cmp('==', get('c'), txt('(')),
            DO0: b('py_stack_push', { VAR: V('pila') }, { VALUE: get('c') }),
            IF1: cmp('==', get('c'), txt(')')),
            DO1: si(b('py_isempty', { VAR: V('pila') }),
              set('correcto', b('py_bool', { BOOL: 'False' })),
              b('py_stack_pop_stmt', { VAR: V('pila') })),
          }, { extraState: { elseIfCount: 1 } }),
        }),
        si(b('py_not', null, { A: b('py_isempty', { VAR: V('pila') }) }), set('correcto', b('py_bool', { BOOL: 'False' }))),
        print2(txt('¿Balanceada?'), get('correcto')),
      ))),
    },
    {
      id: 'cola-banco',
      nombre: 'Cola: turnos en el banco',
      crear: () => programa(en(30, 30, seq(
        b('py_comment', { TEXT: 'En una cola se atiende primero a quien llegó primero' }),
        set('fila', b('py_queue_new')),
        b('py_for_each', { VAR: V('nombre') }, {
          ITER: b('py_lit_lista', { LIT: '["Ana", "Luis", "Sofía", "Pedro"]' }),
          DO: b('py_queue_enqueue', { VAR: V('fila') }, { VALUE: get('nombre') }),
        }),
        print2(txt('Personas en la fila:'), fn('len', get('fila'))),
        b('py_while', null, {
          COND: cmp('>', fn('len', get('fila')), num(0)),
          DO: seq(
            set('cliente', b('py_queue_dequeue', { VAR: V('fila') })),
            print2(txt('Atendiendo a'), get('cliente')),
          ),
        }),
        print2(txt('¿Fila vacía?'), b('py_isempty_cola', { VAR: V('fila') })),
      ))),
    },
    {
      id: 'lista-basica',
      nombre: 'Lista: agregar, insertar, quitar y ordenar',
      crear: () => programa(en(30, 30, seq(
        set('numeros', b('py_lit_lista', { LIT: '[7, 2, 9, 4]' })),
        b('py_list_append', { VAR: V('numeros') }, { VALUE: num(5) }),
        b('py_list_insert', { VAR: V('numeros') }, { INDEX: num(0), VALUE: num(1) }),
        b('py_list_remove', { VAR: V('numeros') }, { VALUE: num(9) }),
        b('py_setitem', { VAR: V('numeros') }, { KEY: num(2), VALUE: num(10) }),
        b('py_list_method0', { VAR: V('numeros'), M: 'sort' }),
        set('mayor', fn('max', get('numeros'))),
        set('suma', fn('sum', get('numeros'))),
        print2(txt('Lista final:'), get('numeros')),
        print2(txt('Mayor:'), get('mayor')),
        print2(txt('Promedio:'), op('/', get('suma'), fn('len', get('numeros')))),
      ))),
    },
    {
      id: 'dic-contar',
      nombre: 'Diccionario: contar palabras',
      crear: () => programa(en(30, 30, seq(
        set('texto', txt('el sol y el mar y el cielo')),
        set('conteo', b('py_dict_empty')),
        b('py_for_each', { VAR: V('palabra') }, {
          ITER: b('py_str_method', { M: 'split' }, { A: get('texto') }),
          DO: b('py_dict_set', { VAR: V('conteo') }, {
            KEY: get('palabra'),
            VALUE: op('+', b('py_dict_get', { VAR: V('conteo') }, { KEY: get('palabra'), DEFAULT: num(0) }), num(1)),
          }),
        }),
        b('py_for_items', { K: V('clave'), V: V('valor') }, {
          DICT: get('conteo'),
          DO: print2(get('clave'), get('valor')),
        }),
      ))),
    },
    {
      id: 'conjuntos',
      nombre: 'Conjuntos: quitar repetidos y operar',
      crear: () => programa(en(30, 30, seq(
        set('notas', b('py_lit_lista', { LIT: '[7, 8, 7, 10, 8, 9]' })),
        set('unicas', b('py_set_empty')),
        b('py_for_each', { VAR: V('n') }, {
          ITER: get('notas'),
          DO: b('py_set_add', { VAR: V('unicas') }, { VALUE: get('n') }),
        }),
        print2(txt('Sin repetir:'), get('unicas')),
        set('a', b('py_lit_conj', { LIT: '{1, 2, 3, 4}' })),
        set('b', b('py_lit_conj', { LIT: '{3, 4, 5}' })),
        print2(txt('a & b ='), b('py_set_op', { OP: '&' }, { A: get('a'), B: get('b') })),
        print2(txt('a | b ='), b('py_set_op', { OP: '|' }, { A: get('a'), B: get('b') })),
        print2(txt('a - b ='), b('py_set_op', { OP: '-' }, { A: get('a'), B: get('b') })),
      ))),
    },
    {
      id: 'tupla',
      nombre: 'Tupla: coordenadas de un punto',
      crear: () => programa(en(30, 30, seq(
        set('punto', b('py_lit_tupla', { LIT: '(3, 4)' })),
        b('py_unpack', { A: V('x'), B: V('y') }, { VALUE: get('punto') }),
        set('distancia', op('**', op('+', op('**', get('x'), num(2)), op('**', get('y'), num(2))), num('0.5'))),
        print2(txt('Distancia al origen:'), get('distancia')),
        print2(txt('Primera coordenada:'), b('py_getitem', null, { SEQ: get('punto'), KEY: num(0) })),
      ))),
    },
    {
      id: 'factorial',
      nombre: 'Funciones: factorial recursivo',
      crear: () => programa(
        b('procedures_defreturn', { NAME: 'factorial' }, {
          STACK: si(cmp('<=', get('n'), num(1)), b('py_return', null, { VALUE: num(1) })),
          RETURN: op('*', get('n'), b('procedures_callreturn', null, { ARG0: op('-', get('n'), num(1)) }, { extraState: { name: 'factorial', params: ['n'] } })),
        }, { extraState: { params: [{ name: 'n' }] }, x: 30, y: 30 }),
        en(30, 380, seq(
          set('resultado', b('procedures_callreturn', null, { ARG0: num(5) }, { extraState: { name: 'factorial', params: ['n'] } })),
          print2(txt('5! ='), get('resultado')),
        )),
      ),
    },
    {
      id: 'entrada',
      nombre: 'Entrada: pedir datos y decidir',
      crear: () => programa(en(30, 30, seq(
        set('nombre', b('py_input', null, { PROMPT: txt('¿Cómo te llamas? ') })),
        set('edad', fn('int', b('py_input', null, { PROMPT: txt('¿Cuántos años tienes? ') }))),
        si(cmp('>=', get('edad'), num(18)),
          print2(get('nombre'), txt('es mayor de edad')),
          print2(get('nombre'), txt('es menor de edad'))),
        b('py_for_range', { VAR: V('i') }, {
          START: num(1), END: num(4), STEP: num(1),
          DO: print2(txt('Cuenta:'), get('i')),
        }),
      ))),
    },
  ];
})();
