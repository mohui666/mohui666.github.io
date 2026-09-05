import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsEngine, G, LIGHT_SPEED } from '../src/physics.js';
import { createPreset } from '../src/presets.js';
const norm = v => Math.hypot(...v);
const delta = (a,b) => norm(a.map((x,k)=>x-b[k]));
const body = (id,mass,radius,position,velocity) => ({id,name:id,mass,radius,position,velocity,color:'#aabbcc'});

test('EIH relative acceleration agrees with the independent finite-mass 1PN binary formula', () => {
  const m1=1,m2=.4,M=m1+m2,eta=m1*m2/M**2,r=1.7,n=[1,0,0],v=[.8,4.1,.3];
  const bodies=[body('a',m1,.001,n.map(x=>x*r*m2/M),v.map(x=>x*m2/M)),body('b',m2,.001,n.map(x=>-x*r*m1/M),v.map(x=>-x*m1/M))];
  const engine=new PhysicsEngine(bodies,{collisionMode:'none'});
  const a=engine._accelerations(Float64Array.from(bodies.flatMap(b=>b.position)));
  const relative=[a[0]-a[3],a[1]-a[4],a[2]-a[5]],mu=G*M;
  const expected=n.map((x,k)=>-mu/r**2*x+mu/(r**2*LIGHT_SPEED**2)*(((4+2*eta)*mu/r-(1+3*eta)*norm(v)**2+1.5*eta*v[0]**2)*x+(4-2*eta)*v[0]*v[k]));
  assert.ok(delta(relative,expected)<2e-14);
});

test('Mercury perihelion advance agrees with 6 pi GM / [a (1-e²) c²]', () => {
  const a=.38709927,e=.20563593,r=a*(1-e),v=Math.sqrt(G*(1+e)/r),period=2*Math.PI*Math.sqrt(a**3/G);
  const bodies=[body('sun',1,.00465,[0,0,0],[0,0,0]),body('mercury',1e-14,0,[r,0,0],[0,v,0])];
  const run=gravityModel=>{
    const engine=new PhysicsEngine(bodies,{gravityModel,integrator:'rk4',collisionMode:'none'});
    for(let i=0;i<8000;i++)engine.step(period/8000);
    const b=engine.bodies[1],R=norm(b.position),[x,y]=b.position,[vx,vy]=b.velocity,h=x*vy-y*vx;
    return Math.atan2(-vx*h/G-y/R,vy*h/G-x/R);
  };
  const observed=run('gr1pn')-run('newtonian'),expected=6*Math.PI*G/(a*(1-e*e)*LIGHT_SPEED**2);
  assert.ok(Math.abs(observed/expected-1)<1e-4);
  console.log(`Mercury GR excess: ${(observed*180/Math.PI*3600*100/period).toFixed(6)} arcsec/century; relative formula error ${Math.abs(observed/expected-1).toExponential(3)}`);
});

test('the complete 1PN solar system preserves EIH energy and canonical momenta for one year', () => {
  const initial=createPreset('solar'),engine=new PhysicsEngine(initial.bodies,initial.params),before=engine.diagnostics();
  let maxError=0;
  for(let i=0;i<20000;i++){
    engine.step();
    if(i%50===0)maxError=Math.max(maxError,Math.abs(engine.diagnostics().energyError));
  }
  const after=engine.diagnostics();
  assert.equal(engine.params.gravityModel,'gr1pn');
  assert.equal(engine.bodies.length,10);
  assert.ok(maxError<1e-9);
  assert.ok(delta(after.momentum,before.momentum)<1e-12);
  assert.ok(delta(after.angularMomentum,before.angularMomentum)<1e-12);
  const earth=engine.bodies.findIndex(b=>b.id==='earth');
  assert.ok(after.clockRates[earth]<1&&after.clockRates[earth]>.99999);
  console.log(`EIH solar system: max energy change ${maxError.toExponential(3)}; canonical P change ${delta(after.momentum,before.momentum).toExponential(3)}`);
});

test('paused overlaps resolve at the same time, and mass edits do not set radii', () => {
  const a=body('sun',1,.00465,[0,0,0],[0,0,0]),b=body('planet',1e-6,.00004,[.003,0,0],[0,6,0]);
  const engine=new PhysicsEngine([a,b]);
  const radius=engine.bodies[1].radius;
  engine.bodies[1].mass=.001;
  assert.equal(engine.bodies[1].radius,radius);
  engine.resetReference();const before=engine.diagnostics();engine.resolveContacts();
  assert.equal(engine.time,0);assert.equal(engine.bodies.length,1);assert.equal(engine.collisionCount,1);
  assert.ok(Math.abs(engine.bodies[0].radius**3-(a.radius**3+b.radius**3))<1e-20);
  assert.ok(delta(engine.diagnostics().momentum,before.momentum)<1e-14);
  assert.ok(delta(engine.diagnostics().angularMomentum,before.angularMomentum)<1e-14);
});

test('1PN swept contacts catch a fast crossing, but a separated 3D projection does not collide', () => {
  for(const z of [0,.003]){
    const engine=new PhysicsEngine([body('a',1e-7,.001,[-.1,0,0],[1000,0,0]),body('b',1e-7,.001,[.1,0,z],[-1000,0,0])],{collisionMode:'merge'});
    engine.step(.0002);
    assert.equal(engine.collisionCount,z===0?1:0);
    assert.equal(engine.time,.0002);
  }
});

test('Earth falls into the Sun in the full 1PN solar system at both fine and coarse requested steps', () => {
  const contacts=[];
  for(const dt of [.00005,.005]){
    const initial=createPreset('solar'),earth=initial.bodies.find(b=>b.id==='earth'),sun=initial.bodies.find(b=>b.id==='sun');
    earth.velocity=[...sun.velocity];
    const engine=new PhysicsEngine(initial.bodies,{...initial.params,dt});let event;
    while(engine.time<.3&&!event){engine.step();event=engine.events.find(e=>e.names.includes('太阳')&&e.names.includes('地球'));}
    assert.ok(event);assert.equal(event.reason,'stellar-accretion');
    assert.equal(engine.bodies.some(b=>b.id==='earth'),false);
    assert.ok(Math.abs(engine.bodies.find(b=>b.id==='sun').mass-(sun.mass+earth.mass))<1e-14);
    contacts.push(event.time);
  }
  assert.ok(Math.abs(contacts[1]-contacts[0])<1e-7);
  console.log(`Earth–Sun contact: ${contacts[0].toFixed(9)} yr; 100x requested-step change shifts contact by ${(Math.abs(contacts[1]-contacts[0])*31557600).toFixed(3)} s`);
});
