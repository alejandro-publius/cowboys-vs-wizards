import {OrthographicCamera} from "three";

// Restored from the approved playtest: see the miniatures across the board.
export function matchCamera() {
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 80);
  camera.position.set(1.4, 10.2, 14.4);
  camera.lookAt(.15, .65, .12);
  camera.updateMatrixWorld();
  resizeMatchCamera(camera,16,9);
  return camera;
}
export function resizeMatchCamera(camera, width, height) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const halfHeight = Math.max(3.9, 7.85 / aspect);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
