// Busca os elementos do DOM que serao usados durante o jogo e armazena em variaveis para acesso rapido.
const canvas = getGameCanvas();
const ctx = getCanvasContext(canvas);
const appRoot = getRequiredElement("appRoot");
const gameShell = getRequiredElement("gameShell");
const fxLayer = getRequiredElement("fxLayer");
const scoreElement = getRequiredElement("score");
const highScoreElement = getRequiredElement("highScore");
const finalScoreElement = getRequiredElement("finalScore");
const newRecordScoreElement = getRequiredElement("newRecordScore");
const footerYearElement = getRequiredElement("footerYear");
const menuOverlay = getRequiredElement("menuOverlay");
const gameOverOverlay = getRequiredElement("gameOverOverlay");
const newRecordOverlay = getRequiredElement("newRecordOverlay");
const pauseOverlay = getRequiredElement("pauseOverlay");
const startButton = getRequiredElement("startButton");
const restartButton = getRequiredElement("restartButton");
const newRecordRestartButton = getRequiredElement("newRecordRestartButton");

const tileSize = 20;
const tileCount = canvas.width / tileSize;
const normalSpeedMs = 130;
const sprintSpeedMs = 70;
const highScoreStorageKey = "snake_high_score";

let snake = [];
let direction = { x: 1, y: 0 };
let pendingDirection = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let highScore = 0;
let highScoreAtRunStart = 0;
let brokeRecordThisRun = false;
let gameRunning = false;
let isPaused = false;
let isSprinting = false;
let gameLoopId = null;
let currentSpeed = normalSpeedMs;
let eatPopTimeoutId = null;
let loseShakeTimeoutId = null;

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
/**
 * Le o recorde salvo no localStorage e retorna 0 quando nao houver valor valido.
 */
function loadHighScore() {
  try {
    const stored = window.localStorage.getItem(highScoreStorageKey);
    if (!stored) return 0;

    const parsed = Number(stored);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  } catch {
    return 0;
  }
}

/**
 * Salva o recorde atual no localStorage.
 */
function persistHighScore() {
  try {
    window.localStorage.setItem(highScoreStorageKey, String(highScore));
  } catch {
    // Ignora erros de armazenamento (modo privado/bloqueio).
  }
}

/**
 * Atualiza o texto do recorde na interface.
 */
function updateHighScoreDisplay() {
  highScoreElement.textContent = String(highScore);
}

/**
 * Preenche o ano atual no footer, substituindo o valor fixo do HTML.
 */
function updateFooterYear() {
  footerYearElement.textContent = String(new Date().getFullYear());
}

/**
 * Atualiza e persiste o recorde quando a pontuacao atual o supera.
 */
function syncHighScore() {
  if (score <= highScore) return;

  if (score > highScoreAtRunStart) {
    brokeRecordThisRun = true;
  }

  highScore = score;
  persistHighScore();
  updateHighScoreDisplay();
}

/**
 * Dispara os efeitos visuais quando a comida e coletada.
 */
function triggerFoodPickupEffect(point) {
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  const posX = (point.x * tileSize + tileSize / 2) * scaleX;
  const posY = (point.y * tileSize + tileSize / 2) * scaleY;

  const ring = document.createElement("span");
  ring.className = "food-ring";
  ring.style.left = `${posX}px`;
  ring.style.top = `${posY}px`;
  fxLayer.appendChild(ring);

  for (let i = 1; i <= 8; i += 1) {
    const spark = document.createElement("span");
    spark.className = "food-spark";
    spark.dataset.dir = String(i);
    spark.style.left = `${posX}px`;
    spark.style.top = `${posY}px`;
    fxLayer.appendChild(spark);
    window.setTimeout(() => spark.remove(), 450);
  }

  window.setTimeout(() => ring.remove(), 460);

  gameShell.classList.remove("eat-pop");
  void gameShell.offsetWidth;
  gameShell.classList.add("eat-pop");

  if (eatPopTimeoutId !== null) {
    window.clearTimeout(eatPopTimeoutId);
  }

  eatPopTimeoutId = window.setTimeout(() => {
    gameShell.classList.remove("eat-pop");
    eatPopTimeoutId = null;
  }, 250);
}

