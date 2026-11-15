import * as T from "three";

const v = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const q = () => new T.Quaternion();
const smooth = (a,b,x) => T.MathUtils.smoothstep(x,a,b);
const angles = (x,y,z) => q().setFromEuler(new T.Euler(x,y,z));
// The grip runs across the Tripo wizard's left palm along the local depth axis.
export const wizardStaffGrip = v(.283,.347,.108);

const builds = {
  billy: {
    pelvis:[0,.468,0], spine:[0,.552,-.009], chest:[0,.648,-.007], head:[0,.746,-.009],
    arm:[[.110,.671,.002],[.177,.550,.007],[.221,.468,.026],[.234,.426,.043]],
    leg:[[.063,.434,-.008],[.096,.261,-.008],[.125,.086,-.006]],
    waist:[.411,.493], neck:[.688,.761], shoulder:[.114,.147], forearm:[.148,.188]
  },
  wizard: {
    pelvis:[0,.353,-.013], spine:[0,.418,-.008], chest:[0,.519,-.009], head:[0,.617,.014],
    arm:[[.126,.546,-.012],[.219,.452,.015],[.278,.397,.072],[.301,.356,.109]],
    leg:[[.062,.26,-.010],[.086,.162,-.008],[.103,.072,-.008]],
    waist:[.138,.353], neck:[.583,.660], shoulder:[.133,.184], forearm:[.184,.244]
  }
};

function skeletonFor(kind) {
  const spec = builds[kind], bones = [];
  const add = (name, point, parent, parentPoint) => {
    const bone = new T.Bone();
    bone.name = kind + "_" + name;
    bone.position.fromArray(point);
    if (parent) {
      bone.position.sub(v(...parentPoint));
      parent.add(bone);
    }
    bones.push(bone);
    return bone;
  };
  const pelvis=add("hips",spec.pelvis), spine=add("spine",spec.spine,pelvis,spec.pelvis);
  const chest=add("chest",spec.chest,spine,spec.spine), head=add("head",spec.head,chest,spec.chest);
  const sides = [-1,1].map(sign => {
    const flip = ([x,y,z]) => [x*sign,y,z];
    const [shoulder,elbow,wrist,palm] = spec.arm.map(flip);
    const [hip,knee,ankle] = spec.leg.map(flip);
    const name = sign===-1 ? "right" : "left";
    const upper=add(name+"_shoulder",shoulder,chest,spec.chest);
    const fore=add(name+"_elbow",elbow,upper,shoulder);
    const hand=add(name+"_wrist",wrist,fore,elbow);
    const thigh=add(name+"_hip",hip,pelvis,spec.pelvis);
    const shin=add(name+"_knee",knee,thigh,hip);
    const foot=add(name+"_foot",ankle,shin,knee);
    return {sign,upper,fore,hand,thigh,shin,foot,
      shoulder:v(...shoulder),elbow:v(...elbow),wrist:v(...wrist),palm:v(...palm),
      along:v(...wrist).sub(v(...elbow)).normalize()};
  });
  return {spec,bones,pelvis,spine,chest,head,sides};
}

// Spatial weights blend at joints while the boot soles follow the fixed foot bones.
function applyWeights(geometry, rig, kind) {
  const pos = geometry.getAttribute("position");
  const ids = new Uint16Array(pos.count*4), weights = new Float32Array(pos.count*4);
  const bindIndex = new Map(rig.bones.map((bone,index)=>[bone,index]));
  const p = v();
  for (let i=0;i<pos.count;i++) {
    p.fromBufferAttribute(pos,i);
    const {x,y,z}=p, spec=rig.spec, side=rig.sides[x<0?0:1], lateral=Math.abs(x);
    const head = kind==="wizard" ? Math.max(smooth(...spec.neck,y),
      smooth(.485,.584,y)*smooth(.051,.111,z)*(1-smooth(.089,.152,lateral))) :
      smooth(...spec.neck,y);
    const armBand = smooth(kind==="billy"?.28:.27,kind==="billy"?.40:.33,y) *
      (1-smooth(spec.arm[0][1]+.015,spec.arm[0][1]+.078,y));
    const span=T.MathUtils.lerp(spec.forearm[0],spec.shoulder[0],smooth(.42,spec.arm[0][1],y));
    const arm = (1-head)*armBand*smooth(span,span+.046,lateral);
    const lower = smooth(-.033,.029,(x-side.elbow.x)*side.along.x+(y-side.elbow.y)*side.along.y+(z-side.elbow.z)*side.along.z);
    const palm = smooth(-.015,.022,(x-side.wrist.x)*side.along.x+(y-side.wrist.y)*side.along.y+(z-side.wrist.z)*side.along.z);
    const remainder = Math.max(0,1-head-arm);
    const leg = remainder*(1-smooth(...spec.waist,y));
    const foot=1-smooth(.048,.112,y);
    const shin=1-smooth(spec.leg[1][1]-.046,spec.leg[1][1]+.047,y);
    const chest=smooth(spec.spine[1]-.035,spec.chest[1]-.004,y);
    const spine=smooth(spec.pelvis[1]-.04,spec.spine[1]+.018,y);
    const torso=remainder-leg;
    const grip = kind==="wizard"&&x>0
      ? smooth(.229,.265,x)*smooth(.044,.073,z)*(1-smooth(.398,.438,y))*
        smooth(-.015,.027,p.clone().sub(side.wrist).dot(side.along))
      : 0;
    const influences = [
      [rig.head,head],[side.upper,arm*(1-lower)],[side.fore,arm*lower*(1-palm)],[side.hand,arm*lower*palm],
      [side.foot,leg*foot],[side.shin,leg*(1-foot)*shin],[side.thigh,leg*(1-foot)*(1-shin)],
      [rig.chest,torso*chest],[rig.spine,torso*(1-chest)*spine],[rig.pelvis,torso*(1-chest)*(1-spine)]
    ];
    for (const influence of influences) {
      influence[1]=influence[1]*(1-grip)+(influence[0]===side.hand?grip:0);
    }
    influences.sort((a,b)=>b[1]-a[1]).splice(4);
    const total=influences.reduce((sum,entry)=>sum+entry[1],0);
    for(let j=0;j<4;j++) {
      ids[i*4+j]=bindIndex.get(influences[j][0]);
      weights[i*4+j]=influences[j][1]/total;
    }
  }
  geometry.setAttribute("skinIndex",new T.Uint16BufferAttribute(ids,4));
  geometry.setAttribute("skinWeight",new T.Float32BufferAttribute(weights,4));
}

