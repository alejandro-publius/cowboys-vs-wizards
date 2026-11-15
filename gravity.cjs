// Rigid body simulation shared by the browser and the scenario checks.
// Rapier JavaScript 0.12: https://rapier.rs/docs/user_guides/javascript/
const STEP=1/60;
const GRAVITY=10.8;
const blend=(a,b,x)=>a+(b-a)*x;
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const plus=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const len=(v)=>Math.hypot(v.x,v.y,v.z);
const norm=(v)=>mul(v,1/Math.max(.001,len(v)));
const point=(x,y,z)=>({x,y,z});
function random(seed) {
  return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
}

function debrisLayout(){
  const specs=[];
  const rng=random(182);
  const piece=(x,y,z,hx,hy,hz,wood=false,shade=rng())=>
    specs.push({p:point(x,y,z),h:point(hx,hy,hz),wood,shade});
  for (const side of [-1,1]){
    for(let y=0;y<7;y++) for(let x=0;x<3;x++) for(let z=0;z<2;z++)
      piece(side*2.48+(x-1)*.42+(y%2?.058:0),.181+y*.371,
            -1.97+(z-.5)*.45,.201,.178,.217);
    for(let i=0;i<4;i++)
      piece(side*2.48-.6+i*.40,2.777,-1.98,.185,.201,.465);
    for(let i=0;i<7;i++)
      piece(side*(3.22+i*.385),rng()*.11+.345,-2.43,.081,.34,.086,true);
    for(let i=0;i<4;i++)for(let y=0;y<2;y++)
      piece(side*(3.48+i*.70),.282+y*.285,-2.47,.337,.049,.047,true);
  }
  for(let i=0;i<10;i++){
    const x=-1.66+i*.368;
    for(let j=0;j<3;j++)piece(x,.40+j*.80,-1.965,.172,.392,.081,true);
    piece(x,2.53,-1.98,.173,.256,.102,true);
  }
  for(const y of [.61,1.65,2.80])
    for(let x=0;x<6;x++)piece(-1.73+x*.69,y,-1.83,.333,.058,.049,true);
  for(const [x,z] of [[-3.7,-.80],[3.20,-.47],[3.72,-4.05],[-4.36,-3.24]]){
    for(const off of [-.317,.317]){
      for(let a=0;a<4;a++){
        piece(x+(a-1.5)*.155,.337,z+off,.072,.333,.034,true);
        piece(x+off,.337,z+(a-1.5)*.155,.029,.333,.071,true);
      }
    }
    for(let a=0;a<4;a++) piece(x+(a-1.5)*.152,.702,z,.069,.025,.33,true);
  }
  return specs;
}
function createSimulation(R,{layout=debrisLayout(),floorY=0,sheriffHome=point(-3.78,0,-.54)}={}){
  const rng=random(8621);
  const world=new R.World({x:0,y:-GRAVITY,z:0});
  world.timestep=STEP;
  const ground=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,floorY-.185,0));
  world.createCollider(R.ColliderDesc.cuboid(54,.185,55).setFriction(.82),ground);
  const pieces=layout.map(spec=>{
    const {p,h,wood}=spec;
    const body=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x,p.y,p.z));
    world.createCollider(R.ColliderDesc.cuboid(h.x,h.y,h.z)
      .setDensity(wood?.53:1.84).setRestitution(wood?.29:.20).setFriction(.74),body);
    return {...spec,body,dynamic:false,heat:0};
  });
  const sheriff={position:{...sheriffHome},strike:0,pull:0,hitDirection:1,aim:0,nextShot:-1,shots:0};
  const events=[];
  const balls=[];
  const gusts=[];
  const sim={world,pieces,sheriff,events,balls,gusts,hole:null,time:0,spent:0};
  function activate(b){
    if(!b.dynamic){
      b.body.setBodyType(R.RigidBodyType.Dynamic,true);
      b.body.setLinearDamping(.14);
      b.body.setAngularDamping(.24);
      b.dynamic=true;sim.spent++;
    }
  }
  function deliver(b,change){
    activate(b);
    b.body.applyImpulse(mul(change,b.body.mass()),true);
  }
  function whirlDirection(position,center){
    const offset=sub(position,center);
    if(len(offset)<.045){
      const a=rng()*Math.PI*2;
      return point(Math.cos(a),.4,Math.sin(a));
    }
    return norm(offset);
  }
  function hitSheriff(at,power,radius){
    const chest=plus(sheriff.position,point(0,.88,0));
    if(len(sub(chest,at))>radius)return;
    sheriff.strike=Math.max(sheriff.strike,power);
    sheriff.hitDirection=chest.x<at.x?-1:1;
    if(sheriff.nextShot<0)sheriff.nextShot=sim.time+1.12;
    events.push({type:"stagger",at:chest,power});
  }
  function singularity(at){
    if(sim.hole)releaseSingularity();
    const c={...at,y:clamp(at.y+.64,1.54,3.9)};
    sim.hole={at:c,age:0,pulled:new Set()};
    events.push({type:"well",at:c});
    return c;
  }
  function releaseSingularity(){
    if(!sim.hole)return;
    const h=sim.hole;
    const strength=clamp(.36+h.age*.39,.4,1.30);
    for(const b of h.pulled){
      const away=whirlDirection(b.body.translation(),h.at);
      const impulse=plus(mul(away,(5.0+3.2*rng())*strength),point(0,1.4*strength,0));
      deliver(b,impulse);
      b.body.applyTorqueImpulse(point(.17*(rng()-.5),.17*(rng()-.5),.17*(rng()-.5)),true);
    }
    events.push({type:"throw",at:h.at,power:strength,count:h.pulled.size});
    hitSheriff(h.at,.68*strength,5.4);
    sim.hole=null;
  }
  function fire(start,target,charge=.75){
    const direction=norm(sub(target,start));
    const b={p:{...start},tail:{...start},v:mul(direction,19+10*charge),age:0,target:{...target},charge};
    balls.push(b);
    events.push({type:"fire",at:start,power:charge});
  }
  function explode(at,axis,charge){
    const radius=2.10+charge*1.82;
    let destroyed=0;
    for(const b of pieces){
      const away=sub(b.body.translation(),at);
      const d=len(away);
      if(d>radius)continue;
      const weight=1-d/radius;
      deliver(b,plus(mul(whirlDirection(b.body.translation(),at),(2.3+9.3*weight)*(charge*.60+.54)),
                    plus(mul(axis,2.1*weight),point(0,1.45+2.9*weight,0))));
      if(b.wood)b.heat=Math.max(b.heat,.35+weight*.65);
      destroyed++;
    }
    hitSheriff(at,Math.min(1.6,.78+charge),radius+1.13);
    events.push({type:"burst",at,power:charge,count:destroyed});
  }
  function wind(start,target,charge=.75){
    const along=norm({x:target.x-start.x,y:0,z:target.z-start.z});
    const g={at:{...start,y:.60},along,age:0,charge,hit:new Set()};
    gusts.push(g);
    events.push({type:"wind",at:start,along,power:charge});
  }
  function step(){
    sim.time+=STEP;
    const h=sim.hole;
    if(h){
      h.age+=STEP;
      const reach=blend(2.8,8.4,clamp(h.age*.58,0,1));
      const build=clamp(h.age*1.5,0,1);
      for(const b of pieces){
        const q=b.body.translation(),away=sub(h.at,q),d=len(away);
        if(d>reach||q.y<-.6)continue;
        // Progressively lift rows and nearby planks. A torque and a tangential impulse keep pieces orbiting.
        const magnet=norm(away);
        const swirl=norm(point(-magnet.z,0,magnet.x));
        const pull=(13.6+8*build)*clamp(d*.62,.28,1.26);
        const extra=clamp((reach-d)*.46,.10,1);
        const toward=mul(magnet,pull*extra);
        const force=plus(toward,plus(mul(swirl,(6.4+8.3*build)*extra),point(0,7.7*build,0)));
        if(!h.pulled.has(b)){
          activate(b);h.pulled.add(b);
          b.body.applyTorqueImpulse(point(.05*(rng()-.5),.07*(rng()-.5),.05*(rng()-.5)),true);
        }
        deliver(b,mul(force,STEP));
        const v=b.body.linvel();
        if(len(v)>10.8)b.body.setLinvel(mul(norm(v),10.8),true);
      }
      sheriff.pull=clamp((7.0-len(sub(sheriff.position,h.at)))*.13,0,.68)*build;
    }else sheriff.pull*=.91;

    for(let i=balls.length-1;i>=0;i--){
      const b=balls[i];
      b.age+=STEP;b.tail={...b.p};
      const speed=len(b.v);
      const dir=norm(b.v);
      const hit=world.castRay(new R.Ray(b.p,dir),speed*STEP,true);
      const next=plus(b.p,mul(b.v,STEP));
      if(hit||len(sub(next,b.target))<speed*STEP||b.age>1.08){
        const at=hit?plus(b.p,mul(dir,hit.toi)):next;
        explode(at,dir,b.charge);
        balls.splice(i,1);
      }else b.p=next;
    }
    for(let i=gusts.length-1;i>=0;i--){
      const g=gusts[i];
      g.age+=STEP;
      if(g.age>.78){gusts.splice(i,1);continue;}
      const distance=g.age*(11+g.charge*4.);
      for(const b of pieces){
        if(g.hit.has(b))continue;
        const delta=sub(b.body.translation(),g.at);
        const projection=dot(delta,g.along);
        if(projection<0||projection>distance+1.1)continue;
        const lateral=Math.hypot(delta.x-projection*g.along.x,delta.z-projection*g.along.z);
        const breadth=1.2+projection*.47;
        if(lateral>breadth||delta.y>3.9)continue;
        g.hit.add(b);
        const strength=(1-.51*lateral/breadth)*(5.4+6.0*g.charge);
        deliver(b,plus(mul(g.along,strength),point(0,1.5+2.2*g.charge,0)));
        if(b.heat>.14) b.heat=Math.min(1,b.heat+.35);
      }
      if(!g.affected){
        const delta=sub(sheriff.position,g.at),dp=dot(delta,g.along);
        if(dp>=0&&dp<distance+1&&Math.abs(delta.x*g.along.z-delta.z*g.along.x)<2.2+.30*dp){
          g.affected=true;hitSheriff(sheriff.position,.86,2.2);
        }
      }
    }
    sheriff.strike=Math.max(0,sheriff.strike-STEP*1.42);
    if(sheriff.nextShot>=0){
      sheriff.aim=clamp(1-((sheriff.nextShot-sim.time)/.62),0,1);
      if(sim.time>=sheriff.nextShot){
        events.push({type:"shot",at:sheriffHome,power:.86});
        sheriff.nextShot=-1;sheriff.shots++;
      }
    }else sheriff.aim*=.87;
    sheriff.position.x=sheriffHome.x+sheriff.pull*.53+sheriff.strike*.17*sheriff.hitDirection;
    for(const b of pieces){
      if(b.heat>0)b.heat=Math.max(0,b.heat-.084*STEP);
      if(b.dynamic&&len(b.body.translation())>65){
        b.body.setTranslation({x:0,y:-10,z:-48},false);
        b.body.sleep();
      }
    }
    world.step();
  }
  Object.assign(sim,{singularity,releaseSingularity,fire,wind,step,dispose:()=>world.free()});
  return sim;
}
module.exports={createSimulation,debrisLayout,STEP,random,point,plus,sub,mul,norm,len,dot,clamp,blend};
