// ---------- utils ----------
function $(id) { return document.getElementById(id); }
function isLousa() { return document.body.classList.contains('lousa'); }
function isCelular() { return document.body.classList.contains('celular'); }

function supportsVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
function vibrate(pattern) {
  try { if (supportsVibrate()) navigator.vibrate(pattern); } catch (_) {}
}

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 700);
}

// ---------- connection chip ----------
function setChip(text, ok) {
  const chip = $('connChip');
  if (!chip) return;
  chip.textContent = text;
  chip.style.borderColor = ok ? 'rgba(247,198,0,.55)' : 'rgba(255,255,255,.18)';
}

// ---------- Socket.IO safe init (não quebra se CDN falhar) ----------
function makeNoopSocket() {
  const handlers = {};
  return {
    on: (evt, fn) => { handlers[evt] = fn; },
    emit: () => {},
  };
}

let socket = null;
if (typeof io !== 'undefined') {
  socket = io(); // usa o host atual
} else {
  socket = makeNoopSocket();
  // se cair aqui, é porque nem CDN nem fallback carregou
  setChip('Sem Socket.IO', false);
}

// ---------- socket events ----------
socket.on('connect', () => {
  setChip('Conectado ✅', true);
  if (isCelular()) vibrate([40]);
});

socket.on('disconnect', () => {
  setChip('Sem conexão…', false);
});

// ---------- sound (WebAudio) ----------
function playChime(kind='welcome'){
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    master.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'triangle';

    const base = kind === 'send' ? 440 : 523.25; // A4 or C5
    o1.frequency.setValueAtTime(base, now);
    o2.frequency.setValueAtTime(base * 1.5, now);
    o1.frequency.exponentialRampToValueAtTime(base * 1.26, now + 0.18);
    o2.frequency.exponentialRampToValueAtTime(base * 1.12, now + 0.18);

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0.7;
    g2.gain.value = 0.35;
    o1.connect(g1); o2.connect(g2);
    g1.connect(master); g2.connect(master);

    o1.start(now);
    o2.start(now);
    o1.stop(now + 0.6);
    o2.stop(now + 0.6);

    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 750);
  } catch (_) {}
}

// ---------- QR (com fallback) ----------
function renderQr(url) {
  const qrBox = $('qrcode');
  const label = $('qrUrl');

  const clean = (url || '').replace(/\/$/, '') + '/';
  if (label) label.textContent = clean;

  if (!qrBox) return;

  qrBox.innerHTML = '';

  // fallback: se a lib QRCode não carregou, não quebra a página
  if (typeof QRCode === 'undefined') {
    qrBox.innerHTML = '<div class="small muted">QR indisponível nesta rede. Use o link acima.</div>';
    return;
  }

  new QRCode(qrBox, { text: clean, width: 200, height: 200 });
}

// inicializa QR na lousa
(function initQRCodeIfExists(){
  if (!isLousa()) return;
  const base = (window.PUBLIC_URL || window.location.origin).replace(/\/$/, '');
  renderQr(base + '/');
})();

// ---------- stats UI ----------
function renderStats(s){
  if (!s) return;
  const total = $('totalCount');
  const recent = $('recentList');
  const rank = $('rankList');

  if (total) total.textContent = String(s.total ?? 0);

  if (recent) {
    const arr = Array.isArray(s.recent) ? s.recent : [];
    recent.textContent = arr.length ? arr.join(' • ') : '—';
  }

  if (rank) {
    const top = Array.isArray(s.top) ? s.top : [];
    rank.innerHTML = '';
    if (!top.length) {
      rank.innerHTML = '<li class="muted">—</li>';
      return;
    }
    for (const it of top){
      const li = document.createElement('li');
      li.className = 'rank-item';

      const n = document.createElement('span');
      n.className = 'rank-name';
      n.textContent = it.nome;

      const q = document.createElement('span');
      q.className = 'rank-qtd';
      q.textContent = String(it.qtd);

      li.appendChild(n);
      li.appendChild(q);
      rank.appendChild(li);
    }
  }
}

// ---------- ticker loop ----------
(function initTicker(){
  const track = $('tickerTrack');
  if (!track) return;
  const html = track.innerHTML;
  track.innerHTML = html + html;
})();

// ---------- 3D tilt ----------
(function initTilt(){
  const els = Array.from(document.querySelectorAll('.tilt'));
  if (!els.length) return;

  function apply(el, x, y) {
    const rx = (-y) * 8;
    const ry = (x) * 10;
    el.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  }

  els.forEach(el => {
    const onMove = (clientX, clientY) => {
      const r = el.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * 2 - 1;
      const y = ((clientY - r.top) / r.height) * 2 - 1;
      apply(el, x, y);
    };

    el.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });

    el.addEventListener('touchmove', (e) => {
      if (!e.touches || !e.touches[0]) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    el.addEventListener('touchend', () => { el.style.transform = ''; });
  });
})();

