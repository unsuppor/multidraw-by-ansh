const socket = io();

// Canvas setup
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Tools
let drawing = false;
let last = { x: 0, y: 0 };
let color = "#000000";
let brush = 4;
let erasing = false;

// UI elements
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const eraserBtn = document.getElementById("eraser");
const clearBtn = document.getElementById("clear");

// Update tool values
colorPicker.onchange = (e) => {
  color = e.target.value;
  erasing = false;
};

brushSize.oninput = (e) => {
  brush = e.target.value;
};

eraserBtn.onclick = () => {
  erasing = true;
};

clearBtn.onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit("clear");
};

// Draw line function
function drawLine(x0, y0, x1, y1, col, size, emit=false) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = col;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.closePath();

  if (emit) {
    socket.emit("draw", {
      x0, y0, x1, y1,
      color: col,
      size: size
    });
  }
}

/* ------------------ Mouse Events ------------------ */
canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  last = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("mouseup", () => drawing = false);

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const col = erasing ? "#ffffff" : color;
  drawLine(last.x, last.y, e.clientX, e.clientY, col, brush, true);
  last = { x: e.clientX, y: e.clientY };
});

/* ------------------ Touch Events (Phones / iPad) ------------------ */
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  drawing = true;
  const t = e.touches[0];
  last = { x: t.clientX, y: t.clientY };
});

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!drawing) return;
  const t = e.touches[0];
  const col = erasing ? "#ffffff" : color;
  drawLine(last.x, last.y, t.clientX, t.clientY, col, brush, true);
  last = { x: t.clientX, y: t.clientY };
});

canvas.addEventListener("touchend", () => {
  drawing = false;
});

/* ------------------ Socket.IO events ------------------ */
socket.on("draw", (data) => {
  drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
});

socket.on("clear", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
