# SPEC 02 — Power pellets y modo asustado

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-16
> **Objetivo:** Agregar 4 power pellets (una por esquina clásica) que, al comerse, activan 6 segundos de modo asustado con fantasmas azules, comestibles y puntaje por combo.

## Por qué existe este spec

El SPEC 01 dejó fuera power pellets y modo asustado. Hoy todas las celdas consumibles son dots de 10 puntos y los fantasmas solo persiguen. Este spec agrega el segundo consumible clásico y el estado reactivo de los fantasmas.

## Alcance

**Dentro:**

- `src/js/maze.js`: nuevo tile `4` (power pellet, char `'o'`) en `parseTile`; las 4 esquinas clásicas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` pasan de dot a pellet.
- `src/js/game.js`: comer pellet (+50 pts, cuenta en `dotsRemaining`), estado asustado (`frightenedTimer`, `ghostCombo`, flag `frightened` por fantasma), huida por BFS, colisiones con fantasmas asustados, reset del estado al perder vida.
- `src/js/render.js`: pellet más grande en `drawDots`; fantasmas azules con parpadeo blanco en los últimos 2 s.

**Fuera de alcance (para futuros specs):**

- Ojos clásicos: el fantasma comido no recorre la pen, reaparece al instante.
- Popup de puntos flotante al comer un fantasma.
- Sonidos.
- Duración del susto variable por nivel (el juego no tiene niveles).
- Más de 4 pellets o posiciones alternativas.

## Modelo de datos

```js
// maze.js — 'o' = power pellet (4)
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' ) return 4;
  return 0;
}
// Esquinas en MAZE_STR: (1,3), (26,3), (1,23), (26,23)
// p.ej. fila 3:  '#o####.#####.##.#####.####o#'
```

```js
// game.js — constantes nuevas
const PELLET_SCORE = 50;
const FRIGHTENED_FRAMES = 360;       // 6 s a 60 fps
const FRIGHTENED_SPEED = 0.05;       // 1/20 celda/frame, exacto para el grid snapping
const FRIGHTENED_FLASH_FRAMES = 120; // ultimos 2 s
const GHOST_SCORES = [ 200, 400, 800, 1600 ];
```

```js
// game.js — createGame()
return {
  // ...campos existentes...
  frightenedTimer: 0, // frames restantes; 0 = inactivo
  ghostCombo: 0,      // fantasmas comidos en el susto actual
  ghosts: GHOST_STARTS.map( ( g ) => ( {
    // ...campos existentes...
    frightened: false,
  } ) ),
};
```

- `dotsRemaining` cuenta tiles `2` y `4` (el loop de `createGame` pasa a `v === 2 || v === 4`).
- Velocidad efectiva en `moveGhost`: `g.frightened ? FRIGHTENED_SPEED : g.speed`.
- Índice de combo: `Math.min( ghostCombo, 3 )` (tope 1600).
- `render.js`: `FRIGHTENED_COLOR = '#2121ff'` (azul clásico, se distingue de las paredes por forma rellena) y blanco `#ffffff` para el parpadeo.

## Plan de implementación

1. `src/js/maze.js`: agregar `'o' → 4` a `parseTile` y las 4 esquinas `'o'`; `src/js/render.js`: `drawDots` dibuja el tile 4 con radio mayor (5.5 vs 2.5). Prueba manual: se ven 4 pellets grandes en las esquinas; aún no se comen.
2. `src/js/game.js`: `createGame` cuenta tile 4 en `dotsRemaining`; comer pellet suma `PELLET_SCORE`. Prueba manual: las pellets se comen, suman 50 y GANASTE exige comerlas también.
3. `src/js/game.js`: activación del susto (timer a 360, combo a 0, todos `frightened = true` e inversión de `dir`) y decremento del timer al final de `update`, tras colisiones; al llegar a 0 todos `frightened = false`. Prueba manual: al comer pellet los fantasmas invierten una vez y a los 6 s nada más cambia.
4. `src/js/game.js`: `decideGhost` en modo asustado elige el vecino que maximiza la distancia BFS a Pac-Man (mismo orden de empate) y `moveGhost` usa `FRIGHTENED_SPEED`. Prueba manual: durante el susto se alejan de Pac-Man y corren más lento.
5. `src/js/game.js`: colisión con fantasma asustado → `GHOST_SCORES[ min( ghostCombo, 3 ) ]`, `ghostCombo++`, fantasma a su celda inicial de la pen, `dir: 'up'`, `frightened: false`; perder vida resetea timer, combo y flags. Prueba manual: combo 200/400/800/1600 y el revivido persigue normal aunque quede susto.
6. `src/js/render.js`: `drawGhost` pinta azul si `g.frightened`, con parpadeo azul/blanco cuando `frightenedTimer <= FRIGHTENED_FLASH_FRAMES`. Prueba manual: azules al comer pellet, parpadeo final y revivido con su color.

