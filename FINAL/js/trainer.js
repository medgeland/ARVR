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
        // healthy: the skin around the spot inside the towel hole. Low enough that a correct 10-12 s session
        // stays under pass.maxRed; too close or too long still burns quickly.
        burn: { tooClose: 0.5, tooLong: 0.25, healthy: 0.02 },
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
                this.stats = { t: 0, good: 0, close: 0, far: 0, cover: 0, samples: 0, closeS: 0, longS: 0 };
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
                this.skin.showTowel(true);
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
            if (status === "close") s.closeS += sec; // seconds too close / too long, to explain redness
            if (tooLong) s.longS += sec;
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
        // why the skin turned red: name the biggest cause, with the seconds, instead of a generic line
        burnTip: function (s) {
            const sec = (x) => Math.round(x * 10) / 10;
            if (s.closeS >= 0.3) return fmt("trainer.tip.burn.close", { s: sec(s.closeS), cm: CONFIG.distanceCm.target });
            if (s.longS > 0) return fmt("trainer.tip.burn.long", { s: sec(s.longS), max: CONFIG.timeS.target + CONFIG.timeS.tol });
            return i18n.t("trainer.tip.burn.edge");
        },
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
                { key: "skin", ok: maxRed < CONFIG.pass.maxRed, tip: this.burnTip(s) }
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

        // INTENTS
        onIntent: function (name) {
            if (name === "wait") { speech.cancelSpeech(); this.stopExpose(); return; }
            if (name === "again") { this.say(this.lastLine); return; }
            if (name === "q_goggles") { this.say(i18n.t("trainer.tip.goggles")); return; }
            if (name === "q_nozzle") {
                this.say(fmt("trainer.q.nozzle", { spot: CONFIG.spots[0].diameterMm }));
                return;
            }
            if (name === "q_time") { this.say(fmt("trainer.q.time", { target: CONFIG.timeS.target })); return; }
            if (name === "start" || name === "next") {
                if (this.state === "intro") {
                    if (!this.done.goggles) { this.warn(i18n.t("trainer.warn.goggles")); return; }
                    // unfinished steps: the first press lists them, a second press goes on anyway
                    const missing = ["sunscreen", "vitamin", "towel", "nozzle"].filter((st) =>
                        !(this.done[st] || (st === "vitamin" && this.vitaminTaken !== null)));
                    if (missing.length && !this.startWarned) {
                        this.startWarned = true;
                        this.warn(fmt("trainer.warn.missing", { list: missing.map((st) => i18n.t("trainer.check." + st)).join(", ") }));
                        return;
                    }
                    this.setState("treat");
                } else if (this.state === "treat" && name === "start") {
                    this.startExpose("voice");
                }
            }
        },

        say: function (text) {
            if (!text) return Promise.resolve();
            this.lastLine = text;
            return speech.say(text);
        },

        warn: function (text) {
            this.beep();
            this.say(text);
        },

        // soft warning beep (Web Audio); every beep comes with a subtitle
        beep: function () {
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                this.audio = this.audio || new Ctx();
                const a = this.audio, o = a.createOscillator(), g = a.createGain();
                o.type = "sine";
                o.frequency.value = 660;
                g.gain.setValueAtTime(0.0001, a.currentTime);
                g.gain.exponentialRampToValueAtTime(0.08, a.currentTime + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.25);
                o.connect(g).connect(a.destination);
                o.start();
                o.stop(a.currentTime + 0.3);
            } catch (e) { /* no audio: the subtitle still shows */ }
        },

        // INPUT: mouse, touch, keyboard, VR controllers
        bindInput: function () {
            this.rightHand = document.getElementById("right-hand");
            // desktop / touch: hover aims, holding the button on the skin exposes
            this.skinEl.addEventListener("mousedown", () => {
                // in VR the laser also sends mousedown; there the trigger handles exposure
                if (this.state !== "treat" || this.el.is("vr-mode")) return;
                this.pointerDown = true;
                this.parked = true;
                this.followPointer();
                this.startExpose("pointer");
            });
            const release = () => {
                if (!this.pointerDown) return;
                this.pointerDown = false;
                if (this.exposeSource === "pointer") this.stopExpose();
            };
            window.addEventListener("mouseup", release);
            window.addEventListener("touchend", release);
            window.addEventListener("touchcancel", release);
            // a click on the skin outside an exposure parks the device there
            this.skinEl.addEventListener("click", () => { if (this.state === "treat") this.parked = true; });
            // scroll wheel = height
            window.addEventListener("wheel", (e) => {
                if (this.state !== "treat") return;
                this.setHeight(this.heightCm + (e.deltaY > 0 ? -1 : 1) * CONFIG.heightStepCm);
            }, { passive: true });
            // keyboard: E / Q = height, Space = expose (every key also has a button)
            window.addEventListener("keydown", (e) => {
                if (this.state !== "treat" || e.repeat) return;
                // E = higher, Q = lower (W A S D and the arrows walk around the room)
                if (e.key === "e" || e.key === "E" || e.key === "у" || e.key === "У") this.setHeight(this.heightCm + CONFIG.heightStepCm);
                if (e.key === "q" || e.key === "Q" || e.key === "й" || e.key === "Й") this.setHeight(this.heightCm - CONFIG.heightStepCm);
                if (e.key === " " && e.target === document.body) { e.preventDefault(); this.startExpose("key"); }
            });
            window.addEventListener("keyup", (e) => {
                if (e.key === " " && this.exposeSource === "key") this.stopExpose();
            });
            // VR (Quest controllers or the Immersive Web Emulator), either hand:
            //   laser on the arm + hold trigger = light; thumbstick up/down = height; B/Y = higher, A/X = lower
            this.leftHand = document.getElementById("left-hand");
            this.stickY = 0;
            [this.rightHand, this.leftHand].forEach((hand) => {
                if (!hand) return;
                hand.addEventListener("triggerdown", () => {
                    if (this.state === "treat" && this.laserOnSkin(hand)) this.startExpose("trigger");
                });
                hand.addEventListener("triggerup", () => { if (this.exposeSource === "trigger") this.stopExpose(); });
                hand.addEventListener("thumbstickmoved", (e) => { this.stickY = e.detail.y || 0; });
                const up = () => { if (this.state === "treat") this.setHeight(this.heightCm + CONFIG.heightStepCm); };
                const down = () => { if (this.state === "treat") this.setHeight(this.heightCm - CONFIG.heightStepCm); };
                hand.addEventListener("bbuttondown", up);
                hand.addEventListener("ybuttondown", up);
                hand.addEventListener("abuttondown", down);
                hand.addEventListener("xbuttondown", down);
            });
        },

        laserOnSkin: function (hand) {
            const rc = hand.components.raycaster;
            return !!(rc && rc.intersections && rc.intersections[0] && rc.intersections[0].object === this.skin.mesh);
        },

        // on-screen buttons for the current state
        buildControls: function () {
            if (!this.controls) {
                this.controls = document.createElement("div");
                this.controls.className = "x0137-row";
                ui.row.parentNode.insertBefore(this.controls, ui.row);
            }
            this.controls.innerHTML = "";
            const add = (key, cls) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "x0137-btn" + (cls ? " " + cls : "");
                b.textContent = i18n.t(key);
                this.controls.appendChild(b);
                return b;
            };
            if (this.state === "intro") {
                add("trainer.btn.start", "home").addEventListener("click", () => speech.fire("start", "button"));
            } else if (this.state === "treat") {
                add("trainer.btn.up").addEventListener("click", () => this.setHeight(this.heightCm + CONFIG.heightStepCm));
                add("trainer.btn.down").addEventListener("click", () => this.setHeight(this.heightCm - CONFIG.heightStepCm));
                const ex = add("trainer.btn.expose", "home");
                ex.addEventListener("pointerdown", (e) => { e.preventDefault(); this.startExpose("button"); });
                ["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
                    ex.addEventListener(t, () => { if (this.exposeSource === "button") this.stopExpose(); }));
                ex.addEventListener("contextmenu", (e) => e.preventDefault());
            }
        },

        // BUILDING SCENE
        buildSpot: function () {
            const sp = CONFIG.spots[0];
            const p = this.skin.pointAt(sp.along, sp.across);
            this.spotCentre = p;
            this.spotCells = this.skin.addLesion({ id: sp.id, type: sp.type, diameterMm: sp.diameterMm, x: p.x, z: p.z });
            CONFIG.moles.forEach((m) => {
                const q = this.skin.pointAt(m.along, m.across);
                const el = this.skin.addMole(q.x, q.z, (e) => { e.setAttribute("x0137-tool", "name: mole"); e.classList.add("mole"); });
                if (el) this.moles.push(el);
            });
        },

        // ruler standing next to the spot: zero at the skin, a mark every cm, 4 cm in yellow
        buildRuler: function () {
            const c = this.spotCentre;
            const top = this.skin.topAt(c.x, c.z);
            const r = document.createElement("a-entity");
            // on the far side of the arm, so it never hides the spot from the user
            r.setAttribute("position", c.x + " 0 " + -(this.skin.data.halfW0 + 0.012));
            const stick = document.createElement("a-box");
            const len = top + 0.03 + 0.08;
            stick.setAttribute("width", 0.006);
            stick.setAttribute("depth", 0.006);
            stick.setAttribute("height", len);
            stick.setAttribute("position", "0 " + (-0.03 + len / 2) + " 0");
            stick.setAttribute("color", "#fafafa");
            r.appendChild(stick);
            for (let cm = 0; cm <= 8; cm++) {
                const tick = document.createElement("a-box");
                const key = cm === CONFIG.distanceCm.target;
                tick.setAttribute("width", key ? 0.022 : 0.012);
                tick.setAttribute("depth", 0.008);
                tick.setAttribute("height", key ? 0.003 : 0.0015);
                tick.setAttribute("position", (key ? -0.006 : -0.002) + " " + (top + cm / 100) + " 0");
                tick.setAttribute("color", key ? "#f9a825" : "#283593");
                r.appendChild(tick);
            }
            const label = document.createElement("a-entity");
            label.setAttribute("x0137-label", { value: CONFIG.distanceCm.target + " " + i18n.t("unit.cm"), width: 0.05, align: "left", fontSize: 240 });
            label.setAttribute("position", "0.04 " + (top + CONFIG.distanceCm.target / 100) + " 0.005");
            r.appendChild(label);

            // marker = where the device is now (moves with the height, word + colour in the meter)
            const marker = document.createElement("a-box");
            marker.setAttribute("width", 0.034);
            marker.setAttribute("height", 0.0025);
            marker.setAttribute("depth", 0.014);
            marker.setAttribute("color", "#c62828");
            marker.object3D.visible = false;
            r.appendChild(marker);
            this.rulerMarker = marker;
            this.rulerTop = top;

            // clicking the ruler (mouse or VR laser) puts the device at that height
            const hit = document.createElement("a-box");
            hit.classList.add("clickable");
            hit.setAttribute("width", 0.04);
            hit.setAttribute("depth", 0.03);
            hit.setAttribute("height", 0.1);
            hit.setAttribute("position", "0 " + (top + 0.05) + " 0");
            hit.setAttribute("material", "opacity: 0; transparent: true; depthWrite: false");
            const rz = -(this.skin.data.halfW0 + 0.012);
            hit.addEventListener("click", (e) => {
                if (this.state !== "treat" || !e.detail || !e.detail.intersection) return;
                // read the height where the ray crosses the ruler's own plane (not the front of the
                // thick click box), so the mark you see is the height you get
                const cursor = e.detail.cursorEl || this.el;
                const rc = cursor.components.raycaster;
                let y;
                if (rc && rc.raycaster) {
                    const inv = new THREE.Matrix4().copy(this.arm.object3D.matrixWorld).invert();
                    const ray = rc.raycaster.ray.clone().applyMatrix4(inv);
                    const t = (rz - ray.origin.z) / ray.direction.z;
                    y = ray.origin.y + ray.direction.y * t;
                } else {
                    y = this.arm.object3D.worldToLocal(e.detail.intersection.point.clone()).y;
                }
                this.setHeight((y - top) * 100);
            });
            r.appendChild(hit);
            this.arm.appendChild(r);
        },

        updateRulerMarker: function () {
            if (!this.rulerMarker) return;
            const m = this.rulerMarker.object3D;
            m.visible = this.state === "treat";
            m.position.y = this.rulerTop + this.heightCm / 100;
            const d = CONFIG.distanceCm, good = Math.abs(this.heightCm - d.target) <= d.tol;
            if (good !== this._markerGood) {
                this._markerGood = good;
                this.rulerMarker.setAttribute("color", good ? "#2e7d32" : "#c62828");
            }
        },

        // towel on the arm: the skin cells outside a square hole over the spot turn into cloth when it is used
        buildTowel: function () {
            const c = this.spotCentre;
            this.skin.setTowel({ x: c.x, z: c.z, half: CONFIG.towelHoleMm / 2000 });
        },

        // nozzle tray from CONFIG
        buildNozzles: function () {
            const tray = document.getElementById("nozzle-tray");
            CONFIG.nozzles.forEach(function (n, i) {
                const s = n.mm / 1000;
                const holder = document.createElement("a-entity");
                holder.setAttribute("position", (i * 0.06) + " 0.01 0");
                holder.setAttribute("class", "clickable");
                holder.setAttribute("x0137-tool", "name: nozzle:" + n.id);
                holder.appendChild(nozzleMesh(n, 0.045));
                const label = document.createElement("a-entity");
                label.setAttribute("x0137-label", { value: n.mm + " " + i18n.t("unit.mm"), width: 0.05, fontSize: 240 });
                label.setAttribute("rotation", "-90 0 0");
                label.setAttribute("position", "0 0.006 0.032");
                holder.appendChild(label);
                tray.appendChild(holder);
            });
        },

        // nozzle under the window, light beam, footprint on the skin, glow, screen timer
        buildDeviceParts: function () {
            const dev = this.device;
            this.nozzleSlot = document.createElement("a-entity");
            this.nozzleSlot.setAttribute("position", "0 -0.003 0");
            dev.appendChild(this.nozzleSlot);

            this.footprint = document.createElement("a-entity");
            this.footprint.object3D.visible = false;
            this.arm.appendChild(this.footprint);

            this.glow = document.createElement("a-entity");
            this.glow.setAttribute("light", "type: point; color: #9db8ff; intensity: 0; distance: 0.25");
            this.glow.setAttribute("position", "0 -0.01 0");
            dev.appendChild(this.glow);

            const model = dev.components["x0137-voxel-model"];
            const sp = model && model.points.S;
            if (sp) {
                this.screen = document.createElement("a-text");
                this.screen.setAttribute("align", "center");
                this.screen.setAttribute("color", "#cfe3ff");
                this.screen.setAttribute("width", 0.2);
                this.screen.setAttribute("rotation", "-90 0 0");
                this.screen.setAttribute("position", sp.x + " " + (sp.y + 0.0015) + " " + sp.z);
                dev.appendChild(this.screen);
            }
            this.updateScreen();
        },

        shapeNozzle: function (n) {
            const s = n.mm / 1000;
            this.nozzleSlot.innerHTML = "";
            this.nozzleSlot.appendChild(nozzleMesh(n, s + 0.014));
            // beam: the light column from the window to the skin (scaled to the height every frame)
            if (this.beam) this.beam.parentNode.removeChild(this.beam);
            this.beam = document.createElement(n.shape === "round" ? "a-cylinder" : "a-box");
            if (n.shape === "round") this.beam.setAttribute("radius", s / 2);
            else { this.beam.setAttribute("width", s); this.beam.setAttribute("depth", s); }
            this.beam.setAttribute("height", 1);
            this.beam.setAttribute("material", "color: #8ab4ff; opacity: 0.12; transparent: true; depthWrite: false");
            this.device.appendChild(this.beam);
            // footprint on the skin
            this.footprint.innerHTML = "";
            const f = document.createElement(n.shape === "round" ? "a-circle" : "a-plane");
            if (n.shape === "round") f.setAttribute("radius", s / 2);
            else { f.setAttribute("width", s); f.setAttribute("height", s); }
            f.setAttribute("rotation", "-90 0 0");
            f.setAttribute("material", "color: #3f51b5; opacity: 0.3; transparent: true; depthWrite: false; side: double");
            this.footprint.appendChild(f);
            this.footprint.object3D.visible = true;
        },

        setGlow: function (on) {
            this.glow.setAttribute("light", "intensity", on ? 0.6 : 0);
            if (this.beam) this.beam.setAttribute("material", "opacity", on ? 0.35 : 0.12);
        },

        updateScreen: function () {
            if (!this.screen) return;
            const t = this.stats ? this.stats.t : 0;
            const left = Math.round(CONFIG.timeS.target - t);
            const v = left >= 0 ? "0:" + String(left).padStart(2, "0") : "+0:" + String(-left).padStart(2, "0");
            if (v !== this._screenText) {
                this._screenText = v;
                this.screen.setAttribute("value", v);
            }
        },

        // HUD panels
        buildMeter: function () {
            const m = document.createElement("div");
            m.className = "x0137-box x0137-meter";
            m.hidden = true;
            m.innerHTML = '<div><span class="lbl"></span>: <b class="val"></b> <span class="num"></span></div>' +
                '<div class="bar"><div class="band"></div><div class="pin"></div></div>';
            m.querySelector(".lbl").textContent = i18n.t("trainer.dist.label");
            const max = 12, d = CONFIG.distanceCm;
            const band = m.querySelector(".band");
            band.style.left = ((d.target - d.tol) / max * 100) + "%";
            band.style.width = (2 * d.tol / max * 100) + "%";
            ui.subEl.parentNode.insertBefore(m, ui.subEl);
            this.meter = m;
        },

        updateMeter: function (cm, status) {
            const key = cm.toFixed(1) + status;
            if (key === this._meterKey) return;
            this._meterKey = key;
            const val = this.meter.querySelector(".val");
            val.className = "val " + status;
            val.textContent = i18n.t("trainer.dist." + status);   // a word, not only a colour
            this.meter.querySelector(".num").textContent = "(" + cm.toFixed(1) + " " + i18n.t("unit.cm") + ")";
            this.meter.querySelector(".pin").style.left = Math.min(100, cm / 12 * 100) + "%";
            if (this.vr && this.vr.visible && this.state === "treat") this.vr.setText(this.vrTreatText(cm, status));
        },

        buildChecklist: function () {
            const style = document.createElement("style");
            style.textContent = CSS;
            document.head.appendChild(style);
            this.checkEl = document.createElement("div");
            this.checkEl.className = "x0137-box x0137-check";
            ui.topRight.appendChild(this.checkEl);
            this.renderChecklist();
        },

        renderChecklist: function () {
            if (!this.checkEl) return;
            const self = this;
            this.checkEl.innerHTML = "";
            const h = document.createElement("h2");
            h.textContent = i18n.t("trainer.checklist");
            const ol = document.createElement("ol");
            const current = this.currentStep();
            CONFIG.steps.forEach(function (step, i) {
                const li = document.createElement("li");
                const ok = !!self.done[step];
                li.className = ok ? "done" : "";
                const mark = document.createElement("span");
                mark.className = "mark";
                // step number, replaced by a text tick when done (a sign, never colour alone)
                mark.textContent = ok ? "✓" : (i + 1) + ".";
                const label = document.createElement("span");
                label.textContent = i18n.t("trainer.step." + step);
                li.append(mark, label);
                ol.appendChild(li);
                // the current step is highlighted and says exactly what to click
                if (step === current) {
                    li.classList.add("now");
                    const hint = document.createElement("div");
                    hint.className = "hint";
                    hint.textContent = fmt(self.state === "intro" && (step === "distance" || step === "time")
                        ? "trainer.hint.start" : "trainer.hint." + step, { spot: CONFIG.spots[0].diameterMm });
                    ol.appendChild(hint);
                }
                // vitamin E is a question, not an object in the scene
                if (step === "vitamin" && self.vitaminTaken === null) {
                    const ask = document.createElement("div");
                    ask.className = "ask";
                    [["trainer.vitamin.yes", true], ["trainer.vitamin.no", false]].forEach(function (pair) {
                        const b = document.createElement("button");
                        b.type = "button";
                        b.textContent = i18n.t(pair[0]);
                        b.addEventListener("click", function () { self.answerVitamin(pair[1]); });
                        ask.appendChild(b);
                    });
                    ol.appendChild(ask);
                }
            });
            this.checkEl.append(h, ol);
            this.updateGuide();
            this.refreshVr();
        },

        // the first step not handled yet (a "Not yet" answer to vitamin E counts as handled)
        currentStep: function () {
            return CONFIG.steps.find((s) => !(this.done[s] || (s === "vitamin" && this.vitaminTaken !== null))) || null;
        },

        // a bobbing arrow above the object the current step needs
        updateGuide: function () {
            if (!this.arrow) return;
            const step = this.currentStep();
            let target = null;
            if (this.state === "intro" || this.state === "treat") {
                if (step === "goggles") target = document.querySelector("[x0137-tool='name: goggles']");
                else if (step === "sunscreen") target = this.creamReady ? this.moles.find((m) => !m.dataset.covered) : document.getElementById("tube");
                else if (step === "towel") target = document.querySelector("[x0137-tool='name: towel']");
                else if (step === "nozzle") target = document.getElementById("nozzle-tray");
            }
            if (!target) { this.arrow.object3D.visible = false; return; }
            const p = target.object3D.getWorldPosition(new THREE.Vector3());
            if (target.id === "nozzle-tray") p.x += 0.12;
            const small = target.dataset && target.classList.contains("mole");
            this.arrow.object3D.position.set(p.x, p.y + (small ? 0.03 : 0.07), p.z);
            this.arrow.object3D.visible = true;
        },

        buildArrow: function () {
            const a = document.createElement("a-entity");
            const bob = document.createElement("a-entity");
            bob.setAttribute("animation", "property: position; from: 0 0.012 0; to: 0 0 0; dir: alternate; loop: true; dur: 600; easing: easeInOutSine");
            const cone = document.createElement("a-cone");
            cone.setAttribute("radius-bottom", 0.012);
            cone.setAttribute("radius-top", 0);
            cone.setAttribute("height", 0.022);
            cone.setAttribute("rotation", "180 0 0");
            cone.setAttribute("color", "#f9a825");
            const stem = document.createElement("a-box");
            stem.setAttribute("width", 0.008);
            stem.setAttribute("height", 0.02);
            stem.setAttribute("depth", 0.008);
            stem.setAttribute("position", "0 0.021 0");
            stem.setAttribute("color", "#f9a825");
            bob.append(cone, stem);
            a.appendChild(bob);
            a.object3D.visible = false;
            this.el.appendChild(a);
            this.arrow = a;
        },

        // what the goggles change: an orange frame around the view + a "Goggles on" badge
        gogglesView: function (on) {
            if (on && !this.gogglesEl) {
                const g = document.createElement("div");
                g.className = "x0137-goggles";
                const badge = document.createElement("span");
                badge.textContent = i18n.t("trainer.goggles.badge");
                g.appendChild(badge);
                document.body.appendChild(g);
                this.gogglesEl = g;
            }
            if (this.gogglesEl) this.gogglesEl.hidden = !on;
        },

        // desktop: start looking down at the arm (in VR the headset decides)
        lookDown: function () {
            const cam = document.getElementById("cam");
            const lc = cam && cam.components["look-controls"];
            if (lc && lc.pitchObject) lc.pitchObject.rotation.x = -0.95;
        },

        // ---- VR panel content for the current state ----
        refreshVr: function () {
            if (!this.vr || !this.vr.visible) return;
            const btn = (key, onPress, primary) => ({ label: i18n.t(key), onPress: onPress, primary: !!primary });
            if (this.state === "intro") {
                const step = this.currentStep();
                const text = step ? i18n.t("trainer.step." + step) + "\n" +
                    fmt(step === "distance" || step === "time" ? "trainer.hint.start" : "trainer.hint." + step, { spot: CONFIG.spots[0].diameterMm }) : "";
                const rows = [];
                if (this.vitaminTaken === null) {
                    rows.push([btn("trainer.vitamin.yes", () => this.answerVitamin(true)), btn("trainer.vitamin.no", () => this.answerVitamin(false))]);
                }
                rows.push([btn("trainer.btn.start", () => speech.fire("start", "button"), true)]);
                this.vr.set(text, rows);
            } else if (this.state === "treat") {
                this.vr.set(this.vrTreatText(this.heightCm, null), [[
                    btn("trainer.btn.up", () => this.setHeight(this.heightCm + CONFIG.heightStepCm)),
                    btn("trainer.btn.down", () => this.setHeight(this.heightCm - CONFIG.heightStepCm))
                ]]);
            } else if (this.state === "result") {
                this.vr.set(this.resultText || "", [[btn("trainer.btn.retry", () => window.location.reload(), true)]], 0.3);
            }
        },

        vrTreatText: function (cm, status) {
            const d = CONFIG.distanceCm;
            status = status || (cm < d.target - d.tol ? "close" : cm > d.target + d.tol ? "far" : "good");
            return i18n.t("trainer.vr.treat") + "\n" + i18n.t("trainer.dist.label") + ": " +
                i18n.t("trainer.dist." + status) + " (" + cm.toFixed(1) + " " + i18n.t("unit.cm") + ")";
        },

        answerVitamin: function (taken) {
            this.vitaminTaken = taken;
            if (taken) this.markDone("vitamin");
            else { this.renderChecklist(); this.say(i18n.t("trainer.tip.vitamin")); }
        },

        vrSubtitle: function (on) {
            const t = document.getElementById("x0137-vr-subtitle");
            if (t) t.setAttribute("visible", on);
        }
    });

    // a nozzle filter: grey square plate with a blue round or square opening
    function nozzleMesh(n, plateSize) {
        const s = n.mm / 1000;
        const g = document.createElement("a-entity");
        const plate = document.createElement("a-box");
        plate.setAttribute("width", plateSize);
        plate.setAttribute("height", 0.006);
        plate.setAttribute("depth", plateSize);
        plate.setAttribute("color", "#8a939c");
        const hole = document.createElement(n.shape === "round" ? "a-cylinder" : "a-box");
        if (n.shape === "round") { hole.setAttribute("radius", s / 2); }
        else { hole.setAttribute("width", s); hole.setAttribute("depth", s); }
        hole.setAttribute("height", 0.0065);
        hole.setAttribute("color", "#6fa8ff");
        g.append(plate, hole);
        return g;
    }

    // x0137-tool: anything the user clicks in Trainer mode (goggles, moles, towel, nozzles)
    AFRAME.registerComponent("x0137-tool", {
        schema: { name: { type: "string" } },
        init: function () {
            const el = this.el;
            this.base = el.object3D.scale.clone();
            el.addEventListener("mouseenter", () => el.object3D.scale.copy(this.base).multiplyScalar(1.15));
            el.addEventListener("mouseleave", () => el.object3D.scale.copy(this.base));
            el.addEventListener("click", () => {
                if (!el.object3D.visible) return;
                el.sceneEl.systems["x0137-trainer"].use(this.data.name, el);
            });
        }
    });

    window.X0137_TRAINER_CONFIG = CONFIG;
})();