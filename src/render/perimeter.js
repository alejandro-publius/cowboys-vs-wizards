import { Box3, Group, ImageBitmapLoader, MirroredRepeatWrapping, SRGBColorSpace, Texture, Vector3 } from 'three';
import groundUrl from '../../assets/media/desert-ground.webp';

// The angles square the open elbow of each Tripo mesh to the table corner.
const corners = [
  { asset: 'graveyard-corner', x: -5.12, z: -3.48, yaw: 22, span: 4.55 },
  { asset: 'graveyard-corner', x: 5.12, z: -3.48, yaw: -68, span: 4.55 },
  { asset: 'ghost-town-corner', x: -4.94, z: 3.35, yaw: -3, span: 4.66 },
  { asset: 'ghost-town-corner', x: 4.94, z: 3.35, yaw: 87, span: 4.66 },
];

export async function loadGroundTexture() {
  const image = await new ImageBitmapLoader().loadAsync(groundUrl);
  const texture = new Texture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = MirroredRepeatWrapping;
  texture.repeat.set(20, 20);
  texture.needsUpdate = true;
  return texture;
}

export function addPerimeter(scene, models, texture) {
  const ground = scene.children.find(object => object.geometry?.type === 'PlaneGeometry');
  ground.material = ground.material.clone();
  ground.material.map = texture;
  ground.material.color.setHex(0xdbd0c8);
  scene.background.setHex(0x3c3028);
  scene.fog.color.copy(scene.background);

  for (const { asset, x, z, yaw, span } of corners) {
    const model = models[asset].clone(true);
    model.rotateY(yaw * Math.PI / 180);
    const bounds = new Box3().setFromObject(model, true);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    center.y = bounds.min.y;
    model.position.sub(center);
    model.traverse(node => {
      if (node.isMesh) node.castShadow = node.receiveShadow = true;
    });

    const corner = new Group();
    corner.name = asset;
    corner.position.set(x, ground.position.y, z);
    corner.scale.setScalar(span / Math.max(size.x, size.z));
    corner.add(model);
    scene.add(corner);
  }
}
