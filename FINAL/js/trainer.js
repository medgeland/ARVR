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

        // INTRODUCTION: tools
        use: function (name, el) {
            if (this.state === "result") return;
            if (name === "goggles") {
                el.object3D.visible = false;
                this.gogglesView(true);
                this.say(i18n.t("trainer.goggles.on"));
                this.markDone("goggles");
            } else if (name === "tube") {
                // step 1 of sunscreen: take cream from the tube
                this.creamReady = true;
                el.setAttribute("animation__take", { property: "position", from: "-0.1 0.83 -0.34", to: "-0.1 0.79 -0.34", dur: 500, easing: "easeOutQuad" });
                this.say(i18n.t("trainer.cream.took"));
                this.updateGuide();
            } else if (name === "mole") {
                if (el.dataset.covered) return;
                if (!this.creamReady) { this.say(i18n.t("trainer.cream.first")); return; }
                // step 2: a visible white blob of cream over the mole
                el.dataset.covered = "1";
                el.setAttribute("color", "#ffffff");
                el.components["x0137-tool"].base.set(2.2, 2.4, 2.2);
                el.object3D.scale.set(2.2, 2.4, 2.2);
                this.molesCovered++;
                this.say(fmt("trainer.cream.mole", { n: this.molesCovered, m: this.moles.length }));
                if (this.molesCovered >= this.moles.length) this.markDone("sunscreen");
                else this.updateGuide();
            } else if (name === "towel") {
                el.object3D.visible = false;
                this.towelOn = true;
                this.towel.object3D.visible = true;
                this.markDone("towel");
            } else if (name.indexOf("nozzle:") === 0) {
                this.pickNozzle(name.slice(7));
            }
        },

        // rule: the smallest nozzle that still covers the whole spot
        bestNozzle: function (spot) {
            const fits = CONFIG.nozzles.filter((n) => n.mm >= spot.diameterMm);
            fits.sort((a, b) => a.mm - b.mm);
            return fits[0] || CONFIG.nozzles[CONFIG.nozzles.length - 1];
        },

        pickNozzle: function (id) {
            const n = CONFIG.nozzles.find((x) => x.id === id);
            if (!n) return;
            this.nozzle = n;
            this.shapeNozzle(n);
            if (n.mm === this.bestNozzle(CONFIG.spots[0]).mm) this.markDone("nozzle");
            else this.unmarkDone("nozzle");
        },

        markDone: function (step) { this.done[step] = true; this.renderChecklist(); },
        unmarkDone: function (step) { delete this.done[step]; this.renderChecklist(); },

        // TREATMENT
        tick: function (time, dt) {
            if (this.state !== "treat" || !this.skin) return;
            const sec = Math.min(dt, 100) / 1000;
            if (this.el.is("vr-mode")) {
                // VR: the device hangs over the point where the laser hits the arm;
                // the thumbstick (or A / B) sets the height, the trigger exposes
                this.aimFromLaser();
                if (Math.abs(this.stickY) > 0.15) this.setHeight(this.heightCm - this.stickY * 3 * sec, true);
            } else if (!this.parked || this.pointerDown) {
                this.followPointer();
            }
            const h = this.heightCm / 100;
            const cm = this.heightCm;
            const status = cm < CONFIG.distanceCm.target - CONFIG.distanceCm.tol ? "close" :
                           cm > CONFIG.distanceCm.target + CONFIG.distanceCm.tol ? "far" : "good";
            this.updateRulerMarker();
            this.updateMeter(cm, status);
            if (!this.aim) return;

            const top = this.skin.topAt(this.aim.x, this.aim.z) || 0;
            this.placeDevice(this.aim.x, top, this.aim.z, h);

            if (this.exposing) this.exposeStep(sec, status, time);
        },

        // the first hand whose laser touches the skin aims the device
        aimFromLaser: function () {
            for (const hand of [this.rightHand, this.leftHand]) {
                const rc = hand && hand.components.raycaster;
                if (!rc || !rc.intersections) continue;
                const hit = rc.intersections.find((x) => x.object === this.skin.mesh);
                if (!hit) continue;
                const p = this.arm.object3D.worldToLocal(hit.point.clone());
                this.aim = { x: p.x, z: p.z };
                return;
            }
        },

        followPointer: function () {
            const rc = this.el.components.raycaster;
            if (!rc || !rc.intersections) return;
            // only when the bare skin is the first thing under the pointer (not a mole, tool or panel)
            const hit = rc.intersections[0];
            if (!hit || hit.object !== this.skin.mesh) return;
            const p = this.arm.object3D.worldToLocal(hit.point.clone());
            this.aim = { x: p.x, z: p.z };
        },

        placeDevice: function (x, top, z, h) {
            const w = this.arm.object3D.localToWorld(new THREE.Vector3(x, top + h, z));
            this.device.object3D.position.copy(w);
            if (this.beam) {
                this.beam.object3D.position.y = -h / 2;
                this.beam.object3D.scale.y = Math.max(h, 0.001);
            }
            this.footprint.object3D.position.set(x, top + 0.0008, z);
        },

        startExpose: function (source) {
            if (this.state !== "treat" || this.exposing) return;
            if (!this.done.goggles) { this.warn(i18n.t("trainer.warn.goggles")); return; }
            if (!this.nozzle) { this.warn(i18n.t("trainer.warn.nozzle")); return; }
            if (!this.aim) { this.warn(i18n.t("trainer.warn.aim")); return; }
            this.exposing = true;
            this.exposeSource = source;
            this.setGlow(true);
            ui.subtitle(i18n.t("trainer.exposing"));
        },

        stopExpose: function () {
            if (!this.exposing) return;
            this.exposing = false;
            this.setGlow(false);
            // a real exposure (not a mis-click) ends the spot
            if (this.stats.t >= 1) this.setState("result");
        },

        exposeStep: function (sec, status, time) {
            const s = this.stats, b = CONFIG.burn;
            s.t += sec;
            s.samples++;
            s[status]++;
            const cells = this.skin.footprint(this.aim.x, this.aim.z, this.nozzle);
            let covered = 0;
            const tooLong = s.t > CONFIG.timeS.target + CONFIG.timeS.tol;
            cells.forEach((c) => {
                if (c.lesion) covered++;
                if (c.towel && this.towelOn) return; // towel protects healthy skin
                let r = 0;
                if (status === "close") r += b.tooClose;
                if (tooLong) r += b.tooLong;
                if (!c.lesion) r += b.healthy;
                this.skin.addRed(c, r * sec);
            });
            s.cover += covered / this.spotCells.length;
            this.updateScreen();

            if (status === "close" && time - this.lastBeep > 1200) {
                this.lastBeep = time;
                this.beep();
                ui.subtitle(i18n.t("trainer.warn.close"));
            }
            if (tooLong && !s.longWarned) {
                s.longWarned = true;
                this.beep();
                ui.subtitle(i18n.t("trainer.warn.long"));
            }
        },

        // exact = no rounding to the step (thumbstick, click on the ruler)
        setHeight: function (cm, exact) {
            const v = exact ? cm : Math.round(cm / CONFIG.heightStepCm) * CONFIG.heightStepCm;
            this.heightCm = Math.max(0.5, Math.min(12, v));
        },

        // RESULT
        showResult: function () {
            const s = this.stats, spot = CONFIG.spots[0];
            const best = this.bestNozzle(spot);
            const share = s.samples ? s.good / s.samples : 0;
            const closeShare = s.samples ? s.close / s.samples : 0;
            const coverage = s.samples ? s.cover / s.samples : 0;
            const maxRed = this.skin.cells.reduce((m, c) => Math.max(m, c.red), 0);
            const t = Math.round(s.t * 10) / 10;
            const timeOk = Math.abs(s.t - CONFIG.timeS.target) <= CONFIG.timeS.tol;
            const pct = (x) => Math.round(x * 100);

            const checks = [
                { key: "goggles", ok: !!this.done.goggles },
                { key: "sunscreen", ok: !!this.done.sunscreen, tip: i18n.t("trainer.tip.sunscreen") },
                { key: "vitamin", ok: this.vitaminTaken === true, tip: i18n.t("trainer.tip.vitamin") },
                { key: "towel", ok: this.towelOn, tip: i18n.t("trainer.tip.towel") },
                { key: "nozzle", ok: this.nozzle && this.nozzle.mm === best.mm,
                  tip: fmt("trainer.tip.nozzle", { spot: spot.diameterMm, best: best.mm, mm: this.nozzle ? this.nozzle.mm : "-" }) },
                { key: "aim", ok: coverage >= CONFIG.pass.coverage, tip: fmt("trainer.tip.aim", { p: pct(coverage) }) },
                { key: "distance", ok: share >= CONFIG.pass.distanceShare,
                  tip: closeShare >= (s.far / Math.max(1, s.samples))
                      ? fmt("trainer.tip.close", { p: pct(closeShare) })
                      : fmt("trainer.tip.far", { p: pct(1 - share - closeShare) }) },
                { key: "time", ok: timeOk,
                  tip: fmt(s.t < CONFIG.timeS.target ? "trainer.tip.short" : "trainer.tip.long", { t: t, target: CONFIG.timeS.target }) },
                { key: "skin", ok: maxRed < CONFIG.pass.maxRed, tip: i18n.t("trainer.tip.burn") }
            ];
            if (timeOk) this.markDone("time");
            if (share >= CONFIG.pass.distanceShare) this.markDone("distance");

            const passed = checks.filter((c) => c.ok).length;
            this.resultText = fmt("trainer.result.score", { n: passed, m: checks.length }) + "\n" +
                checks.map((c) => (c.ok ? "\u2713 " : "\u2717 ") + i18n.t("trainer.check." + c.key)).join("\n");
            const wrap = document.createElement("div");
            wrap.className = "x0137-result";
            const box = document.createElement("div");
            box.className = "x0137-box box";
            box.setAttribute("role", "dialog");
            const h = document.createElement("h2");
            h.textContent = i18n.t("trainer.result.title");
            const score = document.createElement("div");
            score.className = "score";
            score.textContent = fmt("trainer.result.score", { n: passed, m: checks.length });
            const ul = document.createElement("ul");
            checks.forEach(function (c) {
                const li = document.createElement("li");
                li.className = c.ok ? "ok" : "miss";
                const head = document.createElement("div");
                head.className = "head";
                // sign and a word, never color alone
                head.textContent = (c.ok ? "✓ " : "✗ ") + i18n.t("trainer.check." + c.key) +
                    " — " + i18n.t(c.ok ? "trainer.ok" : "trainer.miss");
                li.appendChild(head);
                if (!c.ok && c.tip) {
                    const tip = document.createElement("div");
                    tip.className = "tip";
                    tip.textContent = c.tip;
                    li.appendChild(tip);
                }
                ul.appendChild(li);
            });
            const actions = document.createElement("div");
            actions.className = "actions";
            const again = document.createElement("button");
            again.type = "button";
            again.className = "x0137-btn home";
            again.textContent = i18n.t("trainer.btn.retry");
            again.addEventListener("click", function () { window.location.reload(); });
            const home = document.createElement("a");
            home.className = "x0137-btn";
            home.href = "index.html?lang=" + i18n.lang;
            home.textContent = i18n.t("hud.home");
            actions.append(again, home);
            box.append(h, score, ul, actions);
            wrap.appendChild(box);
            document.body.appendChild(wrap);
            again.focus();

            this.say(fmt("trainer.result.score", { n: passed, m: checks.length }));
            this.refreshVr();
        },