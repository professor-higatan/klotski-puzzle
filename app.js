(function () {
  'use strict';

  let config = null;
  let pieces = [];
  let initialPieces = [];
  let history = [];
  let moveCount = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let selectedPieceId = null;
  let won = false;

  const boardEl = document.getElementById('board');
  const moveCountEl = document.getElementById('move-count');
  const timerEl = document.getElementById('timer');
  const undoBtn = document.getElementById('undo-btn');
  const resetBtn = document.getElementById('reset-btn');
  const directionPad = document.getElementById('direction-pad');
  const winOverlay = document.getElementById('win-overlay');
  const winStatsEl = document.getElementById('win-stats');
  const playAgainBtn = document.getElementById('play-again-btn');
  const confettiCanvas = document.getElementById('confetti-canvas');

  const DIRS = {
    up: { dc: 0, dr: -1 },
    down: { dc: 0, dr: 1 },
    left: { dc: -1, dr: 0 },
    right: { dc: 1, dr: 0 },
  };

  async function init() {
    const res = await fetch('puzzle.json');
    config = await res.json();
    initialPieces = deepClone(config.pieces);
    resetGame(false);
    bindEvents();
    render();
    startTimer();
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function resetGame(keepOverlay = true) {
    pieces = deepClone(initialPieces);
    history = [];
    moveCount = 0;
    elapsedSeconds = 0;
    selectedPieceId = null;
    won = false;
    if (keepOverlay) winOverlay.classList.add('hidden');
    updateStats();
    updateDirectionPad();
    undoBtn.disabled = true;
    if (timerInterval) clearInterval(timerInterval);
    startTimer();
    render();
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      if (!won) {
        elapsedSeconds++;
        updateStats();
      }
    }, 1000);
  }

  function updateStats() {
    moveCountEl.textContent = moveCount;
    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  function getOccupancy(excludeId) {
    const occ = Array.from({ length: config.board.rows }, () =>
      Array(config.board.cols).fill(null)
    );
    for (const p of pieces) {
      if (p.id === excludeId) continue;
      for (let r = 0; r < p.height; r++) {
        for (let c = 0; c < p.width; c++) {
          occ[p.position.row + r][p.position.col + c] = p.id;
        }
      }
    }
    return occ;
  }

  function canMove(piece, dc, dr) {
    const occ = getOccupancy(piece.id);
    const { col, row } = piece.position;

    if (dc === 1) {
      for (let r = 0; r < piece.height; r++) {
        const nc = col + piece.width;
        if (nc >= config.board.cols || occ[row + r][nc]) return false;
      }
      return true;
    }
    if (dc === -1) {
      for (let r = 0; r < piece.height; r++) {
        const nc = col - 1;
        if (nc < 0 || occ[row + r][nc]) return false;
      }
      return true;
    }
    if (dr === 1) {
      for (let c = 0; c < piece.width; c++) {
        const nr = row + piece.height;
        if (nr >= config.board.rows || occ[nr][col + c]) return false;
      }
      return true;
    }
    if (dr === -1) {
      for (let c = 0; c < piece.width; c++) {
        const nr = row - 1;
        if (nr < 0 || occ[nr][col + c]) return false;
      }
      return true;
    }
    return false;
  }

  function getMovableDirections(pieceId) {
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece) return [];
    return Object.entries(DIRS)
      .filter(([, { dc, dr }]) => canMove(piece, dc, dr))
      .map(([name]) => name);
  }

  function movePiece(pieceId, direction) {
    if (won) return false;
    const piece = pieces.find((p) => p.id === pieceId);
    if (!piece) return false;
    const { dc, dr } = DIRS[direction];
    if (!canMove(piece, dc, dr)) return false;

    history.push(deepClone(pieces));
    piece.position.col += dc;
    piece.position.row += dr;
    moveCount++;
    undoBtn.disabled = false;
    updateStats();
    render();
    checkWin();
    return true;
  }

  function undo() {
    if (history.length === 0 || won) return;
    pieces = history.pop();
    moveCount = Math.max(0, moveCount - 1);
    undoBtn.disabled = history.length === 0;
    selectedPieceId = null;
    updateStats();
    updateDirectionPad();
    render();
  }

  function checkWin() {
    const goal = config.board.exit;
    const boss = pieces.find((p) => p.id === goal.target_piece_id);
    if (
      boss &&
      boss.position.col === goal.target_position.col &&
      boss.position.row === goal.target_position.row
    ) {
      won = true;
      clearInterval(timerInterval);
      showWin();
    }
  }

  function showWin() {
    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    winStatsEl.textContent = `${moveCount}手 / ${m}分${s}秒`;
    winOverlay.classList.remove('hidden');
    launchConfetti();
  }

  function getCellSize() {
    const maxW = Math.min(window.innerWidth - 48, 400);
    const gap = config.board.gap_px;
    const cols = config.board.cols;
    return Math.floor((maxW - gap * (cols + 1)) / cols);
  }

  function render() {
    const gap = config.board.gap_px;
    const cellSize = getCellSize();
    const cols = config.board.cols;
    const rows = config.board.rows;
    const boardW = cols * cellSize + (cols + 1) * gap;
    const boardH = rows * cellSize + (rows + 1) * gap;

    boardEl.style.width = boardW + 'px';
    boardEl.style.height = boardH + 'px';
    boardEl.style.background = config.board.background;
    boardEl.innerHTML = '';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.left = gap + c * (cellSize + gap) + 'px';
        cell.style.top = gap + r * (cellSize + gap) + 'px';
        cell.style.width = cellSize + 'px';
        cell.style.height = cellSize + 'px';
        cell.style.background = config.colors.empty.fill;
        boardEl.appendChild(cell);
      }
    }

    for (const p of pieces) {
      const colorDef = config.colors[p.color];
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.id = p.id;
      el.style.left = gap + p.position.col * (cellSize + gap) + 'px';
      el.style.top = gap + p.position.row * (cellSize + gap) + 'px';
      el.style.width = p.width * cellSize + (p.width - 1) * gap + 'px';
      el.style.height = p.height * cellSize + (p.height - 1) * gap + 'px';
      el.style.background = colorDef.fill;
      el.style.color = colorDef.label_text;
      el.style.border = `2px solid ${colorDef.stroke}`;

      if (p.label) el.textContent = p.label;
      if (p.is_goal_piece && config.ui_hints.highlight_goal_piece) {
        el.classList.add('goal-piece');
      }
      if (p.id === selectedPieceId) {
        el.classList.add('selected');
      }

      setupPieceInteraction(el, p.id);
      boardEl.appendChild(el);
    }
  }

  function selectPiece(id) {
    selectedPieceId = id;
    updateDirectionPad();
    render();
  }

  function updateDirectionPad() {
    if (!selectedPieceId) {
      directionPad.classList.add('hidden');
      return;
    }
    directionPad.classList.remove('hidden');
    const movable = getMovableDirections(selectedPieceId);
    directionPad.querySelectorAll('.dir-btn').forEach((btn) => {
      const dir = btn.dataset.dir;
      btn.disabled = !movable.includes(dir);
    });
  }

  function setupPieceInteraction(el, pieceId) {
    let startX, startY, moved;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      selectPiece(pieceId);
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
    });

    el.addEventListener('pointerup', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const threshold = 20;

      if (moved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
        let dir;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? 'right' : 'left';
        } else {
          dir = dy > 0 ? 'down' : 'up';
        }
        if (movePiece(pieceId, dir)) {
          selectedPieceId = pieceId;
          updateDirectionPad();
          render();
        }
      }

      startX = startY = null;
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  }

  function bindEvents() {
    undoBtn.addEventListener('click', undo);
    resetBtn.addEventListener('click', () => resetGame());
    playAgainBtn.addEventListener('click', () => resetGame());

    directionPad.querySelectorAll('.dir-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (selectedPieceId) {
          movePiece(selectedPieceId, btn.dataset.dir);
          updateDirectionPad();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (!selectedPieceId) return;
      const keyMap = {
        ArrowUp: 'up', ArrowDown: 'down',
        ArrowLeft: 'left', ArrowRight: 'right',
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        movePiece(selectedPieceId, keyMap[e.key]);
        updateDirectionPad();
      }
    });

    window.addEventListener('resize', render);
  }

  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const colors = ['#E63946', '#1D6FB8', '#F4C430', '#ffd700', '#ff6b6b', '#4ecdc4'];
    const particles = Array.from({ length: 150 }, () => ({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * 200,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 10,
    }));

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.vr;
        if (p.y < confettiCanvas.height + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame++;
      if (alive && frame < 300) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
    animate();
  }

  init();
})();