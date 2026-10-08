/* ============================================================
   IRONFRONT RTS — CORE GAME.JS v2.0
   - Soporte para Control Directo de CUALQUIER vehículo
   - Aviones/helis del mod, botes, artillería, etc.
   - Camaras especializadas por tipo de vehículo
   ============================================================ */

/* ============ AUDIO ============ */
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playSound(type) {
  try {
    initAudio(); if (!audioCtx) return; const now = audioCtx.currentTime;
    if (type === 'shot') {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + 0.12);
    } else if (type === 'clash') {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.09);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'explosion') {
      const bufferSize = audioCtx.sampleRate * 0.4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource(); noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);
      filter.frequency.linearRampToValueAtTime(40, now + 0.4);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
      noise.start(now); noise.stop(now + 0.6);
    }
  } catch(e) {}
}

/* ============ ARMAS ============ */
const WEAPONS = [
  { key:'pistol',     name:'Pistola',       short:'P',  dmg:35,  cd:0.32, color:0xffff66, sound:'shot',      auto:false, mag:12,  reload:1.0, spread:0.008 },
  { key:'rifle',      name:'Rifle',         short:'R',  dmg:28,  cd:0.14, color:0x00ffff, sound:'shot',      auto:true,  mag:30,  reload:1.6, spread:0.022 },
  { key:'machinegun', name:'Ametralladora', short:'MG', dmg:20,  cd:0.09, color:0xffcc00, sound:'shot',      auto:true,  mag:120, reload:4.0, spread:0.055, heat:true },
  { key:'sniper',     name:'Francotirador', short:'S',  dmg:150, cd:1.2,  color:0xff3333, sound:'shot',      auto:false, mag:5,   reload:2.8, spread:0.001 },
  { key:'bazooka',    name:'Bazooka',       short:'BZ', dmg:220, cd:2.5,  color:0xff00ff, sound:'explosion', auto:false, mag:1,   reload:3.2, spread:0.01 }
];
window.__firing = false;

/* ============ ESTADO GLOBAL ============ */
let scene, camera, renderer, captureZoneRing;
let soldiers = [], vehicles = [], tanks = [], aiHelis = [], projectiles = [], houses = [];
let selectedUnits = [];
let clock = new THREE.Clock();
let captureProgress = 0;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let cameraTarget = new THREE.Vector3(0, 0, 0);
let cameraZoom = 70;
let cameraAngle = 0;
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, c: false, space: false, shift: false };
let airstrikeMode = false, airstrikeReady = true;
let directControlActive = false;
let directControlUnit = null;
let currentMouseWorld = new THREE.Vector3();
let aimDirty=false;
const joy={x:0,y:0};
const jets=[],bombs=[];
let cameraPitch=1;
let sunLight=null,combat=[],perfFrames=0,perfSum=0,perfLevel=0;
const houseList=[],coverObjs=[],bwalls=[];
const SHORE=135, boats=[];
let seaTex=null, seaT=0;
const TEAMC={ally:0x0055ff,enemy:0xff2222};
const _lp=new THREE.Vector3();
const PG=new THREE.SphereGeometry(0.5,6,6), PM={};
const transports=[];
let fpGuns=null;
let fpYaw=0,fpPitch=0,lookId=null,lastLX=0,lastLY=0;
// Throttle para aviones/helis (control directo)
let dcThrottle = 0;
let dcLastPos = new THREE.Vector3();
let dcVel = new THREE.Vector3();

window.onload = init;

/* ============ HELPER: obtener TODAS las unidades aliadas ============ */
function getAllAllies() {
  const out = soldiers.concat(vehicles, tanks, transports, aiHelis, boats);
  if (window.MejoraMundo) {
    if (window.MejoraMundo.planes) out.push(...window.MejoraMundo.planes);
    if (window.MejoraMundo.helis) out.push(...window.MejoraMundo.helis);
  }
  if (window.IAMejorada && window.IAMejorada.artillerias) {
    out.push(...window.IAMejorada.artillerias);
  }
  return out;
}

/* ============ HELPER: obtener unidad desde mesh ============ */
function getUnitFromMesh(obj) {
  let root = obj;
  while (root.parent && root.parent.type !== "Scene" && !root.userData.type && !root.userData.mesh && !root.userData.turret && !root.userData.rotor && !root.userData.rw && !root.userData.kind) {
    root = root.parent;
  }
  // Buscar userData en jerarquía
  if (root.userData && (root.userData.type || root.userData.mesh || root.userData.turret || root.userData.rotor || root.userData.rw || root.userData.kind)) {
    return root.userData;
  }
  // Fallback: buscar en el primer hijo
  if (root.children && root.children[0] && root.children[0].userData && (root.children[0].userData.type || root.children[0].userData.mesh)) {
    return root.children[0].userData;
  }
  return null;
}

/* ============ HELPER: tipo de unidad ============ */
function getUnitCategory(u) {
  if (!u) return 'unknown';
  if (u.type === 'soldier') return 'soldier';
  if (u.type === 'tank') return 'tank';
  if (u.type === 'apc' && u.isArtilleria) return 'artillery';
  if (u.type === 'apc') return 'apc';
  if (u.type === 'plane' || u.rw) return 'plane';
  if (u.type === 'heli' || (u.rotorMain && u.turret)) return 'heli';
  if (u.kind === 'transport' || u.kind === 'warship') return 'boat';
  if (u.type === 'transport' && u.rotor) return 'heli_transport';
  return u.type || 'unknown';
}

/* ============ INIT ============ */
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 150, 400);
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  updateCameraPosition();
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(120, 220, 80);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  const d = 180;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);
  sunLight=dirLight;

  createEnvironment();
  createCaptureZone();
  for(let i=0; i<12; i++) spawnSoldier((Math.random()-0.5)*40, -80+(Math.random()-0.5)*20, 0x0055ff, 'ally', 'rifle');
  for(let i=0; i<4; i++) spawnSoldier((Math.random()-0.5)*40, -80+(Math.random()-0.5)*20, 0x0033aa, 'ally', 'rocket');
  for(let i=0; i<12; i++) spawnSoldier((Math.random()-0.5)*40, 80+(Math.random()-0.5)*20, 0xff2222, 'enemy', 'rifle');
  for(let i=0; i<4; i++) spawnSoldier((Math.random()-0.5)*40, 80+(Math.random()-0.5)*20, 0xaa0000, 'enemy', 'rocket');
  createAPC(0x0055ff, 'ally', -30, -70);
  createAPC(0xff2222, 'enemy', 30, 70);
  createTank(0x0055ff, 'ally', -50, -60);
  createTank(0xff2222, 'enemy', 50, 60);
  createAIHelicopter(0x0055ff, 'ally', -80, -90);
  createAIHelicopter(0xff2222, 'enemy', 80, 90);
  createTransport('ally',0,-97,0x0044cc);
  createTransport('enemy',0,97,0xcc2222);
  createBoat('ally','transport',0);
  createBoat('ally','warship',0);
  createBoat('enemy','transport',0);
  createBoat('enemy','warship',0);

  setupControls();
  updateWeaponBar();
  animate();

  /* ====== API PARA MODS ====== */
  window.IronfrontAPI = {
    version: '2.0.0',
    scene: scene,
    camera: camera,
    renderer: renderer,
    soldiers: soldiers,
    vehicles: vehicles,
    tanks: tanks,
    aiHelis: aiHelis,
    boats: boats,
    transports: transports,
    projectiles: projectiles,
    WEAPONS: WEAPONS,
    spawnSoldier: spawnSoldier,
    createTank: createTank,
    createAPC: createAPC,
    createAIHelicopter: createAIHelicopter,
    fireProjectile: fireProjectile,
    say: say,
    playSound: playSound,
    // Expuesto para mods:
    directControlActive: () => directControlActive,
    directControlUnit: () => directControlUnit,
    onUpdate: null
  };

  cargarMods();
}

/* ====== CARGADOR DE MODS ====== */
async function cargarMods() {
  const CARPETAS = ['modificaciones', 'mods'];
  const cargados = new Set();

  try {
    const host  = location.hostname;
    const parts = location.pathname.split('/').filter(Boolean);
    if (host.endsWith('.github.io') && parts.length >= 1) {
      const usuario = host.replace('.github.io', '');
      const repo    = parts[0];
      const apiBase = `https://api.github.com/repos/${usuario}/${repo}/contents`;

      for (const carpeta of CARPETAS) {
        let ok = false;
        for (const ref of ['main', 'master']) {
          if (ok) break;
          try {
            const r = await fetch(`${apiBase}/${carpeta}?ref=${ref}`, { cache: 'no-store' });
            if (!r.ok) continue;
            const items = await r.json();
            if (!Array.isArray(items)) continue;
            ok = true;

            for (const it of items) {
              if (it.type !== 'file') continue;
              if (!/\.js$/i.test(it.name)) continue;
              if (it.name.toLowerCase() === 'mods.json') continue;
              const url = `${carpeta}/${it.name}`;
              if (cargados.has(url)) continue;
              if (await inyectarScript(url)) cargados.add(url);
            }
          } catch (_) {}
        }
      }
      console.log(`🔎 GitHub detectado: ${usuario}/${repo}`);
    }
  } catch (e) { console.warn('GitHub API no disponible:', e); }

  if (cargados.size === 0) {
    for (const base of CARPETAS) {
      let fallos = 0;
      for (let i = 1; i <= 30 && fallos < 3; i++) {
        const url = `${base}/mod${i}.js`;
        if (cargados.has(url)) { fallos = 0; continue; }
        if (await existeScript(url) && await inyectarScript(url)) { cargados.add(url); fallos = 0; }
        else fallos++;
      }
    }
  }

  for (const base of CARPETAS) {
    try {
      const r = await fetch(`${base}/mods.json`, { cache: 'no-store' });
      if (!r.ok) continue;
      const lista = await r.json();
      for (const m of lista) {
        if (m.activo === false) continue;
        const url = m.archivo.includes('/') ? m.archivo : `${base}/${m.archivo}`;
        if (cargados.has(url)) continue;
        if (await inyectarScript(url)) cargados.add(url);
      }
    } catch (_) {}
  }

  console.log(cargados.size
    ? `✅ Mods cargados (${cargados.size}):`
    : 'ℹ️ Sin mods detectados.', [...cargados]);

  if (window.IronfrontAPI) {
    window.IronfrontAPI.modsLoaded = true;
    window.IronfrontAPI.modsCargados = [...cargados];
  }
}

function existeScript(url) {
  return fetch(url, { method: 'HEAD', cache: 'no-store' })
    .then(r => r.ok).catch(() => false);
}

function inyectarScript(url) {
  return new Promise(resolve => {
    const s = document.createElement('script');
    s.src = url;
    s.onload  = () => { console.log('🔧 Mod cargado:', url); resolve(true); };
    s.onerror = () => { console.error('❌ Error al ejecutar:', url); resolve(false); };
    document.body.appendChild(s);
  });
}

