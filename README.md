# Simulador de Estructuras de Datos en Python

Simulador para la clase de **Programación Estructurada**: los alumnos arman programas con **bloques** (estilo Scratch), los ejecutan **paso a paso** viendo cómo cambian las estructuras de datos, y después **exportan el código en Python**.

## Cómo se usa

1. Al abrir, elige un **tema**: Primeros pasos, Pilas, Colas, Listas, Diccionarios, Tuplas, Conjuntos, Funciones o Modo libre.
2. **Toca un ejemplo**: aparecen los bloques, el código en Python y la simulación se ejecuta sola.
3. Cambia los bloques y pulsa **Ejecutar** o **Paso a paso** para ver qué pasa.

Cada tema muestra solo los bloques que necesita. Se puede entrar directo a un tema con el enlace, por ejemplo `…/simulador_python/#pilas`.

## Qué se puede hacer

- **Armar programas con bloques** que muestran la sintaxis real de Python (`pila.append(x)`, `cola.popleft()`, `for x in lista:`…).
- **Ver cada estructura animada** en el escenario. Cada una es una tarjeta que se puede arrastrar:
  - **Pila** (`list`, LIFO): un tubo vertical con el tope marcado. Los elementos entran y salen por arriba.
  - **Cola** (`collections.deque`, FIFO): un tubo horizontal. Entra por el final y sale por el frente.
  - **Lista**: celdas con su índice; se resaltan los accesos, inserciones y eliminaciones.
  - **Diccionario**: pares `clave → valor`.
  - **Tupla**: celdas con borde punteado (inmutable).
  - **Conjunto**: fichas sin orden y sin repetidos.
  - **Variables** simples con su valor y tipo, **variables locales** y la **pila de llamadas** (para entender funciones y recursión).
- **Ejecutar**, **paso a paso** (F8) o **detener**, con control de velocidad. El bloque y la línea de Python que se ejecutan se resaltan.
- **Errores como en Python** (`IndexError: pop from empty list`, `KeyError`, `TypeError`…) con una pista en español.
- **`input()`** funciona: la consola pide la respuesta.
- **Copiar o descargar el código `.py`**. El código generado da el mismo resultado al ejecutarlo con Python.
- **Guardar y abrir proyectos** (`.json`) desde el menú «Más». El programa de cada tema también se guarda solo en el navegador.

### Bloques disponibles

| Categoría | Contenido |
|---|---|
| Variables | asignar `=`, `+=`, `-=`, `*=`, … |
| Números | `+ - * / // % **`, `len int float str bool abs round type sorted sum max min list tuple set`, `random.randint` |
| Lógica | `if / elif / else`, comparaciones, `and or not`, `in / not in`, `True False None` |
| Ciclos | `for … in range()`, `for … in`, `while`, `break`, `continue`, `pass` |
| Texto | métodos de `str`, índices y rebanadas `[a:b]` |
| Entrada / Salida | `print`, `input`, comentarios |
| Listas | `append insert remove pop extend sort reverse clear index count`, `lista[i] = x`, `del` |
| Pilas | apilar (`append`), desapilar (`pop`), tope (`[-1]`), ¿vacía? |
| Colas | encolar (`append`), desencolar (`popleft`), frente, final, ¿vacía? |
| Diccionarios | `d[k] = v`, `get`, `keys values items`, `pop`, `del`, `for clave, valor in d.items()` |
| Tuplas | literal, `(a, b)`, desempaquetar `a, b = t` |
| Conjuntos | `add discard remove`, unión, intersección, diferencias |
| Funciones | `def` con parámetros, `return`, llamadas y recursión |

### Ejemplos incluidos

| Tema | Ejemplos |
|---|---|
| Primeros pasos | Hola y variables · Contar del 1 al 5 · Cuenta regresiva · ¿Par o impar? · Preguntar la edad |
| Pilas | Apilar y desapilar · Invertir una palabra · Deshacer (Ctrl+Z) · Paréntesis balanceados |
| Colas | Encolar y desencolar · Turnos en el banco · Papa caliente |
| Listas | Agregar, insertar y quitar · Sumar y promediar · Buscar el mayor · Ordenar números |
| Diccionarios | Agenda de teléfonos · Calificaciones · Contar palabras |
| Tuplas | Coordenadas de un punto · Intercambiar valores · Una tupla no se cambia |
| Conjuntos | Quitar repetidos · Alumnos en dos talleres · Agregar y quitar |
| Funciones | Saludar · Sumar con return · Factorial recursivo |

## Cómo usarlo

No necesita instalación: es una página web.

- **En línea con GitHub Pages:** en el repositorio, *Settings → Pages → Branch: `main` / (root)*. Queda en `https://<usuario>.github.io/simulador_python/`.
- **En tu computadora:** abre `index.html` en el navegador. Si no hay internet, usa la copia de Blockly incluida en `vendor/`.
  Si el navegador bloquea archivos locales, sirve la carpeta con:

```bash
python -m http.server 8000
```

y abre `http://localhost:8000`.

## Estructura del proyecto

```
index.html          página principal
css/estilos.css     estilos (tema claro y oscuro)
js/valores.js       tipos de Python (int, float, list, dict, set, tuple, deque) y sus errores
js/bloques.js       definición de bloques y categorías
js/interprete.js    ejecuta los bloques paso a paso con la semántica de Python
js/python.js        genera el código Python
js/escenario.js     dibuja y anima las estructuras
js/temas.js         temas, bloques de cada tema y ejemplos
js/app.js           une todo: controles, consola, código, guardar/abrir
vendor/blockly/     copia local de Blockly 11.1.1 (licencia Apache 2.0)
```

## Notas

- Los conjuntos se muestran en el orden en que se agregaron; Python puede imprimirlos en otro orden porque los conjuntos no tienen orden.
- El simulador detiene el programa después de 300 000 pasos para evitar ciclos infinitos.

Construido con [Blockly](https://developers.google.com/blockly) (Google, Apache 2.0).
