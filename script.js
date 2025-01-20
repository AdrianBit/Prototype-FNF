const button = document.getElementById("start");
const gameArea = document.getElementById("gameArea");
const keys = { ArrowLeft: "←", ArrowUp: "↑", ArrowDown: "↓", ArrowRight: "→" };
const positions = {
  ArrowLeft: "4%",
  ArrowUp: "54%",
  ArrowDown: "29%",
  ArrowRight: "79%"
};
let score = 0;
let startTime;
let chartData;
let audio1;
let audio2;
let audioDelay = 2000; // Retraso en milisegundos (2 segundos)

// Función para cargar un archivo JSON
async function loadChart(filePath) {
  const response = await fetch(filePath);
  if (!response.ok) throw new Error(`Error al cargar el archivo: ${response.statusText}`);
  return await response.json();
}

// Función para generar una flecha con velocidad controlada
function spawnArrow(direction, speed) {
  const arrow = document.createElement("div");
  arrow.classList.add("arrow");
  arrow.textContent = keys[direction];
  arrow.style.bottom = "0"; // Empieza desde abajo
  arrow.style.left = positions[direction]; // Posición horizontal exacta
  arrow.dataset.direction = direction; // Guardar dirección como atributo
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
  const speed = chartData.song.speed*1.7 || 1; // Valor por defecto es 1 si no se especifica

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

// Detectar entrada del teclado y verificar colisión con los targets
window.addEventListener("keydown", (e) => {
  if (keys[e.key]) {
    const activeArrows = document.querySelectorAll('.arrow');
    activeArrows.forEach(arrow => {
      const arrowRect = arrow.getBoundingClientRect();
      const target = document.getElementById(e.key.replace("Arrow", "").toLowerCase());
      const targetRect = target.getBoundingClientRect();

      // Comprobar si la flecha está cerca del target y coincide la dirección
      if (Math.abs(arrowRect.top - targetRect.top) < 30 && arrow.dataset.direction === e.key) {
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
    startGame(); // Iniciar el juego
  } catch (error) {
    console.error("Error al cargar el juego:", error);
  }
});