/* ============ ENTORNO ============ */
function createEnvironment() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x4b6e36 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = "ground"; scene.add(ground);
  const cv=document.createElement('canvas'); cv.width=64; cv.height=128; const cx=cv.getContext('2d');
  cx.fillStyle='#4a4a4a'; cx.fillRect(0,0,64,128); cx.fillStyle='#d8d8b0'; cx.fillRect(30,10,4,50); cx.fillStyle='#8a8a80'; cx.fillRect(0,0,3,128); cx.fillRect(61,0,3,128);
  const tex=new THREE.CanvasTexture(cv); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1,17);
  const rm=new THREE.MeshLambertMaterial({map:tex});
  const r1=new THREE.Mesh(new THREE.PlaneGeometry(12,400),rm); r1.rotation.x=-Math.PI/2; r1.position.y=0.05; scene.add(r1);
  const tex2=new THREE.CanvasTexture(cv); tex2.wrapS=tex2.wrapT=THREE.RepeatWrapping; tex2.repeat.set(1,13.5);
  const r2=new THREE.Mesh(new THREE.PlaneGeometry(12,325),new THREE.MeshLambertMaterial({map:tex2})); r2.rotation.x=-Math.PI/2; r2.rotation.z=Math.PI/2; r2.position.set(-37.5,0.06,0); scene.add(r2);
  const sand=new THREE.Mesh(new THREE.PlaneGeometry(10,400),new THREE.MeshLambertMaterial({color:0xd9c68f})); sand.rotation.x=-Math.PI/2; sand.position.set(SHORE-3,0.03,0); scene.add(sand);
  const wc=document.createElement('canvas'); wc.width=wc.height=64; const wx=wc.getContext('2d'); wx.fillStyle='#2b7fc6'; wx.fillRect(0,0,64,64); wx.strokeStyle='#6fbdf0'; wx.lineWidth=2;
  for(let i=0;i<7;i++){ wx.beginPath(); wx.moveTo((i*23)%64,i*9+3); wx.lineTo((i*23)%64+14,i*9+3); wx.stroke(); }
  seaTex=new THREE.CanvasTexture(wc); seaTex.wrapS=seaTex.wrapT=THREE.RepeatWrapping; seaTex.repeat.set(38,52);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(300,420),new THREE.MeshLambertMaterial({map:seaTex,transparent:true,opacity:0.92})); sea.rotation.x=-Math.PI/2; sea.position.set(SHORE+150,0.06,0); scene.add(sea);
  const W=[],RF=[],RF2=[],WIN=[],DOOR=[],TR=[],CR=[], hpos=[];
  const addMove=(cx0,cz0,x0,x1,z0,z1)=>houses.push({ pos:null, min:new THREE.Vector3(cx0+x0,0,cz0+z0), max:new THREE.Vector3(cx0+x1,7.4,cz0+z1) });
  const addB=(cx0,cz0,x0,x1,z0,z1)=>bwalls.push({x0:cx0+x0,x1:cx0+x1,z0:cz0+z0,z1:cz0+z1});
  const tpos=[];
  for(let n=0,tries=0;n<70&&tries<900;tries++){
    const x=(Math.random()-0.5)*250, z=(Math.random()-0.5)*150;
    if(Math.abs(x)>=125) continue;
    if(z>36&&z<74) continue;   // no en el río
    if(Math.abs(x)<9||Math.abs(z)<9||Math.hypot(x,z)<22||hpos.some(h=>Math.abs(h[0]-x)<10&&Math.abs(h[1]-z)<10)||tpos.some(q=>Math.hypot(q[0]-x,q[1]-z)<5)) continue;
    tpos.push([x,z]); n++; TR.push([x,1.7,z,0.9,3.4,0.9]); CR.push([x,5.4,z,5,6,5]);
    houses.push({pos:null,min:new THREE.Vector3(x-0.9,0,z-0.9),max:new THREE.Vector3(x+0.9,7,z+0.9)}); bwalls.push({x0:x-0.8,x1:x+0.8,z0:z-0.8,z1:z+0.8}); coverObjs.push({x:x,z:z,r:1.2});
  }
  const D=new THREE.Object3D();
  const mk=(geo,mat,list,shadow,rot)=>{ const m=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length)); m.frustumCulled=false; m.castShadow=shadow; m.receiveShadow=shadow;
  list.forEach((v,i)=>{ D.position.set(v[0],v[1],v[2]); D.scale.set(v[3]||1,v[4]||1,v[5]||1); D.rotation.set(0,rot?(v[3]*0)+v[4]*0:0,0); D.updateMatrix(); m.setMatrixAt(i,D.matrix); }); m.instanceMatrix.needsUpdate=true; scene.add(m); return m; };
  const box=new THREE.BoxGeometry(1,1,1);
  mk(new THREE.CylinderGeometry(0.4,0.5,1,6),new THREE.MeshLambertMaterial({color:0x594630}),TR,true);
  mk(new THREE.ConeGeometry(0.5,1,7),new THREE.MeshLambertMaterial({color:0x2f5f33}),CR,true);
}

/* ============ COLISIONES ============ */
function isColliding(pos, radius) { if(pos.x+radius>SHORE) return true; for(let i=0;i<houses.length;i++){ const h=houses[i]; if(pos.x+radius>h.min.x && pos.x-radius<h.max.x && pos.z+radius>h.min.z && pos.z-radius<h.max.z) return true; } return false; }
function bulletBlocked(p){ for(let i=0;i<bwalls.length;i++){ const w=bwalls[i]; if(p.x>w.x0&&p.x<w.x1&&p.z>w.z0&&p.z<w.z1) return true; } return false; }
function losClear(a,b){ const dx=b.x-a.x,dz=b.z-a.z,n=Math.max(2,Math.floor(Math.hypot(dx,dz)/2.5)); for(let i=1;i<n;i++){ _lp.set(a.x+dx*i/n,0,a.z+dz*i/n); if(bulletBlocked(_lp)) return false; } return true; }
function tryMove(u,np){ const p=u.mesh.position,r=u.radius||1; if(!isColliding(np,r)){ p.copy(np); return; } const a=new THREE.Vector3(np.x,p.y,p.z); if(!isColliding(a,r)){ p.copy(a); return; } const b=new THREE.Vector3(p.x,p.y,np.z); if(!isColliding(b,r)) p.copy(b); }
function releaseSlot(u){ if(u.slot){ if(u.slot.occ===u) u.slot.occ=null; u.slot=null; } }
function exitPath(s){ return [new THREE.Vector3(s.hx,1,s.hz+2.5),new THREE.Vector3(s.hx,1,s.hz+8.5),new THREE.Vector3(s.hx+9.5,1,s.hz+9.5)]; }
function enterPath(p,hx,hz){ const pts=[]; if(p.z<hz+9){ const sx=p.x>=hx?1:-1; if(Math.abs(p.x-hx)<9.5) pts.push(new THREE.Vector3(hx+sx*9.5,1,p.z)); pts.push(new THREE.Vector3(hx+sx*9.5,1,hz+9.5)); } pts.push(new THREE.Vector3(hx,1,hz+8.5),new THREE.Vector3(hx,1,hz+2.5)); return pts; }

function takeCover(u,E,ed){
  const p=u.mesh.position, old=u.slot;
  if(old&&old.occ===u&&losClear(old,E)) return;
  const cand=[];
  for(const h of houseList){ if(Math.hypot(h.x-p.x,h.z-p.z)>38) continue; const hd=Math.hypot(h.x-E.x,h.z-E.z);
  for(const s of h.slots){ if(s.occ&&s.occ!==u&&s.occ.hp>0&&s.occ.slot===s) continue; if(Math.hypot(s.x-E.x,s.z-E.z)>=hd) continue; cand.push(s); } }
  cand.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  for(let i=0;i<Math.min(4,cand.length);i++){ const s=cand[i];
  if(Math.hypot(s.x-E.x,s.z-E.z)<58&&losClear(s,E)){
  let path=[]; if(!(old&&old.hx===s.hx&&old.hz===s.hz)){ if(old) path=exitPath(old); path=path.concat(enterPath(old?path[path.length-1]:p,s.hx,s.hz)); }
  releaseSlot(u); s.occ=u; u.slot=s; u.cover=new THREE.Vector3(s.x,1,s.z); u.path=path; return; } }
  let bc=null,bs=30;
  for(const c of coverObjs){ const d=Math.hypot(c.x-p.x,c.z-p.z), de=Math.hypot(c.x-E.x,c.z-E.z); if(de<8) continue; const sc=d+(de>ed?8:0); if(sc<bs){ bs=sc; bc=c; } }
  if(!bc) return;
  const ax=bc.x-E.x, az=bc.z-E.z, L=Math.hypot(ax,az)||1, ux=ax/L, uz=az/L, side=u.side||(u.side=Math.random()<0.5?1:-1), px=-uz*side, pz=ux*side, off=bc.r+1.6;
  for(const f of [bc.r*(0.8+0.25*Math.min(u.flank||0,4)),bc.r*0.4,0]){
  const pos=new THREE.Vector3(bc.x+ux*off+px*f,1,bc.z+uz*off+pz*f);
  if(!isColliding(pos,0.9)){ let path=old?exitPath(old):[]; releaseSlot(u); u.cover=pos; u.path=path; return; } }
}

function say(t){ const m=document.getElementById('msg'); if(!m) return; m.innerText=t; m.style.opacity=1; clearTimeout(say.t); say.t=setTimeout(()=>{m.style.opacity=0},2200); }

/* ============ BOTES ============ */
function createBoat(team,kind,idx){
  const sg=team==='ally'?-1:1, g=new THREE.Group();
  const wood=new THREE.MeshLambertMaterial({color:0x6b4a2a}), dark=new THREE.MeshLambertMaterial({color:0x3a2a1a}), tintM=new THREE.MeshLambertMaterial({color:TEAMC[team]});
  const add=(w,h,d,m,x,y,z)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); g.add(o); return o; };
  let radius,hp,speed,n;
  if(kind==='transport'){ add(5,1.6,13,wood,0,0.4,0); add(4.2,0.2,12,tintM,0,1.3,0); add(3.6,0.2,3,dark,0,1.1,7.6).rotation.x=-0.35; add(0.3,1.2,11,wood,-2.4,1.4,-0.5); add(0.3,1.2,11,wood,2.4,1.4,-0.5); radius=8; hp=450; speed=11; n=4; }
  else { add(6.5,2.2,18,wood,0,0.6,0); add(4,1.6,4,wood,0,0.5,10); add(6,3,4,dark,0,2.6,-7); add(0.35,12,0.35,dark,0,7,0); add(5.5,6,0.2,tintM,0,8.2,0.6);
  const cn=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.55,4,8),dark); cn.rotation.x=Math.PI/2; cn.position.set(0,2.6,6); g.add(cn); radius=10; hp=700; speed=9; n=6; }
  const crew=[], swordM=new THREE.MeshLambertMaterial({color:0xcfd4d8}), tr=kind==='transport', dy=tr?2.3:2.6;
  for(let i=0;i<n;i++){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.7,1.8,0.7),tintM), hx=(i%2?1:-1)*(tr?0.9:1.5), hz=(tr?-4:-2)+Math.floor(i/2)*(tr?2.4:2.5);
  f.position.set(hx,dy,hz); f.userData={hx:hx,hy:dy,hz:hz}; const sw=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.4,0.12),swordM); sw.position.set(0.55,0.3,0.4); sw.visible=false; f.add(sw); g.add(f); crew.push(f); }
  g.position.set(tr?205:195,0,sg*(tr?65:100)); g.rotation.y=-Math.PI/2; scene.add(g);
  const b={mesh:g,team:team,kind:kind,idx:idx,hp:hp,maxHp:hp,radius:radius,speed:speed,hpYOffset:7,hpWidth:7,state:tr?'load':'patrol',timer:0,unT:0,stT:0,crew:crew,crewN:n,crewMax:n,tint:tintM,marines:[],cargo:[],
  pad:new THREE.Vector3(205,0,sg*65),land:new THREE.Vector3(SHORE+9,0,sg*45),station:new THREE.Vector3(172,0,sg*55),loaded:false,isDead:false,sunk:false,respawnT:0,cd:3,boardCD:0,boarding:null,leader:false,tickT:0,plank:null,sinkT:0,bobP:Math.random()*6,spawn:g.position.clone()};
  g.userData = b;
  addHealthBar(b,7,7);
  if(tr) for(let i=0;i<4;i++){ spawnSoldier(b.pad.x,b.pad.z,TEAMC[team],team,i===3?'rocket':'rifle'); const m=soldiers[soldiers.length-1]; m.marine=b; m.hp=0; m.isDead=true; m.mesh.visible=false; m.mesh.position.y=-0.5; b.marines.push(m); }
  boats.push(b);
}

