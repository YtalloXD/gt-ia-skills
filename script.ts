type GridPoint = {
  x: number;
  y: number;
};

/**
 * Busca um elemento pelo id e interrompe a execucao caso ele nao exista no DOM.
 */
function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Elemento com id "${id}" nao foi encontrado.`);
  }
  return element as T;
}

/**
 * Busca o canvas principal do jogo e valida se o tipo do elemento esta correto.
 */
function getGameCanvas(): HTMLCanvasElement {
  const element = document.getElementById("gameCanvas");
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error('Elemento "gameCanvas" nao e um canvas valido.');
  }
  return element;
}

/**
 * Recupera o contexto 2D do canvas para realizar os desenhos do jogo.
 */
function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel obter o contexto 2D do canvas.");
  }
  return context;
}

const canvas: HTMLCanvasElement = getGameCanvas();
const ctx: CanvasRenderingContext2D = getCanvasContext(canvas);
const appRoot = getRequiredElement<HTMLElement>("appRoot");
const gameShell = getRequiredElement<HTMLElement>("gameShell");
const fxLayer = getRequiredElement<HTMLElement>("fxLayer");
const scoreElement = getRequiredElement<HTMLSpanElement>("score");
const highScoreElement = getRequiredElement<HTMLSpanElement>("highScore");
const finalScoreElement = getRequiredElement<HTMLElement>("finalScore");
const newRecordScoreElement = getRequiredElement<HTMLElement>("newRecordScore");
const footerYearElement = getRequiredElement<HTMLElement>("footerYear");
const menuOverlay = getRequiredElement<HTMLElement>("menuOverlay");
const gameOverOverlay = getRequiredElement<HTMLElement>("gameOverOverlay");
const newRecordOverlay = getRequiredElement<HTMLElement>("newRecordOverlay");
const pauseOverlay = getRequiredElement<HTMLElement>("pauseOverlay");
const startButton = getRequiredElement<HTMLButtonElement>("startButton");
const restartButton = getRequiredElement<HTMLButtonElement>("restartButton");
const newRecordRestartButton = getRequiredElement<HTMLButtonElement>(
  "newRecordRestartButton",
);

const tileSize: number = 20;
const tileCount: number = canvas.width / tileSize;
const normalSpeedMs: number = 130;
const sprintSpeedMs: number = 70;
const highScoreStorageKey = "snake_high_score";

let snake: GridPoint[] = [];
let direction: GridPoint = { x: 1, y: 0 };
let pendingDirection: GridPoint = { x: 1, y: 0 };
let food: GridPoint = { x: 0, y: 0 };
let score: number = 0;
let highScore: number = 0;
let highScoreAtRunStart: number = 0;
let brokeRecordThisRun: boolean = false;
let gameRunning: boolean = false;
let isPaused: boolean = false;
let isSprinting: boolean = false;
let gameLoopId: number | null = null;
let currentSpeed: number = normalSpeedMs;
let eatPopTimeoutId: number | null = null;
let loseShakeTimeoutId: number | null = null;

/**
 * Le o recorde salvo no localStorage e retorna 0 quando nao houver valor valido.
 */
function loadHighScore(): number {
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
function persistHighScore(): void {
  try {
    window.localStorage.setItem(highScoreStorageKey, String(highScore));
  } catch {
    // Ignora erros de armazenamento (modo privado/bloqueio).
  }
}

/**
 * Atualiza o texto do recorde na interface.
 */
function updateHighScoreDisplay(): void {
  highScoreElement.textContent = String(highScore);
}

/**
 * Preenche o ano atual no footer, substituindo o valor fixo do HTML.
 */
function updateFooterYear(): void {
  footerYearElement.textContent = String(new Date().getFullYear());
}

/**
 * Atualiza e persiste o recorde quando a pontuacao atual o supera.
 */
function syncHighScore(): void {
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
function triggerFoodPickupEffect(point: GridPoint): void {
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
function triggerGameOverShake(): void {
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
function resetState(): void {
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
function updateScore(): void {
  scoreElement.textContent = String(score);
}

/**
 * Sorteia uma nova posicao para o alimento, garantindo que nao caia sobre a cobra.
 */
function spawnFood(): void {
  let nextFood: GridPoint;

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
function drawGrid(): void {
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
function drawFood(): void {
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
function drawSnake(): void {
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
function draw(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
}

/**
 * Verifica se um ponto esta fora dos limites do tabuleiro.
 */
function isOutOfBounds(part: GridPoint): boolean {
  return part.x < 0 || part.x >= tileCount || part.y < 0 || part.y >= tileCount;
}

/**
 * Finaliza a partida, para o loop e exibe o overlay de fim de jogo.
 */
function gameOver(): void {
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
function restartGameLoop(): void {
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
function tick(): void {
  direction = pendingDirection;
  const head = snake[0];
  const newHead: GridPoint = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };
  const willGrow = newHead.x === food.x && newHead.y === food.y;
  const collisionBody: GridPoint[] = willGrow ? snake : snake.slice(0, -1);

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
function startGame(): void {
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
function setDirection(nextX: number, nextY: number): void {
  if (!gameRunning || isPaused) return;

  const isReverse = direction.x === -nextX && direction.y === -nextY;
  if (isReverse) return;

  pendingDirection = { x: nextX, y: nextY };
}

/**
 * Alterna entre pausado e em execucao quando o jogador pressiona ESC.
 */
function togglePause(): void {
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
function setSprintState(enabled: boolean): void {
  if (isSprinting === enabled) return;
  isSprinting = enabled;

  if (!gameRunning || isPaused) return;
  restartGameLoop();
}

/**
 * Inicia/reinicia a partida com ESPACO quando uma tela de inicio/fim estiver ativa.
 */
function handleSpaceStart(event: KeyboardEvent): boolean {
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
function handleKeydown(event: KeyboardEvent): void {
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
function handleKeyup(event: KeyboardEvent): void {
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
