import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function configurarControles(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);

    controls.enableDamping  = true;
    controls.dampingFactor  = 0.05;
    controls.target.set(0, 1, 0);

    // Limites do modo foco — serão ajustados no modo livre
    controls.minDistance = 2;
    controls.maxDistance = 12;

    return controls;
}
