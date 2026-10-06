// mods/trucks.js
console.log("🚚 Mod de Camiones iniciando...");

// Esperamos a que la API del juego esté lista
const esperarAPI = setInterval(() => {
  if (window.IronfrontAPI) {
    clearInterval(esperarAPI);
    const API = window.IronfrontAPI;
    
    console.log("🚚 API de Ironfront detectada. Creando camiones...");

    // Lista para guardar nuestros camiones y poder actualizarlos
    const misCamiones = [];

    // Función para crear un camión
    function crearCamion(x, z, colorHex, team) {
      const grupo = new THREE.Group();
      
      // Materiales
      const matBody = new THREE.MeshLambertMaterial({ color: colorHex });
      const matCabina = new THREE.MeshLambertMaterial({ color: 0x222222 });
      const matRueda = new THREE.MeshLambertMaterial({ color: 0x111111 });

      // Chasis (Caja trasera)
      const chasis = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 6), matBody);
      chasis.position.set(0, 1.25, 1.5);
      chasis.castShadow = true;
      grupo.add(chasis);

      // Cabina (Caja delantera)
      const cabina = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2, 3), matCabina);
      cabina.position.set(0, 1, -3);
      cabina.castShadow = true;
      grupo.add(cabina);

      // Ruedas
      const geoRueda = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12);
      for (let i = -1; i <= 1; i += 2) {
        for (let j = -1; j <= 1; j += 2) {
          const rueda = new THREE.Mesh(geoRueda, matRueda);
          rueda.rotation.z = Math.PI / 2;
          rueda.position.set(i * 1.6, 0.8, j * 2);
          rueda.castShadow = true;
          grupo.add(rueda);
        }
      }

      grupo.position.set(x, 0, z);
      API.scene.add(grupo);

      // Guardamos el camión en nuestra lista local
      const camion = {
        mesh: grupo,
        team: team,
        hp: 200,
        maxHp: 200,
        speed: 8,
        target: new THREE.Vector3(x, 0, z),
        timer: 0
      };
      
      misCamiones.push(camion);
      return camion;
    }

    // Creamos 4 camiones (2 azules, 2 rojos) en diferentes posiciones
    crearCamion(-20, -40, 0x0055ff, 'ally');
    crearCamion(10, -55, 0x0055ff, 'ally');
    crearCamion(20, 40, 0xff2222, 'enemy');
    crearCamion(-10, 55, 0xff2222, 'enemy');

    API.say("🚚 ¡Mod de Camiones Activado!");

    // Función que se ejecuta en cada frame (para que los camiones se muevan)
    API.onUpdate = (delta) => {
      misCamiones.forEach(camion => {
        // Lógica simple de movimiento: patrullar aleatoriamente
        camion.timer -= delta;
        if (camion.timer <= 0) {
          camion.timer = 3 + Math.random() * 3; // Cambiar destino cada 3-6 segundos
          camion.target.set(
            (Math.random() - 0.5) * 160, 
            0, 
            (Math.random() - 0.5) * 100
          );
        }

        // Mover hacia el objetivo
        const dir = new THREE.Vector3().subVectors(camion.target, camion.mesh.position);
        dir.y = 0;
        if (dir.length() > 1) {
          dir.normalize();
          camion.mesh.position.addScaledVector(dir, camion.speed * delta);
          camion.mesh.lookAt(camion.target);
        }
      });
    };
  }
}, 100);
