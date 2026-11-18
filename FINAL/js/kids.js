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