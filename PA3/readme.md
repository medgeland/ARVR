# PA3 - Augmented Reality Website with Hit-Testing
## AR/VR/XR Applications
**Student ID:** 240137
**Student Name:** Margarita Serebrennikova

## Variant:
|ID Digit|Value|Rule|Result|
|---|---|---|---|
|Last|7|product table|Bedside table: 0.45 wide × 0.40 deep × 0.55 high, one drawer front|
|Second-to-last|3|3 mod 2 =1|Single mode: one product, each tap moves it|
|Third-to-last|1|1 mod 3 =1|Surface tolerance 12°|
|Fourth-to-last|0|0 mod 2 =0|Product faces the user (rotation about y only)|

## Device and browser:
- Tested in Chrome [VERSION, from chrome://version] on macOS with the Immersive Web Emulator extension (Meta Quest 3 profile)
- Three.js 0.186.1, loaded through an import map pinned to that version

## How to run:
- Open **VS Code** and start Live Server from index.html
- On a browser without immersive-ar, the page shows a fallback message under the header

## Controls:
|Action|Effect|
|---|---|
|START AR / STOP AR|Starts or ends the AR session; the system back gesture also ends it|
|Tap (select) on a green reticle|Places the table, or moves it in single mode|
|Tap on a red reticle|Nothing (surface tilted more than 12°)|
|Clear|Removes the table and deletes its anchor|

- Overlay panel shows my ID and variant, session state, reticle state with angle, anchors on/off and product count; "Tracking lost — move the phone slowly" appears when tracking is lost.

## Porting notes:
|Break in Ch. 7|Cause in Three.js 0.186.1|Fix|
|---|---|---|
|WebGLRenderer constructor throws|WebGL 1 is not supported since r163; the book passes a WebGL 1 context|getContext("webgl2", { antialias: true, xrCompatible: true })|
|Geometry constructors are undefined|The BufferGeometry aliases (BoxBufferGeometry, CylinderBufferGeometry, RingBufferGeometry) were removed|BoxGeometry, CylinderGeometry, RingGeometry|
|A new hit-test source is requested on every frame|The book never sets hitTestSourceRequested to true|Set the flag to true before requesting, so one source is requested per session; it is cancelled when the session ends|

## Files:
|File|Content|
|---|---|
|index.html|Header with ID and variant, fallback message area, overlay panel, import map, module script|
|index.js|All JS|
|README.md|Variant, device and browser, how to run, notes|
|writeup.pdf|E1–E6 and the development log|
|demo.mp4|Screen recording: START AR, green and red reticle, placement, walk around, Clear, STOP, START AR again|