function fighters(b){ return b.crewN+b.cargo.length; }
function killCargo(b){ const P=b.mesh.position; b.cargo.forEach(m=>{ m.inHeli=null; m.hp=0; m.isDead=true; m.mesh.visible=false; m.mesh.position.set(P.x,-0.5,P.z); }); b.cargo=[]; }
function loadMarines(b){ b.cargo=[]; b.marines.forEach(m=>{ if(m.hp>0&&!m.isDead&&!m.inHeli) return; m.team=b.team; m.mesh.material.color.setHex(TEAMC[b.team]); m.hp=m.maxHp; m.isDead=false; m.respawnTimer=0; m.cover=null; m.slot=null; m.path=null; m.enemy=null; m.manualTarget=false; m.inHeli=b; m.mesh.visible=false; m.mesh.position.copy(b.mesh.position); b.cargo.push(m); }); }
function reviveBoat(b){ b.hp=b.maxHp; b.isDead=false; b.sunk=false; b.sinkT=0; b.respawnT=0; b.mesh.visible=true; b.mesh.rotation.z=0; b.mesh.position.copy(b.spawn); b.crewN=b.crewMax; b.crew.forEach(f=>{f.visible=true;}); b.state=b.kind==='transport'?'load':'patrol'; b.loaded=false; b.boardCD=5; }
function face(b,dx,dz,dt){ const a=Math.atan2(dx,dz); let d=a-b.mesh.rotation.y; while(d>Math.PI) d-=6.2832; while(d<-Math.PI) d+=6.2832; const m=2.5*dt; b.mesh.rotation.y+=Math.max(-m,Math.min(m,d)); }
function sailTo(b,t,dt,sp){ const P=b.mesh.position,dx=t.x-P.x,dz=t.z-P.z,L=Math.hypot(dx,dz); if(L>0.8){ face(b,dx,dz,dt); const k=Math.min(1,L/10+0.15)*sp*dt, ry=b.mesh.rotation.y; P.x+=Math.sin(ry)*k; P.z+=Math.cos(ry)*k; } P.x=Math.max(SHORE+5,Math.min(300,P.x)); P.z=Math.max(-190,Math.min(190,P.z)); return L; }
function shootBoat(b,T,color,dmg){ const ry=b.mesh.rotation.y,P=b.mesh.position; fireProjectile(new THREE.Vector3(P.x+Math.sin(ry)*7,3,P.z+Math.cos(ry)*7),new THREE.Vector3(T.x,1.5,T.z),color,dmg,b.team); playSound('shot'); }
function endBoard(b){ const o=b.boarding; b.boarding=null; if(o) o.boarding=null; [b,o].forEach(x=>{ if(!x) return; if(x.plank){ scene.remove(x.plank); x.plank=null; } x.crew.forEach(f=>{ f.children[0].visible=false; f.position.set(f.userData.hx,f.userData.hy,f.userData.hz); f.rotation.y=0; }); }); }
function startBoard(a,c){ a.boarding=c; c.boarding=a; a.leader=true; c.leader=false; a.tickT=0; [a,c].forEach(x=>x.crew.forEach(f=>{ f.children[0].visible=true; })); say('⚔ ¡ABORDAJE!'); playSound('clash'); }
function applyCas(b,n){ while(n-->0){ if(b.crewN>0){ b.crewN--; b.crew[b.crewN].visible=false; } else if(b.cargo.length){ const m=b.cargo.pop(); m.inHeli=null; m.hp=0; m.isDead=true; m.mesh.visible=false; m.mesh.position.set(b.mesh.position.x,-0.5,b.mesh.position.z); } } }
function capture(w,l){ endBoard(w); killCargo(l); l.team=w.team; l.tint.color.setHex(TEAMC[l.team]); l.crewN=Math.min(l.crewMax,3); l.crew.forEach((f,i)=>{ f.visible=i<l.crewN; });
const sg=l.team==='ally'?-1:1, tr=l.kind==='transport'; l.pad.set(205,0,sg*65); l.land.set(SHORE+9,0,sg*45); l.station.set(172,0,sg*55); l.spawn.set(tr?205:195,0,sg*(tr?65:100));
l.state=tr?'back':'patrol'; l.stT=0; l.loaded=false; w.boardCD=10; l.boardCD=10; say(l.team==='ally'?'🚩 ¡Los AZULES capturaron un barco!':'🚩 ¡Los ROJOS capturaron un barco!'); }
function animateCrew(b){ const o=b.boarding,P=b.mesh.position,dx=o.mesh.position.x-P.x,dz=o.mesh.position.z-P.z,L=Math.hypot(dx,dz)||1,ry=b.mesh.rotation.y,c=Math.cos(ry),s=Math.sin(ry),lx=(dx*c-dz*s)/L,lz=(dx*s+dz*c)/L;
for(let i=0;i<b.crewN;i++){ const f=b.crew[i],u=f.userData,ph=seaT*9+i*1.7,lun=1.2+Math.max(0,Math.sin(ph))*2.2; f.position.set(u.hx+lx*lun,u.hy+Math.abs(Math.sin(ph*0.5))*0.3,u.hz+lz*lun); f.rotation.y=Math.atan2(lx,lz); f.children[0].rotation.z=Math.sin(ph*1.7)*1.1; } }
function fightTick(a,dt){ const c=a.boarding; if(!c) return; const A=a.mesh.position,C=c.mesh.position,dx=C.x-A.x,dz=C.z-A.z,L=Math.hypot(dx,dz);
if(!a.plank){ a.plank=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.25,1),new THREE.MeshLambertMaterial({color:0x8a6a3a})); scene.add(a.plank); }
a.plank.position.set((A.x+C.x)/2,1.8,(A.z+C.z)/2); a.plank.scale.z=Math.max(1,L); a.plank.rotation.y=Math.atan2(dx,dz);
a.tickT+=dt; if(a.tickT<0.8) return; a.tickT=0; playSound('clash');
let ka=0,kc=0; for(let k=0;k<fighters(a);k++) if(Math.random()<0.2) ka++; for(let k=0;k<fighters(c);k++) if(Math.random()<0.2) kc++;
applyCas(c,ka); applyCas(a,kc); const fa=fighters(a),fc=fighters(c);
if(fa<=0||fc<=0){ let w=a,l=c; if(fa<=0&&fc>0){ w=c; l=a; } else if(fa<=0&&fc<=0){ if(Math.random()<0.5){ w=c; l=a; } w.crewN=1; w.crew[0].visible=true; } capture(w,l); } }

function updateBoats(dt){
  seaT+=dt; if(seaTex) seaTex.offset.x+=dt*0.012;
  for(let i=0;i<boats.length;i++) for(let j=i+1;j<boats.length;j++){ const a=boats[i],c=boats[j];
  if(a.team!==c.team&&!a.isDead&&!c.isDead&&!a.boarding&&!c.boarding&&a.boardCD<=0&&c.boardCD<=0&&Math.hypot(a.mesh.position.x-c.mesh.position.x,a.mesh.position.z-c.mesh.position.z)<15) startBoard(a,c); }
  for(const b of boats){
    // ⚠️ Si el jugador controla este bote, no aplicar IA
    if (directControlActive && directControlUnit === b) continue;

    const P=b.mesh.position; b.cd-=dt; b.boardCD-=dt;
    if(b.isDead||b.hp<=0){ if(!b.sunk){ b.sunk=true; b.isDead=true; b.sinkT=0; b.respawnT=0; endBoard(b); killCargo(b); }
    b.sinkT+=dt; P.y=-b.sinkT*1.5; b.mesh.rotation.z=Math.min(0.5,b.sinkT*0.15); if(b.sinkT>4) b.mesh.visible=false; b.respawnT+=dt; if(b.respawnT>25) reviveBoat(b); continue; }
    P.y=Math.sin(seaT*1.6+b.bobP)*0.12; b.mesh.rotation.z=Math.sin(seaT*1.1+b.bobP)*0.035;
    if(b.boarding){ animateCrew(b); if(b.leader) fightTick(b,dt); continue; }
    if(b.kind==='warship'){
      let tgt=null,td=1e9; for(const o of boats) if(o.team!==b.team&&!o.isDead){ const d=Math.hypot(o.mesh.position.x-P.x,o.mesh.position.z-P.z); if(d<td){ td=d; tgt=o; } }
      if(tgt&&td<160){ const T=tgt.mesh.position; sailTo(b,T,dt,b.speed); if(td<85&&b.cd<=0){ shootBoat(b,T,0xff8800,90); b.cd=2.6; } }
      else { sailTo(b,b.station,dt,b.speed*0.7);
      if(b.cd<=0){ let bt=null,bd=85; for(const o of combat){ if(o.team!==b.team&&o.hp>0&&!o.inHeli&&!o.kind){ const d=Math.hypot(o.mesh.position.x-P.x,o.mesh.position.z-P.z); if(d<bd){ bd=d; bt=o; } } } if(bt){ shootBoat(b,bt.mesh.position,0xff8800,90); b.cd=3; } } }
    } else {
      const sg=b.team==='ally'?-1:1;
      switch(b.state){
        case 'load': { const L=sailTo(b,b.pad,dt,b.speed); if(!b.loaded){ loadMarines(b); b.loaded=true; b.timer=0; } b.timer+=dt;
        if(b.timer>3&&L<8){ if(b.cargo.length){ b.state='sail'; b.stT=0; } else if(b.timer>12){ b.loaded=false; } } break; }
        case 'sail': { const L=sailTo(b,b.land,dt,b.speed); b.stT+=dt; if(L<5||b.stT>45){ b.state='unload'; b.unT=0.5; b.timer=0; } break; }
        case 'unload': { b.unT-=dt; if(b.unT<=0&&b.cargo.length){ const m=b.cargo.pop(); m.inHeli=null; m.mesh.visible=true; m.mesh.position.set(SHORE-4,1,P.z+(Math.random()-0.5)*6); m.target.set((Math.random()-0.5)*40,1,(Math.random()-0.5)*30); m.manualTarget=false; b.unT=0.6; }
        if(!b.cargo.length){ b.timer+=dt; if(b.timer>2){ b.state='back'; b.stT=0; } } break; }
        case 'back': { const L=sailTo(b,b.pad,dt,b.speed); b.stT+=dt; if(L<5||b.stT>45){ b.state='load'; b.loaded=false; b.timer=0; } break; }
      }
    }
  }
}

/* ============ PERF ============ */
function perfAdapt(dt){ perfFrames++; perfSum+=dt; if(perfFrames>=90){ const avg=perfSum/perfFrames; perfFrames=0; perfSum=0;
if(avg>0.034&&perfLevel<2){ perfLevel++; if(perfLevel===1) renderer.setPixelRatio(1); else if(sunLight) sunLight.castShadow=false; renderer.setSize(window.innerWidth,window.innerHeight); } } }

/* ============ ZONA DE CAPTURA ============ */
function createCaptureZone() { captureZoneRing = new THREE.Mesh(new THREE.RingGeometry(12, 16, 32), new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })); captureZoneRing.rotation.x = -Math.PI / 2; captureZoneRing.position.y = 0.1; scene.add(captureZoneRing); }

function addSelectionMarker(unit) { const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 16), new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI/2; ring.position.y = 0.1; ring.visible = false; unit.mesh.add(ring); unit.selectionRing = ring; }

function addHealthBar(unit, yOffset, width) { const hpGroup = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.2), new THREE.MeshBasicMaterial({color: 0xff0000, depthTest: false})); const fg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.2), new THREE.MeshBasicMaterial({color: 0x00ff00, depthTest: false})); fg.position.z = 0.01; hpGroup.add(bg); hpGroup.add(fg); hpGroup.renderOrder = 999; scene.add(hpGroup); unit.hpGroup = hpGroup; unit.hpBar = fg; unit.hpYOffset = yOffset; unit.hpWidth = width; }

/* ============ UNIDADES ============ */
function spawnSoldier(x, z, color, team, role) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: color })); mesh.position.set(x, 1, z); mesh.castShadow = false; scene.add(mesh); { const rk=role==='rocket'; const gm=new THREE.Mesh(rk?new THREE.BoxGeometry(0.35,0.35,1.9):new THREE.BoxGeometry(0.18,0.2,1.3),new THREE.MeshLambertMaterial({color:rk?0x556b2f:0x1a1a1a})); gm.position.set(0.55,rk?0.6:0.2,0.8); mesh.add(gm); } const unit = { type: 'soldier', role: role, weapon: role==='rocket'?4:1, mesh: mesh, team: team, hp: role==='rocket'?120:100, maxHp: role==='rocket'?120:100, target: new THREE.Vector3(x, 1, z), manualTarget: false, cooldown: 0, radius: 0.8, speed: 5.5, basePos: new THREE.Vector3(x, 1, z), respawnTimer: 0 }; mesh.userData = unit; if(team === 'ally') addSelectionMarker(unit); addHealthBar(unit, 1.8, 1.5); soldiers.push(unit); }

function createAPC(color, team, startX, startZ) { const apcGroup = new THREE.Group(); const bodyMat = new THREE.MeshLambertMaterial({ color: color }); const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2, 7.5), bodyMat); body.position.y = 1.2; body.castShadow = true; apcGroup.add(body); const wMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); for(let x=-1; x<=1; x+=2) { for(let z=-2; z<=2; z+=2) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12), wMat); wheel.rotation.z = Math.PI/2; wheel.position.set(x*2, 0.8, z*1.3); wheel.castShadow=true; apcGroup.add(wheel); } } const turret = new THREE.Group(); turret.position.set(0, 2.4, 0); const tMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2), bodyMat); tMesh.castShadow = true; turret.add(tMesh); const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 8), new THREE.MeshLambertMaterial({ color: 0x333333 })); cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 0, 1.8); cannon.castShadow = true; turret.add(cannon); apcGroup.add(turret); apcGroup.position.set(startX, 0, startZ); scene.add(apcGroup); const unit = { type: 'apc', mesh: apcGroup, turret: turret, bodyMat: bodyMat, originalColor: color, team: team, speed: 10, hp: 350, maxHp: 350, target: new THREE.Vector3(startX, 0, startZ), manualTarget: false, cooldown: 0, isDead: false, radius: 2.5, respawnTimer: 0, basePos: new THREE.Vector3(startX, 0, startZ) }; body.userData = unit; apcGroup.userData = unit; if(team === 'ally') addSelectionMarker(unit); addHealthBar(unit, 3.2, 3.5); vehicles.push(unit); }

