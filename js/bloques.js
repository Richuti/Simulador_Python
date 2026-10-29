'use strict';
/*
 * Bloques del simulador. Cada bloque muestra la sintaxis de Python que genera,
 * para que lo que se arma con bloques se reconozca después en el código exportado.
 */

const COLOR = {
  variables: '#d9822b',
  numeros: '#2f8f83',
  logica: '#5a67d8',
  ciclos: '#3182ce',
  texto: '#a0723c',
  io: '#64748b',
  funciones: '#c05360',
  lista: '#2b6cb0',
  pila: '#d69e2e',
  cola: '#2c9a8f',
  dic: '#805ad5',
  tupla: '#c2477a',
  conj: '#4f8f3a',
};

function definirBloques() {
  Object.assign(Blockly.Msg, {
    CONTROLS_IF_MSG_IF: 'if',
    CONTROLS_IF_MSG_ELSEIF: 'elif',
    CONTROLS_IF_MSG_ELSE: 'else',
    CONTROLS_IF_MSG_THEN: '',
    CONTROLS_IF_IF_TITLE_IF: 'if',
    CONTROLS_IF_ELSEIF_TITLE_ELSEIF: 'elif',
    CONTROLS_IF_ELSE_TITLE_ELSE: 'else',
    PROCEDURES_DEFNORETURN_TITLE: 'def',
    PROCEDURES_DEFRETURN_TITLE: 'def',
    PROCEDURES_DEFNORETURN_PROCEDURE: 'mi_funcion',
    PROCEDURES_DEFRETURN_PROCEDURE: 'calcular',
    PROCEDURES_DEFNORETURN_DO: '',
    PROCEDURES_DEFRETURN_DO: '',
    PROCEDURES_DEFRETURN_RETURN: 'return',
    PROCEDURES_BEFORE_PARAMS: 'parámetros:',
    PROCEDURES_CALL_BEFORE_PARAMS: 'con:',
    PROCEDURES_IFRETURN_TITLE: 'if',
    PROCEDURES_DEFRETURN_COMMENT: '',
    PROCEDURES_DEFNORETURN_COMMENT: '',
    PROCEDURES_MUTATORCONTAINER_TITLE: 'parámetros',
    PROCEDURES_MUTATORARG_TITLE: 'parámetro:',
  });

  const V = (name, variable) => ({ type: 'field_variable', name, variable });
  const IN = name => ({ type: 'input_value', name });
  const ST = name => ({ type: 'input_statement', name });
  const DD = (name, ops) => ({ type: 'field_dropdown', name, options: ops.map(o => (Array.isArray(o) ? o : [o, o])) });
  const TX = (name, text) => ({ type: 'field_input', name, text });
  const NADA = { type: 'input_dummy' };
  const sent = (colour, extra = {}) => ({ previousStatement: null, nextStatement: null, colour, inputsInline: true, ...extra });
  const valor = (colour, extra = {}) => ({ output: null, colour, inputsInline: true, ...extra });
  const B = (type, message0, args0, base, tooltip) => ({ type, message0, args0, ...base, tooltip: tooltip || '' });

  Blockly.Extensions.register('validar_numero', function () {
    this.getField('NUM').setValidator(t => {
      const s = String(t).trim();
      return /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) ? s : null;
    });
  });

  Blockly.defineBlocksWithJsonArray([
    // Variables
    B('variables_set', '%1 = %2', [V('VAR', 'x'), IN('VALUE')], sent(COLOR.variables), 'Guarda un valor en una variable.'),
    B('variables_get', '%1', [V('VAR', 'x')], valor(COLOR.variables), 'El valor guardado en la variable.'),
    B('math_change', '%1 %2 %3', [V('VAR', 'x'), DD('OP', ['+=', '-=', '*=', '/=', '//=', '%=']), IN('DELTA')],
      sent(COLOR.variables), 'Actualiza la variable usando su valor actual. x += 1 equivale a x = x + 1.'),
    B('py_comment', '# %1', [TX('TEXT', 'comentario')], sent('#8a94a6'), 'Comentario: Python lo ignora al ejecutar.'),

    // Números y lógica
    { ...B('py_number', '%1', [TX('NUM', '0')], valor(COLOR.numeros), 'Número. Escribe un punto (2.5) para que sea float.'), extensions: ['validar_numero'] },
    B('py_arith', '%1 %2 %3', [IN('A'), DD('OP', ['+', '-', '*', '/', '//', '%', '**']), IN('B')], valor(COLOR.numeros),
      '/ divide con decimales · // división entera · % residuo · ** potencia'),
    B('py_func1', '%1 ( %2 )', [DD('FUNC', ['len', 'int', 'float', 'str', 'bool', 'abs', 'round', 'type', 'sorted', 'sum', 'max', 'min', 'list', 'tuple', 'set']), IN('A')],
      valor(COLOR.numeros), 'Funciones integradas de Python.'),
    B('py_random', 'random.randint( %1 , %2 )', [IN('A'), IN('B')], valor(COLOR.numeros), 'Entero al azar entre los dos valores (incluidos).'),
    B('py_bool', '%1', [DD('BOOL', ['True', 'False'])], valor(COLOR.logica), 'Valor booleano.'),
    B('py_none', 'None', [], valor(COLOR.logica), 'Ausencia de valor.'),
    B('py_compare', '%1 %2 %3', [IN('A'), DD('OP', ['==', '!=', '<', '<=', '>', '>=']), IN('B')], valor(COLOR.logica), 'Compara dos valores y da True o False.'),
    B('py_logic', '%1 %2 %3', [IN('A'), DD('OP', ['and', 'or']), IN('B')], valor(COLOR.logica), 'and: ambos verdaderos · or: al menos uno.'),
    B('py_not', 'not %1', [IN('A')], valor(COLOR.logica), 'Invierte un valor booleano.'),
    B('py_in', '%1 %2 %3', [IN('A'), DD('OP', ['in', 'not in']), IN('B')], valor(COLOR.logica), '¿El valor está dentro de la lista, texto, diccionario o conjunto?'),

    // Control
    B('py_while', 'while %1 : %2 %3', [IN('COND'), NADA, ST('DO')], sent(COLOR.ciclos), 'Repite mientras la condición sea verdadera.'),
    B('py_for_range', 'for %1 in range( %2 , %3 , %4 ): %5 %6', [V('VAR', 'i'), IN('START'), IN('END'), IN('STEP'), NADA, ST('DO')],
      sent(COLOR.ciclos), 'Cuenta desde el inicio hasta antes del fin, avanzando de a paso.'),
    B('py_for_each', 'for %1 in %2 : %3 %4', [V('VAR', 'elemento'), IN('ITER'), NADA, ST('DO')], sent(COLOR.ciclos),
      'Recorre cada elemento de una lista, texto, tupla, conjunto o las claves de un diccionario.'),
    B('py_break', '%1', [DD('KW', ['break', 'continue'])], { previousStatement: null, colour: COLOR.ciclos },
      'break sale del ciclo · continue salta a la siguiente vuelta.'),
    B('py_pass', 'pass', [], sent(COLOR.ciclos), 'No hace nada; sirve para dejar un bloque vacío.'),

    // Texto y entrada/salida
    B('py_text', '" %1 "', [TX('TEXT', 'hola')], valor(COLOR.texto), 'Texto (str).'),
    B('py_str_method', '%1 . %2 ()', [IN('A'), DD('M', ['upper', 'lower', 'strip', 'title', 'capitalize', 'split', 'isdigit', 'isalpha'])],
      valor(COLOR.texto), 'Métodos de texto.'),
    B('py_str_method1', '%1 . %2 ( %3 )', [IN('A'), DD('M', ['split', 'join', 'count', 'find', 'startswith', 'endswith']), IN('B')],
      valor(COLOR.texto), 'Métodos de texto con un argumento. join une una lista usando el texto como separador.'),
    B('py_str_replace', '%1 .replace( %2 , %3 )', [IN('A'), IN('B'), IN('C')], valor(COLOR.texto), 'Reemplaza un texto por otro.'),
    B('py_getitem', '%1 [ %2 ]', [IN('SEQ'), IN('KEY')], valor(COLOR.texto), 'Acceso por índice (listas, tuplas, texto) o por clave (diccionarios).'),
    B('py_slice', '%1 [ %2 : %3 ]', [IN('SEQ'), IN('A'), IN('B')], valor(COLOR.texto), 'Rebanada: desde el primer índice hasta antes del segundo. Deja un hueco vacío para ir desde el inicio o hasta el final.'),
    B('py_print', 'print( %1 )', [IN('VALUE')], sent(COLOR.io), 'Muestra un valor en la consola.'),
    B('py_print2', 'print( %1 , %2 )', [IN('A'), IN('B')], sent(COLOR.io), 'Muestra dos valores separados por un espacio.'),
    B('py_input', 'input( %1 )', [IN('PROMPT')], valor(COLOR.io), 'Pide un texto al usuario. Usa int( ) para convertirlo a número.'),

    // Funciones
    B('py_return', 'return %1', [IN('VALUE')], { previousStatement: null, colour: COLOR.funciones, inputsInline: true }, 'Termina la función y devuelve un valor.'),

    // Listas
    B('py_list_empty', 'lista vacía  [ ]', [], valor(COLOR.lista), 'Crea una lista vacía.'),
    B('py_lit_lista', '%1', [TX('LIT', '[3, 1, 4]')], valor(COLOR.lista), 'Lista escrita como en Python.'),
    B('py_list_append', '%1 .append( %2 )', [V('VAR', 'lista'), IN('VALUE')], sent(COLOR.lista), 'Agrega al final.'),
    B('py_list_insert', '%1 .insert( %2 , %3 )', [V('VAR', 'lista'), IN('INDEX'), IN('VALUE')], sent(COLOR.lista), 'Inserta en una posición; los demás se recorren.'),
    B('py_list_remove', '%1 .remove( %2 )', [V('VAR', 'lista'), IN('VALUE')], sent(COLOR.lista), 'Quita la primera aparición del valor.'),
    B('py_list_extend', '%1 .extend( %2 )', [V('VAR', 'lista'), IN('VALUE')], sent(COLOR.lista), 'Agrega al final todos los elementos de otra colección.'),
    B('py_list_method0', '%1 . %2 ()', [V('VAR', 'lista'), DD('M', ['sort', 'reverse', 'clear'])], sent(COLOR.lista), 'sort ordena · reverse invierte · clear vacía.'),
    B('py_list_pop', '%1 .pop( %2 )', [V('VAR', 'lista'), IN('INDEX')], valor(COLOR.lista), 'Quita y devuelve el elemento de esa posición (sin índice: el último).'),
    B('py_list_pop_stmt', '%1 .pop( %2 )', [V('VAR', 'lista'), IN('INDEX')], sent(COLOR.lista), 'Quita el elemento de esa posición (sin índice: el último).'),
    B('py_setitem', '%1 [ %2 ] = %3', [V('VAR', 'lista'), IN('KEY'), IN('VALUE')], sent(COLOR.lista), 'Cambia el elemento de esa posición.'),
    B('py_delitem', 'del %1 [ %2 ]', [V('VAR', 'lista'), IN('KEY')], sent(COLOR.lista), 'Elimina el elemento de esa posición.'),
    B('py_list_query', '%1 . %2 ( %3 )', [V('VAR', 'lista'), DD('M', ['index', 'count']), IN('VALUE')], valor(COLOR.lista),
      'index: posición del valor · count: cuántas veces aparece.'),

    // Pilas (LIFO) sobre list
    B('py_stack_new', 'pila vacía  [ ]', [], valor(COLOR.pila), 'Una pila en Python es una lista: se mete y se saca por el mismo extremo (LIFO).'),
    B('py_stack_push', 'apilar  %1 .append( %2 )', [V('VAR', 'pila'), IN('VALUE')], sent(COLOR.pila), 'push: pone el valor en el tope.'),
    B('py_stack_pop', 'desapilar  %1 .pop()', [V('VAR', 'pila')], valor(COLOR.pila), 'pop: quita y devuelve el tope.'),
    B('py_stack_pop_stmt', 'desapilar  %1 .pop()', [V('VAR', 'pila')], sent(COLOR.pila), 'pop: quita el tope.'),
    B('py_stack_peek', 'tope  %1 [-1]', [V('VAR', 'pila')], valor(COLOR.pila), 'peek: mira el tope sin sacarlo.'),
    B('py_isempty', '¿vacía?  len( %1 ) == 0', [V('VAR', 'pila')], valor(COLOR.pila), 'True si no tiene elementos.'),

    // Colas (FIFO) con collections.deque
    B('py_queue_new', 'cola vacía  deque()', [], valor(COLOR.cola), 'Una cola usa deque: entra por el final y sale por el frente (FIFO).'),
    B('py_queue_enqueue', 'encolar  %1 .append( %2 )', [V('VAR', 'cola'), IN('VALUE')], sent(COLOR.cola), 'enqueue: entra por el final.'),
    B('py_queue_dequeue', 'desencolar  %1 .popleft()', [V('VAR', 'cola')], valor(COLOR.cola), 'dequeue: quita y devuelve el frente.'),
    B('py_queue_dequeue_stmt', 'desencolar  %1 .popleft()', [V('VAR', 'cola')], sent(COLOR.cola), 'dequeue: quita el frente.'),
    B('py_queue_front', 'frente  %1 [0]', [V('VAR', 'cola')], valor(COLOR.cola), 'Mira el frente sin sacarlo.'),
    B('py_queue_back', 'final  %1 [-1]', [V('VAR', 'cola')], valor(COLOR.cola), 'Mira el último en llegar.'),
    B('py_isempty_cola', '¿vacía?  len( %1 ) == 0', [V('VAR', 'cola')], valor(COLOR.cola), 'True si no tiene elementos.'),

    // Diccionarios
    B('py_dict_empty', 'diccionario vacío  { }', [], valor(COLOR.dic), 'Crea un diccionario vacío.'),
    B('py_lit_dic', '%1', [TX('LIT', '{"ana": 9, "luis": 7}')], valor(COLOR.dic), 'Diccionario escrito como en Python: {clave: valor}.'),
    B('py_dict_set', '%1 [ %2 ] = %3', [V('VAR', 'dic'), IN('KEY'), IN('VALUE')], sent(COLOR.dic), 'Agrega la clave o cambia su valor.'),
    B('py_dict_get', '%1 .get( %2 , %3 )', [V('VAR', 'dic'), IN('KEY'), IN('DEFAULT')], valor(COLOR.dic), 'Valor de la clave; si no existe, el segundo valor (o None).'),
    B('py_dict_view', '%1 . %2 ()', [V('VAR', 'dic'), DD('M', ['keys', 'values', 'items'])], valor(COLOR.dic), 'Claves, valores o pares (clave, valor).'),
    B('py_dict_pop', '%1 .pop( %2 )', [V('VAR', 'dic'), IN('KEY')], valor(COLOR.dic), 'Quita la clave y devuelve su valor.'),
    B('py_dict_del', 'del %1 [ %2 ]', [V('VAR', 'dic'), IN('KEY')], sent(COLOR.dic), 'Elimina la clave.'),
    B('py_for_items', 'for %1 , %2 in %3 .items(): %4 %5', [V('K', 'clave'), V('V', 'valor'), IN('DICT'), NADA, ST('DO')],
      sent(COLOR.dic), 'Recorre cada par clave, valor del diccionario.'),

    // Tuplas
    B('py_lit_tupla', '%1', [TX('LIT', '(10, 20)')], valor(COLOR.tupla), 'Tupla escrita como en Python. No se puede modificar.'),
    B('py_tuple_pack', '( %1 , %2 )', [IN('A'), IN('B')], valor(COLOR.tupla), 'Arma una tupla de dos valores.'),
    B('py_unpack', '%1 , %2 = %3', [V('A', 'a'), V('B', 'b'), IN('VALUE')], sent(COLOR.tupla), 'Desempaqueta: guarda cada parte en una variable.'),

    // Conjuntos
    B('py_set_empty', 'conjunto vacío  set()', [], valor(COLOR.conj), 'Crea un conjunto vacío. Ojo: { } es un diccionario.'),
    B('py_lit_conj', '%1', [TX('LIT', '{1, 2, 3}')], valor(COLOR.conj), 'Conjunto escrito como en Python. No guarda repetidos.'),
    B('py_set_add', '%1 .add( %2 )', [V('VAR', 'conjunto'), IN('VALUE')], sent(COLOR.conj), 'Agrega el valor si no estaba.'),
    B('py_set_remove', '%1 . %2 ( %3 )', [V('VAR', 'conjunto'), DD('M', ['discard', 'remove']), IN('VALUE')], sent(COLOR.conj),
      'discard quita si existe · remove da error si no existe.'),
    B('py_set_op', '%1 %2 %3', [IN('A'), DD('OP', [['| unión', '|'], ['& intersección', '&'], ['- diferencia', '-'], ['^ dif. simétrica', '^']]), IN('B')],
      valor(COLOR.conj), 'Operaciones entre conjuntos.'),
  ]);
}

