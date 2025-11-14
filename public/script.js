const socket = io();

// UI elements
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d", { alpha: false });

const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const bgColor = document.getElementById("bgColor");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

const toolBtns = [...document.querySelectorAll(".tool-btn")];

const messages = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const nameInput = document.getElementById("nameInput");
const msgInput = document.getElementById("msgInput");

// state
let drawing = false;
let last = null;
let tool = "brush";
let color = colorPicker.value;
let size = parseInt(brushSize.value);
let bg = bgColor.value;

// resize canvas
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// helpers
function setTool(t) {
  tool = t;
  toolBtns.forEach((b) => b.classList.toggle("active", b.dataset.tool === t));
}

function getPos(e) {
  let rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches[0]) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top,
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function drawLocal(x0, y0, x1, y1, col, sz) {
  ctx.strokeStyle = col;
  ctx.lineWidth = sz;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

// flood fill
function floodFill(x, y, fillColor) {
  const w = canvas.width;
  const h = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  let cx = Math.floor(x * dpr);
  let cy = Math.floor(y * dpr);

  let idx = (cy * w + cx) * 4;
  let startR = data[idx],
    startG = data[idx + 1],
    startB = data[idx + 2],
    startA = data[idx + 3];

  let fill = hexToRGB(fillColor);
  if (
    fill.r === startR &&
    fill.g === startG &&
    fill.b === startB
  )
    return;

  let stack = [[cx, cy]];
  while (stack.length) {
    let [px, py] = stack.pop();
    if (px < 0 || py < 0 || px >= w || py >= h) continue;

    let i = (py * w + px) * 4;
    if (
      data[i] === startR &&
      data[i + 1] === startG &&
      data[i + 2] === startB
    ) {
      data[i] = fill.r;
      data[i + 1] = fill.g;
      data[i + 2] = fill.b;
      data[i + 3] = 255;

      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  }

  ctx.putImageData(img, 0, 0);
}

function hexToRGB(hex) {
  hex = hex.replace("#", "");
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

// pointer events
function pointerDown(e) {
  const p = getPos(e);
  last = p;

  if (tool === "fill") {
    floodFill(p.x, p.y, color);
    socket.emit("fill", { x: p.x, y: p.y, color });
    return;
  }
  drawing = true;
}

function pointerMove(e) {
  if (!drawing) return;
  const p = getPos(e);
  const col = tool === "eraser" ? bg : color;
  drawLocal(last.x, last.y, p.x, p.y, col, size);
  socket.emit("draw", {
    x0: last.x,
    y0: last.y,
    x1: p.x,
    y1: p.y,
    color: col,
    size: size,
  });
  last = p;
}

function pointerUp() {
  drawing = false;
}

canvas.addEventListener("mousedown", pointerDown);
canvas.addEventListener("mousemove", pointerMove);
window.addEventListener("mouseup", pointerUp);

canvas.addEventListener("touchstart", pointerDown, { passive: false });
canvas.addEventListener("touchmove", pointerMove, { passive: false });
window.addEventListener("touchend", pointerUp);

// tool changes
toolBtns.forEach((b) =>
  b.addEventListener("click", () => setTool(b.dataset.tool))
);

colorPicker.addEventListener("input", (e) => (color = e.target.value));
brushSize.addEventListener("input", (e) => (size = parseInt(e.target.value)));
bgColor.addEventListener("input", (e) => {
  bg = e.target.value;
  resizeCanvas();
  socket.emit("bg", { color: bg });
});

clearBtn.addEventListener("click", () => {
  resizeCanvas();
  socket.emit("clear");
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "ansh_drawing.png";
  link.href = canvas.toDataURL();
  link.click();
});

// incoming events
socket.on("draw", (d) => {
  drawLocal(d.x0, d.y0, d.x1, d.y1, d.color, d.size);
});

socket.on("clear", () => {
  resizeCanvas();
});

socket.on("bg", (d) => {
  bg = d.color;
  resizeCanvas();
});

socket.on("fill", (d) => {
  floodFill(d.x, d.y, d.color);
});

// CHAT
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim() || "Anonymous";
  const msg = msgInput.value.trim();
  if (!msg) return;
  socket.emit("chat", { name, text: msg });
  msgInput.value = "";
});

socket.on("chat", (m) => {
  const el = document.createElement("div");
  el.className = "msg";
  el.innerHTML = `<span class="who">${escape(m.name)}:</span> ${escape(
    m.text
  )}`;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
});

function escape(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
