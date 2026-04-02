import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';

export function configurarControles(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);

    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    
    // Alvo: centraliza o olhar no PC (que está por volta da altura 1)
    controls.target.set(0, 1, 0); 

    // Limites para não "fugir" do PC
    controls.minDistance = 3;
    controls.maxDistance = 10;

    return controls;
}