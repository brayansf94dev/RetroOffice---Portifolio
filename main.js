import * as THREE from 'three';
import { criarComputador }               from './computador.js';
import { configurarControles }           from './controles.js';
import { criarEstrelas, criarEsquadrao } from './cenario.js';
import { gerenciarCamera }               from './camera.js';

// ── CENA ─────────────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);
const canvas = renderer.domElement;

// ── OBJETOS ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const estrelas      = criarEstrelas();       scene.add(estrelas);
const esquadrao     = criarEsquadrao(scene);
const meuComputador = criarComputador();     scene.add(meuComputador);

let telaMesh = null;
meuComputador.traverse(obj => {
    if (obj.isMesh && obj.geometry.type === 'PlaneGeometry') telaMesh = obj;
});

// ── CÂMERA + CONTROLES ────────────────────────────────────────────────────────
const controls     = configurarControles(camera, canvas);
camera.position.set(0, 2, 7);
const configCamera = gerenciarCamera(camera, controls);

// ── FIT OVERLAY ───────────────────────────────────────────────────────────────
const xpOverlay = document.getElementById('xp-overlay');
const xpWin     = document.getElementById('xp-win');
const _v        = new THREE.Vector3();

function fitOverlay() {
    if (!telaMesh) return;
    telaMesh.updateMatrixWorld(true);
    const hw = 0.8, hh = 0.65;
    const corners = [
        new THREE.Vector3(-hw,-hh,0), new THREE.Vector3(hw,-hh,0),
        new THREE.Vector3(-hw, hh,0), new THREE.Vector3(hw, hh,0),
    ];
    let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity;
    corners.forEach(c => {
        _v.copy(c).applyMatrix4(telaMesh.matrixWorld).project(camera);
        const px=(_v.x*.5+.5)*innerWidth, py=(-_v.y*.5+.5)*innerHeight;
        if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py;
    });
    xpWin.style.left=x0+'px'; xpWin.style.top=y0+'px';
    xpWin.style.width=(x1-x0)+'px'; xpWin.style.height=(y1-y0)+'px';
    xpWin.style.fontSize='11px';
}

// ── ABRIR / FECHAR ────────────────────────────────────────────────────────────
let aberto = false;

function abrirPortfolio() {
    if (aberto) return;
    aberto = true;
    renderer.render(scene, camera);
    fitOverlay();
    xpOverlay.classList.add('vis');
    document.getElementById('hint').classList.add('hide');
    // Desabilita canvas para os botões da interface receberem os cliques
    canvas.style.pointerEvents = 'none';
}

function fecharPortfolio() {
    if (!aberto) return;
    aberto = false;
    xpOverlay.classList.remove('vis');
    // Reativa canvas para OrbitControls funcionar
    canvas.style.pointerEvents = 'auto';
}

function ativarCameraLivre() {
    fecharPortfolio();                      // fecha interface e reativa canvas
    canvas.style.pointerEvents = 'auto';   // garante que canvas recebe eventos
    configCamera.alternarModo('livre');
}

function voltarFoco() {
    canvas.style.pointerEvents = 'none';   // desativa canvas enquanto portfolio está aberto
    configCamera.alternarModo('foco');
    setTimeout(abrirPortfolio, 2500);
}

// ── EVENT LISTENERS (dentro do módulo — sem problema de timing) ───────────────

// Abas
document.getElementById('xp-mb').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#xp-mb button').forEach(b => b.classList.remove('act'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('act'));
    btn.classList.add('act');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('act');
    if (btn.dataset.tab === 'skills') buildSkills();
});

// Skills
const SKILLS = [
    {n:'JavaScript',p:90},{n:'React/Next.js',p:85},{n:'Node.js',p:80},
    {n:'TypeScript',p:75},{n:'Python',p:72},{n:'PostgreSQL',p:68},
    {n:'Docker',p:60},{n:'Three.js',p:55}
];
let builtSkills = false;
function buildSkills() {
    if (builtSkills) return; builtSkills = true;
    const c = document.getElementById('sk-list');
    SKILLS.forEach((s, i) => {
        const r = document.createElement('div'); r.className = 'skr';
        r.innerHTML = `<span class="skn">${s.n}</span>`
            + `<div class="skt"><div class="skf" style="width:${s.p}%;animation-delay:${i*.09}s"></div></div>`
            + `<span class="skp">${s.p}%</span>`;
        c.appendChild(r);
    });
}

// Relógio
function tick() {
    const el = document.getElementById('xp-clock');
    if (!el) return;
    const d = new Date();
    el.textContent = [d.getHours(),d.getMinutes(),d.getSeconds()]
        .map(v => String(v).padStart(2,'0')).join(':');
}
tick(); setInterval(tick, 1000);

// Botão fechar (✕)
document.getElementById('btn-fechar').addEventListener('click', () => {
    fecharPortfolio();
    voltarFoco();
});

// Botão câmera livre
document.getElementById('btn-camera').addEventListener('click', () => {
    ativarCameraLivre();
});

// ESC fecha
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { fecharPortfolio(); voltarFoco(); }
});

// ── LOOP ──────────────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    configCamera.atualizarCamera();

    estrelas.rotation.y += 0.0001;
    esquadrao.forEach(nave => {
        if (!nave.ativa) {
            nave.timer--;
            if (nave.timer <= 0) {
                nave.ativa = true;
                nave.mesh.position.set(-20, Math.random()*4+1, Math.random()>.5?3:-3);
                nave.mesh.rotation.z = -Math.PI/2;
                nave.mesh.material.opacity = 0;
            }
        } else {
            nave.mesh.position.x += nave.velocidade;
            nave.mesh.rotation.x += 0.1;
            if      (nave.mesh.position.x < -10) nave.mesh.material.opacity += 0.02;
            else if (nave.mesh.position.x >  10) nave.mesh.material.opacity -= 0.02;
            else                                  nave.mesh.material.opacity = 1;
            if (nave.mesh.position.x > 20) {
                nave.ativa = false;
                nave.timer = Math.random()*1000+200;
            }
        }
    });

    if (aberto) fitOverlay();
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Abre automaticamente após animação (deriva ~2.7s + lerp ~2.5s)
setTimeout(abrirPortfolio, 5500);

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (aberto) fitOverlay();
});