/**
 * Dispara uma leve tremida da tela quando o jogador perde a partida.
 */
function triggerGameOverShake() {
  appRoot.classList.remove("lose-shake");
  void appRoot.offsetWidth;
  appRoot.classList.add("lose-shake");

  if (loseShakeTimeoutId !== null) {
    window.clearTimeout(loseShakeTimeoutId);
  }

  loseShakeTimeoutId = window.setTimeout(() => {
    appRoot.classList.remove("lose-shake");
    loseShakeTimeoutId = null;
  }, 500);
}

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
  isSprinting = false;
  currentSpeed = normalSpeedMs;
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
  } while (
    snake.some((part) => part.x === nextFood.x && part.y === nextFood.y)
  );

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
    Math.PI * 2,
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
      tileSize - 2,
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
  isSprinting = false;
  currentSpeed = normalSpeedMs;
  if (gameLoopId !== null) {
    window.clearInterval(gameLoopId);
    gameLoopId = null;
  }

  triggerGameOverShake();
  pauseOverlay.classList.add("hidden");
  finalScoreElement.textContent = String(score);

  if (brokeRecordThisRun) {
    newRecordScoreElement.textContent = String(score);
    newRecordOverlay.classList.remove("hidden");
    gameOverOverlay.classList.add("hidden");
    return;
  }

  newRecordOverlay.classList.add("hidden");
  gameOverOverlay.classList.remove("hidden");
}

/**
 * Reinicia o loop principal respeitando a velocidade atual (normal ou sprint).
 */
function restartGameLoop() {
  if (!gameRunning || isPaused) return;

  currentSpeed = isSprinting ? sprintSpeedMs : normalSpeedMs;
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
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };
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
    syncHighScore();
    triggerFoodPickupEffect(newHead);
    spawnFood();
  } else {
    snake.pop();
  }

  draw();
}

/**
 * Inicia uma nova partida, escondendo menus e iniciando o loop principal.
 */
function startGame() {
  highScoreAtRunStart = highScore;
  brokeRecordThisRun = false;
  resetState();
  menuOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  newRecordOverlay.classList.add("hidden");
  pauseOverlay.classList.add("hidden");
  gameRunning = true;
  isPaused = false;
  isSprinting = false;
  currentSpeed = normalSpeedMs;

  restartGameLoop();
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
    restartGameLoop();
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
 * Ativa ou desativa o sprint da cobra quando SHIFT e pressionado/solto.
 */
function setSprintState(enabled) {
  if (isSprinting === enabled) return;
  isSprinting = enabled;

  if (!gameRunning || isPaused) return;
  restartGameLoop();
}

/**
 * Inicia/reinicia a partida com ESPACO quando uma tela de inicio/fim estiver ativa.
 */
function handleSpaceStart(event) {
  const isSpaceKey =
    event.code === "Space" || event.key === " " || event.key === "Spacebar";
  if (!isSpaceKey) return false;
  if (event.repeat) return true;
  if (gameRunning) return true;

  const canStartFromOverlay =
    !menuOverlay.classList.contains("hidden") ||
    !gameOverOverlay.classList.contains("hidden") ||
    !newRecordOverlay.classList.contains("hidden");

  if (canStartFromOverlay) {
    event.preventDefault();
    startGame();
  }

  return true;
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

  if (handleSpaceStart(event)) {
    return;
  }

  if (event.key === "Shift") {
    event.preventDefault();
    setSprintState(true);
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

/**
 * Trata soltura de teclas para desligar o sprint quando SHIFT e liberado.
 */
function handleKeyup(event) {
  if (event.key !== "Shift") return;

  event.preventDefault();
  setSprintState(false);
}

document.addEventListener("keydown", handleKeydown);
document.addEventListener("keyup", handleKeyup);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
newRecordRestartButton.addEventListener("click", startGame);

highScore = loadHighScore();
updateHighScoreDisplay();
updateFooterYear();
resetState();