function createTank(color, team, startX, startZ) { const tankGroup = new THREE.Group(); const bodyMat = new THREE.MeshLambertMaterial({ color: color }); const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.6, 7.5), bodyMat); body.position.y = 1; body.castShadow = true; tankGroup.add(body); const slope = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 2), bodyMat); slope.rotation.x = Math.PI/6; slope.position.set(0, 1.4, 3.5); tankGroup.add(slope); const tMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); const lTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 8), tMat); lTrack.position.set(-2.8, 0.7, 0); tankGroup.add(lTrack); const rTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 8), tMat); rTrack.position.set(2.8, 0.7, 0); tankGroup.add(rTrack); const turret = new THREE.Group(); turret.position.set(0, 2.1, 0.5); const tMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 1, 6), bodyMat); tMesh.castShadow = true; turret.add(tMesh); const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 6, 8), new THREE.MeshLambertMaterial({ color: 0x333333 })); cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 0, 3.5); cannon.castShadow = true; turret.add(cannon); const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: 0x111111 })); muzzle.position.set(0, 0, 6.5); turret.add(muzzle); tankGroup.add(turret); tankGroup.position.set(startX, 0, startZ); scene.add(tankGroup); const unit = { type: 'tank', mesh: tankGroup, turret: turret, bodyMat: bodyMat, originalColor: color, team: team, speed: 6, hp: 600, maxHp: 600, target: new THREE.Vector3(startX, 0, startZ), manualTarget: false, cooldown: 0, isDead: false, radius: 3, respawnTimer: 0, basePos: new THREE.Vector3(startX, 0, startZ) }; body.userData = unit; tankGroup.userData = unit; if(team === 'ally') addSelectionMarker(unit); addHealthBar(unit, 4, 4.5); tanks.push(unit); }

function createAIHelicopter(color, team, x, z) {
  const hGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), new THREE.MeshLambertMaterial({ color: color }));
  body.castShadow = true;
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 0.4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1;
  hGroup.add(body); hGroup.add(rotor);
  hGroup.position.set(x, 22, z);
  scene.add(hGroup);
  const unit = { type:'heli', radius: 4, mesh: hGroup, rotor: rotor, team: team, hp: 180, maxHp: 180, basePos: new THREE.Vector3(x, 22, z), velocity: new THREE.Vector3(), targetPos: new THREE.Vector3((Math.random()-0.5)*150, 22, (Math.random()-0.5)*150), cooldown: 0, isDead: false, respawnTimer: 0, strafeTimer: 0, speed: 15 };
  hGroup.userData = unit;
  addHealthBar(unit, 2, 3); aiHelis.push(unit);
}

/* ============ SISTEMA DE ARMAS ============ */
let weaponBarEls = null;
function updateWeaponBar() {
  if(!weaponBarEls) {
    weaponBarEls = {
      bar: document.getElementById('weapon-bar'),
      ammo: document.getElementById('ammo-display'),
      btns: document.querySelectorAll('#weapon-bar button')
    };
  }
  const bar = weaponBarEls.bar;
  if(!bar) return;
  const active = directControlActive && directControlUnit && directControlUnit.type === 'soldier';
  bar.style.display = active ? 'flex' : 'none';
  if(!active) return;
  const u = directControlUnit;
  const cur = u.weapon === undefined ? 1 : u.weapon;
  const w = WEAPONS[cur];
  weaponBarEls.btns.forEach(b => {
    const i = parseInt(b.dataset.w);
    b.classList.toggle('active', i === cur);
    b.classList.toggle('overheated', i === cur && u.overheated);
  });
  const am = u.ammo === undefined ? w.mag : u.ammo;
  if(u.reloadTimer > 0) { weaponBarEls.ammo.textContent = '🔄 RECARGANDO'; weaponBarEls.ammo.style.color = '#ffaa00'; }
  else if(u.overheated) { weaponBarEls.ammo.textContent = '🔥 SOBRECALENTADO'; weaponBarEls.ammo.style.color = '#ff4444'; }
  else if(w.heat && u.heat > 60) { weaponBarEls.ammo.textContent = am + '/' + w.mag + ' · 🌡' + Math.round(u.heat) + '%'; weaponBarEls.ammo.style.color = u.heat > 85 ? '#ff6644' : '#ffcc66'; }
  else { weaponBarEls.ammo.textContent = am + '/' + w.mag; weaponBarEls.ammo.style.color = '#ffffff'; }
}

function resetWeaponState(u) {
  const w = WEAPONS[u.weapon === undefined ? 1 : u.weapon];
  u.ammo = w.mag; u.heat = 0; u.overheated = false; u.reloadTimer = 0;
}

function startReload(u) {
  if(!u || u.type !== 'soldier') return;
  const w = WEAPONS[u.weapon === undefined ? 1 : u.weapon];
  if(u.reloadTimer > 0) return;
  if(u.ammo === undefined) u.ammo = w.mag;
  if(u.ammo >= w.mag) return;
  u.reloadTimer = w.reload;
  playSound('clash');
}

/* ============ CONTROLES ============ */
function setupControls() {
  window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase();
    if(keys.hasOwnProperty(k)) keys[k] = true;
    if(k === ' ') keys.space = true;
    if(k === 'shift') keys.shift = true;
    if(k === 'c') toggleDirectControl();
    if(directControlActive && directControlUnit && directControlUnit.type === 'soldier') {
      if(k >= '1' && k <= '5') { directControlUnit.weapon = parseInt(k) - 1; resetWeaponState(directControlUnit); updateWeaponBar(); }
      if(k === 'r') { startReload(directControlUnit); }
    }
  });
  window.addEventListener('keyup', e => {
    let k = e.key.toLowerCase();
    if(keys.hasOwnProperty(k)) keys[k] = false;
    if(k === ' ') keys.space = false;
    if(k === 'shift') keys.shift = false;
  });
  window.addEventListener('wheel', e => {
    if(!directControlActive) { cameraZoom = Math.max(30, Math.min(120, cameraZoom + e.deltaY * 0.05)); updateCameraPosition(); }
  });
  document.getElementById('btn-select-all').addEventListener('click', () => {
    if(directControlActive) toggleDirectControl();
    clearSelection();
    soldiers.concat(vehicles, tanks).filter(u => u.team === 'ally' && u.hp > 0).forEach(selectUnit);
  });
  document.getElementById('btn-direct-control').addEventListener('click', toggleDirectControl);
  const btnAirstrike = document.getElementById('btn-airstrike');
  btnAirstrike.addEventListener('click', () => {
    if(airstrikeReady) {
      if(directControlActive) toggleDirectControl();
      airstrikeMode = true;
      btnAirstrike.innerText = "¡Toca el objetivo!";
      btnAirstrike.classList.replace('bg-red-600', 'bg-yellow-500');
    }
  });
  document.getElementById('btn-rot-l').addEventListener('pointerdown', () => keys.q = true);
  document.getElementById('btn-rot-l').addEventListener('pointerup', () => keys.q = false);
  document.getElementById('btn-rot-r').addEventListener('pointerdown', () => keys.e = true);
  document.getElementById('btn-rot-r').addEventListener('pointerup', () => keys.e = false);
  document.querySelectorAll('#weapon-bar button').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if(!directControlActive || !directControlUnit || directControlUnit.type !== 'soldier') return;
      directControlUnit.weapon = parseInt(btn.dataset.w);
      resetWeaponState(directControlUnit);
      updateWeaponBar();
    });
  });
  let isDragging = false, startPanX = 0, startPanY = 0, initTargetX = 0, initTargetZ = 0, dragMoved = false;
  window.addEventListener('pointerdown', e => {
    if(e.target.closest('button')||e.target.closest('#stick')||e.target.closest('#weapon-bar')) return;
    initAudio();
    mouse.x=(e.clientX/window.innerWidth)*2-1;
    mouse.y=-(e.clientY/window.innerHeight)*2+1;
    aimDirty=true;
    if(directControlActive) {
      const isTouch = e.pointerType === 'touch';
      const isRightMouse = e.pointerType === 'mouse' && e.button === 2;
      const isLeftMouse = e.pointerType === 'mouse' && e.button === 0;
      if(isTouch || isRightMouse) { lookId = e.pointerId; lastLX = e.clientX; lastLY = e.clientY; }
      if(isLeftMouse) { window.__firing = true; if(directControlUnit && directControlUnit.cooldown <= 0) fireDirect(); }
      return;
    }
    isDragging = true; dragMoved = false;
    startPanX = e.clientX; startPanY = e.clientY;
    initTargetX = cameraTarget.x; initTargetZ = cameraTarget.z;
  });
  window.addEventListener('pointermove', e => {
    aimDirty=true;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    if(directControlActive) {
      if(lookId===e.pointerId){
        fpYaw+=(e.clientX-lastLX)*0.006;
        fpPitch=Math.max(-1.2,Math.min(1.2,fpPitch-(e.clientY-lastLY)*0.005));
        lastLX=e.clientX; lastLY=e.clientY;
      }
      return;
    }
    if(isDragging) {
      let dx = e.clientX - startPanX, dy = e.clientY - startPanY;
      if(Math.sqrt(dx*dx + dy*dy) > 6) dragMoved = true;
      if(dragMoved) {
        let rightX = Math.cos(cameraAngle), rightZ = -Math.sin(cameraAngle);
        let fwdX = Math.sin(cameraAngle), fwdZ = Math.cos(cameraAngle);
        let moveScale = cameraZoom * 0.0018;
        cameraTarget.x = initTargetX - (dx * rightX + dy * fwdX) * moveScale;
        cameraTarget.z = initTargetZ - (dx * rightZ + dy * fwdZ) * moveScale;
        updateCameraPosition();
      }
    }
  });
  window.addEventListener('pointerup', e => {
    isDragging = false;
    if(e.pointerType !== 'touch') window.__firing = false;
    if(e.pointerId===lookId) lookId=null;
    if(directControlActive) return;
    if(!dragMoved && !e.target.closest('button')) handleMapClick(e);
  });
  window.addEventListener('contextmenu', e => e.preventDefault());
}

