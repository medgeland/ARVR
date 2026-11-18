// Capstone – First Laser Visit – 240137 – prefix x0137-
// trainer.js: Trainer mode. One system, 3 states: intro -> treat -> result.
//   intro : safety checklist (goggles, sunscreen on moles, vitamin E, towel, nozzle)
//   treat : aim the device at the spot, hold it 4 cm above the skin, expose for the right time
//   result: every check scored with a sign and words, mistakes explained

(function () {
    const i18n = window.X0137_I18N;
    const speech = window.X0137_SPEECH;
    const ui = window.X0137_UI;

    const CONFIG = {
        deviceName: "home excimer (generic)",
        // the 5 filters from the product sheet: 8 mm square, 16 and 24 mm round and square
        nozzles: [
            { id: "sq8",  shape: "square", mm: 8 },
            { id: "rd16", shape: "round",  mm: 16 },
            { id: "sq16", shape: "square", mm: 16 },
            { id: "rd24", shape: "round",  mm: 24 },
            { id: "sq24", shape: "square", mm: 24 }
        ],
        distanceCm: { target: 4, tol: 0.5 }, // 4 cm is the doctor's rule; the tolerance is a placeholder
        timeS: { target: 10, tol: 2 }, // placeholder
        startHeightCm: 7,
        heightStepCm: 0.25,
        // spot position: along the forearm 0 = elbow .. 1 = wrist, across in metres from the middle
        spots: [
            { id: "s1", type: "psoriasis", diameterMm: 20, along: 0.45, across: -0.004 }
        ],
        moles: [ { along: 0.18, across: 0.022 }, { along: 0.78, across: -0.018 } ],
        towelHoleMm: 36,
        // how fast the skin reddens, per second of exposure
        burn: { tooClose: 0.5, tooLong: 0.25, healthy: 0.05 },
        pass: { distanceShare: 0.8, coverage: 0.85, maxRed: 0.35 },
        steps: ["goggles", "sunscreen", "vitamin", "towel", "nozzle", "distance", "time"]
    };

    const CSS = `
    .x0137-check ol { margin: 0; padding: 0; list-style: none; }
    .x0137-check li { display: flex; gap: 8px; padding: 2px 0; }
    .x0137-check li.done { color: #1b5e20; }
    .x0137-check li.now, .x0137-check .hint { background: #fff3c4; }
    .x0137-check .hint, .x0137-check .ask { padding-left: 2em; font-size: 13px; }
    .x0137-result { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
        padding: 16px; background: rgba(26,35,126,0.5); font-family: Arial, Helvetica, sans-serif; }
    .x0137-result .box { max-width: 560px; max-height: 90vh; overflow: auto; }
    .x0137-result ul { list-style: none; padding: 0; }
    .x0137-result li.ok { color: #1b5e20; }
    .x0137-result li.miss { color: #b71c1c; }
    .x0137-result .tip { color: #4a4f6a; font-size: 14px; }`;

    // "{a} of {b}" style templates
    function fmt(key, vals) {
        return i18n.t(key).replace(/\{(\w+)\}/g, function (m, k) { return vals[k] != null ? vals[k] : m; });
    }

    AFRAME.registerSystem("x0137-trainer", {
        init: function () {
            this.config = CONFIG;
            this.state = null;
            this.done = {};
            this.vitaminTaken = null;
            this.moles = [];
            this.molesCovered = 0;
            this.towelOn = false;
            this.nozzle = null;
            this.lastLine = "";
            this.heightCm = CONFIG.startHeightCm;
            this.aim = null; // {x, z} on the arm, local metres
            this.exposing = false;
            this.exposeSource = null;
            this.stats = null;
            this.lastBeep = 0;

            window.addEventListener("x0137-intent", (e) => this.onIntent(e.detail.name));
            window.addEventListener("x0137-nomatch", () => this.say(i18n.t("speech.nomatch")));

            this.el.addEventListener("loaded", () => {
                speech.init({ intents: ["wait", "again", "next", "start", "q_goggles", "q_nozzle", "q_time"] });
                ui.init({ questions: [] });
                this.arm = document.getElementById("arm");
                this.skinEl = document.getElementById("skin");
                this.skin = this.skinEl.components["x0137-voxel-skin"];
                this.device = document.getElementById("device");
                this.restPosition = this.device.object3D.position.clone();
                this.buildArrow();
                // VR panel to the left of the table, tilted toward the seated user
                this.vr = ui.vrPanel({ position: "-0.55 1.3 -0.25", rotation: "-10 52 0", width: 0.44, textHeight: 0.13 });
                this.buildChecklist();
                this.buildMeter();
                this.buildSpot();
                this.buildRuler();
                this.buildTowel();
                this.buildNozzles();
                this.buildDeviceParts();
                this.bindInput();
                this.lookDown();
                this.setState("intro");
            });
            this.el.addEventListener("enter-vr", () => {
                this.vrSubtitle(true);
                if (this.vr) { this.vr.show(); this.refreshVr(); }
            });
            this.el.addEventListener("exit-vr", () => {
                this.vrSubtitle(false);
                if (this.vr) this.vr.hide();
            });
        },

        
        // states
        setState: function (state) {
            this.state = state;
            this.buildControls();
            this.renderChecklist();
            if (state === "intro") {
                this.say(i18n.t("trainer.intro"));
            } else if (state === "treat") {
                this.meter.hidden = false;
                this.stats = { t: 0, good: 0, close: 0, far: 0, cover: 0, samples: 0 };
                this.updateScreen();
                this.say(i18n.t("trainer.treat.hint"));
            } else if (state === "result") {
                this.meter.hidden = true;
                // device goes back on the table so the treated skin is visible
                this.device.object3D.position.copy(this.restPosition);
                if (this.beam) this.beam.object3D.visible = false;
                this.footprint.object3D.visible = false;
                this.showResult();
            }
        },