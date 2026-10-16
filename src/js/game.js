// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Power pellets / modo asustado.
const PELLET_SCORE = 50;
const FRIGHTENED_FRAMES = 360;       // 6 s a 60 fps
const FRIGHTENED_SPEED = 0.05;       // 1/20 celda/frame, exacto para el grid snapping
const FRIGHTENED_FLASH_FRAMES = 120; // ultimos 2 s
const GHOST_SCORES = [ 200, 400, 800, 1600 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightenedTimer: 0, // frames restantes de susto; 0 = inactivo
    ghostCombo: 0,      // fantasmas comidos en el susto actual
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      frightened: false,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// Al comer una power pellet: todos los fantasmas se asustan e invierten su
// direccion una vez (incluidos los de la pen y los recien revividos).
function activateFright( game ) {
  game.frightenedTimer = FRIGHTENED_FRAMES;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g ) => {
    g.frightened = true;
    g.dir = OPPOSITE[ g.dir ];
  } );
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += PELLET_SCORE;
      game.dotsRemaining--;
      activateFright( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Mapa de distancias BFS (en celdas) desde target hacia cada celda
// transitable para fantasmas. Modela el wrap del tunel. Si target cae en
// muro/puerta, siembra desde la celda transitable mas cercana (Manhattan).
function bfsDistances( grid, target ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  const dist = new Map();
  const key = ( x, y ) => y * W + x;

  let start = target;
  if ( isWall( grid, start.x, start.y, 'ghost' ) ) {
    let best = Infinity;
    for ( let y = 0; y < H; y++ ) {
      for ( let x = 0; x < W; x++ ) {
        if ( isWall( grid, x, y, 'ghost' ) ) continue;
        const d = Math.abs( x - target.x ) + Math.abs( y - target.y );
        if ( d < best ) {
          best = d;
          start = { x, y };
        }
      }
    }
  }

  const queue = [ start ];
  dist.set( key( start.x, start.y ), 0 );
  for ( let i = 0; i < queue.length; i++ ) {
    const c = queue[ i ];
    const d = dist.get( key( c.x, c.y ) );
    for ( const name of Object.keys( DIRS ) ) {
      const dir = DIRS[ name ];
      const nx = c.x + dir.x;
      const ny = c.y + dir.y;
      if ( ny < 0 || ny >= H ) continue;
      // En la fila del tunel se envuelve horizontalmente; en el resto, no.
      if ( nx < 0 || nx >= W ) {
        if ( c.y !== TUNNEL_ROW ) continue;
      }
      const wrapped = ( ( nx % W ) + W ) % W;
      if ( isWall( grid, wrapped, ny, 'ghost' ) ) continue;
      const k = key( wrapped, ny );
      if ( dist.has( k ) ) continue;
      dist.set( k, d + 1 );
      queue.push( { x: wrapped, y: ny } );
    }
  }
  return dist;
}

function clampCell( c, grid ) {
  return {
    x: Math.max( 0, Math.min( grid[ 0 ].length - 1, c.x ) ),
    y: Math.max( 0, Math.min( grid.length - 1, c.y ) ),
  };
}

// Celda objetivo segun el comportamiento del fantasma.
function ghostTarget( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const cell = { x: Math.round( p.x ), y: Math.round( p.y ) };
  const d = DIRS[ p.dir ];

  if ( g.kind === 'ambusher' ) {
    return clampCell( { x: cell.x + 4 * d.x, y: cell.y + 4 * d.y }, grid );
  }
  if ( g.kind === 'flanker' ) {
    const ahead = { x: cell.x + 2 * d.x, y: cell.y + 2 * d.y };
    const hunter = game.ghosts.find( ( o ) => o.kind === 'hunter' );
    const hx = hunter ? Math.round( hunter.x ) : cell.x;
    const hy = hunter ? Math.round( hunter.y ) : cell.y;
    return clampCell( { x: 2 * ahead.x - hx, y: 2 * ahead.y - hy }, grid );
  }
  if ( g.kind === 'shy' ) {
    const manhattan = Math.abs( g.x - p.x ) + Math.abs( g.y - p.y );
    if ( manhattan > 8 ) return cell;
    return { x: 1, y: 29 };
  }
  return cell; // hunter: celda exacta de Pac-Man
}

// Elige la direccion con menor distancia BFS al objetivo.
// Empate: seguir de frente; luego orden fijo up, left, down, right.
function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  const target = g.frightened
    ? { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) }
    : ghostTarget( game, g );
  const dist = bfsDistances( grid, target );

  const start = { x: Math.round( g.x ), y: Math.round( g.y ) };
  const distOf = ( dir ) => {
    const d = DIRS[ dir ];
    const nx = start.x + d.x;
    const ny = start.y + d.y;
    const wrapped = ( ( nx % grid[ 0 ].length ) + grid[ 0 ].length ) % grid[ 0 ].length;
    const k = ny * grid[ 0 ].length + wrapped;
    return dist.has( k ) ? dist.get( k ) : Infinity;
  };

  // Orden de preferencia en empate: seguir de frente; luego up, left, down, right.
  const ordered = [ g.dir, 'up', 'left', 'down', 'right' ].filter( ( dir ) => choices.includes( dir ) );

  // Asustado huye: elige el vecino que maximiza la distancia BFS a Pac-Man,
  // con el mismo orden de empate. Normal: la minimiza.
  const fleeing = g.frightened;
  let best = ordered[ 0 ];
  let bestDist = fleeing ? -Infinity : Infinity;
  for ( const dir of ordered ) {
    const d = distOf( dir );
    if ( fleeing ? d > bestDist : d < bestDist ) {
      best = dir;
      bestDist = d;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  const speed = g.frightened ? FRIGHTENED_SPEED : g.speed;
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Perder una vida apaga el susto y resetea el combo.
  game.frightenedTimer = 0;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.frightened = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( let i = 0; i < game.ghosts.length; i++ ) {
    const g = game.ghosts[ i ];
    if ( !collides( game.pacman, g ) ) continue;
    if ( g.frightened ) {
      // Comido: puntos por combo y revive en su celda inicial de la pen.
      game.score += GHOST_SCORES[ Math.min( game.ghostCombo, 3 ) ];
      game.ghostCombo++;
      g.x = GHOST_STARTS[ i ].x;
      g.y = GHOST_STARTS[ i ].y;
      g.dir = 'up';
      g.frightened = false;
    } else {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  // El timer se decrementa tras resolver colisiones: el frame limite favorece
  // al jugador. Al llegar a 0, todos vuelven a la persecucion normal.
  if ( game.frightenedTimer > 0 ) {
    game.frightenedTimer--;
    if ( game.frightenedTimer === 0 ) {
      game.ghosts.forEach( ( g ) => { g.frightened = false; } );
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
