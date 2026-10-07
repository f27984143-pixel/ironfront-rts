/* ============================================================
   MOD: Camiones v2.0 — Transporte + Artillados
   Autor: Ironfront Mod System
   Uso: Colócalo como modificaciones/camiones.js
   ============================================================ */
(function () {
  if (window.__TRUCKS_MOD_LOADED) {
    console.warn('🚚 Mod Camiones ya estaba cargado. Ignorando.');
    return;
  }
  window.__TRUCKS_MOD_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) {
    console.error('❌ IronfrontAPI no disponible. Mod Camiones abortado.');
    return;
  }

  console.log('🚚 Mod Camiones v2.0: iniciando...');
  API.say('🚚 Camiones v2.0 cargados');

  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ============================================================
     TORRETA CON GIRO SUAVE (YAW REALISTA)
     ============================================================ */
  function crearTorretaSuave(padre, alturaY, offsetZ, velocidadGiro) {
    const pivote = new THREE.Group();
    pivote.position.set(0, alturaY, offsetZ);
    padre.add(pivote);

    let objetivo = null;
    let activo = false;
    const _wp = new THREE.Vector3();

    // Interceptamos lookAt del juego
    pivote.lookAt = function (x, y, z) {
      if (y === undefined && x.isVector3) objetivo = x.clone();
      else objetivo = V(x, y, z);
      activo = true;
    };

    pivote.__updateGiro = function (dt) {
      if (!activo || !objetivo) return;

      pivote.getWorldPosition(_wp);
      const dx = objetivo.x - _wp.x;
      const dz = objetivo.z - _wp.z;
      const worldYaw = Math.atan2(dx, dz);
      const parentYaw = pivote.parent ? pivote.parent.rotation.y : 0;
      const targetYaw = worldYaw - parentYaw;

      let diff = targetYaw - pivote.rotation.y;
      while (diff >  Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      const maxStep = velocidadGiro * dt;
      const step = Math.max(-maxStep, Math.min(maxStep, diff));
      pivote.rotation.y += step;

      activo = false;
    };

    return pivote;
  }

  /* ============================================================
     CONSTRUCCIÓN DEL CAMIÓN (base compartida)
     ============================================================ */
  function construirCamion(color, tipo) {
    const g = new THREE.Group();

    const matCabina   = new THREE.MeshLambertMaterial({ color: color });
    const matCabina2  = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.75) });
    const matChasis   = new THREE.MeshLambertMaterial({ color: 0x262626 });
    const matCarga    = new THREE.MeshLambertMaterial({ color: 0x8b6b3a });
    const matLona     = new THREE.MeshLambertMaterial({ color: 0x6b5528 });
    const matMetal    = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const matMetalOsc = new THREE.MeshLambertMaterial({ color: 0x2e2e2e });
    const matLlanta   = new THREE.MeshLambertMaterial({ color: 0x0d0d0d });
    const matRin      = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const matVidrio   = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
    const matFaro     = new THREE.MeshBasicMaterial({ color: 0xffe88a });
    const matFaroRojo = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    const matCromado  = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

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

    /* ============ CHASIS ============ */
    add(new THREE.BoxGeometry(2.2, 0.45, 9.0), matChasis, 0, 0.95, 0);
    add(new THREE.BoxGeometry(0.18, 0.55, 9.0), matChasis, -1.16, 0.95, 0);
    add(new THREE.BoxGeometry(0.18, 0.55, 9.0), matChasis,  1.16, 0.95, 0);
    // Travesaños
    for (const z of [-2.0, 0.5, 2.5, 4.0]) {
      add(new THREE.BoxGeometry(2.2, 0.12, 0.35), matChasis, 0, 1.2, z);
    }

    /* ============ CABINA ============ */
    // Cuerpo principal
    add(new THREE.BoxGeometry(2.5, 1.9, 2.9), matCabina, 0, 2.15, -3.1);
    // Techo ligeramente más oscuro
    add(new THREE.BoxGeometry(2.55, 0.15, 2.95), matCabina2, 0, 3.15, -3.1);
    // Capó delantero
    add(new THREE.BoxGeometry(2.3, 0.9, 1.0), matCabina, 0, 1.65, -4.9);
    // Deflector de aire superior
    add(new THREE.BoxGeometry(2.3, 0.4, 0.3), matCabina2, 0, 3.4, -3.9);
    // Chapa del techo
    add(new THREE.BoxGeometry(2.3, 0.05, 0.8), matCabina2, 0, 3.23, -2.5);

    // Parabrisas
    const vf = add(new THREE.BoxGeometry(2.2, 1.05, 0.08), matVidrio, 0, 2.5, -4.5);
    vf.rotation.x = -0.18;
    // Vidrios laterales (2 por lado)
    add(new THREE.BoxGeometry(0.08, 0.85, 1.0), matVidrio, -1.27, 2.5, -3.6);
    add(new THREE.BoxGeometry(0.08, 0.85, 1.0), matVidrio,  1.27, 2.5, -3.6);
    add(new THREE.BoxGeometry(0.08, 0.7, 0.6),  matVidrio, -1.27, 2.5, -2.2);
    add(new THREE.BoxGeometry(0.08, 0.7, 0.6),  matVidrio,  1.27, 2.5, -2.2);

    // Espejos retrovisores
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.08, 0.5, 0.15), matMetal, sx * 1.4, 2.6, -4.4);
      add(new THREE.BoxGeometry(0.25, 0.15, 0.6), matMetal, sx * 1.4, 2.9, -4.3);
    }

    // Faros delanteros
    add(new THREE.BoxGeometry(0.4, 0.35, 0.15), matFaro, -0.85, 1.6, -5.4);
    add(new THREE.BoxGeometry(0.4, 0.35, 0.15), matFaro,  0.85, 1.6, -5.4);
    // Rejilla radiador
    add(new THREE.BoxGeometry(1.7, 0.6, 0.08), matMetalOsc, 0, 1.75, -5.4);
    // Parachoques cromado
    add(new THREE.BoxGeometry(2.6, 0.4, 0.3), matCromado, 0, 1.25, -5.5);
    // Gancho
    add(new THREE.BoxGeometry(0.3, 0.3, 0.2), matMetal, 0, 1.0, -5.65);

    /* ============ RUEDAS (3 ejes: 1 frontal + 2 tándem) ============ */
    const radioR = 0.7, anchoR = 0.5;
    const geoR   = new THREE.CylinderGeometry(radioR, radioR, anchoR, 14);
    const geoRin = new THREE.CylinderGeometry(radioR * 0.55, radioR * 0.55, anchoR + 0.02, 10);
    const geoEje = new THREE.CylinderGeometry(0.13, 0.13, anchoR + 1.0, 8);

    const ruedas = [
      [-1.35, -3.5], [1.35, -3.5],   // eje frontal
      [-1.35,  1.4], [1.35,  1.4],   // eje trasero 1 (tándem)
      [-1.35,  3.0], [1.35,  3.0],   // eje trasero 2 (tándem)
    ];
    for (const [x, z] of ruedas) {
      add(geoR,   matLlanta, x, radioR, z, 0, 0, Math.PI / 2);
      add(geoRin, matRin,    x + (x > 0 ? 0.01 : -0.01), radioR, z, 0, 0, Math.PI / 2);
    }
    // Ejes
    add(geoEje, matChasis, 0, radioR, -3.5, 0, 0, Math.PI / 2);
    add(geoEje, matChasis, 0, radioR,  1.4, 0, 0, Math.PI / 2);
    add(geoEje, matChasis, 0, radioR,  3.0, 0, 0, Math.PI / 2);
    // Guardabarros frontales
    add(new THREE.BoxGeometry(2.7, 0.15, 1.2), matChasis, 0, 1.35, -3.5);

    /* ============ PARTE TRASERA ============ */
    if (tipo === 'transporte') {
      // Caja de carga
      add(new THREE.BoxGeometry(2.6, 2.4, 5.6), matCarga, 0, 2.75, 2.4);
      // Lona superior (curvada con detalle)
      add(new THREE.BoxGeometry(2.75, 0.2, 5.75), matLona, 0, 4.0, 2.4);
      // Refuerzos verticales
      for (let i = 0; i < 5; i++) {
        add(new THREE.BoxGeometry(2.72, 0.08, 0.1), matLona, 0, 2.75, -0.35 + i * 1.4);
      }
      // Listones diagonales de la lona
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const l = add(new THREE.BoxGeometry(0.06, 2.2, 0.08), matLona, sx * 1.36, 2.75, -0.35 + i * 2.0);
        }
      }
      // Puertas traseras
      add(new THREE.BoxGeometry(1.2, 2.3, 0.1), new THREE.MeshLambertMaterial({ color: 0x7a5a2a }), -0.62, 2.75, 5.25);
      add(new THREE.BoxGeometry(1.2, 2.3, 0.1), new THREE.MeshLambertMaterial({ color: 0x7a5a2a }),  0.62, 2.75, 5.25);
      // Bisagras
      for (const sx of [-1, 1]) {
        add(new THREE.BoxGeometry(0.08, 0.15, 0.12), matMetalOsc, sx * 1.25, 2.75, 5.25);
        add(new THREE.BoxGeometry(0.08, 0.15, 0.12), matMetalOsc, sx * 1.25, 3.4, 5.25);
      }
      // Manijas
      add(new THREE.BoxGeometry(0.08, 0.35, 0.1), matMetal, -0.15, 2.75, 5.32);
      add(new THREE.BoxGeometry(0.08, 0.35, 0.1), matMetal,  0.15, 2.75, 5.32);
    } else {
      // ============ PLATAFORMA ARTILLADA ============
      add(new THREE.BoxGeometry(2.7, 0.2, 5.8), matMetal, 0, 1.35, 2.3);

      // Barandas laterales
      add(new THREE.BoxGeometry(0.15, 0.9, 5.8), matMetal, -1.32, 1.85, 2.3);
      add(new THREE.BoxGeometry(0.15, 0.9, 5.8), matMetal,  1.32, 1.85, 2.3);
      // Baranda trasera
      add(new THREE.BoxGeometry(2.7, 0.9, 0.15), matMetal, 0, 1.85, 5.2);

      // Postes verticales de las barandas
      for (let i = 0; i < 4; i++) {
        add(new THREE.BoxGeometry(0.22, 1.05, 0.22), matMetal, -1.32, 1.9, -0.3 + i * 1.8);
        add(new THREE.BoxGeometry(0.22, 1.05, 0.22), matMetal,  1.32, 1.9, -0.3 + i * 1.8);
      }
      // Poste trasero más grueso
      add(new THREE.BoxGeometry(0.28, 1.15, 0.28), matMetal, -1.32, 1.95, 5.2);
      add(new THREE.BoxGeometry(0.28, 1.15, 0.28), matMetal,  1.32, 1.95, 5.2);

      // Cajas de munición (detalle)
      add(new THREE.BoxGeometry(0.9, 0.5, 0.6), new THREE.MeshLambertMaterial({ color: 0x3a5a2a }), 0.9, 1.75, 0.3);
      add(new THREE.BoxGeometry(0.9, 0.5, 0.6), new THREE.MeshLambertMaterial({ color: 0x3a5a2a }), 0.9, 1.75, 1.0);
    }

    // Faros traseros rojos
    add(new THREE.BoxGeometry(0.3, 0.25, 0.12), matFaroRojo, -0.95, 1.25, 5.3);
    add(new THREE.BoxGeometry(0.3, 0.25, 0.12), matFaroRojo,  0.95, 1.25, 5.3);
    // Placa / matrícula
    add(new THREE.BoxGeometry(0.6, 0.25, 0.05), new THREE.MeshLambertMaterial({ color: 0xdddddd }), 0, 1.25, 5.32);

    return g;
  }

  /* ============================================================
     CREAR TORRETA ARTILLADA (solo para tipo artillado)
     ============================================================ */
  function construirTorreta(grupo, color) {
    const matTorreta   = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) });
    const matTorreta2  = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.5) });
    const matCanon     = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const matCanon2    = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const matOptica    = new THREE.MeshBasicMaterial({ color: 0x33aaff });

    // Anillo base (NO gira)
    const anillo = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.2, 0.3, 18),
      matTorreta2
    );
    anillo.position.set(0, 1.65, 2.3);
    anillo.castShadow = true;
    grupo.add(anillo);

    // Pivote suave (esto gira)
    const pivote = crearTorretaSuave(grupo, 1.9, 2.3, 2.8);

    // Cuerpo de la torreta
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 1.9), matTorreta);
    cuerpo.position.y = 0.5;
    cuerpo.castShadow = true;
    pivote.add(cuerpo);

    // Bisel frontal
    const bisel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.75, 0.4), matTorreta);
    bisel.position.set(0, 0.45, 1.05);
    bisel.castShadow = true;
    pivote.add(bisel);

    // Tapa superior
    const tapa = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 1.85), matTorreta2);
    tapa.position.y = 1.05;
    pivote.add(tapa);

    // Base del cañón
    const baseCanon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.55, 12),
      matCanon2
    );
    baseCanon.rotation.x = Math.PI / 2;
    baseCanon.position.set(0, 0.55, 1.2);
    pivote.add(baseCanon);

    // Manguito del cañón
    const manguito = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.22, 0.5, 12),
      matCanon2
    );
    manguito.rotation.x = Math.PI / 2;
    manguito.position.set(0, 0.55, 1.7);
    pivote.add(manguito);

    // Cañón principal
    const canon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 3.0, 12),
      matCanon
    );
    canon.rotation.x = Math.PI / 2;
    canon.position.set(0, 0.55, 3.0);
    canon.castShadow = true;
    pivote.add(canon);

    // Boca (freno de boca)
    const boca = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12),
      matCanon
    );
    boca.rotation.x = Math.PI / 2;
    boca.position.set(0, 0.55, 4.55);
    pivote.add(boca);
    // Ranuras del freno de boca
    for (const dx of [-0.1, 0.1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.08), matCanon);
      r.position.set(dx, 0.55, 4.55);
      pivote.add(r);
    }

    // Contrapeso trasero
    const contrapeso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), matTorreta2);
    contrapeso.position.set(0, 0.5, -0.85);
    pivote.add(contrapeso);

    // -------- Periscopio / Óptica --------
    const peri = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), matCanon2);
    peri.position.set(-0.4, 1.2, 0.3);
    pivote.add(peri);
    const lente = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.02), matOptica);
    lente.position.set(-0.4, 1.2, 0.45);
    pivote.add(lente);

    // -------- Ametralladora coaxial --------
    const mgBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.5), matCanon2);
    mgBase.position.set(0.65, 1.0, 0.55);
    pivote.add(mgBase);
    const mgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.4, 8), matCanon);
    mgBarrel.rotation.x = Math.PI / 2;
    mgBarrel.position.set(0.65, 1.0, 1.5);
    pivote.add(mgBarrel);
    // Cargador de la MG
    const mgMag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.25), matCanon2);
    mgMag.position.set(0.65, 0.75, 0.4);
    pivote.add(mgMag);

    // -------- Antena --------
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), matCanon);
    antena.position.set(-0.7, 1.9, -0.5);
    pivote.add(antena);

    return pivote;
  }

  /* ============================================================
     CREAR CAMIÓN COMPLETO
     ============================================================ */
  const camiones = [];

  function crearCamion(color, equipo, x, z, rumbo, tipo) {
    const grupo = construirCamion(color, tipo);
    grupo.position.set(x, 0, z);
    if (typeof rumbo === 'number') grupo.rotation.y = rumbo;
    API.scene.add(grupo);

    // -------- TORRETA --------
    let pivote = null;
    if (tipo === 'artillado') {
      pivote = construirTorreta(grupo, color);
    } else {
      // Transporte: torreta fantasma invisible para que el juego
      // no rote el camión entero al ver enemigos.
      pivote = new THREE.Group();
      pivote.position.set(0, 2, 0);
      pivote.visible = false;
      grupo.add(pivote);
      pivote.lookAt = function () { /* no-op */ };
    }

    // -------- ANILLO DE SELECCIÓN --------
    const selRing = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 3.4, 28),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    selRing.rotation.x = -Math.PI / 2;
    selRing.position.y = 0.15;
    selRing.visible = false;
    grupo.add(selRing);

    // -------- UNIDAD COMPATIBLE CON EL JUEGO --------
    const artillado = tipo === 'artillado';
    const unit = {
      type: 'apc',
      mesh: grupo,
      turret: pivote,
      bodyMat: null,
      originalColor: color,
      team: equipo,
      speed: artillado ? 7 : 9,
      hp: artillado ? 340 : 280,
      maxHp: artillado ? 340 : 280,
      target: new THREE.Vector3(x, 0, z),
      manualTarget: false,
      cooldown: artillado ? 2.0 : Infinity,
      isDead: false,
      radius: 2.2,
      respawnTimer: 0,
      basePos: new THREE.Vector3(x, 0, z),
      selectionRing: selRing,
      // Metadata del mod
      isTruck: true,
      truckKind: tipo,
    };
    grupo.userData = unit;
    API.vehicles.push(unit);
    camiones.push(unit);

    return unit;
  }

  /* ============================================================
     INSTANCIAR CAMIONES
     ============================================================ */
  // ---- ALIADOS (sur) ----
  crearCamion(0x0055ff, 'ally', -20, -48,  0,        'transporte');
  crearCamion(0x0055ff, 'ally',  -6, -48,  0,        'artillado');
  crearCamion(0x0044cc, 'ally',   9, -48,  0,        'artillado');

  // ---- ENEMIGOS (norte) ----
  crearCamion(0xff2222, 'enemy', -20,  48, Math.PI, 'transporte');
  crearCamion(0xff2222, 'enemy',  -6,  48, Math.PI, 'artillado');
  crearCamion(0xcc1111, 'enemy',   9,  48, Math.PI, 'artillado');

  /* ============================================================
     HOOK POR FRAME
     ============================================================ */
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }

    for (const v of API.vehicles) {
      if (!v.isTruck) continue;
      // Transporte: nunca dispara
      if (v.truckKind === 'transporte') v.cooldown = Infinity;
      // Artillado: giro suave de torreta
      if (v.turret && v.turret.__updateGiro) v.turret.__updateGiro(dt);
    }
  };

  // Exponer info de depuración
  window.CamionesMod = {
    version: '2.0',
    camiones: camiones,
    cantidad: camiones.length,
  };

  console.log(`🚚 Mod Camiones v2.0 listo — ${camiones.length} camiones creados.`);
})();