function fireDirect() {
  if(!directControlUnit) return;
  const cat = getUnitCategory(directControlUnit);

  if(cat === 'soldier') {
    const u = directControlUnit;
    const w = WEAPONS[u.weapon === undefined ? 1 : u.weapon];
    if(u.reloadTimer > 0) return;
    if(w.heat && u.overheated) return;
    if(u.ammo === undefined) u.ammo = w.mag;
    if(u.ammo <= 0) { startReload(u); return; }
    const startPos = u.mesh.position.clone().add(new THREE.Vector3(0,1.5,0));
    const dir = new THREE.Vector3().subVectors(currentMouseWorld, startPos).normalize();
    const sp = w.spread || 0;
    if(sp > 0) { dir.x += (Math.random()-0.5) * sp; dir.y += (Math.random()-0.5) * sp * 0.5; dir.z += (Math.random()-0.5) * sp; dir.normalize(); }
    const farTarget = startPos.clone().addScaledVector(dir, 200);
    fireProjectile(startPos, farTarget, w.color, w.dmg, 'ally');
    playSound(w.sound);
    u.cooldown = w.cd;
    u.ammo--;
    if(w.heat) { u.heat = (u.heat || 0) + 6; if(u.heat >= 100) { u.heat = 100; u.overheated = true; } }
    if(u.ammo <= 0) startReload(u);
  } else if(cat === 'plane') {
    // ✈️ Disparar ametralladora + misiles desde el avión
    const u = directControlUnit;
    if(u.cooldown > 0) return;
    const p = u.mesh.position;
    const yaw = u.yaw !== undefined ? u.yaw : Math.atan2(Math.sin(fpYaw), Math.cos(fpYaw));
    const muzzle = new THREE.Vector3(
      p.x - Math.sin(yaw) * 8,
      p.y,
      p.z - Math.cos(yaw) * 8
    );
    const target = new THREE.Vector3(
      p.x + Math.sin(yaw) * 200,
      1,
      p.z + Math.cos(yaw) * 200
    );
    fireProjectile(muzzle, target, 0xffff44, 30, 'ally');
    playSound('shot');
    u.cooldown = 0.12;
    // Misil secundario con click derecho
    if (window.__firingSecondary && (!u.missileCooldown || u.missileCooldown <= 0)) {
      fireProjectile(muzzle, target, 0xff6600, 90, 'ally');
      playSound('explosion');
      u.missileCooldown = 3.5;
    }
  } else if(cat === 'heli' && directControlUnit.turret) {
    // 🚁 El heli usa su torreta para disparar
    const u = directControlUnit;
    if(u.cooldown > 0) return;
    const cannonTip = new THREE.Vector3(0, 0, 1.5);
    u.turret.localToWorld(cannonTip);
    fireProjectile(cannonTip, currentMouseWorld, 0xffff00, 40, 'ally');
    playSound('shot');
    u.cooldown = 0.15;
  } else if(cat === 'heli' || cat === 'heli_transport') {
    // 🚁 Heli sin torreta: dispara al frente
    const u = directControlUnit;
    if(u.cooldown > 0) return;
    const p = u.mesh.position;
    const muzzle = new THREE.Vector3(p.x, p.y - 0.5, p.z);
    const target = new THREE.Vector3(
      p.x + Math.sin(fpYaw) * 100,
      0,
      p.z - Math.cos(fpYaw) * 100
    );
    fireProjectile(muzzle, target, 0xffff00, 25, 'ally');
    playSound('shot');
    u.cooldown = 0.15;
  } else if(cat === 'boat') {
    // 🚢 El bote dispara cañones al frente
    const u = directControlUnit;
    if(u.cd > 0) return;
    const p = u.mesh.position;
    const yaw = u.mesh.rotation.y;
    const muzzle = new THREE.Vector3(
      p.x + Math.sin(yaw) * 8,
      p.y + 2,
      p.z + Math.cos(yaw) * 8
    );
    const target = new THREE.Vector3(
      p.x + Math.sin(yaw + fpYaw) * 100,
      1,
      p.z + Math.cos(yaw + fpYaw) * 100
    );
    fireProjectile(muzzle, target, 0xff8800, 90, 'ally');
    playSound('shot');
    u.cd = 0.8;
  } else if(cat === 'artillery') {
    // 💣 Artillería (la maneja ia_mejorada.js, aquí solo fallback)
    const u = directControlUnit;
    if (!u._playerCd || u._playerCd <= 0) {
      const p = u.mesh.position;
      const muzzle = new THREE.Vector3(p.x, p.y + 5.5, p.z);
      const target = new THREE.Vector3(
        p.x + Math.sin(fpYaw) * 200,
        1,
        p.z - Math.cos(fpYaw) * 200
      );
      fireProjectile(muzzle, target, 0xff5522, 260, 'ally');
      playSound('explosion');
      u._playerCd = 1.5;
    }
  } else if(directControlUnit.turret) {
    // 🚙 Cualquier otro vehículo con torreta (tank, apc)
    let damage = directControlUnit.type === 'tank' ? 150 : 50;
    const cannonTip = new THREE.Vector3(0, 0.2, 4);
    directControlUnit.turret.localToWorld(cannonTip);
    fireProjectile(cannonTip, currentMouseWorld, 0xffaa00, damage, 'ally');
    playSound('shot');
    directControlUnit.cooldown = directControlUnit.type === 'tank' ? 2.0 : 0.5;
  }
}

function toggleDirectControl() {
  if (directControlActive) {
    if(directControlUnit) directControlUnit.mesh.visible = true;
    directControlActive = false;
    directControlUnit = null;
    cameraZoom = 70;
    dcThrottle = 0;
    document.getElementById('btn-direct-control').innerText = "Control Directo (C)";
    document.getElementById('btn-direct-control').classList.replace('bg-green-600', 'bg-purple-600');
    updateWeaponBar();
  } else if (selectedUnits.length === 1) {
    directControlActive = true;
    directControlUnit = selectedUnits[0];
    aimDirty = false;
    dcThrottle = 0;
    dcLastPos.copy(directControlUnit.mesh.position);
    dcVel.set(0,0,0);
    if(directControlUnit.type !== 'soldier') {
      directControlUnit.mesh.visible = true;
    } else {
      directControlUnit.mesh.visible = false;
      if(directControlUnit.weapon === undefined) directControlUnit.weapon = directControlUnit.role === 'rocket' ? 4 : 1;
      resetWeaponState(directControlUnit);
    }
    fpYaw = Math.PI;
    fpPitch = 0;
    { const p = directControlUnit.mesh.position; currentMouseWorld.set(p.x, 0, p.z - 30); }
    document.getElementById('btn-direct-control').innerText = "Control RTS (C)";
    document.getElementById('btn-direct-control').classList.replace('bg-purple-600', 'bg-green-600');
    cameraZoom = 34;
    cameraAngle = 0;
    updateWeaponBar();
  }
}

function handleMapClick(e) {
  raycaster.setFromCamera(mouse, camera);
  const allIntersects = raycaster.intersectObjects(scene.children, true);
  const groundHit = allIntersects.find(i => i.object.name === "ground");
  if(airstrikeMode && groundHit) {
    airstrikeMode = false; airstrikeReady = false;
    const btn = document.getElementById('btn-airstrike');
    btn.innerText = "Recargando...";
    btn.className = "bg-gray-600 text-white text-xs font-bold py-2 px-4 rounded shadow-md pointer-events-none";
    callAirstrike(groundHit.point);
    setTimeout(() => { airstrikeReady = true; btn.innerText = "Ataque Aéreo"; btn.className = "bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 px-4 rounded border border-red-400 shadow-md transition-colors pointer-events-auto"; }, 20000);
    return;
  }

  // ✅ AHORA SELECCIONA CUALQUIER UNIDAD ALIADA (incluye aviones, helis del mod, botes, artillería)
  const allyObjects = [];
  const allAllies = getAllAllies();
  allAllies.filter(u => u.team === 'ally' && u.hp > 0 && !u.isDead && !u.inHeli && !u.crashing).forEach(u => {
    if (u.mesh) u.mesh.traverse(child => { if(child.isMesh) allyObjects.push(child); });
  });
  const allyHit = raycaster.intersectObjects(allyObjects);
  if (e.button !== 2 && allyHit.length > 0) {
    const unit = getUnitFromMesh(allyHit[0].object);
    if (unit && unit.team === 'ally') {
      if (!e.shiftKey) clearSelection();
      selectUnit(unit);
    }
  } else if (groundHit) {
    if (selectedUnits.length > 0) {
      const dest = groundHit.point;
      createMoveMarker(dest.x, dest.z);
      selectedUnits.forEach((unit, idx) => {
        const offsetX = (idx % 4 - 1.5) * 3, offsetZ = (Math.floor(idx / 4) - 1.5) * 3;
        // Los aviones/helis no usan target, pero por si acaso
        if (unit.target) unit.target.set(dest.x + offsetX, unit.mesh.position.y, dest.z + offsetZ);
        unit.manualTarget = true;
        unit.playerOrder = true;   // la IA no debe quitarle esta orden
        if (unit.type === 'soldier' || unit.type === 'tank' || unit.type === 'apc') {
          const tg = unit.target;
          unit.route = findPath(unit.mesh.position.x, unit.mesh.position.z, tg.x, tg.z, unit.radius || 1);
          if (unit.route.length) { const last = unit.route[unit.route.length - 1]; tg.set(last.x, tg.y, last.z); }
        }
      });
    } else clearSelection();
  }
}


/* ============ RUTAS: A* sobre cuadrícula (rodea edificios, árboles y río) ============ */
function findPath(sx, sz, tx, tz, r, maxExp, margen) {
  const cs = 1.5, M = margen || 25;
  const minX = Math.max(-150, Math.min(sx, tx) - M), maxX = Math.min(150, Math.max(sx, tx) + M);
  const minZ = Math.max(-220, Math.min(sz, tz) - M), maxZ = Math.min(220, Math.max(sz, tz) + M);
  const nx = Math.ceil((maxX - minX) / cs) + 1, nz = Math.ceil((maxZ - minZ) / cs) + 1;
  if (nx * nz > 90000) return [];
  const cellX = i => minX + i * cs, cellZ = j => minZ + j * cs;
  const memo = new Int8Array(nx * nz);   // 0 sin mirar, 1 libre, 2 bloqueada
  const free = (i, j) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
    const k = j * nx + i;
    if (memo[k] === 0) memo[k] = isColliding({ x: cellX(i), y: 1, z: cellZ(j) }, r) ? 2 : 1;
    return memo[k] === 1;
  };
  const si = Math.round((sx - minX) / cs), sj = Math.round((sz - minZ) / cs);
  const ti = Math.round((tx - minX) / cs), tj = Math.round((tz - minZ) / cs);
  if (!free(ti, tj)) return [];
  // Cola de prioridad mínima (montículo binario)
  const heap = []; const push = n => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, rr = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (rr < heap.length && heap[rr].f < heap[m].f) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  const gScore = new Map(), came = new Map();
  const key = (i, j) => j * nx + i;
  gScore.set(key(si, sj), 0);
  push({ i: si, j: sj, g: 0, f: h(si, sj) });
  const DIRS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  let found = false, expandos = 0;
  const LIMITE = maxExp || 30000;
  while (heap.length && expandos < LIMITE) {
    const cur = pop(); expandos++;
    const ck = key(cur.i, cur.j);
    if (cur.g > (gScore.get(ck) ?? Infinity)) continue;
    if (cur.i === ti && cur.j === tj) { found = true; break; }
    for (const [di, dj, c] of DIRS) {
      const ni = cur.i + di, nj = cur.j + dj;
      if (!free(ni, nj)) continue;
      if (di && dj && (!free(cur.i + di, cur.j) || !free(cur.i, cur.j + dj))) continue; // no cortar esquinas
      const ng = cur.g + c, nk = key(ni, nj);
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng); came.set(nk, ck);
        push({ i: ni, j: nj, g: ng, f: ng + h(ni, nj) });
      }
    }
  }
  if (!found) return [];
  const cells = []; let k = key(ti, tj);
  while (k !== undefined && k !== key(si, sj)) { cells.push({ x: cellX(k % nx), z: cellZ(Math.floor(k / nx)) }); k = came.get(k); }
  cells.reverse();
  // Suavizado: quitar puntos intermedios cuando la línea recta está libre
  const clearLine = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.ceil(L / 0.8)); for (let s = 1; s < n; s++) { const x = a.x + (b.x - a.x) * s / n, z = a.z + (b.z - a.z) * s / n; if (isColliding({ x, y: 1, z }, r)) return false; } return true; };
  const out = []; let from = { x: sx, z: sz }, idx = 0;
  while (idx < cells.length) {
    let best = idx;
    for (let q = cells.length - 1; q > idx; q--) if (clearLine(from, cells[q])) { best = q; break; }
    out.push(cells[best]); from = cells[best]; idx = best + 1;
  }
  return out;
}

