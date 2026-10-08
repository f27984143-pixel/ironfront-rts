/* ============================================================
   MOD: Menú de Modos v1.0
   - Menú al entrar: mapa (Normal / Urbano infantería) y victoria
     (Destruir base o Puntos)
   - Marcador en vivo: +puntos por bajas enemigas, −puntos por bajas propias
   - Victoria / derrota: base enemiga destruida = victoria en ambos modos;
     en modo Puntos también gana si llega a 500 y pierde si baja de −300
   - Botón ⚙ Modos para volver al menú
   Requiere: mejora_mundo.js (HQs en window.MejoraMundo) y casas/mapa_ciudad para el mapa urbano
   ============================================================ */
(function () {
  if (window.__MODOS_LOADED) { console.warn('Menú de modos ya cargado'); return; }
  window.__MODOS_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('Menú de modos: IronfrontAPI no disponible'); return; }

  const CFG_KEY = 'ironfront_cfg', MAP_KEY = 'ironfront_mapa', OK_KEY = 'modos_listo';
  const META = { puntosGanar: 500, puntosPerder: -300 };
  const VALOR = {
    soldier_rifle: 10, soldier_rocket: 15, apc: 40, tank: 80, aiHeli: 60,
    transport: 40, warship: 100,
  };

  function leerCfg() {
    try { return Object.assign({ map: 'normal', win: 'base' }, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); }
    catch (e) { return { map: 'normal', win: 'base' }; }
  }
  let cfg = leerCfg();
  let partidaActiva = false, puntos = 0, terminada = false;

  // ===================== ESTILOS =====================
  const st = document.createElement('style');
  st.textContent = `
  .mj-ov{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;
    background:rgba(5,10,20,.82);backdrop-filter:blur(5px);font-family:sans-serif;color:#fff;padding:14px;box-sizing:border-box}
  .mj-box{width:min(420px,100%);background:#0f172a;border:1px solid #334155;border-radius:14px;padding:18px;box-shadow:0 10px 40px #0008}
  .mj-box h2{margin:0 0 4px;font-size:20px;letter-spacing:2px;color:#4fc3ff}
  .mj-box p.s{margin:0 0 14px;font-size:12px;color:#94a3b8}
  .mj-lbl{font-size:11px;font-weight:800;color:#cbd5e1;margin:12px 0 6px;letter-spacing:1px;text-transform:uppercase}
  .mj-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .mj-opt{padding:10px;border-radius:9px;border:2px solid #334155;background:#1e293b;color:#e2e8f0;font-weight:700;font-size:13px;cursor:pointer;text-align:left}
  .mj-opt small{display:block;font-weight:400;font-size:11px;opacity:.7;margin-top:3px}
  .mj-opt.on{border-color:#4fc3ff;background:#0c4a6e}
  .mj-go{width:100%;margin-top:18px;padding:13px;border:none;border-radius:9px;background:#4fc3ff;color:#001;font-weight:900;font-size:15px;letter-spacing:1px;cursor:pointer}
  .mj-hud{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:25;background:rgba(0,0,0,.55);color:#fff;
    font:700 12px sans-serif;padding:5px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);pointer-events:none;text-align:center;white-space:nowrap}
  .mj-hud .bar{width:150px;height:5px;background:#374151;border-radius:3px;margin-top:4px;overflow:hidden}
  .mj-hud .bar i{display:block;height:100%;background:linear-gradient(90deg,#f87171,#4ade80);transition:width .3s}
  .mj-btn{position:fixed;right:8px;bottom:8px;z-index:40;background:#1f2937cc;color:#fff;border:1px solid #6b7280;border-radius:8px;padding:6px 10px;font:700 11px sans-serif;cursor:pointer;touch-action:manipulation}
  `;
  document.head.appendChild(st);

  // ===================== MENÚ =====================
  let menuEl = null;
  function pintarMenu() {
    menuEl.querySelectorAll('[data-mapa]').forEach(b => b.classList.toggle('on', b.dataset.mapa === cfg.map));
    menuEl.querySelectorAll('[data-win]').forEach(b => b.classList.toggle('on', b.dataset.win === cfg.win));
  }
  function abrirMenu() {
    if (menuEl) menuEl.remove();
    menuEl = document.createElement('div');
    menuEl.className = 'mj-ov';
    menuEl.innerHTML = `
      <div class="mj-box">
        <h2>IRONFRONT RTS</h2>
        <p class="s">Elige el modo antes de empezar</p>
        <div class="mj-lbl">Mapa</div>
        <div class="mj-opts">
          <button class="mj-opt" data-mapa="normal">Normal<small>Campo, pueblo, tanques y helis</small></button>
          <button class="mj-opt" data-mapa="ciudad">Urbano<small>Solo edificios y infantería</small></button>
        </div>
        <div class="mj-lbl">Victoria</div>
        <div class="mj-opts">
          <button class="mj-opt" data-win="base">Destruir base<small>Gana quien destruya el cuartel enemigo</small></button>
          <button class="mj-opt" data-win="puntos">Puntos<small>Llega a ${META.puntosGanar} o baja de ${META.puntosPerder}</small></button>
        </div>
        <button class="mj-go" id="mj-go">EMPEZAR</button>
      </div>`;
    document.body.appendChild(menuEl);
    menuEl.querySelectorAll('[data-mapa]').forEach(b => b.addEventListener('click', () => { cfg.map = b.dataset.mapa; pintarMenu(); }));
    menuEl.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => { cfg.win = b.dataset.win; pintarMenu(); }));
    document.getElementById('mj-go').addEventListener('click', empezar);
    pintarMenu();
  }
  function empezar() {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      sessionStorage.setItem(OK_KEY, '1');
    } catch (e) {}
    const mapaActual = (localStorage.getItem(MAP_KEY) || 'normal');
    const mapaNuevo = cfg.map === 'ciudad' ? 'ciudad' : 'normal';
    if (mapaActual !== mapaNuevo) {
      try { localStorage.setItem(MAP_KEY, mapaNuevo); } catch (e) {}
      location.reload();          // el mapa se cambia al recargar
      return;
    }
    cerrarMenu();
    iniciarPartida();
  }
  function cerrarMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }

  // ===================== MARCADOR =====================
  const hud = document.createElement('div');
  hud.className = 'mj-hud'; hud.style.display = 'none';
  document.body.appendChild(hud);
  function pintarHud() {
    const meta = cfg.win === 'puntos'
      ? `Meta ${META.puntosGanar} · límite ${META.puntosPerder}`
      : 'Destruye el cuartel enemigo';
    const pct = Math.max(0, Math.min(100, ((puntos - META.puntosPerder) / (META.puntosGanar - META.puntosPerder)) * 100));
    hud.innerHTML = `${cfg.win === 'puntos' ? `Puntos: <span style="color:${puntos >= 0 ? '#4ade80' : '#f87171'}">${puntos}</span>` : 'Modo: Destruir base'}
      <div style="font-weight:400;font-size:10px;opacity:.75">${meta}</div>
      ${cfg.win === 'puntos' ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}`;
  }

  // ===================== BOTÓN MODOS =====================
  const btn = document.createElement('button');
  btn.className = 'mj-btn'; btn.textContent = '⚙ Modos';
  btn.addEventListener('click', () => {
    if (!partidaActiva) return;
    if (!confirm('Volver al menú de modos? Se reinicia la partida.')) return;
    try { sessionStorage.removeItem(OK_KEY); } catch (e) {}
    location.reload();
  });
  document.body.appendChild(btn);

  // ===================== FIN DE PARTIDA =====================
  const endEl = document.createElement('div');
  endEl.className = 'mj-ov'; endEl.style.display = 'none';
  endEl.innerHTML = `<div class="mj-box" style="text-align:center">
      <h2 id="mj-end-t" style="font-size:34px;letter-spacing:4px;margin:6px 0"></h2>
      <p class="s" id="mj-end-s"></p>
      <button class="mj-go" id="mj-again">JUGAR DE NUEVO</button></div>`;
  document.body.appendChild(endEl);
  document.getElementById('mj-again').addEventListener('click', () => location.reload());

  function terminar(ganas, motivo) {
    if (terminada) return;
    terminada = true;
    document.getElementById('mj-end-t').textContent = ganas ? 'VICTORIA' : 'DERROTA';
    document.getElementById('mj-end-t').style.color = ganas ? '#4fc3ff' : '#ff5555';
    document.getElementById('mj-end-s').textContent = motivo + (cfg.win === 'puntos' ? ` · Puntos: ${puntos}` : '');
    endEl.style.display = 'flex';
  }

  // ===================== PUNTOS: BAJAS =====================
  const vivo = new WeakMap();    // unit -> true si estaba vivo la última vez
  function estaMuerto(u) { return u.hp <= 0 || u.isDead === true; }
  function valorDe(u) {
    if (u.type === 'soldier') return u.role === 'rocket' ? VALOR.soldier_rocket : VALOR.soldier_rifle;
    if (u.type === 'tank') return VALOR.tank;
    if (u.type === 'apc') return VALOR.apc;
    if (u.kind === 'transport') return VALOR.transport;
    if (u.kind === 'warship') return VALOR.warship;
    if (u.pad && u.state !== undefined) return VALOR.transport;            // helicóptero de transporte
    if (u.rotor) return VALOR.aiHeli;                                       // helicóptero de combate
    return 20;
  }
  function revisarBajas(lista) {
    if (!Array.isArray(lista)) return;
    for (const u of lista) {
      if (!u) continue;
      const muerto = estaMuerto(u);
      const estabaVivo = vivo.get(u) !== false;
      if (muerto && estabaVivo) {
        vivo.set(u, false);
        const v = valorDe(u);
        if (u.team === 'enemy') puntos += v;          // baja enemiga: sumas
        else if (u.team === 'ally') puntos -= Math.round(v / 2); // baja propia: restas
      } else if (!muerto && !estabaVivo) {
        vivo.set(u, true);                              // reapareció
      }
    }
  }

  // ===================== CUARTELES =====================
  function revisarCuarteles() {
    const hqs = (window.MejoraMundo && window.MejoraMundo.hqs) || [];
    const enemigo = hqs.find(h => h.team === 'enemy');
    const aliado = hqs.find(h => h.team === 'ally');
    if (enemigo && enemigo.hp <= 0) terminar(true, 'Destruiste el cuartel enemigo');
    else if (aliado && aliado.hp <= 0) terminar(false, 'Tu cuartel fue destruido');
  }

  // ===================== CONTROL DE PUNTOS =====================
  function revisarPuntos() {
    if (cfg.win !== 'puntos') return;
    if (puntos >= META.puntosGanar) terminar(true, 'Alcanzaste la meta de puntos');
    else if (puntos <= META.puntosPerder) terminar(false, 'Bajaste al límite de puntos');
  }

  // ===================== ARRANQUE DE PARTIDA =====================
  function iniciarPartida() {
    partidaActiva = true; puntos = 0; terminada = false;
    hud.style.display = '';
    pintarHud();
    // Estado inicial de cada unidad (para no contar bajas de arranque)
    const todas = [API.soldiers, API.vehicles, API.tanks, API.aiHelis, API.boats, API.transports];
    for (const lista of todas) if (Array.isArray(lista)) for (const u of lista) vivo.set(u, !estaMuerto(u));
    API.say && API.say(cfg.win === 'puntos' ? 'Modo Puntos: llega a ' + META.puntosGanar : 'Modo Destruir base');
  }

  const prevOnUpdate = API.onUpdate;
  let hudT = 0;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') { try { prevOnUpdate(dt); } catch (e) { console.error(e); } }
    if (!partidaActiva || terminada) return;
    const todas = [API.soldiers, API.vehicles, API.tanks, API.aiHelis, API.boats, API.transports];
    for (const lista of todas) revisarBajas(lista);
    revisarPuntos();
    revisarCuarteles();
    hudT += dt;
    if (hudT > 0.25) { hudT = 0; pintarHud(); }
  };

  // ===================== INICIO =====================
  // Menú cada vez que se abre la página, salvo que el usuario ya haya empezado en esta pestaña
  const yaListo = (() => { try { return sessionStorage.getItem(OK_KEY) === '1'; } catch (e) { return false; } })();
  if (yaListo) {
    // Ya eligió modo en esta pestaña: arrancar directo
    const esperar = setInterval(() => {
      if (window.MejoraMundo || window.CasasSystem || partidaArranque()) { clearInterval(esperar); iniciarPartida(); }
    }, 200);
    setTimeout(() => clearInterval(esperar), 8000);
  } else {
    abrirMenu();
  }
  function partidaArranque() { return Array.isArray(API.soldiers) && API.soldiers.length > 0; }

  window.Modos = { cfg, puntos: () => puntos, empezar, abrirMenu };
  console.log('Menú de modos v1.0 listo. Config:', cfg);
})();
