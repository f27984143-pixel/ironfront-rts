/* ============================================================
   MOD: Modelos HD
   - Reemplaza los helicópteros cuadrados del juego base por
     modelos detallados (cabina, rotor de cola, pods, etc.)
   - Expone window.ModelosHD para que otros mods usen los modelos
   Uso: mods/DLC.js
   ============================================================ */
(function () {
  if (window.__HD_MODELS_LOADED) { console.warn('⚠️ Modelos HD ya cargados'); return; }
  window.__HD_MODELS_LOADED = true;

  const API = window.IronfrontAPI;
  if (!API) { console.error('❌ IronfrontAPI no disponible'); return; }
  const THREE = window.THREE;

  console.log('🎨 Mod Modelos HD: iniciando...');
  API.say('🎨 Modelos HD');

  // ==================== FABRICANTE: CAZA ====================
  function buildPlane(color) {
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
    return g;
  }

  // ==================== FABRICANTE: HELICÓPTERO ====================
  // Devuelve { group, rotorMain, rotorTail, turret }
  function buildHeli(color) {
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

    return { group: g, rotorMain: rM, rotorTail: rT, turret };
  }

  // ==================== API PÚBLICA ====================
  window.ModelosHD = {
    version: '1.0',
    plane: (color) => buildPlane(color),                     // → THREE.Group
    heli: (color) => buildHeli(color),                       // → { group, rotorMain, rotorTail, turret }
    heliGroup: (color) => buildHeli(color).group,            // → THREE.Group
    buildPlane, buildHeli,
  };

  // ==================== REEMPLAZAR HELIS BASE ====================
  function upgradeBaseHelis() {
    if (!API.aiHelis || !API.aiHelis.length) return;
    let count = 0;
    for (const h of API.aiHelis) {
      try {
        const oldMesh = h.mesh;
        if (!oldMesh) continue;
        const oldPos = oldMesh.position.clone();
        const oldRotY = oldMesh.rotation.y;
        // Detectar color del heli base
        let color = 0x0055ff;
        oldMesh.traverse(c => {
          if (c.isMesh && c.material && c.material.color) {
            const hex = c.material.color.getHex();
            if (hex !== 0x000000 && hex !== 0x111111 && hex !== 0x222222) color = hex;
          }
        });
        // Construir HD
        const result = buildHeli(color);
        result.group.position.copy(oldPos);
        result.group.rotation.y = oldRotY;
        // Reemplazar en la escena
        API.scene.remove(oldMesh);
        API.scene.add(result.group);
        // Actualizar referencias del objeto heli
        h.mesh = result.group;
        h.rotor = result.rotorMain;   // el juego base hace heli.rotor.rotation.y += ...
        count++;
      } catch (e) { console.error('Error upgrading heli:', e); }
    }
    if (count) console.log(`🎨 ${count} helicópteros base actualizados a HD`);
  }

  // Esperar 1 frame para asegurar que el juego base ya inicializó
  setTimeout(upgradeBaseHelis, 50);

  console.log('🎨 Mod Modelos HD listo. Expuesto en window.ModelosHD');
})();