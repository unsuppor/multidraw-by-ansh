/* script.js - optimized, FAB + chat bubble */
const socket = io();

// DOM
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d', { alpha: false });

const fab = document.getElementById('fab');
const toolPanel = document.getElementById('toolPanel');
const toolBtns = [...document.querySelectorAll('.tool-btn')];
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const bgColor = document.getElementById('bgColor');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

const chatBubble = document.getElementById('chatBubble');
const chatPanel = document.getElementById('chatPanel');
const messages = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const nameInput = document.getElementById('nameInput');
const msgInput = document.getElementById('msgInput');

// state
let tool = 'brush';
let color = colorPicker.value || '#ff2d55';
let size = parseInt(brushSize.value) || 8;
let bg = bgColor.value || '#0a0a0a';
let drawing = false;
let last = null;

// performance: throttle socket emits (ms)
const EMIT_THROTTLE_MS = 24; // ~40fps max emissions
let lastEmit = 0;

// Hi DPI canvas sizing
function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,w,h);
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
  if (e.touches && e.touches[0]){
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  if (e.changedTouches && e.changedTouches[0]){
    return { x: e.changedTouches[0].clientX - rect.left, y: e.changedTouches[0].clientY - rect.top };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function drawLocal(x0,y0,x1,y1,col,sz){
  ctx.strokeStyle = col;
  ctx.lineWidth = sz;
  ctx.beginPath();
  ctx.moveTo(x0,y0);
  ctx.lineTo(x1,y1);
  ctx.stroke();
  ctx.closePath();
}

// Flood fill (simple)
function hexToRGBA(hex){
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.substring(0,2),16);
  const g = parseInt(hex.substring(2,4),16);
  const b = parseInt(hex.substring(4,6),16);
  return {r,g,b,a:255};
}
function floodFill(x,y,fillHex){
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width;
  const H = canvas.height;
  const img = ctx.getImageData(0,0,W,H);
  const data = img.data;
  const tx = Math.floor(x * dpr);
  const ty = Math.floor(y * dpr);
  const startIndex = (ty * W + tx) * 4;
  const sr = data[startIndex], sg = data[startIndex+1], sb = data[startIndex+2], sa = data[startIndex+3];
  const fill = hexToRGBA(fillHex);
  if (sr === fill.r && sg === fill.g && sb === fill.b) return;
  const stack = [[tx,ty]];
  const visited = new Uint8Array(W * H);
  while(stack.length){
    const [cx,cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
    const idx = cy * W + cx;
    if (visited[idx]) continue;
    const i = idx * 4;
    if (data[i] === sr && data[i+1] === sg && data[i+2] === sb && data[i+3] === sa){
      data[i] = fill.r; data[i+1] = fill.g; data[i+2] = fill.b; data[i+3] = 255;
      visited[idx] = 1;
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
  }
  ctx.putImageData(img,0,0);
}

// emit stroke (throttled)
function emitStroke(x0,y0,x1,y1,col,sz){
  const now = performance.now();
  if (now - lastEmit >= EMIT_THROTTLE_MS){
    socket.emit('draw', { x0,y0,x1,y1, color: col, size: sz });
    lastEmit = now;
  } else {
    // send anyway but slightly throttled - optional: buffer for future improvements
    socket.emit('draw', { x0,y0,x1,y1, color: col, size: sz });
  }
}

// pointer handlers (use rAF to smooth)
let pending = null;
function pointerDown(e){
  e.preventDefault();
  const p = getPosFromEvent(e);
  last = p;
  if (tool === 'fill'){
    floodFill(p.x, p.y, color);
    socket.emit('fill', { x: p.x, y: p.y, color });
    return;
  }
  drawing = true;
}
function pointerMove(e){
  if (!drawing) return;
  const p = getPosFromEvent(e);
  const col = (tool === 'eraser') ? bg : color;
  // draw instantly
  drawLocal(last.x, last.y, p.x, p.y, col, size);
  emitStroke(last.x, last.y, p.x, p.y, col, size);
  last = p;
}
function pointerUp(e){
  drawing = false;
}

canvas.addEventListener('mousedown', pointerDown);
canvas.addEventListener('mousemove', pointerMove);
window.addEventListener('mouseup', pointerUp);
canvas.addEventListener('touchstart', pointerDown, { passive:false });
canvas.addEventListener('touchmove', pointerMove, { passive:false });
window.addEventListener('touchend', pointerUp);

// UI wiring
toolBtns.forEach(b=>{
  b.addEventListener('click', ()=> setTool(b.dataset.tool));
});
function setTool(t){
  tool = t;
  toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === t));
}
colorPicker.addEventListener('input', e=> color = e.target.value);
brushSize.addEventListener('input', e=> size = parseInt(e.target.value) || 4);
bgColor.addEventListener('input', e=>{
  bg = e.target.value;
  // fill behind everything and notify
  const w = window.innerWidth, h = window.innerHeight;
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,w,h);
  socket.emit('bg', { color: bg });
});
clearBtn.addEventListener('click', ()=>{
  const w = window.innerWidth, h = window.innerHeight;
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,w,h);
  socket.emit('clear');
});
downloadBtn.addEventListener('click', ()=>{
  const link = document.createElement('a');
  link.download = 'ansh_drawing.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// FAB toggle tool panel
fab.addEventListener('click', ()=>{
  const visible = toolPanel.classList.toggle('panel-visible');
  toolPanel.classList.toggle('panel-hidden', !visible);
  toolPanel.setAttribute('aria-hidden', String(!visible));
});

// chat bubble toggle
chatBubble.addEventListener('click', ()=>{
  const show = chatPanel.classList.toggle('panel-visible');
  chatPanel.classList.toggle('panel-hidden', !show);
  chatPanel.setAttribute('aria-hidden', String(!show));
});

// keyboard shortcuts
window.addEventListener('keydown', (e)=>{
  if (e.key==='b' || e.key==='B') setTool('brush');
  if (e.key==='e' || e.key==='E') setTool('eraser');
  if (e.key==='f' || e.key==='F') setTool('fill');
});

// Socket handlers
socket.on('draw', d=>{
  drawLocal(d.x0, d.y0, d.x1, d.y1, d.color, d.size);
});
socket.on('clear', ()=>{
  const w = window.innerWidth, h = window.innerHeight;
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,w,h);
});
socket.on('bg', d=>{
  bg = d.color;
  const w = window.innerWidth, h = window.innerHeight;
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,w,h);
});
socket.on('fill', d=>{
  floodFill(d.x, d.y, d.color);
});

// Chat
chatForm.addEventListener('submit', e=>{
  e.preventDefault();
  const name = (nameInput.value || 'Anonymous').trim().slice(0,18);
  const text = (msgInput.value || '').trim();
  if (!text) return;
  socket.emit('chat', { name, text });
  msgInput.value = '';
});
socket.on('chat', m=>{
  const el = document.createElement('div');
  el.className = 'msg';
  el.innerHTML = `<span class="who">${escape(m.name)}</span> ${escape(m.text)}`;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
});

// util escape
function escape(s){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}

// initial fill
ctx.fillStyle = bg;
ctx.fillRect(0,0,window.innerWidth, window.innerHeight);

// helpful connect log
socket.on('connect', ()=> console.log('socket connected', socket.id));
socket.on('connect_error', err=> console.warn('socket conn error', err));
