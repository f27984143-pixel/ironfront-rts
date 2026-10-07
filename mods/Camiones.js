/* =========================================================
   MOD: Camiones de Transporte
   Coloca este archivo como modificaciones/camiones.js
   El juego lo cargará automáticamente.
   ========================================================= */
(function () {
  const API = window.IronfrontAPI;
  if (!API) {
    console.error('❌ IronfrontAPI no disponible. Mod Camiones abortado.');
    return;
  }

  console.log('🚚 Mod Camiones: iniciando...');
  API.say('🚚 Mod Camiones cargado');

  // ---------- Fábrica de camiones ----------
  function crearCamion(color, team, x, z, rumbo) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: color });
    const boxMat  = new THREE.MeshLambertMaterial({ color: 0x8b6b3a });
    const dark    = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    // Cabina
    const cabina = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.5), bodyMat);
    cabina.position.set(0, 1.4, -2.2);
    cabina.castShadow = true;
    g.add(cabina);

    // Parabrisas
    const vidrio = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.15),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    vidrio.position.set(0, 1.7, -0.9);
    g.add(vidrio);

    // Caja de carga
    const caja = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 5.5), boxMat);
    caja.position.set(0, 1.6, 1.5);
    caja.castShadow = true;
    g.add(caja);

    // Ruedas
    for (const wx of [-1.3, 1.3]) {
      for (const wz of [-2.2, 0.5, 3]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 10), dark);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.6, wz);
        g.add(w);
      }
    }

    g.position.set(x, 0, z);
    if (typeof rumbo === 'number') g.rotation.y = rumbo;
    API.scene.add(g);

    // Unidad compatible con el bucle de IA existente
    const unit = {
      type: 'apc',                 // usa el mismo rango/IA que un APC
      mesh: g,
      turret: null,                // sin torreta → no dispara
      bodyMat: bodyMat,
      originalColor: color,
      team: team,
      speed: 7,
      hp: 220,
      maxHp: 220,
      target: new THREE.Vector3(x, 0, z),
      manualTarget: false,
      cooldown: 99999,             // nunca dispara
      isDead: false,
      radius: 2,
      respawnTimer: 0,
      basePos: new THREE.Vector3(x, 0, z),
      isTruck: true
    };
    g.userData = unit;
    API.vehicles.push(unit);
    return unit;
  }

  // ---------- Spawn inicial: 2 por bando ----------
  crearCamion(0x0055ff, 'ally',  -18, -55, 0);
  crearCamion(0x0055ff, 'ally',   18, -55, 0);
  crearCamion(0xff2222, 'enemy', -18,  55, Math.PI);
  crearCamion(0xff2222, 'enemy',  18,  55, Math.PI);

  // ---------- Hook por frame ----------
  // Mantiene la cooldown alta para que nunca intente disparar,
  // y hace que los camiones aliados sigan al soldado más cercano
  // si están seleccionados.
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') {
      try { prevOnUpdate(dt); } catch (e) { console.error(e); }
    }
    for (const v of API.vehicles) {
      if (v.isTruck) v.cooldown = 99999;
    }
  };

  console.log('🚚 Mod Camiones listo (4 camiones añadidos).');
})();
