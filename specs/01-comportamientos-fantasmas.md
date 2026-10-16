# SPEC 01 — Cuatro fantasmas con comportamientos propios

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-10-16
> **Objetivo:** Que los cuatro fantasmas tengan comportamientos distintos y reconocibles, con el acosador persiguiendo agresivamente a Pac-Man por el camino más corto real (BFS).

## Por qué existe este spec

Hoy hay 2 fantasmas (`hunter` greedy y `random`). El `hunter` puede oscilar en bucles locales y el `random` no tiene personalidad percibible. Se pasan a 4 fantasmas con identidad clásica (acosador, emboscador, flanqueador, tímido) y persecución real con BFS.

## Alcance

**Dentro:**

- `src/js/maze.js`: `GHOST_STARTS` pasa de 2 a 4 entradas, todas dentro de la pen en la fila `y=14`, cada una con su `kind`.
- `src/js/game.js`: decisión por comportamiento (`ghostTarget`) + persecución con BFS (`bfsDistances`); se elimina la rama `random`.
- `src/js/render.js`: color fijo por `kind` (rojo, rosa, cian, naranja), independiente del orden del array.

**Fuera de alcance (para futuros specs):**

- Modo asustado / power pellets.
- Colisiones entre fantasmas (pueden superponerse).
- Ciclos globales scatter/chase por reloj.
- Dificultad progresiva por nivel.
- Salida de la pen con temporizadores escalonados.

## Modelo de datos

```js
// maze.js — 4 fantasmas, todos dentro de la pen, fila y=14
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'hunter' },   // acosador
  { x: 13, y: 14, kind: 'ambusher' }, // emboscador
  { x: 14, y: 14, kind: 'flanker' },  // flanqueador
  { x: 15, y: 14, kind: 'shy' },      // tímido
];
```

```js
// render.js — color fijo por kind (valores ya usados en GHOST_COLORS)
const KIND_COLORS = {
  hunter: '#ff0000',   // rojo
  ambusher: '#ffb8ff', // rosa
  flanker: '#00ffff',  // cian
  shy: '#ffb852',      // naranja
};
```

Objetivo de cada comportamiento (celda que el fantasma intenta alcanzar):

- `hunter`: celda exacta de Pac-Man `( round(p.x), round(p.y) )`.
- `ambusher`: `p + 4 × DIRS[p.dir]` (4 celdas adelante según la dirección actual de Pac-Man), clamped a `[0,27]×[0,30]`.
- `flanker`: reflejo `2 × ( p + 2 × DIRS[p.dir] ) − celda(hunter)`, clamped.
- `shy`: si distancia Manhattan a Pac-Man > 8 → celda de Pac-Man; si no → esquina inferior izquierda `(1,29)`.

El objeto de estado `game` no gana campos: `kind` ya existe en cada fantasma. Nuevas funciones en `game.js`: `bfsDistances( grid, target )` (mapa de distancias BFS sobre celdas transitables para fantasmas, con wrap en `TUNNEL_ROW`; si `target` cae en muro, siembra desde la celda transitable más cercana) y `ghostTarget( game, g )`.

## Plan de implementación

1. `src/js/maze.js`: reemplazar `GHOST_STARTS` por las 4 entradas con `kind`. Prueba manual: abrir `src/index.html`; se ven 4 fantasmas y el juego corre (colores aún por índice).
2. `src/js/render.js`: reemplazar `GHOST_COLORS` por `KIND_COLORS` y usarlo en `draw` según `g.kind`. Prueba manual: los 4 colores aparecen y no dependen del orden del array.
3. `src/js/game.js`: agregar `bfsDistances( grid, target )`. Prueba manual: consola sin errores.
4. `src/js/game.js`: agregar `ghostTarget( game, g )` con las 4 reglas y los clamps. Prueba manual: consola sin errores.
5. `src/js/game.js`: reescribir `decideGhost` para elegir vecino con menor distancia BFS a `ghostTarget` (empate: seguir de frente; luego orden fijo `up, left, down, right`); eliminar la rama `random`. Prueba manual: los 4 se mueven distinto y el rojo alcanza a Pac-Man.

## Criterios de aceptación

- [ ] Abrir `src/index.html` carga sin errores en consola.
- [ ] Se renderizan 4 fantasmas con colores rojo, rosa, cian y naranja (uno por comportamiento).
- [ ] Los 4 arrancan dentro de la pen en `y=14` y logran salir al laberinto.
- [ ] El acosador reduce la distancia BFS a Pac-Man en cada cruce y lo alcanza aunque deba rodear muros (probar corredor en U).
- [ ] El emboscador se posiciona por delante de la trayectoria de Pac-Man (según `p.dir`).
- [ ] El flanqueador corta por el flanco reflejando la celda del acosador.
- [ ] El tímido persigue a más de 8 celdas y se retira a `(1,29)` a 8 o menos.
- [ ] Los fantasmas respetan paredes (tile 1) y atraviesan la puerta (tile 3).
- [ ] En la fila del túnel, el BFS conecta los bordes y los fantasmas lo usan si acorta su camino.
- [ ] Dos fantasmas pueden ocupar la misma celda sin errores.
- [ ] Perder una vida reubica a los 4 fantasmas en sus celdas iniciales.
- [ ] Ganar/perder sigue mostrando GANASTE/PERDISTE.

## Decisiones

- **Sí:** los 4 comportamientos clásicos adaptados. Son distinguibles a simple vista por el jugador.
- **Sí:** BFS en vez del greedy actual. Persecución genuina; coste despreciable (868 celdas, solo al alinearse a celda).
- **Sí:** color por `kind`, no por índice. El orden del array nunca condicionará la identidad visual.
- **Sí:** BFS modela el wrap del túnel. Evita persecuciones absurdas con Pac-Man en el túnel.
- **Sí:** objetivo no transitable → sembrar el BFS desde la celda transitable más cercana.
- **Sí:** empate de distancias → seguir de frente; luego orden fijo `up, left, down, right`. Determinista, sin oscilación.
- **Sí:** velocidad única 0.1 para los 4. Es 1/10 exacto: preserva el grid snapping de `AGENTS.md`.
- **Sí:** `resetPositions` no se toca: ya itera `GHOST_STARTS` por índice y funciona con 4 entradas.
- **No:** el comportamiento `random`. Lo reemplazan los 4 nuevos; se elimina su rama.
- **No:** power pellets / modo asustado, colisiones fantasma-fantasma, ciclos scatter/chase, dificultad por nivel, salida escalonada. Cada uno merece su propio spec.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| El objetivo del emboscador/flanqueador cae fuera de la grilla o sobre un muro | Clamp a límites + siembra del BFS desde la celda transitable más cercana. |
| Los 4 saliendo por la puerta de 2 celdas podrían encolarse o bloquearse | Las colisiones entre fantasmas están fuera: pueden superponerse y no se bloquean. |
| El BFS por frame afecta el rendimiento | Solo corre cuando el fantasma está alineado (cada 8–10 frames), sobre 28×31 celdas. |

## Qué **no** entra en este spec

- Modo asustado / power pellets.
- Colisiones entre fantasmas.
- Ciclos globales scatter/chase por reloj.
- Dificultad progresiva por nivel.
- Salida de la pen con temporizadores escalonados.

Cada uno de esos, si llega, va en su propio spec.
