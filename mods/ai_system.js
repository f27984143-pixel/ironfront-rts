// ==========================================
// MOD DE IA Y ACTUALIZACIONES - IRONFRONT RTS
// ==========================================

(function() {
  // Verificar que la API principal exista
  if (!window.IronfrontAPI) {
    window.IronfrontAPI = {};
  }

  // 1. SISTEMA DE ACTUALIZACIONES (LOOP DEL JUEGO)
  window.IronfrontAPI.Updates = {
    _listeners: [],

    // Permite registrar funciones para ejecutarse en cada frame
    onUpdate: function(callback) {
      if (typeof callback === 'function') {
        this._listeners.push(callback);
      }
    },

    // Ejecuta todos los callbacks registrados pasando el delta time
    tick: function(delta) {
      for (let i = 0; i < this._listeners.length; i++) {
        try {
          this._listeners[i](delta);
        } catch (e) {
          console.error("Error en Update Listener:", e);
        }
      }
    }
  };

  // 2. SISTEMA DE CONTROL DE IA (BOT BEHAVIOR)
  window.IronfrontAPI.AI = {
    // Configuración global del comportamiento de los bots
    config: {
      aggression: 1.2,           // Nivel de agresividad (0.5 a 2.0)
      detectionRadius: 20,       // Rango de detección de enemigos
      accuracy: 0.8,             // Precisión del disparo (0.0 a 1.0)
      yb_grenadier_mode: true,   // Uso de granadas por parte de los bots
      yb_check_enemy_rendering: true, // Comprobar visibilidad antes de disparar
      pathfindingPrecision: 'high'    // Calidad de navegación por waypoints
    },

    // Actualizar un parámetro de la IA en tiempo real
    setParam: function(key, value) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = value;
        if (typeof window.IronfrontAPI.say === 'function') {
          window.IronfrontAPI.say(`[IA Config] ${key} cambiado a ${value}`);
        }
      }
    },

    // Cambiar la orden o estado táctico de los bots activos
    setGlobalState: function(state) { // 'patrol', 'attack', 'hold_position', 'cover'
      if (Array.isArray(window.IronfrontAPI.units)) {
        window.IronfrontAPI.units.forEach(unit => {
          if (unit && unit.isAI) {
            unit.state = state;
          }
        });
        if (typeof window.IronfrontAPI.say === 'function') {
          window.IronfrontAPI.say(`[IA Estado] Todos los bots ahora están en modo: ${state}`);
        }
      }
    }
  };

  // Confirmar la carga del módulo
  console.log("Módulo de IA y Actualizaciones cargado correctamente.");
  if (typeof window.IronfrontAPI.say === 'function') {
    window.IronfrontAPI.say("Mod de IA y Actualizaciones activo.");
  }
})();
 