function createMoveMarker(x, z) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.8, 16), new THREE.MeshBasicMaterial({color: 0x00ffcc, transparent:true, opacity:0.8, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI/2; ring.position.set(x, 0.2, z); scene.add(ring);
  let s = 1;
  const anim = setInterval(() => { s+=0.2; ring.scale.set(s,s,s); ring.material.opacity -= 0.1; if(ring.material.opacity <= 0) { scene.remove(ring); clearInterval(anim); } }, 30);
}

function selectUnit(u) { if (!selectedUnits.includes(u)) { selectedUnits.push(u); if (u.selectionRing) u.selectionRing.visible = true; } updateUI(); }
function clearSelection() { selectedUnits.forEach(u => { if (u.selectionRing) u.selectionRing.visible = false; }); selectedUnits = []; updateUI(); }

function updateUI() {
  document.getElementById('selected-count').innerText = selectedUnits.length === 0 ? "Ninguna" : `${selectedUnits.length} Unidad(es)`;
  const btnDC = document.getElementById('btn-direct-control');
  if(selectedUnits.length === 1) {
    btnDC.classList.remove('hidden');
    const u = selectedUnits[0];
    const cat = getUnitCategory(u);
    if(cat === 'plane') btnDC.innerText = "✈️ Pilotar (C)";
    else if(cat === 'heli' || cat === 'heli_transport') btnDC.innerText = "🚁 Pilotar (C)";
    else if(cat === 'boat') btnDC.innerText = "🚢 Pilotar (C)";
    else if(cat === 'artillery') btnDC.innerText = "💣 Controlar (C)";
    else if(cat === 'tank' || cat === 'apc') btnDC.innerText = "🚙 Conducir (C)";
    else if(cat === 'transport') btnDC.innerText = "🚁 Pilotar (C)";
    else btnDC.innerText = "Control Directo (C)";
  } else {
    btnDC.classList.add('hidden');
    if(directControlActive) toggleDirectControl();
  }
}

function updateCameraPosition() { camera.position.x = cameraTarget.x + Math.sin(cameraAngle) * (cameraZoom * 0.8); camera.position.z = cameraTarget.z + Math.cos(cameraAngle) * (cameraZoom * 0.8); camera.position.y = cameraTarget.y + cameraZoom*cameraPitch; camera.lookAt(cameraTarget); }
function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

/* ============ CONTROL DIRECTO DE VEHÍCULOS ESPECIALES ============ */
function updateDirectControlVehicle(dt) {
  if (!directControlActive || !directControlUnit) return;
  const u = directControlUnit;
  const cat = getUnitCategory(u);

  // Solo procesar aviones, helis, botes y transportes aéreos
  if (cat !== 'plane' && cat !== 'heli' && cat !== 'heli_transport' && cat !== 'boat') return;

  const p = u.mesh.position;
  const speed = u.speed || 20;
  const throttleInput = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const turnInput = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);

  // Suavizar throttle
  dcThrottle += (throttleInput - dcThrottle) * Math.min(1, dt * 2);
  const effectiveSpeed = speed * (0.3 + dcThrottle * 0.7);

  if (cat === 'plane') {
    // ✈️ Física simple de avión
    // Yaw controlado por A/D
    if (!u.yaw) u.yaw = u.mesh.rotation.y;
    u.yaw += turnInput * 1.5 * dt;
    // Altura: W sube, S baja (solo si throttle alto)
    if (throttleInput !== 0) {
      p.y += throttleInput * 8 * dt;
      p.y = Math.max(2, Math.min(80, p.y));
    }
    // Avanzar hacia adelante
    if (Math.abs(dcThrottle) > 0.05) {
      p.x += Math.sin(u.yaw) * effectiveSpeed * dt;
      p.z += Math.cos(u.yaw) * effectiveSpeed * dt;
    }
    u.mesh.rotation.y = u.yaw;
    // Banking visual
    u.mesh.rotation.z = -turnInput * 0.4;
    // Pitch visual
    u.mesh.rotation.x = -throttleInput * 0.2;
    // Flamas
    if (u.flames) for (const f of u.flames) f.visible = Math.abs(dcThrottle) > 0.05;
  } else if (cat === 'heli' || cat === 'heli_transport') {
    // 🚁 Movimiento libre tipo helicóptero
    const fwdX = Math.sin(fpYaw), fwdZ = Math.cos(fpYaw);
    const rightX = Math.cos(fpYaw), rightZ = -Math.sin(fpYaw);
    let mx = 0, mz = 0, my = 0;
    if (keys.w) { mx += fwdX; mz += fwdZ; my += 0.3; }
    if (keys.s) { mx -= fwdX * 0.7; mz -= fwdZ * 0.7; my -= 0.3; }
    if (keys.a) { mx -= rightX; mz -= rightZ; }
    if (keys.d) { mx += rightX; mz += rightZ; }
    // Aplicar joystick también
    mx += joy.x * fwdX + joy.y * rightX * 0.5;
    mz += joy.y * fwdZ + joy.x * rightZ * 0.5;

    const len = Math.hypot(mx, mz);
    if (len > 0.05) {
      const sp = speed * Math.min(1, len);
      p.x += (mx / len) * sp * dt;
      p.z += (mz / len) * sp * dt;
    }
    // Altura
    p.y += my * 15 * dt;
    p.y = Math.max(3, Math.min(80, p.y));

    // Orientar el heli hacia donde mira la cámara
    u.mesh.rotation.y = fpYaw + Math.PI;
    // Inclinación visual al moverse
    u.mesh.rotation.z = -rightX * 0.1;
    u.mesh.rotation.x = -0.05 + (keys.w ? -0.1 : 0);

    // Rotor girando
    if (u.rotorMain) u.rotorMain.rotation.y += 40 * dt;
    if (u.rotorTail) u.rotorTail.rotation.x += 45 * dt;
    if (u.rotor && !u.rotorMain) u.rotor.rotation.y += 45 * dt;
  } else if (cat === 'boat') {
    // 🚢 Movimiento de barco (solo plano XZ)
    if (!u.heading) u.heading = u.mesh.rotation.y;
    u.heading += turnInput * 1.2 * dt;
    if (Math.abs(dcThrottle) > 0.05) {
      p.x += Math.sin(u.heading) * effectiveSpeed * dt;
      p.z += Math.cos(u.heading) * effectiveSpeed * dt;
      // Limitar al agua
      p.x = Math.max(SHORE + 3, Math.min(300, p.x));
      p.z = Math.max(-190, Math.min(190, p.z));
    }
    u.mesh.rotation.y = u.heading;
  }

  // Actualizar HP bars y demás
  if (u.hpGroup) {
    u.hpGroup.position.copy(p);
    u.hpGroup.position.y += (u.hpYOffset || 3);
    u.hpGroup.quaternion.copy(camera.quaternion);
    u.hpBar.scale.x = Math.max(0, u.hp / u.maxHp);
    u.hpBar.position.x = -(u.hpWidth - u.hpWidth * u.hpBar.scale.x) / 2;
    u.hpGroup.visible = true;
  }
}

/* ============ IA BASE ============ */
function updateAI(delta) {
  combat = soldiers.concat(vehicles,tanks,transports.filter(h=>h.mesh.position.y<4),boats.filter(b=>!b.isDead));
  if (window.MejoraMundo) {
    if (window.MejoraMundo.planes) combat = combat.concat(window.MejoraMundo.planes);
    if (window.MejoraMundo.helis) combat = combat.concat(window.MejoraMundo.helis);
  }
  updateTransports(delta);
  updateBoats(delta);
  let allyCount = 0;
  soldiers.forEach(s => { if(s.hp > 0 && Math.hypot(s.mesh.position.x,s.mesh.position.z) < 15) allyCount += s.team==='ally'?1:-1; });
  captureProgress = Math.max(0, Math.min(100, captureProgress + (allyCount > 0 ? 1 : allyCount < 0 ? -1 : 0) * delta * 8));
  document.getElementById('capture-text').innerText = Math.floor(captureProgress) + '%';
  document.getElementById('capture-bar').style.width = captureProgress + '%';
  const allUnits = soldiers.concat(vehicles, tanks, aiHelis, transports, boats);
  allUnits.forEach(u => {
    if(u.hpGroup) {
      if(!u.isDead && u.hp > 0 && !u.inHeli) {
        u.hpGroup.visible = (u.hp<u.maxHp||selectedUnits.includes(u));
        u.hpGroup.position.copy(u.mesh.position);
        u.hpGroup.position.y += u.hpYOffset;
        u.hpGroup.quaternion.copy(camera.quaternion);
        u.hpBar.scale.x = Math.max(0, u.hp / u.maxHp);
        u.hpBar.position.x = -(u.hpWidth - u.hpWidth * u.hpBar.scale.x) / 2;
      } else u.hpGroup.visible = false;
    }
  });
  aiHelis.forEach(heli => {
    // ⚠️ NO aplicar IA al heli si el jugador lo controla
    if (directControlActive && directControlUnit === heli) return;
    heli.rotor.rotation.y += 45 * delta;
    if(heli.isDead) {
      heli.respawnTimer += delta; heli.mesh.visible = false;
      if(heli.respawnTimer > 15.0) { heli.hp = heli.maxHp; heli.isDead = false; heli.mesh.visible = true; heli.mesh.position.copy(heli.basePos); heli.respawnTimer = 0; }
      return;
    }
    let closestTarget = null, minDist = 120;
    soldiers.concat(vehicles, tanks).forEach(u => { if(u.team !== heli.team && u.hp > 0) { let d = heli.mesh.position.distanceTo(u.mesh.position); if(d < minDist) { minDist = d; closestTarget = u.mesh.position; } } });
    heli.strafeTimer += delta;
    if(closestTarget) { let offsetAngle = heli.strafeTimer * 1.5; heli.targetPos.copy(closestTarget).add(new THREE.Vector3(Math.cos(offsetAngle)*35, 18, Math.sin(offsetAngle)*35)); }
    else if(heli.mesh.position.distanceTo(heli.targetPos) < 15 || heli.strafeTimer > 8) { heli.targetPos.set((Math.random()-0.5)*180, 20, (Math.random()-0.5)*180); heli.strafeTimer = 0; }
    heli.mesh.position.add(new THREE.Vector3().subVectors(heli.targetPos, heli.mesh.position).normalize().multiplyScalar(15 * delta));
    heli.mesh.lookAt(heli.targetPos);
    heli.cooldown -= delta;
    if(minDist < 85 && heli.cooldown <= 0) { let aimPoint = closestTarget ? closestTarget.clone() : heli.mesh.position.clone().add(new THREE.Vector3(0,0,-50)); fireProjectile(heli.mesh.position.clone(), aimPoint, heli.team === 'ally' ? 0x00ffff : 0xff3300, 40, heli.team); playSound('shot'); heli.cooldown = 1.0; }
  });
  [tanks, vehicles, soldiers].forEach(group => group.forEach(u => {
    // (La unidad controlada por el jugador usa la rama de control directo más abajo)
    if(u.isDead || u.hp <= 0) {
      u.respawnTimer += delta;
      if(u.marine){ if(u.respawnTimer>6) u.mesh.visible=false; return; }
      if(u.respawnTimer > (u.type==='soldier'?8.0:15.0)) {
        u.cover=null;u.slot=null;u.path=null;u.enemy=null; u.hp = u.maxHp; u.isDead = false;
        if(u.bodyMat) u.bodyMat.color.setHex(u.originalColor);
        u.mesh.position.copy(u.basePos); u.mesh.position.y = u.type==='soldier'?1:0; u.respawnTimer = 0;
      }
      return;
    }
    if(u.inHeli){ u.mesh.position.copy(u.inHeli.mesh.position); return; }
    u.cooldown -= delta;
    if(directControlActive && directControlUnit === u) {
      let moveDir = new THREE.Vector3();
      if(keys.w) moveDir.z -= 1;
      if(keys.s) moveDir.z += 1;
      if(keys.a) moveDir.x -= 1;
      if(keys.d) moveDir.x += 1;
      moveDir.x+=joy.x; moveDir.z+=joy.y;
      if(moveDir.lengthSq() > 0) {
        moveDir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), cameraAngle);
        let nextPos = u.mesh.position.clone().add(moveDir.multiplyScalar(u.speed * delta));
        tryMove(u,nextPos);
        if(!u.turret) u.mesh.lookAt(nextPos);
        else u.mesh.rotation.y=Math.atan2(moveDir.x,moveDir.z);
      }
      if(u.turret) { u.turret.lookAt(currentMouseWorld.x, u.turret.position.y + u.mesh.position.y, currentMouseWorld.z); }
      else { u.mesh.lookAt(currentMouseWorld.x, u.mesh.position.y, currentMouseWorld.z); }
    } else {
      const isS=u.type==='soldier', rng=u.type==='tank'?90:(u.type==='apc'?70:60), up=u.mesh.position;
      u.scanT=(u.scanT||0)-delta;
      if(u.scanT<=0||!u.enemy||u.enemy.hp<=0||u.enemy.inHeli){ u.scanT=0.25+Math.random()*0.15; let best=null,bd=rng;
        for(const o of combat){ if(o.team!==u.team&&o.hp>0&&!o.inHeli){ const d=Math.hypot(o.mesh.position.x-up.x,o.mesh.position.z-up.z); if(d<bd){bd=d;best=o;} } }
        u.enemy=best; }
      let closestEnemy=null, ed=9999;
      if(u.enemy&&u.enemy.hp>0&&!u.enemy.inHeli){ const e=u.enemy.mesh.position; ed=Math.hypot(e.x-up.x,e.z-up.z); if(ed<=rng*1.15) closestEnemy=e; }
      if(isS){
        if(u.manualTarget){ if(u.cover||u.slot) { releaseSlot(u); u.cover=null; u.path=null; } }
        else if(closestEnemy&&ed<48){
          u.coverT=(u.coverT||0)-delta;
          if(!u.cover||u.coverT<=0){ if(!u.cover) u.preTarget=u.target.clone(); u.coverT=4+Math.random()*3; takeCover(u,closestEnemy,ed); }
        } else if(u.cover){ const old=u.slot; u.cover=null; if(old){ u.path=exitPath(old); releaseSlot(u); } else if(u.preTarget) u.target.copy(u.preTarget); }
        if(u.path&&u.path.length){ const w=u.path[0]; u.target.set(w.x,1,w.z); if(Math.hypot(w.x-up.x,w.z-up.z)<1.4){ u.path.shift(); if(!u.path.length){ if(u.cover) u.target.copy(u.cover); else if(u.preTarget) u.target.copy(u.preTarget); } } }
        else if(u.cover) u.target.copy(u.cover);
      }
      if (closestEnemy) {
        if(u.turret) u.turret.lookAt(closestEnemy.x, u.turret.position.y + up.y, closestEnemy.z); else u.mesh.lookAt(closestEnemy.x, up.y, closestEnemy.z);
        if(u.cooldown <= 0) {
          if(isS) {
            if(!losClear(up,closestEnemy)){ u.cooldown=0.3; u.blockT=(u.blockT||0)+0.3; if(u.blockT>2.4){ u.blockT=0; u.flank=(u.flank||0)+1; u.side=-(u.side||1); u.coverT=0; } }
            else { u.blockT=0; fireProjectile(up.clone().add(new THREE.Vector3(0,1,0)), closestEnemy, u.role==='rocket'?0xff00ff:(u.team==='ally'?0x00ffff:0xffaa00), u.role==='rocket'?180:25, u.team); playSound(u.role==='rocket'?'explosion':'shot'); u.cooldown = u.role==='rocket'?3.5:1.0; }
          } else { let cannonTip = new THREE.Vector3(0, 0.2, 4); u.turret.localToWorld(cannonTip); fireProjectile(cannonTip, closestEnemy, 0xffaa00, u.type==='tank'?150:50, u.team); playSound('shot'); u.cooldown = u.type==='tank'?2.0:0.6; }
        }
      }
      if (u.team === 'enemy' && !u.manualTarget && !u.cover && !(u.path&&u.path.length) && !(u.route&&u.route.length) && up.distanceTo(u.target) < (isS?3:6)) u.target.set((Math.random()-0.5)*180, isS?1:0, (Math.random()-0.5)*180);
      // IA: si el destino está lejos, calcular una ruta que rodee edificios (cada 4 s como máximo)
      if (u.route && u.routeFor && Math.hypot(u.routeFor.x - u.target.x, u.routeFor.z - u.target.z) > 2.5) u.route = null;
      if (!u.route && !u.playerOrder && !u.cover && up.distanceTo(u.target) > 8) {
        u.routeT = (u.routeT || 0) - delta;
        if (u.routeT <= 0) {
          u.routeT = 4 + Math.random() * 2;
          const rt = findPath(up.x, up.z, u.target.x, u.target.z, u.radius || 1, 16000, 70);
          if (rt.length) { u.route = rt; u.routeFor = { x: u.target.x, z: u.target.z }; }
        }
      }
      if (u.route && u.route.length) {
        const w = u.route[0];
        if (Math.hypot(w.x - up.x, w.z - up.z) < 1.0) u.route.shift();
        if (u.route.length) u.target.set(u.route[0].x, u.target.y, u.route[0].z);
      }
      const dir = new THREE.Vector3().subVectors(u.target, up);
      if (dir.length() > (isS?0.5:2)) {
        dir.normalize(); let nextPos = up.clone().add(dir.multiplyScalar(u.speed * delta)); tryMove(u,nextPos);
        if(!closestEnemy && u.turret) { u.mesh.rotation.y=Math.atan2(u.target.x-up.x,u.target.z-up.z); u.turret.rotation.set(0,0,0); } else if(!closestEnemy) { u.mesh.lookAt(u.target.x, up.y, u.target.z); }
      }
      else { u.manualTarget = false; u.playerOrder = false; u.route = null; }
    }
  }));
  updateProjectiles(delta);
}

