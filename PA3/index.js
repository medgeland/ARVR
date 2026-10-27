import * as THREE from "three";
//personal variant 240137
const STUDENT_ID = "240137";
const VARIANT = "bedside table, single, 12°, faces user";
const PLACEMENT_MODE = "single";
const TOLERANCE_DEG = 12;
const MAX_PRODUCTS = PLACEMENT_MODE === "single" ? 1 : 5;

 // global scene values
let btn, gl, glCanvas, camera, scene, renderer, controller, reticle;
let overlay, statusText, fallbackText, clearBtn;

// global xr values
let xrSession = null, hitTestSource = null, hitTestSourceRequested = false;
let placeRequested = false;
const placed = [];

// overlay state
let sessionState = "not started";
let reticleState = "none";
let anchorsOn = false;
let trackingLost = false;

loadScene();

function loadScene() {
    // setup WebGL
    glCanvas = document.createElement("canvas");
    gl = glCanvas.getContext("webgl2", { antialias: true, xrCompatible: true });
 
    // setup Three.js scene
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
    scene = new THREE.Scene();
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    hemiLight.position.set(0.5, 1, 0.25);
    scene.add(hemiLight);

     const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);

    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, context: gl });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);