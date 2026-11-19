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

    // SKIN
    AFRAME.registerComponent("x0137-voxel-skin", {
        schema: {
            voxelMm: { default: 3 },
            x0: { default: -0.205 }, // elbow end (local x, metres)
            x1: { default: 0.125 }, // wrist end
            halfW0: { default: 0.048 }, // half width at the elbow
            halfW1: { default: 0.037 }, // half width at the wrist
            top0: { default: 0.036 }, // skin top at the elbow
            top1: { default: 0.016 }, // skin top at the wrist
            bottom: { default: -0.03 }, // table level
            skin: { type: "color", default: "#e3b48f" }
        },

        init: function () {
            const d = this.data;
            const v = this.v = d.voxelMm / 1000;
            this.cells = [];
            this.index = {};
            this.dirty = false;

            const nx = Math.round((d.x1 - d.x0) / v);
            const nzHalf = Math.ceil(d.halfW0 / v);
            const base = new THREE.Color(d.skin);

            for (let i = 0; i < nx; i++) {
                const t = i / (nx - 1);
                const x = d.x0 + (i + 0.5) * v;
                const hw = lerp(d.halfW0, d.halfW1, t);
                const top = lerp(d.top0, d.top1, t);
                for (let j = -nzHalf; j < nzHalf; j++) {
                    const z = (j + 0.5) * v;
                    if (Math.abs(z) > hw) continue;
                    // rounded cross-section, then snapped to whole blocks
                    const e = Math.pow(1 - (z / hw) * (z / hw), 0.45);
                    const steps = Math.max(1, Math.round(((top - d.bottom) * e) / v));
                    const n = (hash(i, j) - 0.5) * 0.07;
                    const cell = {
                        i: i, j: j, x: x, z: z, steps: steps, raise: 0,
                        base: base.clone().offsetHSL(0, 0, n),
                        lesion: null, mole: false, towel: false, red: 0, heal: 0
                    };
                    this.index[i + ":" + j] = this.cells.length;
                    this.cells.push(cell);
                }
            }
            this.nx = nx;

            const geo = new THREE.BoxGeometry(v, 1, v);
            const mat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
            this.mesh = new THREE.InstancedMesh(geo, mat, this.cells.length);
            this.updateMatrices();
            this.updateColors();
            this.el.setObject3D("mesh", this.mesh);
        },

        updateMatrices: function () {
            const b = this.data.bottom, v = this.v;
            this.cells.forEach((c, k) => {
                const h = (c.steps + c.raise) * v;
                M.makeScale(1, h, 1);
                M.setPosition(c.x, b + h / 2, c.z);
                this.mesh.setMatrixAt(k, M);
            });
            this.mesh.instanceMatrix.needsUpdate = true;
            this.mesh.computeBoundingSphere();
            this.mesh.computeBoundingBox();
        },

        colorOf: function (c, out) {
            out.copy(c.base);
            if (c.lesion && c.heal > 0) out.lerp(c.healed, Math.min(1, c.heal));
            if (c.red > 0) out.lerp(RED, Math.min(1, c.red) * 0.85);
            return out;
        },

        updateColors: function () {
            this.cells.forEach((c, k) => this.mesh.setColorAt(k, this.colorOf(c, C)));
            if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
            this.dirty = false;
        },

        tick: function () {
            if (this.dirty) this.updateColors();
        },

        // LOOKUPS (arm-local metres)
        cellAt: function (x, z) {
            const i = Math.floor((x - this.data.x0) / this.v);
            const j = Math.floor(z / this.v);
            const k = this.index[i + ":" + j];
            return k === undefined ? null : this.cells[k];
        },
        topAt: function (x, z) {
            const c = this.cellAt(x, z);
            return c ? this.data.bottom + (c.steps + c.raise) * this.v : null;
        },
        // centre of the skin along the arm, as a fraction 0..1 (elbow..wrist) and across in metres
        pointAt: function (along, across) {
            return { x: lerp(this.data.x0, this.data.x1, along), z: across || 0 };
        },

        // LESIONS (psoriasis, vitiligo, etc.) and moles
        // type "psoriasis": pink plaque, raised silvery scale blocks; "vitiligo": white patch, flat
        addLesion: function (opts) {
            const R = opts.diameterMm / 2000;
            const cx = opts.x, cz = opts.z;
            const list = [];
            this.cells.forEach((c) => {
                const dx = c.x - cx, dz = c.z - cz;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const ragged = R * (0.86 + 0.24 * hash(c.i, c.j, 7));   // uneven edge
                if (dist > ragged) return;
                const n = (hash(c.i, c.j, 3) - 0.5) * 0.08;
                c.lesion = opts.id;
                c.healed = c.base.clone();                              // what it fades back to
                // when this cell repigments (0..1): edges first and scattered dots, the centre last
                c.healAt = 0.75 * (dist / ragged > 0.8 ? 0.1 : 1 - dist / ragged) + 0.25 * hash(c.i, c.j, 19);
                if (hash(c.i, c.j, 23) > 0.9) c.healAt *= 0.4;
                if (opts.type === "psoriasis") {
                    const edge = dist > R * 0.7;
                    c.base = new THREE.Color(edge ? "#d97a70" : "#e89a8e").offsetHSL(0, 0, n);
                    if (!edge && hash(c.i, c.j, 11) > 0.5) {
                        c.raise = 1;
                        c.base = new THREE.Color("#efe6e2").offsetHSL(0, 0, n * 0.5);  // silvery scale
                    }
                } else {
                    c.base = new THREE.Color("#f7eee7").offsetHSL(0, 0, n * 0.5);
                }
                list.push(c);
            });
            this.updateMatrices();
            this.dirty = true;
            return list;
        },

        // a mole: dark cells + a small clickable block for the sunscreen step
        addMole: function (x, z, onCreate) {
            const c = this.cellAt(x, z);
            if (!c) return null;
            c.base = new THREE.Color("#5a3a28");
            c.mole = true;
            this.dirty = true;
            const el = document.createElement("a-box");
            const s = this.v * 2.4;
            el.setAttribute("width", s);
            el.setAttribute("depth", s);
            el.setAttribute("height", this.v * 0.8);
            el.setAttribute("color", "#4a2e20");
            el.setAttribute("position", c.x + " " + (this.topAt(c.x, c.z) + this.v * 0.4) + " " + c.z);
            el.classList.add("clickable");
            if (onCreate) onCreate(el);
            this.el.parentNode.appendChild(el);
            return el;
        },
        