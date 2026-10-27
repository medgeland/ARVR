import * as THREE from "three";
//personal variant 240137
const STUDENT_ID = "240137";
const VARIANT = "bedside table, single, 12°, faces user";
const PLACEMENT_MODE = "single";
const TOLERANCE_DEG = 12;
const MAX_PRODUCTS = PLACEMENT_MODE === "single" ? 1 : 5;

 //global scene values
let btn, gl, glCanvas, camera, scene, renderer, controller, reticle;
let overlay, statusText, fallbackText, clearBtn;

//global xr values
let xrSession = null, hitTestSource = null, hitTestSourceRequested = false;
let placeRequested = false;
const placed = [];

//overlay state
let sessionState = "not started";
let reticleState = "none";
let anchorsOn = false;
let trackingLost = false;

loadScene();

function loadScene() {
    //setup WebGL
    glCanvas = document.createElement("canvas");
    gl = glCanvas.getContext("webgl2", { antialias: true, xrCompatible: true });
 
    //setup Three.js scene
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

    //reticle
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);


     //screen tap controller
    controller = renderer.xr.getController(0);
    controller.addEventListener("select", onSelect);
    scene.add(controller);


    //overlay panel
    overlay = document.getElementById("overlay");
    statusText = document.getElementById("status");
    fallbackText = document.getElementById("fallback");
    clearBtn = document.getElementById("clear");
    clearBtn.addEventListener("click", clearProducts);

    overlay.addEventListener("beforexrselect", (event) => {
        if (event.target !== overlay) {
            event.preventDefault();
        }
    
    });
    //size check
    const size = new THREE.Box3().setFromObject(buildProduct()).getSize(new THREE.Vector3());
    console.log("product size (m): width " + size.x.toFixed(3) + ", height " + size.y.toFixed(3) + ", depth " + size.z.toFixed(3));

    //query AR support
    if (!navigator.xr) {
        showFallback("WebXR is not available in this browser. Use Chrome on an ARCore Android phone.");
    } else {
        navigator.xr.isSessionSupported("immersive-ar")
            .then((supported) => {
                if (supported) {
                    btn = document.createElement("button");
                    btn.addEventListener("click", onRequestSession);
                    btn.innerHTML = "START AR";
                    overlay.insertBefore(btn, clearBtn);
                } else {
                    showFallback("immersive-ar is not supported. Use Chrome on an ARCore Android phone.");
                }
            })
            .catch((reason) => {
                showFallback("WebXR not supported: " + reason);
            });
    }
    updateOverlay();
}

function buildProduct() {
    //bedside table, 0.45*0.4*0.55 , one drawer facing front
    const product = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const drawerWood = new THREE.MeshStandardMaterial({ color: 0xc8a165, roughness: 0.6 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });

    //body y 0.08 to 0.55, z -0.2 to 0.17
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.47, 0.37), wood);
    body.position.set(0, 0.315, -0.015);
    product.add(body);

    //legs y 0 to 0.08
    const legPositions = [[-0.19, -0.15], [0.19, -0.15], [-0.19, 0.15], [0.19, 0.15]];
    for (const [x, z] of legPositions) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 16), wood);
        leg.position.set(x, 0.04, z);
        product.add(leg);
    }

    //drawer front
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.16, 0.015), drawerWood);
    drawer.position.set(0, 0.44, 0.1775);
    product.add(drawer);

    //knob reaches z 0.2
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 16), metal);
    knob.position.set(0, 0.44, 0.185);
    product.add(knob);
 
    return product;
}

function onSelect() {
    placeRequested = true;
}

