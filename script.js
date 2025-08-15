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
let audioDelay = 1380; // Retraso en milisegundos (2 segundos)
let currentAnim = "idle";
let animFrames = {};
let animIndex = 0;
let animTimer;
let idleTimeout = null;

// Spritesheet variables
let spriteImage;
let canvas = document.getElementById("gameCanvas");
let ctx = canvas.getContext("2d");

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
  const { image, xml } = await loadAssets("./sprites/Characters/BOYFRIEND.png", "./sprites/Characters/BOYFRIEND.xml");
  const frames = parseAtlas(xml);

  animFrames = {
    idle: frames.filter(f => f.name.startsWith("BF idle dance")),
    left: frames.filter(f => f.name.startsWith("BF NOTE LEFT")),
    right: frames.filter(f => f.name.startsWith("BF NOTE RIGHT")),
    up: frames.filter(f => f.name.startsWith("BF NOTE UP")),
    down: frames.filter(f => f.name.startsWith("BF NOTE DOWN"))
  };

  return image;
}

function drawFrame(ctx, image, frame, dx, dy) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calcula el escalado para que el frame quepa en el canvas (fit contain)
  const scale = Math.min(
    canvas.width / frame.w,
    canvas.height / frame.h
  );
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;
  const drawX = (canvas.width - drawW) / 2;
  const drawY = (canvas.height - drawH) / 2;

  ctx.drawImage(
    image,
    frame.x, frame.y, frame.w, frame.h, // origen en spritesheet
    drawX, drawY, drawW, drawH          // destino en pantalla (centrado y escalado)
  );
}

function startSpriteAnim() {
  clearInterval(animTimer);
  animIndex = 0;
  animTimer = setInterval(() => {
    const framesArr = animFrames[currentAnim] || animFrames.idle;
    if (framesArr && framesArr.length > 0) {
      drawFrame(ctx, spriteImage, framesArr[animIndex % framesArr.length], 0, 0);
      animIndex++;
    }
  }, 45); // Animación más fluida (16ms = 60fps, 60ms = ~16fps)
}

// Función para generar una flecha con velocidad controlada
function spawnArrow(direction, speed) {
  const arrow = document.createElement("div");
  arrow.classList.add("arrow");
  arrow.style.bottom = "0"; // Empieza desde abajo
  arrow.style.left = positions[direction]; // Posición horizontal exacta
  arrow.dataset.direction = direction; // Guardar dirección como atributo
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

  // Animar la flecha hacia arriba
  let position = 0;
  const interval = setInterval(() => {
    position += speed; // Usar la velocidad en lugar de un valor fijo
    arrow.style.bottom = position + "px";
    if (position > 450) { // Si pasa el área de los targets
      clearInterval(interval);
      if (gameArea.contains(arrow)) {
        gameArea.removeChild(arrow);
      }
    }
  }, 16);
}

let lastNoteTime = 0;  // Variable para controlar el tiempo de la última nota generada