/* ============ PROYECTILES ============ */
function fireProjectile(startPos, targetPos, colorHex, damage, team) {
  const mat=PM[colorHex]||(PM[colorHex]=new THREE.MeshBasicMaterial({color:colorHex}));
  const mesh = new THREE.Mesh(PG, mat);
  mesh.position.copy(startPos);
  scene.add(mesh);
  const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
  projectiles.push({ mesh: mesh, dir: dir, life: 2.0, damage: damage, team: team });
}

function updateProjectiles(delta) {
  for(let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.mesh.position.add(p.dir.clone().multiplyScalar(100 * delta));
    p.life -= delta;
    let hit = false;
    if(bulletBlocked(p.mesh.position)) hit = true;
    if(!hit) {
      aiHelis.concat(transports, boats, tanks, vehicles).forEach(target => {
        if(!hit && target.team !== p.team && target.hp > 0 && p.mesh.position.distanceTo(target.mesh.position) < (target.radius||2) + 1.5) {
          target.hp -= p.damage;
          if(target.hp <= 0) { target.isDead = true; if(target.bodyMat) target.bodyMat.color.setHex(0x1a1a1a); playSound('explosion'); }
          hit = true;
        }
      });
    }
    if (!hit && window.MejoraMundo) {
      const modTargets = (window.MejoraMundo.planes || []).concat(window.MejoraMundo.helis || []);
      modTargets.forEach(target => {
        if(!hit && target.team !== p.team && target.hp > 0 && !target.crashing && p.mesh.position.distanceTo(target.mesh.position) < 5) {
          target.hp -= p.damage;
          if(target.hp <= 0 && window.ModelosHD) window.ModelosHD.startCrash(target, target.type);
          hit = true;
        }
      });
    }
    if (!hit) {
      soldiers.forEach(s => {
        if(!hit && s.team !== p.team && s.hp > 0 && p.mesh.position.distanceTo(s.mesh.position) < 1.8) {
          s.hp -= p.damage;
          if(s.hp <= 0) { s.mesh.position.y = -0.5; s.respawnTimer = 0; }
          hit = true;
        }
      });
    }
    if(p.life <= 0 || hit) { scene.remove(p.mesh); projectiles.splice(i, 1); }
  }
}

/* ============ CÁMARA PRIMERA PERSONA ============ */
function fpCamera() {
  const on = directControlActive && directControlUnit;
  const want = on ? 70 : 45;
  if(camera.fov !== want){ camera.fov = want; camera.updateProjectionMatrix(); }
  document.body.classList.toggle('fp', !!on);
  if(!camera.parent) scene.add(camera);
  if(!fpGuns){
    fpGuns = {};
    const mk = ps => {
      const g = new THREE.Group();
      ps.forEach(p => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p[0],p[1],p[2]), new THREE.MeshBasicMaterial({color:p[6],depthTest:false}));
        m.position.set(p[3],p[4],p[5]); m.renderOrder = 1000; g.add(m);
      });
      g.visible = false; camera.add(g); return g;
    };
    fpGuns.pistol = mk([[0.08,0.10,0.50, 0.30,-0.30,-0.40, 0x232323],[0.06,0.06,0.14, 0.30,-0.30,-0.72, 0x0a0a0a],[0.08,0.26,0.14, 0.32,-0.46,-0.28, 0x2c2c2c],[0.05,0.04,0.10, 0.32,-0.38,-0.34, 0x101010],[0.14,0.16,0.14, 0.30,-0.44,-0.20, 0xd0aa86]]);
    fpGuns.rifle = mk([[0.10,0.16,0.85, 0.30,-0.28,-0.65, 0x222222],[0.06,0.06,0.35, 0.30,-0.26,-1.18, 0x0a0a0a],[0.12,0.14,0.35, 0.30,-0.28,-0.95, 0x2a2a2a],[0.08,0.24,0.14, 0.30,-0.48,-0.55, 0x2c2c2c],[0.10,0.14,0.22, 0.30,-0.28,-0.10, 0x1a1a1a],[0.05,0.06,0.05, 0.30,-0.20,-0.40, 0x0a0a0a],[0.04,0.10,0.04, 0.30,-0.19,-1.05, 0x0a0a0a],[0.14,0.16,0.14, 0.30,-0.44,-0.50, 0xd0aa86],[0.14,0.16,0.14, 0.30,-0.42,-1.00, 0xd0aa86]]);
    fpGuns.machinegun = mk([[0.16,0.22,1.05, 0.32,-0.28,-0.75, 0x161616],[0.09,0.09,0.55, 0.32,-0.24,-1.55, 0x0a0a0a],[0.14,0.14,0.40, 0.32,-0.24,-1.25, 0x2a2a2a],[0.26,0.26,0.14, 0.36,-0.50,-0.65, 0x333333],[0.14,0.20,0.28, 0.32,-0.28,-0.15, 0x1a1a1a],[0.16,0.18,0.16, 0.32,-0.44,-0.55, 0xd0aa86],[0.16,0.18,0.16, 0.32,-0.42,-1.10, 0xd0aa86]]);
    fpGuns.sniper = mk([[0.08,0.14,1.15, 0.30,-0.28,-0.85, 0x1a1a2a],[0.05,0.05,0.75, 0.30,-0.26,-1.65, 0x0a0a0a],[0.10,0.10,0.48, 0.30,-0.10,-0.88, 0x080808],[0.12,0.12,0.04, 0.30,-0.10,-1.15, 0x334466],[0.12,0.12,0.04, 0.30,-0.10,-0.62, 0x334466],[0.10,0.16,0.35, 0.30,-0.28,-0.10, 0x151515],[0.30,0.03,0.03, 0.30,-0.44,-1.45, 0x0a0a0a],[0.14,0.16,0.14, 0.30,-0.44,-0.60, 0xd0aa86]]);
    fpGuns.bazooka = mk([[0.26,0.26,1.55, 0.34,-0.20,-1.00, 0x3a5a3a],[0.38,0.38,0.28, 0.34,-0.20,-1.92, 0x2a3a2a],[0.32,0.32,0.15, 0.34,-0.20,-0.15, 0x1a1a1a],[0.08,0.24,0.12, 0.40,-0.44,-0.50, 0x101010],[0.06,0.14,0.06, 0.24,-0.28,-0.90, 0x101010],[0.06,0.14,0.06, 0.24,-0.28,-1.50, 0x101010],[0.14,0.16,0.14, 0.34,-0.42,-0.55, 0xd0aa86]]);
  }
  Object.values(fpGuns).forEach(g => { g.visible = false; g.rotation.set(0,0,0); g.position.set(0,0,0); });
  if(!on) return;
  const u = directControlUnit;
  if(u.hp <= 0){ toggleDirectControl(); return; }
  fpYaw += ((keys.e?1:0) - (keys.q?1:0)) * 0.04;
  if(u.hpGroup) u.hpGroup.visible = false;
  const p = u.mesh.position, cp = Math.cos(fpPitch);
  const f = new THREE.Vector3(Math.sin(fpYaw)*cp, Math.sin(fpPitch), -Math.cos(fpYaw)*cp);
  const cat = getUnitCategory(u);

  if(cat === 'soldier'){
    u.mesh.visible = false;
    const wIdx = u.weapon === undefined ? 1 : u.weapon;
    const w = WEAPONS[wIdx];
    const g = fpGuns[w.key];
    g.visible = true;
    if(u.reloadTimer > 0) {
      const t = 1 - u.reloadTimer / w.reload;
      const dip = Math.sin(Math.min(1, t) * Math.PI);
      g.rotation.x = -dip * 1.0;
      g.position.y = -dip * 0.45;
      g.position.z = dip * 0.18;
    }
    camera.position.set(p.x, 1.7, p.z);
    camera.lookAt(camera.position.x+f.x, camera.position.y+f.y, camera.position.z+f.z);
  } else if(cat === 'plane') {
    // ✈️ Cámara de cabina
    u.mesh.visible = true;
    const yaw = u.yaw !== undefined ? u.yaw : fpYaw;
    camera.position.set(
      p.x - Math.sin(yaw) * 2.5,
      p.y + 1.5,
      p.z - Math.cos(yaw) * 2.5
    );
    camera.lookAt(
      p.x + Math.sin(yaw) * 60,
      p.y + fpPitch * 25,
      p.z + Math.cos(yaw) * 60
    );
  } else if(cat === 'heli' || cat === 'heli_transport') {
    // 🚁 Cámara de heli (exterior, detrás)
    u.mesh.visible = true;
    const dist = 14;
    camera.position.set(
      p.x - Math.sin(fpYaw) * dist,
      p.y + 5,
      p.z + Math.cos(fpYaw) * dist
    );
    camera.lookAt(p.x, p.y, p.z);
  } else if(cat === 'boat') {
    // 🚢 Cámara de bote
    u.mesh.visible = true;
    const dist = 20;
    camera.position.set(
      p.x - Math.sin(fpYaw) * dist,
      p.y + 10,
      p.z + Math.cos(fpYaw) * dist
    );
    camera.lookAt(p.x, p.y + 1, p.z);
  } else if(cat === 'artillery') {
    // 💣 Artillería: cámara elevada para ver el arco
    u.mesh.visible = true;
    const dist = 20;
    camera.position.set(
      p.x - Math.sin(fpYaw) * dist,
      p.y + 10,
      p.z + Math.cos(fpYaw) * dist
    );
    camera.lookAt(
      p.x + Math.sin(fpYaw) * 60,
      1,
      p.z - Math.cos(fpYaw) * 60
    );
  } else {
    // 🚙 Vehículos terrestres (tank, apc, transport)
    u.mesh.visible = true;
    camera.position.set(p.x - Math.sin(fpYaw) * 9, 6, p.z + Math.cos(fpYaw) * 9);
    camera.lookAt(camera.position.x + f.x, camera.position.y + f.y, camera.position.z + f.z);
  }
  currentMouseWorld.copy(camera.position).addScaledVector(f, 150);
  cameraAngle = -fpYaw;
}

