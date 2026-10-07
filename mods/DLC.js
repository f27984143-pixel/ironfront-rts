/* ============================================================
   MOD: Aire y Conquista v2.0
   Añade:
     - Aeropuertos MILITARES detallados (terminal, taxiways, helipuerto)
     - Mapa con río + 3 puentes + colinas + bosque + zona industrial
     - Postes de luz, vallas, semáforos, chimeneas con humo
     - Cazas y helicópteros con modelos mejorados
     - Cuarteles HQ con detalles
     - HUD de bases y victoria/derrota
   Uso: colócalo como mods/DLC.js
   ============================================================ */
(function () {
  if (window.__AIRCONQUEST_LOADED) { console.warn('⚠️ Mod ya cargado'); return; }
  window.__AIRCONQUEST_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('❌ IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));

  console.log('✈️ Mod Aire y Conquista v2.0: iniciando...');
  API.say('✈️ Aire y Conquista v2.0');

  // ======================== ESTADO ========================
  const mod = {
    planes: [],
    helis: [],
    hqs: [],
    smokes: [],      // chimeneas con humo
    gameOver: false,
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

  // ======================== MONTAÑAS LEJANAS ========================
  function addDistantMountains() {
    const matRock = new THREE.MeshLambertMaterial({ color: 0x6a7a6a });
    const matSnow = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const g = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const rad = 280 + rnd(-20, 20);
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const h = rnd(30, 65);
      const r = rnd(20, 36);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), matRock);
      peak.position.set(x, h / 2 - 3, z);
      peak.rotation.y = rnd(0, Math.PI);
      g.add(peak);
      const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.32, 5), matSnow);
      snow.position.set(x, h - h * 0.16 - 3, z);
      snow.rotation.y = peak.rotation.y;
      g.add(snow);
    }
    API.scene.add(g);
  }

  // ======================== RÍO + PUENTES ========================
  function addRiver() {
    const riverGroup = new THREE.Group();
    // El río corre este-oeste por el medio, entre z=-10 y z=10
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 26),
      new THREE.MeshLambertMaterial({ color: 0x2a6fa8, transparent: true, opacity: 0.85 })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.07, 0);
    riverGroup.add(river);

    // Orillas de arena
    for (const zo of [-14, 14]) {
      const bank = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 3),
        new THREE.MeshLambertMaterial({ color: 0xd9c68f })
      );
      bank.rotation.x = -Math.PI / 2;
      bank.position.set(0, 0.06, zo);
      riverGroup.add(bank);
    }

    API.scene.add(riverGroup);

    // ============ 3 PUENTES ============
    const matBridge  = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matRailing = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const matPylon   = new THREE.MeshLambertMaterial({ color: 0x6a6a5a });

    for (const px of [-90, 0, 90]) {
      const bridge = new THREE.Group();
      bridge.position.set(px, 0, 0);

      // Tablero
      const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 30), matBridge);
      deck.position.set(0, 1.2, 0);
      deck.castShadow = true;
      deck.receiveShadow = true;
      bridge.add(deck);

      // Barandas
      for (const sx of [-10.2, 10.2]) {
        const railing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 30), matRailing);
        railing.position.set(sx, 2.4, 0);
        bridge.add(railing);
        // Postes verticales cada 3u
        for (let i = -4; i <= 4; i++) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), matRailing);
          post.position.set(sx, 2.4, i * 3.5);
          bridge.add(post);
        }
      }

      // Pilares en el agua
      for (const pz of [-10, 0, 10]) {
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 4, 8), matPylon);
        pylon.position.set(0, -0.8, pz);
        bridge.add(pylon);
      }

      // Arcos decorativos
      for (const sx of [-5, 5]) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 6, 10, Math.PI), matRailing);
        arc.rotation.y = Math.PI / 2;
        arc.position.set(sx, 1.5, 0);
        bridge.add(arc);
      }

      API.scene.add(bridge);
    }
  }

  // ======================== BOSQUE + COLINAS ========================
  function addForestAndHills() {
    const matTrunk = new THREE.MeshLambertMaterial({ color: 0x594630 });
    const matLeaves1 = new THREE.MeshLambertMaterial({ color: 0x2f5f33 });
    const matLeaves2 = new THREE.MeshLambertMaterial({ color: 0x3a7038 });
    const matHill = new THREE.MeshLambertMaterial({ color: 0x5b7a3e });

    // ---- Bosque al NE y NO ----
    for (const center of [[-140, -100], [140, -100], [-140, 100], [140, 100]]) {
      for (let i = 0; i < 24; i++) {
        const x = center[0] + rnd(-35, 35);
        const z = center[1] + rnd(-35, 35);
        const tree = new THREE.Group();
        tree.position.set(x, 0, z);

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.5, 6), matTrunk);
        trunk.position.y = 1.25;
        trunk.castShadow = true;
        tree.add(trunk);

        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(rnd(1.8, 2.6), rnd(4, 6.5), 7),
          i % 2 ? matLeaves1 : matLeaves2
        );
        leaves.position.y = 4.5;
        leaves.castShadow = true;
        tree.add(leaves);

        API.scene.add(tree);
      }
    }

    // ---- Colinas (esferas achatadas) ----
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const rad = 200 + rnd(-20, 20);
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(rnd(14, 24), 12, 8),
        matHill
      );
      hill.scale.y = 0.25;
      hill.position.set(x, -1, z);
      hill.receiveShadow = true;
      API.scene.add(hill);
    }
  }

  // ======================== ZONA INDUSTRIAL ========================
  function addIndustrialZone() {
    const matBrick  = new THREE.MeshLambertMaterial({ color: 0x8a5a4a });
    const matConcrete = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matRoof   = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const matStack  = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });

    // 2 fábricas en cada esquina NO/SO
    for (const base of [[-150, -30], [150, -30], [-150, 30], [150, 30]]) {
      const bx = base[0], bz = base[1];

      // Nave principal
      const nave = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 14), matBrick);
      nave.position.set(bx, 4, bz);
      nave.castShadow = true;
      nave.receiveShadow = true;
      API.scene.add(nave);

      // Techo plano
      const techo = new THREE.Mesh(new THREE.BoxGeometry(23, 0.6, 15), matRoof);
      techo.position.set(bx, 8.3, bz);
      API.scene.add(techo);

      // Chimenea principal
      const chim = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 20, 10), matStack);
      chim.position.set(bx + 8, 10, bz - 4);
      chim.castShadow = true;
      API.scene.add(chim);

      // Aro rojo en la chimenea
      const aro = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1, 10),
        new THREE.MeshLambertMaterial({ color: 0xaa2222 }));
      aro.position.set(bx + 8, 18, bz - 4);
      API.scene.add(aro);

      // Humo (objeto animado)
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xcccccc, transparent: true, opacity: 0.55 })
      );
      smoke.position.set(bx + 8, 21, bz - 4);
      API.scene.add(smoke);
      mod.smokes.push({ mesh: smoke, baseY: 21, t: Math.random() * 6 });

      // Chimenea secundaria
      const chim2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 14, 8), matStack);
      chim2.position.set(bx - 7, 7, bz + 3);
      chim2.castShadow = true;
      API.scene.add(chim2);

      // Almacén exterior
      const almacen = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8), matConcrete);
      almacen.position.set(bx - 12, 2, bz - 6);
      API.scene.add(almacen);

      // Vallas perimetrales (líneas de postes)
      for (let i = 0; i < 10; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), matConcrete);
        post.position.set(bx - 12 + i * 2.4, 0.75, bz + 9);
        API.scene.add(post);
      }
    }
  }

  // ======================== POSTES DE LUZ EN CARRETERAS ========================
  function addStreetLights() {
    // A lo largo de la carretera vertical principal (x≈0) y horizontal (z≈0)
    const matPost = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const matLamp = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });

    for (let i = -8; i <= 8; i++) {
      for (const sx of [-8, 8]) {
        // Postes verticales
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 6), matPost);
        post.position.set(sx, 3, i * 22);
        API.scene.add(post);

        // Brazo superior
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), matPost);
        arm.position.set(sx + (sx > 0 ? -0.7 : 0.7), 5.9, i * 22);
        API.scene.add(arm);

        // Foco
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), matLamp);
        lamp.position.set(sx + (sx > 0 ? -1.3 : 1.3), 5.85, i * 22);
        API.scene.add(lamp);
      }
    }
    // A lo largo de la carretera horizontal (x=-37.5)
    for (let i = -8; i <= 8; i++) {
      for (const sz of [-8, 8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 6), matPost);
        post.position.set(-37.5 + i * 22, 3, sz);
        API.scene.add(post);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.4), matPost);
        arm.position.set(-37.5 + i * 22, 5.9, sz + (sz > 0 ? -0.7 : 0.7));
        API.scene.add(arm);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), matLamp);
        lamp.position.set(-37.5 + i * 22, 5.85, sz + (sz > 0 ? -1.3 : 1.3));
        API.scene.add(lamp);
      }
    }
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

    add(26, 0.5, 26, matConc, 0, 0.25, 0);
    add(26, 3.5, 0.9, mat, 0, 2.0, -12.5);
    add(26, 3.5, 0.9, mat, 0, 2.0,  12.5);
    add(0.9, 3.5, 26, mat, -12.5, 2.0, 0);
    add(0.9, 3.5, 26, mat,  12.5, 2.0, 0);

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

    add(9, 9, 9, matConc, 0, 4.5, 0);
    add(9.6, 0.6, 9.6, mat, 0, 9.3, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      add(0.5, 9.5, 0.5, matDark, Math.cos(a) * 4.4, 4.75, Math.sin(a) * 4.4);
    }

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

  // ======================== AEROPUERTO MILITAR v2 ========================
  function buildAirport(team, x, z, rotY) {
    const color = team === 'ally' ? 0x0055ff : 0xff2222;
    const matAccent   = new THREE.MeshLambertMaterial({ color });
    const matAsphalt  = new THREE.MeshLambertMaterial({ color: 0x252525 });
    const matConcrete = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
    const matMetal    = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const matMetalDk  = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matGlass    = new THREE.MeshLambertMaterial({ color: 0x2a5a7a, emissive: 0x0a2030 });
    const matWhite    = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    const matYellow   = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const matRed      = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const matGreen    = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    const g = new THREE.Group();
    g.position.set(x, 0.03, z);
    g.rotation.y = rotY;
    API.scene.add(g);

    const add = (w, h, d, m, xx, yy, zz) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(xx, yy, zz);
      o.castShadow = true; o.receiveShadow = true;
      g.add(o);
      return o;
    };

    // -------- PISTA PRINCIPAL (más grande y con más detalles) --------
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(20, 130), matAsphalt);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.02, 0);
    runway.receiveShadow = true;
    g.add(runway);

    // Marcas centrales dashed
    for (let i = -10; i <= 10; i++) {
      const marca = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.5), matWhite);
      marca.rotation.x = -Math.PI / 2;
      marca.position.set(0, 0.04, i * 6);
      g.add(marca);
    }
    // Umbrales (barras blancas al inicio y fin)
    for (const zEnd of [-60, 60]) {
      for (let i = -4; i <= 4; i++) {
        const u = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 5), matWhite);
        u.rotation.x = -Math.PI / 2;
        u.position.set(i * 2.4, 0.04, zEnd);
        g.add(u);
      }
    }
    // Números de pista "18" y "36"
    for (const [zc, num] of [[-55, '18'], [55, '36']]) {
      // Números grandes al inicio
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const cx = canvas.getContext('2d');
      cx.fillStyle = '#0000'; cx.fillRect(0, 0, 128, 128);
      cx.fillStyle = '#ffffff';
      cx.font = 'bold 90px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(num, 64, 64);
      const tex = new THREE.CanvasTexture(canvas);
      const numMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      numMesh.rotation.x = -Math.PI / 2;
      numMesh.position.set(0, 0.05, zc);
      g.add(numMesh);
    }

    // Luces de pista (bordes)
    for (let i = -10; i <= 10; i++) {
      for (const xx of [-10.5, 10.5]) {
        const luz = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6),
          i % 2 ? matYellow : matGreen);
        luz.position.set(xx, 0.18, i * 6);
        g.add(luz);
      }
    }
    // Luces de aproximación al inicio
    for (let i = 1; i <= 5; i++) {
      for (const xx of [-3, -1.5, 0, 1.5, 3]) {
        const luz = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), matWhite);
        luz.position.set(xx, 0.18, -62 - i * 2);
        g.add(luz);
      }
    }

    // -------- TAXIWAYS (calles de rodaje) --------
    // Paralelo a la pista, a la derecha
    const taxi1 = new THREE.Mesh(new THREE.PlaneGeometry(6, 120), matAsphalt);
    taxi1.rotation.x = -Math.PI / 2;
    taxi1.position.set(18, 0.025, 0);
    g.add(taxi1);
    // Conexiones (rampas)
    for (const tz of [-40, -15, 15, 40]) {
      const ramp = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), matAsphalt);
      ramp.rotation.x = -Math.PI / 2;
      ramp.position.set(12, 0.025, tz);
      g.add(ramp);
      // Marcas amarillas en rampa
      const yl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 4), matYellow);
      yl.rotation.x = -Math.PI / 2;
      yl.position.set(12, 0.05, tz);
      g.add(yl);
    }
    // Marcas amarillas taxiway
    const yl1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 118), matYellow);
    yl1.rotation.x = -Math.PI / 2;
    yl1.position.set(18, 0.05, 0);
    g.add(yl1);

    // -------- HANGARES MILITARES --------
    for (const hx of [-38, 38]) {
      const hz = 6;
      // Plataforma
      add(22, 0.5, 22, matConcrete, hx, 0.25, hz);
      // Paredes
      add(22, 7, 0.8, matMetal, hx, 3.75, hz - 11);
      add(22, 7, 0.8, matMetal, hx, 3.75, hz + 11);
      add(0.8, 7, 22, matMetal, hx - 11, 3.75, hz);
      // Puerta lateral con rayas team
      add(21, 5.8, 0.5, matAccent, hx, 3, hz + 11.1);

      // Techo abovedado (3 capas)
      for (let i = 0; i < 3; i++) {
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(22 - i * 4, 0.4, 22),
          matMetal
        );
        roof.position.set(hx, 7.5 + i * 0.9, hz);
        g.add(roof);
      }

      // Número de hangar
      add(2, 2, 0.2, matYellow, hx - 8, 5.5, hz + 11.2);
    }

    // -------- TERMINAL DE PASAJEROS / COMANDO --------
    const tx = 0, tz2 = -75;
    // Edificio principal
    add(30, 8, 14, matConcrete, tx, 4, tz2);
    // Cristalera frontal
    add(28, 5, 0.3, matGlass, tx, 4.5, tz2 + 7.1);
    // Piso superior
    add(28, 0.6, 12, matMetal, tx, 8.2, tz2);
    // Barandilla del techo
    for (let i = 0; i < 15; i++) {
      add(0.2, 1.2, 0.2, matMetal, tx - 14 + i * 2, 9.1, tz2 + 6);
    }
    // Pasarelas de embarque (3 fingers)
    for (const px of [-10, 0, 10]) {
      add(3, 0.5, 8, matConcrete, tx + px, 5, tz2 + 12);
      // Techo de pasarela
      add(3, 0.3, 8, matMetal, tx + px, 7.5, tz2 + 12);
      // Cristalera
      add(3, 2.2, 0.15, matGlass, tx + px, 6, tz2 + 16);
      // Soportes
      add(0.3, 5, 0.3, matMetal, tx + px - 1.3, 2.5, tz2 + 8.2);
      add(0.3, 5, 0.3, matMetal, tx + px + 1.3, 2.5, tz2 + 8.2);
      add(0.3, 5, 0.3, matMetal, tx + px - 1.3, 2.5, tz2 + 15.8);
      add(0.3, 5, 0.3, matMetal, tx + px + 1.3, 2.5, tz2 + 15.8);
    }

    // -------- TORRE DE CONTROL (más alta) --------
    const tx2 = -55, tz3 = -55;
    add(8, 22, 8, matConcrete, tx2, 11, tz3);
    // Sección de cristal
    add(11, 5, 11, matGlass, tx2, 24, tz3);
    // Techo
    add(12, 0.8, 12, matMetal, tx2, 27, tz3);
    // Antena
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), matMetal);
    ant.position.set(tx2, 31.4, tz3);
    g.add(ant);
    // Radar giratorio
    const radarPivot = new THREE.Group();
    radarPivot.position.set(tx2, 33, tz3);
    const radar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.2), matMetal);
    radarPivot.add(radar);
    g.add(radarPivot);
    // Luces de balizaje (rojas)
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      const luz = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), matRed);
      luz.position.set(tx2 + dx, 28, tz3 + dz);
      g.add(luz);
    }

    // -------- DEPÓSITOS DE COMBUSTIBLE --------
    for (let i = 0; i < 4; i++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 18), matMetal);
      tank.position.set(-45 + i * 8, 3, 30);
      tank.castShadow = true;
      g.add(tank);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.5, 18), matAccent);
      cap.position.set(-45 + i * 8, 6.2, 30);
      g.add(cap);
      // Banda roja de peligro
      const banda = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.4, 18), matRed);
      banda.position.set(-45 + i * 8, 4, 30);
      g.add(banda);
    }

    // -------- HELIPUERTO --------
    const helipadX = 45, helipadZ = 30;
    // Plataforma circular
    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.4, 24), matConcrete);
    helipad.position.set(helipadX, 0.2, helipadZ);
    helipad.receiveShadow = true;
    g.add(helipad);
    // Círculo blanco
    const helipadCircle = new THREE.Mesh(
      new THREE.RingGeometry(6, 6.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    helipadCircle.rotation.x = -Math.PI / 2;
    helipadCircle.position.set(helipadX, 0.42, helipadZ);
    g.add(helipadCircle);
    // Letra H
    const hCanvas = document.createElement('canvas');
    hCanvas.width = 128; hCanvas.height = 128;
    const hx2 = hCanvas.getContext('2d');
    hx2.fillStyle = '#ffffff';
    hx2.font = 'bold 110px sans-serif';
    hx2.textAlign = 'center';
    hx2.textBaseline = 'middle';
    hx2.fillText('H', 64, 64);
    const hTex = new THREE.CanvasTexture(hCanvas);
    const hMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({ map: hTex, transparent: true })
    );
    hMesh.rotation.x = -Math.PI / 2;
    hMesh.position.set(helipadX, 0.43, helipadZ);
    g.add(hMesh);

    // Luces perimetrales del helipuerto
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const luz = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), matGreen);
      luz.position.set(helipadX + Math.cos(a) * 7.5, 0.5, helipadZ + Math.sin(a) * 7.5);
      g.add(luz);
    }

    // -------- AVIONES APARCADOS --------
    // Pequeños aviones estáticos en el apron frente a la terminal
    for (const px of [-6, 6]) {
      const parked = new THREE.Group();
      // Fuselaje
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 6, 10), matMetal);
      fuse.rotation.x = Math.PI / 2;
      parked.add(fuse);
      // Ala
      const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 2), matMetal);
      parked.add(wing);
      // Cola
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 1.5), matMetal);
      tail.position.set(0, 1, -3);
      parked.add(tail);
      // Cabina
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1.5), matGlass);
      cab.position.set(0, 0.5, 1.5);
      parked.add(cab);
      parked.position.set(px, 1.2, tz2 + 24);
      parked.rotation.y = Math.PI;
      g.add(parked);
    }

    // -------- TORRE DE AGUA --------
    const wtx = 60, wtz = -30;
    // Patas
    for (const [ox, oz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      add(0.4, 12, 0.4, matMetal, wtx + ox, 6, wtz + oz);
    }
    // Tanque
    const wt = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 4, 14), matConcrete);
    wt.position.set(wtx, 13, wtz);
    g.add(wt);
    // Techo de agua
    const wtop = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.2, 14), matMetal);
    wtop.position.set(wtx, 15.6, wtz);
    g.add(wtop);

    return { team, mesh: g, x, z, rotY, radarPivot };
  }

  // ======================== CAZA ========================
  function buildFighter(color, team, x, z) {
    const matBody   = new THREE.MeshLambertMaterial({ color });
    const matDark   = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matGlass  = new THREE.MeshLambertMaterial({ color: 0x0e1a2a });
    const matMetal  = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const matRedTip = new THREE.MeshBasicMaterial({ color: 0xcc2222 });

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

    add(new THREE.BoxGeometry(1.7, 1.4, 9), matBody, 0, 0, 0);
    add(new THREE.BoxGeometry(1.3, 1.0, 3.5), matBody, 0, 0.1, -5.5);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.2, 10), matBody);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 5.5);
    nose.castShadow = true;
    g.add(nose);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 10), matRedTip);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0, 7.2);
    g.add(tip);

    add(new THREE.BoxGeometry(0.95, 0.75, 2.8), matGlass, 0, 0.9, -0.8);
    add(new THREE.BoxGeometry(0.95, 0.45, 1.5), matGlass, 0, 0.98, 1.4);

    const wl = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody, -2.6, 0, 0.6);
    wl.rotation.z = 0.14;
    const wr = add(new THREE.BoxGeometry(4.2, 0.32, 2.8), matBody,  2.6, 0, 0.6);
    wr.rotation.z = -0.14;

    add(new THREE.BoxGeometry(0.85, 0.45, 1.4), matDark, -4.6, 0.2, 1.0);
    add(new THREE.BoxGeometry(0.85, 0.45, 1.4), matDark,  4.6, 0.2, 1.0);

    for (const wx of [-3.0, 3.0]) {
      for (const wz of [0.2, 1.4]) {
        const msl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.8, 8), matMetal);
        msl.rotation.x = Math.PI / 2;
        msl.position.set(wx, -0.45, wz);
        g.add(msl);
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), matDark);
        t.rotation.x = Math.PI / 2;
        t.position.set(wx, -0.45, wz + 1.65);
        g.add(t);
      }
    }

    const tailV = add(new THREE.BoxGeometry(0.32, 2.6, 2), matBody, 0, 1.5, -4.5);
    tailV.rotation.x = -0.25;

    add(new THREE.BoxGeometry(3.8, 0.28, 1.3), matBody, 0, 0, -4.8);

    for (const ex of [-0.7, 0.7]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2, 12), matDark);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(ex, -0.2, -5.5);
      g.add(eng);
    }

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

  // ======================== HELICÓPTERO ========================
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

    add(new THREE.BoxGeometry(2.6, 2.1, 6), matBody, 0, 0, 0);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 12), matBody);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 4);
    nose.castShadow = true;
    g.add(nose);

    add(new THREE.BoxGeometry(2.0, 1.5, 1.7), matGlass, 0, 0.35, 1.8);
    add(new THREE.BoxGeometry(0.7, 0.7, 5), matBody, 0, 0.3, -5.5);
    add(new THREE.BoxGeometry(3.2, 0.16, 1.1), matBody, 0, 0.3, -7.2);

    const rotorTail = new THREE.Group();
    rotorTail.position.set(0.45, 0.3, -8);
    const tb1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.15), matRotor);
    const tb2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 2.4), matRotor);
    rotorTail.add(tb1); rotorTail.add(tb2);
    g.add(rotorTail);

    for (const sx of [-1.05, 1.05]) {
      add(new THREE.BoxGeometry(0.16, 0.16, 4.5), matMetal, sx, -1.5, 0.5);
      add(new THREE.BoxGeometry(0.16, 1.3, 0.16), matMetal, sx, -0.75, -1.4);
      add(new THREE.BoxGeometry(0.16, 1.3, 0.16), matMetal, sx, -0.75, 2.2);
    }

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

    add(new THREE.BoxGeometry(6, 0.22, 0.9), matBody, 0, -0.2, 0.6);

    for (const wx of [-2.4, -1.6, 1.6, 2.4]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 8), matDark);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(wx, -0.65, 0.9);
      g.add(pod);
    }

    const turret = new THREE.Group();
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.4, 8), matDark);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 0, 0.5);
    turret.add(cannon);
    turret.position.set(0, -1.0, 2.6);
    g.add(turret);

    for (const ex of [-0.8, 0.8]) {
      add(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 8), matDark, ex, 0.7, -2.8);
    }
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
  addRiver();
  addForestAndHills();
  addIndustrialZone();
  addStreetLights();

  const allyHQ  = buildHQ('ally',  0, -140);
  const enemyHQ = buildHQ('enemy', 0,  140);
  const allyAirport  = buildAirport('ally',  -100, -90, 0);
  const enemyAirport = buildAirport('enemy',  100,  90, Math.PI);

  for (let i = 0; i < 3; i++) {
    buildFighter(0x0055ff, 'ally',  -100 + (i - 1) * 8, -100);
    buildFighter(0xff2222, 'enemy',  100 + (i - 1) * 8,  100);
  }
  for (let i = 0; i < 2; i++) {
    buildAttackHeli(0x0055ff, 'ally',  -70 + i * 14, -105);
    buildAttackHeli(0xff2222, 'enemy',  70 - i * 14,  105);
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

    let target = null, tDist = 1e9;
    for (const cand of mod.planes.concat(mod.helis)) {
      if (cand.team === p.team || cand.isDead) continue;
      const d = p.mesh.position.distanceTo(cand.mesh.position);
      if (d < tDist) { tDist = d; target = cand; }
    }

    let groundTarget = null, gDist = 1e9;
    if (!target) {
      for (const s of API.soldiers) {
        if (s.team === p.team || s.hp <= 0) continue;
        const d = p.mesh.position.distanceTo(s.mesh.position);
        if (d < gDist) { gDist = d; groundTarget = s; }
      }
    }

    const altBase = 32;
    if (target && tDist < 180) {
      p.patrolAngle += dt * 0.5;
      _d.copy(target.mesh.position);
      _d.y = altBase;
      _d.x += Math.cos(p.patrolAngle * 3) * 25;
      _d.z += Math.sin(p.patrolAngle * 3) * 25;
    } else {
      p.patrolAngle += dt * 0.15;
      const cx = 0, cz = p.team === 'ally' ? -50 : 50;
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

    if (target && p.cooldown <= 0 && tDist < 160) {
      API.fireProjectile(p.mesh.position.clone(), target.mesh.position.clone(), 0xffff44, 22, p.team);
      API.playSound('shot');
      p.cooldown = 0.12;
    } else if (groundTarget && p.cooldown <= 0 && gDist < 60) {
      API.fireProjectile(p.mesh.position.clone(), groundTarget.mesh.position.clone(), 0xffff44, 15, p.team);
      API.playSound('shot');
      p.cooldown = 0.25;
    }

    if (target && p.missileCooldown <= 0 && tDist < 130 && tDist > 25) {
      API.fireProjectile(p.mesh.position.clone(), target.mesh.position.clone(), 0xff6600, 60, p.team);
      API.playSound('explosion');
      p.missileCooldown = 3.5;
    }

    for (const f of p.flames) f.scale.setScalar(0.7 + Math.random() * 0.6);

    if (p.hp <= 0) {
      p.isDead = true;
      p.respawnTimer = 0;
      API.playSound('explosion');
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

    let target = null, tDist = 1e9;
    for (const cand of mod.planes.concat(mod.helis)) {
      if (cand.team === h.team || cand.isDead) continue;
      const d = h.mesh.position.distanceTo(cand.mesh.position);
      if (d < tDist) { tDist = d; target = cand; }
    }

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
      const cz = h.team === 'ally' ? -30 : 30;
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

    if (h.turret) {
      const tgt = target ? target.mesh.position : (gTarget ? gTarget.mesh.position : null);
      if (tgt) {
        const dx = tgt.x - h.mesh.position.x;
        const dz = tgt.z - h.mesh.position.z;
        const relYaw = Math.atan2(dx, dz) - h.yaw;
        h.turret.rotation.y += (relYaw - h.turret.rotation.y) * Math.min(1, dt * 4);
      }
    }

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

  function updateSmokes(dt) {
    for (const s of mod.smokes) {
      s.t += dt;
      s.mesh.position.y = s.baseY + (s.t % 4) * 2.5;
      s.mesh.scale.setScalar(1 + (s.t % 4) * 0.35);
      s.mesh.material.opacity = 0.55 * (1 - (s.t % 4) / 4);
      if (s.t % 4 > 3.9) s.t = 0;
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

    updateSmokes(dt);
    resolveModDamage();
    updateHQHUD();
    checkWinLose();
  };

  window.AirConquestMod = {
    version: '2.0',
    hqs: mod.hqs,
    planes: mod.planes,
    helis: mod.helis,
  };

  console.log(`✈️ Mod Aire y Conquista v2.0 listo — ${mod.planes.length} cazas, ${mod.helis.length} helicópteros, ${mod.hqs.length} cuarteles, mapa mejorado.`);
})();