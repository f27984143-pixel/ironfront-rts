/* ============================================================
   MOD: IA Mejorada v1.0
   Añade:
     - Escuadrones tácticos automáticos (asignación de roles)
     - Priorización inteligente de blancos (cohetes vs. tanques, etc.)
     - Huida táctica cuando HP < 35%
     - Reagrupamiento de unidades solas
     - Flanqueo coordinado
     - Nueva unidad: Artillería (mortero de largo alcance con IA)
     - HUD de IA en vivo
   Uso: colócalo como modificaciones/ia_mejorada.js
   ============================================================ */
(function () {
  if (window.__SMART_AI_LOADED) { console.warn('⚠️ IA Mejorada ya cargada'); return; }
  window.__SMART_AI_LOADED = true;

  const API = window.IronfrontAPI;
  const THREE = window.THREE;
  if (!API || !THREE) { console.error('❌ IronfrontAPI no disponible'); return; }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  console.log('🧠 Mod IA Mejorada v1.0: iniciando...');
  API.say('🧠 IA Mejorada v1.0 activa');

  // ======================== CONFIGURACIÓN ========================
  const CFG = {
    squadSize: 5,
    reevalEvery: 0.6,          // seg entre reevaluaciones
    soloDist: 22,              // a partir de aquí, se reagrupa
    huidaHP: 0.35,             // % HP para huir
    huidaDist: 30,             // distancia de retroceso al huir
    artilleriaSpeed: 3,
    artilleriaRange: 140,
    artilleriaCooldown: 6.5,
    artilleriaDamage: 260,
    fuegoSupresionCd: 0.6,
  };

  // ======================== HUD ========================
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:150px;right:6px;z-index:26;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 9px;font:11px sans-serif;color:#fff;min-width:170px;backdrop-filter:blur(4px)';
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

  // ======================== ARTILLERÍA (nueva unidad) ========================
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
    // Cabeza tractora
    add(new THREE.BoxGeometry(2.6, 1.8, 2.6), matBody, 0, 1.5, 3.6);
    add(new THREE.BoxGeometry(2.2, 1.4, 0.3), new THREE.MeshLambertMaterial({ color: 0x1a2a3a }), 0, 1.7, 4.9);
    // Orugas
    for (const sx of [-1.6, 1.6]) {
      add(new THREE.BoxGeometry(0.9, 0.9, 7.4), matDark, sx, 0.55, 0);
      for (let i = 0; i < 6; i++) {
        add(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 8), matMetal,
          sx, 0.55, -3 + i * 1.2, 0, 0, Math.PI / 2);
      }
    }
    // Base del mortero
    add(new THREE.CylinderGeometry(1.8, 2.0, 0.8, 12), matDark, 0, 2.2, -1.5);
    // Tubo elevado
    const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 6.5, 12), matDark);
    tubo.position.set(0, 3.8, -2.5);
    tubo.rotation.x = -Math.PI / 3.2;
    tubo.castShadow = true;
    g.add(tubo);
    // Boca
    add(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), matMetal, 0, 5.4, -5.2, -Math.PI / 3.2);
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

    // Anillo selección
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 24),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, transparent: true }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    ring.visible = false;
    g.add(ring);

    const unit = {
      type: 'artillery',
      mesh: g, team,
      hp: 240, maxHp: 240, radius: 2.6,
      speed: CFG.artilleriaSpeed,
      cooldown: 2.5,
      target: V(x, 0, z),
      manualTarget: false,
      isDead: false, respawnTimer: 0,
      basePos: V(x, 0, z),
      hpGroup: hp, hpBar: fg, hpYOffset: 3.8, hpWidth: 3,
      selectionRing: ring,
      isArtilleria: true,
      targetEnemy: null,
      scanT: 0,
    };
    g.userData = unit;
    API.vehicles.push(unit);
    artillerias.push(unit);
    return unit;
  }

  // Spawn: 2 por bando, cerca de los cuarteles
  crearArtilleria(0x0055ff, 'ally', -30, -110);
  crearArtilleria(0x0055ff, 'ally',  30, -110);
  crearArtilleria(0xff2222, 'enemy', -30,  110);
  crearArtilleria(0xff2222, 'enemy',  30,  110);

  console.log('🚀 Artillería: 4 unidades creadas');

  // ======================== ESCUADRONES ========================
  // Un escuadrón es { id, team, units:[], role:'assault'|'support'|'flank' }
  const escuadrones = [];
  let nextSquadId = 1;

  // ======================== ESTADO POR UNIDAD ========================
  const state = new WeakMap();       // u -> { fleeUntil, flankOffset, lastTarget, role }
  function getState(u) {
    if (!state.has(u)) {
      state.set(u, {
        fleeUntil: 0,
        flankOffset: (Math.random() < 0.5 ? 1 : -1) * (4 + Math.random() * 5),
        lastTarget: null,
        role: null,
        squadId: 0,
        lastEnemyId: null,
      });
    }
    return state.get(u);
  }

  // ======================== HELPERS ========================
  function dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  function targetScore(atacante, objetivo) {
    // Puntaje: más alto = mejor blanco. Considera rol, distancia, tipo.
    const st = getState(atacante);
    const d = dist2D(atacante.mesh.position, objetivo.mesh.position);
    let score = 1000 - d;                          // cercanos valen más
    const role = atacante.role || 'rifle';
    const otype = objetivo.type || 'soldier';
    const orole = objetivo.role || null;

    // Cohetes: prefieren vehículos
    if (role === 'rocket') {
      if (otype === 'tank') score += 400;
      if (otype === 'apc') score += 300;
      if (otype === 'artillery') score += 500;
      if (otype === 'soldier') score -= 250;
    } else {
      // Rifles: prefieren infantería
      if (otype === 'soldier') score += 200;
      if (otype === 'tank') score -= 150;
      if (otype === 'apc') score -= 100;
      if (otype === 'artillery') score += 50;
    }

    // Si ya estaba apuntándolo, bonus (evita oscilar)
    if (st.lastTarget === objetivo) score += 120;

    // Unidades aéreas solo si tienen rol adecuado
    if (otype === 'plane' || otype === 'heli') {
      score -= 400;
    }

    return score;
  }

  function unidadEnemigaViva(u) {
    return u && u.hp > 0 && !u.isDead && !u.inHeli;
  }

  // Combina soldados, vehículos y tanques en una lista única de "combatientes"
  function listaCombatientes() {
    const out = [];
    for (const s of API.soldiers) if (unidadEnemigaViva(s)) out.push(s);
    for (const v of API.vehicles) if (unidadEnemigaViva(v)) out.push(v);
    for (const t of API.tanks) if (unidadEnemigaViva(t)) out.push(t);
    return out;
  }

  // ======================== CONSTRUIR ESCUADRONES ========================
  function reconstruirEscuadrones() {
    escuadrones.length = 0;
    nextSquadId = 1;

    const soldadosLibres = [];
    for (const s of API.soldiers) {
      if (!unidadEnemigaViva(s)) continue;
      if (s.inHeli || s.marine) continue;
      soldadosLibres.push(s);
      getState(s).squadId = 0;
    }

    for (const s of soldadosLibres) {
      if (getState(s).squadId) continue;
      const team = s.team;
      const grupo = [s];
      // Buscar los más cercanos del mismo equipo
      const candidatos = soldadosLibres
        .filter(o => o !== s && o.team === team && !getState(o).squadId)
        .map(o => ({ o, d: dist2D(s.mesh.position, o.mesh.position) }))
        .sort((a, b) => a.d - b.d);

      for (const c of candidatos) {
        if (grupo.length >= CFG.squadSize) break;
        if (c.d > 40) break;
        grupo.push(c.o);
      }

      const id = nextSquadId++;
      for (const u of grupo) getState(u).squadId = id;

      // Asignar roles según composición
      let tieneCohete = false;
      for (const u of grupo) if (u.role === 'rocket') tieneCohete = true;

      // El más cercano al enemigo será flanqueador, el resto assault
      const centroide = V(0, 0, 0);
      for (const u of grupo) centroide.add(u.mesh.position);
      centroide.divideScalar(grupo.length);

      // Enemigo promedio
      const enemigos = listaCombatientes().filter(e => e.team !== team);
      let avgE = null;
      if (enemigos.length) {
        avgE = V(0, 0, 0);
        for (const e of enemigos) avgE.add(e.mesh.position);
        avgE.divideScalar(enemigos.length);
      }

      grupo.forEach((u, i) => {
        const st = getState(u);
        if (i % 3 === 0) st.role = 'flank';
        else if (u.role === 'rocket') st.role = 'support';
        else st.role = 'assault';
      });

      escuadrones.push({ id, team, units: grupo, centroide, enemyCenter: avgE, created: performance.now() });
    }
  }

  // ======================== ASIGNAR OBJETIVOS A ESCUADRÓN ========================
  function asignarObjetivosEscuadron(sq, allEnemies) {
    if (!allEnemies.length) return;

    // Elegir blanco principal del escuadrón (más cercano al centroide)
    let best = null, bestD = 1e9;
    for (const e of allEnemies) {
      if (e.team === sq.team) continue;
      const d = dist2D(sq.centroide, e.mesh.position);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;

    // Repartir: assault → directo, flank → rodea, support → mantiene distancia
    sq.units.forEach((u, i) => {
      if (!unidadEnemigaViva(u)) return;
      const st = getState(u);
      const mp = u.mesh.position;
      const ep = best.mesh.position;

      // Asignación de "enemy" para que la lógica base apunte bien
      u.enemy = best;

      if (st.role === 'flank') {
        // Perpendicular a la línea U→E
        const dx = ep.x - mp.x, dz = ep.z - mp.z;
        const L = Math.hypot(dx, dz) || 1;
        const px = -dz / L, pz = dx / L;
        const tx = ep.x + px * st.flankOffset * 1.2;
        const tz = ep.z + pz * st.flankOffset * 1.2;
        u.target.set(tx, 1, tz);
        u.manualTarget = true;
      } else if (st.role === 'support') {
        // Mantiene distancia 25-40 del enemigo
        const dx = mp.x - ep.x, dz = mp.z - ep.z;
        const L = Math.hypot(dx, dz) || 1;
        const want = 32;
        const tx = ep.x + (dx / L) * want;
        const tz = ep.z + (dz / L) * want;
        u.target.set(tx, 1, tz);
        u.manualTarget = true;
      } else {
        // Assault: se acerca directo
        u.target.set(ep.x, 1, ep.z);
        u.manualTarget = true;
      }
    });

    sq.enemyCenter = best.mesh.position.clone();
    sq.target = best;
  }

  // ======================== HUIDA TÁCTICA ========================
  function intentarHuida(u, dt, now) {
    if (u.hp <= 0 || u.isDead) return false;
    const st = getState(u);
    const ratio = u.hp / u.maxHp;

    if (st.fleeUntil > now) {
      // Sigue huyendo: retrocede hacia el aliado más cercano
      const aliados = API.soldiers.filter(a =>
        a !== u && a.team === u.team && unidadEnemigaViva(a));
      let mejor = null, bestD = 1e9;
      for (const a of aliados) {
        const d = dist2D(a.mesh.position, u.mesh.position);
        if (d < bestD) { bestD = d; mejor = a; }
      }
      const destino = mejor ? mejor.mesh.position : u.basePos;
      u.target.set(destino.x, 1, destino.z);
      u.manualTarget = true;
      u.enemy = null;                 // no dispara mientras huye
      return true;
    }

    if (ratio < CFG.huidaHP) {
      // ¿Está bajo fuego? (algún enemigo a <25)
      const cerca = listaCombatientes().some(e =>
        e.team !== u.team && dist2D(e.mesh.position, u.mesh.position) < 25);
      if (cerca) {
        st.fleeUntil = now + 3500;    // 3.5 s de huida
        return true;
      }
    }
    return false;
  }

  // ======================== REAGRUPAMIENTO ========================
  function reagrupar(u, now) {
    if (u.manualTarget) return false;
    const st = getState(u);
    if (st.fleeUntil > now) return false;

    // Buscar aliado cercano (no a sí mismo)
    let minD = 1e9, amigo = null;
    for (const a of API.soldiers) {
      if (a === u || a.team !== u.team || !unidadEnemigaViva(a)) continue;
      const d = dist2D(a.mesh.position, u.mesh.position);
      if (d < minD) { minD = d; amigo = a; }
    }
    if (amigo && minD > CFG.soloDist) {
      u.target.set(amigo.mesh.position.x, 1, amigo.mesh.position.z);
      u.manualTarget = true;
      return true;
    }
    return false;
  }

  // ======================== INTELIGENCIA DE ARTILLERÍA ========================
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

    u.cooldown -= dt;
    u.scanT -= dt;

    // Reelegir blanco cada 1.2 s
    if (u.scanT <= 0) {
      u.scanT = 1.2;
      let best = null, bestScore = -1e9;
      const enemigos = listaCombatientes().filter(e => e.team !== u.team && unidadEnemigaViva(e));
      for (const e of enemigos) {
        const d = dist2D(u.mesh.position, e.mesh.position);
        if (d > CFG.artilleriaRange) continue;
        // Prioriza grupos: cuenta enemigos cerca del blanco
        let cluster = 0;
        for (const o of enemigos) {
          if (o === e) continue;
          if (dist2D(o.mesh.position, e.mesh.position) < 12) cluster++;
        }
        const score = (e.type === 'soldier' ? 1 : 2) * (10 + cluster * 8) - d * 0.2;
        if (score > bestScore) { bestScore = score; best = e; }
      }
      u.targetEnemy = best;
    }

    if (!u.targetEnemy || !unidadEnemigaViva(u.targetEnemy)) {
      // Sin blanco: patrulla cerca de su base
      const orbit = performance.now() * 0.0003;
      const tx = u.basePos.x + Math.cos(orbit) * 8;
      const tz = u.basePos.z + Math.sin(orbit) * 8;
      u.target.set(tx, 1, tz);
      return;
    }

    const tp = u.targetEnemy.mesh.position;

    // Si el objetivo está muy cerca, retrocede
    const d = dist2D(u.mesh.position, tp);
    if (d < 45) {
      const dx = u.mesh.position.x - tp.x, dz = u.mesh.position.z - tp.z;
      const L = Math.hypot(dx, dz) || 1;
      u.target.set(u.mesh.position.x + (dx / L) * 8, 1, u.mesh.position.z + (dz / L) * 8);
    } else if (d > CFG.artilleriaRange * 0.85) {
      u.target.set(tp.x, 1, tp.z);
    } else {
      // En rango: quieto apuntando
      u.target.copy(u.mesh.position);
    }

    // Apuntar la torreta (el tubo del mortero) hacia arriba fijamente
    // En el modelo, el tubo ya está inclinado. Solo disparamos.
    if (u.cooldown <= 0 && d <= CFG.artilleriaRange) {
      // Disparo con retardo visual
      const muzzle = u.mesh.position.clone();
      muzzle.y += 5.5;
      // Predice posición futura del blanco (lead)
      const velocidadBlanco = u.targetEnemy.lastSpeed || V(0, 0, 0);
      const flightTime = d / 90;
      const pred = tp.clone().addScaledVector(velocidadBlanco, flightTime * 0.5);
      API.fireProjectile(muzzle, pred, 0xff5522, CFG.artilleriaDamage, u.team);
      API.playSound('explosion');
      u.cooldown = CFG.artilleriaCooldown;
      // Sacudida visual
      u.mesh.userData.lastShot = performance.now();
    }

    // Orientar la base ligeramente hacia el blanco
    if (d < CFG.artilleriaRange) {
      const want = Math.atan2(tp.x - u.mesh.position.x, tp.z - u.mesh.position.z);
      let diff = want - u.mesh.rotation.y;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      u.mesh.rotation.y += diff * Math.min(1, dt * 1.2);
    }
  }

  // ======================== ACTUALIZACIÓN PRINCIPAL ========================
  let acc = 0;
  let now = 0;

  function tick(dt) {
    now = performance.now();
    acc += dt;

    // Reconstruir escuadrones y asignar blancos cada CFG.reevalEvery
    if (acc >= CFG.reevalEvery) {
      acc = 0;
      reconstruirEscuadrones();

      const enemigos = listaCombatientes();
      for (const sq of escuadrones) {
        // centroide
        const c = V(0, 0, 0);
        let n = 0;
        for (const u of sq.units) {
          if (unidadEnemigaViva(u)) { c.add(u.mesh.position); n++; }
        }
        if (n === 0) continue;
        c.divideScalar(n);
        sq.centroide.copy(c);
        asignarObjetivosEscuadron(sq, enemigos);
      }
    }

    // Aplicar huida / reagrupamiento a soldados
    let huyendo = 0, flanqueando = 0;
    for (const s of API.soldiers) {
      if (!unidadEnemigaViva(s)) continue;
      if (intentarHuida(s, dt, now)) { huyendo++; continue; }
      reagrupar(s, now);
      const st = getState(s);
      if (st.role === 'flank') flanqueando++;
    }

    // Artillería
    let artyVivos = 0;
    for (const a of artillerias) {
      updateArtilleria(a, dt);
      if (unidadEnemigaViva(a)) artyVivos++;
    }

    // Actualizar HP bars de artillería (la base no las incluye porque no están en allUnits)
    for (const a of artillerias) {
      if (!unidadEnemigaViva(a)) continue;
      a.hpGroup.visible = (a.hp < a.maxHp) || API.selectedUnits?.includes?.(a);
      a.hpGroup.position.copy(a.mesh.position);
      a.hpGroup.position.y += a.hpYOffset;
      a.hpGroup.quaternion.copy(API.camera.quaternion);
      a.hpBar.scale.x = Math.max(0, a.hp / a.maxHp);
      a.hpBar.position.x = -(a.hpWidth - a.hpWidth * a.hpBar.scale.x) / 2;
    }

    // HUD
    $('ai-sq-ally').textContent   = escuadrones.filter(s => s.team === 'ally').length;
    $('ai-sq-enemy').textContent  = escuadrones.filter(s => s.team === 'enemy').length;
    $('ai-fleeing').textContent   = huyendo;
    $('ai-flank').textContent     = flanqueando;
    $('ai-arty').textContent      = artyVivos;
  }

  // ======================== HOOK ========================
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    try { tick(dt); } catch (e) { console.error('IA Mejorada error:', e); }
  };

  // Exponer para debug
  window.IAMejorada = {
    version: '1.0',
    escuadrones,
    artillerias,
    config: CFG,
    reconstruir: reconstruirEscuadrones,
  };

  console.log('🧠 Mod IA Mejorada v1.0 listo.');
})();