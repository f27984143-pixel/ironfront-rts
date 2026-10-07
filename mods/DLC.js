/* ============================================================
   MOD: Modelos HD + IA de Vuelo v3.1
   - Fix: preservar userData al reemplazar meshes (para que las
     unidades sigan siendo seleccionables/controlables)
   ============================================================ */
(function () {
  if (window.__HD_MODELS_LOADED) { console.warn('⚠️ Modelos HD ya cargados'); return; }
  window.__HD_MODELS_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('❌ IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);

  console.log('🎨 Mod Modelos HD v3.1: iniciando...');
  API.say('🎨 Modelos HD v3.1');

  const MAT = {
    dark:   new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    black:  new THREE.MeshLambertMaterial({ color: 0x0a0a0a }),
    glass:  new THREE.MeshLambertMaterial({ color: 0x0e1a2a, emissive: 0x051020 }),
    metal:  new THREE.MeshLambertMaterial({ color: 0x666666 }),
    metalD: new THREE.MeshLambertMaterial({ color: 0x333333 }),
    chrome: new THREE.MeshLambertMaterial({ color: 0x999999 }),
    rubber: new THREE.MeshLambertMaterial({ color: 0x0a0a0a }),
    rim:    new THREE.MeshLambertMaterial({ color: 0x888888 }),
    redL:   new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    greenL: new THREE.MeshBasicMaterial({ color: 0x00ff44 }),
    amberL: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
    tip:    new THREE.MeshBasicMaterial({ color: 0xcc2222 }),
    rotor:  new THREE.MeshBasicMaterial({ color: 0x111111 }),
  };
  function mk(g, geo, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
    m.castShadow = true; g.add(m); return m;
  }

  function buildPlane(color) {
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const bodyDk  = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) });
    const g = new THREE.Group();
    mk(g, new THREE.BoxGeometry(1.7, 1.4, 9), bodyMat, 0, 0, 0);
    mk(g, new THREE.BoxGeometry(1.3, 1.0, 3.5), bodyMat, 0, 0.1, -5.5);
    mk(g, new THREE.ConeGeometry(0.85, 3.2, 10), bodyMat, 0, 0, 5.5, Math.PI / 2);
    mk(g, new THREE.ConeGeometry(0.35, 0.8, 10), MAT.tip, 0, 0, 7.2, Math.PI / 2);
    mk(g, new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), MAT.chrome, 0, 0, 7.9, Math.PI / 2);
    mk(g, new THREE.BoxGeometry(0.95, 0.75, 2.8), MAT.glass, 0, 0.9, -0.8);
    mk(g, new THREE.BoxGeometry(1.0, 0.08, 2.9), bodyDk, 0, 1.30, -0.8);
    mk(g, new THREE.BoxGeometry(0.08, 0.75, 2.9), bodyDk, 0, 0.9, -0.8);
    mk(g, new THREE.BoxGeometry(0.5, 0.5, 0.5), MAT.dark, 0, 1.25, -1.0);
    const wl = mk(g, new THREE.BoxGeometry(4.2, 0.32, 2.8), bodyMat, -2.6, 0, 0.6); wl.rotation.z = 0.14;
    const wr = mk(g, new THREE.BoxGeometry(4.2, 0.32, 2.8), bodyMat, 2.6, 0, 0.6);  wr.rotation.z = -0.14;
    mk(g, new THREE.BoxGeometry(0.85, 0.45, 1.4), MAT.dark, -4.6, 0.2, 1.0);
    mk(g, new THREE.BoxGeometry(0.85, 0.45, 1.4), MAT.dark, 4.6, 0.2, 1.0);
    mk(g, new THREE.SphereGeometry(0.12, 5, 5), MAT.redL, -4.7, 0.45, 1.0);
    mk(g, new THREE.SphereGeometry(0.12, 5, 5), MAT.greenL, 4.7, 0.45, 1.0);
    for (const wx of [-3.0, 3.0]) for (const wz of [0.2, 1.4]) {
      mk(g, new THREE.CylinderGeometry(0.16, 0.16, 2.8, 8), MAT.metal, wx, -0.45, wz, Math.PI / 2);
      mk(g, new THREE.ConeGeometry(0.16, 0.5, 8), MAT.dark, wx, -0.45, wz + 1.65, Math.PI / 2);
    }
    const tv = mk(g, new THREE.BoxGeometry(0.32, 2.6, 2), bodyMat, 0, 1.5, -4.5); tv.rotation.x = -0.25;
    mk(g, new THREE.BoxGeometry(3.8, 0.28, 1.3), bodyMat, 0, 0, -4.8);
    for (const ex of [-0.7, 0.7]) {
      mk(g, new THREE.CylinderGeometry(0.55, 0.55, 2, 12), MAT.dark, ex, -0.2, -5.5, Math.PI / 2);
      mk(g, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), MAT.black, ex, -0.2, -6.4, Math.PI / 2);
    }
    return g;
  }

  function buildHeli(color) {
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const bodyDk  = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.75) });
    const g = new THREE.Group();
    mk(g, new THREE.BoxGeometry(2.6, 2.1, 6), bodyMat, 0, 0, 0);
    mk(g, new THREE.ConeGeometry(1.3, 2.2, 12), bodyMat, 0, 0, 4, Math.PI / 2);
    mk(g, new THREE.BoxGeometry(2.0, 1.5, 1.7), MAT.glass, 0, 0.35, 1.8);
    mk(g, new THREE.BoxGeometry(2.05, 0.08, 1.75), bodyDk, 0, 1.1, 1.8);
    mk(g, new THREE.BoxGeometry(0.08, 1.5, 1.75), bodyDk, 0, 0.35, 1.8);
    mk(g, new THREE.BoxGeometry(2.05, 1.5, 0.08), bodyDk, 0, 0.35, 2.65);
    mk(g, new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat, 0, 0.3, -5.5);
    mk(g, new THREE.BoxGeometry(3.2, 0.16, 1.1), bodyMat, 0, 0.3, -7.2);
    const rT = new THREE.Group(); rT.position.set(0.5, 0.5, -8);
    mk(rT, new THREE.BoxGeometry(0.1, 2.4, 0.15), MAT.rotor, 0, 0, 0);
    mk(rT, new THREE.BoxGeometry(0.15, 0.1, 2.4), MAT.rotor, 0, 0, 0);
    g.add(rT);
    mk(g, new THREE.TorusGeometry(1.3, 0.08, 5, 12), MAT.metalD, 0.5, 0.5, -8, 0, Math.PI / 2);
    for (const sx of [-1.05, 1.05]) {
      mk(g, new THREE.BoxGeometry(0.16, 0.16, 4.5), MAT.metal, sx, -1.5, 0.5);
      mk(g, new THREE.BoxGeometry(0.16, 1.3, 0.16), MAT.metal, sx, -0.75, -1.4);
      mk(g, new THREE.BoxGeometry(0.16, 1.3, 0.16), MAT.metal, sx, -0.75, 2.2);
    }
    const rM = new THREE.Group(); rM.position.set(0, 1.5, 0);
    mk(rM, new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8), MAT.dark, 0, 0.45, 0);
    mk(rM, new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), MAT.metalD, 0, 0.05, 0);
    for (let i = 0; i < 4; i++) {
      const bg = new THREE.BoxGeometry(0.3, 0.06, 6.5); bg.translate(0, 0, 3.25);
      const bl = new THREE.Mesh(bg, MAT.rotor);
      bl.rotation.y = (i / 4) * Math.PI * 2; bl.position.y = 0.9; rM.add(bl);
    }
    g.add(rM);
    mk(g, new THREE.BoxGeometry(6, 0.22, 0.9), bodyMat, 0, -0.2, 0.6);
    for (const wx of [-2.4, -1.6, 1.6, 2.4]) {
      mk(g, new THREE.CylinderGeometry(0.32, 0.32, 1.7, 8), MAT.dark, wx, -0.65, 0.9, Math.PI / 2);
    }
    const turret = new THREE.Group();
    mk(turret, new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10), MAT.metalD, 0, 0, 0);
    mk(turret, new THREE.CylinderGeometry(0.1, 0.13, 1.4, 8), MAT.dark, 0, 0, 0.9, Math.PI / 2);
    turret.position.set(0, -1.0, 2.6); g.add(turret);
    for (const ex of [-0.8, 0.8]) {
      mk(g, new THREE.CylinderGeometry(0.42, 0.42, 1.2, 8), MAT.dark, ex, 0.7, -2.8, Math.PI / 2);
    }
    mk(g, new THREE.BoxGeometry(0.5, 0.5, 0.7), MAT.dark, 0, 1.0, 3.2);
    mk(g, new THREE.SphereGeometry(0.1, 5, 5), MAT.redL, -3.1, -0.2, 0.6);
    mk(g, new THREE.SphereGeometry(0.1, 5, 5), MAT.greenL, 3.1, -0.2, 0.6);
    return { group: g, rotorMain: rM, rotorTail: rT, turret };
  }

  function buildTank(color) {
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const bodyDk  = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) });
    const trackMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const g = new THREE.Group();
    mk(g, new THREE.BoxGeometry(4.8, 1.6, 7.5), bodyMat, 0, 1, 0);
    const glacis = mk(g, new THREE.BoxGeometry(4.8, 0.8, 2), bodyMat, 0, 1.4, 3.5); glacis.rotation.x = Math.PI / 6;
    mk(g, new THREE.BoxGeometry(0.2, 1.0, 7.0), bodyDk, -3.4, 0.9, 0);
    mk(g, new THREE.BoxGeometry(0.2, 1.0, 7.0), bodyDk, 3.4, 0.9, 0);
    for (const sx of [-2.8, 2.8]) {
      mk(g, new THREE.BoxGeometry(1.2, 1.4, 8), trackMat, sx, 0.7, 0);
      for (let i = 0; i < 5; i++)
        mk(g, new THREE.CylinderGeometry(0.35, 0.35, 1.3, 10), MAT.metalD, sx, 0.4, -3.2 + i * 1.6, 0, 0, Math.PI / 2);
      mk(g, new THREE.CylinderGeometry(0.4, 0.4, 1.3, 12), MAT.metal, sx, 0.7, 4.0, 0, 0, Math.PI / 2);
      mk(g, new THREE.CylinderGeometry(0.4, 0.4, 1.3, 12), MAT.metal, sx, 0.7, -4.0, 0, 0, Math.PI / 2);
    }
    const turret = new THREE.Group();
    turret.position.set(0, 2.1, 0.5);
    mk(turret, new THREE.CylinderGeometry(1.8, 2, 1, 6), bodyMat, 0, 0, 0);
    mk(turret, new THREE.CylinderGeometry(0.4, 0.45, 0.3, 8), MAT.metalD, -0.5, 0.6, -0.3);
    mk(turret, new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), MAT.dark, -0.5, 1.1, -0.1);
    mk(turret, new THREE.CylinderGeometry(0.25, 0.3, 6, 8), MAT.metalD, 0, 0, 3.5, Math.PI / 2);
    mk(turret, new THREE.CylinderGeometry(0.35, 0.35, 2.5, 8), bodyDk, 0, 0, 3.5, Math.PI / 2);
    mk(turret, new THREE.CylinderGeometry(0.35, 0.35, 0.6, 8), MAT.dark, 0, 0, 6.4, Math.PI / 2);
    mk(turret, new THREE.BoxGeometry(1.6, 0.6, 1.2), bodyDk, 0, -0.2, -1.6);
    g.add(turret);
    return { group: g, turret };
  }

  function buildAPC(color) {
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const bodyDk  = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) });
    const g = new THREE.Group();
    mk(g, new THREE.BoxGeometry(3.8, 2, 7.5), bodyMat, 0, 1.2, 0);
    const glacis = mk(g, new THREE.BoxGeometry(3.8, 1.0, 2), bodyMat, 0, 1.4, 4.2); glacis.rotation.x = Math.PI / 7;
    for (const sx of [-1.9, 1.9]) for (const wz of [-2.6, 0, 2.6]) {
      mk(g, new THREE.CylinderGeometry(0.8, 0.8, 0.6, 14), MAT.rubber, sx, 0.8, wz, 0, 0, Math.PI / 2);
      mk(g, new THREE.CylinderGeometry(0.4, 0.4, 0.62, 10), MAT.rim, sx, 0.8, wz, 0, 0, Math.PI / 2);
      mk(g, new THREE.CylinderGeometry(0.15, 0.15, 0.65, 6), MAT.metalD, sx, 0.8, wz, 0, 0, Math.PI / 2);
    }
    const turret = new THREE.Group();
    turret.position.set(0, 2.4, 0);
    mk(turret, new THREE.BoxGeometry(1.8, 0.8, 2), bodyMat, 0, 0, 0);
    mk(turret, new THREE.CylinderGeometry(0.15, 0.15, 3.5, 8), MAT.metalD, 0, 0, 1.8, Math.PI / 2);
    g.add(turret);
    return { group: g, turret };
  }

  // VFX: CRASH
  const crashFX = {
    smoke: [], fire: [], wreck: [], smokePlumes: [],
    update(dt) {
      for (let i = this.smoke.length - 1; i >= 0; i--) {
        const s = this.smoke[i]; s.t += dt;
        s.mesh.position.addScaledVector(s.vel, dt); s.vel.y += 1.5 * dt;
        s.mesh.scale.multiplyScalar(1 + dt * 1.2);
        s.mesh.material.opacity = 0.75 * Math.max(0, 1 - s.t / s.life);
        if (s.t >= s.life) { API.scene.remove(s.mesh); this.smoke.splice(i, 1); }
      }
      for (let i = this.fire.length - 1; i >= 0; i--) {
        const f = this.fire[i]; f.t += dt;
        f.mesh.position.addScaledVector(f.vel, dt); f.vel.y -= 2 * dt;
        f.mesh.scale.multiplyScalar(Math.max(0.1, 1 - dt * 1.5));
        f.mesh.material.opacity = Math.max(0, 1 - f.t / f.life);
        if (f.t >= f.life) { API.scene.remove(f.mesh); this.fire.splice(i, 1); }
      }
      for (let i = this.wreck.length - 1; i >= 0; i--) {
        const w = this.wreck[i]; w.t += dt;
        w.vel.y -= 20 * dt;
        w.mesh.position.addScaledVector(w.vel, dt);
        w.mesh.rotation.x += w.ang.x * dt; w.mesh.rotation.y += w.ang.y * dt; w.mesh.rotation.z += w.ang.z * dt;
        if (w.mesh.position.y < 0.15) { w.mesh.position.y = 0.15; w.vel.y *= -0.3; w.vel.x *= 0.6; w.vel.z *= 0.6; }
        if (w.t >= w.life) { API.scene.remove(w.mesh); this.wreck.splice(i, 1); }
      }
      for (let i = this.smokePlumes.length - 1; i >= 0; i--) {
        const sp = this.smokePlumes[i]; sp.t += dt;
        sp.mesh.position.y = sp.baseY + (sp.t % 4) * 2.5;
        sp.mesh.scale.setScalar(1 + (sp.t % 4) * 0.4);
        sp.mesh.material.opacity = 0.7 * (1 - (sp.t % 4) / 4);
        if (sp.t % 4 > 3.9) sp.t = 0;
        if (sp.t >= sp.life) { API.scene.remove(sp.mesh); this.smokePlumes.splice(i, 1); }
      }
    }
  };
  function spawnCrashSmoke(pos, big) {
    const size = big ? rnd(1.2, 2.2) : rnd(0.5, 1.0);
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5), new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.copy(pos); m.position.x += rnd(-0.5, 0.5); m.position.z += rnd(-0.5, 0.5);
    API.scene.add(m);
    crashFX.smoke.push({ mesh: m, vel: V(rnd(-0.5, 0.5), rnd(0.5, 1.5), rnd(-0.5, 0.5)), life: rnd(1.5, 2.5), t: 0 });
  }
  function spawnCrashFire(pos) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.6, 1.2), 6, 5), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xff6600 : 0xffcc00, transparent: true, opacity: 0.95 }));
    m.position.copy(pos); m.position.x += rnd(-0.6, 0.6); m.position.z += rnd(-0.6, 0.6);
    API.scene.add(m);
    crashFX.fire.push({ mesh: m, vel: V(rnd(-2, 2), rnd(-1, 1), rnd(-2, 2)), life: rnd(0.5, 1.0), t: 0 });
  }
  function spawnWreckage(pos, count) {
    const matBody = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x333333 });
    for (let i = 0; i < count; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.4, 1.4), rnd(0.2, 0.6), rnd(0.4, 1.4)), Math.random() < 0.5 ? matBody : matMetal);
      g.position.copy(pos); g.position.x += rnd(-1, 1); g.position.y += rnd(0.3, 1.5); g.position.z += rnd(-1, 1);
      g.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
      g.castShadow = true;
      API.scene.add(g);
      crashFX.wreck.push({ mesh: g, vel: V(rnd(-6, 6), rnd(3, 8), rnd(-6, 6)), ang: V(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)), life: 8, t: 0 });
    }
  }
  function spawnCrashPlume(pos) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(1.5, 2.5), 6, 5), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.copy(pos); m.position.y = 1.5;
    API.scene.add(m);
    crashFX.smokePlumes.push({ mesh: m, baseY: 1.5, t: Math.random() * 6, life: 15 });
  }
  function spawnImpactExplosion(pos) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 1 }));
    flash.position.copy(pos); API.scene.add(flash);
    let t = 0;
    const expand = setInterval(() => {
      t += 0.05; flash.scale.setScalar(1 + t * 2); flash.material.opacity = Math.max(0, 1 - t * 2);
      if (t > 0.6) { API.scene.remove(flash); clearInterval(expand); }
    }, 30);
    API.playSound('explosion');
    spawnCrashSmoke(pos, true); spawnCrashSmoke(pos, true);
    spawnCrashFire(pos); spawnCrashFire(pos);
    spawnWreckage(pos, 12);
    spawnCrashPlume(pos);
  }

  function computeBanking(curYaw, curRoll, targetYaw, dt, opts) {
    opts = opts || {};
    const maxBank = opts.maxBank || 1.1;
    const turnRate = opts.turnRate || 2.5;
    const rollSpeed = opts.rollSpeed || 4;
    let diff = targetYaw - curYaw;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const yawDelta = diff * Math.min(1, dt * turnRate);
    const newYaw = curYaw + yawDelta;
    const yawRatePerSec = yawDelta / Math.max(dt, 0.001);
    const targetRoll = -Math.max(-maxBank, Math.min(maxBank, yawRatePerSec * 0.35));
    const newRoll = curRoll + (targetRoll - curRoll) * Math.min(1, dt * rollSpeed);
    return { yaw: newYaw, roll: newRoll, yawDelta };
  }

  const crashing = [];
  function startCrash(entity, kind) {
    if (entity.crashing) return;
    entity.crashing = true;
    entity.crashSpin = rnd(-3, 3);
    entity.crashDir = V(rnd(-1, 1), 0, rnd(-1, 1)).normalize();
    entity.cooldown = 9999; entity.missileCooldown = 9999;
    if (entity.flames) for (const f of entity.flames) f.visible = false;
    crashing.push({ entity, kind, t: 0 });
    API.playSound('explosion');
    console.log(`💥 ${kind} en picada`);
  }
  function updateCrashing(entry, dt) {
    const e = entry.entity, mesh = e.mesh;
    entry.t += dt;
    const t = entry.t;
    const P1 = 0.6, P2 = 3.0;
    if (t < P1) {
      mesh.rotation.x += dt * 0.5;
      mesh.rotation.z += Math.sin(t * 10) * dt * 0.6;
      mesh.position.y -= dt * 2;
      if (Math.random() < 0.5) spawnCrashSmoke(mesh.position);
    } else if (t < P2) {
      mesh.rotation.y += e.crashSpin * dt;
      mesh.rotation.z = Math.sin(t * 4) * 0.5;
      mesh.rotation.x = Math.min(1.4, 0.3 + (t - P1) * 0.4);
      mesh.position.x += e.crashDir.x * dt * 4;
      mesh.position.z += e.crashDir.z * dt * 4;
      mesh.position.y -= (6 + (t - P1) * 3) * dt;
      spawnCrashSmoke(mesh.position);
      if (Math.random() < 0.7) spawnCrashFire(mesh.position);
    } else {
      mesh.rotation.y += e.crashSpin * 2 * dt;
      mesh.rotation.x = 1.4; mesh.rotation.z = 0.2;
      mesh.position.y -= (20 + (t - P2) * 15) * dt;
      spawnCrashSmoke(mesh.position); spawnCrashSmoke(mesh.position, true);
      spawnCrashFire(mesh.position);
    }
    if (mesh.position.y <= 1.2 || t > 7) {
      const pos = V(mesh.position.x, 1.2, mesh.position.z);
      spawnImpactExplosion(pos);
      mesh.visible = false;
      entry.done = true;
      setTimeout(() => { e.crashing = false; e.isDead = true; e.respawnTimer = 0; }, 100);
    }
  }

  // API PÚBLICA
  window.ModelosHD = {
    version: '3.1',
    plane: (c) => buildPlane(c),
    heli: (c) => buildHeli(c),
    tank: (c) => buildTank(c),
    apc: (c) => buildAPC(c),
    buildPlane, buildHeli, buildTank, buildAPC,
    computeBanking, startCrash,
    isCrashing: (e) => !!e.crashing,
    crashFX,
  };

  // ⚠️ FIX CRÍTICO: preservar userData en TODOS los submeshes
  function tagUserData(group, unit) {
    group.traverse(c => { if (c.isMesh) c.userData = unit; });
  }

  function upgradeBaseHelis() {
    if (!API.aiHelis || !API.aiHelis.length) return;
    let count = 0;
    for (const h of API.aiHelis) {
      try {
        const oldMesh = h.mesh; if (!oldMesh) continue;
        const oldPos = oldMesh.position.clone();
        const oldRotY = oldMesh.rotation.y;
        let color = 0x0055ff;
        oldMesh.traverse(c => {
          if (c.isMesh && c.material && c.material.color) {
            const hex = c.material.color.getHex();
            if (hex !== 0x000000 && hex !== 0x111111 && hex !== 0x222222) color = hex;
          }
        });
        const result = buildHeli(color);
        result.group.position.copy(oldPos);
        result.group.rotation.y = oldRotY;
        API.scene.remove(oldMesh);
        API.scene.add(result.group);
        h.mesh = result.group;
        h.rotor = result.rotorMain;
        h.yaw = oldRotY; h.roll = 0; h.pitch = 0;
        tagUserData(result.group, h); // ← FIX
        count++;
      } catch (e) { console.error('Error upgrading heli:', e); }
    }
    if (count) console.log(`🎨 ${count} helicópteros base actualizados a HD`);
  }

  function upgradeBaseTanks() {
    if (!API.tanks || !API.tanks.length) return;
    let count = 0;
    for (const t of API.tanks) {
      try {
        const oldMesh = t.mesh; if (!oldMesh) continue;
        const oldPos = oldMesh.position.clone();
        const oldRotY = oldMesh.rotation.y;
        let color = 0x0055ff;
        oldMesh.traverse(c => {
          if (c.isMesh && c.material && c.material.color) {
            const hex = c.material.color.getHex();
            if (hex !== 0x000000 && hex !== 0x222222) color = hex;
          }
        });
        const result = buildTank(color);
        result.group.position.copy(oldPos);
        result.group.rotation.y = oldRotY;
        API.scene.remove(oldMesh);
        API.scene.add(result.group);
        t.mesh = result.group;
        t.turret = result.turret;
        tagUserData(result.group, t); // ← FIX
        count++;
      } catch (e) { console.error('Error upgrading tank:', e); }
    }
    if (count) console.log(`🎨 ${count} tanques base actualizados a HD`);
  }

  function upgradeBaseAPCs() {
    if (!API.vehicles || !API.vehicles.length) return;
    let count = 0;
    for (const v of API.vehicles) {
      try {
        if (v.type !== 'apc') continue;
        const oldMesh = v.mesh; if (!oldMesh) continue;
        const oldPos = oldMesh.position.clone();
        const oldRotY = oldMesh.rotation.y;
        let color = 0x0055ff;
        oldMesh.traverse(c => {
          if (c.isMesh && c.material && c.material.color) {
            const hex = c.material.color.getHex();
            if (hex !== 0x000000 && hex !== 0x111111 && hex !== 0x222222) color = hex;
          }
        });
        const result = buildAPC(color);
        result.group.position.copy(oldPos);
        result.group.rotation.y = oldRotY;
        API.scene.remove(oldMesh);
        API.scene.add(result.group);
        v.mesh = result.group;
        v.turret = result.turret;
        tagUserData(result.group, v); // ← FIX
        count++;
      } catch (e) { console.error('Error upgrading APC:', e); }
    }
    if (count) console.log(`🎨 ${count} APCs base actualizados a HD`);
  }

  setTimeout(() => {
    upgradeBaseHelis();
    upgradeBaseTanks();
    upgradeBaseAPCs();
  }, 80);

  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    crashFX.update(dt);
    for (let i = crashing.length - 1; i >= 0; i--) {
      const entry = crashing[i];
      try { updateCrashing(entry, dt); } catch (e) { console.error('crash err', e); }
      if (entry.done) crashing.splice(i, 1);
    }
    if (API.aiHelis) {
      for (const h of API.aiHelis) {
        if (!h.mesh || h.isDead || h.crashing) continue;
        const curYaw = h.mesh.rotation.y;
        if (h.prevYaw === undefined) h.prevYaw = curYaw;
        let yawDelta = curYaw - h.prevYaw;
        while (yawDelta >  Math.PI) yawDelta -= 2 * Math.PI;
        while (yawDelta < -Math.PI) yawDelta += 2 * Math.PI;
        h.prevYaw = curYaw;
        const targetRoll = -Math.max(-1.4, Math.min(1.4, yawDelta / Math.max(dt, 0.001) * 0.5));
        h.roll = (h.roll || 0) + (targetRoll - (h.roll || 0)) * Math.min(1, dt * 5);
        h.mesh.rotation.z = h.roll;
      }
    }
  };

  console.log('🎨 Mod Modelos HD v3.1 listo (userData preservado)');
})();