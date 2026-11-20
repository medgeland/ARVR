# Capstone – First Dermatologist Laser Visit
## AR/VR/XR Applications
**Student ID:** 240137
**Student Name:** Margarita Serebrennikova (individual project: owns all modules and all report sections)

One web app (WebXR, A-Frame) with two modes, chosen on the landing page:
- **Kid mode** (children 2.5–12 with a parent): a calm rehearsal of a first visit to dermatologist.
  - Waiting room -> treatment room (explore the couch, goggles and device; ask the doctor) -> the doctor's demo on her own arm.
  - **Your turn:** goggles -> sunscreen on the moles -> cloth -> the right light window -> light at 4 cm.
  - Done: a time-lapse of the spot fading over 6 visits, a medal and a card for the parent.
- **Trainer mode** (adults who own a home excimer device):
  - A 7-step safety checklist: goggles, sunscreen on moles, vitamin E, towel, nozzle, 4 cm distance, exposure time.
  - A simulated treatment of a psoriasis plaque
  - A result with 9 checks, each with a ✓/✗, words and a specific tip
 
Component prefix: **x0137-**

**Live:** https://medgeland.github.io/ARVR/FINAL/

## How to run
From a fresh clone, one command (Python 3, no install):

git clone https://github.com/medgeland/ARVR.git && cd ARVR && python3 -m http.server 8000 --directory FINAL

Then open http://localhost:8000
Other ways to serve it: VS Code Live Server on FINAL/index.html, or npx serve FINAL

**Target device:** desktop Chrome with the Immersive Web Emulator (Meta Quest profile), or the Meta Quest browser.
Chrome, Safari (Mac and iPhone) and Firefox without VR show the same scenes as a 3D page with mouse, touch and on-screen buttons.


## Controls
| Action | Mouse / keyboard | Touch / phone | VR controllers |
|---|---|---|---|
| Select an object | Click | Tap | Point the laser, trigger |
| Look around | Drag | Turn the phone (motion sensors) or drag | Head |
| Walk (optional) | W A S D / arrows (follows the view) | — | — (seated) |
| Aim the device | Move the mouse over the skin | Touch the skin | Point the laser at the skin |
| Height of the device | Wheel, E / Q, Higher / Lower, the ruler's 4 cm mark (Trainer) | Higher / Lower buttons | Thumbstick; B / Y up, A / X down |
| Light on | Hold the mouse on the spot, hold Space (Trainer), or hold the on-screen button | Hold the button | Hold the trigger |
| Voice | Hold "Hold to talk" | Hold "Hold to talk" | — |
| Pacing | Wait / Again / Go on buttons, or say them | The same | — |


## AI-driven feature: voice guide
| | |
|---|---|
| Service / model | **Web Speech API**: SpeechRecognition, pretrained cloud speech-to-text model run by the browser (Google in Chrome, Apple in Safari), RU (ru-RU) and EN (en-US). SpeechSynthesis speaks the doctor's lines. Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |
| Input | Speech, recorded only while "Hold to talk" is held |
| Output | Recognised text -> an intent: a question (pain, light, goggles, skin, nozzle, time) or a command (wait, again, go on, start). The guide answers, pauses, repeats or moves on, by voice and subtitle. The recognised text is shown ("I heard: …"). The intent matching (js/speech.js) is rule-based own code; the AI part is the recognition model. |
| Adaptive pacing | After 2 "wait"/"again" requests in one scene, the guide speaks slower (rate 1.0 -> 0.85) and in shorter parts |
| Fallback | If the mic is denied, there's no network, the browser is unsupported or nothing is heard, every intent stays available as a button, and every spoken line is shown as a subtitle |
| Limits | Recognition is less accurate for children's voices, accents and noise; it needs a network; it is not available in Firefox; in immersive VR the guide speaks, but voice input is not available |


