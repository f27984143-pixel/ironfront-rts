(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  let base = location.pathname;
  if (base.endsWith('.html')) base = base.substring(0, base.lastIndexOf('/') + 1);
  else if (!base.endsWith('/')) base += '/';
  const i = base.indexOf('/modificaciones/');
  if (i !== -1) base = base.substring(0, i + 1);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(base + 'sw.js', { scope: base })
      .then(() => console.log('✅ PWA lista para offline'))
      .catch(e => console.error('❌ PWA error:', e));
  });

  window.addEventListener('offline', () => {
    console.log('📴 Modo offline');
    if (window.IronfrontAPI && window.IronfrontAPI.say) window.IronfrontAPI.say('📴 Offline');
  });
})();
