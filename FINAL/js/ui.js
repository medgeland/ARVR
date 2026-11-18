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