/* ============ TRANSPORTES ============ */
function createTransport(team,px,pz,color){
  const g=new THREE.Group(), mat=new THREE.MeshLambertMaterial({color:color}), dk=new THREE.MeshLambertMaterial({color:0x222222});
  const add=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); o.castShadow=true; g.add(o); return o;};
  add(3,2.6,7,mat,0,0,0); add(0.8,0.8,5,mat,0,0.6,-5.5); add(0.2,2,1.2,dk,0,1.4,-8); add(0.2,0.2,6,dk,-1.4,-1.6,0); add(0.2,0.2,6,dk,1.4,-1.6,0);
  const rotor=add(14,0.1,0.5,dk,0,1.9,0);
  g.position.set(px,1.5,pz); scene.add(g);
  const h={type:'transport',mesh:g,rotor:rotor,team:team,hp:700,maxHp:700,radius:4,speed:20,pad:new THREE.Vector3(px,0,pz),state:'board',timer:0,pickT:0,unT:0,boarders:[],cargo:[],dest:new THREE.Vector3(),isDead:false,respawnTimer:0};
  g.userData = h;
  addHealthBar(h,4.5,4); transports.push(h);
}

function pickDrop(team){ const sg=team==='ally'?-1:1; for(let i=0;i<15;i++){ const v=new THREE.Vector3((Math.random()-0.5)*120,0,sg*(8+Math.random()*42)); if(!isColliding(v,10)) return v; } return new THREE.Vector3(35,0,0); }

function updateTransports(dt){
  transports.forEach(h=>{
    // ⚠️ NO aplicar IA si el jugador lo controla
    if (directControlActive && directControlUnit === h) return;

    const P=h.mesh.position;
    if(h.isDead||h.hp<=0){ h.isDead=true;
      h.cargo.forEach(s=>{s.inHeli=null;s.hp=0;s.mesh.visible=true;s.mesh.position.y=-0.5;s.respawnTimer=0;}); h.cargo=[]; h.boarders=[];
      h.respawnTimer+=dt; h.mesh.visible=false;
      if(h.respawnTimer>20){h.hp=h.maxHp;h.isDead=false;h.respawnTimer=0;h.mesh.visible=true;P.set(h.pad.x,1.5,h.pad.z);h.state='board';h.timer=0;}
      return; }
    h.rotor.rotation.y+=(h.state==='board'?10:45)*dt;
    const fly=(t,sp)=>{const dx=t.x-P.x,dz=t.z-P.z,L=Math.hypot(dx,dz); if(L>0.5){const m=Math.min(L,sp*dt)/L; P.x+=dx*m; P.z+=dz*m; if(L>4) h.mesh.rotation.y=Math.atan2(dx,dz);} return L;};
    const climb=(y,sp)=>{const d=y-P.y; P.y+=Math.sign(d)*Math.min(Math.abs(d),sp*dt); return Math.abs(y-P.y)<0.05;};
    switch(h.state){
      case 'board': {
        h.timer+=dt;
        if(!h.boarders.length){ h.pickT-=dt; if(h.pickT<=0){ h.pickT=2; h.timer=0;
          h.boarders=soldiers.filter(s=>s.team===h.team&&!s.marine&&s.hp>0&&!s.isDead&&!s.inHeli&&!s.manualTarget&&!selectedUnits.includes(s)&&s!==directControlUnit&&Math.hypot(s.mesh.position.x-h.pad.x,s.mesh.position.z-h.pad.z)<70).sort((a,b)=>a.mesh.position.distanceTo(P)-b.mesh.position.distanceTo(P)).slice(0,4); }
          break; }
        h.boarders=h.boarders.filter(s=>s.hp>0&&!s.isDead&&!selectedUnits.includes(s)&&!s.manualTarget&&s!==directControlUnit);
        h.boarders.forEach(s=>{ if(s.inHeli) return; s.target.set(P.x,1,P.z);
          if(Math.hypot(s.mesh.position.x-P.x,s.mesh.position.z-P.z)<4.5){ s.inHeli=h; s.mesh.visible=false; h.cargo.push(s); } });
        const wait=h.boarders.filter(s=>!s.inHeli).length;
        if(h.cargo.length&&(wait===0||h.timer>15)) h.state='lift';
        else if(!h.cargo.length&&(h.timer>15||!h.boarders.length)) h.boarders=[];
        break; }
      case 'lift': if(climb(24,9)){ h.dest=pickDrop(h.team); h.state='fly'; } break;
      case 'fly': if(fly(h.dest,20)<2) h.state='land'; break;
      case 'land': if(climb(1.5,6)){ h.state='unload'; h.unT=0.5; h.timer=0; } break;
      case 'unload': h.unT-=dt;
        if(h.unT<=0&&h.cargo.length){ const s=h.cargo.pop(); s.inHeli=null; s.mesh.visible=true; const a=Math.random()*6.28;
          s.mesh.position.set(P.x+Math.cos(a)*6,1,P.z+Math.sin(a)*6); s.target.set((Math.random()-0.5)*24,1,(Math.random()-0.5)*24); s.manualTarget=false; h.unT=0.4; }
        if(!h.cargo.length){ h.timer+=dt; if(h.timer>2.5) h.state='lift2'; } break;
      case 'lift2': if(climb(24,9)) h.state='return'; break;
      case 'return': if(fly(h.pad,20)<2) h.state='land2'; break;
      case 'land2': if(climb(1.5,6)){ h.state='board'; h.boarders=[]; h.timer=0; h.pickT=0; } break;
    }
  });
}

/* ============ ATAQUE AÉREO ============ */
function callAirstrike(tp) {
  const dir=new THREE.Vector3(Math.cos(cameraAngle),0,-Math.sin(cameraAngle)), perp=new THREE.Vector3(dir.z,0,-dir.x);
  const ring=new THREE.Mesh(new THREE.RingGeometry(10,12,32),new THREE.MeshBasicMaterial({color:0xff2200,side:THREE.DoubleSide,transparent:true,opacity:0.8}));
  ring.rotation.x=-Math.PI/2; ring.position.set(tp.x,0.3,tp.z); scene.add(ring);
  const T=Math.sqrt(2*37.5/70);
  for(let k=0;k<2;k++){
    const mat=new THREE.MeshLambertMaterial({color:0x4a5560}), jet=new THREE.Group();
    const part=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=true; jet.add(m);};
    part(2.4,2,14,0,0,0); part(18,0.4,4,0,0,1); part(0.4,3,3,0,2,5); part(7,0.4,2,0,0,5.5);
    jet.scale.setScalar(1.6);
    const lat=k?16:-16, tpj=tp.clone().addScaledVector(perp,lat);
    jet.position.copy(tpj).addScaledVector(dir,-(200+k*40)); jet.position.y=40;
    jet.rotation.y=Math.atan2(dir.x,dir.z); scene.add(jet);
    jets.push({jet:jet,dir:dir,tp:tpj,bombsLeft:5,nextBomb:0,lead:95*T,ring:k?null:ring});
  }
}

function updateJets(dt) {
  for(let i=jets.length-1;i>=0;i--){ const j=jets[i];
    j.jet.position.addScaledVector(j.dir,95*dt); j.nextBomb-=dt;
    const s=new THREE.Vector3().subVectors(j.jet.position,j.tp).dot(j.dir);
    if(s>-j.lead-20 && j.bombsLeft>0 && j.nextBomb<=0){ j.bombsLeft--; j.nextBomb=0.1;
      const b=new THREE.Mesh(new THREE.SphereGeometry(1.1,8,8),new THREE.MeshBasicMaterial({color:0x111111}));
      b.position.copy(j.jet.position); b.position.y-=2; scene.add(b); bombs.push({mesh:b,vy:0,vx:j.dir.clone().multiplyScalar(95)}); playSound('shot'); }
    if(s>260){ scene.remove(j.jet); if(j.ring) scene.remove(j.ring); jets.splice(i,1); } }
  for(let i=bombs.length-1;i>=0;i--){ const b=bombs[i]; b.vy-=70*dt;
    b.mesh.position.addScaledVector(b.vx,dt); b.mesh.position.y+=b.vy*dt;
    if(b.mesh.position.y<=0.5){ spawnExplosion(new THREE.Vector3(b.mesh.position.x,0.5,b.mesh.position.z)); scene.remove(b.mesh); bombs.splice(i,1); } }
}

function spawnExplosion(pos) {
  playSound('explosion');
  const blast = new THREE.Mesh((window.__BG||(window.__BG=new THREE.SphereGeometry(6,10,8))), new THREE.MeshBasicMaterial({color: 0xff6600, transparent:true, opacity:0.9}));
  blast.position.copy(pos); scene.add(blast);
  soldiers.concat(vehicles, tanks, boats).forEach(u => {
    if(u.hp > 0 && u.mesh.position.distanceTo(pos) < 14) {
      u.hp -= 400;
      if(u.hp <= 0 && u.bodyMat) u.bodyMat.color.setHex(0x1a1a1a);
      if(u.hp <= 0 && u.type==='soldier') { u.mesh.position.y = -0.5; u.respawnTimer = 0; }
    }
  });
  let s = 1;
  const anim = setInterval(() => { s += 0.3; blast.scale.set(s,s,s); blast.material.opacity -= 0.1; if(blast.material.opacity <= 0) { scene.remove(blast); clearInterval(anim); } }, 30);
}

/* ============ LOOP PRINCIPAL ============ */
function animate() {
  requestAnimationFrame(animate);
  const rawD = clock.getDelta(), delta = Math.min(rawD, 0.05);
  perfAdapt(rawD);
  if(directControlActive && directControlUnit) {
    cameraTarget.lerp(directControlUnit.mesh.position, 0.1);
  } else {
    const speed = 50 * delta;
    let rightX = Math.cos(cameraAngle), rightZ = -Math.sin(cameraAngle);
    let fwdX = Math.sin(cameraAngle), fwdZ = Math.cos(cameraAngle);
    if (keys.w) { cameraTarget.x -= fwdX * speed; cameraTarget.z -= fwdZ * speed; }
    if (keys.s) { cameraTarget.x += fwdX * speed; cameraTarget.z += fwdZ * speed; }
    if (keys.a) { cameraTarget.x -= rightX * speed; cameraTarget.z -= rightZ * speed; }
    if (keys.d) { cameraTarget.x += rightX * speed; cameraTarget.z += rightZ * speed; }
  }
  if (keys.q) cameraAngle -= 2 * delta;
  if (keys.e) cameraAngle += 2 * delta;
  if(directControlActive && directControlUnit && directControlUnit.type === 'soldier') {
    const u = directControlUnit;
    const w = WEAPONS[u.weapon === undefined ? 1 : u.weapon];
    if(u.reloadTimer > 0) { u.reloadTimer -= delta; if(u.reloadTimer <= 0) { u.reloadTimer = 0; u.ammo = w.mag; } }
    if(u.heat > 0) { u.heat = Math.max(0, u.heat - 40*delta); if(u.overheated && u.heat < 40) u.overheated = false; }
    if(window.__firing && w.auto && u.cooldown <= 0 && u.reloadTimer <= 0 && !u.overheated && (u.ammo === undefined || u.ammo > 0)) fireDirect();
    updateWeaponBar();
  }
  // Cooldown de aviones/helis disparando en control directo
  if (directControlActive && directControlUnit) {
    const u = directControlUnit;
    if (u.cooldown > 0) u.cooldown -= delta;
    if (u.missileCooldown > 0) u.missileCooldown -= delta;
    if (u.cd > 0) u.cd -= delta;
    if (u._playerCd > 0) u._playerCd -= delta;
  }
  cameraPitch += ((directControlActive?0.55:1)-cameraPitch)*0.1;
  document.getElementById('touch').style.display = directControlActive ? 'block' : 'none';
  updateJets(delta);
  updateCameraPosition();
  updateAI(delta);
  updateDirectControlVehicle(delta);
  fpCamera();

  /* ====== HOOK DE MODS ====== */
  if (window.IronfrontAPI && typeof window.IronfrontAPI.onUpdate === 'function') {
    try { window.IronfrontAPI.onUpdate(delta); } catch(e) { console.error('Error en mod onUpdate:', e); }
  }

  renderer.render(scene, camera);
}