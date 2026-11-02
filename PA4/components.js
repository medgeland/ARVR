// PA4 – 240137 – prefix x0137-
// variant: winter steppe (7), bob (3 mod 3 =0), point-and-click (1 mod 2 =1), ring (0 mod 2 =0)

AFRAME.registerSystem("x0137-gallery", {
    init: function () {
        this.exhibits = [];
        this.selected = null;
        // keydown listener for M and X
        this.motionPaused = false;
        this.onKeyDown = this.onKeyDown.bind(this);
        window.addEventListener("keydown", this.onKeyDown);
    },
    register: function (el) {
        this.exhibits.push(el);
        this.exhibits.sort(function (a, b) {
            return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
        this.updatePanel();
    },
    
    unregister: function (el) {
        const index = this.exhibits.indexOf(el);
        if (index !== -1) {
            this.exhibits.splice(index, 1);
        }
        if (this.selected === el) {
            this.selected = null;
        }
        this.updatePanel();
    },
    //one selection at a time, update panel
    select: function (el) {
        if (this.selected === el) {
            el.components["x0137-exhibit"].setSelected(false);
            this.selected = null;
        } else {
            if (this.selected) {
                this.selected.components["x0137-exhibit"].setSelected(false);
            }
            this.selected = el;
            el.components["x0137-exhibit"].setSelected(true);
        }
        this.updatePanel();
    },
    
    onKeyDown: function (event) {
        if (event.key === "m" || event.key === "M") {
            // M: pause or resume the motion of every exhibit
            this.motionPaused = !this.motionPaused;
            for (const el of this.exhibits) {
                const motion = el.components["x0137-motion"];
                if (motion) {
                    if (this.motionPaused) {
                        motion.pause();
                    } else {
                        motion.play();
                    }
                }
            }
        } else if (event.key === "x" || event.key === "X") {
            // X: remove the selected exhibit from the DOM
            if (this.selected) {
                this.selected.parentNode.removeChild(this.selected);
            }
        }
    },
    updatePanel: function () {
        const text = document.querySelector("#selected-text");
        if (!text) {
            return;
        }
        const total = this.exhibits.length;
        let value = "Selected: none (0 of " + total + ")";
        if (this.selected) {
            const name = this.selected.getAttribute("x0137-exhibit").name;
            const n = this.exhibits.indexOf(this.selected) + 1;
            value = "Selected: " + name + " (" + n + " of " + total + ")";
        }
        text.setAttribute("value", value);
    }
});

AFRAME.registerComponent("x0137-motion", {
    schema: {
        type: { type: "string", oneOf: ["bob", "orbit", "pulse"], default: "bob" },
        amplitude: { type: "number", default: 0.15 }, //in meters (bob orbit) or scale fraction
        period: { type: "number", default: 3 }, //s per cycle
        phase: { type: "number", default: 0 } //rad
    };
    init: function () {
        // base pose: every frame is computed from it, so the motion never drifts
        this.basePosition = this.el.object3D.position.clone();
        this.baseScale = this.el.object3D.scale.clone();
        this.angle = 0;
        this.currentAmplitude = this.data.amplitude;
    };
    update: function (oldData) {
        // new motion type starts again from the base pose
        if (oldData.type !== undefined && oldData.type !== this.data.type) {
            this.restoreBase();
        }
        // new amplitude is reached gradually in tick (no jump);
        // new period only changes how fast the angle grows (no jump)
    };
    tick: function (time, timeDelta) {
        const dt = Math.min(timeDelta / 1000, 0.1);
        if (this.data.period > 0) {
            this.angle += 2 * Math.PI * dt / this.data.period;
        }
        this.currentAmplitude += (this.data.amplitude - this.currentAmplitude) * Math.min(1, dt * 3);
        const s = Math.sin(this.angle + this.data.phase);
        const a = this.currentAmplitude;
        const object3D = this.el.object3D;
        if (this.data.type === "bob") {
            object3D.position.y = this.basePosition.y + a * s;
        } else if (this.data.type === "orbit") {
            object3D.position.x = this.basePosition.x + a * Math.cos(this.angle + this.data.phase);
            object3D.position.z = this.basePosition.z + a * s;
        } else if (this.data.type === "pulse") {
            object3D.scale.copy(this.baseScale).multiplyScalar(1 + a * s);
        }
    };

    pause: function () {

    },
    play: function () { 

    };

    remove: function () {
        this.restoreBase();
    },

    restoreBase: function () {
        this.el.object3D.position.copy(this.basePosition);
        this.el.object3D.scale.copy(this.baseScale);
    }
});

AFRAME.registerComponent("x0137-texture", {
    schema: { // configuration only: src (map), repeat (vec2), normalSrc, anisotropy
        src: { type: "map" },
        repeat: { type: "vec2", default: { x: 1, y: 1 } },
        normalSrc: { type: "map", default: "" },
        anisotropy: { type: "number", default: 8 }
    },

    init: function () { //find the mesh now or on object3dset
        this.mesh = null;
        this.originalMaterial = null;
        this.material = null;
        this.texture = null;
        this.normalTexture = null;
        this.onObject3DSet = this.onObject3DSet.bind(this);

        const mesh = this.el.getObject3D("mesh");
        if (mesh) {
            this.setMesh(mesh);
        } else {
            this.el.addEventListener("object3dset", this.onObject3DSet);
        }

    },
    onObject3DSet: function (event) {
        if (event.detail.type === "mesh") {
            this.el.removeEventListener("object3dset", this.onObject3DSet);
            this.setMesh(this.el.getObject3D("mesh"));
            this.update({});
        }
    },
    setMesh: function (mesh) {
        this.mesh = mesh;
        this.originalMaterial = mesh.material;
        this.material = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
        mesh.material = this.material;
    },
    update: function (oldData) { //update only when src changes
        if (!this.mesh) {
            return;
        }
    if (this.data.src !== oldData.src) {
        if (this.texture) {
            this.texture.dispose();
        }
        this.texture = this.loadTexture(this.data.src);
        if (this.texture) {
            this.texture.colorSpace = THREE.SRGBColorSpace;
        }
        this.material.map = this.texture;
        this.material.needsUpdate = true;
    }
    if (this.data.normalSrc !== oldData.normalSrc) {
        if (this.normalTexture) {
            this.normalTexture.dispose();
        }
        this.normalTexture = this.loadTexture(this.data.normalSrc);
        this.material.normalMap = this.normalTexture;
        this.material.needsUpdate = true;
    }
    this.applySettings(this.texture);
    this.applySettings(this.normalTexture);
},
loadTexture: function (src) {
    if (!src) {
        return null;
    }
    if (typeof src === "string") {
        return new THREE.TextureLoader().load(src);
    }
    const texture = new THREE.Texture(src);
    texture.needsUpdate = true;
    return texture;
}