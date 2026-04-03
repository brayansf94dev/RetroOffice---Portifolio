import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { CSS3DRenderer } from 'https://unpkg.com/three@0.150.1/examples/jsm/renderers/CSS3DRenderer.js';
import { criarComputador }               from './computador.js';
import { configurarControles }           from './controles.js';
import { criarEstrelas, criarEsquadrao } from './cenario.js';
import { gerenciarCamera }               from './camera.js';
import { criarTelaInterativa }           from './tela.js';

// ── CENA WebGL ────────────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;z-index:1';
document.getElementById('canvas-container').appendChild(renderer.domElement);
const canvas = renderer.domElement;

// ── CENA CSS3D ────────────────────────────────────────────────────────────────
const cssScene    = new THREE.Scene();
const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(innerWidth, innerHeight);
cssRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;z-index:0;pointer-events:none';
document.getElementById('canvas-container').appendChild(cssRenderer.domElement);

// ── BOTÃO VOLTAR (modo livre) ─────────────────────────────────────────────────
// Solução simples: botão HTML fixo na tela, visível só no modo livre.
// Fica acima do canvas (z-index alto) e não interfere com nada.
const btnVoltar = document.createElement('button');
btnVoltar.id        = 'btn-voltar';
btnVoltar.innerHTML = '🖥️ Voltar ao Portfólio';
btnVoltar.style.cssText = `
    display: none;
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    background: rgba(10,10,20,0.85);
    color: #7CFF7C;
    border: 1px solid rgba(124,255,124,0.5);
    padding: 10px 24px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    letter-spacing: 1px;
    cursor: pointer;
    text-transform: uppercase;
    box-shadow: 0 0 18px rgba(124,255,124,0.15);
    backdrop-filter: blur(4px);
    transition: background 0.2s, box-shadow 0.2s;
`;
btnVoltar.addEventListener('mouseenter', () => {
    btnVoltar.style.background  = 'rgba(20,40,20,0.95)';
    btnVoltar.style.boxShadow   = '0 0 28px rgba(124,255,124,0.3)';
});
btnVoltar.addEventListener('mouseleave', () => {
    btnVoltar.style.background  = 'rgba(10,10,20,0.85)';
    btnVoltar.style.boxShadow   = '0 0 18px rgba(124,255,124,0.15)';
});
btnVoltar.addEventListener('click', () => voltarFoco());
document.body.appendChild(btnVoltar);

// ── OBJETOS ───────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const estrelas      = criarEstrelas();       scene.add(estrelas);
const esquadrao     = criarEsquadrao(scene);
const meuComputador = criarComputador();     scene.add(meuComputador);

const telaCSS = criarTelaInterativa();
cssScene.add(telaCSS);

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
        new THREE.Vector3(-hw,-hh,0), new THREE.Vector3( hw,-hh,0),
        new THREE.Vector3(-hw, hh,0), new THREE.Vector3( hw, hh,0),
    ];
    let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity;
    corners.forEach(c => {
        _v.copy(c).applyMatrix4(telaMesh.matrixWorld).project(camera);
        const px=(_v.x*.5+.5)*innerWidth, py=(-_v.y*.5+.5)*innerHeight;
        if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py;
    });
    xpWin.style.left     = x0+'px';
    xpWin.style.top      = y0+'px';
    xpWin.style.width    = (x1-x0)+'px';
    xpWin.style.height   = (y1-y0)+'px';
    xpWin.style.fontSize = '11px';
}

// ── HINT ──────────────────────────────────────────────────────────────────────
const hintEl = document.getElementById('hint');
function esconderHint() { hintEl.classList.add('hide'); }

// ── ESTADO ────────────────────────────────────────────────────────────────────
let aberto    = false;
let modoLivre = false;

// ── ABRIR / FECHAR ────────────────────────────────────────────────────────────
function abrirPortfolio() {
    if (aberto) return;
    aberto    = true;
    modoLivre = false;
    renderer.render(scene, camera);
    fitOverlay();
    xpOverlay.classList.add('vis');
    esconderHint();
    btnVoltar.style.display    = 'none';
    canvas.style.pointerEvents = 'none';
    canvas.style.cursor        = 'default';
}

function fecharPortfolio() {
    if (!aberto) return;
    aberto = false;
    xpOverlay.classList.remove('vis');
    canvas.style.pointerEvents = 'auto';
}

// ── MODO LIVRE ────────────────────────────────────────────────────────────────
function ativarCameraLivre() {
    fecharPortfolio();
    modoLivre = true;
    canvas.style.pointerEvents = 'auto';
    configCamera.alternarModo('livre', () => {
        // Quando a animação terminar, mostra o botão de retorno
        btnVoltar.style.display = 'block';
    });
}

function voltarFoco() {
    modoLivre = false;
    btnVoltar.style.display = 'none';
    canvas.style.cursor     = 'default';
    configCamera.alternarModo('foco');
    setTimeout(abrirPortfolio, 2500);
}

// ── ABAS ──────────────────────────────────────────────────────────────────────
document.getElementById('xp-mb').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#xp-mb button').forEach(b => b.classList.remove('act'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('act'));
    btn.classList.add('act');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('act');
    if (btn.dataset.tab === 'skills') buildSkills();
});

// ── SKILLS ────────────────────────────────────────────────────────────────────
const SKILLS = [
    {n:'JavaScript',  p:90}, {n:'React/Next.js', p:85}, {n:'Node.js',    p:80},
    {n:'TypeScript',  p:75}, {n:'Python',         p:72}, {n:'PostgreSQL', p:68},
    {n:'Docker',      p:60}, {n:'Three.js',       p:55},
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

// ── RELÓGIO ───────────────────────────────────────────────────────────────────
function tick() {
    const el = document.getElementById('xp-clock');
    if (!el) return;
    const d = new Date();
    el.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(v => String(v).padStart(2,'0')).join(':');
}
tick(); setInterval(tick, 1000);

// ── BOTÕES ────────────────────────────────────────────────────────────────────
document.getElementById('btn-fechar').addEventListener('click', () => {
    fecharPortfolio(); voltarFoco();
});
document.getElementById('btn-camera').addEventListener('click', () => {
    ativarCameraLivre();
});
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (aberto)         { fecharPortfolio(); voltarFoco(); }
    else if (modoLivre) { voltarFoco(); }
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
    cssRenderer.render(cssScene, camera);
}
animate();

setTimeout(abrirPortfolio, 5500);

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    cssRenderer.setSize(innerWidth, innerHeight);
    if (aberto) fitOverlay();
});