## Files
| Path | What it is |
|---|---|
| index.html | Landing page (styles inline): mode cards, RU / EN, privacy, device note, disclaimer, credits link |
| kids.html, js/kids.js | Kid mode scene and system x0137-kids; components x0137-state-group, x0137-explorable |
| trainer.html, js/trainer.js | Trainer scene, CONFIG with all numbers (placeholders until the dermatologist confirms them), system x0137-trainer, component x0137-tool |
| js/voxel.js | x0137-voxel-skin: the forearm as a grid of 3–4 mm blocks with per-block colour for lesion, moles, redness, healing and the towel. x0137-voxel-model: devices built from text layer maps. Each is one InstancedMesh |
| js/speech.js | Shared voice module: hold-to-talk recognition -> intents, speech synthesis, adaptive pacing, button fallback |
| js/ui.js | Shared HUD: Home, subtitles (HTML and in VR), pacing and question buttons, mic button, x0137-label, x0137-texture |
| js/i18n.js | All on-screen and spoken text, English and Russian; language from ?lang=, then the saved choice, then the browser |
| models/doctor.glb | The doctor (clips Idle, Talk, Wave, Jump), played with aframe-extras' animation-mixer |
| tools/make_doctor_glb.py | Generates models/doctor.glb (python3 tools/make_doctor_glb.py) |
| textures/ | Floor, wall, leather and wood images (see credits) |


## Libraries
| Library | Version | Source |
|---|---|---|
| A-Frame | 1.8.0 | https://aframe.io/releases/1.8.0/aframe.min.js |
| aframe-extras | 7.7.0 | https://cdn.jsdelivr.net/npm/aframe-extras@7.7.0/dist/aframe-extras.min.js (animation-mixer for the doctor) |
| Web Speech API | browser built-in | — |

## Privacy
- The landing page explains the microphone before it is used.
- The mic is requested only on the first press of "Hold to talk", never on page load.
- Audio goes to the browser's speech service (Google in Chrome, Apple in Safari); the app stores nothing.
- No accounts, names or health data. The intent log lives in memory only.
- The only thing saved in the browser is the language choice (localStorage, key x0137-lang).
- No API keys or secrets: none are needed.
- On phones the view follows the motion sensors (A-Frame default); iPhone Safari may ask for motion permission. No motion data is stored.


## Credits and licences
| File | Used on | Source | Licence |
|---|---|---|---|
| textures/floor.jpg | Floors | [rawpixel #5921222](https://www.rawpixel.com/image/5921222/photo-image-background-texture-light) | CC0 (Public Domain) |
| textures/wall.jpg | Walls | [rawpixel #5924266](https://www.rawpixel.com/image/5924266/photo-image-background-texture-public-domain) | CC0 (Public Domain) |
| textures/leather.jpg | Chairs, couch | [rawpixel #5920902](https://www.rawpixel.com/image/5920902/photo-image-texture-public-domain-shadow) | CC0 (Public Domain) |
| textures/wood.jpg | Table, side table | [rawpixel #5960624](https://www.rawpixel.com/image/5960624/free-public-domain-cc0-photo) | CC0 (Public Domain) |
| models/doctor.glb | Kid mode doctor (clips Idle, Talk, Wave, Jump) | Own work, generated by tools/make_doctor_glb.py | — |


- Images are resized to 1200 px wide.
- Devices, nozzles, goggles, the forearm and the rooms are built from A-Frame primitives and voxel blocks (own work, no logos or real brands).
- Speech: Web Speech API (see the AI section above).

## Performance
Asset budget: the whole site is 2.8 MB; doctor.glb is 13 KB; the largest file is textures/leather.jpg (1.0 MB).

| Target | Scene | Measured |
|---|---|---|
| Desktop Chrome (MacBook) | Trainer during treatment | 60–61 fps steady (display limit), ~1.5 ms CPU per frame (A-Frame stats) |
| iPhone Safari (target 30+) | Both modes | Runs smoothly (not measured in numbers) |
