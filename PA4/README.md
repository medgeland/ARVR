# PA4 - A-Frame VR Scene with Custom Component
## AR/VR/XR Applications
**Student ID:** 240137
**Student Name:** Margarita Serebrennikova
 
## Variant:
|ID Digit|Value|Rule|Result|
|---|---|---|---|
|Last|7|theme table|Winter steppe|
|Second-to-last|3|3 mod 3 =0|Exhibit motion: bob (up and down)|
|Third-to-last|1|1 mod 2 =1|Interaction: point-and-click|
|Fourth-to-last|0|0 mod 2 =0|Layout: ring of 6 exhibits, radius 4 m, around the start point|
 
- Component prefix: **x0137-** (x0137-motion, x0137-texture, x0137-exhibit, system x0137-gallery)
- Exhibits: yurt, snowman, snowy spruce, frost crystal, balbal stone figure, haystack
## How to run:
- Open **VS Code** and start Live Server from index.html
- A-Frame 1.8.0 is loaded from aframe.io, then components.js, before <a-scene>
- Enter VR: the VR button at the bottom right, in a Meta Quest browser or with the Immersive Web Emulator
## Key map:
|Input|Effect|
|---|---|
|W A S D|Walk|
|Mouse drag|Look around|
|Mouse hover on an exhibit|Highlight|
|Click on an exhibit|Select / deselect (one at a time); shows its info panel and doubles its bob|
|M|Pause / resume all exhibit motion|
|X|Remove the selected exhibit|
|VR controllers|Laser pointer on both hands; trigger selects|
 
- info panel shows my ID, the variant and Selected: <name> (<n> of <total>).
## Texture credits and licences:
|File|Used on|Source|Licence|
|---|---|---|---|
|textures/snow.jpg|Ground (repeat 10 × 10)|[rawpixel #5925336 – snow ice crystals closeup](https://www.rawpixel.com/image/5925336/photo-image-public-domain-ice-snow)|CC0 (Public Domain)|
|textures/ice.jpg|Frost crystal|[rawpixel #5922638 – ice formations](https://www.rawpixel.com/image/5922638/ice-formations-free-public-domain-cc0-photo)|CC0 (Public Domain)|
|textures/quilt.jpg|Yurt walls (repeat 6 × 1)|[rawpixel #7833942 – Untitled (String Quilt with White Cross)](https://www.rawpixel.com/image/7833942/untitled-string-quilt-with-white-cross)|CC0 (Public Domain)|
 
- All images were downloaded in low resolution and resized to at most 1024 px; the quilt photo was cropped to remove the dark background.
## Files:
|File|Content|
|---|---|
|index.html|A-Frame script, components.js, <a-assets> and the scene|
|components.js|x0137-gallery system and the x0137-motion, x0137-texture and x0137-exhibit components|
|textures/|snow.jpg, ice.jpg, quilt.jpg|
|README.md|Variant, how to run, key map, texture credits and licences|
|writeup.pdf|E1–E6 and the development log|
|demo.mp4|Screen recording: walking the layout, hover and select on two exhibits, M, X with the counter, Enter VR and one selection|
