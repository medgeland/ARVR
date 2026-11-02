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
    }
}