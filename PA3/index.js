import * as THREE from "three";
//personal variant 240137
const STUDENT_ID = "240137";
const VARIANT = "bedside table, single, 12°, faces user";
const PLACEMENT_MODE = "single";
const TOLERANCE_DEG = 12;
const MAX_PRODUCTS = PLACEMENT_MODE === "single" ? 1 : 5;
// facing rule: 0 mod 2 = 0 -> the product's front turns to face the user (rotation about y only)
 