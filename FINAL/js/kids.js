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