## Criterios de aceptación

- [ ] Abrir `src/index.html` carga sin errores en consola.
- [ ] Se ven 4 pellets más grandes que un dot en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`, sin dots eliminados en otras celdas.
- [ ] Comer una pellet suma 50 puntos y la quita del tablero.
- [ ] GANASTE aparece solo después de comer el último dot o pellet.
- [ ] Al comer una pellet los 4 fantasmas invierten su dirección y se vuelven azules.
- [ ] Durante el susto la distancia BFS de cada fantasma a Pac-Man tiende a aumentar y se mueven a la mitad de velocidad.
- [ ] A los 360 frames los fantasmas recuperan color y persecución normal.
- [ ] En los últimos 120 frames parpadean azul/blanco.
- [ ] Comer fantasmas dentro de una misma pellet suma 200/400/800/1600 en ese orden; cada pellet nuevo reinicia a 200.
- [ ] El fantasma comido reaparece en su celda inicial de la pen y persigue normal aunque el susto siga activo; puede matar a Pac-Man.
- [ ] Perder una vida durante el susto apaga el susto, resetea el combo y reubica a todos.
- [ ] Dos pellets seguidas reinician el temporizador a 360 y el combo a 200 sin errores.
- [ ] Los fantasmas asustados respetan paredes, atraviesan la puerta y usan el wrap del túnel al huir.

## Decisiones

- **Sí:** tile `4` con char `'o'`. Sigue el esquema de tiles existente (0/1/2/3) y reusa el conteo, el clonado de `MAZE` y el dibujo por celda.
- **Sí:** las pellets cuentan en `dotsRemaining`. Ganar exige limpiar todo el laberinto, como el arcade.
- **Sí:** flag `frightened` por fantasma + temporizador global. Permite que un comido reviva normal mientras el susto del resto sigue.
- **Sí:** velocidad asustada 0.05 (1/20 exacto). La conmutación 0.1 ↔ 0.05 no rompe el grid snapping: ambas son múltiplos de 0.05.
- **Sí:** huida por BFS maximizando distancia a Pac-Man, con inversión al activarse. Determinista, reusa `bfsDistances` y hace perceptible la huida.
- **Sí:** 360 frames de susto y 120 de parpadeo. Valores clásicos; el timer no depende de posiciones, no exige múltiplos de celda.
- **Sí:** combo 200/400/800/1600 con tope en 1600; se reinicia con cada pellet y con cada vida perdida.
- **Sí:** al comer pellet se asustan todos los fantasmas, incluidos los de la pen y los recién revividos. Coherente con el arcade.
- **Sí:** el timer se decrementa después de resolver colisiones: el frame límite favorece al jugador.
- **Sí:** morir durante el susto apaga el susto y resetea el combo. Coherente con `resetPositions`.
- **No:** ojos clásicos volviendo a la pen. Revivir al instante es menos código y jugablemente equivalente.
- **No:** popup de puntos flotante. El HUD ya muestra SCORE.
- **No:** duración variable por nivel. El juego no tiene niveles.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Cambiar de velocidad a mitad de celda desalinea al fantasma | Ambas velocidades son múltiplos de 0.05: la posición sigue en la retícula y `aligned()` se cumple cada 20/10 frames. |
| El BFS de huida por fantasma y frame afecta el rendimiento | Solo corre al alinearse a celda (cada 20 frames durante el susto), sobre 28×31 celdas. |
| Un fantasma comido justo al expirar el temporizador | Orden fijo: mover → colisiones → decrementar timer. El frame límite favorece al jugador. |
| Invertir la dirección puede mandar al fantasma contra una pared | `decideGhost` solo elige direcciones transitables; sin opciones cae al giro de 180 actual. |

## Qué **no** entra en este spec

- Ojos clásicos volviendo a la pen.
- Popup de puntos flotante.
- Sonidos.
- Duración del susto variable por nivel.
- Más de 4 pellets o posiciones alternativas.

Cada uno de esos, si llega, va en su propio spec.
