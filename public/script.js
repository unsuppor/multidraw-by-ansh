/* script.js - Neon MultiDraw client
   Requires /socket.io/socket.io.js provided by server
*/
const socket = io(); // same-origin

// UI elements
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d', { alpha: false });
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const bgColor = document.getElementById('bgColor');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const toolbox = document.getElementById('toolbox');
const toolBtns = Array.from(document.querySelectorAll('.tool-btn'));
const messages = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const nameInput = document.getElementById('nameInput');
const msgInput = document.getElementById('msgInput');

// state
let tool = 'brush';
let drawing = false;
let last = null;
let color = colorPicker.value || '#ff2d55';
let size = parseInt(brushSize.value || 8, 10);
let bg = bgColor.value || '#0a0a0a';

// hi-dpi canvas
function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // redraw background fill
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,canvas.width/dpr,canvas.height/dpr);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// helpers
function setTool(t){
  tool = t;
  toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === t));
}
function getPosFromEvent(e){
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches[0]) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  if (e.changedTouches && e.changedTouches[0]) {
    return { x: e.changedTouches[0].clientX - rect.left, y: e.changedTouches[0].clientY - rect.top };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// smooth drawing (simple interpolation)
function drawLineLocal(x0,y0,x1,y1, col, sz){
  ctx.strokeStyle = col;
  ctx.lineWidth = sz;
  ctx.beginPath();
  ctx.moveTo(x0,y0);
  ctx.lineTo(x1,y1);
  ctx.stroke();
  ctx.closePath();
}

// flood fill (BFS) — basic but works for solid-color fills
function floodFill(x, y, fillColorHex){
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0,0,w, h);
  const data = imgData.data;
  const targetX = Math.floor(x * dpr);
  const targetY = Math.floor(y * dpr);
  const startIdx = (targetY * w + targetX) * 4;
  const startR = data[startIdx], startG = data[startIdx+1], startB = data[startIdx+2], startA = data[startIdx+3];
  const fill = hexToRgba(fillColorHex);
  // if same color -> nothing
  if (startR === fill.r && startG === fill.g && startB === fill.b && startA === fill.a) return;
  const stack = [[targetX, targetY]];
  const visited = new Uint8Array(w * h);
  while (stack.length){
    const [cx, cy] = stack.pop();
    const idx = (cy * w + cx);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    if (visited[idx]) continue;
    const i = idx * 4;
    if (data[i] === startR && data[i+1] === startG && data[i+2] === startB && data[i+3] === startA){
      data[i] = fill.r; data[i+1] = fill.g; data[i+2] = fill.b; data[i+3] = fill.a;
      visited[idx] = 1;
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
function hexToRgba(hex){
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.slice(0,2),16);
  const g = parseInt(hex.slice(2,4),16);
  const b = parseInt(hex.slice(4,6),16);
  return { r, g, b, a: 255 };
}

// send stroke to server
function emitStroke(x0,y0,x1,y1,col,sz){
  socket.emit('draw', { x0,y0,x1,y1, color: col, size: sz });
}

// events — pointer (mouse) & touch
canvas.addEventListener('mousedown', (e)=>{
  const p = getPosFromEvent(e);
  last = p;
  if (tool === 'fill'){
    floodFill(p.x, p.y, color);
    socket.emit('fill', { x: p.x, y: p.y, color });
    return;
  }
  drawing = true;
});
window.addEventListener('mouseup', ()=> drawing = false);

canvas.addEventListener('mousemove', (e)=>{
  if (!drawing) return;
  const p = getPosFromEvent(e);
  const col = tool === 'eraser' ? bg : color;
  drawLineLocal(last.x, last.y, p.x, p.y, col, size);
  emitStroke(last.x, last.y, p.x, p.y, col, size);
  last = p;
});

// touch
canvas.addEventListener('touchstart', (e)=>{
  e.preventDefault();
  const p = getPosFromEvent(e);
  last = p;
  if (tool === 'fill'){
    floodFill(p.x, p.y, color);
    socket.emit('fill', { x: p.x, y: p.y, color });
    return;
  }
  drawing = true;
}, { passive:false });

canvas.addEventListener('touchmove', (e)=>{
  e.preventDefault();
  if (!drawing) return;
  const p = getPosFromEvent(e);
  const col = tool === 'eraser' ? bg : color;
  drawLineLocal(last.x, last.y, p.x, p.y, col, size);
  emitStroke(last.x, last.y, p.x, p.y, col, size);
  last = p;
}, { passive:false });
window.addEventListener('touchend', ()=> drawing = false);

// tool buttons
toolBtns.forEach(btn=>{
  btn.addEventListener('click', ()=> setTool(btn.dataset.tool));
});
function setTool(t){
  tool = t;
  toolBtns.forEach(b=>b.classList.toggle('active', b.dataset.tool === t));
}

// UI listeners
colorPicker.addEventListener('input',(e)=> color = e.target.value);
brushSize.addEventListener('input',(e)=> size = parseInt(e.target.value,10) || 4);
bgColor.addEventListener('input',(e)=>{
  bg = e.target.value;
  // fill bg by drawing behind (clear then fill)
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
  socket.emit('bg', { color: bg });
});
clearBtn.addEventListener('click', ()=>{
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
  socket.emit('clear');
});
downloadBtn.addEventListener('click', ()=>{
  const link = document.createElement('a');
  link.download = 'multidraw.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Socket handlers
socket.on('draw', (d)=>{
  drawLineLocal(d.x0, d.y0, d.x1, d.y1, d.color, d.size);
});
socket.on('clear', ()=>{
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
});
socket.on('bg', (d)=>{
  bg = d.color;
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
});
socket.on('fill', (d)=>{
  floodFill(d.x, d.y, d.color);
});

// Chat
chatForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = (nameInput.value||'Anonymous').trim().slice(0,18);
  const text = (msgInput.value||'').trim();
  if (!text) return;
  socket.emit('chat', { name, text });
  msgInput.value = '';
});
socket.on('chat', (m)=>{
  const el = document.createElement('div');
  el.className = 'msg';
  el.innerHTML = `<span class="who">${escapeHtml(m.name)}</span><span class="what">${escapeHtml(m.text)}</span>`;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
});

// escape
function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }

// keyboard shortcuts
window.addEventListener('keydown',(e)=>{
  if (e.key === 'b' || e.key === 'B') setTool('brush');
  if (e.key === 'e' || e.key === 'E') setTool('eraser');
  if (e.key === 'f' || e.key === 'F') setTool('fill');
});

// initial background fill
ctx.fillStyle = bg;
ctx.fillRect(0,0,canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
