/* ============================================================
   MOD: Aire y Conquista v1.0
   Añade: aeropuertos, cazas, helicópteros de ataque, cuarteles HQ,
   HUD de bases y condiciones de victoria/derrota.
   Uso: colócalo como modificaciones/aire_conquista.js
   ============================================================ */
(function () {
  if (window.__AIRCONQUEST_LOADED) { console.warn('⚠️ Mod ya cargado'); return; }
  window.__AIRCONQUEST_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('❌ IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);

  console.log('✈️ Mod Aire y Conquista v1.0: iniciando...');
  API.say('✈️ Aire y Conquista v1.0 cargado');

  // ======================== ESTADO ========================
  const mod = {
    planes: [],
    helis: [],
    hqs: [],
    gameOver: false,
    winner: null,
  };

  // ======================== HUD DE BASES ========================
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
  `;
  document.body.appendChild(hudHq);

  // ======================== OVERLAY FIN DE PARTIDA ========================
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
    const t = document.getElementById('ov-title');
    const s = document.getElementById('ov-sub');
    if (win) {
      t.textContent = '¡VICTORIA!';
      t.style.color = '#4fc3ff';
      s.textContent = 'Has destruido el cuartel enemigo';
    } else {
      t.textContent = 'DERROTA';
      t.style.color = '#ff4444';
      s.textContent = 'Tu cuartel ha sido destruido';
    }
    overlay.style.display = 'flex';
  }

  // ======================== HELPERS ========================
  function addHealthBar(unit, yOffset, width) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false }));
    fg.position.z = 0.01;
    g.add(bg); g.add(fg);
    g.renderOrder = 999;
    API.scene.add(g);
    unit.hpGroup = g;
    unit.hpBar = fg;
    unit.hpYOffset = yOffset;
    unit.hpWidth = width;
  }

  // ======================== DECORACIÓN: MONTAÑAS LEJANAS ========================
  function addDistantMountains() {
    const matRock = new THREE.MeshLambertMaterial({ color: 0x6a7a6a });
    const matSnow = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const g = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const rad = 260 + rnd(-15, 15);
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const h = rnd(25, 55);
      const r = rnd(18, 32);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), matRock);
      peak.position.set(x, h / 2 - 3, z);
      peak.rotation.y = rnd(0, Math.PI);
      g.add(peak);
      // Nieve en la cima
      const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.32, 5), matSnow);
      snow.position.set(x, h - h * 0.16 - 3, z);
      snow.rotation.y = peak.rotation.y;
      g.add(snow);
    }
    API.scene.add(g);
  }

  // ======================== CUARTEL HQ ========================
  function buildHQ(team, x, z) {
    const color = team === 'ally' ? 0x0055ff : 0xff2222;
    const mat      = new THREE.MeshLambertMaterial({ color });
    const matDark  = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matConc  = new THREE.MeshLambertMaterial({ color: 0x8a8a80 });

    const g = new THREE.Group();
    g.position.set(x, 0, z);
    API.scene.add(g);

    const add = (w, h, d, m, xx, yy, zz) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(xx, yy, zz);
      o.castShadow = true; o.receiveShadow = true;
      g.add(o);
      return o;
    };

    // Plataforma de hormigón
    add(26, 0.5, 26, matConc, 0, 0.25, 0);

    // Murallas
    add(26, 3.5, 0.9, mat, 0, 2.0, -12.5);
    add(26, 3.5, 0.9, mat, 0, 2.0,  12.5);
    add(0.9, 3.5, 26, mat, -12.5, 2.0, 0);
    add(0.9, 3.5, 26, mat,  12.5, 2.0, 0);

    // Torretas de esquina
    for (const [cx, cz] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
      add(3.2, 6, 3.2, matDark, cx, 3, cz);
      const canon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.28, 4.5, 10),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      canon.rotation.x = Math.PI / 2;
      canon.position.set(cx, 5, cz);
      g.add(canon);
    }

    // Búnker central
    add(9, 9, 9, matConc, 0, 4.5, 0);
    add(9.6, 0.6, 9.6, mat, 0, 9.3, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      add(0.5, 9.5, 0.5, matDark, Math.cos(a) * 4.4, 4.75, Math.sin(a) * 4.4);
    }

    // Mástil y radar
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 8), matDark);
    mast.position.set(0, 13, 0);
    g.add(mast);

    const radarGroup = new THREE.Group();
    radarGroup.position.set(0, 15.5, 0);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
    radar.rotation.x = 0.4;
    radarGroup.add(radar);
    g.add(radarGroup);

    // Bandera
    const bandera = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    bandera.position.set(0, 13.5, 0.5);
    g.add(bandera);

    const hq = {
      type: 'hq', team, mesh: g,
      hp: 3000, maxHp: 3000, radius: 14,
      isDead: false, radarGroup, bandera,
      basePos: V(x, 0, z),
    };
    addHealthBar(hq, 20, 18);
    mod.hqs.push(hq);
    return hq;
  }

  // ======================== AEROPUERTO ========================
  function buildAirport(team, x, z, rotY) {
    const color = team === 'ally' ? 0x0055ff : 0xff2222;
    const matAccent = new THREE.MeshLambertMaterial({ color });
    const matAsphalt = new THREE.MeshLambertMaterial({ color: 0x252525 });
    const matConc    = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matMetal   = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const matGlass   = new THREE.MeshLambertMaterial({ color: 0x2a5a7a, emissive: 0x0a2030 });

    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    g.rotation.y = rotY;
    API.scene.add(g);

    const add = (w, h, d, m, xx, yy, zz) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(xx, yy, zz);
      o.castShadow = true; o.receiveShadow = true;
      g.add(o);
      return o;
    };

    // -------- PISTA --------
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(16, 100), matAsphalt);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.02, 0);
    runway.receiveShadow = true;
    g.add(runway);

    // Marcas centrales
    for (let i = -7; i <= 7; i++) {
      const marca = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3.5),
        new THREE.MeshBasicMaterial({ color: 0xdddddd }));
      marca.rotation.x = -Math.PI / 2;
      marca.position.set(0, 0.04, i * 6.5);
      g.add(marca);
    }
    // Umbrales
    for (const zEnd of [-47, 47]) {
      for (let i = -3; i <= 3; i++) {
        const u = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.5),
          new THREE.MeshBasicMaterial({ color: 0xdddddd }));
        u.rotation.x = -Math.PI / 2;
        u.position.set(i * 2.4, 0.04, zEnd);
        g.add(u);
      }
    }
    // Luces
    for (let i = -8; i <= 8; i++) {
      for (const xx of [-8.5, 8.5]) {
        const luz = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffaa00 : 0x00ff88 }));
        luz.position.set(xx, 0.16, i * 6);
        g.add(luz);
      }
    }

    // -------- HANGARES --------
    for (const hx of [-24, 24]) {
      const hz = 6;
      add(16, 0.5, 16, matConc, hx, 0.25, hz);
      add(16, 5.5, 0.6, matMetal, hx, 3, hz - 8);
      add(16, 5.5, 0.6, matMetal, hx, 3, hz + 8);
      add(0.6, 5.5, 16, matMetal, hx - 8, 3, hz);
      add(15, 4.6, 0.5, matAccent, hx, 2.6, hz + 8.1);
      // Techo inclinado
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 9), matMetal);
      t1.position.set(hx, 6.2, hz - 4);
      t1.rotation.x = -0.35;
      g.add(t1);
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 9), matMetal);
      t2.position.set(hx, 6.2, hz + 4);
      t2.rotation.x = 0.35;
      g.add(t2);
    }

    // -------- TORRE DE CONTROL --------
    const tx = -32, tz = -16;
    add(7, 15, 7, matConc, tx, 7.5, tz);
    add(9, 3.5, 9, matGlass, tx, 17, tz);
    add(9.5, 0.5, 9.5, matMetal, tx, 19, tz);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), matMetal);
    ant.position.set(tx, 21.8, tz);
    g.add(ant);

    const radarPivot = new THREE.Group();
    radarPivot.position.set(tx, 23.5, tz);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 0.8), matMetal);
    radarPivot.add(radar);
    g.add(radarPivot);

    // -------- DEPÓSITOS DE COMBUSTIBLE --------
    for (let i = 0; i < 3; i++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 4.5, 16), matMetal);
      tank.position.set(-28 + i * 6.5, 2.25, 20);
      tank.castShadow = true;
      g.add(tank);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.35, 16), matAccent);
      cap.position.set(-28 + i * 6.5, 4.65, 20);
      g.add(cap);
    }

    return { team, mesh: g, x, z, rotY, radarPivot };
  }

  // ======================== CAZA (Fighter) ========================
  function buildFighter(color, team, x, z) {
    const matBody   = new THREE.MeshLambertMaterial({ color });
    const matDark   = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matGlass  = new THREE.MeshLambertMaterial({ color: 0x0e1a2a });
    const matMetal  = new THREE.MeshLambertMaterial({ color: 0x666666 });

    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (ry) m.rotation.y = ry;
      if (rz) m.rotation.z = rz;
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // Fuselaje (nose at +Z)
    add(new THREE.BoxGeometry(1.7, 1.4, 9), matBody, 0, 0, 0);
    add(new THREE.BoxGeometry(1.3, 1.0, 3.5), matBody, 0, 0.1, -5.5);

    // Nariz
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.2, 10), matBody);
    nose.rotation.x = Math.PI / 2;   // apuntando a +Z
    nose.position.set(0, 0, 5.5);
    nose.castShadow = true;
    g.add(nose);

    // Punta roja
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 10),
      new THREE.MeshBasicMaterial({ color: 0xcc2222 }));
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0, 7.2);
    g.add(tip);

    // Cabina
    add(new THREE.BoxGeometry(0.95, 0.75, 2.8), matGlass, 0, 0.9, -0.8);
    add(new THREE.BoxGeometry(0.95, 0.45, 1.5), matGlass, 0, 0.98, 1.4);

    // Alas con flecha
    const wl = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody, -2.6, 0, 0.6);
    wl.rotation.z = 0.14;
    const wr = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody,  2.6, 0, 0.6);
    wr.rotation.z = -0.14;

    // Puntas de ala
    add(new THREE.BoxGeometry(0.85, 0.45, 1.4), matDark, -4.6, 0.2, 1.0);
    add(new THREE.BoxGeometry(0.85, 0.45, 1.4), matDark,  4.6, 0.2, 1.0);

    // Misiles aire-aire bajo las alas
    for (const wx of [-3.0, 3.0]) {
      for (const wz of [0.2, 1.4]) {
        const msl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.8, 8), matMetal);
        msl.rotation.x = Math.PI / 2;
        msl.position.set(wx, -0.45, wz);
        g.add(msl);
        // Punta
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), matDark);
        t.rotation.x = Math.PI / 2;
        t.position.set(wx, -0.45, wz + 1.65);
        g.add(t);
      }
    }

    // Timón vertical
    const tailV = add(new THREE.BoxGeometry(0.32, 2.6, 2), matBody, 0, 1.5, -4.5);
    tailV.rotation.x = -0.25;

    // Estabilizador horizontal
    add(new THREE.BoxGeometry(3.8, 0.28, 1.3), matBody, 0, 0, -4.8);

    // Motores gemelos
    for (const ex of [-0.7, 0.7]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2, 12), matDark);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(ex, -0.2, -5.5);
      g.add(eng);
    }

    // Postquemadores
    const flames = [];
    for (const ex of [-0.7, 0.7]) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.85 })
      );
      f.rotation.x = -Math.PI / 2;
      f.position.set(ex, -0.2, -7.0);
      g.add(f);
      flames.push(f);
    }

    API.scene.add(g);

    const unit = {
      type: 'plane', team, mesh: g,
      hp: 90, maxHp: 90, radius: 4.5, speed: 55,
      isDead: false, respawnTimer: 0,
      basePos: V(x, 32, z),
      targetPos: V(x, 32, z),
      cooldown: 0, missileCooldown: 0,
      flames,
      state: 'patrol',
      patrolAngle: Math.random() * Math.PI * 2,
      patrolRadius: rnd(60, 110),
      yaw: team === 'ally' ? 0 : Math.PI,
      pitch: 0, roll: 0,
    };
    unit.mesh.rotation.order = 'YXZ';
    addHealthBar(unit, 3.5, 3.2);
    mod.planes.push(unit);
    return unit;
  }

  // ======================== HELICÓPTERO DE ATAQUE ========================
  function buildAttackHeli(color, team, x, z) {
    const matBody   = new THREE.MeshLambertMaterial({ color });
    const matDark   = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matGlass  = new THREE.MeshLambertMaterial({ color: 0x0e1a2a });
    const matMetal  = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const matRotor  = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (ry) m.rotation.y = ry;
      if (rz) m.rotation.z = rz;
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // Fuselaje
    add(new THREE.BoxGeometry(2.6, 2.1, 6), matBody, 0, 0, 0);
    // Nariz
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 12), matBody);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 4);
    nose.castShadow = true;
    g.add(nose);

    // Cabina de cristal
    add(new THREE.BoxGeometry(2.0, 1.5, 1.7), matGlass, 0, 0.35, 1.8);

    // Cola
    add(new THREE.BoxGeometry(0.7, 0.7, 5), matBody, 0, 0.3, -5.5);
    // Estabilizador de cola
    add(new THREE.BoxGeometry(3.2, 0.16, 1.1), matBody, 0, 0.3, -7.2);

    // Rotor de cola
    const rotorTail = new THREE.Group();
    rotorTail.position.set(0.45, 0.3, -8);
    const tailBlade1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.15), matRotor);
    const tailBlade2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 2.4), matRotor);
    rotorTail.add(tailBlade1); rotorTail.add(tailBlade2);
    g.add(rotorTail);

    // Patines
    for (const sx of [-1.05, 1.05]) {
      add(new THREE.BoxGeometry(0.16, 0.16, 4.5), matMetal, sx, -1.5, 0.5);
      add(new THREE.BoxGeometry(0.16, 1.3, 0.16), matMetal, sx, -0.75, -1.4);
      add(new THREE.BoxGeometry(0.16, 1.3, 0.16), matMetal, sx, -0.75, 2.2);
    }

    // Rotor principal (4 aspas)
    const rotorMain = new THREE.Group();
    rotorMain.position.set(0, 1.5, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8), matDark);
    mast.position.y = 0.45;
    rotorMain.add(mast);
    for (let i = 0; i < 4; i++) {
      const bg = new THREE.BoxGeometry(0.3, 0.06, 6.5);
      bg.translate(0, 0, 3.25);
      const blade = new THREE.Mesh(bg, matRotor);
      blade.rotation.y = (i / 4) * Math.PI * 2;
      blade.position.y = 0.9;
      rotorMain.add(blade);
    }
    g.add(rotorMain);

    // Alas con armas
    add(new THREE.BoxGeometry(6, 0.22, 0.9), matBody, 0, -0.2, 0.6);

    // Pods de cohetes
    for (const wx of [-2.4, -1.6, 1.6, 2.4]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 8), matDark);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(wx, -0.65, 0.9);
      g.add(pod);
      for (let r = 0; r < 4; r++) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 6),
          new THREE.MeshBasicMaterial({ color: 0x000000 }));
        tube.rotation.x = Math.PI / 2;
        tube.position.set(wx - 0.15 + (r % 2) * 0.3, -0.65 + (r < 2 ? 0.15 : -0.15), 1.78);
        g.add(tube);
      }
    }

    // Cañón bajo la nariz (torreta)
    const turret = new THREE.Group();
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.4, 8), matDark);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 0, 0.5);
    turret.add(cannon);
    turret.position.set(0, -1.0, 2.6);
    g.add(turret);

    // Motores
    for (const ex of [-0.8, 0.8]) {
      add(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 8), matDark, ex, 0.7, -2.8);
    }

    // Sensor / cámara
    add(new THREE.BoxGeometry(0.5, 0.5, 0.7), matDark, 0, 1.0, 3.2);

    API.scene.add(g);

    const unit = {
      type: 'heli', team, mesh: g,
      hp: 160, maxHp: 160, radius: 3.5, speed: 22,
      isDead: false, respawnTimer: 0,
      basePos: V(x, 20, z),
      targetPos: V(x, 20, z),
      cooldown: 0, missileCooldown: 0,
      rotorMain, rotorTail, turret,
      state: 'patrol',
      strafeTimer: Math.random() * 6,
      patrolAngle: Math.random() * Math.PI * 2,
      yaw: 0,
    };
    unit.mesh.rotation.order = 'YXZ';
    addHealthBar(unit, 3.5, 3);
    mod.helis.push(unit);
    return unit;
  }

  // ======================== CREAR EL MUNDO ========================
  addDistantMountains();
  const allyHQ  = buildHQ('ally',  0, -100);
  const enemyHQ = buildHQ('enemy', 0,  100);
  const allyAirport  = buildAirport('ally',  -78, -52, 0);
  const enemyAirport = buildAirport('enemy',  78,  52, Math.PI);

  // Cazas
  for (let i = 0; i < 3; i++) {
    buildFighter(0x0055ff, 'ally',  -78 + (i - 1) * 6, -70);
    buildFighter(0xff2222, 'enemy',  78 + (i - 1) * 6,  70);
  }
  // Helicópteros de ataque
  for (let i = 0; i < 2; i++) {
    buildAttackHeli(0x0055ff, 'ally',  -55 + i * 12, -80);
    buildAttackHeli(0xff2222, 'enemy',  55 - i * 12,  80);
  }

  // ======================== ACTUALIZACIÓN ========================
  const _d = new THREE.Vector3();
  const _p = new THREE.Vector3();

  function updatePlane(p, dt) {
    if (p.isDead) {
      p.respawnTimer += dt;
      p.mesh.visible = false;
      if (p.respawnTimer > 15) {
        p.hp = p.maxHp; p.isDead = false;
        p.mesh.visible = true;
        p.mesh.position.copy(p.basePos);
        p.respawnTimer = 0;
      }
      return;
    }

    p.cooldown -= dt;
    p.missileCooldown -= dt;

    // Buscar objetivos (aviones/helicópteros enemigos)
    let target = null, tDist = 1e9;
    for (const cand of mod.planes.concat(mod.helis)) {
      if (cand.team === p.team || cand.isDead) continue;
      const d = p.mesh.position.distanceTo(cand.mesh.position);
      if (d < tDist) { tDist = d; target = cand; }
    }

    // Buscar objetivo terrestre si no hay aéreo
    let groundTarget = null, gDist = 1e9;
    if (!target) {
      for (const s of API.soldiers) {
        if (s.team === p.team || s.hp <= 0) continue;
        const d = p.mesh.position.distanceTo(s.mesh.position);
        if (d < gDist) { gDist = d; groundTarget = s; }
      }
    }

    // Movimiento
    const altBase = 32;
    if (target && tDist < 180) {
      p.patrolAngle += dt * 0.5;
      _d.copy(target.mesh.position);
      _d.y = altBase;
      _d.x += Math.cos(p.patrolAngle * 3) * 25;
      _d.z += Math.sin(p.patrolAngle * 3) * 25;
    } else {
      p.patrolAngle += dt * 0.15;
      const cx = 0, cz = p.team === 'ally' ? -30 : 30;
      _d.set(
        cx + Math.cos(p.patrolAngle) * p.patrolRadius,
        altBase,
        cz + Math.sin(p.patrolAngle) * p.patrolRadius
      );
    }

    const dir = _p.copy(_d).sub(p.mesh.position);
    const dist = dir.length();
    if (dist > 0.5) {
      dir.normalize();
      p.mesh.position.addScaledVector(dir, Math.min(p.speed * dt, dist));
      const yawTarget = Math.atan2(dir.x, dir.z);
      let diff = yawTarget - p.yaw;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      p.yaw += diff * Math.min(1, dt * 4);
      p.pitch += (-dir.y * 0.8 - p.pitch) * Math.min(1, dt * 3);
      p.roll  += (-diff * 1.4 - p.roll) * Math.min(1, dt * 3);
      p.mesh.rotation.y = p.yaw;
      p.mesh.rotation.x = p.pitch;
      p.mesh.rotation.z = p.roll;
    }

    // Disparar cañón
    if (target && p.cooldown <= 0 && tDist < 160) {
      const muzzle = p.mesh.position.clone();
      API.fireProjectile(muzzle, target.mesh.position.clone(), 0xffff44, 22, p.team);
      API.playSound('shot');
      p.cooldown = 0.12;
    } else if (groundTarget && p.cooldown <= 0 && gDist < 60) {
      const muzzle = p.mesh.position.clone();
      API.fireProjectile(muzzle, groundTarget.mesh.position.clone(), 0xffff44, 15, p.team);
      API.playSound('shot');
      p.cooldown = 0.25;
    }

    // Misiles
    if (target && p.missileCooldown <= 0 && tDist < 130 && tDist > 25) {
      const muzzle = p.mesh.position.clone();
      API.fireProjectile(muzzle, target.mesh.position.clone(), 0xff6600, 60, p.team);
      API.playSound('explosion');
      p.missileCooldown = 3.5;
    }

    // Animación de llamas
    for (const f of p.flames) f.scale.setScalar(0.7 + Math.random() * 0.6);

    // Destrucción
    if (p.hp <= 0) {
      p.isDead = true;
      p.respawnTimer = 0;
      API.playSound('explosion');
      // Explosión visual
      API.scene.remove(p.mesh);
      API.scene.add(p.mesh);
    }
  }

  function updateHeli(h, dt) {
    if (h.isDead) {
      h.respawnTimer += dt;
      h.mesh.visible = false;
      if (h.respawnTimer > 12) {
        h.hp = h.maxHp; h.isDead = false;
        h.mesh.visible = true;
        h.mesh.position.copy(h.basePos);
        h.respawnTimer = 0;
      }
      return;
    }

    if (h.rotorMain) h.rotorMain.rotation.y += 40 * dt;
    if (h.rotorTail) h.rotorTail.rotation.x += 45 * dt;

    h.cooldown -= dt;
    h.missileCooldown -= dt;

    // Buscar objetivo (aéreo)
    let target = null, tDist = 1e9;
    for (const cand of mod.planes.concat(mod.helis)) {
      if (cand.team === h.team || cand.isDead) continue;
      const d = h.mesh.position.distanceTo(cand.mesh.position);
      if (d < tDist) { tDist = d; target = cand; }
    }

    // Objetivos terrestres
    let gTarget = null, gDist = 1e9;
    if (!target || tDist > 90) {
      for (const s of API.soldiers) {
        if (s.team === h.team || s.hp <= 0) continue;
        const d = h.mesh.position.distanceTo(s.mesh.position);
        if (d < gDist) { gDist = d; gTarget = s; }
      }
      for (const v of API.vehicles.concat(API.tanks)) {
        if (v.team === h.team || v.hp <= 0) continue;
        const d = h.mesh.position.distanceTo(v.mesh.position);
        if (d < gDist) { gDist = d; gTarget = v; }
      }
    }

    const altBase = 18;
    if (target && tDist < 160) {
      h.strafeTimer += dt;
      _d.copy(target.mesh.position);
      _d.y = altBase;
      _d.x += Math.cos(h.strafeTimer * 1.5) * 30;
      _d.z += Math.sin(h.strafeTimer * 1.5) * 30;
    } else if (gTarget) {
      h.strafeTimer += dt;
      _d.copy(gTarget.mesh.position);
      _d.y = altBase;
      _d.x += Math.cos(h.strafeTimer * 1.2) * 28;
      _d.z += Math.sin(h.strafeTimer * 1.2) * 28;
    } else {
      h.patrolAngle += dt * 0.3;
      const cz = h.team === 'ally' ? -20 : 20;
      _d.set(
        Math.cos(h.patrolAngle) * 60,
        altBase + Math.sin(h.patrolAngle * 2) * 5,
        cz + Math.sin(h.patrolAngle) * 60
      );
    }

    const dir = _p.copy(_d).sub(h.mesh.position);
    const dist = dir.length();
    if (dist > 0.5) {
      dir.normalize();
      h.mesh.position.addScaledVector(dir, Math.min(h.speed * dt, dist));
      const yawT = Math.atan2(dir.x, dir.z);
      let diff = yawT - h.yaw;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      h.yaw += diff * Math.min(1, dt * 3);
      h.mesh.rotation.y = h.yaw;
      h.mesh.rotation.z = -diff * 0.6;
    }

    // Apuntar torreta al objetivo
    if (h.turret && target) {
      const dx = target.mesh.position.x - h.mesh.position.x;
      const dz = target.mesh.position.z - h.mesh.position.z;
      const relYaw = Math.atan2(dx, dz) - h.yaw;
      h.turret.rotation.y += (relYaw - h.turret.rotation.y) * Math.min(1, dt * 4);
    } else if (h.turret && gTarget) {
      const dx = gTarget.mesh.position.x - h.mesh.position.x;
      const dz = gTarget.mesh.position.z - h.mesh.position.z;
      const relYaw = Math.atan2(dx, dz) - h.yaw;
      h.turret.rotation.y += (relYaw - h.turret.rotation.y) * Math.min(1, dt * 4);
    }

    // Disparar cañón
    if (target && h.cooldown <= 0 && tDist < 90) {
      const muzzle = h.mesh.position.clone(); muzzle.y -= 0.5;
      API.fireProjectile(muzzle, target.mesh.position.clone(), 0xffff00, 12, h.team);
      API.playSound('shot');
      h.cooldown = 0.18;
    } else if (gTarget && h.cooldown <= 0 && gDist < 70) {
      const muzzle = h.mesh.position.clone(); muzzle.y -= 0.5;
      API.fireProjectile(muzzle, gTarget.mesh.position.clone(), 0xffff00, 15, h.team);
      API.playSound('shot');
      h.cooldown = 0.2;
    }

    // Misiles
    if (target && h.missileCooldown <= 0 && tDist < 100 && tDist > 20) {
      API.fireProjectile(h.mesh.position.clone(), target.mesh.position.clone(), 0xff4400, 70, h.team);
      API.playSound('explosion');
      h.missileCooldown = 4;
    }

    if (h.hp <= 0) {
      h.isDead = true;
      h.respawnTimer = 0;
      API.playSound('explosion');
    }
  }

  // Resolución de daño: proyectiles del juego vs. unidades del mod
  function resolveModDamage() {
    const all = [...mod.planes, ...mod.helis, ...mod.hqs];
    for (let i = API.projectiles.length - 1; i >= 0; i--) {
      const p = API.projectiles[i];
      if (!p || !p.mesh) continue;
      for (const u of all) {
        if (u.isDead) continue;
        if (u.team === p.team) continue;
        const r = (u.radius || 4) + 1.5;
        if (p.mesh.position.distanceTo(u.mesh.position) < r) {
          u.hp -= p.damage;
          API.scene.remove(p.mesh);
          API.projectiles.splice(i, 1);
          break;
        }
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
  }

  function checkWinLose() {
    const ally = mod.hqs.find(h => h.team === 'ally');
    const enemy = mod.hqs.find(h => h.team === 'enemy');
    if (ally && ally.hp <= 0 && !ally.isDead) { ally.isDead = true; showEndScreen(false); }
    if (enemy && enemy.hp <= 0 && !enemy.isDead) { enemy.isDead = true; showEndScreen(true); }
  }

  // ======================== HOOK ========================
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    if (mod.gameOver) return;

    for (const hq of mod.hqs) if (hq.radarGroup) hq.radarGroup.rotation.y += dt * 0.9;
    for (const ap of [allyAirport, enemyAirport]) if (ap.radarPivot) ap.radarPivot.rotation.y += dt * 1.3;

    for (const p of mod.planes) updatePlane(p, dt);
    for (const h of mod.helis) updateHeli(h, dt);

    resolveModDamage();
    updateHQHUD();
    checkWinLose();
  };

  window.AirConquestMod = {
    version: '1.0',
    hqs: mod.hqs,
    planes: mod.planes,
    helis: mod.helis,
  };

  console.log(`✈️ Mod Aire y Conquista v1.0 listo — ${mod.planes.length} cazas, ${mod.helis.length} helicópteros, ${mod.hqs.length} cuarteles.`);
})();