// Atajos para describir bloques de la caja de herramientas.
const TB = {
  b: (type, inputs, fields) => ({ kind: 'block', type, ...(inputs ? { inputs } : {}), ...(fields ? { fields } : {}) }),
  num: n => ({ shadow: { type: 'py_number', fields: { NUM: String(n) } } }),
  txt: s => ({ shadow: { type: 'py_text', fields: { TEXT: s } } }),
  get: name => ({ block: { type: 'variables_get', fields: { VAR: { name } } } }),
  v: name => ({ VAR: { name } }),
  sep: () => ({ kind: 'sep', gap: 28 }),
  label: text => ({ kind: 'label', text }),
};

function crearToolbox() {
  const { b, num, txt, get, v, label } = TB;
  const cat = (name, colour, contents) => ({ kind: 'category', name, colour, contents });
  return {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: 'Variables', colour: COLOR.variables, custom: 'PY_VARIABLES' },
      cat('Números', COLOR.numeros, [
        b('py_number'),
        b('py_arith', { A: num(1), B: num(2) }),
        b('py_func1', { A: num(-3) }, { FUNC: 'abs' }),
        b('py_func1', { A: txt('42') }, { FUNC: 'int' }),
        b('py_random', { A: num(1), B: num(6) }),
      ]),
      cat('Lógica', COLOR.logica, [
        b('controls_if'),
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'controls_if', extraState: { elseIfCount: 1, hasElse: true } },
        b('py_compare', { A: num(1), B: num(2) }),
        b('py_logic'),
        b('py_not'),
        b('py_in'),
        b('py_bool'),
        b('py_none'),
      ]),
      cat('Ciclos', COLOR.ciclos, [
        b('py_for_range', { START: num(0), END: num(5), STEP: num(1) }),
        b('py_for_each'),
        b('py_while', { COND: { shadow: { type: 'py_bool', fields: { BOOL: 'True' } } } }),
        b('py_break'),
        b('py_pass'),
      ]),
      cat('Texto', COLOR.texto, [
        b('py_text'),
        b('py_arith', { A: txt('hola '), B: txt('mundo') }),
        b('py_str_method', { A: txt('Hola') }),
        b('py_str_method1', { A: txt('a,b,c'), B: txt(',') }),
        b('py_str_replace', { A: txt('hola'), B: txt('o'), C: txt('0') }),
        b('py_getitem', { SEQ: txt('python'), KEY: num(0) }),
        b('py_slice', { SEQ: txt('python'), A: num(0), B: num(3) }),
        b('py_func1', { A: txt('hola') }, { FUNC: 'len' }),
        b('py_func1', { A: num(7) }, { FUNC: 'str' }),
      ]),
      cat('Entrada / Salida', COLOR.io, [
        b('py_print', { VALUE: txt('Hola, mundo') }),
        b('py_print2', { A: txt('Resultado:'), B: num(0) }),
        b('py_input', { PROMPT: txt('¿Tu nombre? ') }),
        b('py_func1', { A: { block: { type: 'py_input', inputs: { PROMPT: txt('Un número: ') } } } }, { FUNC: 'int' }),
        b('py_comment'),
      ]),
      { kind: 'sep' },
      cat('Listas', COLOR.lista, [
        label('Crear'),
        b('py_list_empty'),
        b('py_lit_lista'),
        label('Modificar'),
        b('py_list_append', { VALUE: num(5) }, v('lista')),
        b('py_list_insert', { INDEX: num(0), VALUE: num(9) }, v('lista')),
        b('py_setitem', { KEY: num(0), VALUE: num(7) }, v('lista')),
        b('py_list_remove', { VALUE: num(5) }, v('lista')),
        b('py_list_pop_stmt', null, v('lista')),
        b('py_delitem', { KEY: num(0) }, v('lista')),
        b('py_list_extend', { VALUE: { shadow: { type: 'py_lit_lista', fields: { LIT: '[8, 9]' } } } }, v('lista')),
        b('py_list_method0', null, v('lista')),
        label('Consultar'),
        b('py_getitem', { SEQ: get('lista'), KEY: num(0) }),
        b('py_slice', { SEQ: get('lista'), A: num(0), B: num(2) }),
        b('py_list_pop', null, v('lista')),
        b('py_func1', { A: get('lista') }, { FUNC: 'len' }),
        b('py_list_query', { VALUE: num(5) }, v('lista')),
        b('py_in', { A: num(5), B: get('lista') }),
      ]),
      cat('Pilas', COLOR.pila, [
        label('Pila: el último en entrar es el primero en salir (LIFO)'),
        b('variables_set', { VALUE: { block: { type: 'py_stack_new' } } }, { VAR: { name: 'pila' } }),
        b('py_stack_new'),
        b('py_stack_push', { VALUE: num(1) }, v('pila')),
        b('py_stack_pop_stmt', null, v('pila')),
        b('py_stack_pop', null, v('pila')),
        b('py_stack_peek', null, v('pila')),
        b('py_isempty', null, v('pila')),
        b('py_func1', { A: get('pila') }, { FUNC: 'len' }),
      ]),
      cat('Colas', COLOR.cola, [
        label('Cola: el primero en entrar es el primero en salir (FIFO)'),
        b('variables_set', { VALUE: { block: { type: 'py_queue_new' } } }, { VAR: { name: 'cola' } }),
        b('py_queue_new'),
        b('py_queue_enqueue', { VALUE: txt('Ana') }, v('cola')),
        b('py_queue_dequeue_stmt', null, v('cola')),
        b('py_queue_dequeue', null, v('cola')),
        b('py_queue_front', null, v('cola')),
        b('py_queue_back', null, v('cola')),
        b('py_isempty_cola', null, v('cola')),
        b('py_func1', { A: get('cola') }, { FUNC: 'len' }),
      ]),
      cat('Diccionarios', COLOR.dic, [
        label('Crear'),
        b('variables_set', { VALUE: { block: { type: 'py_dict_empty' } } }, { VAR: { name: 'dic' } }),
        b('py_dict_empty'),
        b('py_lit_dic'),
        label('Modificar'),
        b('py_dict_set', { KEY: txt('ana'), VALUE: num(10) }, v('dic')),
        b('py_dict_del', { KEY: txt('ana') }, v('dic')),
        label('Consultar'),
        b('py_getitem', { SEQ: get('dic'), KEY: txt('ana') }),
        b('py_dict_get', { KEY: txt('ana'), DEFAULT: num(0) }, v('dic')),
        b('py_dict_pop', { KEY: txt('ana') }, v('dic')),
        b('py_dict_view', null, v('dic')),
        b('py_in', { A: txt('ana'), B: get('dic') }),
        b('py_for_items', { DICT: get('dic') }),
      ]),
      cat('Tuplas', COLOR.tupla, [
        label('Tupla: como una lista, pero no se puede modificar'),
        b('py_lit_tupla'),
        b('py_tuple_pack', { A: num(3), B: num(4) }),
        b('py_unpack', { VALUE: { shadow: { type: 'py_lit_tupla', fields: { LIT: '(3, 4)' } } } }),
        b('py_getitem', { SEQ: get('tupla'), KEY: num(0) }),
        b('py_func1', { A: get('tupla') }, { FUNC: 'len' }),
      ]),
      cat('Conjuntos', COLOR.conj, [
        label('Conjunto: sin orden y sin repetidos'),
        b('variables_set', { VALUE: { block: { type: 'py_set_empty' } } }, { VAR: { name: 'conjunto' } }),
        b('py_set_empty'),
        b('py_lit_conj'),
        b('py_set_add', { VALUE: num(1) }, v('conjunto')),
        b('py_set_remove', { VALUE: num(1) }, v('conjunto')),
        b('py_set_op', { A: get('a'), B: get('b') }),
        b('py_in', { A: num(1), B: get('conjunto') }),
        b('py_func1', { A: { shadow: { type: 'py_lit_lista', fields: { LIT: '[1, 1, 2]' } } } }, { FUNC: 'set' }),
      ]),
      { kind: 'sep' },
      { kind: 'category', name: 'Funciones', colour: COLOR.funciones, custom: 'PY_FUNCIONES' },
    ],
  };
}

