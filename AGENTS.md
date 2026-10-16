# Repository Guidance

- Vanilla JS/HTML/CSS Pac-Man. No package.json, build, lint, or tests — verify changes by opening `src/index.html` in a browser (classic scripts work over `file://`; no dev server needed).
- Files are plain scripts, not modules: everything shares state via `window` globals. The `<script>` order in `src/index.html` is the dependency graph: `maze.js` → `game.js` → `render.js` → `main.js` (main.js starts the rAF loop immediately). New scripts must be inserted in dependency order before `main.js`.
- Globals by file: `maze.js` → `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`; `game.js` → `createGame`/`update`/`DIRS`; `render.js` → `draw`; `main.js` owns keyboard, overlay, and the loop.
- Tile codes: 0 = empty/walkable, 1 = wall, 2 = dot, 3 = pen door (blocks Pac-Man only). Grid is 28x31 drawn at 20px/tile on a 560x620 canvas; row 14 is the tunnel and wraps horizontally.
- `MAZE` is pristine: `createGame()` clones it into `game.grid`; only `game.grid` is mutated (dot eating).
- Movement is per-frame: speeds must be exact fractions of a cell (0.125, 0.1) so actors land on cell centers every 8/10 frames; turning and dot-eating only run when `aligned()`. Arbitrary speed values break grid snapping.
- Comments, UI text, and spec docs are Spanish. Code uses spaced parens (`if ( x )`); no formatter is configured — match the existing style.
- Spec workflow: specs go in `specs/NN-slug.md` (folder not created yet — `/spec` creates it plus `specs/.spec-config.yml`). `/spec-impl` only runs on specs whose status means Approved/Aprobado, then creates branch `spec-NN-slug`.
