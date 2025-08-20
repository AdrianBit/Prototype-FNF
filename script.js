const button = document.getElementById("start");
const gameArea = document.getElementById("gameArea");
const keys = { ArrowLeft: "←", ArrowUp: "↑", ArrowDown: "↓", ArrowRight: "→" };
const wasd = { a: "←", w: "↑", s: "↓", d: "→" };
const positions = {
  ArrowLeft: "1%",
  ArrowUp: "51%",
  ArrowDown: "26%",
  ArrowRight: "76%"
};
let score = 0;
let startTime;
let chartData;
let audio1;
let audio2;
let audioDelay = 700;
let currentAnim = "idle";
let animFrames = {};
let animIndex = 0;
let animTimer;
let idleTimeout = null;
const arrowTravelTime = 0.7;

// Enemy sprite variables
let enemyAnim = "idle";
let enemyFrames = {};
let enemyIndex = 0;
let enemyTimer;
let enemyIdleTimeout = null;
let enemyImage;

// Spritesheet variables
let spriteImage;
let canvas = document.getElementById("gameCanvas");
let ctx = canvas.getContext("2d");

// Enemy canvas
let enemyCanvas = document.getElementById("enemyCanvas");
let enemyCtx = enemyCanvas.getContext("2d");

// Función para cargar un archivo JSON
async function loadChart(filePath) {
  const response = await fetch(filePath);
  if (!response.ok) throw new Error(`Error al cargar el archivo: ${response.statusText}`);
  return await response.json();
}

async function loadAssets(imagePath, xmlPath) {
  const image = new Image();
  image.src = imagePath;
  await new Promise(r => image.onload = r);

  const xmlText = await fetch(xmlPath).then(res => res.text());
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");

  return { image, xml };
}

function parseAtlas(xml) {
  const frames = [];
  const subTextures = xml.getElementsByTagName("SubTexture");

  for (let st of subTextures) {
    frames.push({
      name: st.getAttribute("name"),
      x: parseInt(st.getAttribute("x")),
      y: parseInt(st.getAttribute("y")),
      w: parseInt(st.getAttribute("width")),
      h: parseInt(st.getAttribute("height"))
    });
  }
  return frames;
}

// Agrupa los frames por animación usando los nombres del XML
async function loadSpriteData() {
  // Boyfriend
  const { image: bfImage, xml: bfXml } = await loadAssets("./sprites/Characters/BOYFRIEND.png", "./sprites/Characters/BOYFRIEND.xml");
  const bfFrames = parseAtlas(bfXml);

  animFrames = {
    idle: bfFrames.filter(f => f.name.startsWith("BF idle dance")),
    left: bfFrames.filter(f => f.name.startsWith("BF NOTE LEFT")),
    right: bfFrames.filter(f => f.name.startsWith("BF NOTE RIGHT")),
    up: bfFrames.filter(f => f.name.startsWith("BF NOTE UP")),
    down: bfFrames.filter(f => f.name.startsWith("BF NOTE DOWN"))
  };

  // Enemy (cambia las rutas y los nombres según tu enemigo)
  const { image: enImage, xml: enXml } = await loadAssets("./sprites/Characters/WhittyCrazy.png", "./sprites/Characters/WhittyCrazy.xml");
  const enFrames = parseAtlas(enXml);

  enemyFrames = {
    idle: enFrames.filter(f => f.name.startsWith("Whitty idle dance")),
    left: enFrames.filter(f => f.name.startsWith("Whitty Sing Note LEFT")),
    right: enFrames.filter(f => f.name.startsWith("whitty sing note right")),
    up: enFrames.filter(f => f.name.startsWith("Whitty Sing Note UP")),
    down: enFrames.filter(f => f.name.startsWith("Whitty Sing Note DOWN"))
  };

  enemyImage = enImage;
  return bfImage;
}

