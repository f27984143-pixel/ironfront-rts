RF.register('trucks', {
  list: [],
  _t: 0,

  init(){
    const make = (team, kind, x, z) => {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({color: TEAMC[team]});
      const dark = new THREE.MeshLambertMaterial({color: 0x222222});
      const isMed = kind === 'medical';

      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4,2.2,2.6), bodyMat);
      cab.position.set(0,1.6,3); cab.castShadow = true; g.add(cab);

      const cargo = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, isMed ? 2.6 : 2.4, 5.5),
        isMed ? new THREE.MeshLambertMaterial({color:0xe8e8e8}) : dark
      );
      cargo.position.set(0, isMed ? 1.8 : 1.7, -1); cargo.castShadow = true; g.add(cargo);

      if(isMed){
        const red = new THREE.MeshLambertMaterial({color: 0xd32f2f});
        const h = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.4,0.05), red);
        h.position.set(0, 2, 1.76); g.add(h);
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.4,1.6,0.05), red);
        v.position.set(0, 2, 1.76); g.add(v);
      }

      const wm = new THREE.MeshLambertMaterial({color:0x111111});
      const wg = new THREE.CylinderGeometry(0.65,0.65,0.55,12);
      [[-1.5,3],[1.5,3],[-1.5,-1.5],[1.5,-1.5],[-1.5,-3.2],[1.5,-3.2]].forEach(([wx,wz])=>{
        const wh = new THREE.Mesh(wg, wm);
        wh.rotation.z = Math.PI/2;
        wh.position.set(wx, 0.65, wz); wh.castShadow = true; g.add(wh);
      });

      g.position.set(x, 0, z); scene.add(g);
      const unit = {
        type:'truck', kind, mesh:g, team,
        hp: 300, maxHp: 300, radius: 2.5,
        cooldown: 999, isDead: false, healT: 0
      };
      g.userData = unit;
      if(team === 'ally') addSelectionMarker(unit, 3.7, 4);
      addHealthBar(unit, 3.6, 3);
      vehicles.push(unit);
      return unit;
    };

    this.list = [
      make('ally',  'medical',    20, -50),
      make('ally',  'transport', -20, -50),
      make('enemy', 'medical',    20,  50),
      make('enemy', 'transport', -20,  50)
    ];
    console.log('[trucks] ' + this.list.length + ' camiones');
  },

  update(dt){
    this._t -= dt;
    if(this._t > 0) return;
    this._t = 0.6;
    for(const t of this.list){
      if(t.isDead || t.hp <= 0 || t.kind !== 'medical') continue;
      const P = t.mesh.position;
      for(const s of soldiers){
        if(s.team !== t.team || s.hp <= 0) continue;
        if(Math.hypot(s.mesh.position.x-P.x, s.mesh.position.z-P.z) < 14 && s.hp < s.maxHp)
          s.hp = Math.min(s.maxHp, s.hp + 12);
      }
    }
  },

  dispose(){
    for(const t of this.list){
      if(t.mesh.parent) t.mesh.parent.remove(t.mesh);
      if(t.hpGroup && t.hpGroup.parent) t.hpGroup.parent.remove(t.hpGroup);
      const i = vehicles.indexOf(t);
      if(i >= 0) vehicles.splice(i, 1);
    }
    this.list = [];
  }
});
