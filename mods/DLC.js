/* ============================================================
   MOD: Aire y Conquista v5.0
   NUEVO:
   - Puentes REDISEÑADOS (limpios, alineados con carreteras)
   - COLISIÓN DE AGUA (unidades no cruzan el río caminando)
   - EDIFICIOS DESTRUCTIBLES de 2 pisos (colapso al destruir planta baja)
   - ÁRBOLES DESTRUCTIBLES (caen al recibir disparos)
   - SCREEN SHAKE + partículas de polvo al destruir
   - Todo lo de v4 (aviones, HQ, aeropuertos, etc.)
   ============================================================ */
(function () {
  if (window.__AC_V5_LOADED) { console.warn('⚠️ v5 ya cargado'); return; }
  window.__AC_V5_LOADED = true;
  window.__AIRCONQUEST_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('❌ IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);

  console.log('✈️ Mod Aire y Conquista v5.0: iniciando...');
  API.say('✈️ Aire y Conquista v5.0');

  // ===================== CONSTANTES =====================
  const GROUND_Y = 1.0;
  const CRUISE_ALT = 32;
  const TAXI_SPEED = 14;
  const ROLL_SPEED = 65;
  const CRUISE_SPEED = 52;
  const APPROACH_DIST = 170;
  const WORLD_SIZE = 900;
  const RIVER = { zMin: 42, zMax: 68, centerZ: 55 };
  const BRIDGES_X = [
    { xMin: -10, xMax: 10 },
    { xMin: -100, xMax: -80 },
    { xMin: 80, xMax: 100 },
  ];

  const ALLY_AIRPORT  = V(-60, 0, -200);
  const ENEMY_AIRPORT = V( 60, 0,  200);
  const ALLY_HQ_POS   = V(  0, 0, -280);
  const ENEMY_HQ_POS  = V(  0, 0,  280);

  const mod = { planes: [], helis: [], hqs: [], buildings: [], trees: [], smokes: [], clouds: [], dust: [], gameOver: false };
  let shakeAmount = 0;

  // ===================== HUD =====================
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

  // ===================== OVERLAY =====================
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
  function stepToward(pos, target, maxStep) {
    const dx = target.x - pos.x, dy = target.y - pos.y, dz = target.z - pos.z;
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (d < 0.001) return { arrived: true, distance: 0 };
    if (maxStep >= d) { pos.set(target.x, target.y, target.z); return { arrived: true, distance: 0 }; }
    const k = maxStep / d;
    pos.x += dx * k; pos.y += dy * k; pos.z += dz * k;
    return { arrived: false, distance: d - maxStep };
  }
  function rotateSmooth(cur, target, dt, speed) {
    let diff = target - cur;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return cur + diff * Math.min(1, dt * speed);
  }
  const yawFromDir = (dx, dz) => Math.atan2(dx, dz);

  // ===================== DUST PARTICLES =====================
  const dustMat = new THREE.MeshBasicMaterial({ color: 0xbbaa88, transparent: true, opacity: 0.85, depthWrite: false });
  function spawnDust(pos) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.2, 0.5), 5, 4), dustMat.clone());
      m.position.copy(pos);
      m.position.x += rnd(-0.8, 0.8);
      m.position.y += rnd(0, 1);
      m.position.z += rnd(-0.8, 0.8);
      API.scene.add(m);
      mod.dust.push({ mesh: m, vel: V(rnd(-1.5, 1.5), rnd(1, 3), rnd(-1.5, 1.5)), life: 0.9, t: 0 });
    }
  }
  function spawnSmokePlume(pos) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.4, 0.9), 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.7, depthWrite: false }));
      m.position.copy(pos);
      m.position.x += rnd(-1.5, 1.5);
      m.position.y += rnd(0, 2);
      m.position.z += rnd(-1.5, 1.5);
      API.scene.add(m);
      mod.dust.push({ mesh: m, vel: V(rnd(-0.8, 0.8), rnd(2, 5), rnd(-0.8, 0.8)), life: 2.2, t: 0 });
    }
  }

  // ===================== EXTENDER MUNDO =====================
  function extendWorld() {
    const bigGround = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
      new THREE.MeshLambertMaterial({ color: 0x4b6e36 })
    );
    bigGround.rotation.x = -Math.PI / 2;
    bigGround.position.y = -0.05;
    bigGround.renderOrder = -1;
    API.scene.add(bigGround);

    if (API.scene.fog) { API.scene.fog.near = 150; API.scene.fog.far = WORLD_SIZE; }
    if (API.scene.children) {
      for (const c of API.scene.children) {
        if (c.isDirectionalLight && c.shadow) {
          const d = WORLD_SIZE * 0.4;
          c.shadow.camera.left = -d; c.shadow.camera.right = d;
          c.shadow.camera.top = d; c.shadow.camera.bottom = -d;
          c.shadow.camera.updateProjectionMatrix();
        }
      }
    }
    console.log(`🗺️ Mundo extendido a ${WORLD_SIZE}×${WORLD_SIZE}`);
  }

  // ===================== NUBES =====================
  function addClouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const geo = new THREE.SphereGeometry(1, 7, 6);
    const R = WORLD_SIZE * 0.45;
    for (let i = 0; i < 55; i++) {
      const c = new THREE.Group();
      c.position.set(rnd(-R, R), rnd(55, 110), rnd(-R, R));
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
    const rBase = WORLD_SIZE * 0.42;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2, rad = rBase + rnd(-30, 30);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const h = rnd(35, 75), r = rnd(22, 40);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), matRock);
      peak.position.set(x, h / 2 - 3, z); peak.rotation.y = rnd(0, Math.PI); g.add(peak);
      const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.32, 5), matSnow);
      snow.position.set(x, h - h * 0.16 - 3, z); snow.rotation.y = peak.rotation.y; g.add(snow);
    }
    API.scene.add(g);
  }

  // ===================== RÍO (a z=55) + PUENTES PRO =====================
  function addRiverAndBridges() {
    const L = WORLD_SIZE - 80;
    // Agua
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(L, RIVER.zMax - RIVER.zMin),
      new THREE.MeshLambertMaterial({ color: 0x2a6fa8, transparent: true, opacity: 0.88 })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.07, RIVER.centerZ);
    API.scene.add(river);

    // Orillas de arena
    for (const zo of [RIVER.zMin - 1.5, RIVER.zMax + 1.5]) {
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(L, 3),
        new THREE.MeshLambertMaterial({ color: 0xd9c68f }));
      bank.rotation.x = -Math.PI / 2;
      bank.position.set(0, 0.06, zo);
      API.scene.add(bank);
    }

    // Puentes
    const matDeck = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });   // asfalto
    const matRieles = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    const matPilar = new THREE.MeshLambertMaterial({ color: 0x6a6a5a });
    const matMarca = new THREE.MeshBasicMaterial({ color: 0xdddddd });

    for (const bz of BRIDGES_X) {
      const centerX = (bz.xMin + bz.xMax) / 2;
      const width = bz.xMax - bz.xMin;
      const br = new THREE.Group();
      br.position.set(centerX, 0, RIVER.centerZ);

      // Deck al ras de la carretera (y=0.15 como las carreteras base)
      const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, 32), matDeck);
      deck.position.y = 0.15;
      deck.receiveShadow = true;
      br.add(deck);

      // Borde superior oscuro (línea de carretera)
      const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 32), matRieles);
      edgeL.position.set(-width / 2 + 0.3, 0.32, 0); br.add(edgeL);
      const edgeR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 32), matRieles);
      edgeR.position.set(width / 2 - 0.3, 0.32, 0); br.add(edgeR);

      // Marcas centrales dashed (alineadas con la carretera)
      for (let i = -2; i <= 2; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), matMarca);
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, 0.33, i * 5);
        br.add(m);
      }

      // Barandas laterales (bajas, estilo quitamiedos)
      for (const sx of [-width / 2, width / 2]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 32), matRieles);
        rail.position.set(sx, 0.8, 0);
        br.add(rail);
        // Postes cada 4m
        for (let i = -3; i <= 3; i++) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), matRieles);
          post.position.set(sx, 0.85, i * 4.5);
          br.add(post);
        }
      }

      // Pilares (3 pares) en el agua
      for (const pz of [-10, 0, 10]) {
        for (const px of [-width / 2 + 1.5, width / 2 - 1.5]) {
          const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 5, 8), matPilar);
          pilar.position.set(px, -2.4, pz);
          pilar.castShadow = true;
          br.add(pilar);
        }
      }

      API.scene.add(br);
    }
    console.log('🌉 Puentes: 3 construidos');
  }

  // ===================== ÁRBOL DESTRUCTIBLE =====================
  function addTree(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x594630 }));
    trunk.position.y = 1.25; trunk.castShadow = true;
    g.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({
      color: Math.random() < 0.5 ? 0x2f5f33 : 0x3a7038,
    });
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(rnd(1.8, 2.4), rnd(4, 6), 7), leafMat);
    leaves.position.y = 4.5; leaves.castShadow = true;
    g.add(leaves);
    API.scene.add(g);

    const tree = {
      mesh: g, trunk, leaves,
      hp: 40, maxHp: 40,
      state: 'alive',  // alive | falling | dead
      fallT: 0, fallDir: rnd(0, Math.PI * 2),
      respawnT: 0,
      radius: 1.8,
    };
    mod.trees.push(tree);
    return tree;
  }
  function destroyTree(tree) {
    if (tree.state !== 'alive') return;
    tree.state = 'falling';
    tree.fallT = 0;
    spawnDust(V(tree.mesh.position.x, 2, tree.mesh.position.z));
    API.playSound('explosion');
  }
  function updateTrees(dt) {
    for (const t of mod.trees) {
      if (t.state === 'falling') {
        t.fallT += dt;
        const k = Math.min(1, t.fallT / 1.2);
        // Caer girando
        t.mesh.rotation.z = Math.sin(k * Math.PI / 2) * (Math.PI / 2);
        t.mesh.rotation.y = t.fallDir;
        t.mesh.position.y = -Math.sin(k * Math.PI) * 0.5;
        if (k >= 1) {
          t.state = 'dead';
          t.respawnT = 0;
        }
      } else if (t.state === 'dead') {
        t.respawnT += dt;
        // Desvanecer (reducir escala)
        const s = Math.max(0, 1 - t.respawnT / 3);
        t.mesh.scale.setScalar(s);
        if (t.respawnT > 3) { t.mesh.visible = false; }
        if (t.respawnT > 45) {
          // Respawn
          t.state = 'alive';
          t.hp = t.maxHp;
          t.mesh.visible = true;
          t.mesh.rotation.set(0, 0, 0);
          t.mesh.position.y = 0;
          t.mesh.scale.setScalar(1);
        }
      }
    }
  }

  // ===================== EDIFICIO 2 PISOS DESTRUCTIBLE =====================
  function addBuilding(x, z, colorHue) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const matBase = new THREE.MeshLambertMaterial({ color: colorHue || 0xd8d2c4 });
    const matAccent = new THREE.MeshLambertMaterial({ color: 0x8a4a3a });
    const matWindow = new THREE.MeshBasicMaterial({ color: 0x2a4a6a });
    const matDoor = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    const matSlab = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matRoof = new THREE.MeshLambertMaterial({ color: 0x7a3a2a });

    const W = 8, H_floor = 4, D = 8, T = 0.5;

    // ================ PLANTA BAJA (grupo) ================
    const groundFloor = new THREE.Group();
    g.add(groundFloor);

    const groundWalls = [];
    // Paredes: [w, h, d, x, y, z]
    const wallDefs = [
      [W, H_floor, T,   0, H_floor/2, -D/2],  // atrás
      [W, H_floor, T,   0, H_floor/2,  D/2],  // frente
      [T, H_floor, D, -W/2, H_floor/2, 0],    // izq
      [T, H_floor, D,  W/2, H_floor/2, 0],    // der
    ];
    for (let i = 0; i < wallDefs.length; i++) {
      const [w, h, d, wx, wy, wz] = wallDefs[i];
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matBase);
      wall.position.set(wx, wy, wz);
      wall.castShadow = true; wall.receiveShadow = true;
      groundFloor.add(wall);
      groundWalls.push({ mesh: wall, hp: 100, maxHp: 100, size: [w, h, d], pos: [wx, wy, wz] });
    }

    // Ventanas planta baja (2 por pared frontal, trasera)
    for (const wall of ['front', 'back']) {
      const zPos = wall === 'front' ? D/2 + 0.01 : -D/2 - 0.01;
      for (const wx of [-2, 2]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), matWindow);
        win.position.set(wx, 2.2, zPos);
        if (wall === 'back') win.rotation.y = Math.PI;
        groundFloor.add(win);
      }
    }
    // Puerta frontal
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.8), matDoor);
    door.position.set(0, 1.4, D/2 + 0.01);
    groundFloor.add(door);

    // ================ LOSA INTERMEDIA ================
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.3, D + 0.4), matSlab);
    slab.position.y = H_floor + 0.15;
    slab.castShadow = true; slab.receiveShadow = true;
    g.add(slab);

    // ================ PLANTA ALTA (grupo que cae) ================
    const upperFloor = new THREE.Group();
    upperFloor.position.y = H_floor;  // relativa a la losa
    g.add(upperFloor);

    const upperWalls = [];
    for (const [w, h, d, wx, wy, wz] of wallDefs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.9, d), matAccent);
      wall.position.set(wx, wy, wz);
      wall.castShadow = true; wall.receiveShadow = true;
      upperFloor.add(wall);
      upperWalls.push({ mesh: wall, hp: 80, maxHp: 80 });
    }
    // Ventanas planta alta
    for (const wx of [-2.5, 0, 2.5]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), matWindow);
      win.position.set(wx, 2.2, D/2 + 0.01);
      upperFloor.add(win);
    }
    // Techo
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.5, D + 1), matRoof);
    roof.position.y = H_floor * 0.9 + 0.25;
    roof.castShadow = true;
    upperFloor.add(roof);

    API.scene.add(g);

    // Colisión: añadir el footprint al array houses del base para que bloquee movimiento
    if (window.houses && Array.isArray(window.houses)) {
      window.houses.push({
        pos: null,
        min: V(x - W/2, 0, z - D/2),
        max: V(x + W/2, H_floor * 2, z + D/2),
      });
    }

    const b = {
      mesh: g, groundFloor, upperFloor,
      groundWalls, upperWalls,
      hp: 400, maxHp: 400,
      state: 'intact',  // intact | collapsing | destroyed
      collapseT: 0,
      x, z, W, D,
      radius: Math.max(W, D) / 2 + 0.5,
    };
    mod.buildings.push(b);
    return b;
  }

  function damageWall(b, wall, dmg) {
    if (wall.hp <= 0) return;
    wall.hp -= dmg;
    if (wall.hp <= 0) {
      wall.mesh.visible = false;
      spawnDust(wall.mesh.position);
      // ¿Todas las paredes de planta baja destruidas?
      if (b.groundWalls.every(w => w.hp <= 0)) triggerCollapse(b);
    }
  }
  function triggerCollapse(b) {
    if (b.state !== 'intact') return;
    b.state = 'collapsing';
    b.collapseT = 0;
    API.playSound('explosion');
    shakeAmount = Math.max(shakeAmount, 2.5);
  }
  function updateBuildings(dt) {
    for (const b of mod.buildings) {
      if (b.state === 'collapsing') {
        b.collapseT += dt;
        const k = Math.min(1, b.collapseT / 1.8);
        // La planta alta cae con aceleración
        const fall = k * k * 3.2;
        b.upperFloor.position.y = 4 - fall;
        b.upperFloor.rotation.z = Math.sin(k * Math.PI) * 0.15;
        if (k > 0.5 && Math.random() < 0.3) {
          spawnDust(V(b.x + rnd(-3, 3), 2, b.z + rnd(-3, 3)));
        }
        if (k >= 1) {
          // Escombros finales
          b.state = 'destroyed';
          spawnSmokePlume(V(b.x, 1, b.z));
          shakeAmount = Math.max(shakeAmount, 3);
          // Ocultar todo
          b.upperFloor.visible = false;
          b.groundFloor.visible = false;
          // Añadir escombros (montón)
          const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
          for (let i = 0; i < 12; i++) {
            const r = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.5, 1.5), rnd(0.3, 0.8), rnd(0.5, 1.5)), rubbleMat);
            r.position.set(b.x + rnd(-3, 3), rnd(0.2, 1.2), b.z + rnd(-3, 3));
            r.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
            API.scene.add(r);
          }
          // Quitar de la colisión
          if (window.houses && Array.isArray(window.houses)) {
            const idx = window.houses.findIndex(h => h && h.min && Math.abs(h.min.x - (b.x - b.W/2)) < 0.5 && Math.abs(h.min.z - (b.z - b.D/2)) < 0.5);
            if (idx >= 0) window.houses.splice(idx, 1);
          }
        }
      }
    }
  }

  // ===================== COLISIÓN DE AGUA =====================
  function inWater(x, z) {
    if (z < RIVER.zMin || z > RIVER.zMax) return false;
    for (const b of BRIDGES_X) {
      if (x >= b.xMin && x <= b.xMax) return false;
    }
    return true;
  }

  function patchWaterCollision() {
    if (typeof window.isColliding !== 'function') {
      console.warn('⚠️ No se pudo parchear isColliding (función no encontrada)');
      return;
    }
    const _orig = window.isColliding;
    window.isColliding = function (pos, radius) {
      // Bloqueo por agua
      if (inWater(pos.x, pos.z)) return true;
      return _orig(pos, radius);
    };
    console.log('💧 Colisión de agua activada');
  }

  // ===================== ZONA INDUSTRIAL =====================
  function addIndustrialZone() {
    const matBrick = new THREE.MeshLambertMaterial({ color: 0x8a5a4a });
    const matConc  = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matRoof  = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const matStack = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
    const matRed   = new THREE.MeshLambertMaterial({ color: 0xaa2222 });
    for (const base of [[-180, -120], [180, -120], [-180, 120], [180, 120]]) {
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

  // ===================== HQ =====================
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
    add(26, 3.5, 0.9, mat, 0, 2, -12.5); add(26, 3.5, 0.9, mat, 0, 2, 12.5);
    add(0.9, 3.5, 26, mat, -12.5, 2, 0); add(0.9, 3.5, 26, mat, 12.5, 2, 0);
    for (const [cx, cz] of [[-12,-12],[12,-12],[-12,12],[12,12]]) {
      add(3.2, 6, 3.2, matDark, cx, 3, cz);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 4.5, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      c.rotation.x = Math.PI / 2; c.position.set(cx, 5, cz); g.add(c);
    }
    add(9, 9, 9, matConc, 0, 4.5, 0);
    add(9.6, 0.6, 9.6, mat, 0, 9.3, 0);
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
    }

    const tx = 0, tz2 = -75;
    add(30, 8, 14, matConcrete, tx, 4, tz2);
    add(28, 5, 0.3, matGlass, tx, 4.5, tz2 + 7.1);
    add(28, 0.6, 12, matMetal, tx, 8.2, tz2);

    const tx2 = -55, tz3 = -55;
    add(8, 22, 8, matConcrete, tx2, 11, tz3);
    add(11, 5, 11, matGlass, tx2, 24, tz3);
    add(12, 0.8, 12, matMetal, tx2, 27, tz3);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), matMetal);
    ant.position.set(tx2, 31.4, tz3); g.add(ant);
    const rg = new THREE.Group(); rg.position.set(tx2, 33, tz3);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.2), matMetal); rg.add(radar); g.add(rg);

    for (let i = 0; i < 4; i++) {
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 18), matMetal);
      tk.position.set(-45 + i * 8, 3, 30); tk.castShadow = true; g.add(tk);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.5, 18), matAccent);
      cap.position.set(-45 + i * 8, 6.2, 30); g.add(cap);
      const bd = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.4, 18), matRed);
      bd.position.set(-45 + i * 8, 4, 30); g.add(bd);
    }

    const hpX = 45, hpZ = 30;
    const hp = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.4, 24), matConcrete);
    hp.position.set(hpX, 0.2, hpZ); hp.receiveShadow = true; g.add(hp);
    const hpC = new THREE.Mesh(new THREE.RingGeometry(6, 6.5, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    hpC.rotation.x = -Math.PI / 2; hpC.position.set(hpX, 0.42, hpZ); g.add(hpC);

    return { team, mesh: g, x, z, rotY, radarPivot: rg };
  }

  // ===================== RUNWAYS =====================
  const runways = {
    ally: {
      takeoffStart: V(-60, GROUND_Y, -265),
      takeoffEnd:   V(-60, GROUND_Y, -135),
      takeoffDir:   V(0, 0, 1),
      takeoffHeading: 0,
      approach:     V(-60, CRUISE_ALT, -135 + APPROACH_DIST),
      threshold:    V(-60, GROUND_Y, -135),
      landingDir:   V(0, 0, -1),
      landingHeading: Math.PI,
      rolloutEnd:   V(-60, GROUND_Y, -265),
      apronBase:    V(-42, GROUND_Y, -150),
    },
    enemy: {
      takeoffStart: V(60, GROUND_Y, 265),
      takeoffEnd:   V(60, GROUND_Y, 135),
      takeoffDir:   V(0, 0, -1),
      takeoffHeading: Math.PI,
      approach:     V(60, CRUISE_ALT, 135 - APPROACH_DIST),
      threshold:    V(60, GROUND_Y, 135),
      landingDir:   V(0, 0, 1),
      landingHeading: 0,
      rolloutEnd:   V(60, GROUND_Y, 265),
      apronBase:    V(42, GROUND_Y, 150),
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
    const wl = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody, -2.6, 0, 0.6); wl.rotation.z = 0.14;
    const wr = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody, 2.6, 0, 0.6); wr.rotation.z = -0.14;
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

    const apron = rw.apronBase.clone();
    apron.z += (slot - 1) * 10;
    const dx = rw.takeoffStart.x - apron.x, dz = rw.takeoffStart.z - apron.z;
    const yaw0 = yawFromDir(dx, dz);

    const unit = {
      type: 'plane', team, mesh: g,
      hp: 120, maxHp: 120, radius: 4.5,
      isDead: false, respawnTimer: 0,
      basePos: apron.clone(),
      cooldown: 0, missileCooldown: 0,
      flames, yaw: yaw0, pitch: 0, roll: 0,
      state: 'parked',
      stateT: 4 + slot * 3 + rnd(0, 3),
      rollSpeed: 0, groundTime: 0,
      rw, apron,
      patrolAngle: Math.random() * Math.PI * 2,
      patrolRadius: rnd(70, 130),
      combatTime: 0,
    };
    unit.mesh.rotation.order = 'YXZ';
    unit.mesh.position.copy(apron);
    unit.mesh.rotation.y = unit.yaw;
    addHealthBar(unit, 3.5, 3.2);
    mod.planes.push(unit);
    return unit;
  }

  // ===================== HELI =====================
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
  extendWorld();
  addClouds();
  addDistantMountains();
  addRiverAndBridges();
  patchWaterCollision();
  addIndustrialZone();
  addStreetLights();

  // Árboles destructibles (fuera de carreteras, aeropuertos, HQ)
  const treeZones = [[-150,-100],[150,-100],[-150,100],[150,100],[-200,-30],[200,-30],[-200,30],[200,30]];
  for (const [cx, cz] of treeZones) {
    for (let i = 0; i < 8; i++) {
      const x = cx + rnd(-25, 25), z = cz + rnd(-25, 25);
      if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;   // no centro
      if (z > 30 && z < 80) continue;                        // no río
      addTree(x, z);
    }
  }

  // Edificios 2 pisos destructibles (bien separados)
  addBuilding(-120, -50, 0xd8d2c4);
  addBuilding(-120, 100, 0xc8b8a0);
  addBuilding( 120, -50, 0xd8d2c4);
  addBuilding( 120, 100, 0xb8c8d0);
  addBuilding(-40, -30, 0xd8d2c4);
  addBuilding( 40, -30, 0xb8c8d0);
  addBuilding(-40, 140, 0xc8b8a0);
  addBuilding( 40, 140, 0xd8d2c4);

  buildHQ('ally',  ALLY_HQ_POS.x,  ALLY_HQ_POS.z);
  buildHQ('enemy', ENEMY_HQ_POS.x, ENEMY_HQ_POS.z);
  const allyAirport  = buildAirport('ally',  ALLY_AIRPORT.x,  ALLY_AIRPORT.z, 0);
  const enemyAirport = buildAirport('enemy', ENEMY_AIRPORT.x, ENEMY_AIRPORT.z, Math.PI);

  for (let i = 0; i < 3; i++) {
    buildFighter(0x0055ff, 'ally', runways.ally, i);
    buildFighter(0xff2222, 'enemy', runways.enemy, i);
  }
  for (let i = 0; i < 2; i++) {
    buildAttackHeli(0x0055ff, 'ally', -70 + i * 14, -110);
    buildAttackHeli(0xff2222, 'enemy', 70 - i * 14, 110);
  }

  // ===================== UPDATE CAZAS =====================
  const _d = new THREE.Vector3();
  const _p = new THREE.Vector3();

  function resetPlane(p, delay) {
    p.state = 'parked'; p.stateT = delay || 5;
    p.rollSpeed = 0; p.groundTime = 0;
    p.mesh.position.copy(p.apron); p.mesh.position.y = GROUND_Y;
    const dx = p.rw.takeoffStart.x - p.apron.x, dz = p.rw.takeoffStart.z - p.apron.z;
    p.yaw = yawFromDir(dx, dz);
    p.mesh.rotation.set(0, p.yaw, 0);
  }

  function updatePlane(p, dt) {
    if (p.isDead) {
      p.respawnTimer += dt; p.mesh.visible = false;
      if (p.hpGroup) p.hpGroup.visible = false;
      if (p.respawnTimer > 15) {
        p.hp = p.maxHp; p.isDead = false;
        p.mesh.visible = true; if (p.hpGroup) p.hpGroup.visible = true;
        resetPlane(p, 8); p.respawnTimer = 0;
      }
      return;
    }
    p.cooldown -= dt; p.missileCooldown -= dt;

    if (Math.abs(p.mesh.position.x) > WORLD_SIZE * 0.55 || Math.abs(p.mesh.position.z) > WORLD_SIZE * 0.55) {
      resetPlane(p, 5); return;
    }
    const onGround = p.mesh.position.y < 3;
    const okGround = (p.state === 'parked' || p.state === 'taxi_out' || p.state === 'taxi_in' ||
                      p.state === 'takeoff' || p.state === 'rollout');
    if (onGround && !okGround) p.groundTime += dt; else p.groundTime = 0;
    if (p.groundTime > 15) { resetPlane(p, 5); return; }

    switch (p.state) {
      case 'parked': {
        p.stateT -= dt;
        stepToward(p.mesh.position, p.apron, TAXI_SPEED * dt);
        p.mesh.position.y = GROUND_Y;
        if (p.stateT <= 0) {
          const dx = p.rw.takeoffStart.x - p.mesh.position.x;
          const dz = p.rw.takeoffStart.z - p.mesh.position.z;
          p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 2);
          p.state = 'taxi_out';
        }
        p.mesh.rotation.set(0, p.yaw, 0);
        return;
      }
      case 'taxi_out': {
        const target = p.rw.takeoffStart.clone(); target.y = GROUND_Y;
        stepToward(p.mesh.position, target, TAXI_SPEED * dt);
        const dx = target.x - p.mesh.position.x, dz = target.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.5) p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        p.mesh.position.y = GROUND_Y;
        p.mesh.rotation.set(0, p.yaw, 0);
        if (p.mesh.position.distanceTo(target) < 3) { p.state = 'takeoff'; p.rollSpeed = 0; }
        return;
      }
      case 'takeoff': {
        p.rollSpeed = Math.min(ROLL_SPEED, p.rollSpeed + 45 * dt);
        p.mesh.position.addScaledVector(p.rw.takeoffDir, p.rollSpeed * dt);
        p.mesh.position.y = GROUND_Y;
        p.yaw = rotateSmooth(p.yaw, p.rw.takeoffHeading, dt, 4);
        p.mesh.rotation.set(0, p.yaw, 0);
        for (const f of p.flames) f.visible = true;
        if (p.mesh.position.distanceTo(p.rw.takeoffStart) > 125) { p.state = 'climb'; p.climbT = 0; }
        return;
      }
      case 'climb': {
        p.climbT += dt;
        const k = Math.min(1, p.climbT / 2.5);
        p.mesh.position.addScaledVector(p.rw.takeoffDir, CRUISE_SPEED * dt);
        p.mesh.position.y = GROUND_Y + k * (CRUISE_ALT - GROUND_Y);
        p.yaw = rotateSmooth(p.yaw, p.rw.takeoffHeading, dt, 3);
        p.mesh.rotation.set(-0.2 * (1 - k), p.yaw, 0);
        if (k >= 1) { p.state = 'combat'; p.combatTime = 0; p.mesh.rotation.set(0, p.yaw, 0); }
        return;
      }
      case 'combat': {
        p.combatTime += dt;
        runCombat(p, dt);
        if (p.combatTime > 40 || p.hp < 35) p.state = 'return';
        return;
      }
      case 'return': {
        const wp = p.rw.approach.clone(); wp.y = CRUISE_ALT;
        const r = stepToward(p.mesh.position, wp, CRUISE_SPEED * dt);
        const dx = wp.x - p.mesh.position.x, dz = wp.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 1) p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        p.mesh.rotation.set(0, p.yaw, 0);
        p.mesh.position.y = CRUISE_ALT;
        for (const f of p.flames) f.visible = true;
        if (r.distance < 5) { p.state = 'approach'; p.approachStart = p.mesh.position.clone(); p.approachT = 0; }
        return;
      }
      case 'approach': {
        p.approachT += dt;
        const start = p.approachStart;
        const end = p.rw.threshold.clone(); end.y = GROUND_Y;
        const total = start.distanceTo(end);
        const k = Math.min(1, (p.approachT * CRUISE_SPEED) / total);
        const kAlt = Math.pow(k, 2.5);
        p.mesh.position.set(
          start.x + (end.x - start.x) * k,
          start.y - (start.y - end.y) * kAlt,
          start.z + (end.z - start.z) * k
        );
        const dx = end.x - p.mesh.position.x, dz = end.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 1) p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        p.mesh.rotation.set(-0.12 * (1 - k), p.yaw, 0);
        for (const f of p.flames) f.visible = false;
        if (k >= 1 || p.mesh.position.distanceTo(end) < 3) {
          p.mesh.position.copy(end);
          p.yaw = p.rw.landingHeading;
          p.mesh.rotation.set(0, p.yaw, 0);
          p.state = 'rollout'; p.rollSpeed = 55;
        }
        return;
      }
      case 'rollout': {
        p.rollSpeed = Math.max(0, p.rollSpeed - 22 * dt);
        p.mesh.position.addScaledVector(p.rw.landingDir, p.rollSpeed * dt);
        p.mesh.position.y = GROUND_Y;
        p.yaw = p.rw.landingHeading;
        p.mesh.rotation.set(0, p.yaw, 0);
        const dEnd = p.mesh.position.distanceTo(p.rw.rolloutEnd);
        if (p.rollSpeed < 1 || dEnd < 5) p.state = 'taxi_in';
        return;
      }
      case 'taxi_in': {
        stepToward(p.mesh.position, p.apron, TAXI_SPEED * dt);
        const dx = p.apron.x - p.mesh.position.x, dz = p.apron.z - p.mesh.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.5) p.yaw = rotateSmooth(p.yaw, yawFromDir(dx, dz), dt, 3);
        p.mesh.position.y = GROUND_Y;
        p.mesh.rotation.set(0, p.yaw, 0);
        if (p.mesh.position.distanceTo(p.apron) < 2) {
          p.hp = Math.min(p.maxHp, p.hp + 60);
          resetPlane(p, 15 + rnd(0, 8));
        }
        return;
      }
      default: resetPlane(p, 5); return;
    }
  }

  function runCombat(p, dt) {
    let target = null, tDist = 1e9;
    for (const c of mod.planes.concat(mod.helis)) {
      if (c.team === p.team || c.isDead) continue;
      if (c.type === 'plane' && (c.state === 'parked' || c.state === 'taxi_out' || c.state === 'taxi_in' || c.state === 'takeoff' || c.state === 'rollout')) continue;
      const d = p.mesh.position.distanceTo(c.mesh.position);
      if (d < tDist) { tDist = d; target = c; }
    }
    let gt = null, gDist = 1e9;
    if (!target || tDist > 120) {
      for (const s of API.soldiers) {
        if (s.team === p.team || s.hp <= 0) continue;
        const d = p.mesh.position.distanceTo(s.mesh.position);
        if (d < gDist) { gDist = d; gt = s; }
      }
    }
    if (target && tDist < 180) {
      p.patrolAngle += dt * 0.5;
      _d.copy(target.mesh.position); _d.y = CRUISE_ALT;
      _d.x += Math.cos(p.patrolAngle * 3) * 25;
      _d.z += Math.sin(p.patrolAngle * 3) * 25;
    } else {
      p.patrolAngle += dt * 0.15;
      const cz = p.team === 'ally' ? -60 : 60;
      _d.set(Math.cos(p.patrolAngle) * p.patrolRadius, CRUISE_ALT, cz + Math.sin(p.patrolAngle) * p.patrolRadius);
    }
    const dir = _p.copy(_d).sub(p.mesh.position);
    const dist = dir.length();
    if (dist > 0.5) {
      dir.normalize();
      p.mesh.position.addScaledVector(dir, Math.min(CRUISE_SPEED * dt, dist));
      const yawT = yawFromDir(dir.x, dir.z);
      p.yaw = rotateSmooth(p.yaw, yawT, dt, 4);
      let yd = yawT - p.yaw;
      while (yd >  Math.PI) yd -= 2 * Math.PI;
      while (yd < -Math.PI) yd += 2 * Math.PI;
      p.mesh.rotation.set(-dir.y * 0.4, p.yaw, -yd * 1.2);
    }
    for (const f of p.flames) { f.visible = true; f.scale.setScalar(0.7 + Math.random() * 0.6); }

    if (target && p.cooldown <= 0 && tDist < 160) {
      API.fireProjectile(p.mesh.position.clone(), target.mesh.position.clone(), 0xffff44, 22, p.team);
      API.playSound('shot'); p.cooldown = 0.12;
    } else if (gt && p.cooldown <= 0 && gDist < 60) {
      API.fireProjectile(p.mesh.position.clone(), gt.mesh.position.clone(), 0xffff44, 15, p.team);
      API.playSound('shot'); p.cooldown = 0.25;
    }
    if (target && p.missileCooldown <= 0 && tDist < 130 && tDist > 25) {
      API.fireProjectile(p.mesh.position.clone(), target.mesh.position.clone(), 0xff6600, 60, p.team);
      API.playSound('explosion'); p.missileCooldown = 3.5;
    }
    if (p.hp <= 0) { p.isDead = true; p.respawnTimer = 0; API.playSound('explosion'); }
  }

  // ===================== HELI UPDATE =====================
  function updateHeli(h, dt) {
    if (h.isDead) {
      h.respawnTimer += dt; h.mesh.visible = false;
      if (h.hpGroup) h.hpGroup.visible = false;
      if (h.respawnTimer > 12) {
        h.hp = h.maxHp; h.isDead = false;
        h.mesh.visible = true; if (h.hpGroup) h.hpGroup.visible = true;
        h.mesh.position.copy(h.basePos); h.respawnTimer = 0;
      }
      return;
    }
    if (Math.abs(h.mesh.position.x) > WORLD_SIZE * 0.55 || Math.abs(h.mesh.position.z) > WORLD_SIZE * 0.55) {
      h.mesh.position.copy(h.basePos);
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
    const altBase = 20;
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
      const cz = h.team === 'ally' ? -40 : 40;
      _d.set(Math.cos(h.patrolAngle) * 70, altBase + Math.sin(h.patrolAngle * 2) * 5, cz + Math.sin(h.patrolAngle) * 70);
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
        const dx = tgtPos.x - h.mesh.position.x, dz = tgtPos.z - h.mesh.position.z;
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

  // ===================== DAÑO A TODO =====================
  function resolveModDamage() {
    const targets = [...mod.planes, ...mod.helis, ...mod.hqs];
    for (let i = API.projectiles.length - 1; i >= 0; i--) {
      const pr = API.projectiles[i];
      if (!pr || !pr.mesh) continue;
      const pPos = pr.mesh.position;
      let consumed = false;

      // Contra aviones/helis/HQ
      for (const u of targets) {
        if (u.isDead || u.team === pr.team) continue;
        const r = (u.radius || 4) + 1.5;
        if (pPos.distanceTo(u.mesh.position) < r) {
          u.hp -= pr.damage;
          shakeAmount = Math.max(shakeAmount, 0.6);
          consumed = true; break;
        }
      }

      // Contra edificios
      if (!consumed) {
        outer:
        for (const b of mod.buildings) {
          if (b.state === 'destroyed') continue;
          if (pPos.distanceTo(V(b.x, 4, b.z)) > b.radius + 3) continue;
          for (const w of b.groundWalls) {
            if (w.hp <= 0) continue;
            const worldPos = V(b.x + w.pos[0], w.pos[1], b.z + w.pos[2]);
            if (pPos.distanceTo(worldPos) < 5) {
              damageWall(b, w, pr.damage);
              shakeAmount = Math.max(shakeAmount, 0.4);
              consumed = true; break outer;
            }
          }
          for (const w of b.upperWalls) {
            if (w.hp <= 0) continue;
            const wp = w.mesh.getWorldPosition(new THREE.Vector3());
            if (pPos.distanceTo(wp) < 4.5) {
              w.hp -= pr.damage;
              if (w.hp <= 0) { w.mesh.visible = false; spawnDust(wp); }
              consumed = true; break outer;
            }
          }
        }
      }

      // Contra árboles
      if (!consumed) {
        for (const t of mod.trees) {
          if (t.state !== 'alive') continue;
          if (pPos.distanceTo(t.mesh.position) < 3) {
            t.hp -= pr.damage;
            if (t.hp <= 0) destroyTree(t);
            else spawnDust(pPos);
            consumed = true; break;
          }
        }
      }

      if (consumed) {
        API.scene.remove(pr.mesh);
        API.projectiles.splice(i, 1);
      }
    }
  }

  // ===================== DUST / SMOKE ANIM =====================
  function updateDust(dt) {
    for (let i = mod.dust.length - 1; i >= 0; i--) {
      const d = mod.dust[i];
      d.t += dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.vel.y -= 3 * dt;
      d.mesh.material.opacity = Math.max(0, 0.85 * (1 - d.t / d.life));
      d.mesh.scale.multiplyScalar(1 + dt * 0.8);
      if (d.t >= d.life) { API.scene.remove(d.mesh); mod.dust.splice(i, 1); }
    }
  }

  // ===================== SMOKES / CLOUDS / HUD =====================
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
    const R = WORLD_SIZE * 0.55;
    for (const c of mod.clouds) {
      c.mesh.position.x += c.speed * dt;
      c.mesh.position.z += c.drift * dt;
      if (c.mesh.position.x > R) { c.mesh.position.x = -R; c.mesh.position.z = rnd(-R, R); }
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

  // ===================== SCREEN SHAKE =====================
  function applyShake(dt) {
    if (shakeAmount > 0.02) {
      API.camera.position.x += (Math.random() - 0.5) * shakeAmount;
      API.camera.position.y += (Math.random() - 0.5) * shakeAmount * 0.6;
      API.camera.position.z += (Math.random() - 0.5) * shakeAmount;
      shakeAmount *= 0.85;
    } else shakeAmount = 0;
  }

  // ===================== HOOK =====================
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    if (mod.gameOver) return;
    for (const hq of mod.hqs) if (hq.radarGroup) hq.radarGroup.rotation.y += dt * 0.9;
    for (const ap of [allyAirport, enemyAirport]) if (ap && ap.radarPivot) ap.radarPivot.rotation.y += dt * 1.3;
    for (const p of mod.planes) { try { updatePlane(p, dt); } catch (e) { console.error('plane err', e); } }
    for (const h of mod.helis)  { try { updateHeli(h, dt);  } catch (e) { console.error('heli err', e); } }
    updateTrees(dt);
    updateBuildings(dt);
    updateSmokes(dt);
    updateClouds(dt);
    updateDust(dt);
    resolveModDamage();
    updateHQHUD();
    checkWinLose();
    applyShake(dt);
  };

  window.AirConquestMod = { version: '5.0', hqs: mod.hqs, planes: mod.planes, helis: mod.helis, buildings: mod.buildings, trees: mod.trees };
  console.log(`✈️ Mod Aire y Conquista v5.0 listo — ${mod.planes.length} cazas, ${mod.helis.length} helis, ${mod.buildings.length} edificios destruibles, ${mod.trees.length} árboles destruibles.`);
})();