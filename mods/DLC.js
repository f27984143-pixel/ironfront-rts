/* ============================================================
   MOD: Aire y Conquista v3.0
   - Ciclo de vuelo REHECHO: taxi → despegue → ascenso → combate
     → regreso → aproximación → aterrizaje → rodaje → aparcado
   - Rumbos corregidos (antes el avión miraba al revés)
   - Failsafe: si un avión se queda trabado en el suelo, se resetea
   - Helipuerto funcional (helicópteros aterrizan a repararse)
   - Todo lo demás igual: nubes, aeropuertos, cuarteles, victoria/derrota
   ============================================================ */
(function () {
  if (window.__AIRCONQUEST_LOADED) { console.warn('⚠️ Mod ya cargado'); return; }
  window.__AIRCONQUEST_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('❌ IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);

  console.log('✈️ Mod Aire y Conquista v3.0: iniciando...');
  API.say('✈️ Aire y Conquista v3.0');

  // ===================== CONSTANTES =====================
  const GROUND_Y   = 1.0;    // altura mínima (avión en suelo)
  const CRUISE_ALT = 30;     // altitud de crucero
  const TAXI_SPEED = 14;
  const ROLL_SPEED = 65;     // velocidad de despegue/aterrizaje
  const CRUISE_SPEED = 52;
  const APPROACH_DIST = 160; // distancia horizontal del planeo final

  const mod = {
    planes: [], helis: [], hqs: [], smokes: [], clouds: [],
    gameOver: false,
  };

  // ===================== HUD CUARTELES =====================
  const hudHq = document.createElement('div');
  hudHq.style.cssText = 'position:fixed;top:6px;right:6px;z-index:26;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 9px;font:11px sans-serif;color:#fff;min-width:170px;backdrop-filter:blur(4px)';
  hudHq.innerHTML = `
    <div style="font-weight:700;color:#9ecbff;margin-bottom:4px;font-size:10px;letter-spacing:1px">⌂ CUARTELES</div>
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
      <span style="color:#7ec8ff;width:52px;font-weight:700">ALIADA</span>
      <div style="flex:1;background:#2a2a2a;border-radius:3px;overflow:hidden;height:9px;border:1px solid #000">
        <div id="hq-ally-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#007bff,#4fc3ff);transition:width .15s"></div>
      </div>
      <span id="hq-ally-txt" style="width:36px;text-align:right;font-weight:700">100%</span>
    </div>
    <div style="display:flex;align-items:center;gap:5px">
      <span style="color:#ff9e9e;width:52px;font-weight:700">ENEMIGA</span>
      <div style="flex:1;background:#2a2a2a;border-radius:3px;overflow:hidden;height:9px;border:1px solid #000">
        <div id="hq-enemy-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#ff2222,#ff8080);transition:width .15s"></div>
      </div>
      <span id="hq-enemy-txt" style="width:36px;text-align:right;font-weight:700">100%</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;padding-top:3px;border-top:1px solid rgba(255,255,255,.12);font-size:10px">
      <span>✈️ En vuelo:</span><b id="hq-airborne" style="color:#a0e0ff">0</b>
    </div>
  `;
  document.body.appendChild(hudHq);

  // ===================== OVERLAY FIN =====================
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);font-family:sans-serif;color:#fff;text-align:center';
  overlay.innerHTML = `
    <div style="animation:ovFade .5s ease-out">
      <div id="ov-title" style="font-size:60px;font-weight:900;letter-spacing:6px;margin-bottom:8px;text-shadow:0 0 30px currentColor"></div>
      <div id="ov-sub" style="font-size:16px;opacity:.7;margin-bottom:28px">La partida ha terminado</div>
      <button id="ov-restart" style="background:#4fc3ff;color:#000;border:none;padding:14px 34px;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer;letter-spacing:1px">JUGAR DE NUEVO</button>
    </div>
    <style>@keyframes ovFade{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}</style>
  `;
  document.body.appendChild(overlay);
  document.getElementById('ov-restart').addEventListener('click', () => location.reload());

  function showEndScreen(win) {
    if (mod.gameOver) return;
    mod.gameOver = true;
    const t = document.getElementById('ov-title'), s = document.getElementById('ov-sub');
    if (win) { t.textContent = '¡VICTORIA!'; t.style.color = '#4fc3ff'; s.textContent = 'Has destruido el cuartel enemigo'; }
    else     { t.textContent = 'DERROTA';    t.style.color = '#ff4444'; s.textContent = 'Tu cuartel ha sido destruido'; }
    overlay.style.display = 'flex';
  }

  // ===================== HELPERS =====================
  function addHealthBar(unit, yOffset, width) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.25), new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.25), new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false }));
    fg.position.z = 0.01;
    g.add(bg); g.add(fg); g.renderOrder = 999;
    API.scene.add(g);
    unit.hpGroup = g; unit.hpBar = fg;
    unit.hpYOffset = yOffset; unit.hpWidth = width;
  }

  // Mueve `pos` hacia `target` como máximo `maxStep`. Devuelve { arrived, distance }.
  function stepToward(pos, target, maxStep) {
    const dx = target.x - pos.x, dy = target.y - pos.y, dz = target.z - pos.z;
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (d < 0.001) return { arrived: true, distance: 0 };
    if (maxStep >= d) { pos.set(target.x, target.y, target.z); return { arrived: true, distance: 0 }; }
    const k = maxStep / d;
    pos.x += dx * k; pos.y += dy * k; pos.z += dz * k;
    return { arrived: false, distance: d - maxStep };
  }

  // Gira yaw suavemente hacia un objetivo
  function rotateSmooth(cur, target, dt, speed) {
    let diff = target - cur;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return cur + diff * Math.min(1, dt * speed);
  }

  function yawFromDir(dx, dz) { return Math.atan2(dx, dz); }

  // ===================== NUBES =====================
  function addClouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const geo = new THREE.SphereGeometry(1, 7, 6);
    for (let i = 0; i < 42; i++) {
      const c = new THREE.Group();
      c.position.set(rnd(-320, 320), rnd(55, 95), rnd(-320, 320));
      const n = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < n; p++) {
        const s = rnd(3, 7);
        const puff = new THREE.Mesh(geo, mat);
        puff.position.set(rnd(-5, 5), rnd(-1, 1), rnd(-4, 4));
        puff.scale.set(s, s * 0.7, s);
        c.add(puff);
      }
      API.scene.add(c);
      mod.clouds.push({ mesh: c, speed: rnd(1.2, 3.0), drift: rnd(-0.3, 0.3) });
    }
  }

  // ===================== MONTAÑAS =====================
  function addDistantMountains() {
    const matRock = new THREE.MeshLambertMaterial({ color: 0x6a7a6a });
    const matSnow = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const g = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, rad = 280 + rnd(-20, 20);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const h = rnd(30, 65), r = rnd(20, 36);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), matRock);
      peak.position.set(x, h / 2 - 3, z); peak.rotation.y = rnd(0, Math.PI); g.add(peak);
      const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.32, 5), matSnow);
      snow.position.set(x, h - h * 0.16 - 3, z); snow.rotation.y = peak.rotation.y; g.add(snow);
    }
    API.scene.add(g);
  }

  // ===================== RÍO + PUENTES =====================
  function addRiver() {
    const g = new THREE.Group();
    const river = new THREE.Mesh(new THREE.PlaneGeometry(400, 26),
      new THREE.MeshLambertMaterial({ color: 0x2a6fa8, transparent: true, opacity: 0.85 }));
    river.rotation.x = -Math.PI / 2; river.position.set(0, 0.07, 0); g.add(river);
    for (const zo of [-14, 14]) {
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(400, 3),
        new THREE.MeshLambertMaterial({ color: 0xd9c68f }));
      bank.rotation.x = -Math.PI / 2; bank.position.set(0, 0.06, zo); g.add(bank);
    }
    API.scene.add(g);

    const matB = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matR = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const matP = new THREE.MeshLambertMaterial({ color: 0x6a6a5a });
    for (const px of [-90, 0, 90]) {
      const br = new THREE.Group(); br.position.set(px, 0, 0);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 30), matB);
      deck.position.y = 1.2; deck.castShadow = true; deck.receiveShadow = true; br.add(deck);
      for (const sx of [-10.2, 10.2]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 30), matR);
        rail.position.set(sx, 2.4, 0); br.add(rail);
        for (let i = -4; i <= 4; i++) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), matR);
          post.position.set(sx, 2.4, i * 3.5); br.add(post);
        }
      }
      for (const pz of [-10, 0, 10]) {
        const py = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 4, 8), matP);
        py.position.set(0, -0.8, pz); br.add(py);
      }
      for (const sx of [-5, 5]) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 6, 10, Math.PI), matR);
        arc.rotation.y = Math.PI / 2; arc.position.set(sx, 1.5, 0); br.add(arc);
      }
      API.scene.add(br);
    }
  }

  // ===================== BOSQUE + COLINAS =====================
  function addForestAndHills() {
    const matT = new THREE.MeshLambertMaterial({ color: 0x594630 });
    const matL1 = new THREE.MeshLambertMaterial({ color: 0x2f5f33 });
    const matL2 = new THREE.MeshLambertMaterial({ color: 0x3a7038 });
    const matH = new THREE.MeshLambertMaterial({ color: 0x5b7a3e });
    for (const center of [[-140, -100], [140, -100], [-140, 100], [140, 100]]) {
      for (let i = 0; i < 24; i++) {
        const x = center[0] + rnd(-35, 35), z = center[1] + rnd(-35, 35);
        const t = new THREE.Group(); t.position.set(x, 0, z);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.5, 6), matT);
        trunk.position.y = 1.25; trunk.castShadow = true; t.add(trunk);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(rnd(1.8, 2.6), rnd(4, 6.5), 7), i % 2 ? matL1 : matL2);
        leaves.position.y = 4.5; leaves.castShadow = true; t.add(leaves);
        API.scene.add(t);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, rad = 200 + rnd(-20, 20);
      const hill = new THREE.Mesh(new THREE.SphereGeometry(rnd(14, 24), 12, 8), matH);
      hill.scale.y = 0.25; hill.position.set(Math.cos(a) * rad, -1, Math.sin(a) * rad);
      hill.receiveShadow = true; API.scene.add(hill);
    }
  }

  // ===================== ZONA INDUSTRIAL =====================
  function addIndustrialZone() {
    const matBrick = new THREE.MeshLambertMaterial({ color: 0x8a5a4a });
    const matConc  = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matRoof  = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const matStack = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
    const matRed   = new THREE.MeshLambertMaterial({ color: 0xaa2222 });
    for (const base of [[-150, -30], [150, -30], [-150, 30], [150, 30]]) {
      const bx = base[0], bz = base[1];
      const nave = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 14), matBrick);
      nave.position.set(bx, 4, bz); nave.castShadow = true; nave.receiveShadow = true; API.scene.add(nave);
      const techo = new THREE.Mesh(new THREE.BoxGeometry(23, 0.6, 15), matRoof); techo.position.set(bx, 8.3, bz); API.scene.add(techo);
      const chim = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 20, 10), matStack); chim.position.set(bx + 8, 10, bz - 4); chim.castShadow = true; API.scene.add(chim);
      const aro = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1, 10), matRed); aro.position.set(bx + 8, 18, bz - 4); API.scene.add(aro);
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xcccccc, transparent: true, opacity: 0.55, depthWrite: false }));
      smoke.position.set(bx + 8, 21, bz - 4); API.scene.add(smoke);
      mod.smokes.push({ mesh: smoke, baseY: 21, t: Math.random() * 6 });
      const chim2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 14, 8), matStack); chim2.position.set(bx - 7, 7, bz + 3); chim2.castShadow = true; API.scene.add(chim2);
      const alm = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8), matConc); alm.position.set(bx - 12, 2, bz - 6); API.scene.add(alm);
      for (let i = 0; i < 10; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), matConc);
        p.position.set(bx - 12 + i * 2.4, 0.75, bz + 9); API.scene.add(p);
      }
    }
  }

  // ===================== POSTES DE LUZ =====================
  function addStreetLights() {
    const matPost = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const matLamp = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (let i = -8; i <= 8; i++) {
      for (const sx of [-8, 8]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 6), matPost);
        p.position.set(sx, 3, i * 22); API.scene.add(p);
        const a = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), matPost);
        a.position.set(sx + (sx > 0 ? -0.7 : 0.7), 5.9, i * 22); API.scene.add(a);
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), matLamp);
        l.position.set(sx + (sx > 0 ? -1.3 : 1.3), 5.85, i * 22); API.scene.add(l);
      }
    }
  }

  // ===================== CUARTEL HQ =====================
  function buildHQ(team, x, z) {
    const color = team === 'ally' ? 0x0055ff : 0xff2222;
    const mat = new THREE.MeshLambertMaterial({ color });
    const matDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matConc = new THREE.MeshLambertMaterial({ color: 0x8a8a80 });
    const g = new THREE.Group(); g.position.set(x, 0, z); API.scene.add(g);
    const add = (w, h, d, m, xx, yy, zz) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(xx, yy, zz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
    };
    add(26, 0.5, 26, matConc, 0, 0.25, 0);
    add(26, 3.5, 0.9, mat, 0, 2, -12.5);
    add(26, 3.5, 0.9, mat, 0, 2, 12.5);
    add(0.9, 3.5, 26, mat, -12.5, 2, 0);
    add(0.9, 3.5, 26, mat, 12.5, 2, 0);
    for (const [cx, cz] of [[-12,-12],[12,-12],[-12,12],[12,12]]) {
      add(3.2, 6, 3.2, matDark, cx, 3, cz);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 4.5, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      c.rotation.x = Math.PI / 2; c.position.set(cx, 5, cz); g.add(c);
    }
    add(9, 9, 9, matConc, 0, 4.5, 0);
    add(9.6, 0.6, 9.6, mat, 0, 9.3, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      add(0.5, 9.5, 0.5, matDark, Math.cos(a) * 4.4, 4.75, Math.sin(a) * 4.4);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 8), matDark);
    mast.position.set(0, 13, 0); g.add(mast);
    const rg = new THREE.Group(); rg.position.set(0, 15.5, 0);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 1.1), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
    radar.rotation.x = 0.4; rg.add(radar); g.add(rg);
    const bandera = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    bandera.position.set(0, 13.5, 0.5); g.add(bandera);
    const hq = { type: 'hq', team, mesh: g, hp: 3000, maxHp: 3000, radius: 14, isDead: false, radarGroup: rg, bandera, basePos: V(x, 0, z) };
    addHealthBar(hq, 20, 18);
    mod.hqs.push(hq);
    return hq;
  }

  // ===================== AEROPUERTO =====================
  function buildAirport(team, x, z, rotY) {
    const color = team === 'ally' ? 0x0055ff : 0xff2222;
    const matAccent = new THREE.MeshLambertMaterial({ color });
    const matAsphalt = new THREE.MeshLambertMaterial({ color: 0x252525 });
    const matConcrete = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const matGlass = new THREE.MeshLambertMaterial({ color: 0x2a5a7a, emissive: 0x0a2030 });
    const matWhite = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    const matYellow = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const matRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const matGreen = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    const g = new THREE.Group(); g.position.set(x, 0.03, z); g.rotation.y = rotY; API.scene.add(g);
    const add = (w, h, d, m, xx, yy, zz) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(xx, yy, zz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
    };

    // Pista
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(20, 130), matAsphalt);
    runway.rotation.x = -Math.PI / 2; runway.position.set(0, 0.02, 0); runway.receiveShadow = true; g.add(runway);
    for (let i = -10; i <= 10; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.5), matWhite);
      m.rotation.x = -Math.PI / 2; m.position.set(0, 0.04, i * 6); g.add(m);
    }
    for (const zEnd of [-60, 60]) {
      for (let i = -4; i <= 4; i++) {
        const u = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 5), matWhite);
        u.rotation.x = -Math.PI / 2; u.position.set(i * 2.4, 0.04, zEnd); g.add(u);
      }
    }
    for (let i = -10; i <= 10; i++) {
      for (const xx of [-10.5, 10.5]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), i % 2 ? matYellow : matGreen);
        l.position.set(xx, 0.18, i * 6); g.add(l);
      }
    }
    for (let i = 1; i <= 5; i++) {
      for (const xx of [-3, -1.5, 0, 1.5, 3]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), matWhite);
        l.position.set(xx, 0.18, -62 - i * 2); g.add(l);
      }
    }

    // Taxiway
    const taxi = new THREE.Mesh(new THREE.PlaneGeometry(6, 120), matAsphalt);
    taxi.rotation.x = -Math.PI / 2; taxi.position.set(18, 0.025, 0); g.add(taxi);
    for (const tz of [-40, -15, 15, 40]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), matAsphalt);
      r.rotation.x = -Math.PI / 2; r.position.set(12, 0.025, tz); g.add(r);
      const y = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 4), matYellow);
      y.rotation.x = -Math.PI / 2; y.position.set(12, 0.05, tz); g.add(y);
    }
    const yl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 118), matYellow);
    yl.rotation.x = -Math.PI / 2; yl.position.set(18, 0.05, 0); g.add(yl);

    // Hangares
    for (const hx of [-38, 38]) {
      const hz = 6;
      add(22, 0.5, 22, matConcrete, hx, 0.25, hz);
      add(22, 7, 0.8, matMetal, hx, 3.75, hz - 11);
      add(22, 7, 0.8, matMetal, hx, 3.75, hz + 11);
      add(0.8, 7, 22, matMetal, hx - 11, 3.75, hz);
      add(21, 5.8, 0.5, matAccent, hx, 3, hz + 11.1);
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(22 - i * 4, 0.4, 22), matMetal);
        r.position.set(hx, 7.5 + i * 0.9, hz); g.add(r);
      }
      add(2, 2, 0.2, matYellow, hx - 8, 5.5, hz + 11.2);
    }

    // Terminal
    const tx = 0, tz2 = -75;
    add(30, 8, 14, matConcrete, tx, 4, tz2);
    add(28, 5, 0.3, matGlass, tx, 4.5, tz2 + 7.1);
    add(28, 0.6, 12, matMetal, tx, 8.2, tz2);
    for (let i = 0; i < 15; i++) add(0.2, 1.2, 0.2, matMetal, tx - 14 + i * 2, 9.1, tz2 + 6);
    for (const px of [-10, 0, 10]) {
      add(3, 0.5, 8, matConcrete, tx + px, 5, tz2 + 12);
      add(3, 0.3, 8, matMetal, tx + px, 7.5, tz2 + 12);
      add(3, 2.2, 0.15, matGlass, tx + px, 6, tz2 + 16);
      add(0.3, 5, 0.3, matMetal, tx + px - 1.3, 2.5, tz2 + 8.2);
      add(0.3, 5, 0.3, matMetal, tx + px + 1.3, 2.5, tz2 + 8.2);
      add(0.3, 5, 0.3, matMetal, tx + px - 1.3, 2.5, tz2 + 15.8);
      add(0.3, 5, 0.3, matMetal, tx + px + 1.3, 2.5, tz2 + 15.8);
    }

    // Torre de control
    const tx2 = -55, tz3 = -55;
    add(8, 22, 8, matConcrete, tx2, 11, tz3);
    add(11, 5, 11, matGlass, tx2, 24, tz3);
    add(12, 0.8, 12, matMetal, tx2, 27, tz3);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), matMetal);
    ant.position.set(tx2, 31.4, tz3); g.add(ant);
    const rg = new THREE.Group(); rg.position.set(tx2, 33, tz3);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.2), matMetal); rg.add(radar); g.add(rg);
    for (const [dx, dz] of [[-5,-5],[5,-5],[-5,5],[5,5]]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), matRed);
      l.position.set(tx2 + dx, 28, tz3 + dz); g.add(l);
    }

    // Combustible
    for (let i = 0; i < 4; i++) {
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 18), matMetal);
      tk.position.set(-45 + i * 8, 3, 30); tk.castShadow = true; g.add(tk);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.5, 18), matAccent);
      cap.position.set(-45 + i * 8, 6.2, 30); g.add(cap);
      const bd = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.4, 18), matRed);
      bd.position.set(-45 + i * 8, 4, 30); g.add(bd);
    }

    // Helipuerto
    const hpX = 45, hpZ = 30;
    const hp = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.4, 24), matConcrete);
    hp.position.set(hpX, 0.2, hpZ); hp.receiveShadow = true; g.add(hp);
    const hpC = new THREE.Mesh(new THREE.RingGeometry(6, 6.5, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    hpC.rotation.x = -Math.PI / 2; hpC.position.set(hpX, 0.42, hpZ); g.add(hpC);
    const hcv = document.createElement('canvas'); hcv.width = 128; hcv.height = 128;
    const hc = hcv.getContext('2d');
    hc.fillStyle = '#ffffff'; hc.font = 'bold 110px sans-serif';
    hc.textAlign = 'center'; hc.textBaseline = 'middle'; hc.fillText('H', 64, 64);
    const hT = new THREE.CanvasTexture(hcv);
    const hM = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: hT, transparent: true }));
    hM.rotation.x = -Math.PI / 2; hM.position.set(hpX, 0.43, hpZ); g.add(hM);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), matGreen);
      l.position.set(hpX + Math.cos(a) * 7.5, 0.5, hpZ + Math.sin(a) * 7.5); g.add(l);
    }

    // Torre de agua
    const wtx = 60, wtz = -30;
    for (const [ox, oz] of [[-2,-2],[2,-2],[-2,2],[2,2]]) add(0.4, 12, 0.4, matMetal, wtx + ox, 6, wtz + oz);
    const wt = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 4, 14), matConcrete);
    wt.position.set(wtx, 13, wtz); g.add(wt);
    const wtop = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.2, 14), matMetal);
    wtop.position.set(wtx, 15.6, wtz); g.add(wtop);

    return { team, mesh: g, x, z, rotY, radarPivot: rg, helipad: { x: hpX, z: hpZ } };
  }

  // ===================== PISTAS (config corregida) =====================
  // Cada aeropuerto tiene su pista orientada en Z. Definimos:
  //   takeoffStart → takeoffEnd : dirección de despegue
  //   approach     → threshold  : tramo de aproximación (aterrizaje)
  //   threshold    → rolloutEnd : rodadura tras tocar tierra
  // Ally: despega de sur (-155) a norte (-25), aterriza del norte (-25) al sur (-155)
  // Enemy: despega de norte (155) a sur (25), aterriza del sur (25) al norte (155)
  const runways = {
    ally: {
      centerX: -100,
      takeoffStart: V(-100, GROUND_Y, -155),
      takeoffEnd:   V(-100, GROUND_Y, -25),
      takeoffDir:   V(0, 0, 1),
      takeoffHeading: 0,                       // mirando +Z
      approach:     V(-100, CRUISE_ALT, -25 + APPROACH_DIST),   // (-100, alt, 135)
      threshold:    V(-100, GROUND_Y, -25),
      landingDir:   V(0, 0, -1),               // se mueve en -Z
      landingHeading: Math.PI,
      rolloutEnd:   V(-100, GROUND_Y, -155),
      apronBase:    V(-82, GROUND_Y, -155),    // junto a la cabecera sur
      helipad:      V(-100 + 45, 0.4, -90 + 30), // hpX, hpZ locales
    },
    enemy: {
      centerX: 100,
      takeoffStart: V(100, GROUND_Y, 155),
      takeoffEnd:   V(100, GROUND_Y, 25),
      takeoffDir:   V(0, 0, -1),
      takeoffHeading: Math.PI,                 // mirando -Z
      approach:     V(100, CRUISE_ALT, 25 - APPROACH_DIST),     // (100, alt, -135)
      threshold:    V(100, GROUND_Y, 25),
      landingDir:   V(0, 0, 1),
      landingHeading: 0,
      rolloutEnd:   V(100, GROUND_Y, 155),
      apronBase:    V(82, GROUND_Y, 155),
      helipad:      V(100 + 45, 0.4, 90 + 30),
    },
  };

  // ===================== CAZA =====================
  function buildFighter(color, team, rw, slot) {
    const matBody  = new THREE.MeshLambertMaterial({ color });
    const matDark  = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matGlass = new THREE.MeshLambertMaterial({ color: 0x0e1a2a });
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const matTip   = new THREE.MeshBasicMaterial({ color: 0xcc2222 });

    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
      m.castShadow = true; g.add(m); return m;
    };
    add(new THREE.BoxGeometry(1.7, 1.4, 9), matBody, 0, 0, 0);
    add(new THREE.BoxGeometry(1.3, 1.0, 3.5), matBody, 0, 0.1, -5.5);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.2, 10), matBody);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 0, 5.5); nose.castShadow = true; g.add(nose);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 10), matTip);
    tip.rotation.x = Math.PI / 2; tip.position.set(0, 0, 7.2); g.add(tip);
    add(new THREE.BoxGeometry(0.95, 0.75, 2.8), matGlass, 0, 0.9, -0.8);
    add(new THREE.BoxGeometry(0.95, 0.45, 1.5), matGlass, 0, 0.98, 1.4);
    const wl = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody, -2.6, 0, 0.6); wl.rotation.z = 0.14;
    const wr = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody, 2.6, 0, 0.6); wr.rotation.z = -0.14;
    add(new THREE.BoxGeometry(0.85, 0.45, 1.4), matDark, -4.6, 0.2, 1.0);
    add(new THREE.BoxGeometry(0.85, 0.45, 1.4), matDark, 4.6, 0.2, 1.0);
    for (const wx of [-3.0, 3.0]) {
      for (const wz of [0.2, 1.4]) {
        const msl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.8, 8), matMetal);
        msl.rotation.x = Math.PI / 2; msl.position.set(wx, -0.45, wz); g.add(msl);
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), matDark);
        t.rotation.x = Math.PI / 2; t.position.set(wx, -0.45, wz + 1.65); g.add(t);
      }
    }
    const tv = add(new THREE.BoxGeometry(0.32, 2.6, 2), matBody, 0, 1.5, -4.5); tv.rotation.x = -0.25;
    add(new THREE.BoxGeometry(3.8, 0.28, 1.3), matBody, 0, 0, -4.8);
    for (const ex of [-0.7, 0.7]) {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2, 12), matDark);
      e.rotation.x = Math.PI / 2; e.position.set(ex, -0.2, -5.5); g.add(e);
    }
    const flames = [];
    for (const ex of [-0.7, 0.7]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.85 }));
      f.rotation.x = -Math.PI / 2; f.position.set(ex, -0.2, -7.0);
      f.visible = false; g.add(f); flames.push(f);
    }
    API.scene.add(g);

    // Apron: a la derecha de la cabecera sur (ally) o norte (enemy), separados por slot
    const apron = rw.apronBase.clone();
    apron.x += (slot - 1) * 8;

    const unit = {
      type: 'plane', team, mesh: g,
      hp: 120, maxHp: 120, radius: 4.5,
      isDead: false, respawnTimer: 0,
      basePos: apron.clone(),
      cooldown: 0, missileCooldown: 0,
      flames, yaw: rw.takeoffHeading, pitch: 0, roll: 0,
      state: 'parked',
      stateT: 4 + slot * 3 + rnd(0, 3),
      rollSpeed: 0,
      groundTime: 0,
      rw, apron,
      patrolAngle: Math.random() * Math.PI * 2,
      patrolRadius: rnd(60, 110),
      combatTime: 0,
    };
    unit.mesh.rotation.order = 'YXZ';
    unit.mesh.position.copy(apron);
    unit.mesh.rotation.y = unit.yaw;
    addHealthBar(unit, 3.5, 3.2);
    mod.planes.push(unit);
    return unit;
  }

  // ===================== HELICÓPTERO =====================
  function buildAttackHeli(color, team, x, z) {
    const matBody  = new THREE.MeshLambertMaterial({ color });
    const matDark  = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matGlass = new THREE.MeshLambertMaterial({ color: 0x0e1a2a });
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const matRotor = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
      m.castShadow = true; g.add(m); return m;
    };
    add(new THREE.BoxGeometry(2.6, 2.1, 6), matBody, 0, 0, 0);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 12), matBody);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 0, 4); nose.castShadow = true; g.add(nose);
    add(new THREE.BoxGeometry(2.0, 1.5, 1.7), matGlass, 0, 0.35, 1.8);
    add(new THREE.BoxGeometry(0.7, 0.7, 5), matBody, 0, 0.3, -5.5);
    add(new THREE.BoxGeometry(3.2, 0.16, 1.1), matBody, 0, 0.3, -7.2);
    const rT = new THREE.Group(); rT.position.set(0.45, 0.3, -8);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.15), matRotor);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 2.4), matRotor);
    rT.add(t1); rT.add(t2); g.add(rT);
    for (const sx of [-1.05, 1.05]) {
      add(new THREE.BoxGeometry(0.16, 0.16, 4.5), matMetal, sx, -1.5, 0.5);
      add(new THREE.BoxGeometry(0.16, 1.3, 0.16), matMetal, sx, -0.75, -1.4);
      add(new THREE.BoxGeometry(0.16, 1.3, 0.16), matMetal, sx, -0.75, 2.2);
    }
    const rM = new THREE.Group(); rM.position.set(0, 1.5, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8), matDark);
    mast.position.y = 0.45; rM.add(mast);
    for (let i = 0; i < 4; i++) {
      const bg = new THREE.BoxGeometry(0.3, 0.06, 6.5); bg.translate(0, 0, 3.25);
      const bl = new THREE.Mesh(bg, matRotor);
      bl.rotation.y = (i / 4) * Math.PI * 2; bl.position.y = 0.9; rM.add(bl);
    }
    g.add(rM);
    add(new THREE.BoxGeometry(6, 0.22, 0.9), matBody, 0, -0.2, 0.6);
    for (const wx of [-2.4, -1.6, 1.6, 2.4]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 8), matDark);
      p.rotation.x = Math.PI / 2; p.position.set(wx, -0.65, 0.9); g.add(p);
    }
    const turret = new THREE.Group();
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.4, 8), matDark);
    cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 0, 0.5); turret.add(cannon);
    turret.position.set(0, -1.0, 2.6); g.add(turret);
    for (const ex of [-0.8, 0.8]) add(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 8), matDark, ex, 0.7, -2.8);
    add(new THREE.BoxGeometry(0.5, 0.5, 0.7), matDark, 0, 1.0, 3.2);
    API.scene.add(g);

    const unit = {
      type: 'heli', team, mesh: g,
      hp: 160, maxHp: 160, radius: 3.5, speed: 22,
      isDead: false, respawnTimer: 0,
      basePos: V(x, 20, z),
      cooldown: 0, missileCooldown: 0,
      rotorMain: rM, rotorTail: rT, turret,
      yaw: 0, strafeTimer: Math.random() * 6,
      patrolAngle: Math.random() * Math.PI * 2,
    };
    unit.mesh.rotation.order = 'YXZ';
    unit.mesh.position.copy(unit.basePos);
    addHealthBar(unit, 3.5, 3);
    mod.helis.push(unit);
    return unit;
  }

  // ===================== CREAR MUNDO =====================
  addClouds();
  addDistantMountains();
  addRiver();
  addForestAndHills();
  addIndustrialZone();
  addStreetLights();

  buildHQ('ally', 0, -140);
  buildHQ('enemy', 0, 140);
  const allyAirport  = buildAirport('ally',  -100, -90, 0);
  const enemyAirport = buildAirport('enemy',  100,  90, Math.PI);

  for (let i = 0; i < 3; i++) {
    buildFighter(0x0055ff, 'ally', runways.ally, i);
    buildFighter(0xff2222, 'enemy', runways.enemy, i);
  }
  for (let i = 0; i < 2; i++) {
    buildAttackHeli(0x0055ff, 'ally', -70 + i * 14, -105);
    buildAttackHeli(0xff2222, 'enemy', 70 - i * 14, 105);
  }

  // ===================== UPDATE CAZAS =====================
  const _d = new THREE.Vector3();
  const _p = new THREE.Vector3();

  function updatePlane(p, dt) {
    // ---- MUERTO ----
    if (p.isDead) {
      p.respawnTimer += dt;
      p.mesh.visible = false;
      if (p.hpGroup) p.hpGroup.visible = false;
      if (p.respawnTimer > 15) {
        p.hp = p.maxHp; p.isDead = false;
        p.mesh.visible = true;
        if (p.hpGroup) p.hpGroup.visible = true;
        p.mesh.position.copy(p.apron);
        p.mesh.position.y = GROUND_Y;
        p.state = 'parked';
        p.stateT = 8;
        p.rollSpeed = 0;
        p.yaw = p.rw.takeoffHeading;
        p.mesh.rotation.set(0, p.yaw, 0);
        p.respawnTimer = 0;
        p.groundTime = 0;
      }
      return;
    }

    p.cooldown -= dt;
    p.missileCooldown -= dt;

    // ---- FAILSAFE: si lleva mucho tiempo en el suelo sin avanzar, resetear ----
    const onGround = p.mesh.position.y < 3;
    const inGroundState = p.state === 'parked' || p.state === 'taxi_out' || p.state === 'taxi_in';
    if (onGround && !inGroundState && p.state !== 'takeoff' && p.state !== 'rollout') {
      p.groundTime += dt;
    } else {
      p.groundTime = 0;
    }
    if (p.groundTime > 15) {
      console.warn(`⚠️ Caza ${p.team} trabado en suelo, reseteando`);
      p.state = 'parked';
      p.mesh.position.copy(p.apron);
      p.mesh.position.y = GROUND_Y;
      p.yaw = p.rw.takeoffHeading;
      p.mesh.rotation.set(0, p.yaw, 0);
      p.stateT = 5;
      p.rollSpeed = 0;
      p.groundTime = 0;
      return;
    }

    // ================== MÁQUINA DE ESTADOS ==================
    switch (p.state) {

      // ---------- APARCADO ----------
      case 'parked': {
        p.stateT -= dt;
        stepToward(p.mesh.position, p.apron, TAXI_SPEED * dt);
        p.yaw = rotateSmooth(p.yaw, p.rw.takeoffHeading, dt, 2);
        p.mesh.rotation.set(0, p.yaw, 0);
        if (p.stateT <= 0) {
          p.state = 'taxi_out';
        }
        return;
      }

      // ---------- RODAJE AL PUNTO DE DESPEGUE ----------
      case 'taxi_out': {
        const target = p.rw.takeoffStart.clone();
        target.y = GROUND_Y;
        stepToward(p.mesh.position, target, TAXI_SPEED * dt);
        const dx = target.x - p.mesh.position.x;
        const dz = target.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.5) {
          p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        }
        p.mesh.position.y = GROUND_Y;
        p.mesh.rotation.set(0, p.yaw, 0);
        // Llegó a la cabecera → despegar
        if (p.mesh.position.distanceTo(target) < 3) {
          p.state = 'takeoff';
          p.rollSpeed = 0;
        }
        return;
      }

      // ---------- CARRERA DE DESPEGUE ----------
      case 'takeoff': {
        p.rollSpeed = Math.min(ROLL_SPEED, p.rollSpeed + 45 * dt);
        p.mesh.position.addScaledVector(p.rw.takeoffDir, p.rollSpeed * dt);
        p.mesh.position.y = GROUND_Y;
        p.yaw = rotateSmooth(p.yaw, p.rw.takeoffHeading, dt, 4);
        p.mesh.rotation.set(0, p.yaw, 0);
        for (const f of p.flames) f.visible = true;
        // Pasó la cabecera opuesta → ascender
        const distFromStart = p.mesh.position.distanceTo(p.rw.takeoffStart);
        if (distFromStart > 125) {
          p.state = 'climb';
          p.climbT = 0;
        }
        return;
      }

      // ---------- ASCENSO ----------
      case 'climb': {
        p.climbT = (p.climbT || 0) + dt;
        const dur = 2.5;
        const k = Math.min(1, p.climbT / dur);
        p.mesh.position.addScaledVector(p.rw.takeoffDir, CRUISE_SPEED * dt);
        p.mesh.position.y = GROUND_Y + k * (CRUISE_ALT - GROUND_Y);
        p.yaw = rotateSmooth(p.yaw, p.rw.takeoffHeading, dt, 3);
        p.mesh.rotation.set(-0.2 * (1 - k), p.yaw, 0);   // nariz arriba suavemente
        if (k >= 1) {
          p.state = 'combat';
          p.combatTime = 0;
          p.mesh.rotation.set(0, p.yaw, 0);
        }
        return;
      }

      // ---------- COMBATE ----------
      case 'combat': {
        p.combatTime += dt;
        runCombat(p, dt);
        // Vuelve a base tras 40s o si está dañado
        if (p.combatTime > 40 || p.hp < 35) {
          p.state = 'return';
        }
        return;
      }

      // ---------- REGRESO ----------
      case 'return': {
        const wp = p.rw.approach.clone();
        wp.y = CRUISE_ALT;
        const r = stepToward(p.mesh.position, wp, CRUISE_SPEED * dt);
        const dx = wp.x - p.mesh.position.x;
        const dz = wp.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 1) {
          p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        }
        p.mesh.rotation.set(0, p.yaw, 0);
        p.mesh.position.y = CRUISE_ALT;   // mantener altitud
        for (const f of p.flames) f.visible = true;
        if (r.distance < 5) {
          p.state = 'approach';
          p.approachStart = p.mesh.position.clone();
          p.approachT = 0;
        }
        return;
      }

      // ---------- APROXIMACIÓN FINAL (descenso) ----------
      case 'approach': {
        // Interpolación lineal desde approachStart hasta threshold
        p.approachT = (p.approachT || 0) + dt;
        const start = p.approachStart;
        const end = p.rw.threshold.clone();
        end.y = GROUND_Y;
        const total = start.distanceTo(end);
        const covered = p.approachT * CRUISE_SPEED;
        const k = Math.min(1, covered / total);
        p.mesh.position.lerpVectors(start, end, k);
        // Encarar hacia el threshold
        const dx = end.x - p.mesh.position.x;
        const dz = end.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 1) {
          p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        }
        p.mesh.rotation.set(-0.15 * (1 - k), p.yaw, 0);   // nariz ligeramente arriba
        for (const f of p.flames) f.visible = false;
        // Llegó al threshold → tocar tierra
        if (k >= 1 || p.mesh.position.distanceTo(end) < 3) {
          p.mesh.position.copy(end);
          p.mesh.position.y = GROUND_Y;
          p.yaw = p.rw.landingHeading;
          p.mesh.rotation.set(0, p.yaw, 0);
          p.state = 'rollout';
          p.rollSpeed = 55;
        }
        return;
      }

      // ---------- RODADURA TRAS ATERRIZAR ----------
      case 'rollout': {
        p.rollSpeed = Math.max(0, p.rollSpeed - 22 * dt);
        p.mesh.position.addScaledVector(p.rw.landingDir, p.rollSpeed * dt);
        p.mesh.position.y = GROUND_Y;
        p.yaw = p.rw.landingHeading;
        p.mesh.rotation.set(0, p.yaw, 0);
        const dEnd = p.mesh.position.distanceTo(p.rw.rolloutEnd);
        if (p.rollSpeed < 1 || dEnd < 5) {
          p.state = 'taxi_in';
        }
        return;
      }

      // ---------- RODAJE AL APRON ----------
      case 'taxi_in': {
        stepToward(p.mesh.position, p.apron, TAXI_SPEED * dt);
        const dx = p.apron.x - p.mesh.position.x;
        const dz = p.apron.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.5) {
          p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        }
        p.mesh.position.y = GROUND_Y;
        p.mesh.rotation.set(0, p.yaw, 0);
        if (p.mesh.position.distanceTo(p.apron) < 2) {
          p.state = 'parked';
          p.stateT = 15 + rnd(0, 8);
          p.hp = Math.min(p.maxHp, p.hp + 60);
          p.yaw = p.rw.takeoffHeading;
          p.mesh.rotation.set(0, p.yaw, 0);
        }
        return;
      }

      default: {
        // Estado desconocido → forzar parked
        p.state = 'parked';
        p.mesh.position.copy(p.apron);
        p.mesh.position.y = GROUND_Y;
        p.stateT = 5;
        return;
      }
    }
  }

  // ===================== COMBATE (reutilizable) =====================
  function runCombat(p, dt) {
    // Objetivos aéreos enemigos que estén en vuelo
    let target = null, tDist = 1e9;
    for (const c of mod.planes.concat(mod.helis)) {
      if (c.team === p.team || c.isDead) continue;
      if (c.type === 'plane' && (c.state === 'parked' || c.state === 'taxi_out' || c.state === 'taxi_in' || c.state === 'takeoff' || c.state === 'rollout')) continue;
      const d = p.mesh.position.distanceTo(c.mesh.position);
      if (d < tDist) { tDist = d; target = c; }
    }
    // Objetivos terrestres
    let gt = null, gDist = 1e9;
    if (!target || tDist > 120) {
      for (const s of API.soldiers) {
        if (s.team === p.team || s.hp <= 0) continue;
        const d = p.mesh.position.distanceTo(s.mesh.position);
        if (d < gDist) { gDist = d; gt = s; }
      }
    }

    // Patrulla / persecución
    if (target && tDist < 180) {
      p.patrolAngle += dt * 0.5;
      _d.copy(target.mesh.position);
      _d.y = CRUISE_ALT;
      _d.x += Math.cos(p.patrolAngle * 3) * 25;
      _d.z += Math.sin(p.patrolAngle * 3) * 25;
    } else {
      p.patrolAngle += dt * 0.15;
      const cz = p.team === 'ally' ? -50 : 50;
      _d.set(Math.cos(p.patrolAngle) * p.patrolRadius, CRUISE_ALT, cz + Math.sin(p.patrolAngle) * p.patrolRadius);
    }

    const dir = _p.copy(_d).sub(p.mesh.position);
    const dist = dir.length();
    if (dist > 0.5) {
      dir.normalize();
      p.mesh.position.addScaledVector(dir, Math.min(CRUISE_SPEED * dt, dist));
      const yawT = yawFromDir(dir.x, dir.z);
      p.yaw = rotateSmooth(p.yaw, yawT, dt, 4);
      p.mesh.rotation.y = p.yaw;
      p.mesh.rotation.x = -dir.y * 0.4;
      // Roll suave
      let yawDiff = yawT - p.yaw;
      while (yawDiff >  Math.PI) yawDiff -= 2 * Math.PI;
      while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
      p.mesh.rotation.z = -yawDiff * 1.2;
    }

    // Disparar cañón
    if (target && p.cooldown <= 0 && tDist < 160) {
      API.fireProjectile(p.mesh.position.clone(), target.mesh.position.clone(), 0xffff44, 22, p.team);
      API.playSound('shot');
      p.cooldown = 0.12;
    } else if (gt && p.cooldown <= 0 && gDist < 60) {
      API.fireProjectile(p.mesh.position.clone(), gt.mesh.position.clone(), 0xffff44, 15, p.team);
      API.playSound('shot');
      p.cooldown = 0.25;
    }
    // Misil
    if (target && p.missileCooldown <= 0 && tDist < 130 && tDist > 25) {
      API.fireProjectile(p.mesh.position.clone(), target.mesh.position.clone(), 0xff6600, 60, p.team);
      API.playSound('explosion');
      p.missileCooldown = 3.5;
    }

    // Flamas
    for (const f of p.flames) { f.visible = true; f.scale.setScalar(0.7 + Math.random() * 0.6); }

    if (p.hp <= 0) {
      p.isDead = true;
      p.respawnTimer = 0;
      p.mesh.rotation.set(0, p.yaw, 0);
      API.playSound('explosion');
    }
  }

  // ===================== UPDATE HELIS =====================
  function updateHeli(h, dt) {
    if (h.isDead) {
      h.respawnTimer += dt;
      h.mesh.visible = false;
      if (h.hpGroup) h.hpGroup.visible = false;
      if (h.respawnTimer > 12) {
        h.hp = h.maxHp; h.isDead = false;
        h.mesh.visible = true; if (h.hpGroup) h.hpGroup.visible = true;
        h.mesh.position.copy(h.basePos);
        h.respawnTimer = 0;
      }
      return;
    }
    if (h.rotorMain) h.rotorMain.rotation.y += 40 * dt;
    if (h.rotorTail) h.rotorTail.rotation.x += 45 * dt;
    h.cooldown -= dt; h.missileCooldown -= dt;

    let target = null, tDist = 1e9;
    for (const c of mod.planes.concat(mod.helis)) {
      if (c.team === h.team || c.isDead) continue;
      if (c.type === 'plane' && (c.state === 'parked' || c.state === 'taxi_out' || c.state === 'taxi_in' || c.state === 'takeoff' || c.state === 'rollout')) continue;
      const d = h.mesh.position.distanceTo(c.mesh.position);
      if (d < tDist) { tDist = d; target = c; }
    }
    let gt = null, gDist = 1e9;
    if (!target || tDist > 90) {
      for (const s of API.soldiers) {
        if (s.team === h.team || s.hp <= 0) continue;
        const d = h.mesh.position.distanceTo(s.mesh.position);
        if (d < gDist) { gDist = d; gt = s; }
      }
      for (const v of API.vehicles.concat(API.tanks)) {
        if (v.team === h.team || v.hp <= 0) continue;
        const d = h.mesh.position.distanceTo(v.mesh.position);
        if (d < gDist) { gDist = d; gt = v; }
      }
    }

    const altBase = 18;
    if (target && tDist < 160) {
      h.strafeTimer += dt;
      _d.copy(target.mesh.position); _d.y = altBase;
      _d.x += Math.cos(h.strafeTimer * 1.5) * 30;
      _d.z += Math.sin(h.strafeTimer * 1.5) * 30;
    } else if (gt) {
      h.strafeTimer += dt;
      _d.copy(gt.mesh.position); _d.y = altBase;
      _d.x += Math.cos(h.strafeTimer * 1.2) * 28;
      _d.z += Math.sin(h.strafeTimer * 1.2) * 28;
    } else {
      h.patrolAngle += dt * 0.3;
      const cz = h.team === 'ally' ? -30 : 30;
      _d.set(Math.cos(h.patrolAngle) * 60, altBase + Math.sin(h.patrolAngle * 2) * 5, cz + Math.sin(h.patrolAngle) * 60);
    }

    const dir = _p.copy(_d).sub(h.mesh.position);
    const dist = dir.length();
    if (dist > 0.5) {
      dir.normalize();
      h.mesh.position.addScaledVector(dir, Math.min(h.speed * dt, dist));
      const yawT = yawFromDir(dir.x, dir.z);
      h.yaw = rotateSmooth(h.yaw, yawT, dt, 3);
      h.mesh.rotation.y = h.yaw;
      h.mesh.rotation.z = -0.6 * (yawT - h.yaw);
    }

    if (h.turret) {
      const tgtPos = target ? target.mesh.position : (gt ? gt.mesh.position : null);
      if (tgtPos) {
        const dx = tgtPos.x - h.mesh.position.x;
        const dz = tgtPos.z - h.mesh.position.z;
        const relYaw = yawFromDir(dx, dz) - h.yaw;
        h.turret.rotation.y += (relYaw - h.turret.rotation.y) * Math.min(1, dt * 4);
      }
    }

    if (target && h.cooldown <= 0 && tDist < 90) {
      const m = h.mesh.position.clone(); m.y -= 0.5;
      API.fireProjectile(m, target.mesh.position.clone(), 0xffff00, 12, h.team);
      API.playSound('shot'); h.cooldown = 0.18;
    } else if (gt && h.cooldown <= 0 && gDist < 70) {
      const m = h.mesh.position.clone(); m.y -= 0.5;
      API.fireProjectile(m, gt.mesh.position.clone(), 0xffff00, 15, h.team);
      API.playSound('shot'); h.cooldown = 0.2;
    }
    if (target && h.missileCooldown <= 0 && tDist < 100 && tDist > 20) {
      API.fireProjectile(h.mesh.position.clone(), target.mesh.position.clone(), 0xff4400, 70, h.team);
      API.playSound('explosion'); h.missileCooldown = 4;
    }
    if (h.hp <= 0) { h.isDead = true; h.respawnTimer = 0; API.playSound('explosion'); }
  }

  // ===================== DAÑO DEL MOD =====================
  function resolveModDamage() {
    const all = [...mod.planes, ...mod.helis, ...mod.hqs];
    for (let i = API.projectiles.length - 1; i >= 0; i--) {
      const pr = API.projectiles[i];
      if (!pr || !pr.mesh) continue;
      for (const u of all) {
        if (u.isDead) continue;
        if (u.team === pr.team) continue;
        const r = (u.radius || 4) + 1.5;
        if (pr.mesh.position.distanceTo(u.mesh.position) < r) {
          u.hp -= pr.damage;
          API.scene.remove(pr.mesh);
          API.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  // ===================== ANIMACIONES ESCENARIO =====================
  function updateSmokes(dt) {
    for (const s of mod.smokes) {
      s.t += dt;
      s.mesh.position.y = s.baseY + (s.t % 4) * 2.5;
      s.mesh.scale.setScalar(1 + (s.t % 4) * 0.35);
      s.mesh.material.opacity = 0.55 * (1 - (s.t % 4) / 4);
      if (s.t % 4 > 3.9) s.t = 0;
    }
  }
  function updateClouds(dt) {
    for (const c of mod.clouds) {
      c.mesh.position.x += c.speed * dt;
      c.mesh.position.z += c.drift * dt;
      if (c.mesh.position.x > 340) {
        c.mesh.position.x = -340;
        c.mesh.position.z = rnd(-320, 320);
      }
    }
  }
  function updateHQHUD() {
    const ally = mod.hqs.find(h => h.team === 'ally');
    const enemy = mod.hqs.find(h => h.team === 'enemy');
    if (ally) {
      const pct = Math.max(0, ally.hp / ally.maxHp * 100);
      document.getElementById('hq-ally-bar').style.width = pct + '%';
      document.getElementById('hq-ally-txt').textContent = Math.round(pct) + '%';
    }
    if (enemy) {
      const pct = Math.max(0, enemy.hp / enemy.maxHp * 100);
      document.getElementById('hq-enemy-bar').style.width = pct + '%';
      document.getElementById('hq-enemy-txt').textContent = Math.round(pct) + '%';
    }
    let airborne = 0;
    for (const p of mod.planes) {
      if (!p.isDead && p.state !== 'parked' && p.state !== 'taxi_out' && p.state !== 'taxi_in' && p.state !== 'takeoff' && p.state !== 'rollout') airborne++;
    }
    const el = document.getElementById('hq-airborne');
    if (el) el.textContent = airborne;
  }
  function checkWinLose() {
    const ally = mod.hqs.find(h => h.team === 'ally');
    const enemy = mod.hqs.find(h => h.team === 'enemy');
    if (ally && ally.hp <= 0 && !ally.isDead) { ally.isDead = true; showEndScreen(false); }
    if (enemy && enemy.hp <= 0 && !enemy.isDead) { enemy.isDead = true; showEndScreen(true); }
  }

  // ===================== HOOK =====================
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    if (mod.gameOver) return;
    for (const hq of mod.hqs) if (hq.radarGroup) hq.radarGroup.rotation.y += dt * 0.9;
    for (const ap of [allyAirport, enemyAirport]) if (ap.radarPivot) ap.radarPivot.rotation.y += dt * 1.3;
    for (const p of mod.planes) { try { updatePlane(p, dt); } catch (e) { console.error('plane err', e); } }
    for (const h of mod.helis)  { try { updateHeli(h, dt);  } catch (e) { console.error('heli err', e); } }
    updateSmokes(dt);
    updateClouds(dt);
    resolveModDamage();
    updateHQHUD();
    checkWinLose();
  };

  window.AirConquestMod = {
    version: '3.0',
    hqs: mod.hqs,
    planes: mod.planes,
    helis: mod.helis,
  };

  console.log(`✈️ Mod Aire y Conquista v3.0 listo — ${mod.planes.length} cazas con ciclo de vuelo corregido, ${mod.helis.length} helis, ${mod.clouds.length} nubes.`);
})();