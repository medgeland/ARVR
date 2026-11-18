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
    