function drawFrame(ctx, image, frame, dx, dy, canvasRef) {
  // Si se pasa un canvas, usa ese, si no usa el global
  const useCanvas = canvasRef || canvas;
  const useCtx = ctx || useCanvas.getContext("2d");
  useCtx.clearRect(0, 0, useCanvas.width, useCanvas.height);

  // Fit contain
  const scale = Math.min(
    useCanvas.width / frame.w,
    useCanvas.height / frame.h
  );
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;
  const drawX = (useCanvas.width - drawW) / 2;
  const drawY = (useCanvas.height - drawH) / 2;

  useCtx.drawImage(
    image,
    frame.x, frame.y, frame.w, frame.h,
    drawX, drawY, drawW, drawH
  );
}

function startSpriteAnim() {
  clearInterval(animTimer);
  animIndex = 0;
  animTimer = setInterval(() => {
    const framesArr = animFrames[currentAnim] || animFrames.idle;
    if (framesArr && framesArr.length > 0) {
      drawFrame(ctx, spriteImage, framesArr[animIndex % framesArr.length], 0, 0, canvas);
      animIndex++;
    }
  }, 45);
}

function startEnemyAnim() {
  clearInterval(enemyTimer);
  enemyIndex = 0;
  enemyTimer = setInterval(() => {
    const framesArr = enemyFrames[enemyAnim] || enemyFrames.idle;
    if (framesArr && framesArr.length > 0) {
      drawFrame(enemyCtx, enemyImage, framesArr[enemyIndex % framesArr.length], 0, 0, enemyCanvas);
      enemyIndex++;
    }
  }, 45);
}

// Función para generar una flecha con velocidad controlada
function spawnArrow(direction, speed) {
  const arrow = document.createElement("div");
  arrow.classList.add("arrow");
  arrow.style.bottom = "0";
  arrow.style.left = positions[direction];
  arrow.dataset.direction = direction;
  switch (direction) {
    case "ArrowLeft":
      arrow.style.backgroundImage = "url('sprites/Arrows/LeftArrow.png')";
      arrow.style.backgroundSize = "contain";
      break;
    case "ArrowUp":
      arrow.style.backgroundImage = "url('sprites/Arrows/UpArrow.png')";
      arrow.style.backgroundSize = "contain";
      break;
    case "ArrowDown":
      arrow.style.backgroundImage = "url('sprites/Arrows/DownArrow.png')";
      arrow.style.backgroundSize = "contain";
      break;
    case "ArrowRight":
      arrow.style.backgroundImage = "url('sprites/Arrows/RightArrow.png')";
      arrow.style.backgroundSize = "contain";
      break;
    default:
      break;
  }
  gameArea.appendChild(arrow);

  let position = 0;
  const interval = setInterval(() => {
    position += speed;
    arrow.style.bottom = position + "px";
    if (position > 650) {
      clearInterval(interval);
      if (gameArea.contains(arrow)) {
        gameArea.removeChild(arrow);
      }
    }
  }, 16);
}

let lastNoteTime = 0;
let lastEnemyNoteTime = 0;

