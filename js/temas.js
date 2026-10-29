'use strict';
/*
 * Temas del simulador. Cada tema define qué bloques se muestran y trae ejemplos
 * que se cargan con un toque. Los ejemplos se describen con pequeñas funciones
 * que arman el JSON de Blockly.
 */

const TEMAS = (() => {
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
  const verdad = x => b('py_bool', { BOOL: x ? 'True' : 'False' });
  const get = n => b('variables_get', { VAR: V(n) });
  const set = (n, v) => b('variables_set', { VAR: V(n) }, { VALUE: v });
  const sumar = (n, op, v) => b('math_change', { VAR: V(n), OP: op }, { DELTA: v });
  const nota = t => b('py_comment', { TEXT: t });
  const print = v => b('py_print', null, { VALUE: v });
  const print2 = (x, y) => b('py_print2', null, { A: x, B: y });
  const op = (o, x, y) => b('py_arith', { OP: o }, { A: x, B: y });
  const cmp = (o, x, y) => b('py_compare', { OP: o }, { A: x, B: y });
  const si = (cond, hacer, sino) => b('controls_if', null, { IF0: cond, DO0: hacer, ELSE: sino }, sino ? { extraState: { hasElse: true } } : null);
  const fn = (f, x) => b('py_func1', { FUNC: f }, { A: x });
  const cadaUno = (variable, iterable, cuerpo) => b('py_for_each', { VAR: V(variable) }, { ITER: iterable, DO: cuerpo });
  const mientras = (cond, cuerpo) => b('py_while', null, { COND: cond, DO: cuerpo });
  const rango = (variable, ini, fin, cuerpo) => b('py_for_range', { VAR: V(variable) }, { START: num(ini), END: num(fin), STEP: num(1), DO: cuerpo });
  const lit = (tipo, texto) => b('py_lit_' + tipo, { LIT: texto });
  const indice = (seqb, k) => b('py_getitem', null, { SEQ: seqb, KEY: k });
  const programa = (...tops) => ({ blocks: { languageVersion: 0, blocks: tops } });
  const solo = bloque => programa(Object.assign(bloque, { x: 30, y: 30 }));

  // Estructuras
  const apilar = (p, v) => b('py_stack_push', { VAR: V(p) }, { VALUE: v });
  const desapilar = p => b('py_stack_pop', { VAR: V(p) });
  const vacia = p => b('py_isempty', { VAR: V(p) });
  const encolar = (c, v) => b('py_queue_enqueue', { VAR: V(c) }, { VALUE: v });
  const desencolar = c => b('py_queue_dequeue', { VAR: V(c) });
  const llamada = (tipo, nombre, params, args) => b(tipo, null,
    Object.fromEntries(args.map((a, i) => ['ARG' + i, a])), { extraState: { name: nombre, params } });
  const definir = (tipo, nombre, params, entradas, y) => b(tipo, { NAME: nombre }, entradas,
    { extraState: { params: params.map(name => ({ name })) }, x: 30, y });

  const BASE = ['variables', 'valores', 'mostrar', 'decisiones', 'ciclos'];

  return [
    {
      id: 'basico',
      nombre: 'Primeros pasos',
      color: 'var(--acento)',
      codigo: 'x = 5',
      frase: 'Variables, print, decisiones con if y ciclos for y while.',
      categorias: [...BASE, 'texto'],
      ejemplos: [
        {
          nombre: 'Hola y variables',
          crear: () => solo(seq(
            nota('Una variable es una caja con nombre que guarda un valor'),
            set('nombre', txt('Ana')),
            set('edad', num(15)),
            print2(txt('Hola'), get('nombre')),
            sumar('edad', '+=', num(1)),
            print2(txt('El próximo año tendrás'), get('edad')),
          )),
        },
        {
          nombre: 'Contar del 1 al 5',
          crear: () => solo(seq(
            nota('range(1, 6) cuenta desde 1 hasta antes de 6'),
            rango('i', 1, 6, print(get('i'))),
          )),
        },
        {
          nombre: 'Cuenta regresiva',
          crear: () => solo(seq(
            set('n', num(5)),
            mientras(cmp('>', get('n'), num(0)), seq(print(get('n')), sumar('n', '-=', num(1)))),
            print(txt('¡Despegue!')),
          )),
        },
        {
          nombre: '¿Par o impar?',
          crear: () => solo(seq(
            set('numero', num(7)),
            si(cmp('==', op('%', get('numero'), num(2)), num(0)),
              print2(get('numero'), txt('es par')),
              print2(get('numero'), txt('es impar'))),
          )),
        },
        {
          nombre: 'Preguntar la edad',
          crear: () => solo(seq(
            set('nombre', b('py_input', null, { PROMPT: txt('¿Cómo te llamas? ') })),
            set('edad', fn('int', b('py_input', null, { PROMPT: txt('¿Cuántos años tienes? ') }))),
            si(cmp('>=', get('edad'), num(18)),
              print2(get('nombre'), txt('es mayor de edad')),
              print2(get('nombre'), txt('es menor de edad'))),
          )),
        },
      ],
    },
    {
      id: 'pilas',
      nombre: 'Pilas',
      color: 'var(--pila)',
      codigo: 'pila.append(x)',
      frase: 'Como una pila de platos: el último que pones es el primero que sacas (LIFO).',
      categorias: ['pilas', ...BASE],
      ejemplos: [
        {
          nombre: 'Apilar y desapilar',
          crear: () => solo(seq(
            set('pila', b('py_stack_new')),
            apilar('pila', num(10)),
            apilar('pila', num(20)),
            apilar('pila', num(30)),
            print2(txt('Tope:'), b('py_stack_peek', { VAR: V('pila') })),
            set('sacado', desapilar('pila')),
            print2(txt('Saqué:'), get('sacado')),
            print2(txt('Quedó:'), get('pila')),
          )),
        },
        {
          nombre: 'Invertir una palabra',
          crear: () => solo(seq(
            set('pila', b('py_stack_new')),
            set('palabra', txt('ROMA')),
            cadaUno('letra', get('palabra'), apilar('pila', get('letra'))),
            set('invertida', txt('')),
            mientras(b('py_not', null, { A: vacia('pila') }),
              set('invertida', op('+', get('invertida'), desapilar('pila')))),
            print2(txt('Al revés:'), get('invertida')),
          )),
        },
        {
          nombre: 'Deshacer (Ctrl+Z)',
          crear: () => solo(seq(
            nota('Los editores guardan cada acción en una pila para poder deshacer'),
            set('acciones', b('py_stack_new')),
            cadaUno('palabra', lit('lista', '["Hola", "mundo", "feliz"]'), seq(
              apilar('acciones', get('palabra')),
              print2(txt('Escribiste:'), get('palabra')),
            )),
            print2(txt('Deshacer:'), desapilar('acciones')),
            print2(txt('Deshacer:'), desapilar('acciones')),
            print2(txt('Queda:'), get('acciones')),
          )),
        },
        {
          nombre: 'Paréntesis balanceados',
          crear: () => solo(seq(
            set('expresion', txt('(a+b)*(c-(d))')),
            set('pila', b('py_stack_new')),
            set('correcto', verdad(true)),
            cadaUno('c', get('expresion'), b('controls_if', null, {
              IF0: cmp('==', get('c'), txt('(')),
              DO0: apilar('pila', get('c')),
              IF1: cmp('==', get('c'), txt(')')),
              DO1: si(vacia('pila'), set('correcto', verdad(false)), b('py_stack_pop_stmt', { VAR: V('pila') })),
            }, { extraState: { elseIfCount: 1 } })),
            si(b('py_not', null, { A: vacia('pila') }), set('correcto', verdad(false))),
            print2(txt('¿Balanceada?'), get('correcto')),
          )),
        },
      ],
    },
    {
      id: 'colas',
      nombre: 'Colas',
      color: 'var(--cola)',
      codigo: 'cola.popleft()',
      frase: 'Como la fila del banco: el primero que llega es el primero que atienden (FIFO).',
      categorias: ['colas', ...BASE],
      ejemplos: [
        {
          nombre: 'Encolar y desencolar',
          crear: () => solo(seq(
            set('cola', b('py_queue_new')),
            encolar('cola', txt('Ana')),
            encolar('cola', txt('Luis')),
            encolar('cola', txt('Sofía')),
            print2(txt('Frente:'), b('py_queue_front', { VAR: V('cola') })),
            set('atendido', desencolar('cola')),
            print2(txt('Atendido:'), get('atendido')),
            print2(txt('Siguen:'), get('cola')),
          )),
        },
        {
          nombre: 'Turnos en el banco',
          crear: () => solo(seq(
            set('fila', b('py_queue_new')),
            cadaUno('nombre', lit('lista', '["Ana", "Luis", "Sofía", "Pedro"]'), encolar('fila', get('nombre'))),
            print2(txt('Personas en la fila:'), fn('len', get('fila'))),
            mientras(cmp('>', fn('len', get('fila')), num(0)), seq(
              set('cliente', desencolar('fila')),
              print2(txt('Atendiendo a'), get('cliente')),
            )),
            print(txt('No queda nadie en la fila')),
          )),
        },
        {
          nombre: 'Papa caliente',
          crear: () => solo(seq(
            nota('La papa pasa 3 veces; quien la tiene al final sale del juego'),
            set('ninos', b('py_queue_new')),
            cadaUno('nombre', lit('lista', '["Ana", "Luis", "Sofía", "Pedro"]'), encolar('ninos', get('nombre'))),
            mientras(cmp('>', fn('len', get('ninos')), num(1)), seq(
              rango('i', 0, 3, encolar('ninos', desencolar('ninos'))),
              print2(txt('Sale:'), desencolar('ninos')),
            )),
            print2(txt('Gana:'), b('py_queue_front', { VAR: V('ninos') })),
          )),
        },
      ],
    },
    {
      id: 'listas',
      nombre: 'Listas',
      color: 'var(--lista)',
      codigo: 'lista[0]',
      frase: 'Una fila de casilleros numerados desde 0. Se puede agregar, quitar y cambiar.',
      categorias: ['listas', ...BASE],
      ejemplos: [
        {
          nombre: 'Agregar, insertar y quitar',
          crear: () => solo(seq(
            set('frutas', lit('lista', '["manzana", "pera"]')),
            b('py_list_append', { VAR: V('frutas') }, { VALUE: txt('uva') }),
            b('py_list_insert', { VAR: V('frutas') }, { INDEX: num(0), VALUE: txt('kiwi') }),
            b('py_list_remove', { VAR: V('frutas') }, { VALUE: txt('pera') }),
            b('py_setitem', { VAR: V('frutas') }, { KEY: num(1), VALUE: txt('mango') }),
            print2(txt('Frutas:'), get('frutas')),
            print2(txt('La primera es'), indice(get('frutas'), num(0))),
          )),
        },
        {
          nombre: 'Sumar y promediar',
          crear: () => solo(seq(
            set('notas', lit('lista', '[8, 6, 9, 7]')),
            set('suma', num(0)),
            cadaUno('n', get('notas'), sumar('suma', '+=', get('n'))),
            print2(txt('Suma:'), get('suma')),
            print2(txt('Promedio:'), op('/', get('suma'), fn('len', get('notas')))),
          )),
        },
        {
          nombre: 'Buscar el mayor',
          crear: () => solo(seq(
            set('numeros', lit('lista', '[4, 9, 2, 7]')),
            set('mayor', indice(get('numeros'), num(0))),
            cadaUno('n', get('numeros'), si(cmp('>', get('n'), get('mayor')), set('mayor', get('n')))),
            print2(txt('El mayor es'), get('mayor')),
          )),
        },
        {
          nombre: 'Ordenar números',
          crear: () => solo(seq(
            set('numeros', lit('lista', '[7, 2, 9, 4, 1]')),
            print2(txt('Antes:'), get('numeros')),
            b('py_list_method0', { VAR: V('numeros'), M: 'sort' }),
            print2(txt('Ordenada:'), get('numeros')),
            b('py_list_method0', { VAR: V('numeros'), M: 'reverse' }),
            print2(txt('Al revés:'), get('numeros')),
          )),
        },
      ],
    },
    {
      id: 'diccionarios',
      nombre: 'Diccionarios',
      color: 'var(--dic)',
      codigo: 'dic["clave"]',
      frase: 'Como una agenda: buscas por una clave (el nombre) y obtienes su valor (el teléfono).',
      categorias: ['diccionarios', ...BASE],
      ejemplos: [
        {
          nombre: 'Agenda de teléfonos',
          crear: () => solo(seq(
            set('agenda', b('py_dict_empty')),
            b('py_dict_set', { VAR: V('agenda') }, { KEY: txt('Ana'), VALUE: txt('555-1234') }),
            b('py_dict_set', { VAR: V('agenda') }, { KEY: txt('Luis'), VALUE: txt('555-9876') }),
            print2(txt('Teléfono de Ana:'), indice(get('agenda'), txt('Ana'))),
            b('py_dict_set', { VAR: V('agenda') }, { KEY: txt('Ana'), VALUE: txt('555-0000') }),
            b('py_dict_del', { VAR: V('agenda') }, { KEY: txt('Luis') }),
            print2(txt('Agenda:'), get('agenda')),
          )),
        },
        {
          nombre: 'Calificaciones',
          crear: () => solo(seq(
            set('notas', lit('dic', '{"Ana": 9, "Luis": 5, "Sofía": 10}')),
            b('py_for_items', { K: V('nombre'), V: V('nota') }, {
              DICT: get('notas'),
              DO: si(cmp('>=', get('nota'), num(6)),
                print2(get('nombre'), txt('aprobó')),
                print2(get('nombre'), txt('debe repasar'))),
            }),
            print2(txt('¿Está Pedro?'), b('py_in', { OP: 'in' }, { A: txt('Pedro'), B: get('notas') })),
          )),
        },
        {
          nombre: 'Contar palabras',
          crear: () => solo(seq(
            set('texto', txt('el sol y el mar y el cielo')),
            set('conteo', b('py_dict_empty')),
            cadaUno('palabra', b('py_str_method', { M: 'split' }, { A: get('texto') }),
              b('py_dict_set', { VAR: V('conteo') }, {
                KEY: get('palabra'),
                VALUE: op('+', b('py_dict_get', { VAR: V('conteo') }, { KEY: get('palabra'), DEFAULT: num(0) }), num(1)),
              })),
            b('py_for_items', { K: V('clave'), V: V('valor') }, { DICT: get('conteo'), DO: print2(get('clave'), get('valor')) }),
          )),
        },
      ],
    },
    {
      id: 'tuplas',
      nombre: 'Tuplas',
      color: 'var(--tupla)',
      codigo: '(3, 4)',
      frase: 'Como una lista que no se puede cambiar: ideal para datos fijos como una fecha.',
      categorias: ['tuplas', ...BASE],
      ejemplos: [
        {
          nombre: 'Coordenadas de un punto',
          crear: () => solo(seq(
            set('punto', lit('tupla', '(3, 4)')),
            b('py_unpack', { A: V('x'), B: V('y') }, { VALUE: get('punto') }),
            print2(txt('x vale'), get('x')),
            print2(txt('y vale'), get('y')),
            set('distancia', op('**', op('+', op('*', get('x'), get('x')), op('*', get('y'), get('y'))), num('0.5'))),
            print2(txt('Distancia al origen:'), get('distancia')),
          )),
        },
        {
          nombre: 'Intercambiar valores',
          crear: () => solo(seq(
            set('a', num(1)),
            set('b', num(2)),
            b('py_unpack', { A: V('a'), B: V('b') }, { VALUE: b('py_tuple_pack', null, { A: get('b'), B: get('a') }) }),
            print2(txt('a ='), get('a')),
            print2(txt('b ='), get('b')),
          )),
        },
        {
          nombre: 'Una tupla no se cambia',
          crear: () => solo(seq(
            set('fecha', lit('tupla', '(29, 10, 2026)')),
            print2(txt('Día:'), indice(get('fecha'), num(0))),
            print2(txt('Año:'), indice(get('fecha'), num(2))),
            nota('La siguiente línea da error a propósito'),
            b('py_setitem', { VAR: V('fecha') }, { KEY: num(0), VALUE: num(30) }),
          )),
        },
      ],
    },
    {
      id: 'conjuntos',
      nombre: 'Conjuntos',
      color: 'var(--conj)',
      codigo: '{1, 2, 3}',
      frase: 'Como una bolsa sin orden donde nada se repite.',
      categorias: ['conjuntos', ...BASE],
      ejemplos: [
        {
          nombre: 'Quitar repetidos',
          crear: () => solo(seq(
            set('notas', lit('lista', '[7, 8, 7, 10, 8, 9]')),
            set('unicas', b('py_set_empty')),
            cadaUno('n', get('notas'), b('py_set_add', { VAR: V('unicas') }, { VALUE: get('n') })),
            print2(txt('Sin repetir:'), get('unicas')),
          )),
        },
        {
          nombre: 'Alumnos en dos talleres',
          crear: () => solo(seq(
            set('futbol', lit('conj', '{"Ana", "Luis", "Pedro"}')),
            set('musica', lit('conj', '{"Luis", "Sofía"}')),
            print2(txt('En los dos:'), b('py_set_op', { OP: '&' }, { A: get('futbol'), B: get('musica') })),
            print2(txt('En alguno:'), b('py_set_op', { OP: '|' }, { A: get('futbol'), B: get('musica') })),
            print2(txt('Solo fútbol:'), b('py_set_op', { OP: '-' }, { A: get('futbol'), B: get('musica') })),
          )),
        },
        {
          nombre: 'Agregar y quitar',
          crear: () => solo(seq(
            set('colores', b('py_set_empty')),
            b('py_set_add', { VAR: V('colores') }, { VALUE: txt('rojo') }),
            b('py_set_add', { VAR: V('colores') }, { VALUE: txt('azul') }),
            b('py_set_add', { VAR: V('colores') }, { VALUE: txt('rojo') }),
            print2(txt('Colores:'), get('colores')),
            b('py_set_remove', { VAR: V('colores'), M: 'discard' }, { VALUE: txt('azul') }),
            print2(txt('¿Hay azul?'), b('py_in', { OP: 'in' }, { A: txt('azul'), B: get('colores') })),
          )),
        },
      ],
    },
    {
      id: 'funciones',
      nombre: 'Funciones',
      color: 'var(--funcion)',
      codigo: 'def f(x):',
      frase: 'Un bloque de código con nombre que puedes usar muchas veces.',
      categorias: ['funciones', ...BASE],
      ejemplos: [
        {
          nombre: 'Saludar',
          crear: () => programa(
            definir('procedures_defnoreturn', 'saludar', ['nombre'], { STACK: print2(txt('Hola'), get('nombre')) }, 30),
            Object.assign(seq(
              llamada('procedures_callnoreturn', 'saludar', ['nombre'], [txt('Ana')]),
              llamada('procedures_callnoreturn', 'saludar', ['nombre'], [txt('Luis')]),
            ), { x: 30, y: 170 }),
          ),
        },
        {
          nombre: 'Sumar con return',
          crear: () => programa(
            definir('procedures_defreturn', 'sumar', ['a', 'b'], { RETURN: op('+', get('a'), get('b')) }, 30),
            Object.assign(seq(
              set('resultado', llamada('procedures_callreturn', 'sumar', ['a', 'b'], [num(3), num(4)])),
              print2(txt('3 + 4 ='), get('resultado')),
            ), { x: 30, y: 200 }),
          ),
        },
        {
          nombre: 'Factorial recursivo',
          crear: () => programa(
            definir('procedures_defreturn', 'factorial', ['n'], {
              STACK: si(cmp('<=', get('n'), num(1)), b('py_return', null, { VALUE: num(1) })),
              RETURN: op('*', get('n'), llamada('procedures_callreturn', 'factorial', ['n'], [op('-', get('n'), num(1))])),
            }, 30),
            Object.assign(seq(
              set('resultado', llamada('procedures_callreturn', 'factorial', ['n'], [num(5)])),
              print2(txt('5! ='), get('resultado')),
            ), { x: 30, y: 380 }),
          ),
        },
      ],
    },
    {
      id: 'libre',
      nombre: 'Modo libre',
      color: 'var(--suave)',
      codigo: 'todo',
      frase: 'Todos los bloques juntos para armar lo que quieras.',
      categorias: ['variables', 'valores', 'mostrar', 'decisiones', 'ciclos', 'texto', 'listas', 'pilas', 'colas', 'diccionarios', 'tuplas', 'conjuntos', 'funciones'],
      ejemplos: [],
    },
  ];
})();
