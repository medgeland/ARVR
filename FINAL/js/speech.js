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