function startGame() {
  startTime = performance.now(); // Guardar el momento de inicio

  // Retrasar el inicio del audio
  setTimeout(() => {
    audio1.play(); // Reproducir el audio después del retraso
    audio2.play();
  }, audioDelay);

  // Obtener la velocidad desde el JSON
  const speed = chartData.song.speed * 2.4 || 1; // Valor por defecto es 1 si no se especifica

  const gameLoop = () => {
    const elapsedTime = (performance.now() - startTime) / 1000; // Tiempo en segundos

    // Recorrer todas las secciones de notas
    chartData.song.notes.forEach((section) => {
      // Solo procesamos las secciones "mustHitSection" == true
      if (section.mustHitSection) {
        // Buscar notas para esta sección
        section.sectionNotes.forEach(note => {
          const [noteTime, direction, _] = note; // Ignorar el tercer valor de la nota

          const noteTimeInSeconds = noteTime / 1000;

          // Solo genera la flecha si el tiempo es diferente al último
          if (elapsedTime >= noteTimeInSeconds && elapsedTime < noteTimeInSeconds + 0.1 && Math.abs(noteTimeInSeconds - lastNoteTime) > 0.1) {
            // Mapeo de dirección: 0 = ArrowLeft, 1 = ArrowUp, 2 = ArrowDown, 3 = ArrowRight
            const arrowDirection = direction === 0 ? "ArrowLeft" :
              direction === 1 ? "ArrowUp" :
                direction === 2 ? "ArrowDown" :
                  direction === 3 ? "ArrowRight" : null;
            if (arrowDirection) {
              spawnArrow(arrowDirection, speed); // Pasar el parámetro de velocidad a spawnArrow
              lastNoteTime = noteTimeInSeconds; // Actualizar el tiempo de la última nota generada
            }
          }
        });
      }

      // Sincronizar las notas de la sección "false" solo si el segundo valor está entre 4 y 7
      if (!section.mustHitSection) {
        // Buscar notas para esta sección
        section.sectionNotes.forEach(note => {
          const [noteTime, direction, _] = note; // Ignorar el tercer valor de la nota

          const noteTimeInSeconds = noteTime / 1000;

          // Verificar si el segundo valor de la dirección está entre 4 y 7
          if (direction >= 4 && direction <= 7 && elapsedTime >= noteTimeInSeconds && elapsedTime < noteTimeInSeconds + 0.1 && Math.abs(noteTimeInSeconds - lastNoteTime) > 0.1) {
            // Mapeo de dirección: 4 -> 0 (ArrowLeft), 5 -> 1 (ArrowUp), 6 -> 2 (ArrowDown), 7 -> 3 (ArrowRight)
            const mappedDirection = direction === 4 ? "ArrowLeft" :
              direction === 5 ? "ArrowUp" :
                direction === 6 ? "ArrowDown" :
                  direction === 7 ? "ArrowRight" : null;

            // Solo genera la flecha si el tiempo es el adecuado
            if (mappedDirection) {
              const arrowDirection = mappedDirection;
              spawnArrow(arrowDirection, speed); // Generar la flecha correspondiente
              lastNoteTime = noteTimeInSeconds; // Actualizar el tiempo de la última nota generada
            }
          }
        });
      }
    });

    requestAnimationFrame(gameLoop); // Continuar el bucle del juego
  };

  requestAnimationFrame(gameLoop);
}

// Animación del sprite al presionar flecha
window.addEventListener("keydown", (e) => {
  let mappedKey = e.key;

  // Mapear las teclas 'wasd' a las flechas
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

  // Verifica si la tecla es una flecha y procesar las colisiones
  if (keys[mappedKey]) {
    // Cambia la animación del sprite
    if (mappedKey === "ArrowLeft") currentAnim = "left";
    else if (mappedKey === "ArrowRight") currentAnim = "right";
    else if (mappedKey === "ArrowUp") currentAnim = "up";
    else if (mappedKey === "ArrowDown") currentAnim = "down";
    animIndex = 0;
    startSpriteAnim();
    
    // Reinicia el temporizador idle
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      currentAnim = "idle";
      animIndex = 0;
      startSpriteAnim();
    }, 550);

    // Procesa las flechas activas
    const activeArrows = document.querySelectorAll('.arrow');
    activeArrows.forEach(arrow => {
      const arrowRect = arrow.getBoundingClientRect();
      const target = document.getElementById(mappedKey.replace("Arrow", "").toLowerCase());
      const targetRect = target.getBoundingClientRect();

      // Comprobar si la flecha está cerca del target y coincide la dirección
      if (Math.abs(arrowRect.top - targetRect.top) < 30 && arrow.dataset.direction === mappedKey) {
        if (gameArea.contains(arrow)) {
          arrow.remove(); // Eliminar flecha si coincide
          score += 10;
          console.log(`¡Acierto! Puntuación: ${score}`);
        }
      }
    });
  }
});

// Inicializar el juego al hacer clic en el botón
button.addEventListener("click", async () => {
  button.disabled = true; // Desactiva el botón para evitar múltiples juegos

  try {
    chartData = await loadChart('./charts/testWhitty.json'); // Cargar el chart
    audio1 = new Audio('./audio/Voices.ogg'); // Cargar la canción
    audio2 = new Audio('./audio/Inst.ogg'); // Cargar la canción
    spriteImage = await loadSpriteData(); // Cargar sprites y animaciones
    startGame(); // Iniciar el juego
    startSpriteAnim(); // Animación idle inicial
  } catch (error) {
    console.error("Error al cargar el juego:", error);
  }
});