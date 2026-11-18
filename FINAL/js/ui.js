// Capstone – First Dermatologis and Laser treatment Visit – 240137 – prefix x0137-
// ui.js: shared HUD for both scenes (HTML overlay on top of the A-Frame canvas).
//   - Home button (visible in every state)
//   - subtitle panel: every spoken line and every sound shows as text
//   - "I heard: …" line for the mic
//   - pacing buttons (Wait / Again / Go on) + question buttons, the fallback for voice
//   - hold-to-talk mic button, hidden when recognition is missing or denied
// In VR the HTML overlay is not visible, so subtitles are also copied to an in-scene

(function () {
    const i18n = window.X0137_I18N;
    const speech = window.X0137_SPEECH;

    // same palette as the landing page
    const CSS = `
    .x0137-hud { position: fixed; inset: 0; z-index: 10; pointer-events: none;
        font: 15px/1.4 Arial, Helvetica, sans-serif; }
    .x0137-hud button, .x0137-hud a, .x0137-box { pointer-events: auto; }
    .x0137-hud [hidden], .x0137-sub:empty, .x0137-heard:empty, .x0137-status:empty { display: none; }
    .x0137-top, .x0137-bottom { position: absolute; left: 12px; right: 12px; display: flex; gap: 8px; }
    .x0137-top { top: 12px; justify-content: space-between; align-items: flex-start; }
    .x0137-bottom { bottom: 12px; flex-direction: column; align-items: center; }
    .x0137-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
    .x0137-btn { font: bold 15px Arial, Helvetica, sans-serif; padding: 10px 14px; border: 2px solid #283593;
        background: #fff; color: #283593; text-decoration: none; cursor: pointer; }
    .x0137-btn.home, .x0137-mic { background: #283593; color: #fff; }
    .x0137-mic.on { background: #c62828; }
    .x0137-btn.lit { background: #ffd54f; }
    .x0137-sub { max-width: 760px; padding: 10px 14px; background: #283593; color: #fff; font-size: 18px; }
    .x0137-heard, .x0137-status { padding: 3px 8px; background: #fff; color: #1a237e; }
    /* white boxes: checklist, parent card, meters */
    .x0137-box { max-width: 330px; padding: 8px 12px; background: #fff; color: #1a1a2e; border: 2px solid #283593; }
    .x0137-box h2 { margin: -8px -12px 6px; padding: 6px 12px; background: #283593; color: #fff; font-size: 14px; }
    .x0137-box .bar { position: relative; height: 10px; margin: 4px 0; background: #e8eaf6; }
    .x0137-box .band, .x0137-box .pin, .x0137-box .fill { position: absolute; top: 0; bottom: 0; }
    .x0137-box .band { background: #a5d6a7; }
    .x0137-box .pin { width: 3px; background: #1a237e; }
    .x0137-box .fill { left: 0; background: #f9a825; }
    .x0137-box .close, .x0137-box .far { color: #b71c1c; }
    .x0137-box .good { color: #1b5e20; }
    /* orange frame while the goggles are on */
    .x0137-goggles { position: fixed; inset: 0; z-index: 5; pointer-events: none; box-shadow: inset 0 0 0 10px #ff8c28; }
    .x0137-goggles[hidden] { display: none; }
    .x0137-goggles span { position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
        padding: 3px 10px; background: #ff8c28; font: bold 13px Arial, Helvetica, sans-serif; }`;

    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    const ui = {
        // ui.init({ pacing: true, questions: [{ key, intent }], homeHref })
        init: function (opts) {
            opts = opts || {};
            const style = el("style");
            style.textContent = CSS;
            document.head.appendChild(style);
            const hud = el("div", "x0137-hud");
            const top = el("div", "x0137-top");
            const home = el("a", "x0137-btn home", "← " + i18n.t("hud.home"));
            home.href = (opts.homeHref || "index.html") + "?lang=" + i18n.lang;
            home.setAttribute("role", "button");
            top.appendChild(home);
            this.topRight = el("div", "x0137-row");
            top.appendChild(this.topRight);
            hud.appendChild(top);

            const bottom = el("div", "x0137-bottom");
            this.statusEl = el("div", "x0137-status");
            this.heardEl = el("div", "x0137-heard");
            this.subEl = el("div", "x0137-sub");
            this.subEl.setAttribute("aria-live", "polite");
            this.qRow = el("div", "x0137-row");
            this.row = el("div", "x0137-row");
            bottom.append(this.statusEl, this.heardEl, this.subEl, this.qRow, this.row);
            hud.appendChild(bottom);
            document.body.appendChild(hud);

            if (opts.pacing !== false) {
                this.addButton(this.row, "hud.wait", "wait");
                this.addButton(this.row, "hud.again", "again");
                this.addButton(this.row, "hud.next", "next");
            }
            this.setQuestions(opts.questions || []);
            this._buildMic();
            this._listen();
            this._aimOnPress();
        },

        // button that fires an intent (same path as voice)
        addButton: function (parent, key, intent, cls) {
            const b = el("button", "x0137-btn" + (cls ? " " + cls : ""), i18n.t(key));
            b.type = "button";
            b.dataset.intent = intent;
            b.addEventListener("click", function () { speech.fire(intent, "button"); });
            parent.appendChild(b);
            return b;
        },

        // question buttons change with the state; pass [] to clear them
        setQuestions: function (list) {
            this.qRow.innerHTML = "";
            list.forEach((q) => this.addButton(this.qRow, q.key, q.intent, "q"));
        },

        subtitle: function (text) {
            this.subEl.textContent = text || "";
            const vr = document.getElementById("x0137-vr-subtitle");
            if (vr) vr.setAttribute("x0137-label", "value", text || "");
        },

        // after a failed recognition the buttons pulse, so the child sees what to do instead
        lightButtons: function () {
            this.qRow.querySelectorAll(".x0137-btn").forEach(lit);
            this.row.querySelectorAll(".x0137-btn").forEach(lit);
            function lit(b) {
                b.classList.remove("lit");
                void b.offsetWidth; // restart the animation
                b.classList.add("lit");
            }
        },

        _buildMic: function () {
            const mic = el("button", "x0137-btn x0137-mic", i18n.t("hud.mic"));
            mic.type = "button";
            mic.hidden = !speech.supported;
            this.mic = mic;
            // hold to talk: pointer events cover mouse, touch and pen
            const down = (e) => {
                e.preventDefault();
                if (speech.disabled) return;
                mic.classList.add("on");
                speech.start();   // the browser asks for mic permission here, on the first press
            };
            const up = () => {
                if (!mic.classList.contains("on")) return;
                mic.classList.remove("on");
                speech.stop();
            };
            mic.addEventListener("pointerdown", down);
            mic.addEventListener("pointerup", up);
            mic.addEventListener("pointerleave", up);
            mic.addEventListener("pointercancel", up);
            mic.addEventListener("contextmenu", function (e) { e.preventDefault(); });
            // keyboard: hold Space or Enter on the focused button
            mic.addEventListener("keydown", function (e) {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) down(e);
            });
            mic.addEventListener("keyup", function (e) {
                if (e.key === " " || e.key === "Enter") up();
            });
            this.row.appendChild(mic);
        },
        // In-scene panel for VR, where the HTML buttons are not visible. It is built only while
        // headset view is on, so its buttons never catch desktop clicks.
        //   const p = ui.vrPanel({ position, rotation, width });
        //   p.set(text, [[{ label, onPress, primary }, ...], ...rows]); p.show(); p.hide();
        vrPanel: function (opts) {
            const scene = document.querySelector("a-scene");
            const W = opts.width || 0.45, BH = 0.05, GAP = 0.012, PAD = 0.02;
            const panel = { text: "", rows: [], root: null, visible: false };

            function button(b, w) {
                const el = document.createElement("a-entity");
                el.classList.add("clickable");
                el.setAttribute("geometry", { primitive: "box", width: w, height: BH, depth: 0.01 });
                el.setAttribute("material", { color: b.primary ? "#ffd54f" : "#ffffff", shader: "flat" });
                const label = document.createElement("a-entity");
                // same letter height on every button (about 1.5 cm), whatever its width
                label.setAttribute("x0137-label", { value: b.label, width: w * 0.94, color: "#1a237e", fontSize: Math.min(140, Math.round(15 / w)) });
                label.setAttribute("position", "0 0 0.0062");
                el.appendChild(label);
                el.addEventListener("mouseenter", () => el.setAttribute("material", "color", "#c5cae9"));
                el.addEventListener("mouseleave", () => el.setAttribute("material", "color", b.primary ? "#ffd54f" : "#ffffff"));
                el.addEventListener("click", (e) => { e.stopPropagation(); b.onPress(); });
                return el;
            }

            panel.render = function () {
                if (panel.root) { panel.root.parentNode && panel.root.parentNode.removeChild(panel.root); panel.root = null; }
                if (!panel.visible) return;
                const root = document.createElement("a-entity");
                root.setAttribute("position", opts.position);
                root.setAttribute("rotation", opts.rotation);
                const textH = panel.textHeight || opts.textHeight || 0.12;
                const H = PAD * 2 + textH + panel.rows.length * (BH + GAP);
                const bg = document.createElement("a-plane");
                bg.setAttribute("width", W);
                bg.setAttribute("height", H);
                bg.setAttribute("material", { color: "#283593", shader: "flat", opacity: 0.94, transparent: true });
                bg.setAttribute("position", "0 " + (-H / 2) + " -0.004");
                root.appendChild(bg);
                const txt = document.createElement("a-entity");
                txt.setAttribute("x0137-label", { value: panel.text, width: W - PAD * 2, color: "#ffffff", fontSize: 56, align: "left", anchor: "top", bold: false });
                txt.setAttribute("position", "0 " + (-PAD * 0.5) + " 0");
                root.appendChild(txt);
                panel.rows.forEach(function (row, r) {
                    const y = -(PAD + textH + r * (BH + GAP) + BH / 2);
                    const w = (W - PAD * 2 - GAP * (row.length - 1)) / row.length;
                    row.forEach(function (b, i) {
                        const el = button(b, w);
                        el.setAttribute("position", (-W / 2 + PAD + w / 2 + i * (w + GAP)) + " " + y + " 0.004");
                        root.appendChild(el);
                    });
                });
                scene.appendChild(root);
                panel.root = root;
                panel.label = txt;
            };
            // text only (cheap, no rebuild)
            panel.setText = function (text) {
                panel.text = text;
                if (panel.label) panel.label.setAttribute("x0137-label", "value", text);
            };
            panel.set = function (text, rows, textHeight) {
                panel.text = text;
                panel.rows = rows || [];
                panel.textHeight = textHeight || null;
                panel.render();
            };
            panel.show = function () { panel.visible = true; panel.render(); };
            panel.hide = function () { panel.visible = false; panel.render(); };
            return panel;
        },
