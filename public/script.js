const socket = io();

// Canvas setup
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let last = { x: 0, y: 0 };

// Draw line function
function drawLine(x0, y0, x1, y1, emit=false) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.closePath();

  // send to server
  if (emit) {
    socket.emit("draw", { x0, y0, x1, y1 });
  }
}

canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  last = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("mouseup", () => drawing = false);

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;

  drawLine(last.x, last.y, e.clientX, e.clientY, true);
  last = { x: e.clientX, y: e.clientY };
});

// Receive strokes from server
socket.on("draw", (data) => {
  drawLine(data.x0, data.y0, data.x1, data.y1);
});
