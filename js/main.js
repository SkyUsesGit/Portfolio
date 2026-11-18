(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;

  /* ================= SCROLL DIRECTION + VELOCITY ================= */
  let lastY = scrollY, dir = 'down', kick = 0;
  addEventListener('scroll', () => {
    const dy = scrollY - lastY; lastY = scrollY;
    if (Math.abs(dy) > 0.5) dir = dy < 0 ? 'up' : 'down';
    kick = Math.max(-260, Math.min(260, kick + dy * 2.2));
  }, { passive: true });

  /* ================= SWARM OF MULTI-USER CURSORS ================= */
  const canvas = document.getElementById('swarm');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); addEventListener('resize', resize);

  const mouse = { x: W / 2, y: H / 2, last: 0 };
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.last = performance.now(); }, { passive: true });

  const NAMES = ['ROBO', 'GUITAR', 'PYTHON', 'ARDUINO', 'C', 'GIT', 'CSS'];
  const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#3aa0ff', '#af52de', '#ff9500', '#00d4c8'];
  const arrow = new Path2D('M0 0 L0 17 L4.6 12.6 L8 20 L10.6 18.9 L7.2 11.6 L13 11.6 Z');
  const agents = NAMES.map((n, i) => ({
    name: n, color: COLORS[i], x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, job: null, ph: Math.random() * 10
  }));

  // rebuild jobs steer a few agents to the corners of the element being drawn
  function sendAgents(el, count, d) {
    const picks = agents.slice().sort((a, b) => (a.job ? 1 : 0) - (b.job ? 1 : 0)).slice(0, count);
    picks.forEach((a, i) => {
      a.job = { el, corner: i % 4, until: performance.now() + 1300 };
      // scrolling up: agents swoop in from above the screen
      if (d === 'up') { a.y = -40 - Math.random() * 120; a.x = Math.random() * W; a.vy = 0; }
    });
  }

  function target(a, i, t) {
    let g;
    if (a.job) {
      if (t > a.job.until) a.job = null;
      else {
        const r = a.job.el.getBoundingClientRect();
        const c = a.job.corner;
        return { x: c === 1 || c === 2 ? r.right : r.left, y: c >= 2 ? r.bottom + (c === 2 ? 14 : 0) : r.top, k: 0.13 };
      }
    }
    if (fine && t - mouse.last < 3000) {
      const ang = t / 900 + i * (6.283 / agents.length);
      const rad = 46 + (i % 3) * 22;
      g = { x: mouse.x + Math.cos(ang) * rad, y: mouse.y + Math.sin(ang) * rad, k: 0.05 + i * 0.004 };
    } else {
      const s = t / 4000 + a.ph;
      g = { x: W * (0.5 + 0.42 * Math.sin(s * 1.1 + i)), y: H * (0.5 + 0.38 * Math.sin(s * 0.8 + i * 1.7)), k: 0.015 };
    }
    // streak behind the scroll direction
    g.y += -kick * (0.5 + i * 0.08);
    g.k += Math.min(Math.abs(kick) / 1500, 0.08);
    return g;
  }

  function tick(t) {
    requestAnimationFrame(tick);
    kick *= 0.9;
    if (reduce) return;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '700 10px "JetBrains Mono", monospace';
    agents.forEach((a, i) => {
      const g = target(a, i, t);
      a.vx = (a.vx + (g.x - a.x) * g.k) * 0.78;
      a.vy = (a.vy + (g.y - a.y) * g.k) * 0.78;
      a.x += a.vx; a.y += a.vy;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.fillStyle = a.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
      ctx.fill(arrow); ctx.stroke(arrow);
      const w = ctx.measureText(a.name).width + 12;
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(12, 18, w, 16, 8) : ctx.rect(12, 18, w, 16); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillText(a.name, 18, 29.5);
      ctx.restore();
    });
  }
  requestAnimationFrame(tick);

  /* ================= REBUILD: wireframe <-> content, every time ================= */
  // state: 'off' (hidden, waiting) -> 'building' -> 'done'; leaving the screen resets to 'off'
  const items = [...document.querySelectorAll('[data-rebuild]')];
  items.forEach(el => { el.__state = 'off'; });
  if (!reduce) items.forEach(el => el.classList.add('rb-pending'));

  function rebuild(el, delay, d) {
    if (el.__state !== 'off') return;
    el.__state = 'building';
    if (reduce) { el.classList.remove('rb-pending'); el.classList.add('rb-done'); el.__state = 'done'; return; }
    setTimeout(() => {
      el.classList.toggle('from-top', d === 'up');
      const wire = document.createElement('div');
      wire.className = 'wire' + (d === 'up' ? ' up' : '');
      wire.innerHTML = '<i></i><i></i><i></i><i></i><em>' + (el.dataset.label || 'BLOCK') + '</em>';
      el.appendChild(wire);
      void wire.offsetWidth;
      wire.classList.add('draw');
      sendAgents(el, 3 + Math.floor(Math.random() * 2), d);
      setTimeout(() => {
        el.classList.remove('rb-pending');
        wire.classList.add('out');
        setTimeout(() => { wire.remove(); el.classList.add('rb-done'); el.__state = 'done'; }, 400);
      }, 1050);
    }, delay);
  }

  function reset(el) {
    if (el.__state !== 'done') return;
    el.__state = 'off';
    el.classList.remove('rb-done');
    el.classList.add('rb-pending');
  }

  // hero blocks rebuild one after another on load
  items.filter(el => el.closest('.hero')).forEach((el, i) => rebuild(el, 300 + i * 260, 'down'));

  // enter view -> (re)build, using the current scroll direction
  const enterIO = new IntersectionObserver(entries => {
    let n = 0;
    entries.forEach(en => {
      if (en.isIntersecting) rebuild(en.target, (n++ % 5) * 130, dir);
    });
  }, { threshold: 0.2 });
  // far out of view (200px margin) -> reset so it can rebuild next time
  const leaveIO = new IntersectionObserver(entries => {
    entries.forEach(en => { if (!en.isIntersecting) reset(en.target); });
  }, { rootMargin: '200px 0px 200px 0px', threshold: 0 });
  items.forEach(el => { enterIO.observe(el); leaveIO.observe(el); });

  /* ================= HERO GHOST TEXT FILLS RED NEAR CURSOR ================= */
  const heroEl = document.getElementById('top');
  heroEl.addEventListener('pointermove', e => {
    const r = heroEl.getBoundingClientRect();
    heroEl.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    heroEl.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
  heroEl.addEventListener('pointerleave', () => { heroEl.style.setProperty('--mx', '-999px'); heroEl.style.setProperty('--my', '-999px'); });

  // photo tilt
  const photo = document.getElementById('photo');
  if (fine && !reduce) {
    photo.addEventListener('pointermove', e => {
      const r = photo.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      photo.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
    });
    photo.addEventListener('pointerleave', () => { photo.style.transform = ''; });
  }

  /* ================= CUSTOM CURSOR ================= */
  const dot = document.getElementById('cursorDot'), ring = document.getElementById('cursorRing');
  if (fine) {
    let cx = 0, cy = 0, rx = 0, ry = 0;
    addEventListener('pointermove', e => {
      cx = e.clientX; cy = e.clientY;
      dot.style.transform = `translate(${cx}px,${cy}px)`;
      ring.classList.toggle('big', !!e.target.closest('a, .btn'));
    });
    (function loop() { rx += (cx - rx) * .17; ry += (cy - ry) * .17; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
  }

  /* ================= MOBILE MENU ================= */
  const navBtn = document.getElementById('navToggle'), navLinks = document.getElementById('navLinks');
  function setMenu(open) { navLinks.classList.toggle('open', open); navBtn.setAttribute('aria-expanded', open); }
  navBtn.addEventListener('click', e => { e.stopPropagation(); setMenu(!navLinks.classList.contains('open')); });
  navLinks.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', e => { if (!e.target.closest('.nav')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ================= LIGHTBOX ================= */
  const lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img');
  document.addEventListener('click', e => {
    const z = e.target.closest('img.zoom');
    if (z) { lbImg.src = z.src; lbImg.alt = z.alt; lb.classList.add('open'); }
    else if (lb.classList.contains('open')) lb.classList.remove('open');
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('open'); });

  /* ================= CARD SPOTLIGHT + MAGNETIC TILES ================= */
  document.querySelectorAll('.glow').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    });
  });
  if (!reduce) document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) / r.width * 14}px,${(e.clientY - r.top - r.height / 2) / r.height * 14}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();
