/* ============================================================
   MOD: PWA Offline + Auto-actualización
   ============================================================ */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  let base = location.pathname;
  if (base.endsWith('.html')) base = base.substring(0, base.lastIndexOf('/') + 1);
  else if (!base.endsWith('/')) base += '/';
  const i = base.indexOf('/modificaciones/');
  if (i !== -1) base = base.substring(0, i + 1);

  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    console.log('🔄 Nueva versión instalada, recargando...');
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(base + 'sw.js', { scope: base })
      .then(reg => {
        console.log('✅ PWA registrada en', base);

        // Revisar actualizaciones cada vez que se abre + cada 5 min
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000);

        reg.onupdatefound = () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.onstatechange = () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✨ Nueva versión disponible. Aplicando...');
              nw.postMessage('SKIP_WAITING');
            }
          };
        };
      })
      .catch(e => console.error('❌ SW:', e));
  });

  window.addEventListener('online', () => {
    console.log('🌐 Online — buscando actualizaciones');
    navigator.serviceWorker.getRegistration().then(r => r && r.update());
  });
  window.addEventListener('offline', () => {
    console.log('📴 Offline');
    if (window.IronfrontAPI && window.IronfrontAPI.say) window.IronfrontAPI.say('📴 Offline');
  });
})();
