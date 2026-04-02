import * as THREE from 'three';
import { criarComputador } from './computador.js';
import { configurarControles } from './controles.js'; // Novo import

// --- CONFIGURAÇÃO INICIAL ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 2, 12);


const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true, // N64 tinha AA por hardware, então deixamos TRUE
    precision: 'lowp' 
});

// ADICIONE ESTA LINHA AQUI:
renderer.setPixelRatio(window.devicePixelRatio * 1.5);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const container = document.getElementById('canvas-container');
container.appendChild(renderer.domElement);

camera.position.z = 7; // Afastei um pouco mais a câmera
camera.position.y = 2;
camera.lookAt(0, 0, 0);

// --- ILUMINAÇÃO ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const meuComputador = criarComputador();
scene.add(meuComputador);

// 2. Inicializar os controles
const controls = configurarControles(camera, renderer.domElement);

const textureLoader = new THREE.TextureLoader();

// --- CONFIGURAÇÃO DO FUNDO ---
scene.background = new THREE.Color(0x000000); 

const vertices = [];
for (let i = 0; i < 15000; i++) {
    // Espalhamos em um raio de 600 para garantir que elas envolvam tudo
    const x = THREE.MathUtils.randFloatSpread(600);
    const y = THREE.MathUtils.randFloatSpread(600);
    const z = THREE.MathUtils.randFloatSpread(600);
    vertices.push(x, y, z);
}

const geometriaEstrelas = new THREE.BufferGeometry();
geometriaEstrelas.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

const materialEstrelas = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    // ISSO AQUI É O SEGREDO:
    fog: false // Faz as estrelas ignorarem a neblina preta e brilharem no fundo!
});

const estrelas = new THREE.Points(geometriaEstrelas, materialEstrelas);
scene.add(estrelas);

// --- SISTEMA DE NAVES (ESQUADRÃO) ---
const naves = [];
const cores = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00]; // Vermelha, Verde, Azul, Amarela

function criarNave(cor) {
    const naveGeo = new THREE.ConeGeometry(0.1, 0.5, 3);
    const naveMat = new THREE.MeshBasicMaterial({ color: cor, fog: false });
    const mesh = new THREE.Mesh(naveGeo, naveMat);
    
    const luz = new THREE.PointLight(cor, 1, 5);
    mesh.add(luz);
    
    scene.add(mesh);
    
    return {
        mesh: mesh,
        ativa: false,
        timer: Math.random() * 1000, // Tempo de espera inicial aleatório
        velocidade: 0.15 + Math.random() * 0.2 // Cada uma tem uma velocidade levemente diferente
    };
}

// Criar as 4 naves
cores.forEach(cor => {
    naves.push(criarNave(cor));
});

function animate() {
    requestAnimationFrame(animate);

    // --- LÓGICA DAS NAVES ---
    naves.forEach((naveObj) => {
        if (!naveObj.ativa) {
            naveObj.timer--;
            if (naveObj.timer <= 0) {
                naveObj.ativa = true;
                // Nascem em alturas (Y) e profundidades (Z) levemente diferentes para não colidirem
                naveObj.mesh.position.set(-20, (Math.random() * 4), (Math.random() * 3));
                naveObj.mesh.rotation.z = -Math.PI / 2;
            }
        } else {
            naveObj.mesh.position.x += naveObj.velocidade;
            naveObj.mesh.rotation.x += 0.1;

            if (naveObj.mesh.position.x > 20) {
                naveObj.ativa = false;
                naveObj.timer = Math.random() * 2000 + 600; // Define o próximo tempo de espera
            }
        }
    });

    // Manter as estrelas girando
    if (typeof estrelas !== 'undefined') {
        estrelas.rotation.y += 0.0001;
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();