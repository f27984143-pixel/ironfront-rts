// mods/trucks.js
console.log("🚚 Mod de Camiones cargado.");

const esperarAPI = setInterval(() => {
  if (window.IronfrontAPI && window.IronfrontAPI.modsLoaded !== undefined) {
    clearInterval(esperarAPI);
    const API = window.IronfrontAPI;
    
    // Ejemplo: hacer que el rifle sea más fuerte
    API.WEAPONS[1].dmg = 80;
    
    // Función que se ejecuta cada frame
    API.onUpdate = (delta) => {
      // Aquí va la lógica de tus camiones
    };
    
    API.say("🚚 Mod de camiones activo");
    console.log("✅ Mod listo");
  }
}, 100);
