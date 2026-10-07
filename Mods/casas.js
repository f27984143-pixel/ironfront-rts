/* ============================================================
   MOD: Casas Destructibles v1.0
   - 4 tipos de casas
   - Ventanas VISIBLES (marco sólido + cristal)
   - Sin hitbox fantasma (limpia colisiones base correctamente)
   - Sonido al destruir
   - 2 puertas + escaleras
   - IA las usa como cobertura
   - Destruibles con fases + fuego + humo
   Requiere: mejora_mundo.js (para WorldData)
   ============================================================ */
(function () {
  if (window.__CASAS_LOADED) { console.warn('⚠️ Casas ya cargadas'); return; }
  window.__CASAS_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('❌ IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);

  console.log('🏘️ Mod Casas Destructibles v1.0: iniciando...');
  API.say('🏘️ Casas cargadas');

  // Datos del mundo (si mejora_mundo.js cargó primero)
  const WD = window.WorldData || {};
  const RIVER = WD.RIVER || { zMin: 42, zMax: 68, centerZ: 55, halfLen: 125 };
  const BRIDGES_X = WD.BRIDGES_X || [{xMin:-10,xMax:10},{xMin:-100,xMax:-80},{xMin:80,xMax:100}];

  const buildings = [];
  let shakeAmount = 0;

  // ===================== HELPERS =====================
  const dustMat = new THREE.MeshBasicMaterial({ color: 0xbbaa88, transparent: true, opacity: 0.85, depthWrite: false });
  function spawnDust(pos) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.2, 0.5), 5, 4), dustMat.clone());
      m.position.copy(pos);
      m.position.x += rnd(-0.8, 0.8); m.position.y += rnd(0, 1); m.position.z += rnd(-0.8, 0.8);
      API.scene.add(m);
      setTimeout(() => API.scene.remove(m), 900);
    }
  }
  function spawnFlyingDebris(pos, count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
    for (let i = 0; i < count; i++) {
      const debris = new THREE.Mesh(
        new THREE.BoxGeometry(rnd(0.3, 0.8), rnd(0.3, 0.6), rnd(0.3, 0.8)),
        Math.random() < 0.5 ? mat : mat2
      );
      debris.position.copy(pos);
      debris.position.x += rnd(-1, 1); debris.position.y += rnd(0, 1); debris.position.z += rnd(-1, 1);
      debris.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
      debris.castShadow = true;
      API.scene.add(debris);
      // Animación manual
      const vel = V(rnd(-3, 3), rnd(3, 6), rnd(-3, 3));
      const angVel = V(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4));
      let t = 0;
      const iv = setInterval(() => {
        t += 0.033;
        vel.y -= 18 * 0.033;
        debris.position.addScaledVector(vel, 0.033);
        debris.rotation.x += angVel.x * 0.033;
        debris.rotation.y += angVel.y * 0.033;
        debris.rotation.z += angVel.z * 0.033;
        if (debris.position.y < 0.2) {
          debris.position.y = 0.2;
          vel.y *= -0.35; vel.x *= 0.6; vel.z *= 0.6;
          angVel.x *= 0.5; angVel.y *= 0.5; angVel.z *= 0.5;
        }
        if (t > 4) { API.scene.remove(debris); clearInterval(iv); }
      }, 33);
    }
  }
  function spawnSmokePlume(pos) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.4, 0.9), 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.7, depthWrite: false }));
      m.position.copy(pos);
      m.position.x += rnd(-1.5, 1.5); m.position.y += rnd(0, 2); m.position.z += rnd(-1.5, 1.5);
      API.scene.add(m);
      const vel = V(rnd(-0.8, 0.8), rnd(2, 5), rnd(-0.8, 0.8));
      let t = 0;
      const iv = setInterval(() => {
        t += 0.033;
        m.position.addScaledVector(vel, 0.033);
        vel.y -= 3 * 0.033;
        m.material.opacity = Math.max(0, 0.7 * (1 - t / 2.2));
        m.scale.multiplyScalar(1 + 0.033 * 0.8);
        if (t >= 2.2) { API.scene.remove(m); clearInterval(iv); }
      }, 33);
    }
  }
  function playDestroySound() {
    API.playSound('explosion');
    setTimeout(() => API.playSound('clash'), 150);
    setTimeout(() => API.playSound('explosion'), 400);
  }

  // ===================== OCULTAR CASAS BASE + LIMPIAR COLISIONES =====================
  function hideBaseHouses() {
    let hidden = 0;
    API.scene.traverse(obj => {
      if (obj.isInstancedMesh && obj.material && obj.material.color) {
        const hex = obj.material.color.getHex();
        if (hex === 0xd8d2c4 || hex === 0x883333 || hex === 0x6a2626 ||
            hex === 0x5a3a1e || hex === 0x2d4a66) {
          obj.visible = false;
          hidden++;
        }
      }
    });
    // ⚠️ LIMPIAR COLISIONES FANTASMA
    if (window.houses && Array.isArray(window.houses)) window.houses.length = 0;
    if (window.houseList && Array.isArray(window.houseList)) window.houseList.length = 0;
    if (window.coverObjs && Array.isArray(window.coverObjs)) window.coverObjs.length = 0;
    if (window.bwalls && Array.isArray(window.bwalls)) window.bwalls.length = 0;
    console.log(`🏚️ ${hidden} meshes base ocultados + colisiones limpiadas`);
  }

  // ===================== MATERIALES =====================
  const MAT_HOUSE = {
    win: new THREE.MeshLambertMaterial({
      color: 0x6699bb,
      emissive: 0x1a3355,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    winFrame: new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
    door: new THREE.MeshLambertMaterial({ color: 0x3a2a1a }),
    stairs: new THREE.MeshLambertMaterial({ color: 0x9a9a90 }),
    rail: new THREE.MeshLambertMaterial({ color: 0x555555 }),
    roof: new THREE.MeshLambertMaterial({ color: 0x7a3a2a }),
    concrete: new THREE.MeshLambertMaterial({ color: 0xb8b8b0 }),
    sandbag: new THREE.MeshLambertMaterial({ color: 0x9a8a5a }),
    floor: new THREE.MeshLambertMaterial({ color: 0x8a4a3a }),
  };
  function houseWallMat(color) { return new THREE.MeshLambertMaterial({ color }); }

  // ===================== CREAR VENTANA CON MARCO =====================
  function makeWindow(winW, winH) {
    const grp = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, winH + 0.3, 0.15), MAT_HOUSE.winFrame);
    grp.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), MAT_HOUSE.win);
    glass.position.z = 0.09;
    grp.add(glass);
    const h = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.08, 0.14), MAT_HOUSE.winFrame);
    h.position.z = 0.08;
    grp.add(h);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.08, winH, 0.14), MAT_HOUSE.winFrame);
    v.position.z = 0.08;
    grp.add(v);
    return grp;
  }

  // ===================== CONSTRUCTOR =====================
  function buildHouse(x, z, type, hue) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const W = [8, 9, 10, 7][type];
    const D = [8, 9, 10, 9][type];
    const floors = [2, 2, 1, 3][type];
    const FLOOR_H = 4;
    const T = 0.5;
    const wallColor = hue || 0xd8d2c4;
    const accentColor = 0x8a4a3a;
    const wallMat = houseWallMat(wallColor);
    const accentMat = houseWallMat(accentColor);
    const doorGap = 2.2;

    const groundFloor = new THREE.Group();
    g.add(groundFloor);
    const groundWalls = [];
    const upperFloors = [];

    for (let f = 0; f < floors; f++) {
      const floorGroup = f === 0 ? groundFloor : new THREE.Group();
      if (f > 0) { floorGroup.position.y = f * FLOOR_H; g.add(floorGroup); }
      const mat = f === 0 ? wallMat : (f === 1 ? accentMat : wallMat);
      const wallsThisFloor = [];
      const yCenter = FLOOR_H / 2;

      // Pared trasera
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, FLOOR_H, T), mat);
      backWall.position.set(0, yCenter, -D/2);
      backWall.castShadow = true; backWall.receiveShadow = true;
      floorGroup.add(backWall);
      wallsThisFloor.push({ mesh: backWall, hp: 100, maxHp: 100, pos: [0, yCenter, -D/2], cracked: false });

      // Pared frontal con puerta (ground) o ventanas (upper)
      if (f === 0) {
        const sideW = (W - doorGap) / 2;
        const left = new THREE.Mesh(new THREE.BoxGeometry(sideW, FLOOR_H, T), mat);
        left.position.set(-(W/2 - sideW/2), yCenter, D/2);
        left.castShadow = true; left.receiveShadow = true;
        floorGroup.add(left);
        wallsThisFloor.push({ mesh: left, hp: 100, maxHp: 100, pos: [-(W/2 - sideW/2), yCenter, D/2], cracked: false });

        const right = new THREE.Mesh(new THREE.BoxGeometry(sideW, FLOOR_H, T), mat);
        right.position.set(W/2 - sideW/2, yCenter, D/2);
        right.castShadow = true; right.receiveShadow = true;
        floorGroup.add(right);
        wallsThisFloor.push({ mesh: right, hp: 100, maxHp: 100, pos: [W/2 - sideW/2, yCenter, D/2], cracked: false });

        const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorGap, FLOOR_H - 2.8, T), mat);
        lintel.position.set(0, 2.8 + (FLOOR_H - 2.8) / 2, D/2);
        lintel.castShadow = true;
        floorGroup.add(lintel);
        wallsThisFloor.push({ mesh: lintel, hp: 100, maxHp: 100, pos: [0, 2.8 + (FLOOR_H - 2.8) / 2, D/2], cracked: false });

        const door = new THREE.Mesh(new THREE.PlaneGeometry(doorGap - 0.2, 2.8), MAT_HOUSE.door);
        door.position.set(0, 1.4, D/2 + 0.01);
        floorGroup.add(door);
      } else {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(W, FLOOR_H, T), mat);
        wall.position.set(0, yCenter, D/2);
        wall.castShadow = true; wall.receiveShadow = true;
        floorGroup.add(wall);
        wallsThisFloor.push({ mesh: wall, hp: 100, maxHp: 100, pos: [0, yCenter, D/2], cracked: false });
      }

      // Pared izquierda (segunda puerta para tipo 1)
      if (f === 0 && type === 1) {
        const sideD = (D - doorGap) / 2;
        const a = new THREE.Mesh(new THREE.BoxGeometry(T, FLOOR_H, sideD), mat);
        a.position.set(-W/2, yCenter, -(D/2 - sideD/2));
        a.castShadow = true; a.receiveShadow = true;
        floorGroup.add(a);
        wallsThisFloor.push({ mesh: a, hp: 100, maxHp: 100, pos: [-W/2, yCenter, -(D/2 - sideD/2)], cracked: false });

        const b = new THREE.Mesh(new THREE.BoxGeometry(T, FLOOR_H, sideD), mat);
        b.position.set(-W/2, yCenter, D/2 - sideD/2);
        b.castShadow = true; b.receiveShadow = true;
        floorGroup.add(b);
        wallsThisFloor.push({ mesh: b, hp: 100, maxHp: 100, pos: [-W/2, yCenter, D/2 - sideD/2], cracked: false });

        const lintel = new THREE.Mesh(new THREE.BoxGeometry(T, FLOOR_H - 2.8, doorGap), mat);
        lintel.position.set(-W/2, 2.8 + (FLOOR_H - 2.8) / 2, 0);
        lintel.castShadow = true;
        floorGroup.add(lintel);
        wallsThisFloor.push({ mesh: lintel, hp: 100, maxHp: 100, pos: [-W/2, 2.8 + (FLOOR_H - 2.8)/2, 0], cracked: false });

        const door = new THREE.Mesh(new THREE.PlaneGeometry(doorGap - 0.2, 2.8), MAT_HOUSE.door);
        door.rotation.y = Math.PI / 2;
        door.position.set(-W/2 - 0.01, 1.4, 0);
        floorGroup.add(door);
      } else {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(T, FLOOR_H, D), mat);
        wall.position.set(-W/2, yCenter, 0);
        wall.castShadow = true; wall.receiveShadow = true;
        floorGroup.add(wall);
        wallsThisFloor.push({ mesh: wall, hp: 100, maxHp: 100, pos: [-W/2, yCenter, 0], cracked: false });
      }

      // Pared derecha
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(T, FLOOR_H, D), mat);
      rightWall.position.set(W/2, yCenter, 0);
      rightWall.castShadow = true; rightWall.receiveShadow = true;
      floorGroup.add(rightWall);
      wallsThisFloor.push({ mesh: rightWall, hp: 100, maxHp: 100, pos: [W/2, yCenter, 0], cracked: false });

      // Ventanas visibles con marco
      const winY = FLOOR_H * 0.55;
      const winW = 1.4, winH = 1.4;

      if (f > 0) {
        for (const wx of [-W/4, W/4]) {
          const w = makeWindow(winW, winH); w.position.set(wx, winY, D/2 + 0.08); floorGroup.add(w);
        }
      } else if (type !== 0) {
        for (const wx of [-W/3, W/3]) {
          const w = makeWindow(winW, winH); w.position.set(wx, winY, D/2 + 0.08); floorGroup.add(w);
        }
      }
      for (const wx of [-W/4, W/4]) {
        const w = makeWindow(winW, winH); w.position.set(wx, winY, -D/2 - 0.08); w.rotation.y = Math.PI; floorGroup.add(w);
      }
      for (const wz of [-D/4, D/4]) {
        const w1 = makeWindow(winW, winH); w1.position.set(-W/2 - 0.08, winY, wz); w1.rotation.y = -Math.PI / 2; floorGroup.add(w1);
        const w2 = makeWindow(winW, winH); w2.position.set(W/2 + 0.08, winY, wz); w2.rotation.y = Math.PI / 2; floorGroup.add(w2);
      }

      // Losa intermedia
      if (f < floors - 1) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.3, D + 0.4), MAT_HOUSE.floor);
        slab.position.y = (f + 1) * FLOOR_H + 0.15;
        slab.castShadow = true; slab.receiveShadow = true;
        g.add(slab);
      }

      if (f === 0) groundWalls.push(...wallsThisFloor);
      else upperFloors.push({ walls: wallsThisFloor, group: floorGroup });
    }

    // Escaleras
    const sx = -W/2 - 1.5;
    for (let i = 0; i < floors * FLOOR_H * 2; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.6), MAT_HOUSE.stairs);
      step.position.set(sx, 0.15 + i * 0.25, -D/2 + 1 + i * 0.55);
      step.castShadow = true;
      g.add(step);
      if (step.position.z > D/2 - 1) break;
    }
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.08, floors * FLOOR_H + 1, 0.08), MAT_HOUSE.rail);
    railL.position.set(sx - 1, FLOOR_H / 2, 0);
    g.add(railL);

    // Techo
    if (type === 2) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.5, D + 1), MAT_HOUSE.concrete);
      roof.position.y = FLOOR_H + 0.25; roof.castShadow = true; g.add(roof);
      for (let i = 0; i < 12; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.6), MAT_HOUSE.sandbag);
        const a = (i / 12) * Math.PI * 2;
        s.position.set(Math.cos(a) * (W/2 + 0.4), FLOOR_H + 0.8, Math.sin(a) * (D/2 + 0.4));
        s.rotation.y = a;
        g.add(s);
      }
    } else {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.5, D + 1), MAT_HOUSE.roof);
      roof.position.y = floors * FLOOR_H + 0.25; roof.castShadow = true; g.add(roof);
      if (type === 0 || type === 3) {
        const chim = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), MAT_HOUSE.floor);
        chim.position.set(W/3, floors * FLOOR_H + 1, -D/3);
        g.add(chim);
      }
    }

    API.scene.add(g);

    // Colisión
    if (window.houses && Array.isArray(window.houses)) {
      window.houses.push({ pos: null, min: V(x - W/2, 0, z - D/2), max: V(x + W/2, floors * FLOOR_H, z + D/2) });
    }
    // Slots IA
    if (window.houseList && Array.isArray(window.houseList)) {
      const slots = [];
      const offsets = [[-3,-3.8],[3,-3.8],[-3.8,-3],[-3.8,3],[3.8,-3],[3.8,3],[-4,3.8],[4,3.8]];
      for (const s of offsets) slots.push({ x: x + s[0], z: z + s[1], hx: x, hz: z, occ: null });
      window.houseList.push({ x, z, slots });
    }
    if (window.coverObjs && Array.isArray(window.coverObjs)) {
      window.coverObjs.push({ x, z, r: 7 });
    }

    const b = {
      mesh: g, groundFloor, groundWalls, upperFloors,
      hp: 400 * floors, maxHp: 400 * floors,
      state: 'intact', collapseT: 0,
      x, z, W, D, floors, FLOOR_H,
      radius: Math.max(W, D) / 2 + 0.5,
    };
    buildings.push(b);
    return b;
  }

  // ===================== REEMPLAZAR CASAS BASE =====================
  function replaceBaseHouses() {
    const positions = [];
    if (window.houseList && Array.isArray(window.houseList)) {
      for (const h of window.houseList) {
        if (h && h.x !== undefined) positions.push({ x: h.x, z: h.z });
      }
      window.houseList.length = 0;
    }
    if (window.coverObjs && Array.isArray(window.coverObjs)) window.coverObjs.length = 0;
    if (window.houses && Array.isArray(window.houses)) window.houses.length = 0;

    let replaced = 0;
    positions.forEach((p, i) => {
      if (p.z >= RIVER.zMin - 3 && p.z <= RIVER.zMax + 3) return;
      if (Math.abs(p.x) > 128) return;
      const type = i % 4;
      const hue = [0xd8d2c4, 0xc8b8a0, 0xb8c8d0, 0xd0c0a0][i % 4];
      buildHouse(p.x, p.z, type, hue);
      replaced++;
    });

    // Casas extra en posiciones estratégicas
    const extraHouses = [
      [-45, 20], [45, 20], [-45, -20], [45, -20],
      [-90, -170], [90, 170],
      [-160, -80], [160, -80], [-160, 80], [160, 80],
      [-30, -240], [30, -240], [-30, 240], [30, 240],
      [-70, -140], [70, -140], [-70, 140], [70, 140],
      [-110, 0], [110, 0],
    ];
    extraHouses.forEach(([bx, bz], i) => {
      if (Math.abs(bx) > 128) return;
      if (bz >= RIVER.zMin - 3 && bz <= RIVER.zMax + 3) return;
      for (const h of buildings) if (Math.hypot(bx - h.x, bz - h.z) < 14) return;
      const type = (i + 1) % 4;
      const hue = [0xc8b8a0, 0xb8c8d0, 0xd0c0a0, 0xd8d2c4][i % 4];
      buildHouse(bx, bz, type, hue);
      replaced++;
    });

    console.log(`🏘️ ${replaced} casas destructibles colocadas`);
  }

  // ===================== DAÑO + DESTRUCCIÓN =====================
  function damageWall(b, wall, dmg) {
    if (wall.hp <= 0) return;
    wall.hp -= dmg;
    const ratio = Math.max(0, wall.hp / wall.maxHp);
    if (wall.mesh.material && wall.mesh.material.color) {
      const c = wall.mesh.material.color;
      c.r = Math.min(1, c.r * 0.85 + 0.15 + (1 - ratio) * 0.15);
      c.g = Math.max(0, c.g * (0.75 + ratio * 0.15));
      c.b = Math.max(0, c.b * (0.75 + ratio * 0.15));
    }
    wall.mesh.position.y = wall.pos[1] + (Math.random() - 0.5) * 0.15;
    spawnDust(V(b.x + wall.pos[0], wall.pos[1], b.z + wall.pos[2]));
    if (wall.hp <= 0) {
      wall.mesh.visible = false;
      spawnFlyingDebris(V(b.x + wall.pos[0], wall.pos[1] + 1, b.z + wall.pos[2]), 6);
      API.playSound('clash');
      if (b.groundWalls.every(w => w.hp <= 0)) triggerCollapse(b);
    }
  }
  function triggerCollapse(b) {
    if (b.state !== 'intact') return;
    b.state = 'collapsing';
    b.collapseT = 0;
    playDestroySound();
    shakeAmount = Math.max(shakeAmount, 4);
    API.say('💥 ¡Edificio colapsando!');
  }
  function updateBuildings(dt) {
    for (const b of buildings) {
      if (b.state === 'collapsing') {
        b.collapseT += dt;
        const t = b.collapseT;
        if (t < 0.4) {
          b.groundFloor.position.x = Math.sin(t * 80) * 0.08;
          b.groundFloor.position.z = Math.cos(t * 70) * 0.08;
        } else if (t < 1.4) {
          const k = (t - 0.4);
          const ease = k * k;
          for (const uf of b.upperFloors) {
            uf.group.position.x = 0; uf.group.position.z = 0;
            uf.group.position.y = uf.group.position.y - ease * 0.5 - 2.2 * (k > 0.5 ? (k - 0.5) * 2 : 0);
            uf.group.rotation.z = Math.sin(k * Math.PI) * 0.22;
          }
          if (Math.random() < 0.5) spawnDust(V(b.x + rnd(-3, 3), 3, b.z + rnd(-3, 3)));
        } else if (t < 2.4) {
          const k = (t - 1.4);
          const ease = k * k;
          for (const uf of b.upperFloors) {
            uf.group.position.y = 1.8 - ease * 1.8;
            uf.group.rotation.z = 0.22 + ease * 0.4;
          }
          if (Math.random() < 0.6) spawnDust(V(b.x + rnd(-4, 4), 1.5, b.z + rnd(-4, 4)));
        } else {
          b.state = 'destroyed';
          spawnSmokePlume(V(b.x, 1, b.z));
          shakeAmount = Math.max(shakeAmount, 4);
          for (const uf of b.upperFloors) uf.group.visible = false;
          b.groundFloor.visible = false;
          // Escombros persistentes
          const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
          const rubbleMat2 = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
          for (let i = 0; i < 30; i++) {
            const r = new THREE.Mesh(
              new THREE.BoxGeometry(rnd(0.4, 1.8), rnd(0.2, 0.9), rnd(0.4, 1.6)),
              Math.random() < 0.5 ? rubbleMat : rubbleMat2
            );
            r.position.set(b.x + rnd(-4, 4), rnd(0.15, 1.5), b.z + rnd(-4, 4));
            r.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
            r.castShadow = true;
            API.scene.add(r);
          }
          // Fuego parpadeante
          b.fires = [];
          for (let i = 0; i < 3; i++) {
            const fire = new THREE.Mesh(
              new THREE.SphereGeometry(rnd(0.4, 0.7), 6, 5),
              new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 })
            );
            fire.position.set(b.x + rnd(-3, 3), rnd(0.3, 1.2), b.z + rnd(-3, 3));
            API.scene.add(fire);
            b.fires.push({ mesh: fire, t: Math.random() * 10, baseY: fire.position.y });
          }
          b.smokeTimer = 0;
          // Quitar colisión
          if (window.houses && Array.isArray(window.houses)) {
            const idx = window.houses.findIndex(h => h && h.min &&
              Math.abs(h.min.x - (b.x - b.W/2)) < 0.5 &&
              Math.abs(h.min.z - (b.z - b.D/2)) < 0.5);
            if (idx >= 0) window.houses.splice(idx, 1);
          }
        }
      }
      // Fuego continuo
      if (b.state === 'destroyed' && b.fires) {
        for (const f of b.fires) {
          f.t += dt;
          const s = 0.7 + Math.sin(f.t * 8) * 0.3 + Math.random() * 0.2;
          f.mesh.scale.setScalar(s);
          f.mesh.position.y = f.baseY + Math.sin(f.t * 4) * 0.1;
          f.mesh.material.opacity = 0.7 + Math.sin(f.t * 6) * 0.25;
        }
        b.smokeTimer = (b.smokeTimer || 0) + dt;
        if (b.smokeTimer > 0.6) {
          b.smokeTimer = 0;
          const smoke = new THREE.Mesh(
            new THREE.SphereGeometry(rnd(0.6, 1.2), 6, 5),
            new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.6, depthWrite: false })
          );
          smoke.position.set(b.x + rnd(-2, 2), 1.5, b.z + rnd(-2, 2));
          API.scene.add(smoke);
          // Fade out
          let t = 0;
          const iv = setInterval(() => {
            t += 0.1;
            smoke.position.y += 0.2;
            smoke.material.opacity = 0.6 * (1 - t / 3.5);
            if (t > 3.5) { API.scene.remove(smoke); clearInterval(iv); }
          }, 100);
        }
      }
    }
  }

  // ===================== RESOLVER DAÑO A CASAS =====================
  const _prev = new THREE.Vector3();
  function resolveHouseDamage() {
    for (let i = API.projectiles.length - 1; i >= 0; i--) {
      const pr = API.projectiles[i];
      if (!pr || !pr.mesh) continue;
      const pPos = pr.mesh.position;
      _prev.copy(pPos).addScaledVector(pr.dir, -100 * 0.05);
      let consumed = false;
      for (const b of buildings) {
        if (b.state === 'destroyed') continue;
        const minX = b.x - b.W/2 - 2, maxX = b.x + b.W/2 + 2;
        const minZ = b.z - b.D/2 - 2, maxZ = b.z + b.D/2 + 2;
        const inX = pPos.x > minX && pPos.x < maxX;
        const inZ = pPos.z > minZ && pPos.z < maxZ;
        const inXp = _prev.x > minX && _prev.x < maxX;
        const inZp = _prev.z > minZ && _prev.z < maxZ;
        if ((inX && inZ) || (inXp && inZp)) {
          if (pPos.y < 4.5) {
            let best = null, bd = 1e9;
            for (const w of b.groundWalls) {
              if (w.hp <= 0) continue;
              const wx = b.x + w.pos[0], wz = b.z + w.pos[2];
              const d = Math.hypot(pPos.x - wx, pPos.z - wz);
              if (d < bd) { bd = d; best = w; }
            }
            if (best) { damageWall(b, best, pr.damage); shakeAmount = Math.max(shakeAmount, 0.4); consumed = true; }
          } else if (pPos.y < 9) {
            for (const uf of b.upperFloors) {
              for (const w of uf.walls) {
                if (w.hp <= 0) continue;
                const wx = b.x + w.pos[0], wz = b.z + w.pos[2];
                if (Math.hypot(pPos.x - wx, pPos.z - wz) < 4.5) {
                  w.hp -= pr.damage;
                  if (w.hp <= 0) { w.mesh.visible = false; spawnDust(V(b.x + w.pos[0], uf.group.position.y + w.pos[1], b.z + w.pos[2])); }
                  consumed = true; break;
                }
              }
              if (consumed) break;
            }
          }
          if (consumed) break;
        }
      }
      if (consumed) {
        API.scene.remove(pr.mesh);
        API.projectiles.splice(i, 1);
      }
    }
  }

  // ===================== APLICAR SHAKE =====================
  function applyShake(dt) {
    if (shakeAmount > 0.02) {
      API.camera.position.x += (Math.random() - 0.5) * shakeAmount;
      API.camera.position.y += (Math.random() - 0.5) * shakeAmount * 0.6;
      API.camera.position.z += (Math.random() - 0.5) * shakeAmount;
      shakeAmount *= 0.85;
    } else shakeAmount = 0;
  }

  // ===================== INICIALIZAR =====================
  setTimeout(() => {
    hideBaseHouses();
    replaceBaseHouses();
  }, 150);

  // ===================== HOOK =====================
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    updateBuildings(dt);
    resolveHouseDamage();
    applyShake(dt);
  };

  window.CasasSystem = { version: '1.0', buildings };
  console.log(`🏘️ Mod Casas Destructibles v1.0 listo.`);
})();