// ---------- background particles ----------
(function initBackground(){
  const c = $('bg');
  if (!c) return;

  // IMPORTANT: evita canvas “roubar” cliques/toques
  try { c.style.pointerEvents = 'none'; } catch (_) {}

  const ctx = c.getContext('2d');
  let w = 0, h = 0, dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize(){
    w = window.innerWidth; h = window.innerHeight;
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const n = isLousa() ? 90 : 65;
  const pts = Array.from({length:n}, () => ({
    x: Math.random()*w,
    y: Math.random()*h,
    vx: (Math.random()-.5) * (isLousa()?0.35:0.25),
    vy: (Math.random()-.5) * (isLousa()?0.35:0.25),
    r: Math.random() * 2.2 + 0.6,
  }));

  function draw(){
    ctx.clearRect(0,0,w,h);

    const t = Date.now()*0.00025;
    const ax = Math.sin(t)*120;
    const ay = Math.cos(t*0.9)*90;

    const g1 = ctx.createRadialGradient(w*0.2+ax, h*0.18+ay, 0, w*0.2+ax, h*0.18+ay, Math.max(w,h)*0.7);
    g1.addColorStop(0, 'rgba(29,92,255,0.18)');
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0,0,w,h);

    const g2 = ctx.createRadialGradient(w*0.85-ax, h*0.22+ay, 0, w*0.85-ax, h*0.22+ay, Math.max(w,h)*0.65);
    g2.addColorStop(0, 'rgba(247,198,0,0.12)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0,0,w,h);

    for (const p of pts){
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = w+20;
      if (p.x > w+20) p.x = -20;
      if (p.y < -20) p.y = h+20;
      if (p.y > h+20) p.y = -20;
    }

    for (let i=0;i<pts.length;i++){
      for (let j=i+1;j<pts.length;j++){
        const a = pts[i], b = pts[j];
        const dx = a.x-b.x, dy = a.y-b.y;
        const dist = Math.hypot(dx,dy);
        const max = isLousa()?130:110;
        if (dist < max){
          const alpha = (1 - dist/max) * 0.25;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          ctx.stroke();
        }
      }
    }

    for (const p of pts){
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  draw();
})();

// ---------- confetti FX ----------
const fx = (function(){
  const c = $('fx');
  if (!c) return { burst: () => {} };

  try { c.style.pointerEvents = 'none'; } catch (_) {}

  const ctx = c.getContext('2d');
  let w=0,h=0,dpr=Math.max(1, window.devicePixelRatio||1);

  function resize(){
    w = window.innerWidth; h = window.innerHeight;
    c.width = Math.floor(w*dpr);
    c.height = Math.floor(h*dpr);
    c.style.width = w+'px'; c.style.height = h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener('resize', resize, { passive:true });

  let pieces = [];
  function step(){
    ctx.clearRect(0,0,w,h);
    const now = Date.now();
    pieces = pieces.filter(p => p.life > now);
    for (const p of pieces){
      p.vy += 0.08;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, (p.life - now) / p.ttl);
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(step);
  }
  step();

  function burst(){
    const colors = ['rgba(247,198,0,0.95)','rgba(255,255,255,0.95)','rgba(29,92,255,0.95)','rgba(255,217,90,0.95)'];
    const cx = w*0.5;
    const cy = isLousa()? h*0.35 : h*0.45;
    const ttl = 2200;
    const now = Date.now();
    const count = isLousa()? 140 : 60;

    for (let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const s = Math.random()*5 + 2.4;
      pieces.push({
        x: cx,
        y: cy,
        vx: Math.cos(a)*s,
        vy: Math.sin(a)*s - 4.5,
        vr: (Math.random()-.5)*0.22,
        rot: Math.random()*Math.PI,
        w: Math.random()*10 + 6,
        h: Math.random()*6 + 4,
        color: colors[Math.floor(Math.random()*colors.length)],
        ttl,
        life: now + ttl
      });
    }
  }

  return { burst };
})();

// ---------- behaviors ----------
function enviarCelular(){
  const inp = $('nomeCelular');
  const nome = (inp ? inp.value : '').trim();

  if (!nome) {
    shake(inp);
    return;
  }

  socket.emit('novo_responsavel', { nome });

  vibrate([120, 60, 120]);
  shake($('phoneFrame'));
  fx.burst();
  playChime('send');

  const btn = $('btnEnviar');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.85'; }

  const st = $('statusText');
  if (st) st.textContent = 'Enviado! Olhe para a lousa 😄';

  if (inp) { inp.value = ''; inp.placeholder = 'Pronto! Obrigado 😊'; }

  setTimeout(() => {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    if (st) st.textContent = 'Digite seu nome e confirme.';
    if (inp) inp.placeholder = 'Ex: Ana, pai do João';
  }, 2000);
}
window.enviarCelular = enviarCelular;

let overlayTimer = null;
function showWelcome(nome){
  const overlay = $('overlay');
  const nameEl = $('nomeNaLousa');
  const cd = $('countdown');

  if (overlay && nameEl) {
    nameEl.textContent = nome;
    overlay.classList.remove('hidden');
    fx.burst();
    shake($('overlayCard'));
    playChime('welcome');

    overlay.classList.add('portal-on');
    setTimeout(() => overlay.classList.remove('portal-on'), 1300);
  }

  if (overlayTimer) clearInterval(overlayTimer);
  let t = 12;
  if (cd) cd.textContent = `Voltando em ${t}s…`;

  overlayTimer = setInterval(() => {
    t -= 1;
    if (cd) cd.textContent = `Voltando em ${t}s…`;
    if (t <= 0) {
      clearInterval(overlayTimer);
      if (overlay) overlay.classList.add('hidden');
    }
  }, 1000);
}

socket.on('atualizar_lousa', (data) => {
  if (!data || !data.nome) return;

  if (isCelular()) {
    vibrate([50, 40, 50]);
    shake($('phoneFrame'));
  }

  if (isLousa()) {
    showWelcome(data.nome);
  }
});

socket.on('stats_update', (s) => {
  if (isLousa()) renderStats(s);
});

// ---------- extra: foco do input no celular (se existir) ----------
(function mobileFocusFix(){
  if (!isCelular()) return;
  const inp = $('nomeCelular');
  const frame = $('phoneFrame') || document.body;
  if (!inp) return;

  frame.addEventListener('click', () => inp.focus());
  frame.addEventListener('touchstart', () => inp.focus(), { passive: true });
})();

// ---------- subtle shake on celular ----------
if (isCelular()) {
  setInterval(() => shake($('phoneFrame')), 7000);
}
