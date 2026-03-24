/**
 * Busca um elemento pelo id e interrompe a execucao caso ele nao exista no DOM.
 */
function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Elemento com id "${id}" nao foi encontrado.`);
  }
  return element;
}

/**
 * Busca o canvas principal do jogo e valida se o tipo do elemento esta correto.
 */
function getGameCanvas() {
  const element = document.getElementById("gameCanvas");
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error('Elemento "gameCanvas" nao e um canvas valido.');
  }
  return element;
}

/**
 * Recupera o contexto 2D do canvas para realizar os desenhos do jogo.
 */
function getCanvasContext(canvas) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel obter o contexto 2D do canvas.");
  }
  return context;
}

const canvas = getGameCanvas();
const ctx = getCanvasContext(canvas);
const scoreElement = getRequiredElement("score");
const finalScoreElement = getRequiredElement("finalScore");
const menuOverlay = getRequiredElement("menuOverlay");
const gameOverOverlay = getRequiredElement("gameOverOverlay");
const pauseOverlay = getRequiredElement("pauseOverlay");
const startButton = getRequiredElement("startButton");
const restartButton = getRequiredElement("restartButton");

const tileSize = 20;
const tileCount = canvas.width / tileSize;
const initialSpeedMs = 130;
const minSpeedMs = 70;

let snake = [];
let direction = { x: 1, y: 0 };
let pendingDirection = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let gameRunning = false;
let isPaused = false;
let gameLoopId = null;
let currentSpeed = initialSpeedMs;

/**
 * Restaura o estado inicial da partida: cobra, direcao, placar e alimento.
 */
function resetState() {
  const center = Math.floor(tileCount / 2);
  snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
  direction = { x: 1, y: 0 };
  pendingDirection = { x: 1, y: 0 };
  score = 0;
  currentSpeed = initialSpeedMs;
  updateScore();
  spawnFood();
  draw();
}

/**
 * Atualiza o texto do placar atual na interface.
 */
function updateScore() {
  scoreElement.textContent = String(score);
}

/**
 * Sorteia uma nova posicao para o alimento, garantindo que nao caia sobre a cobra.
 */
function spawnFood() {
  let nextFood;

  do {
    nextFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (snake.some((part) => part.x === nextFood.x && part.y === nextFood.y));

  food = nextFood;
}

/**
 * Desenha a grade de fundo do tabuleiro para facilitar a leitura do movimento.
 */
function drawGrid() {
  ctx.strokeStyle =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas-grid")
      .trim() || "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;

  for (let i = 1; i < tileCount; i += 1) {
    const p = i * tileSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p);
    ctx.stroke();
  }
}

/**
 * Desenha o alimento atual no tabuleiro.
 */
function drawFood() {
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.arc(
    food.x * tileSize + tileSize / 2,
    food.y * tileSize + tileSize / 2,
    tileSize * 0.36,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

/**
 * Desenha todos os segmentos da cobra, com cor diferente para a cabeca.
 */
function drawSnake() {
  snake.forEach((segment, index) => {
    const isHead = index === 0;
    ctx.fillStyle = isHead ? "#59f09d" : "#31ca77";
    ctx.fillRect(
      segment.x * tileSize + 1,
      segment.y * tileSize + 1,
      tileSize - 2,
      tileSize - 2
    );
  });
}

/**
 * Renderiza um frame completo do jogo: grade, alimento e cobra.
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
}

/**
 * Verifica se um ponto esta fora dos limites do tabuleiro.
 */
function isOutOfBounds(part) {
  return part.x < 0 || part.x >= tileCount || part.y < 0 || part.y >= tileCount;
}

/**
 * Finaliza a partida, para o loop e exibe o overlay de fim de jogo.
 */
function gameOver() {
  gameRunning = false;
  isPaused = false;
  if (gameLoopId !== null) {
    window.clearInterval(gameLoopId);
    gameLoopId = null;
  }

  pauseOverlay.classList.add("hidden");
  finalScoreElement.textContent = String(score);
  gameOverOverlay.classList.remove("hidden");
}

/**
 * Aumenta gradualmente a velocidade da cobra conforme a pontuacao cresce.
 */
function speedUpIfNeeded() {
  const nextSpeed = Math.max(minSpeedMs, initialSpeedMs - score * 2);
  if (nextSpeed === currentSpeed) return;

  currentSpeed = nextSpeed;
  if (gameLoopId !== null) {
    window.clearInterval(gameLoopId);
  }
  gameLoopId = window.setInterval(tick, currentSpeed);
}

/**
 * Executa um ciclo do jogo: movimenta a cobra, valida colisoes e processa comida.
 */
function tick() {
  direction = pendingDirection;
  const head = snake[0];
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };
  const willGrow = newHead.x === food.x && newHead.y === food.y;
  const collisionBody = willGrow ? snake : snake.slice(0, -1);

  if (
    isOutOfBounds(newHead) ||
    collisionBody.some((part) => part.x === newHead.x && part.y === newHead.y)
  ) {
    gameOver();
    return;
  }

  snake.unshift(newHead);

  if (willGrow) {
    score += 1;
    updateScore();
    spawnFood();
    speedUpIfNeeded();
  } else {
    snake.pop();
  }

  draw();
}

/**
 * Inicia uma nova partida, escondendo menus e iniciando o loop principal.
 */
function startGame() {
  resetState();
  menuOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  pauseOverlay.classList.add("hidden");
  gameRunning = true;
  isPaused = false;

  if (gameLoopId !== null) {
    window.clearInterval(gameLoopId);
  }
  gameLoopId = window.setInterval(tick, currentSpeed);
}

/**
 * Atualiza a direcao pendente da cobra e bloqueia a inversao de 180 graus.
 */
function setDirection(nextX, nextY) {
  if (!gameRunning || isPaused) return;

  const isReverse = direction.x === -nextX && direction.y === -nextY;
  if (isReverse) return;

  pendingDirection = { x: nextX, y: nextY };
}

/**
 * Alterna entre pausado e em execucao quando o jogador pressiona ESC.
 */
function togglePause() {
  if (!gameRunning) return;

  if (isPaused) {
    isPaused = false;
    pauseOverlay.classList.add("hidden");
    gameLoopId = window.setInterval(tick, currentSpeed);
    return;
  }

  isPaused = true;
  pauseOverlay.classList.remove("hidden");
  if (gameLoopId !== null) {
    window.clearInterval(gameLoopId);
    gameLoopId = null;
  }
}

/**
 * Trata o evento de teclado e converte setas em mudancas de direcao.
 */
function handleKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    togglePause();
    return;
  }

  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      setDirection(0, -1);
      break;
    case "ArrowDown":
      event.preventDefault();
      setDirection(0, 1);
      break;
    case "ArrowLeft":
      event.preventDefault();
      setDirection(-1, 0);
      break;
    case "ArrowRight":
      event.preventDefault();
      setDirection(1, 0);
      break;
    default:
      break;
  }
}

document.addEventListener("keydown", handleKeydown);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

resetState();