function closeWizardGrip(geometry) {
  const position=geometry.getAttribute("position");
  const normal=geometry.getAttribute("normal");
  const pivotX=.308,pivotY=.354;
  for(let index=0;index<position.count;index++){
    const x=position.getX(index),y=position.getY(index),z=position.getZ(index);
    const fingers=smooth(.262,.294,x)*smooth(.045,.066,z)*(1-smooth(.166,.184,z));
    const angle=1.56*(1-smooth(.295,.351,y))*fingers;
    if(angle<.001)continue;
    const cos=Math.cos(angle),sin=Math.sin(angle),dx=x-pivotX,dy=y-pivotY;
    position.setXY(index,pivotX+cos*dx+sin*dy,pivotY-sin*dx+cos*dy);
    if(normal){
      const nx=normal.getX(index),ny=normal.getY(index);
      normal.setXY(index,cos*nx+sin*ny,-sin*nx+cos*ny);
    }
  }
}

export function rigActor(scene, kind, height) {
  let raw;
  scene.traverse(object=>{if(object.isMesh) raw=object;});
  if(!raw) throw new Error(kind+" mesh is missing");
  const geometry=raw.geometry.clone();
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox;
  const center=bounds.getCenter(v()), scale=1/(bounds.max.y-bounds.min.y);
  geometry.translate(-center.x,-bounds.min.y,-center.z);
  geometry.scale(scale,scale,scale);
  const rig=skeletonFor(kind);
  applyWeights(geometry,rig,kind);
  if(kind==="wizard")closeWizardGrip(geometry);
  const root=new T.Group();
  root.name=kind;
  const body=new T.SkinnedMesh(geometry,raw.material);
  body.castShadow=true;body.receiveShadow=true;body.frustumCulled=false;
  body.add(rig.pelvis);
  root.add(body);
  root.updateMatrixWorld(true);
  body.bind(new T.Skeleton(rig.bones));
  root.scale.setScalar(height);
  return {root,body,rig,kind};
}

function solveArm(actor, side, goal, bend, roll) {
  const {chest}=actor.rig;
  const [upper,fore,hand]=[side.upper,side.fore,side.hand];
  if(!goal) {
    upper.quaternion.identity();fore.quaternion.identity();hand.quaternion.identity();
    return;
  }
  const end=chest.worldToLocal(actor.root.localToWorld(goal.clone())).sub(upper.position);
  const startUpper=fore.position.clone(), startLower=hand.position.clone();
  const a=startUpper.length(), b=startLower.length();
  const distance=T.MathUtils.clamp(end.length(),Math.abs(a-b)+.008,a+b-.003);
  const line=end.normalize();
  const lineRest=startUpper.clone().add(startLower).normalize();
  const restPole=startUpper.clone().addScaledVector(lineRest,-startUpper.dot(lineRest)).normalize();
  const outward=v(side.sign*.85,-.74,-.11).normalize();
  const pole=restPole.lerp(outward,bend);
  pole.addScaledVector(line,-pole.dot(line)).normalize();
  const projection=(a*a+distance*distance-b*b)/(2*distance);
  const elbow=line.clone().multiplyScalar(projection).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-projection*projection)));
  const lower=line.clone().multiplyScalar(distance).sub(elbow);
  const upperQ=q().setFromUnitVectors(startUpper.normalize(),elbow.normalize());
  const lowerQ=q().setFromUnitVectors(startLower.normalize(),lower.normalize());
  upper.quaternion.copy(upperQ);
  fore.quaternion.copy(upperQ.invert()).multiply(lowerQ);
  // Counter the elbow rotation at the hand, keeping the grip turned with the prop.
  hand.quaternion.copy(lowerQ.invert()).multiply(angles(...roll));
}

export function pose(actor, {spine=[0,0,0], chest=[0,0,0], head=[0,0,0], right, left, legs}={}) {
  const rig=actor.rig;
  rig.spine.rotation.set(...spine);
  rig.chest.rotation.set(...chest);
  rig.head.rotation.set(...head);
  if(legs)rig.sides.forEach((side,i)=>{
    side.thigh.rotation.set(...legs[i].thigh);
    side.shin.rotation.set(...legs[i].shin);
    side.foot.rotation.set(...legs[i].foot);
  });
  actor.root.updateMatrixWorld(true);
  for(const [side,instruction] of [[rig.sides[0],right],[rig.sides[1],left]]) {
    if(instruction) solveArm(actor,side,instruction.goal,instruction.bend,instruction.roll);
    else solveArm(actor,side,null,0,null);
  }
  actor.root.updateMatrixWorld(true);
}

export function grip(actor, hand) {
  const side=actor.rig.sides[hand==="right"?0:1];
  return actor.root.worldToLocal(side.hand.localToWorld(side.palm.clone().sub(side.wrist)));
}

export function pointOn(actor,x,y,z) {
  return actor.root.localToWorld(v(x,y,z));
}
