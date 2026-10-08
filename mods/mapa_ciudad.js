/* ============================================================
   MOD: Mapa Ciudad v1.0 — segundo mapa
   - Solo edificios (ciudad de manzanas, sin árboles ni mar)
   - Solo infantería: sin tanques, APC, helis, barcos, aviones
   - Botón para cambiar de mapa (recarga y recuerda la elección)
   Requiere: casas.js (CasasSystem) cargado antes o después
   ============================================================ */
(function () {
  if (window.__MAPA_CIUDAD_LOADED) { console.warn('Mapa Ciudad ya cargado'); return; }
  window.__MAPA_CIUDAD_LOADED = true;

  const API = window.IronfrontAPI;
  const THREE = window.THREE;
  if (!API || !THREE) { console.error('Mapa Ciudad: IronfrontAPI no disponible'); return; }

  const KEY = 'ironfront_mapa';
  let esCiudad = false;
  try { esCiudad = localStorage.getItem(KEY) === 'ciudad'; } catch (e) {}

  // Lee un array/valor global del juego (let/const de game.js) con respaldo
  function G(name) {
    if (window[name] !== undefined) return window[name];
    try { return (0, eval)(name); } catch (e) { return null; }
  }

  // ===================== BOTÓN DE CAMBIO DE MAPA =====================
  function boton() {
    const b = document.createElement('button');
    b.textContent = esCiudad ? '⚔ Mapa normal' : '🏙️ Mapa ciudad';
    b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:40;background:#1f2937cc;color:#fff;' +
      'border:1px solid #6b7280;border-radius:8px;padding:6px 10px;font:700 11px sans-serif;cursor:pointer;touch-action:manipulation';
    b.addEventListener('click', () => {
      const nuevo = esCiudad ? 'normal' : 'ciudad';
      if (!confirm(nuevo === 'ciudad' ? 'Cambiar al mapa ciudad (solo infantería)?' : 'Volver al mapa normal?')) return;
      try { localStorage.setItem(KEY, nuevo); } catch (e) {}
      location.reload();
    });
    document.body.appendChild(b);
  }

  // ===================== ACTIVAR CIUDAD =====================
  function quitarUnidades(arr) {
    if (!Array.isArray(arr)) return;
    for (const u of arr) {
      if (!u) continue;
      if (u.mesh) API.scene.remove(u.mesh);
      if (u.hpGroup) API.scene.remove(u.hpGroup);
    }
    arr.length = 0;
  }

  function ocultarVerdes() {
    // Árboles de la base (cilindros y conos) y mar/arena
    const COLORES = [0x594630, 0x2f5f33];
    API.scene.traverse(o => {
      if (o.isInstancedMesh && o.material && o.material.color && COLORES.includes(o.material.color.getHex())) o.visible = false;
      const p = o.geometry && o.geometry.parameters;
      if (p && ((p.width === 300 && p.height === 420) || (p.width === 10 && p.height === 400))) o.visible = false;
    });
  }

  function ocultarAeropuertos() {
    // Aeropuertos de mejora_mundo (pistas, hangares, aviones parqueados): cerca de (±60, ±200)
    const puntos = [[-60, -200], [60, 200]];
    for (const ch of [...API.scene.children]) {
      if (ch.position.y > 60) continue;
      for (const p of puntos) {
        if (Math.hypot(ch.position.x - p[0], ch.position.z - p[1]) < 75) ch.visible = false;
      }
    }
  }
  function quitarAviones() {
    // Aviones y helicópteros de mejora_mundo (listas expuestas en window.MejoraMundo)
    const mm = window.MejoraMundo;
    if (!mm) return;
    for (const lista of [mm.planes, mm.helis]) {
      if (!Array.isArray(lista)) continue;
      for (const u of lista) if (u && u.mesh) API.scene.remove(u.mesh);
      lista.length = 0;
    }
  }

  function activarCiudad() {
    // 1) Sin vehículos ni barcos ni aviones de combate
    quitarUnidades(API.vehicles);
    quitarUnidades(API.tanks);
    quitarUnidades(API.aiHelis);
    quitarUnidades(API.boats);
    quitarUnidades(API.transports);
    for (const j of (G('jets') || [])) if (j && j.jet) API.scene.remove(j.jet);
    const jets = G('jets'); if (Array.isArray(jets)) jets.length = 0;
    for (const bmb of (G('bombs') || [])) if (bmb && bmb.mesh) API.scene.remove(bmb.mesh);
    const bombs = G('bombs'); if (Array.isArray(bombs)) bombs.length = 0;

    // 2) Infantería nueva en cada extremo (las antiguas se quitan)
    quitarUnidades(API.soldiers);
    if (typeof G('clearSelection') === 'function') G('clearSelection')();
    if (API.directControlActive && API.directControlActive() && typeof G('toggleDirectControl') === 'function') G('toggleDirectControl')();

    for (let i = 0; i < 16; i++) {
      const rocket = i < 4;
      API.spawnSoldier((Math.random() - 0.5) * 70, -150 + (Math.random() - 0.5) * 8, 0x0055ff, 'ally', rocket ? 'rocket' : 'rifle');
    }
    for (let i = 0; i < 16; i++) {
      const rocket = i < 4;
      API.spawnSoldier((Math.random() - 0.5) * 70, 150 + (Math.random() - 0.5) * 8, rocket ? 0xaa0000 : 0xff2222, 'enemy', rocket ? 'rocket' : 'rifle');
    }

    // 3) Escenario: solo edificios
    ocultarVerdes();
    ocultarAeropuertos();
    quitarAviones();
    const btnA = document.getElementById('btn-airstrike');
    if (btnA) btnA.style.display = 'none';            // sin ataque aéreo
    const btnD = document.getElementById('btn-direct-control');
    if (btnD) btnD.style.display = '';                 // control directo sólo en soldados

    // 4) Ciudad
    if (window.CasasSystem) {
      window.CasasSystem.clearAll();
      window.CasasSystem.buildLots(window.CasasSystem.layoutLots('ciudad', 11));
    } else {
      console.error('Mapa Ciudad: falta casas.js');
    }
    API.say && API.say('🏙️ Mapa Ciudad: solo infantería entre edificios');
  }

  // ===================== ARRANQUE =====================
  // El botón de mapa ahora está en el menú de modos (modos_juego.js)
  if (esCiudad) {
    // Espera a que el juego y casas.js estén listos
    let intentos = 0;
    const iv = setInterval(() => {
      intentos++;
      if (window.CasasSystem && API.soldiers && API.spawnSoldier) {
        clearInterval(iv);
        setTimeout(activarCiudad, 400);
      } else if (intentos > 80) {
        clearInterval(iv);
        console.error('Mapa Ciudad: no se encontró casas.js');
      }
    }, 100);
  }
  window.MapaCiudad = { activo: esCiudad, activar: activarCiudad };
  console.log('Mapa Ciudad v1.0 cargado. Modo:', esCiudad ? 'ciudad' : 'normal');
})();
