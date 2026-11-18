// Capstone – First Laser Visit – 240137 – prefix x0137-
// kids.js: Kid mode. One system drives 4 states: waiting -> treatment -> helper -> done.
//   helper = "Your turn": the child puts on goggles, covers the moles with sunscreen, covers the
//   healthy skin with a cloth, picks the light window that covers the doctor's spot, and holds the
//   light on it at the right distance (the same order as the adult Trainer, simplified).
// Components: x0137-state-group (shows its children only in the listed states), x0137-explorable (hover highlight + click/trigger select).

(function () {
    const i18n = window.X0137_I18N;
    const speech = window.X0137_SPEECH;
    const ui = window.X0137_UI;

    const OBJECTS = ["couch", "goggles", "device"];
    const VISITS = 6;
    const WAND_REST = "1.6 1.2 -2";
    // where doctor stands: by the window at the start, behind the little table for "Your turn"
    const DOCTOR = { home: { pos: "1.1 0 -0.9", rot: "0 -30 0" }, table: { pos: "-0.14 0 0.18", rot: "0 0 0" } };
    // "Your turn" settings (placeholders for Dr Smirnova, like the Trainer's CONFIG)
    const HELPER = {
        lesion: { id: "h1", type: "vitiligo", diameterMm: 20, along: 0.5, across: 0 },
        moles: [{ along: 0.18, across: 0.02 }, { along: 0.8, across: -0.016 }],
        towelHoleMm: 36,
        windows: [{ id: "w8", mm: 8 }, { id: "w16", mm: 16 }, { id: "w24", mm: 24 }],
        distanceCm: { target: 4, tol: 1 }, // kinder band than the Trainer's
        shineS: 4, // seconds of good light to finish
        startHeightCm: 7,
        stepCm: 0.5,
        maxRed: 0.3 // too close only turns the skin a little pink
    };

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
    function fmt(key, vals) {
        return i18n.t(key).replace(/\{(\w+)\}/g, function (m, k) { return vals[k] != null ? vals[k] : m; });
    }

    AFRAME.registerSystem("x0137-kids", {
        init: function () {
            this.state = null;
            this.groups = [];
            this.explored = {};
            this.lastLine = "";
            this.queue = []; // lines still to say in this step
            this.paused = false;
            this.step = ""; // sub-step inside treatment: explore | ask | demo
            this.counts = {}; // wait/again per state, for adaptive pacing

            this.onIntent = this.onIntent.bind(this);
            window.addEventListener("x0137-intent", this.onIntent);
            window.addEventListener("x0137-nomatch", () => this.say(i18n.t("speech.nomatch")));

            this.el.addEventListener("loaded", () => {
                speech.init({ intents: ["wait", "again", "next", "q_pain", "q_light", "q_goggles", "q_skin"] });
                ui.init({ questions: this.questionButtons() });
                this.bindGuide();
                // VR: the same buttons as an in-scene panel, front-left of the seated child
                this.vr = ui.vrPanel({ position: "-0.6 1.2 0.95", rotation: "-12 45 0", width: 0.6, textHeight: 0.06 });
                this.refreshVr();
                this.buildHelper();
                this.setState("waiting");
            });
            // the in-scene subtitle is only needed inside the headset
            this.el.addEventListener("enter-vr", () => {
                this.vrSubtitle(true);
                if (this.vr) this.vr.show();
            });
            this.el.addEventListener("exit-vr", () => {
                this.vrSubtitle(false);
                if (this.vr) this.vr.hide();
            });
        },

        registerGroup: function (el) { this.groups.push(el); },

        setState: function (state) {
            this.state = state;
            // group can list several states, e.g. x0137-state-group="helper done"
            this.groups.forEach(function (g) {
                g.object3D.visible = String(g.getAttribute("x0137-state-group")).split(/\s+/).indexOf(state) !== -1;
            });
            this.placeDoctor(state === "helper" || state === "done" ? "table" : "home");
            this.frameView(state === "helper" || state === "done");
            if (state !== "helper") this.leaveHelper();
            if (state !== "done") {
                clearInterval(this.lapseTimer);
                this.removeParentCard();
            }
            if (state === "waiting") {
                this.explored = {};
                this.putGoggles(false);
                this.setLight(false);
                this.healProgress = 0;
                const w = document.getElementById("kid-wand");
                if (w) { w.removeAttribute("animation__move"); w.setAttribute("position", WAND_REST); w.object3D.rotation.set(0, 0, 0); }
                this.setPatchColor(this.patchColor(0));
                this.resetHelper();
                this.playClip("Wave");
                this.sayAll(["kids.waiting.hello", "kids.waiting.howto"]);
            } else if (state === "treatment") {
                this.step = "explore";
                this.sayAll(["kids.treatment.hello"]);
            } else if (state === "helper") {
                this.startHelper();
            } else if (state === "done") {
                this.showDone();
            }
            this.refreshVr();
        },

        // one object explored; after all 3 the guide offers the demo
        explore: function (name) {
            if (name === "door" && this.state === "waiting") {
                this.setState("treatment");
                return;
            }
            if (this.state === "helper") {
                if (name === "kgoggles") this.helperGoggles();
                else if (name === "tube") this.takeCream();
                else if (name.indexOf("mole:") === 0) this.coverMole(+name.slice(5));
                else if (name === "towel") this.layTowel();
                else if (name.indexOf("window:") === 0) this.pickWindow(name.slice(7));
                return;
            }
            if (this.state !== "treatment" || OBJECTS.indexOf(name) === -1) return;
            this.explored[name] = true;
            const lines = ["kids.obj." + name];
            if (OBJECTS.every((o) => this.explored[o])) {
                this.step = "ask";
                lines.push("kids.ask.demo");
            }
            this.sayAll(lines);
        },

        // ------------------------------------------------------------ demo
        // goggles on the doctor -> hand piece flies to the patch on the doctor's hand ->
        // one soft light (fades in and out, no flashing) + a quiet hum with a subtitle -> "done"
        runDemo: async function () {
            const id = this.demoId = (this.demoId || 0) + 1;
            this.step = "demo";
            const ok = () => this.demoId === id && this.step === "demo" && this.state === "treatment" && !this.paused;

            if (!(await this.sayAll(["kids.demo.goggles"])) || !ok()) return this.abortDemo(id);
            this.putGoggles(true);
            await sleep(500);
            if (!ok()) return this.abortDemo(id);

            const line = this.sayAll(["kids.demo.device"]);
            await this.moveWand(true);
            if (!(await line) || !ok()) return this.abortDemo(id);

            this.setLight(true);
            const light = Promise.all([this.sayAll(["kids.demo.light"]), sleep(2500)]);
            // hum is a sound, so it gets its own subtitle next to the spoken line
            ui.subtitle(i18n.t("kids.demo.light") + "  " + i18n.t("kids.sound.hum"));
            const finished = (await light)[0];
            this.setLight(false);
            if (!finished || !ok()) return this.abortDemo(id);

            this.moveWand(false);
            if (!(await this.sayAll(["kids.demo.done"])) || !ok()) return this.abortDemo(id);
            this.putGoggles(false);
            this.setState("helper");
        },

        // question, Wait or Again during the demo stops it; "Go on" then starts it again
        abortDemo: function (id) {
            if (id !== this.demoId) return;
            this.setLight(false);
            this.moveWand(false);
            this.putGoggles(false);
            if (this.state === "treatment") this.step = "ask";
        },

        putGoggles: function (on) {
            const t = document.getElementById("table-goggles");
            if (this.gogglesObj) this.gogglesObj.visible = on;
            if (t) t.object3D.visible = !on;
        },

        // moves the hand piece to a point just in front of the doctor's patch (or back to rest)
        moveWand: function (toHand) {
            const wand = document.getElementById("kid-wand");
            if (!wand) return Promise.resolve();
            let to = WAND_REST;
            if (toHand && this.patchObj) {
                const patch = this.patchObj;
                const target = patch.getWorldPosition(new THREE.Vector3());
                // 9 cm in front of the patch, in the doctor's facing direction
                const front = new THREE.Vector3(0, 0, 1).applyQuaternion(patch.getWorldQuaternion(new THREE.Quaternion()));
                to = target.clone().addScaledVector(front, 0.09);
                to = to.x.toFixed(3) + " " + to.y.toFixed(3) + " " + to.z.toFixed(3);
                wand.object3D.lookAt(target);
            } else {
                wand.object3D.rotation.set(0, 0, 0);
            }
            return new Promise((resolve) => {
                const done = () => { wand.removeEventListener("animationcomplete__move", done); resolve(); };
                wand.addEventListener("animationcomplete__move", done);
                wand.setAttribute("animation__move", { property: "position", to: to, dur: 1400, easing: "easeInOutSine" });
                setTimeout(done, 1600); // safety net if the animation is paused
            });
        },
        // soft light: fades in over 0.4 s, stays, fades out; never flashes
        setLight: function (on) {
            const face = document.getElementById("kid-wand-light");
            const glow = document.getElementById("kid-wand-glow");
            if (face) face.setAttribute("animation__glow", { property: "material.emissiveIntensity", to: on ? 1 : 0.2, dur: 400, easing: "easeInOutSine" });
            if (glow) glow.setAttribute("animation__glow", { property: "light.intensity", to: on ? 0.8 : 0, dur: 400, easing: "easeInOutSine" });
            this.setPatchColor(on ? "#d6e4ff" : this.patchColor(this.healProgress || 0));
            if (on) this.hum(2.6);
        },

        // quiet two-tone hum (Web Audio), ramped so it never clicks
        hum: function (seconds) {
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                this.audio = this.audio || new Ctx();
                const a = this.audio, g = a.createGain(), t = a.currentTime;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.035, t + 0.4);
                g.gain.setValueAtTime(0.035, t + seconds - 0.5);
                g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
                g.connect(a.destination);
                [220, 330].forEach(function (f) {
                    const o = a.createOscillator();
                    o.type = "sine";
                    o.frequency.value = f;
                    o.connect(g);
                    o.start(t);
                    o.stop(t + seconds + 0.05);
                });
            } catch (e) { /* no audio: the subtitle still shows */ }
        },

        chime: function () {
            try {
                if (!this.audio) return; // only after hum has unlocked audio
                const a = this.audio, o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
                o.type = "sine";
                o.frequency.value = 880;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.04, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
                o.connect(g).connect(a.destination);
                o.start(t);
                o.stop(t + 0.55);
            } catch (e) { /* ignore */ }
        },

        // "Your turn" (helper)
        // Steps: goggles -> cream -> towel -> window -> shine -> finished
        buildHelper: function () {
            const skinEl = document.getElementById("kid-skin");
            this.kidSkin = skinEl && skinEl.components["x0137-voxel-skin"];
            this.kidArm = document.getElementById("kid-arm");
            this.kidDevice = document.getElementById("kid-hand-device");
            this.deviceRest = this.kidDevice.object3D.position.clone();
            this.rightHand = document.getElementById("right-hand");
            this.leftHand = document.getElementById("left-hand");
            if (this.kidSkin) {
                const l = HELPER.lesion, p = this.kidSkin.pointAt(l.along, l.across);
                this.spotCells = this.kidSkin.addLesion({ id: l.id, type: l.type, diameterMm: l.diameterMm, x: p.x, z: p.z });
                this.spotCentre = p;
                // moles: dark blocks the child covers with sunscreen
                this.moles = HELPER.moles.map((m, i) => {
                    const q = this.kidSkin.pointAt(m.along, m.across);
                    return this.kidSkin.addMole(q.x, q.z, (e) => {
                        e.setAttribute("x0137-explorable", "name: mole:" + i);
                        e.setAttribute("color", "#4a2e20");
                    });
                }).filter(Boolean);
                this.buildTowel();
            }
            this.buildArrow();
            // 3 light windows on the tray, each a grey plate with a round blue opening
            const tray = document.getElementById("kid-tray");
            HELPER.windows.forEach((w, i) => {
                const holder = document.createElement("a-entity");
                holder.classList.add("clickable");
                holder.setAttribute("x0137-explorable", "name: window:" + w.id);
                holder.setAttribute("position", (0.06 + i * 0.06) + " 0.01 0");
                holder.appendChild(windowMesh(w.mm, 0.05));
                tray.appendChild(holder);
            });
            // under device: chosen window, light column and soft glow
            this.windowSlot = document.createElement("a-entity");
            this.windowSlot.setAttribute("position", "0 -0.003 0");
            this.kidDevice.appendChild(this.windowSlot);
            this.glow = document.createElement("a-entity");
            this.glow.setAttribute("light", "type: point; color: #a9c6ff; intensity: 0; distance: 0.3");
            this.glow.setAttribute("position", "0 -0.01 0");
            this.kidDevice.appendChild(this.glow);
            this.footprint = document.createElement("a-entity");
            this.footprint.object3D.visible = false;
            this.kidArm.appendChild(this.footprint);
            // HTML: height buttons, "Hold the light", the distance + light meter
            this.controls = document.createElement("div");
            this.controls.className = "x0137-row";
            this.controls.hidden = true;
            ui.row.parentNode.insertBefore(this.controls, ui.row);
            const add = (key, cls) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "x0137-btn" + (cls ? " " + cls : "");
                b.textContent = i18n.t(key);
                this.controls.appendChild(b);
                return b;
            };
            add("trainer.btn.up").addEventListener("click", () => this.setHeight(this.heightCm + HELPER.stepCm));
            add("trainer.btn.down").addEventListener("click", () => this.setHeight(this.heightCm - HELPER.stepCm));
            const hold = add("kids.btn.shine", "home");
            hold.addEventListener("pointerdown", (e) => { e.preventDefault(); this.startShine("button"); });
            ["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
                hold.addEventListener(t, () => { if (this.shineSource === "button") this.stopShine(); }));
            this.meter = document.createElement("div");
            this.meter.className = "x0137-box x0137-meter";
            this.meter.hidden = true;
            this.meter.innerHTML = '<div><span class="lbl"></span>: <b class="val"></b> <span class="num"></span></div>' +
                '<div class="bar"><div class="band"></div><div class="pin"></div></div>' +
                '<div><span class="lbl2"></span>: <span class="sec"></span></div><div class="bar"><div class="fill"></div></div>';
            this.meter.querySelector(".lbl").textContent = i18n.t("trainer.dist.label");
            this.meter.querySelector(".lbl2").textContent = i18n.t("kids.help.light");
            const d = HELPER.distanceCm, band = this.meter.querySelector(".band");
            band.style.left = ((d.target - d.tol) / 12 * 100) + "%";
            band.style.width = (2 * d.tol / 12 * 100) + "%";
            ui.topRight.appendChild(this.meter);   // top right, so it never covers the arm
            this.bindHelperInput();
            this.resetHelper();
        },

        bindHelperInput: function () {
            const skinEl = document.getElementById("kid-skin");
            // desktop / touch: hold the mouse or finger on the spot
            skinEl.addEventListener("mousedown", () => {
                if (this.state !== "helper" || this.el.is("vr-mode")) return;
                this.pointerDown = true;
                this.aimFromPointer();
                this.startShine("pointer");
            });
            const release = () => {
                if (!this.pointerDown) return;
                this.pointerDown = false;
                if (this.shineSource === "pointer") this.stopShine();
            };
            window.addEventListener("mouseup", release);
            window.addEventListener("touchend", release);
            window.addEventListener("wheel", (e) => {
                if (this.state === "helper") this.setHeight(this.heightCm + (e.deltaY > 0 ? -1 : 1) * HELPER.stepCm);
            }, { passive: true });
            window.addEventListener("keydown", (e) => {
                if (this.state !== "helper" || e.repeat) return;
                if (e.key === "e" || e.key === "E" || e.key === "у" || e.key === "У") this.setHeight(this.heightCm + HELPER.stepCm);
                if (e.key === "q" || e.key === "Q" || e.key === "й" || e.key === "Й") this.setHeight(this.heightCm - HELPER.stepCm);
            });
            // VR: laser on the spot + hold trigger; thumbstick or B/Y up, A/X down
            this.stickY = 0;
            [this.rightHand, this.leftHand].forEach((hand) => {
                if (!hand) return;
                hand.addEventListener("triggerdown", () => {
                    const rc = hand.components.raycaster;
                    const first = rc && rc.intersections && rc.intersections[0];
                    if (this.state === "helper" && first && this.kidSkin && first.object === this.kidSkin.mesh) this.startShine("trigger");
                });
                hand.addEventListener("triggerup", () => { if (this.shineSource === "trigger") this.stopShine(); });
                hand.addEventListener("thumbstickmoved", (e) => { this.stickY = e.detail.y || 0; });
                const up = () => { if (this.state === "helper") this.setHeight(this.heightCm + HELPER.stepCm); };
                const down = () => { if (this.state === "helper") this.setHeight(this.heightCm - HELPER.stepCm); };
                hand.addEventListener("bbuttondown", up);
                hand.addEventListener("ybuttondown", up);
                hand.addEventListener("abuttondown", down);
                hand.addEventListener("xbuttondown", down);
            });
        },

        resetHelper: function () {
            this.helperStep = "goggles";
            this.windowMm = null;
            this.heightCm = HELPER.startHeightCm;
            this.aim = null;
            this.shineT = 0;
            this.stopShine();
            if (this.kidSkin) this.kidSkin.reset();
            if (this.kidDevice) { this.kidDevice.object3D.position.copy(this.deviceRest); this.kidDevice.object3D.rotation.set(0, 0, 0); }
            if (this.windowSlot) this.windowSlot.innerHTML = "";
            if (this.beam) { this.beam.parentNode.removeChild(this.beam); this.beam = null; }
            if (this.footprint) this.footprint.object3D.visible = false;
            const g = document.getElementById("kid-goggles");
            if (g) g.object3D.visible = true;
            this.gogglesView(false);
            this.creamReady = false;
            (this.moles || []).forEach((m) => {
                delete m.dataset.covered;
                m.setAttribute("color", "#4a2e20");
                m.components["x0137-explorable"] && m.components["x0137-explorable"].base.set(1, 1, 1);
                m.object3D.scale.set(1, 1, 1);
            });
            const cloth = document.getElementById("kid-cloth");
            if (cloth) cloth.object3D.visible = true;
            if (this.towel) this.towel.object3D.visible = false;
            this.updateGuide();
        },

        startHelper: function () {
            this.resetHelper();
            this.controls.hidden = true;
            this.meter.hidden = true;
            this.sayAll(["kids.help.intro"]);
        },

        leaveHelper: function () {
            this.stopShine();
            if (this.arrow) this.arrow.object3D.visible = false;
            if (this.controls) this.controls.hidden = true;
            if (this.meter) this.meter.hidden = true;
            this.gogglesView(false);
        },

        helperGoggles: function () {
            if (this.helperStep !== "goggles") return;
            document.getElementById("kid-goggles").object3D.visible = false;
            if (this.gogglesObj) this.gogglesObj.visible = true;   // the doctor puts theirs on too
            this.gogglesView(true);
            this.helperStep = "cream";
            this.sayAll(["kids.help.goggles"]);
            this.updateGuide();
            this.refreshVr();
        },
        // sunscreen: take cream from the tube, then click each mole
        takeCream: function () {
            if (this.helperStep !== "cream") { this.stepHint(); return; }
            this.creamReady = true;
            const tube = document.getElementById("kid-tube");
            tube.setAttribute("animation__take", { property: "position", from: "-0.15 0.06 0", to: "-0.15 0.022 0", dur: 500, easing: "easeOutQuad" });
            this.say(i18n.t("kids.help.cream.took"));
            this.updateGuide();
        },

        coverMole: function (i) {
            const m = this.moles[i];
            if (!m || m.dataset.covered) return;
            if (this.helperStep !== "cream") { this.stepHint(); return; }
            if (!this.creamReady) { this.say(i18n.t("kids.help.cream.first")); return; }
            m.dataset.covered = "1";
            m.setAttribute("color", "#ffffff");                 // a white blob of cream
            m.components["x0137-explorable"].base.set(2, 2.4, 2);
            m.object3D.scale.set(2, 2.4, 2);
            const n = this.moles.filter((x) => x.dataset.covered).length;
            if (n < this.moles.length) {
                this.say(fmt("kids.help.cream.mole", { n: n, m: this.moles.length }));
            } else {
                this.helperStep = "towel";
                this.sayAll(["kids.help.towel"]);
            }
            this.updateGuide();
        },

        // the cloth covers the healthy skin; only the spot stays open
        layTowel: function () {
            if (this.helperStep !== "towel") { this.stepHint(); return; }
            document.getElementById("kid-cloth").object3D.visible = false;
            this.towel.object3D.visible = true;
            this.helperStep = "window";
            this.sayAll(["kids.help.towelDone"]);
            this.updateGuide();
        },

        // what to do now, when the child clicks something out of order
        stepHint: function () {
            const st = this.helperStep;
            const key = st === "goggles" ? "kids.help.gogglesFirst" :
                        st === "cream" ? (this.creamReady ? "kids.help.cream.took" : "kids.help.cream.first") :
                        st === "towel" ? "kids.help.towelFirst" :
                        st === "window" ? "kids.help.windowFirst" : null;
            if (key) this.say(i18n.t(key));
        },

        buildTowel: function () {
            const c = this.spotCentre, d = this.kidSkin.data;
            const half = HELPER.towelHoleMm / 2000;
            this.kidSkin.setTowel({ x: c.x, z: c.z, half: half });
            const y = d.top0 + 0.006, zMax = d.halfW0 + 0.012;
            const t = document.createElement("a-entity");
            t.object3D.visible = false;
            [[d.x0, c.x - half, -zMax, zMax], [c.x + half, d.x1, -zMax, zMax],
             [c.x - half, c.x + half, -zMax, c.z - half], [c.x - half, c.x + half, c.z + half, zMax]].forEach(function (p) {
                const b = document.createElement("a-box");
                b.setAttribute("width", p[1] - p[0]);
                b.setAttribute("depth", p[3] - p[2]);
                b.setAttribute("height", 0.004);
                b.setAttribute("position", ((p[0] + p[1]) / 2) + " " + y + " " + ((p[2] + p[3]) / 2));
                b.setAttribute("color", "#f5f5f0");
                t.appendChild(b);
            });
            this.kidArm.appendChild(t);
            this.towel = t;
        },

        // bobbing orange arrow above the thing to click next
        buildArrow: function () {
            const a = document.createElement("a-entity");
            const bob = document.createElement("a-entity");
            bob.setAttribute("animation", "property: position; from: 0 0.015 0; to: 0 0 0; dir: alternate; loop: true; dur: 600; easing: easeInOutSine");
            const cone = document.createElement("a-cone");
            cone.setAttribute("radius-bottom", 0.016);
            cone.setAttribute("radius-top", 0);
            cone.setAttribute("height", 0.03);
            cone.setAttribute("rotation", "180 0 0");
            cone.setAttribute("color", "#f9a825");
            const stem = document.createElement("a-box");
            stem.setAttribute("width", 0.01);
            stem.setAttribute("height", 0.026);
            stem.setAttribute("depth", 0.01);
            stem.setAttribute("position", "0 0.028 0");
            stem.setAttribute("color", "#f9a825");
            bob.append(cone, stem);
            a.appendChild(bob);
            a.object3D.visible = false;
            this.el.appendChild(a);
            this.arrow = a;
        },

        updateGuide: function () {
            if (!this.arrow) return;
            let target = null;
            if (this.state === "helper") {
                const st = this.helperStep;
                if (st === "goggles") target = document.getElementById("kid-goggles");
                else if (st === "cream") target = this.creamReady ? (this.moles || []).find((m) => !m.dataset.covered) : document.getElementById("kid-tube");
                else if (st === "towel") target = document.getElementById("kid-cloth");
                else if (st === "window") target = document.querySelector("#kid-tray [x0137-explorable='name: window:w16']") || document.getElementById("kid-tray");
            }
            if (!target) { this.arrow.object3D.visible = false; return; }
            const p = target.object3D.getWorldPosition(new THREE.Vector3());
            const small = (this.moles || []).indexOf(target) !== -1;
            this.arrow.object3D.position.set(p.x, p.y + (small ? 0.035 : 0.06), p.z);
            this.arrow.object3D.visible = true;
        },

        pickWindow: function (id) {
            if (this.helperStep === "finished") return;
            if (this.helperStep !== "window" && this.helperStep !== "shine") { this.stepHint(); return; }
            const w = HELPER.windows.find((x) => x.id === id);
            if (!w) return;
            this.windowMm = w.mm;
            this.shapeWindow(w.mm);
            if (w.mm < HELPER.lesion.diameterMm) {
                this.helperStep = "window";
                this.controls.hidden = true;
                this.meter.hidden = true;
                this.say(i18n.t("kids.help.small"));
            } else {
                this.helperStep = "shine";
                this.controls.hidden = false;
                this.meter.hidden = false;
                this.sayAll(["kids.help.right", "kids.help.shine"]);
            }
            this.updateGuide();
            this.refreshVr();
        },

        // the chosen window under the device + the light column + the outline it makes on the skin
        shapeWindow: function (mm) {
            const s = mm / 1000;
            this.windowSlot.innerHTML = "";
            this.windowSlot.appendChild(windowMesh(mm, s + 0.014));
            if (this.beam) this.beam.parentNode.removeChild(this.beam);
            this.beam = document.createElement("a-cylinder");
            this.beam.setAttribute("radius", s / 2);
            this.beam.setAttribute("height", 1);
            this.beam.setAttribute("material", "color: #8ab4ff; opacity: 0.15; transparent: true; depthWrite: false");
            this.beam.object3D.visible = false; // shown once the device is over the arm
            this.kidDevice.appendChild(this.beam);
            this.footprint.innerHTML = "";
            const f = document.createElement("a-circle");
            f.setAttribute("radius", s / 2);
            f.setAttribute("rotation", "-90 0 0");
            f.setAttribute("material", "color: #3f51b5; opacity: 0.3; transparent: true; depthWrite: false; side: double");
            this.footprint.appendChild(f);
            this.footprint.object3D.visible = false;
        },

        setHeight: function (cm) {
            this.heightCm = Math.max(1, Math.min(12, cm));
        },

        aimFromPointer: function () {
            const rc = this.el.components.raycaster;
            const hit = rc && rc.intersections && rc.intersections[0];
            if (!hit || !this.kidSkin || hit.object !== this.kidSkin.mesh) return;
            const p = this.kidArm.object3D.worldToLocal(hit.point.clone());
            this.aim = { x: p.x, z: p.z };
        },

        aimFromLaser: function () {
            for (const hand of [this.rightHand, this.leftHand]) {
                const rc = hand && hand.components.raycaster;
                const hit = rc && rc.intersections && rc.intersections.find((x) => x.object === this.kidSkin.mesh);
                if (!hit) continue;
                const p = this.kidArm.object3D.worldToLocal(hit.point.clone());
                this.aim = { x: p.x, z: p.z };
                return;
            }
        },

        startShine: function (source) {
            if (this.state !== "helper" || this.shining) return;
            if (this.helperStep !== "shine") { this.stepHint(); return; }
            if (!this.aim) return;
            this.shining = true;
            this.shineSource = source;
            this.glow.setAttribute("light", "intensity", 0.7);
            if (this.beam) this.beam.setAttribute("material", "opacity", 0.35);
            this.startHum();
        },

        stopShine: function () {
            this.shining = false;
            this.shineSource = null;
            if (this.glow) this.glow.setAttribute("light", "intensity", 0);
            if (this.beam) this.beam.setAttribute("material", "opacity", 0.15);
            this.stopHum();
        },