/* ============================================================
   MOD: Casas Destructibles v3.0 (optimizado + manzanas ordenadas)
   - 6 tipos de edificio: casa baja, casa familiar, apartamentos,
     tienda, almacén y oficinas con fachada de vidrio
   - Las paredes son piezas: cada pieza se rompe por separado
   - Ventanas que se rompen, puertas abiertas (la IA entra por ahí)
   - Grietas al dañarse, polvo, escombros con gravedad y rebote
   - Colapso por pisos: el piso de arriba cae sobre el de abajo
   - Fuego y humo en las ruinas; blast() para explosiones
   Requiere: IronfrontAPI (mejora_mundo.js para WorldData, opcional)
   Exporta: CasasSystem.{buildings, blast, clearAll, buildLots, layoutDefault}
   Si localStorage.ironfront_mapa === 'ciudad', no pone el pueblo por defecto:
   lo hace mapa_ciudad.js.
   ============================================================ */
(function () {
  if (window.__CASAS_LOADED) { console.warn('Casas ya cargadas'); return; }
  window.__CASAS_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const FAR = 99999;
  const GRAV = 16;
  const CFG = {
    cell: 3.0, fh: 4, wallHp: 260, glassHp: 70,
    maxDebris: 90, maxFx: 60, maxBuildings: 26,
    breakSoundGap: 0.12,
  };

  console.log('Mod Casas Destructibles v3.0: iniciando...');

  const buildings = [];
  let T_NOW = 0, shakeAmount = 0, lastBreakSnd = -1;

  // Lee un global del juego: window.X si existe, si no la variable global
  function world(name) {
    if (window[name] !== undefined) return window[name];
    try { return (0, eval)(name); } catch (e) { return null; }
  }
  const WD = window.WorldData || {};
  const RIVER = WD.RIVER || { zMin: 42, zMax: 68 };

  // ===================== TIPOS DE EDIFICIO =====================
  const TYPES = [
    { name: 'Casa baja',     W: 8,  D: 8,  floors: 1, wall: 0xd8d2c4, roof: 'pitch', chimney: true },
    { name: 'Casa familiar', W: 9,  D: 9,  floors: 2, wall: 0xc8b8a0, roof: 'pitch', porch: true },
    { name: 'Apartamentos',  W: 10, D: 9,  floors: 4, wall: 0xb8c0c8, roof: 'flat',  balc: true, ac: true },
    { name: 'Tienda',        W: 12, D: 8,  floors: 1, wall: 0xd0c0a0, roof: 'flat',  shop: true },
    { name: 'Almacen',       W: 12, D: 10, floors: 1, wall: 0x7d8a94, roof: 'flat',  warehouse: true, fh: 5.5 },
    { name: 'Oficinas',      W: 10, D: 9,  floors: 3, wall: 0x9aa5b0, roof: 'flat',  glassy: true, ac: true },
  ];

  // ===================== MATERIALES Y GEOMETRÍA (compartidos) =====================
  const matCache = {};
  function M(hex) { return matCache[hex] || (matCache[hex] = new THREE.MeshLambertMaterial({ color: hex })); }
  const MAT_GLASS = new THREE.MeshLambertMaterial({ color: 0x7fb6d9, transparent: true, opacity: 0.55, depthWrite: false, emissive: 0x0d2233 });
  const MAT_DOOR = M(0x3a2a1a), MAT_CRACK = M(0x161616), MAT_ROOF = M(0x7a3a2a), MAT_SLAB = M(0x8a8478);
  const MAT_METAL = M(0x4a5056), MAT_AWN_A = M(0xc8402c), MAT_AWN_B = M(0xf2efe6), MAT_SIGN = M(0x7a1f1f);
  const MAT_AC = M(0x9aa0a6), MAT_RAIL = M(0x555555), MAT_COL = M(0xeeeae0);
  const geoCache = {};
  function G(w, h, d) {
    const k = w.toFixed(2) + '_' + h.toFixed(2) + '_' + d.toFixed(2);
    return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d));
  }
  // Pared según eje: 'x' = corre a lo largo de x, 'z' = a lo largo de z
  function axisGeo(axis, along, h, thick) { return axis === 'x' ? G(along, h, thick) : G(thick, h, along); }
  function box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(G(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }

  // ===================== POOLS: ESCOMBROS Y HUMO/FUEGO =====================
  const dmats = [0xbdb3a2, 0x8a7f70, 0x5f5649, 0xd8d2c4].map(c => M(c));
  const dpool = [];
  for (let i = 0; i < CFG.maxDebris; i++) {
    const m = new THREE.Mesh(G(1, 1, 1), dmats[i % dmats.length]);
    m.visible = false; API.scene.add(m);
    dpool.push({ m, v: V(0, 0, 0), w: V(0, 0, 0), t: 0, on: false });
  }
  let dHead = 0;
  function spawnDebris(x, y, z, n, spread, scale) {
    for (let k = 0; k < n; k++) {
      const d = dpool[dHead]; dHead = (dHead + 1) % dpool.length;
      const s = rnd(0.25, 0.8) * scale;
      d.on = true; d.t = rnd(2.2, 4); d.m.visible = true;
      d.m.position.set(x + rnd(-spread, spread), y + rnd(0, 0.8), z + rnd(-spread, spread));
      d.m.scale.set(s * rnd(0.7, 1.5), s * rnd(0.6, 1.2), s * rnd(0.7, 1.5));
      d.m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      d.v.set(rnd(-3.5, 3.5), rnd(2.5, 6.5), rnd(-3.5, 3.5));
      d.w.set(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6));
    }
  }
  function updateDebris(dt) {
    for (const d of dpool) {
      if (!d.on) continue;
      d.t -= dt;
      if (d.t <= 0) { d.on = false; d.m.visible = false; continue; }
      d.v.y -= 18 * dt;
      d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < 0.1) {
        d.m.position.y = 0.1; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.5);
      }
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
    }
  }

  const FX = {
    dust:  { col: 0xb9a886, life: 0.9, s: 0.5, grow: 1.2,  op: 0.8, up: 0.8 },
    smoke: { col: 0x3a3a3a, life: 2.8, s: 0.8, grow: 0.6,  op: 0.6, up: 2.2 },
    fire:  { col: 0xff7a1a, life: 0.45, s: 0.6, grow: -0.4, op: 0.9, up: 1.8 },
  };
  const fpool = [];
  for (let i = 0; i < CFG.maxFx; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xbbaa88, transparent: true, opacity: 0.8, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), mat);
    m.visible = false; API.scene.add(m);
    fpool.push({ m, mat, v: V(0, 0, 0), t: 0, life: 1, grow: 0, op: 0.8, on: false });
  }
  let fHead = 0;
  function spawnFx(p, kind, n) {
    const K = FX[kind]; n = n || 1;
    for (let k = 0; k < n; k++) {
      const f = fpool[fHead]; fHead = (fHead + 1) % fpool.length;
      f.on = true; f.life = K.life * rnd(0.7, 1); f.t = f.life; f.grow = K.grow; f.op = K.op;
      f.m.visible = true; f.mat.color.setHex(K.col); f.mat.opacity = K.op;
      f.m.position.set(p.x + rnd(-1, 1), p.y + rnd(0, 1), p.z + rnd(-1, 1));
      f.m.scale.setScalar(K.s * rnd(0.8, 1.4));
      f.v.set(rnd(-0.8, 0.8), K.up * rnd(0.6, 1.2), rnd(-0.8, 0.8));
    }
  }
  function updateFx(dt) {
    for (const f of fpool) {
      if (!f.on) continue;
      f.t -= dt;
      if (f.t <= 0) { f.on = false; f.m.visible = false; continue; }
      f.m.position.addScaledVector(f.v, dt);
      f.m.scale.multiplyScalar(1 + f.grow * dt);
      f.mat.opacity = f.op * (f.t / f.life);
    }
  }

  function breakSound() {
    if (T_NOW - lastBreakSnd < CFG.breakSoundGap) return;
    lastBreakSnd = T_NOW; API.playSound('clash');
  }

  // ===================== OCULTAR CASAS BASE =====================
  let baseHidden = false;
  function hideBaseHouses() {
    if (baseHidden) return; baseHidden = true;
    let hidden = 0;
    API.scene.traverse(obj => {
      if (obj.isInstancedMesh && obj.material && obj.material.color) {
        const hex = obj.material.color.getHex();
        if (hex === 0xd8d2c4 || hex === 0x883333 || hex === 0x6a2626 || hex === 0x5a3a1e || hex === 0x2d4a66) {
          obj.visible = false; hidden++;
        }
      }
    });
    console.log(`${hidden} meshes base ocultados`);
  }
  // Quita de una lista solo lo que estaba cerca de las casas base (deja árboles, etc.)
  function pruneNear(arr, pts, r) {
    if (!Array.isArray(arr)) return;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i]; if (!e) continue;
      const cx = e.min ? (e.min.x + e.max.x) / 2 : e.x;
      const cz = e.min ? (e.min.z + e.max.z) / 2 : e.z;
      if (pts.some(p => Math.hypot(p.x - cx, p.z - cz) < r)) arr.splice(i, 1);
    }
  }

  // ===================== DISEÑO DE CADA CELDA DE FACHADA =====================
  function cellKind(T, f, s, i, n) {
    if (f === 0 && s.n === 'S') {
      const isDoor = T.warehouse ? (i === n / 2 - 1 || i === n / 2) : (i === Math.floor(n / 2));
      if (isDoor) return 'door';
    }
    if (T.glassy) return (i === 0 || i === n - 1) ? 'wall' : 'window';
    if (T.shop) return 'window';
    if (T.warehouse) return 'wall';
    return (i % 2 === 1) ? 'window' : 'wall';
  }

  function windowDecor(mesh, s, cw, fh) {
    const gl = new THREE.Mesh(axisGeo(s.axis, cw * 0.78, fh * 0.42, 0.05), MAT_GLASS);
    gl.position.set(s.axis === 'x' ? 0 : s.nx * 0.27, 0.1, s.axis === 'x' ? s.nz * 0.27 : 0);
    mesh.add(gl);
  }
  function doorDecor(fg, T, s, lx, lz, cw, fh) {
    if (T.warehouse) {
      // Dos postes metálicos, sin puerta: entrada amplia abierta
      box(fg, 0.3, fh, 0.3, MAT_METAL, lx - cw / 2 + 0.15, fh / 2, lz + 0.2);
      box(fg, 0.3, fh, 0.3, MAT_METAL, lx + cw / 2 - 0.15, fh / 2, lz + 0.2);
      return;
    }
    // Puerta abierta, apoyada a un lado del marco
    box(fg, 0.1, 2.6, 0.9, MAT_DOOR, lx - cw * 0.42, 1.3, lz + 0.5);
  }

  // ===================== CONSTRUCTOR DE EDIFICIO =====================
  function buildHouse(x, z, type, seed) {
    const T = TYPES[type], fh = T.fh || CFG.fh, W = T.W, D = T.D, F = T.floors;
    const TH = 0.5;
    const g = new THREE.Group(); g.position.set(x, 0, z); API.scene.add(g);
    const wallMat = M(T.wall);
    const b = {
      x, z, type, name: T.name, W, D, F, fh, g, seed,
      groups: [], chunks: [], ground: [],
      state: 'intact', collT: 0, landed: [], burnT: 0, fxT: 0,
      R: Math.hypot(W, D) / 2,
    };
    const sides = [
      { n: 'N', axis: 'x', fixed: -D / 2, nx: 0,  nz: -1, L: W },
      { n: 'S', axis: 'x', fixed: D / 2,  nx: 0,  nz: 1,  L: W },
      { n: 'W', axis: 'z', fixed: -W / 2, nx: -1, nz: 0,  L: D },
      { n: 'E', axis: 'z', fixed: W / 2,  nx: 1,  nz: 0,  L: D },
    ];

    for (let f = 0; f < F; f++) {
      const fg = new THREE.Group(); fg.position.y = f * fh; g.add(fg); b.groups.push(fg);

      for (const s of sides) {
        const n = Math.max(2, Math.round(s.L / CFG.cell)), cw = s.L / n;
        for (let i = 0; i < n; i++) {
          const kind = cellKind(T, f, s, i, n);
          const c0 = -s.L / 2 + cw * (i + 0.5);
          const lx = s.axis === 'x' ? c0 : s.fixed;
          const lz = s.axis === 'x' ? s.fixed : c0;

          if (kind === 'door') { doorDecor(fg, T, s, lx, lz, cw, fh); continue; }

          const isWin = kind === 'window';
          const mesh = new THREE.Mesh(axisGeo(s.axis, cw, fh, TH), wallMat);
          mesh.position.set(lx, fh / 2, lz);
          mesh.castShadow = false; mesh.receiveShadow = false;
          fg.add(mesh);
          if (isWin) windowDecor(mesh, s, cw, fh);

          // Balcón delante de las ventanas del frente (apartamentos)
          if (T.balc && f >= 1 && s.n === 'S' && isWin) {
            box(fg, cw * 0.9, 0.15, 1.1, MAT_SLAB, lx, 0.07, D / 2 + 0.55);
            box(fg, cw * 0.9, 0.9, 0.05, MAT_RAIL, lx, 0.5, D / 2 + 1.1);
          }

          const hx = s.axis === 'x' ? cw / 2 : TH / 2;
          const hz = s.axis === 'x' ? TH / 2 : cw / 2;
          const hp = isWin ? CFG.glassHp : CFG.wallHp;
          const c = {
            b, f, s, kind, mesh, dead: false, hp, maxHp: hp, mat: null, cracks: [],
            box: { x0: lx - hx, x1: lx + hx, z0: lz - hz, z1: lz + hz, y0: f * fh, y1: (f + 1) * fh },
            coll: null, bw: null,
          };
          b.chunks.push(c);

          if (f === 0) {
            b.ground.push(c);
            // Colisión de movimiento (pisos bajos)
            const hs = world('houses');
            c.coll = { pos: null, min: V(x + c.box.x0, 0, z + c.box.z0), max: V(x + c.box.x1, fh, z + c.box.z1) };
            if (Array.isArray(hs)) hs.push(c.coll);
          }
        }
      }

      // Losa entre pisos (decorativa, cae con su piso)
      if (f < F - 1) box(fg, W + 0.3, 0.3, D + 0.3, MAT_SLAB, 0, fh - 0.15, 0);
      // Aires acondicionados (lado este)
      if (T.ac && f % 2 === 0 && f > 0) box(fg, 1.2, 0.9, 1.0, MAT_AC, W / 2 + 0.6, 0.6, 0);
    }

    // Decoración de planta baja
    const g0 = b.groups[0];
    if (T.porch) {
      box(g0, 0.3, fh, 0.3, MAT_COL, -1.8, fh / 2, D / 2 + 1.2);
      box(g0, 0.3, fh, 0.3, MAT_COL,  1.8, fh / 2, D / 2 + 1.2);
      box(g0, 4.2, 0.25, 2.6, MAT_ROOF, 0, fh - 0.2, D / 2 + 1.2);
    }
    if (T.shop) {
      for (let k = 0; k < 6; k++) box(g0, W / 6, 0.14, 1.6, k % 2 ? MAT_AWN_B : MAT_AWN_A, -W / 2 + W / 12 + k * W / 6, 3.4, D / 2 + 0.8);
      box(g0, W * 0.6, 0.7, 0.15, MAT_SIGN, 0, 3.9, D / 2 + 0.1);
    }

    // Techo en el último piso
    const tg = b.groups[F - 1];
    if (T.roof === 'pitch') {
      const r1 = box(tg, W + 0.8, 0.3, D / 2 + 0.9, MAT_ROOF, 0, fh + 0.7, -D / 4); r1.rotation.x = -0.5;
      const r2 = box(tg, W + 0.8, 0.3, D / 2 + 0.9, MAT_ROOF, 0, fh + 0.7, D / 4); r2.rotation.x = 0.5;
      if (T.chimney) box(tg, 0.8, 1.6, 0.8, M(0x6b4a3a), W / 3, fh + 1.2, -D / 3);
    } else {
      box(tg, W + 0.6, 0.35, D + 0.6, MAT_SLAB, 0, fh + 0.18, 0);
      if (T.ac) box(tg, 2.4, 1.0, 1.8, MAT_AC, -W / 4, fh + 0.7, 0);
    }

    // Registro para la IA (puertas y cobertura)
    const hl = world('houseList');
    if (Array.isArray(hl)) {
      const slots = [];
      const offs = [[-3, -3.8], [3, -3.8], [-3.8, -3], [-3.8, 3], [3.8, -3], [3.8, 3], [-4, 3.8], [4, 3.8]];
      for (const o of offs) slots.push({ x: x + o[0], z: z + o[1], hx: x, hz: z, occ: null });
      hl.push({ x, z, slots });
    }
    const co = world('coverObjs');
    if (Array.isArray(co)) co.push({ x, z, r: Math.max(W, D) / 2 });

    buildings.push(b);
    return b;
  }

  // ===================== DAÑO =====================
  function worldCenter(b, c) {
    return V(b.x + (c.box.x0 + c.box.x1) / 2, (c.box.y0 + c.box.y1) / 2, b.z + (c.box.z0 + c.box.z1) / 2);
  }
  function addCracks(c, n) {
    const s = c.s;
    const span = s.axis === 'x' ? (c.box.x1 - c.box.x0) : (c.box.z1 - c.box.z0);
    for (let i = 0; i < n; i++) {
      const len = rnd(0.5, 1.1);
      const cr = new THREE.Mesh(axisGeo(s.axis, 0.07, len, 0.05), MAT_CRACK);
      cr.rotation.z = rnd(-0.6, 0.6);
      const along = rnd(-span * 0.35, span * 0.35), y = rnd(-1.0, 1.0);
      if (s.axis === 'x') cr.position.set(along, y, s.nz * 0.27);
      else cr.position.set(s.nx * 0.27, y, along);
      c.mesh.add(cr); c.cracks.push(cr);
    }
  }
  function damageChunk(c, dmg, at) {
    if (c.dead) return;
    c.hp -= dmg;
    const ratio = Math.max(0, c.hp / c.maxHp);
    if (c.hp > 0) {
      if (!c.mat) { c.mat = c.mesh.material.clone(); c.mesh.material = c.mat; }
      c.mat.color.multiplyScalar(0.94);
      if (ratio < 0.55 && c.cracks.length < 2) addCracks(c, 2);
      if (ratio < 0.3 && c.cracks.length < 5) addCracks(c, 2);
      spawnFx(at || worldCenter(c.b, c), 'dust', 2);
      return;
    }
    killChunk(c, at);
  }
  function killChunk(c, at) {
    const b = c.b;
    c.dead = true; c.mesh.visible = false;
    if (c.coll) { c.coll.min.set(FAR, 0, FAR); c.coll.max.set(FAR, 0, FAR); }
    const p = at || worldCenter(b, c);
    spawnDebris(p.x, p.y, p.z, c.kind === 'window' ? 4 : 7, 0.8, c.kind === 'window' ? 0.5 : 0.9);
    spawnFx(p, 'dust', 6);
    breakSound();
    checkCollapse(b);
  }

  // ===================== COLAPSO =====================
  function checkCollapse(b) {
    if (b.state !== 'intact') return;
    const alive = b.ground.filter(c => !c.dead).length;
    const frac = alive / Math.max(1, b.ground.length);
    const limit = b.F > 1 ? 0.45 : 0.25;
    if (frac < limit) startCollapse(b);
  }
  function startCollapse(b) {
    b.state = 'collapsing'; b.collT = 0; b.landed = [];
    API.say && API.say('💥 ¡' + b.name + ' colapsando!');
    API.playSound('explosion');
    shakeAmount = Math.max(shakeAmount, 3.5);
    spawnFx(V(b.x, 2, b.z), 'dust', 14);
  }
  function onFloorLanded(b, f) {
    const p = V(b.x, f * b.fh + 1, b.z);
    spawnDebris(p.x, p.y, p.z, 8, b.W / 3, 1.2);
    spawnFx(p, 'dust', 8);
    breakSound();
    shakeAmount = Math.max(shakeAmount, 2);
  }
  function disableBuilding(b) {
    const hl = world('houseList');
    if (Array.isArray(hl)) for (const h of hl) if (h && h.x === b.x && h.z === b.z) { h.x = FAR; h.z = FAR; for (const s of h.slots) s.occ = null; }
    const co = world('coverObjs');
    if (Array.isArray(co)) for (const c of co) if (c && c.x === b.x && c.z === b.z) { c.x = FAR; c.z = FAR; c.r = 0; }
  }
  function finishCollapse(b) {
    b.state = 'destroyed'; b.burnT = 40; b.fxT = 0;
    for (const grp of b.groups) grp.visible = false;
    for (const c of b.chunks) { c.dead = true; if (c.coll) { c.coll.min.set(FAR, 0, FAR); c.coll.max.set(FAR, 0, FAR); } }
    // Escombros permanentes dentro de la huella
    for (let i = 0; i < 8; i++) {
      const r = box(b.g, rnd(1, 3), rnd(0.3, 0.9), rnd(1, 2.6), i % 2 ? M(0x6a5a4a) : M(0x4a3a2a),
        rnd(-b.W * 0.4, b.W * 0.4), rnd(0.2, 0.6), rnd(-b.D * 0.4, b.D * 0.4));
      r.rotation.set(rnd(-0.3, 0.3), rnd(0, 3), rnd(-0.3, 0.3));
    }
    disableBuilding(b);
    spawnFx(V(b.x, 1, b.z), 'smoke', 6);
  }
  function updateBuildings(dt) {
    for (const b of buildings) {
      if (b.state === 'collapsing') {
        b.collT += dt;
        let allLanded = true;
        for (let f = b.F - 1; f >= 0; f--) {
          const tau = b.collT - (b.F - 1 - f) * 0.22;   // el piso de arriba cae primero
          const grp = b.groups[f];
          if (tau <= 0) { allLanded = false; continue; }
          const y0 = f * b.fh, rest = 0.15;
          let y = y0 - 0.5 * GRAV * tau * tau;
          if (y <= rest) {
            y = rest;
            if (!b.landed[f]) { b.landed[f] = true; onFloorLanded(b, f); }
          } else allLanded = false;
          grp.position.y = y;
          grp.rotation.x = Math.min(0.35, tau * 0.25) * (f % 2 ? 1 : -1);
          grp.rotation.z = Math.min(0.2, tau * 0.12) * (f % 2 ? -1 : 1);
        }
        if (allLanded && b.collT > 0.5) finishCollapse(b);
      } else if (b.state === 'destroyed' && b.burnT > 0) {
        b.burnT -= dt; b.fxT -= dt;
        if (b.fxT <= 0) {
          b.fxT = 0.35;
          const fp = V(b.x + rnd(-3, 3), 0.6, b.z + rnd(-3, 3));
          spawnFx(fp, 'fire', 1);
          spawnFx(V(fp.x, 1.5, fp.z), 'smoke', 1);
        }
      }
    }
  }

  // ===================== PROYECTILES Y EXPLOSIONES =====================
  function findHit(x, y, z) {
    for (const b of buildings) {
      if (b.state !== 'intact') continue;
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) > b.W / 2 + 0.8 || Math.abs(dz) > b.D / 2 + 0.8) continue;
      for (const c of b.chunks) {
        if (c.dead) continue;
        const a = c.box;
        if (dx > a.x0 - 0.25 && dx < a.x1 + 0.25 && dz > a.z0 - 0.25 && dz < a.z1 + 0.25 &&
            y > a.y0 - 0.25 && y < a.y1 + 0.25) return c;
      }
    }
    return null;
  }
  function resolveProjectiles() {
    const list = API.projectiles;
    if (!Array.isArray(list)) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const pr = list[i];
      if (!pr || !pr.mesh) continue;
      const p = pr.mesh.position;
      const sx = pr.prevX !== undefined ? pr.prevX : p.x;
      const sy = pr.prevY !== undefined ? pr.prevY : p.y;
      const sz = pr.prevZ !== undefined ? pr.prevZ : p.z;
      let hit = null, hitPt = null;
      for (let k = 0; k <= 3 && !hit; k++) {   // barrido del segmento para no atravesar paredes
        const t = k / 3;
        const x = sx + (p.x - sx) * t, y = sy + (p.y - sy) * t, z = sz + (p.z - sz) * t;
        hit = findHit(x, y, z);
        if (hit) hitPt = V(x, y, z);
      }
      pr.prevX = p.x; pr.prevY = p.y; pr.prevZ = p.z;
      if (hit) {
        damageChunk(hit, pr.damage || 25, hitPt);
        API.scene.remove(pr.mesh);
        list.splice(i, 1);
      }
    }
  }
  // Daño en área (bombas, explosiones). Ej: CasasSystem.blast(pos, 7, 400)
  function blast(pos, radius, dmg) {
    for (const b of buildings) {
      if (b.state !== 'intact') continue;
      if (Math.hypot(pos.x - b.x, pos.z - b.z) > b.R + radius) continue;
      for (const c of b.chunks.slice()) {
        if (c.dead) continue;
        const p = worldCenter(b, c);
        const d = p.distanceTo(pos);
        if (d < radius) damageChunk(c, dmg * (1 - (d / radius) * 0.6), p);
      }
    }
    spawnFx(pos, 'dust', 10);
    shakeAmount = Math.max(shakeAmount, 2);
  }

  // Línea de tiro: la IA sólo considera tapada una línea si hay pared baja intacta
  function segBlocked(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(dist / 1.5));
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const b of buildings) {
        if (b.state !== 'intact') continue;
        const dx = x - b.x, dz = z - b.z;
        if (Math.abs(dx) > b.W / 2 || Math.abs(dz) > b.D / 2) continue;
        for (const c of b.ground) {
          if (c.dead) continue;
          const a = c.box;
          if (dx > a.x0 && dx < a.x1 && dz > a.z0 && dz < a.z1) return true;
        }
      }
    }
    return false;
  }

  // ===================== CAMBIO EN LOS DEFAULTS DEL JUEGO =====================
  function installOverrides() {
    // Las balas ya no se frenan por la lista antigua: el mod decide cuándo hay impacto
    window.bulletBlocked = function () { return false; };
    window.losClear = function (a, b) { return !segBlocked(a.x, a.z, b.x, b.z); };
    const origExp = window.spawnExplosion;
    if (typeof origExp === 'function') {
      window.spawnExplosion = function (pos) { origExp(pos); blast(pos, 7, 400); };
    }
  }

  // ===================== LIMPIEZA Y COLOCACIÓN =====================
  function clearAll() {
    for (const b of buildings) {
      API.scene.remove(b.g);
      for (const c of b.chunks) {
        if (c.coll) { c.coll.min.set(FAR, 0, FAR); c.coll.max.set(FAR, 0, FAR); }
      }
      disableBuilding(b);
    }
    buildings.length = 0;
    console.log('Casas: todas retiradas');
  }

  // Lotes: cuadrícula de manzanas a los lados de las calles (x=0 y z=0), lejos del río y del centro
  const LOT_X = [-117, -91, -65, -39, -13, 13, 39, 65, 91, 117];
  const LOT_Z = [-117, -91, -65, -39, -13, 13, 91, 117];
  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t2 = Math.imul(a ^ a >>> 15, 1 | a); t2 = t2 + Math.imul(t2 ^ t2 >>> 7, 61 | t2) ^ t2; return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296; }; }
  function lotIsFree(x, z) {
    if (z > RIVER.zMin - 8 && z < RIVER.zMax + 8) return false;   // río y puentes
    if (Math.hypot(x, z) < 30) return false;                      // zona de captura
    return true;
  }
  // mode: 'pueblo' (cerca de 60% ocupado, tipos mixtos) | 'ciudad' (casi todo ocupado, más altos)
  function layoutLots(mode, seed) {
    const rnd01 = mulberry(seed || 7), out = [];
    for (const x of LOT_X) for (const z of LOT_Z) {
      if (!lotIsFree(x, z)) continue;
      const far = Math.max(Math.abs(x), Math.abs(z)) >= 100;
      if (mode === 'ciudad') {
        if (rnd01() < 0.1) continue;
        const pool = far ? [0, 1, 4] : [2, 2, 5, 3, 1];
        out.push({ x, z, type: pool[Math.floor(rnd01() * pool.length)] });
      } else {
        if (rnd01() < 0.4) continue;
        const pool = far ? [0, 1, 4, 0] : [1, 2, 3, 5, 0];
        out.push({ x, z, type: pool[Math.floor(rnd01() * pool.length)] });
      }
    }
    return out.slice(0, CFG.maxBuildings);
  }
  function buildLots(list) {
    let n = 0;
    for (const L of list) { if (buildings.length >= CFG.maxBuildings) break; buildHouse(L.x, L.z, L.type, n++); }
    console.log(`Casas: ${buildings.length} edificios colocados`);
    return buildings.length;
  }
  function layoutDefault() {
    hideBaseHouses();
    const base = [];
    const hl = world('houseList') || [];
    for (const h of hl) if (h && h.x !== undefined) base.push({ x: h.x, z: h.z });
    pruneNear(world('houses'), base, 9);
    pruneNear(world('coverObjs'), base, 9);
    if (Array.isArray(hl)) hl.length = 0;
    return buildLots(layoutLots('pueblo', 7));
  }

  function applyShake(dt) {
    if (shakeAmount > 0.02) {
      API.camera.position.x += (Math.random() - 0.5) * shakeAmount;
      API.camera.position.y += (Math.random() - 0.5) * shakeAmount * 0.6;
      API.camera.position.z += (Math.random() - 0.5) * shakeAmount;
      shakeAmount *= 0.85;
    } else shakeAmount = 0;
  }

  // ===================== INICIALIZAR =====================
  let mapaCiudad = false;
  try { mapaCiudad = localStorage.getItem('ironfront_mapa') === 'ciudad'; } catch (e) {}
  setTimeout(() => {
    installOverrides();
    if (!mapaCiudad) layoutDefault();
  }, 150);

  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    T_NOW += dt;
    updateBuildings(dt);
    resolveProjectiles();
    updateDebris(dt);
    updateFx(dt);
    applyShake(dt);
  };

  window.CasasSystem = { version: '3.0', buildings, blast, clearAll, buildLots, layoutLots, layoutDefault, hideBaseHouses };
  console.log('Mod Casas Destructibles v3.0 listo.');
})();
