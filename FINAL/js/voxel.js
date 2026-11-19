// Capstone – First Laser Visit – 240137 – prefix x0137-
// voxel.js: block ("voxel") building for both modes.
//   x0137-voxel-skin  : the forearm surface as a grid of skin columns (one InstancedMesh, one draw call).
//                       Every column has its own colour and height, so lesions, moles, redness from a
//                       bad exposure and healing can all be shown live.
//   x0137-voxel-model : builds a device from a text layer map (like pixel art), also one InstancedMesh.
// three.js InstancedMesh docs: https://threejs.org/docs/#api/en/objects/InstancedMesh

(function () {
    const M = new THREE.Matrix4();
    const C = new THREE.Color();
    const RED = new THREE.Color("#d23a2c");

    // deterministic per-cell noise in 0..1, so the skin looks the same on every load
    function hash(i, j, seed) {
        let h = (i * 374761393 + j * 668265263 + (seed || 0) * 2147483647) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h = h ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
    }
    function lerp(a, b, t) { return a + (b - a) * t; }
    