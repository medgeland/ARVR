// Capstone – First Laser Visit – 240137 – prefix x0137-
// speech.js: shared voice module for both modes.
//   hold mic -> Web Speech recognition -> transcript -> intent -> "x0137-intent" event
//   reply    -> speechSynthesis (+ subtitles, handled by ui.js)
// Falls back to buttons when recognition is missing, denied or fails (spec section 6).
// API reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