function startGame() {
  startTime = performance.now();

  setTimeout(() => {
    audio1.play();
    audio2.play();
  }, audioDelay);

  const speed = chartData.song.speed * 4 || 1;

const gameLoop = () => {
  const elapsedTime = (performance.now() - startTime) / 1000;

  chartData.song.notes.forEach((section) => {
    // Inicializa sets para notas generadas
    if (!section.generatedPlayerNotes) section.generatedPlayerNotes = new Set();
    if (!section.generatedEnemyNotes) section.generatedEnemyNotes = new Set();

    if (section.mustHitSection) {
      section.sectionNotes.forEach(note => {
        const [noteTime, direction, _] = note;
        const noteTimeInSeconds = noteTime / 1000;
        const noteId = noteTime + '-' + direction;

        if (!section.generatedPlayerNotes.has(noteId) &&
            elapsedTime >= noteTimeInSeconds &&
            elapsedTime < noteTimeInSeconds + 0.2) {
          // Flechas del jugador (direcciones 0-3)
          const arrowDirection = direction === 0 ? "ArrowLeft" :
                                 direction === 1 ? "ArrowUp" :
                                 direction === 2 ? "ArrowDown" :
                                 direction === 3 ? "ArrowRight" : null;
          if (arrowDirection) {
            spawnArrow(arrowDirection, speed);
            section.generatedPlayerNotes.add(noteId);
          }
        }
      });
    } else {
      section.sectionNotes.forEach(note => {
        const [noteTime, direction, _] = note;
        const noteTimeInSeconds = noteTime / 1000;
        const noteId = noteTime + '-' + direction;

        // Flechas del enemigo (direcciones 0-3)
        if (!section.generatedEnemyNotes.has(noteId) &&
            elapsedTime >= noteTimeInSeconds + arrowTravelTime &&
            elapsedTime < noteTimeInSeconds + arrowTravelTime + 0.2) {
          const mappedDirection = direction === 0 ? "left" :
                                  direction === 1 ? "up" :
                                  direction === 2 ? "down" :
                                  direction === 3 ? "right" : null;
          if (mappedDirection) {
            enemyAnim = mappedDirection;
            enemyIndex = 0;
            startEnemyAnim();
            if (enemyIdleTimeout) clearTimeout(enemyIdleTimeout);
            enemyIdleTimeout = setTimeout(() => {
              enemyAnim = "idle";
              enemyIndex = 0;
              startEnemyAnim();
            }, 550);
            section.generatedEnemyNotes.add(noteId);
          }
        }

        // Flechas del jugador (direcciones 4-7)
        if (!section.generatedPlayerNotes.has(noteId) &&
            elapsedTime >= noteTimeInSeconds &&
            elapsedTime < noteTimeInSeconds + 0.2) {
          const arrowDirection = direction === 4 ? "ArrowLeft" :
                                 direction === 5 ? "ArrowUp" :
                                 direction === 6 ? "ArrowDown" :
                                 direction === 7 ? "ArrowRight" : null;
          if (arrowDirection) {
            spawnArrow(arrowDirection, speed);
            section.generatedPlayerNotes.add(noteId);
          }
        }
      });
    }
  });

  requestAnimationFrame(gameLoop);
};

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  let mappedKey = e.key;

  switch (e.key) {
    case 'a':
      mappedKey = 'ArrowLeft';
      break;
    case 'w':
      mappedKey = 'ArrowUp';
      break;
    case 's':
      mappedKey = 'ArrowDown';
      break;
    case 'd':
      mappedKey = 'ArrowRight';
      break;
    default:
      break;
  }

  if (keys[mappedKey]) {
    if (mappedKey === "ArrowLeft") currentAnim = "left";
    else if (mappedKey === "ArrowRight") currentAnim = "right";
    else if (mappedKey === "ArrowUp") currentAnim = "up";
    else if (mappedKey === "ArrowDown") currentAnim = "down";
    animIndex = 0;
    startSpriteAnim();

    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      currentAnim = "idle";
      animIndex = 0;
      startSpriteAnim();
    }, 550);

    const activeArrows = document.querySelectorAll('.arrow');
    activeArrows.forEach(arrow => {
      const arrowRect = arrow.getBoundingClientRect();
      const target = document.getElementById(mappedKey.replace("Arrow", "").toLowerCase());
      const targetRect = target.getBoundingClientRect();

      if (Math.abs(arrowRect.top - targetRect.top) < 40 && arrow.dataset.direction === mappedKey) {
        if (gameArea.contains(arrow)) {
          arrow.remove();
          score += 10;
          console.log(`¡Acierto! Puntuación: ${score}`);
        }
      }
    });
  }
});

button.addEventListener("click", async () => {
  button.disabled = true;

  try {
    chartData = await loadChart('./charts/ballistic.json');
    audio1 = new Audio('./audio/Ballistic/Voices.ogg');
    audio2 = new Audio('./audio/Ballistic/Inst.ogg');
    spriteImage = await loadSpriteData();
    startGame();
    startSpriteAnim();
    startEnemyAnim(); // Inicializa animación del enemigo en idle
  } catch (error) {
    console.error("Error al cargar el juego:", error);
  }
});