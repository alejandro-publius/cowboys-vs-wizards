import assert from "node:assert/strict";
import test from "node:test";
import {OrthographicCamera} from "three";
import {tableCamera} from "../../src/ui/showdown-3d/table-camera.js";

test("browser shortcuts leave the table camera alone while plain rotate, zoom and reset still work", () => {
  const control = tableCamera({addEventListener() {}}, new OrthographicCamera(), () => {});
  control.resize(800, 400);
  const initial = control.view();
  control.key({key: "q"});
  control.key({key: "+", shiftKey: true});
  const moved = control.view();
  assert.notEqual(moved.azimuth, initial.azimuth);
  assert.ok(moved.zoom > initial.zoom);
  for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
    for (const key of ["=", "+", "-", "0", "q", "e"]) {
      control.key({key, [modifier]: true});
      assert.deepEqual(control.view(), moved, `${modifier}+${key}`);
    }
  }
  control.key({key: "0"});
  assert.deepEqual(control.view(), initial);
});
