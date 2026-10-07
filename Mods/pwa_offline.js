// Ubicación: [mods/pwa_offline.js]
/* ============================================================
   MOD: PWA Offline + Auto-actualización
   ============================================================ */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  let base = location.pathname;
  if (base.endsWith('.html')) base = base.substring(0, base.lastIndexOf('/') + 1);
  else if (!base.endsWith('/')) base += '/';
  
  // Ajustado a la estructura de carpetas de la imagen aportada
  const i = base.indexOf('/mods/');
  if (i !== -1) base = base.substring(0, i + 1);

  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    
    // [Pérdida de Estado] Se elimina el location.reload() forzado.
    // Notificamos al jugador en la UI del juego para que recargue cuando termine su partida.
    console.log('🔄 Nueva versión instalada en caché.');
    if (window.IronfrontAPI && window.IronfrontAPI.say) {
        window.IronfrontAPI.say('🔄 Nueva versión instalada. Recarga la página al terminar.');
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(base + 'sw.js', { scope: base })
      .then(reg => {
        console.log('✅ PWA registrada en', base);

        // [Rendimiento] Eliminado setInterval de 5 mins. El SW actualiza inteligentemente
        // de forma nativa en la navegación o mediante el evento 'online' definido abajo.
        reg.update().catch(() => {});

        reg.onupdatefound = () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.onstatechange = () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✨ Nueva versión disponible. Aplicando al caché...');
              // Asegúrate de que tu sw.js reciba {type: 'SKIP_WAITING'} o 'SKIP_WAITING' según lo tengas programado
              nw.postMessage('SKIP_WAITING');
            }
          };
        };
      })
      .catch(e => console.error('❌ Error SW:', e));
  });

  window.addEventListener('online', () => {
    console.log('🌐 Conexión recuperada — buscando actualizaciones en 2do plano');
    navigator.serviceWorker.getRegistration().then(r => r && r.update());
  });
  
  window.addEventListener('offline', () => {
    console.log('📴 Sin conexión');
    if (window.IronfrontAPI && window.IronfrontAPI.say) {
        window.IronfrontAPI.say('📴 Modo Offline activado');
    }
  });
})();