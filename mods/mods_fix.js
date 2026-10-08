/* ============================================================
   MOD: Arreglos de mapa v1.0
   - Quita árboles que quedaron dentro del río o del mar
     (árboles base instanciados y árboles de mejora_mundo)
   - Se aplica a ambos mapas
   ============================================================ */
(function () {
  if (window.__MODS_FIX_LOADED) return;
  window.__MODS_FIX_LOADED = true;

  const API = window.IronfrontAPI;
  const THREE = window.THREE;
  if (!API || !THREE) { console.error('Arreglos: IronfrontAPI no disponible'); return; }

  // Mismas reglas que mejora_mundo.inWater, más el borde del mar (x >= 132)
  function enAgua(x, z) {
    const WD = window.WorldData || {};
    const R = WD.RIVER || { zMin: 42, zMax: 68, halfLen: 125 };
    if (Math.abs(x) >= 132) return true;
    if (z >= R.zMin - 1 && z <= R.zMax + 1 && Math.abs(x) <= R.halfLen + 1) {
      for (const b of (WD.BRIDGES_X || [])) if (x >= b.xMin - 2 && x <= b.xMax + 2) return false;
      return true;
    }
    return false;
  }

  // Quita la caja de colisión de un árbol (alto 7, ancho 1.8) en esa posición
  function quitarCaja(x, z) {
    const hs = (typeof houses !== 'undefined' && Array.isArray(houses)) ? houses : null;
    if (!hs) return;
    for (const h of hs) {
      if (!h || !h.min || h.min.x > 9000) continue;
      const cx = (h.min.x + h.max.x) / 2, cz = (h.min.z + h.max.z) / 2;
      if (Math.abs(cx - x) < 0.3 && Math.abs(cz - z) < 0.3 && Math.abs((h.max.x - h.min.x) - 1.8) < 1e-3) {
        h.min.set(99999, 0, 99999); h.max.set(99999, 0, 99999);
      }
    }
  }
  const COLORES_ARBOL = [0x594630, 0x2f5f33];
  const CERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmp = new THREE.Matrix4();

  function limpiarInstanciados() {
    let quitados = 0;
    API.scene.traverse(o => {
      if (!o.isInstancedMesh || !o.material || !o.material.color) return;
      if (!COLORES_ARBOL.includes(o.material.color.getHex())) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, tmp);
        const e = tmp.elements;
        if (enAgua(e[12], e[14])) { o.setMatrixAt(i, CERO); quitarCaja(e[12], e[14]); quitados++; }
      }
      o.instanceMatrix.needsUpdate = true;
    });
    return quitados;
  }

  function limpiarMejora() {
    const trees = window.MejoraMundo && window.MejoraMundo.trees;
    if (!Array.isArray(trees)) return 0;
    let quitados = 0;
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i];
      if (!t || !t.mesh) continue;
      if (enAgua(t.mesh.position.x, t.mesh.position.z)) {
        API.scene.remove(t.mesh);
        trees.splice(i, 1);
        quitados++;
      }
    }
    return quitados;
  }

  // Esperar a que mejora_mundo haya creado sus árboles
  let intentos = 0;
  const iv = setInterval(() => {
    intentos++;
    const listo = window.MejoraMundo && Array.isArray(window.MejoraMundo.trees) && window.MejoraMundo.trees.length > 0;
    if (listo || intentos > 50) {
      clearInterval(iv);
      const a = limpiarInstanciados();
      const b = limpiarMejora();
      console.log(`Arreglos de mapa: ${a} árboles base y ${b} de mejora quitados del agua`);
    }
  }, 200);
  // ===================== DESATASCAR =====================
  // Si una unidad quedó dentro de un colisionador (casa, árbol), no puede moverse:
  // la sacamos al punto libre más cercano.
  function colisiona(x, z, r) {
    return typeof window.isColliding === 'function' && window.isColliding({ x, y: 0, z }, r);
  }
  function desatascar() {
    const listas = [API.soldiers, API.vehicles, API.tanks];
    let n = 0;
    for (const lista of listas) {
      if (!Array.isArray(lista)) continue;
      for (const u of lista) {
        if (!u || !u.mesh || u.hp <= 0 || u.isDead || u.inHeli) continue;
        const p = u.mesh.position, r = u.radius || 1;
        if (!colisiona(p.x, p.z, r)) continue;
        let libre = false;
        for (let d = 1.5; d <= 16 && !libre; d += 1.5) {
          for (let a = 0; a < 16 && !libre; a++) {
            const ang = (a / 16) * Math.PI * 2;
            const x = p.x + Math.cos(ang) * d, z = p.z + Math.sin(ang) * d;
            if (Math.abs(x) <= 128 && !colisiona(x, z, r)) {
              p.x = x; p.z = z;
              if (u.target) u.target.set(x, u.target.y, z);
              libre = true; n++;
            }
          }
        }
      }
    }
    return n;
  }
  let acc = 0;
  const prevOnUpdate = API.onUpdate;
  API.onUpdate = function (dt) {
    if (typeof prevOnUpdate === 'function') { try { prevOnUpdate(dt); } catch (e) { console.error(e); } }
    acc += dt;
    if (acc > 0.5) { acc = 0; const n = desatascar(); if (n) console.log('Desatascadas:', n); }
  };

  window.ArreglosMapa = { limpiarInstanciados, limpiarMejora, enAgua, desatascar };
})();
