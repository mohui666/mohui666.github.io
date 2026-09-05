import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { textureUrls } from './surfaces.js';

const v3 = a => new THREE.Vector3(...a);
export class UniverseView {
  constructor(host, onSelect) {
    this.host = host;
    this.onSelect = onSelect;
    this.settings = { trails:true, references:true, labels:true, grid:true, vectors:false, bodyScale:1, trailLength:900 };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#080e16');
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.00001, 1e7);
    this.camera.up.set(0, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.host.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 0.001;
    this.controls.maxDistance = 100000;
    this.controls.enablePan = true;
    this.scene.add(new THREE.AmbientLight('#d9e5ff', .8));
    this.sunlight = new THREE.PointLight('#fff0d3', 2.3, 0, 0);
    this.scene.add(this.sunlight);
    const fill = new THREE.DirectionalLight('#c8dcff', .9);
    fill.position.set(-3, -5, 10);
    this.scene.add(fill);
    this.items = new Map();
    const loader=new THREE.TextureLoader();this.surfaceMaps=new Map();
    for(const [id,url] of Object.entries(textureUrls)){const texture=loader.load(url,undefined,undefined,()=>{const notice=document.createElement('div');notice.className='texture-warning';notice.textContent=`${id} 表面图加载失败，请刷新检查网络。`;host.append(notice);});texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.surfaceMaps.set(id,texture);}
    this.sphere = new THREE.SphereGeometry(1, 32, 24);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'celestial-labels';
    this.host.append(this.labelLayer);
    this.glowMap = this.makeGlow();
    this.makeStars();
    const positions = new Float32Array([-1,0,0,1,0,0,0,-1,0,0,1,0]);
    this.cross = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3)), new THREE.LineBasicMaterial({color:'#6e9caa',transparent:true,opacity:0.4}));
    this.scene.add(this.cross);
    this.selectedRing = new THREE.Mesh(new THREE.RingGeometry(1.45,1.49,72),new THREE.MeshBasicMaterial({color:'#b4eddb',side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:0.9}));
    this.selectedRing.renderOrder = 10;
    this.scene.add(this.selectedRing);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    let down;
    this.renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if (!down || Math.hypot(e.clientX-down[0],e.clientY-down[1])>5) return;
      const r=this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const hits=this.raycaster.intersectObjects([...this.items.values()].map(i=>i.mesh).filter(mesh=>mesh.visible));
      if(hits.length) this.onSelect(hits[0].object.userData.bodyId);
    });
    this.frame(6);
  }
  resize() {
    const {width,height} = this.host.getBoundingClientRect();
    if(!width || !height) return;
    this.renderer.setSize(width,height);
    const oldFactor=Math.max(1,1/this.camera.aspect),newFactor=Math.max(1,height/width);
    this.camera.position.sub(this.controls.target).multiplyScalar(newFactor/oldFactor).add(this.controls.target);
    this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
    this.width=width;this.height=height;
  }
  makeGlow() {
    const c=document.createElement('canvas');c.width=c.height=128;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0,'rgba(255,241,208,1)');g.addColorStop(.12,'rgba(255,197,113,.65)');g.addColorStop(.3,'rgba(255,160,63,.14)');g.addColorStop(1,'rgba(255,126,45,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    return new THREE.CanvasTexture(c);
  }
  makeStars() {
    const positions=[],colors=[];let seed=5674;
    const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<2400;i++) {
      const az=rand()*Math.PI*2, z=rand()*2-1, s=Math.sqrt(1-z*z),r=20000;
      positions.push(r*s*Math.cos(az),r*s*Math.sin(az),r*z);
      const b=.2+rand()*.6;colors.push(b*.8,b*.9,b);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.stars=new THREE.Points(geo,new THREE.PointsMaterial({size:1.4,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.8,depthWrite:false}));
    this.scene.add(this.stars);
  }
  frame(scale=6, top=false) {
    this.viewScale=scale;
    const distanceScale=scale*Math.max(1,1/this.camera.aspect);
    this.controls.target.set(0,0,0);
    if(top)this.camera.position.set(0,-.001*distanceScale,distanceScale*2.8);
    else this.camera.position.set(distanceScale*.22,-distanceScale*2.2,distanceScale*1.65);
    this.camera.lookAt(0,0,0);this.controls.update();
    this.makeGrid(scale);
    this.followId=null;
  }
  makeGrid(scale) {
    if(this.grid){this.scene.remove(this.grid);this.grid.geometry.dispose();this.grid.material.dispose();}
    const step=10**Math.floor(Math.log10(scale/4));
    this.grid=new THREE.GridHelper(step*40,40,'#18333f','#122430');
    this.grid.rotation.x=Math.PI/2;
    this.grid.material.transparent=true;this.grid.material.opacity=.45;
    this.grid.position.z=-.005*scale;
    this.scene.add(this.grid);
    this.gridStep=step;
  }
  focus(body, close=false) {
    const p=v3(body.position),offset=this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(p);
    if(close)offset.set(.12,-1,.7).normalize().multiplyScalar(Math.max(body.radius*1000,.05));
    this.camera.position.copy(p).add(offset);this.followId=body.id;
  }
  clearTrails() {
    this.items.forEach(item=>{item.history=[];item.trail.geometry.setDrawRange(0,0);});
  }
  sync(bodies, record=false) {
    const ids=new Set(bodies.map(b=>b.id));
    for(const [id,item] of this.items) if(!ids.has(id)) {
      this.scene.remove(item.mesh,item.glow,item.trail,item.reference,item.arrow);
      item.mesh.material.dispose();item.trail.geometry.dispose();item.trail.material.dispose();
      if(item.ring){item.ring.geometry.dispose();item.ring.material.dispose();}
      if(item.reference){item.reference.geometry.dispose();item.reference.material.dispose();}
      if(item.glow)item.glow.material.dispose();
      item.label.remove();this.items.delete(id);
    }
    let biggest=bodies.reduce((a,b)=>!a||b.mass>a.mass?b:a,null);
    if(biggest)this.sunlight.position.fromArray(biggest.position);
    const labelCandidates=[];
    for(const b of bodies) {
      let item=this.items.get(b.id);
      if(!item){
        const luminous=b.mass>.08;
        const map=this.surfaceMaps.get(b.id) ?? null;
        const material=luminous?new THREE.MeshBasicMaterial({color:map?'#fff':b.color,map}):new THREE.MeshStandardMaterial({color:map?'#fff':b.color,map,roughness:.95,metalness:0});
        const mesh=new THREE.Mesh(this.sphere,material);mesh.userData.bodyId=b.id;
        // Textured surfaces and ring tilt illustrate appearance; spin dynamics are not simulated.
        mesh.rotation.x=Math.PI/2;
        mesh.rotation.y=.6;
        let ring=null;
        if(b.id==='saturn'){
          const geometry=new THREE.RingGeometry(1.35,2.3,128,6);
          const colors=[];const pos=geometry.attributes.position;
          for(let j=0;j<pos.count;j++){const r=Math.hypot(pos.getX(j),pos.getY(j));const c=new THREE.Color(r>1.95&&r<2.08?'#514b3f':r<1.6?'#908476':'#d8c9a0');colors.push(c.r,c.g,c.b);}
          geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
          ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.75}));ring.rotation.x=Math.PI/2+.466;ring.userData.bodyId=b.id;mesh.add(ring);
        }
        const label=document.createElement('button');label.className='body-label';label.onclick=()=>this.onSelect(b.id);this.labelLayer.append(label);
        const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:b.color,transparent:true,opacity:.7,vertexColors:true}));
        const cap=2401;trail.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(cap*3),3));trail.geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(cap*3),3));trail.geometry.setDrawRange(0,0);trail.frustumCulled=false;
        let glow=null;
        if(luminous){glow=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,color:b.color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.scene.add(glow);}
        let reference=null;
        if(b.referenceOrbit){reference=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(b.referenceOrbit.map(v3)),new THREE.LineBasicMaterial({color:b.color,transparent:true,opacity:.16}));this.scene.add(reference);}
        const arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),1,b.color);this.scene.add(arrow);
        item={mesh,label,glow,trail,history:[],reference,arrow,ring};
        this.items.set(b.id,item);this.scene.add(mesh,trail);
      }
      item.mesh.position.fromArray(b.position);item.label.textContent=b.name;
      item.mesh.material.color.set(this.surfaceMaps.has(b.id)&&(!b.originalColor||b.originalColor===b.color)?'#ffffff':b.color);item.trail.material.color.set(b.color);
      item.label.style.setProperty('--body-color',b.color);
      const distance=this.camera.position.distanceTo(item.mesh.position);
      const worldPixel=distance*2*Math.tan(this.camera.fov*Math.PI/360)/Math.max(this.height,1);
      const isolated=this.settings.isolateId;
      const radius=Math.max(b.radius,worldPixel*(isolated===b.id?Math.min(this.height*.17,this.width*.24):b.mass>.08?9:4.4)*this.settings.bodyScale);
      const shown=!isolated||isolated===b.id;
      item.mesh.visible=shown;
      item.mesh.scale.setScalar(radius);
      if(item.glow){item.glow.visible=shown;item.glow.position.copy(item.mesh.position);item.glow.scale.setScalar(radius*12);}
      if(record){
        item.history.push([...b.position]);if(item.history.length>this.settings.trailLength)item.history.splice(0,item.history.length-this.settings.trailLength);
        const pos=item.trail.geometry.attributes.position, col=item.trail.geometry.attributes.color;
        const n=item.history.length;
        for(let i=0;i<n;i++){pos.setXYZ(i,...item.history[i]);const fade=.05+.95*i/n;col.setXYZ(i,fade,fade,fade);}
        pos.needsUpdate=true;col.needsUpdate=true;item.trail.geometry.setDrawRange(0,n);
      }
      item.trail.visible=this.settings.trails&&shown&&!isolated;
      if(item.reference){item.reference.visible=this.settings.references&&shown&&!isolated;const center=bodies.find(x=>x.id===b.referenceCenterId);if(center&&b.referenceCenter)item.reference.position.fromArray(center.position.map((x,i)=>x-b.referenceCenter[i]));}
      item.arrow.visible=this.settings.vectors&&shown;
      if(this.settings.vectors){const vel=v3(b.velocity);item.arrow.position.fromArray(b.position);if(vel.length()>0){item.arrow.setDirection(vel.clone().normalize());const len=Math.min(vel.length()*.035,this.viewScale*.6);item.arrow.setLength(len,len*.16,len*.07);}else item.arrow.visible=false;}
      const projected=item.mesh.position.clone().project(this.camera);
      const onScreen=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1;
      item.label.hidden=!this.settings.labels||!onScreen||!shown||(bodies.length>25&&b.id!==this.selectedId&&b!==biggest);
      item.label.style.transform=`translate(${(projected.x+1)*this.width/2+radius/worldPixel+7}px,${(1-projected.y)*this.height/2-7}px)`;
      item.label.classList.toggle('selected',b.id===this.selectedId);
      if(!item.label.hidden)labelCandidates.push({item,b,x:(projected.x+1)*this.width/2+radius/worldPixel+7,y:(1-projected.y)*this.height/2-7,w:b.name.length*10+18});
    }
    const occupied=[];
    labelCandidates.sort((a,b)=>(b.b.id===this.selectedId)-(a.b.id===this.selectedId)||b.b.mass-a.b.mass).forEach(c=>{const overlap=occupied.some(o=>c.x<o.x+o.w+4&&c.x+c.w+4>o.x&&Math.abs(c.y-o.y)<19);if(overlap)c.item.label.hidden=true;else occupied.push(c);});
    this.grid.visible=this.settings.grid&&!this.settings.isolateId;
    const selected=this.items.get(this.selectedId);
    this.selectedRing.visible=!!selected;
    if(selected){this.selectedRing.position.copy(selected.mesh.position);this.selectedRing.scale.copy(selected.mesh.scale);this.selectedRing.quaternion.copy(this.camera.quaternion);}
    if(this.followId){const item=this.items.get(this.followId);if(item){const offset=this.camera.position.clone().sub(this.controls.target);this.controls.target.copy(item.mesh.position);this.camera.position.copy(item.mesh.position).add(offset);}else this.followId=null;}
    this.cross.scale.setScalar(this.viewScale*.016);
    this.cross.visible=this.settings.grid&&!this.settings.isolateId;
  }
  render() {this.controls.update();this.stars.position.copy(this.camera.position);this.renderer.render(this.scene,this.camera);}
  select(id) {this.selectedId=id;}
  snapshot() {return this.renderer.domElement.toDataURL('image/png');}
}