function registrarCategorias(ws) {
  ws.registerButtonCallback('CREAR_VARIABLE', boton => {
    Blockly.Variables.createVariableButtonHandler(boton.getTargetWorkspace(), null, '');
  });

  ws.registerToolboxCategoryCallback('PY_VARIABLES', area => {
    const items = [{ kind: 'button', text: 'Crear variable…', callbackkey: 'CREAR_VARIABLE' }];
    const vars = area.getVariablesOfType('').slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const primera = vars[0] ? vars[0].name : 'x';
    items.push(TB.b('variables_set', { VALUE: TB.num(0) }, { VAR: { name: primera } }));
    items.push(TB.b('math_change', { DELTA: TB.num(1) }, { VAR: { name: primera } }));
    if (vars.length) items.push(TB.label('Tus variables'));
    for (const v of vars) items.push(TB.b('variables_get', null, { VAR: { name: v.name } }));
    return items;
  });

  ws.registerToolboxCategoryCallback('PY_FUNCIONES', area => {
    const items = [
      TB.label('Define la función y luego llámala'),
      { kind: 'block', type: 'procedures_defnoreturn', fields: { NAME: 'saludar' } },
      { kind: 'block', type: 'procedures_defreturn', fields: { NAME: 'calcular' } },
      TB.b('py_return', { VALUE: TB.num(0) }),
    ];
    const [sinRetorno, conRetorno] = Blockly.Procedures.allProcedures(area);
    if (sinRetorno.length || conRetorno.length) items.push(TB.label('Llamar'));
    for (const [nombre, params] of sinRetorno) {
      items.push({ kind: 'block', type: 'procedures_callnoreturn', extraState: { name: nombre, params } });
    }
    for (const [nombre, params] of conRetorno) {
      items.push({ kind: 'block', type: 'procedures_callreturn', extraState: { name: nombre, params } });
    }
    return items;
  });
}
