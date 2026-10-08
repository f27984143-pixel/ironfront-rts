/* ============================================================
   MOD: IA Mejorada v1.1
   Cambios vs v1.0:
     ✓ Artillería con turret real (ya no crashea la IA base)
     ✓ Se puede disparar en Control Directo (260 dmg, no 50)
     ✓ Cámara 1ª persona retrocedida para no meterse en el modelo
     ✓ Predicción de movimiento del blanco (lead)
     ✓ Indicador visual de impacto en el suelo
     ✓ La IA base ya no dispara artillería en corto alcance
     ✓ HUD reubicado para no tapar la unidad
   ============================================================ */
(function () {
  if (window.__SMART_AI_LOADED) { console.warn('⚠️ IA Mejorada ya cargada'); return; }
  window.__SMART_AI_LOADED = true;

  const API = window.IronfrontAPI;
  const THREE = window.THREE;
  if (!API || !THREE) { console.error('❌ IronfrontAPI no disponible'); return; }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  console.log('🧠 Mod IA Mejorada v1.1: iniciando...');
  API.say('🧠 IA Mejorada v1.1 activa');

  // ======================== CONFIG ========================
  const CFG = {
    squadSize: 5,
    reevalEvery: 0.6,
    soloDist: 22,
    huidaHP: 0.35,
    // Artillería
    artySpeed: 3,
    artyRange: 150,
    artyMinRange: 45,
    artyCooldown: 6.0,
    artyDamage: 260,
    artySplashRadius: 9,
    artyShellSpeed: 55,
  };

  // ======================== HUD ========================
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:150px;right:6px;z-index:26;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 9px;font:11px sans-serif;color:#fff;min-width:170px;backdrop-filter:blur(4px);opacity:.95';
  hud.innerHTML = `
    <div style="font-weight:700;color:#c8a0ff;margin-bottom:4px;font-size:10px;letter-spacing:1px">🧠 IA TÁCTICA</div>
    <div style="display:flex;justify-content:space-between"><span>Escuadrones aliados:</span><b id="ai-sq-ally">0</b></div>
    <div style="display:flex;justify-content:space-between"><span>Escuadrones enemigos:</span><b id="ai-sq-enemy">0</b></div>
    <div style="display:flex;justify-content:space-between;margin-top:3px;padding-top:3px;border-top:1px solid rgba(255,255,255,.12)">
      <span>Huyendo:</span><b id="ai-fleeing" style="color:#ffb060">0</b>
    </div>
    <div style="display:flex;justify-content:space-between"><span>Flanqueando:</span><b id="ai-flank" style="color:#60d0ff">0</b></div>
    <div style="display:flex;justify-content:space-between"><span>Artillería viva:</span><b id="ai-arty" style="color:#ff6b6b">0</b></div>
  `;
  document.body.appendChild(hud);
  const $ = id => document.getElementById(id);

  // ======================== ARTILLERÍA ========================
  const artillerias = [];

  function crearArtilleria(color, team, x, z) {
    const g = new THREE.Group();
    const matBody = new THREE.MeshLambertMaterial({ color });
    const matDark = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matMetal = new THREE.MeshLambertMaterial({ color: 0x555555 });

    const add = (geo, m, xx, yy, zz, rx, ry, rz) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(xx, yy, zz);
      if (rx) o.rotation.x = rx;
      if (ry) o.rotation.y = ry;
      if (rz) o.rotation.z = rz;
      o.castShadow = true;
      g.add(o);
      return o;
    };

    // Chasis
    add(new THREE.BoxGeometry(3.2, 1.4, 7), matBody, 0, 1.1, 0);
    add(new THREE.BoxGeometry(2.6, 1.8, 2.6), matBody, 0, 1.5, 3.6);
    add(new THREE.BoxGeometry(2.2, 1.4, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x1a2a3a }), 0, 1.7, 4.9);

    // Orugas
    for (const sx of [-1.6, 1.6]) {
      add(new THREE.BoxGeometry(0.9, 0.9, 7.4), matDark, sx, 0.55, 0);
      for (let i = 0; i < 6; i++) {
        add(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 8), matMetal,
            sx, 0.55, -3 + i * 1.2, 0, 0, Math.PI / 2);
      }
    }

    // ------- TURRET (grupo que el juego base rota con lookAt) -------
    const turret = new THREE.Group();
    turret.position.set(0, 2.4, -1.5);   // pivote del mortero
    g.add(turret);

    // Base rotatoria del mortero
    const baseMortero = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.9, 0.7, 14), matDark);
    baseMortero.position.y = 0;
    baseMortero.castShadow = true;
    turret.add(baseMortero);

    // Tubo del mortero (apuntando hacia +Z, inclinado hacia arriba)
    // Lo inclinamos -60° para que la bala salga por arriba
    const tubo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.48, 6.0, 14), matDark);
    tubo.rotation.x = Math.PI / 2;         // eje del cilindro va a +Z
    tubo.position.set(0, 0.4, 2.0);
    tubo.castShadow = true;
    turret.add(tubo);

    // Ángulo del tubo hacia arriba (dentro del turret)
    const tuboWrap = new THREE.Group();
    tuboWrap.position.set(0, 0, 0);
    // Movemos el tubo al wrap para poder inclinarlo sin perder el pivote
    turret.remove(tubo);
    tubo.position.set(0, 0, 3.0);
    tuboWrap.add(tubo);
    tuboWrap.rotation.x = -Math.PI / 3.2;   // elevar el cañón
    turret.add(tuboWrap);

    // Boca
    const boca = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14), matMetal);
    boca.rotation.x = Math.PI / 2;
    boca.position.set(0, 0, 5.8);
    tuboWrap.add(boca);

    // Patas de anclaje
    for (const sx of [-1.4, 1.4]) {
      add(new THREE.BoxGeometry(0.25, 0.25, 2), matMetal, sx, 0.4, -3.2);
    }

    g.position.set(x, 0, z);
    API.scene.add(g);

    // Barra de HP
    const hp = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false }));
    fg.position.z = 0.01;
    hp.add(bg); hp.add(fg); hp.renderOrder = 999;
    API.scene.add(hp);

    // Anillo de selección
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.2, 26),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, transparent: true }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    ring.visible = false;
    g.add(ring);

    const unit = {
      type: 'apc',                 // tratado como APC base (range 70) — override por mod
      isArtilleria: true,
      mesh: g,
      turret: turret,              // ← CLAVE: ahora sí existe
      turretWrap: tuboWrap,
      team,
      hp: 240, maxHp: 240, radius: 2.6,
      speed: CFG.artySpeed,
      cooldown: Infinity,          // base nunca dispara
      artyCooldown: 2.5,           // cooldown propio del mod
      target: V(x, 0, z),
      manualTarget: false,
      isDead: false, respawnTimer: 0,
      basePos: V(x, 0, z),
      hpGroup: hp, hpBar: fg, hpYOffset: 4.2, hpWidth: 3,
      selectionRing: ring,
      targetEnemy: null,
      scanT: 0,
      lastVel: V(0, 0, 0),
      lastPos: V(x, 0, z),
    };
    g.userData = unit;
    API.vehicles.push(unit);
    artillerias.push(unit);
    return unit;
  }

  // Spawn: 2 por bando
  crearArtilleria(0x0055ff, 'ally', -30, -110);
  crearArtilleria(0x0055ff, 'ally',  30, -110);
  crearArtilleria(0xff2222, 'enemy', -30,  110);
  crearArtilleria(0xff2222, 'enemy',  30,  110);
  console.log('🚀 Artillería: 4 unidades creadas');

  // ======================== ESTADO ========================
  const escuadrones = [];
  let nextSquadId = 1;
  const state = new WeakMap();

  function getState(u) {
    if (!state.has(u)) state.set(u, {
      fleeUntil: 0,
      flankOffset: (Math.random() < 0.5 ? 1 : -1) * (4 + Math.random() * 5),
      lastTarget: null, role: null, squadId: 0,
    });
    return state.get(u);
  }

  const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const unidadEnemigaViva = u => u && u.hp > 0 && !u.isDead && !u.inHeli;

  function listaCombatientes() {
    const out = [];
    for (const s of API.soldiers) if (unidadEnemigaViva(s)) out.push(s);
    for (const v of API.vehicles) if (unidadEnemigaViva(v)) out.push(v);
    for (const t of API.tanks)    if (unidadEnemigaViva(t)) out.push(t);
    return out;
  }

  // ======================== ESCUADRONES ========================
  function reconstruirEscuadrones() {
    escuadrones.length = 0;
    nextSquadId = 1;
    const libres = [];
    for (const s of API.soldiers) {
      if (!unidadEnemigaViva(s)) continue;
      if (s.inHeli || s.marine) continue;
      libres.push(s);
      getState(s).squadId = 0;
    }
    for (const s of libres) {
      if (getState(s).squadId) continue;
      const grupo = [s];
      const candidatos = libres
        .filter(o => o !== s && o.team === s.team && !getState(o).squadId)
        .map(o => ({ o, d: dist2D(s.mesh.position, o.mesh.position) }))
        .sort((a, b) => a.d - b.d);
      for (const c of candidatos) {
        if (grupo.length >= CFG.squadSize) break;
        if (c.d > 40) break;
        grupo.push(c.o);
      }
      const id = nextSquadId++;
      for (const u of grupo) getState(u).squadId = id;
      grupo.forEach((u, i) => {
        const st = getState(u);
        if (i % 3 === 0) st.role = 'flank';
        else if (u.role === 'rocket') st.role = 'support';
        else st.role = 'assault';
      });
      escuadrones.push({ id, team: s.team, units: grupo });
    }
  }

  // Unidades que controla el jugador: la IA no les da órdenes
  function esJugador(u) {
    if (!u) return false;
    if (u.playerOrder) return true;
    if (typeof selectedUnits !== 'undefined' && selectedUnits.includes(u)) return true;
    if (API.directControlActive && API.directControlActive() && API.directControlUnit && API.directControlUnit() === u) return true;
    return false;
  }
  function asignarObjetivosEscuadron(sq, enemigos) {
    if (!enemigos.length) return;
    // Centroide
    const c = V(0, 0, 0);
    let n = 0;
    for (const u of sq.units) if (unidadEnemigaViva(u)) { c.add(u.mesh.position); n++; }
    if (!n) return;
    c.divideScalar(n);

    let best = null, bestD = 1e9;
    for (const e of enemigos) {
      if (e.team === sq.team) continue;
      const d = dist2D(c, e.mesh.position);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;

    sq.units.forEach(u => {
      if (!unidadEnemigaViva(u) || esJugador(u)) return;
      const st = getState(u);
      const mp = u.mesh.position;
      const ep = best.mesh.position;
      u.enemy = best;

      if (st.role === 'flank') {
        const dx = ep.x - mp.x, dz = ep.z - mp.z;
        const L = Math.hypot(dx, dz) || 1;
        const px = -dz / L, pz = dx / L;
        u.target.set(ep.x + px * st.flankOffset * 1.2, 1, ep.z + pz * st.flankOffset * 1.2);
        u.manualTarget = true;
      } else if (st.role === 'support') {
        const dx = mp.x - ep.x, dz = mp.z - ep.z;
        const L = Math.hypot(dx, dz) || 1;
        const want = 32;
        u.target.set(ep.x + (dx / L) * want, 1, ep.z + (dz / L) * want);
        u.manualTarget = true;
      } else {
        u.target.set(ep.x, 1, ep.z);
        u.manualTarget = true;
      }
    });
  }

  // ======================== HUIDA / REAGRUPAR ========================
  function intentarHuida(u, now) {
    if (u.hp <= 0 || u.isDead || esJugador(u)) return false;
    const st = getState(u);
    if (st.fleeUntil > now) {
      const aliados = API.soldiers.filter(a => a !== u && a.team === u.team && unidadEnemigaViva(a));
      let mejor = null, bestD = 1e9;
      for (const a of aliados) {
        const d = dist2D(a.mesh.position, u.mesh.position);
        if (d < bestD) { bestD = d; mejor = a; }
      }
      const dest = mejor ? mejor.mesh.position : u.basePos;
      u.target.set(dest.x, 1, dest.z);
      u.manualTarget = true;
      u.enemy = null;
      return true;
    }
    const ratio = u.hp / u.maxHp;
    if (ratio < CFG.huidaHP) {
      const cerca = listaCombatientes().some(e => e.team !== u.team && dist2D(e.mesh.position, u.mesh.position) < 25);
      if (cerca) { st.fleeUntil = now + 3500; return true; }
    }
    return false;
  }

  function reagrupar(u, now) {
    if (u.manualTarget || esJugador(u)) return;
    const st = getState(u);
    if (st.fleeUntil > now) return;
    let minD = 1e9, amigo = null;
    for (const a of API.soldiers) {
      if (a === u || a.team !== u.team || !unidadEnemigaViva(a)) continue;
      const d = dist2D(a.mesh.position, u.mesh.position);
      if (d < minD) { minD = d; amigo = a; }
    }
    if (amigo && minD > CFG.soloDist) {
      u.target.set(amigo.mesh.position.x, 1, amigo.mesh.position.z);
      u.manualTarget = true;
    }
  }

  // ======================== INDICADOR DE IMPACTO ========================
  const impactMarkers = [];
  function marcarImpacto(pos) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 1.0, 20),
      new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.25, pos.z);
    API.scene.add(ring);
    impactMarkers.push({ mesh: ring, t: 0, life: 0.6 });
  }

  function updateMarkers(dt) {
    for (let i = impactMarkers.length - 1; i >= 0; i--) {
      const m = impactMarkers[i];
      m.t += dt;
      const k = m.t / m.life;
      m.mesh.scale.setScalar(1 + k * 3);
      m.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        API.scene.remove(m.mesh);
        impactMarkers.splice(i, 1);
      }
    }
  }

  // ======================== ARTILLERÍA IA ========================
  function updateArtilleria(u, dt) {
    if (u.isDead || u.hp <= 0) {
      u.respawnTimer += dt;
      u.mesh.visible = false;
      u.hpGroup.visible = false;
      if (u.respawnTimer > 18) {
        u.hp = u.maxHp; u.isDead = false;
        u.mesh.visible = true;
        u.mesh.position.copy(u.basePos);
        u.respawnTimer = 0;
      }
      return;
    }

    // Cooldown propio
    u.artyCooldown -= dt;
    u.scanT -= dt;

    // Estimar velocidad del último blanco (para predicción)
    if (u.targetEnemy && unidadEnemigaViva(u.targetEnemy)) {
      const p = u.targetEnemy.mesh.position;
      const dx = p.x - u.lastPos.x, dz = p.z - u.lastPos.z;
      // Suavizado
      u.lastVel.x = u.lastVel.x * 0.7 + (dx / Math.max(dt, 0.001)) * 0.3;
      u.lastVel.z = u.lastVel.z * 0.7 + (dz / Math.max(dt, 0.001)) * 0.3;
      u.lastPos.copy(p);
    }

    // Reelegir blanco cada 1.2 s
    if (u.scanT <= 0) {
      u.scanT = 1.2;
      let best = null, bestScore = -1e9;
      const enemigos = listaCombatientes().filter(e => e.team !== u.team);
      for (const e of enemigos) {
        const d = dist2D(u.mesh.position, e.mesh.position);
        if (d > CFG.artyRange || d < CFG.artyMinRange * 0.6) continue;
        let cluster = 0;
        for (const o of enemigos) {
          if (o === e) continue;
          if (dist2D(o.mesh.position, e.mesh.position) < 12) cluster++;
        }
        const baseScore = (e.type === 'soldier' ? 1 : 2) * (10 + cluster * 8);
        const score = baseScore - d * 0.2;
        if (score > bestScore) { bestScore = score; best = e; }
      }
      u.targetEnemy = best;
    }

    const enRango = u.targetEnemy && unidadEnemigaViva(u.targetEnemy) &&
                    dist2D(u.mesh.position, u.targetEnemy.mesh.position) <= CFG.artyRange;

    // Movimiento: se aleja si está muy cerca, se acerca si muy lejos
    if (u.targetEnemy && unidadEnemigaViva(u.targetEnemy)) {
      const tp = u.targetEnemy.mesh.position;
      const d = dist2D(u.mesh.position, tp);
      if (d < CFG.artyMinRange) {
        const dx = u.mesh.position.x - tp.x, dz = u.mesh.position.z - tp.z;
        const L = Math.hypot(dx, dz) || 1;
        u.target.set(u.mesh.position.x + (dx / L) * 10, 1, u.mesh.position.z + (dz / L) * 10);
        u.manualTarget = true;
      } else if (d > CFG.artyRange * 0.9) {
        u.target.set(tp.x, 1, tp.z);
        u.manualTarget = true;
      } else {
        u.target.copy(u.mesh.position);
        u.manualTarget = false;
      }

      // Apuntar turret hacia el blanco (usa el lookAt real)
      if (enRango) {
        u.turret.lookAt(tp.x, u.turret.position.y + u.mesh.position.y, tp.z);
      }

      // Disparar
      if (u.artyCooldown <= 0 && enRango) {
        // Predicción con lead
        const d = dist2D(u.mesh.position, tp);
        const flightTime = d / CFG.artyShellSpeed;
        const predX = tp.x + u.lastVel.x * flightTime * 0.9;
        const predZ = tp.z + u.lastVel.z * flightTime * 0.9;

        const muzzle = V(u.mesh.position.x, u.mesh.position.y + 5.5, u.mesh.position.z);
        const objetivo = V(predX, 1, predZ);

        API.fireProjectile(muzzle, objetivo, 0xff5522, CFG.artyDamage, u.team);
        API.playSound('explosion');

        // Marca visual en el punto de impacto
        setTimeout(() => {
          marcarImpacto(V(predX, 0, predZ));
          // Splash de área hecho a mano
          for (const e of listaCombatientes()) {
            if (e.team === u.team) continue;
            if (dist2D(e.mesh.position, V(predX, 0, predZ)) < CFG.artySplashRadius) {
              e.hp -= 60;
              if (e.hp <= 0) {
                e.isDead = true;
                if (e.mesh && e.type === 'soldier') e.mesh.position.y = -0.5;
                if (e.bodyMat) e.bodyMat.color.setHex(0x1a1a1a);
              }
            }
          }
        }, flightTime * 1000);

        u.artyCooldown = CFG.artyCooldown;
      }
    } else {
      // Sin blanco: patrulla suave alrededor de basePos
      const orbit = performance.now() * 0.0003;
      u.target.set(u.basePos.x + Math.cos(orbit) * 8, 1, u.basePos.z + Math.sin(orbit) * 8);
      u.manualTarget = true;
    }
  }

  // ======================== CONTROL DIRECTO (arreglo) ========================
  // Cuando el jugador controla una artillería y mantiene FUEGO, disparamos
  // nosotros mismos. También movemos la cámara más atrás para no ver el modelo.
  function handleDirectControlArtillery(dt) {
    if (!API.directControlActive || !API.directControlUnit) return;
    const u = API.directControlUnit;
    if (!u.isArtilleria) return;

    // --- Cámara: alejar del modelo ---
    const cam = API.camera;
    // Reconstruimos el forward de la cámara actual (ya la puso fpCamera)
    const q = cam.quaternion;
    const fwd = V(0, 0, -1).applyQuaternion(q);
    const p = u.mesh.position;
    const dist = 18;   // ← antes era 9 en el juego base
    cam.position.set(
      p.x - fwd.x * dist,
      p.y + 9,
      p.z - fwd.z * dist
    );
    cam.lookAt(
      cam.position.x + fwd.x,
      cam.position.y + fwd.y,
      cam.position.z + fwd.z
    );

    // --- Disparo con FUEGO ---
    if (!window.__firing) return;
    u.artyCooldown -= 0;   // no afecta; usamos otro
    if (!u._playerCd || u._playerCd <= 0) {
      // Dirección desde el tubo hacia el frente de la cámara
      const muzzle = V(p.x, p.y + 5.5, p.z);
      const target = V(
        cam.position.x + fwd.x * 200,
        1,
        cam.position.z + fwd.z * 200
      );
      API.fireProjectile(muzzle, target, 0xff5522, CFG.artyDamage, 'ally');
      API.playSound('explosion');
      marcarImpacto(V(target.x, 0, target.z));
      u._playerCd = 1.5;  // 1.5 s entre disparos manuales
    }
  }

  // ======================== TICK ========================
  let acc = 0;

  function tick(dt) {
    const now = performance.now();
    acc += dt;

    if (acc >= CFG.reevalEvery) {
      acc = 0;
      reconstruirEscuadrones();
      const enemigos = listaCombatientes();
      for (const sq of escuadrones) asignarObjetivosEscuadron(sq, enemigos);
    }

    let huyendo = 0, flanqueando = 0;
    for (const s of API.soldiers) {
      if (!unidadEnemigaViva(s)) continue;
      if (intentarHuida(s, now)) { huyendo++; continue; }
      reagrupar(s, now);
      if (getState(s).role === 'flank') flanqueando++;
    }

    // Cooldown del disparo manual
    for (const a of artillerias) {
      if (a._playerCd > 0) a._playerCd -= dt;
    }

    let artyVivos = 0;
    for (const a of artillerias) {
      updateArtilleria(a, dt);
      if (unidadEnemigaViva(a)) artyVivos++;
    }

    // HP bars de artillería
    for (const a of artillerias) {
      if (!unidadEnemigaViva(a)) continue;
      a.hpGroup.visible = (a.hp < a.maxHp) ||
        (API.selectedUnits && API.selectedUnits.includes && API.selectedUnits.includes(a));
      a.hpGroup.position.copy(a.mesh.position);
      a.hpGroup.position.y += a.hpYOffset;
      a.hpGroup.quaternion.copy(API.camera.quaternion);
      a.hpBar.scale.x = Math.max(0, a.hp / a.maxHp);
      a.hpBar.position.x = -(a.hpWidth - a.hpWidth * a.hpBar.scale.x) / 2;
    }

    // Marcadores de impacto
    updateMarkers(dt);

    // Control directo especial
    handleDirectControlArtillery(dt);

    // HUD
    $('ai-sq-ally').textContent  = escuadrones.filter(s => s.team === 'ally').length;
    $('ai-sq-enemy').textContent = escuadrones.filter(s => s.team === 'enemy').length;
    $('ai-fleeing').textContent  = huyendo;
    $('ai-flank').textContent    = flanqueando;
    $('ai-arty').textContent     = artyVivos;
  }

  // ======================== HOOK ========================
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }

    // Bloquea que la IA base dispare artillería (evita el crash)
    for (const u of artillerias) u.cooldown = Infinity;

    try { tick(dt); } catch (e) { console.error('IA Mejorada error:', e); }
  };

  window.IAMejorada = { version: '1.1', escuadrones, artillerias, config: CFG };
  console.log('🧠 Mod IA Mejorada v1.1 listo.');
})();