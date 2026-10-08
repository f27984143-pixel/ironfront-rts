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
        if (enAgua(e[12], e[14])) { o.setMatrixAt(i, CERO); quitados++; }
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
  window.ArreglosMapa = { limpiarInstanciados, limpiarMejora, enAgua };
})();
