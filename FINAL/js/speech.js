// Capstone – First Laser Visit – 240137 – prefix x0137-
// speech.js: shared voice module for both modes.
//   hold mic -> Web Speech recognition -> transcript -> intent -> "x0137-intent" event
//   reply    -> speechSynthesis (+ subtitles, handled by ui.js)
// Falls back to buttons when recognition is missing, denied or fails (spec section 6).
// API reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

(function () {
    const i18n = window.X0137_I18N;

    // Intent phrase lists, both languages. Order matters: questions are checked first,
    // so "okay, does it hurt?" becomes q_pain, not next.
    const INTENTS = [
        { name: "q_pain",    phrases: ["does it hurt", "hurt*", "pain*", "больн*", "болит", "боль", "болеть"] },
        { name: "q_light",   phrases: ["the light", "is it bright", "bright*", "light*", "свет*", "ярк*"] },
        { name: "q_goggles", phrases: ["goggle*", "glasses", "очк*"] },
        { name: "q_skin",    phrases: ["why look at my skin", "my skin", "skin", "кож*"] },
        { name: "q_nozzle",  phrases: ["which nozzle", "what size", "nozzle*", "насад*"] },
        { name: "q_time",    phrases: ["how long", "how many seconds", "сколько"] },
        { name: "wait",      phrases: ["wait", "stop", "pause", "подожд*", "погоди*", "постой*", "стоп", "пауз*", "секунд*", "хватит"] },
        { name: "again",     phrases: ["again", "repeat*", "еще раз", "повтор*", "заново", "не понял*", "не расслышал*"] },
        { name: "start",     phrases: ["start*", "begin*", "начать", "начни*", "начн*", "начина*", "старт*", "поехали"] },
        { name: "next",      phrases: ["go on", "next", "okay", "ok", "yes", "дальше", "давай*", "да", "хорошо", "ладно",
                                       "окей", "ок", "ага", "угу", "готов*", "поехали", "продолж*"] }
    ];

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function normalise(text) {
        return (text || "").toLowerCase().replace(/[.,!?;:«»"']/g, " ").replace(/\s+/g, " ").trim();
    }

    // returns {name, phrase} or null. Short phrases must match a whole word, longer ones a substring.
    function matchText(text, allowed) {
        const t = " " + normalise(text) + " ";
        for (const intent of INTENTS) {
            if (allowed && allowed.indexOf(intent.name) === -1) continue;
            for (const p of intent.phrases) {
                const hit = p.length <= 3 ? t.indexOf(" " + p + " ") !== -1 : t.indexOf(p) !== -1;
                if (hit) return { name: intent.name, phrase: p };
            }
        }
        return null;
    }

    const speech = {
        supported: !!Recognition,
        listening: false,
        disabled: !Recognition, // true after "not-allowed" etc.: buttons only from then on
        rate: 1.0,
        allowed: null, // the mode sets which intents it understands
        log: [], // intents this session, memory only, never stored

        // the mode calls this once: speech.init({ intents: ["wait", "again", ...] })
        init: function (opts) {
            this.allowed = (opts && opts.intents) || null;
            if (!this.supported) this._status("unsupported", i18n.t("speech.unsupported"));
        },

        // --- recognition: called on mic button press / release ---
        start: function () {
            if (this.disabled || this.listening) return;
            this.cancelSpeech();
            const rec = new Recognition();
            rec.lang = i18n.speechLang();
            rec.interimResults = true;
            rec.maxAlternatives = 3;
            rec.continuous = false;
            this._rec = rec;
            this._finals = [];
            this._interim = "";
            this._errored = false;

            rec.onresult = (e) => {
                this._interim = "";
                this._finals = [];
                for (let i = 0; i < e.results.length; i++) {
                    const r = e.results[i];
                    if (r.isFinal) {
                        for (let a = 0; a < r.length; a++) this._finals.push({ text: r[a].transcript, conf: r[a].confidence });
                    } else {
                        this._interim += r[0].transcript;
                    }
                }
                this._emit("x0137-heard", { text: this._interim || (this._finals[0] && this._finals[0].text) || "", final: false });
            };
            rec.onerror = (e) => {
                this._errored = true;
                if (e.error === "not-allowed" || e.error === "service-not-allowed") {
                    this.disabled = true;
                    this._status("denied", i18n.t("speech.denied"));
                } else if (e.error === "network") {
                    this.disabled = true;
                    this._status("network", i18n.t("speech.network"));
                } else if (e.error === "no-speech") {
                    this._status("nospeech", i18n.t("speech.nospeech"));
                }
                // "aborted" happens on a very short press: ignore
            };
            rec.onend = () => {
                this.listening = false;
                this._status("idle", "");
                if (!this._errored) this._finish();
            };

            try {
                rec.start();
                this.listening = true;
                this._status("listening", i18n.t("hud.mic.listening"));
            } catch (err) {
                this.listening = false;
            }
        },

        stop: function () {
            if (this._rec && this.listening) {
                try { this._rec.stop(); } catch (e) { /* already stopped */ }
            }
        },

        // turns the final alternatives (or the last interim text) into one intent event
        _finish: function () {
            const alts = this._finals.length ? this._finals : (this._interim ? [{ text: this._interim, conf: 0.3 }] : []);
            if (!alts.length) {
                this._status("nospeech", i18n.t("speech.nospeech"));
                return;
            }
            this._emit("x0137-heard", { text: alts[0].text, final: true });
            for (const alt of alts) {
                const m = matchText(alt.text, this.allowed);
                if (m) {
                    this.fire(m.name, "voice", alt.text, alt.conf || 0);
                    return;
                }
            }
            this._emit("x0137-nomatch", { text: alts[0].text });
            this._status("nomatch", i18n.t("speech.nomatch"));
        },

        // buttons call this too, so voice and buttons share one path
        fire: function (name, source, transcript, confidence) {
            this.log.push({ name: name, source: source || "button", t: Date.now() });
            this._emit("x0137-intent", {
                name: name,
                source: source || "button",
                transcript: transcript || "",
                confidence: confidence == null ? 1 : confidence
            });
        },