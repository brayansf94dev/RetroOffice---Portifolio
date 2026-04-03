import * as THREE from 'three';

// --- SISTEMA DE ESTRELAS ---
export function criarEstrelas() {
    const vertices = [];
    for (let i = 0; i < 15000; i++) {
        const x = THREE.MathUtils.randFloatSpread(600);
        const y = THREE.MathUtils.randFloatSpread(600);
        const z = THREE.MathUtils.randFloatSpread(600);
        vertices.push(x, y, z);
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.8,
        sizeAttenuation: true,
        fog: false
    });

    return new THREE.Points(geometria, material);
}

// --- FÁBRICA DE NAVES ---
export function criarEsquadrao(scene) {
    const naves = [];
    const cores = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];

    cores.forEach(cor => {
        const naveGeo = new THREE.ConeGeometry(0.1, 0.5, 3);
        
        // CORREÇÃO AQUI: O material de cada nave já nasce com transparência habilitada
        const naveMat = new THREE.MeshBasicMaterial({ 
            color: cor, 
            fog: false,
            transparent: true, 
            opacity: 0 // Começa invisível
        });

        const mesh = new THREE.Mesh(naveGeo, naveMat);
        
        const luz = new THREE.PointLight(cor, 1, 5);
        mesh.add(luz);
        
        scene.add(mesh);
        
        naves.push({
            mesh: mesh,
            ativa: false,
            timer: Math.random() * 1000,
            velocidade: 0.15 + Math.random() * 0.2
        });
    });

    return naves;
}