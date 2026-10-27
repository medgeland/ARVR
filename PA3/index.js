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