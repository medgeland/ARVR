//PA 1 - 3D Shapes in WebGL - 240137
//Variant: Octahedron
//offset (-0.15; -0.15) visible sides: bottom & left
const STUDENT_ID = "240137";
const OFFSET_X = -0.15;
const OFFSET_Y = -0.15;
main();
function main() {
    const canvas = document.querySelector("#c");
    const gl = canvas.getContext('webgl');

    