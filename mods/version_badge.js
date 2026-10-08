/* MOD: Etiqueta de versión (diagnóstico)
   Muestra en pantalla qué mods están cargados y si el mapa urbano aplicó el piso de cerámica. */
(function () {
  if (window.__VERSION_BADGE) return;
  window.__VERSION_BADGE = true;
  const b = document.createElement('div');
  b.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:50;background:#000a;color:#9fe;font:10px monospace;padding:3px 6px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(b);
  function pintar() {
    const A = window.IronfrontAPI;
    const cas = window.CasasSystem ? 'casas ' + window.CasasSystem.version : 'casas: NO';
    const mapa = window.__MAPA_CIUDAD_LOADED ? 'mapa ciudad: ok' : 'mapa ciudad: NO';
    const mm = window.MejoraMundo ? 'mejora: ok' : 'mejora: NO';
    let piso = '';
    if (A && A.scene) {
      let g = null; A.scene.traverse(o => { if (o.name === 'ground') g = o; });
      piso = g ? (g.material && g.material.map ? 'piso: cemento' : 'piso: pasto') : 'piso: ?';
    }
    b.textContent = [cas, mapa, mm, piso, 'modo: ' + (localStorage.getItem('ironfront_mapa') || 'normal')].join('\n');
  }
  setInterval(pintar, 1000); pintar();
})();
