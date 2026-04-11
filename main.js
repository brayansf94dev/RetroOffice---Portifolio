import * as THREE from 'three';
import { CSS3DRenderer } from 'https://unpkg.com/three@0.150.1/examples/jsm/renderers/CSS3DRenderer.js';
import { criarComputador }               from './computador.js';
import { configurarControles }           from './controles.js';
import { criarEstrelas, criarEsquadrao } from './cenario.js';
import { gerenciarCamera }               from './camera.js';
import { criarTelaInterativa }           from './tela.js';
import { registrarCallbackCamera, isModoCamera } from './musica.js';
import { 
    configurarControlesJogo, 
    criarNaveJogador, 
    atualizarJogador,
    atualizarJogo,
    iniciarJogo, 
    pararJogo,
    mostrarTelaInstrucoes,
    mostrarSelecaoPersonagem,
    setCenaFinalCameraCallback,
    cenaFinalAtiva,
    isCenaFinalAtiva,
    jogando,
    naveJogador
} from './jogo.js';
import { iniciarBZero64, atualizarBZero64, isBZeroAtivo } from './bzero64.js';

// ── CENA WebGL ────────────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
export let modoDialogo = false;
export let naveFalando = null;

// Ângulo atual da órbita cinematic — incrementado suavemente a cada frame
let _orbitaAngulo = 0;
let _orbitaAltura = 0;
let _orbitaTempo  = 0;

// ── MODO CÂMERA MÚSICA ────────────────────────────────────────
let _musicaCamTempo = 0;
let _musicaCamFase  = 0;
let _musicaCamTimer = 0;

export function focarNaveDialogo(nave, modo = 'close') {
    modoDialogo = !!nave;
    naveFalando = nave || null;
}

export function iniciarCicloCameraDialogo(nave) {
    if (!nave) return;
    modoDialogo = true;
    naveFalando = nave;
}

export function pararCameraDialogo() {
    modoDialogo = false;
    naveFalando = null;
}

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

// ── BOTÃO VOLTAR ──────────────────────────────────────────────────────────────
const btnVoltar = document.createElement('button');
btnVoltar.id        = 'btn-voltar';
btnVoltar.innerHTML = '🖥️ Voltar ao Portfólio';
btnVoltar.style.cssText = `
    display: none; position: fixed; bottom: 28px; left: 50%;
    transform: translateX(-50%); z-index: 30;
    background: rgba(10,10,20,0.85); color: #7CFF7C;
    border: 1px solid rgba(124,255,124,0.5); padding: 10px 24px;
    font-family: 'Courier New', monospace; font-size: 13px;
    letter-spacing: 1px; cursor: pointer; text-transform: uppercase;
    box-shadow: 0 0 18px rgba(124,255,124,0.15); backdrop-filter: blur(4px);
    transition: background 0.2s, box-shadow 0.2s;
`;
btnVoltar.addEventListener('mouseenter', () => { btnVoltar.style.background='rgba(20,40,20,0.95)'; btnVoltar.style.boxShadow='0 0 28px rgba(124,255,124,0.3)'; });
btnVoltar.addEventListener('mouseleave', () => { btnVoltar.style.background='rgba(10,10,20,0.85)'; btnVoltar.style.boxShadow='0 0 18px rgba(124,255,124,0.15)'; });
btnVoltar.addEventListener('click', () => voltarFoco());
document.body.appendChild(btnVoltar);

// ── OBJETOS ───────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const estrelas      = criarEstrelas();    scene.add(estrelas);
const meuComputador = criarComputador();  scene.add(meuComputador);
configurarControlesJogo();
criarNaveJogador(scene);

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

// Registra callback do modo câmera do music player
registrarCallbackCamera((ativo) => {
    if (ativo) {
        fecharPortfolio();
        controls.enabled = false;
        _musicaCamTempo  = 0;
        _musicaCamFase   = 0;
        _musicaCamTimer  = 0;
    } else {
        // Garante que o overlay está visível e interativo antes de reabrir
        xpOverlay.style.display  = '';
        xpOverlay.style.opacity  = '1';
        xpOverlay.style.pointerEvents = 'auto';
        aberto = false;          // força reabertura mesmo que flag estivesse presa
        configCamera.alternarModo('foco');
        setTimeout(abrirPortfolio, 2000);
    }
});

// ── FIT OVERLAY ───────────────────────────────────────────────────────────────
const xpOverlay = document.getElementById('xp-overlay');
const xpWin     = document.getElementById('xp-win');
const _v        = new THREE.Vector3();

// Posição de foco esperada da câmera (deve bater com camera.js → posicaoFocada)
const _posicaoFocadaRef = new THREE.Vector3(0, 1.9, 3.3);

function fitOverlay() {
    if (!telaMesh) return;

    // Não renderiza o overlay enquanto a câmera ainda está longe da posição de foco.
    // Isso evita que a wireframe fique com tamanho errado ao voltar do modo jogo,
    // pois a câmera pode estar em plena transição de lerp nesse momento.
    if (camera.position.distanceTo(_posicaoFocadaRef) > 1.5) return;

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
    xpWin.style.left=x0+'px'; xpWin.style.top=y0+'px';
    xpWin.style.width=(x1-x0)+'px'; xpWin.style.height=(y1-y0)+'px';
    xpWin.style.fontSize='11px';
}

// ── HINT ──────────────────────────────────────────────────────────────────────
const hintEl = document.getElementById('hint');
function esconderHint() { hintEl.classList.add('hide'); }

// ── ESTADO ────────────────────────────────────────────────────────────────────
let aberto    = false;
let modoLivre = false;
let modoJogo  = false;
let modoBZero = false;
let modoCenaFinal = false;

// Alvo da câmera para a cena final — lerp suave no loop
let cfCamPos  = null;
let cfCamLook = null;

// Registra callback para a cena final mover a câmera
setCenaFinalCameraCallback((pos, look) => {
    cfCamPos  = pos.clone();
    cfCamLook = look.clone();
});

// ── ESQUADRÃO ─────────────────────────────────────────────────────────────────
const esquadrao = criarEsquadrao(scene);

// ── ABRIR / FECHAR ────────────────────────────────────────────────────────────
function abrirPortfolio() {
    if (aberto || modoJogo) return;          // ← nunca abre durante o jogo
    aberto=true; modoLivre=false;
    renderer.render(scene, camera);
    fitOverlay();
    xpOverlay.classList.add('vis');
    xpOverlay.style.pointerEvents = 'auto';  // ← garante cliques no overlay
    esconderHint();
    btnVoltar.style.display='none';
    canvas.style.pointerEvents='none';
    canvas.style.cursor='default';
}

function fecharPortfolio() {
    if (!aberto) return;
    aberto=false;
    xpOverlay.classList.remove('vis');
    xpOverlay.style.pointerEvents = 'none';  // ← bloqueia cliques quando fechado
    canvas.style.pointerEvents='auto';
}

function ativarCameraLivre() {
    fecharPortfolio();
    modoLivre=true;
    canvas.style.pointerEvents='auto';
    configCamera.alternarModo('livre', () => { btnVoltar.style.display='block'; });
}


// ── INICIAR JOGO ──────────────────────────────────────────────────────────────
function ativarModoJogo() {
    fecharPortfolio();
    aberto = false;
    modoJogo = true;

    // Esconde e desabilita completamente o overlay durante o jogo
    xpOverlay.classList.remove('vis');
    xpOverlay.style.pointerEvents = 'none';
    xpOverlay.style.display = 'none';

    // Seleção de personagem → instruções → jogo
    mostrarSelecaoPersonagem(() => {
        // Recria nave com o personagem escolhido
        if (naveJogador) { scene.remove(naveJogador); }
        criarNaveJogador(scene);

        mostrarTelaInstrucoes(() => {
        configCamera.alternarModo('jogo');
        esquadrao.forEach(n => { n.mesh.visible=false; n.ativa=false; });
        canvas.style.cursor='none';
        btnVoltar.innerHTML='🛑 SAIR DO JOGO (ESC)';
        btnVoltar.style.display='block';

        iniciarJogo(scene, camera, () => {
            modoJogo=false;
            modoCenaFinal=false;
            cfCamPos=null; cfCamLook=null;
            btnVoltar.innerHTML='🖥️ Voltar ao Portfólio';
            btnVoltar.style.display='none'; // esconde até o portfólio reabrir
            esquadrao.forEach(n => { n.mesh.visible=true; n.timer=10; });
            canvas.style.cursor='default';
            xpOverlay.style.display = '';
            configCamera.alternarModo('foco');
            setTimeout(abrirPortfolio, 3000);
        });
        });
    });
}

// ── INICIAR B-ZERO 64 ─────────────────────────────────────────────────────────
function ativarBZero64() {
    fecharPortfolio();
    aberto    = false;
    modoBZero = true;

    xpOverlay.classList.remove('vis');
    xpOverlay.style.pointerEvents = 'none';
    xpOverlay.style.display = 'none';

    esquadrao.forEach(n => { n.mesh.visible = false; n.ativa = false; });
    meuComputador.visible = false;
    canvas.style.cursor = 'default';
    btnVoltar.innerHTML = '🛑 SAIR DA CORRIDA (ESC)';
    btnVoltar.style.display = 'block';
    controls.enabled = false;

    iniciarBZero64(scene, camera, controls, () => {
        modoBZero = false;
        btnVoltar.innerHTML = '🖥️ Voltar ao Portfólio';
        btnVoltar.style.display = 'none';
        esquadrao.forEach(n => { n.mesh.visible = true; n.timer = 10; });
        meuComputador.visible = true;
        xpOverlay.style.display = '';
        controls.enabled = true;
        configCamera.alternarModo('foco');
        setTimeout(abrirPortfolio, 3000);
    });
}

function voltarFoco() {
    if (modoViewer) { fecharViewer(); return; }
    if (isCenaFinalAtiva()) return;
    modoLivre = false; modoJogo = false; modoBZero = false;
    pararJogo();
    esquadrao.forEach(n => { n.mesh.visible=true; n.timer=10; });
    meuComputador.visible = true;
    btnVoltar.style.display='none';
    canvas.style.cursor='default';
    btnVoltar.innerHTML='🖥️ Voltar ao Portfólio';
    xpOverlay.style.display = '';
    configCamera.alternarModo('foco');
    setTimeout(abrirPortfolio, 2500);
}
document.getElementById('xp-mb').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#xp-mb button').forEach(b => b.classList.remove('act'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('act'));
    btn.classList.add('act');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('act');
    if (btn.dataset.tab==='skills') buildSkills();
});

// ── SKILLS — estático no HTML, buildSkills é no-op ──────────────────────────
function buildSkills(){ /* skills renderizadas diretamente no HTML */ }

// ── RELÓGIO ───────────────────────────────────────────────────────────────────
function tick(){
    const el=document.getElementById('xp-clock'); if(!el)return;
    const d=new Date();
    el.textContent=[d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');
}
tick(); setInterval(tick,1000);

// ── PAINEL HOLOGRÁFICO (overlay + animação de câmera) ─────────────────────────
let modoViewer = false;
let painelEl   = null;

function criarPainelHolografico() {
    painelEl = document.createElement('div');
    painelEl.id = 'holo-painel';
    painelEl.style.cssText = `
        display:none; position:fixed; inset:0; z-index:25;
        flex-direction:column; align-items:center; justify-content:center;
        background:rgba(0,4,16,0.0);
        transition:background 0.6s;
        font-family:'Courier New',monospace;
    `;

    painelEl.innerHTML = `
        <div id="holo-box" style="
            width:min(92vw,1300px); height:min(85vh,750px);
            display:flex; flex-direction:column;
            border:2px solid rgba(0,220,255,0.0);
            border-radius:8px; overflow:hidden;
            box-shadow:0 0 0px rgba(0,220,255,0);
            transition:border-color 0.5s 0.3s, box-shadow 0.5s 0.3s, opacity 0.4s;
            opacity:0;
            background:#000;
        ">
            <div id="holo-bar" style="
                height:34px; flex-shrink:0;
                background:linear-gradient(135deg,#001428,#002040);
                border-bottom:1px solid rgba(0,220,255,0.35);
                display:flex; align-items:center; padding:0 14px; gap:10px;
                font-size:12px; color:#00ccff;
            ">
                <span style="opacity:.5;font-size:10px;letter-spacing:1px;">◉ BEYOND_OS</span>
                <span id="holo-title" style="flex:1;text-align:center;letter-spacing:3px;font-weight:bold;color:#e0f4ff;font-size:11px;"></span>
                <a id="holo-ext" href="#" target="_blank" style="color:#00ccff;font-size:10px;text-decoration:none;opacity:.7;padding:2px 6px;border:1px solid rgba(0,220,255,0.3);border-radius:2px;">↗</a>
                <button id="holo-close" style="
                    background:rgba(255,50,50,0.75);border:none;color:#fff;
                    border-radius:3px;padding:2px 10px;cursor:pointer;
                    font-family:inherit;font-size:11px;letter-spacing:1px;
                ">✕ ESC</button>
            </div>
            <div style="flex:1;position:relative;overflow:hidden;">
                <iframe id="holo-iframe" src="" style="width:100%;height:100%;border:none;display:block;" allowfullscreen></iframe>
                <!-- scanlines decorativas sobre o iframe -->
                <div style="position:absolute;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(to bottom,transparent 0,transparent 3px,rgba(0,200,255,0.025) 3px,rgba(0,200,255,0.025) 4px);"></div>
                <!-- cantos HUD -->
                <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;opacity:.4" preserveAspectRatio="none">
                    <polyline points="0,28 0,0 28,0" fill="none" stroke="#00ccff" stroke-width="1.5"/>
                    <polyline points="calc(100% - 28),0 100%,0 100%,28" fill="none" stroke="#00ccff" stroke-width="1.5"/>
                    <polyline points="0,calc(100% - 28) 0,100% 28,100%" fill="none" stroke="#00ccff" stroke-width="1.5"/>
                    <polyline points="calc(100% - 28),100% 100%,100% 100%,calc(100% - 28)" fill="none" stroke="#00ccff" stroke-width="1.5"/>
                </svg>
            </div>
        </div>
    `;
    document.body.appendChild(painelEl);

    document.getElementById('holo-close').addEventListener('click', fecharViewer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modoViewer) fecharViewer(); });
}

// Câmera voa para este ponto vazio enquanto o painel materializa
const CAM_VIEWER_POS  = new THREE.Vector3(0, 1.8, -2);
const CAM_VIEWER_LOOK = new THREE.Vector3(0, 1.8, -10);

function abrirViewer(url, titulo) {
    if (modoViewer) return;
    modoViewer = true;

    fecharPortfolio();
    xpOverlay.style.display = 'none';
    controls.enabled = false;

    // Câmera começa a voar (loop cuida do lerp)
    // Painel aparece após a câmera ter viajado um pouco (0.5s delay)
    setTimeout(() => {
        document.getElementById('holo-title').textContent = titulo.toUpperCase();
        document.getElementById('holo-ext').href = url;
        document.getElementById('holo-iframe').src = url;

        painelEl.style.display = 'flex';
        // Força reflow para a transição funcionar
        painelEl.offsetHeight;
        painelEl.style.background = 'rgba(0,4,16,0.88)';

        const box = document.getElementById('holo-box');
        box.style.opacity = '1';
        box.style.borderColor = 'rgba(0,220,255,0.8)';
        box.style.boxShadow = '0 0 40px rgba(0,220,255,0.35), 0 0 80px rgba(0,100,200,0.15)';
    }, 500);

    btnVoltar.innerHTML = '◀ SAIR DO VIEWER';
    btnVoltar.style.display = 'block';
}

function fecharViewer() {
    if (!modoViewer) return;
    modoViewer = false;

    // Fade out do painel
    const box = document.getElementById('holo-box');
    if (box) { box.style.opacity = '0'; box.style.borderColor = 'rgba(0,220,255,0)'; box.style.boxShadow = 'none'; }
    if (painelEl) painelEl.style.background = 'rgba(0,4,16,0)';

    setTimeout(() => {
        if (painelEl) painelEl.style.display = 'none';
        document.getElementById('holo-iframe').src = '';
    }, 400);

    btnVoltar.style.display = 'none';
    xpOverlay.style.display = '';
    configCamera.alternarModo('foco');
    setTimeout(abrirPortfolio, 2200);
}

criarPainelHolografico();

// ── LISTENER DOS BOTÕES DE PROJETO ────────────────────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.closest('.proj-open-btn');
    if (!btn) return;
    const url   = btn.dataset.url;
    const title = btn.dataset.title || 'Projeto';
    if (!url) return;
    abrirViewer(url, title);
});

// ── BOTÕES ────────────────────────────────────────────────────────────────────
document.getElementById('btn-fechar').addEventListener('click',()=>{ fecharPortfolio(); voltarFoco(); });
document.getElementById('btn-camera').addEventListener('click',()=>{ ativarCameraLivre(); });
document.addEventListener('keydown', e=>{
    if(e.key!=='Escape')return;
    if(isCenaFinalAtiva()) return;  // bloqueia ESC durante cena final de vitória
    if(modoJogo){ pararJogo(); voltarFoco(); }
    else if(aberto){ fecharPortfolio(); voltarFoco(); }
    else if(modoLivre){ voltarFoco(); }
});

const btnFox=document.getElementById('btn-fox64');
if(btnFox) btnFox.addEventListener('click',()=>ativarModoJogo());

const btnBZero=document.getElementById('btn-bzero64');
if(btnBZero) btnBZero.addEventListener('click',()=>ativarBZero64());

// ── GALERIA DE FOTOS ──────────────────────────────────────────────────────────
const fotosData = [
    {
        src: 'img/brayan-perfil.jpg',
        emoji: '🧠',
        titulo: 'Brayan Rodrigues',
        legenda: 'Dev, PO, analista — e agora, escritor de código. Minha obsessão por tecnologia não é à toa: acredito que sistemas bem construídos mudam realidades. Cada projeto é uma missão, e eu levo isso a sério.'
    },
    {
        src: 'img/brayan-esposa.jpg',
        emoji: '💙',
        titulo: 'Ela é meu sistema central',
        legenda: 'Minha esposa não é só companheira — é minha base de operações. Nos momentos mais difíceis e nas conquistas mais importantes, ela estava lá. Tudo que construo faz mais sentido com ela do meu lado.'
    },
    {
        src: 'img/nala.jpg',
        emoji: '🐾',
        titulo: 'Nala',
        legenda: 'Não é um cachorro. É um bug afetivo com patas. Destrói almofadas, ignora comandos e ainda assim é o melhor co-piloto que já tive. 10/10 sem arrependimentos.'
    },
    {
        src: 'img/brayan-crianca.jpg',
        emoji: '🕹️',
        titulo: 'Desde o início...',
        legenda: 'Já nessa época eu sabia que tecnologia seria minha área. Cresci desmontando coisas pra ver como funcionavam. Spoiler: nem sempre conseguia montar de volta — mas aprendi muito no processo.'
    }
];

let galeriaAberta = false;
let galeriaFotoAtual = 0;

function criarGaleriaFotos() {
    const galEl = document.createElement('div');
    galEl.id = 'foto-galeria';
    galEl.style.cssText = `
        display:none; position:absolute; inset:0; z-index:50;
        background:#ECE9D8; flex-direction:column; overflow:hidden;
    `;

    galEl.innerHTML = `
        <div class="xp-tb" style="background:linear-gradient(to bottom,#2461EA,#1941C0 30%,#1636A8 70%,#0F2A8A);padding:.3em .6em;display:flex;align-items:center;color:white;">
            <span style="font-size:1.1em">📷</span>
            <span id="gal-titulo" style="flex:1;font-weight:bold;font-size:11px;margin-left:6px;letter-spacing:.5px;">Galeria — Brayan Rodrigues</span>
            <div class="xp-tb-btns">
                <button class="xp-cls" id="gal-close" title="Fechar" style="background:linear-gradient(to bottom,#e04040,#a02020);border:1px solid #801010;color:white;cursor:pointer;border-radius:3px;padding:0 8px;font-weight:bold;">✕</button>
            </div>
        </div>

        <!-- Foto principal -->
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 16px;gap:10px;background:#fff;position:relative;">

            <!-- Navegação anterior -->
            <button id="gal-prev" style="
                position:absolute;left:8px;top:50%;transform:translateY(-50%);
                background:linear-gradient(to bottom,#EBE8D7,#D7D4C8);
                border:1px solid #ACA899;border-radius:3px;
                font-size:1.2em;cursor:pointer;padding:6px 10px;
                color:#316AC5;font-weight:bold;z-index:2;
                box-shadow:1px 1px 0 #fff inset;
            ">◀</button>

            <!-- Foto -->
            <div id="gal-foto-wrap" style="
                position:relative;border:2px solid #ACA899;
                border-radius:3px;overflow:hidden;
                background:#ECE9D8;
                max-width:calc(100% - 80px);
                box-shadow:2px 2px 8px rgba(0,0,0,0.18);
                transition:opacity .25s;
            ">
                <img id="gal-img" src="" alt="" style="
                    display:block;max-width:100%;max-height:200px;
                    width:auto;height:auto;object-fit:cover;
                ">
                <!-- Fallback emoji quando não há foto -->
                <div id="gal-emoji-fallback" style="
                    display:none;font-size:5em;padding:20px 40px;
                    text-align:center;background:#ECE9D8;
                "></div>
            </div>

            <!-- Navegação próxima -->
            <button id="gal-next" style="
                position:absolute;right:8px;top:50%;transform:translateY(-50%);
                background:linear-gradient(to bottom,#EBE8D7,#D7D4C8);
                border:1px solid #ACA899;border-radius:3px;
                font-size:1.2em;cursor:pointer;padding:6px 10px;
                color:#316AC5;font-weight:bold;z-index:2;
                box-shadow:1px 1px 0 #fff inset;
            ">▶</button>

            <!-- Legenda -->
            <div style="max-width:calc(100% - 80px);text-align:center;">
                <div id="gal-nome" style="font-weight:bold;color:#0A246A;font-size:.95em;margin-bottom:4px;"></div>
                <div id="gal-legenda" style="font-size:.82em;color:#444;line-height:1.5;"></div>
            </div>

            <!-- Indicadores de pontos -->
            <div id="gal-dots" style="display:flex;gap:6px;margin-top:2px;"></div>
        </div>

        <!-- Miniaturas -->
        <div id="gal-thumbs" style="
            display:flex;gap:6px;padding:8px 12px;
            background:linear-gradient(to bottom,#EBE8D7,#D7D4C8);
            border-top:1px solid #ACA899;overflow-x:auto;
            scrollbar-width:thin;scrollbar-color:#ACA899 #ECE9D8;
        "></div>
    `;

    // Adiciona dentro do xp-body (posição absoluta cobre tudo)
    document.querySelector('.xp-body').appendChild(galEl);

    // Fechar
    document.getElementById('gal-close').addEventListener('click', fecharGaleria);

    // Navegação
    document.getElementById('gal-prev').addEventListener('click', () => {
        galeriaFotoAtual = (galeriaFotoAtual - 1 + fotosData.length) % fotosData.length;
        renderizarFoto(galeriaFotoAtual);
    });
    document.getElementById('gal-next').addEventListener('click', () => {
        galeriaFotoAtual = (galeriaFotoAtual + 1) % fotosData.length;
        renderizarFoto(galeriaFotoAtual);
    });

    // Miniaturas
    const thumbsContainer = document.getElementById('gal-thumbs');
    fotosData.forEach((foto, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'gal-thumb';
        thumb.dataset.idx = i;
        thumb.style.cssText = `
            flex-shrink:0;width:56px;height:42px;
            border:2px solid #ACA899;border-radius:2px;
            cursor:pointer;overflow:hidden;
            background:#ECE9D8;display:flex;align-items:center;justify-content:center;
            transition:border-color .15s;font-size:1.6em;
        `;
        // Tenta carregar imagem, senão mostra emoji
        const tImg = document.createElement('img');
        tImg.src = foto.src;
        tImg.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        tImg.onerror = () => { tImg.style.display='none'; thumb.textContent = foto.emoji; };
        thumb.appendChild(tImg);
        thumb.addEventListener('click', () => {
            galeriaFotoAtual = i;
            renderizarFoto(i);
        });
        thumbsContainer.appendChild(thumb);
    });

    // Dots
    const dotsContainer = document.getElementById('gal-dots');
    fotosData.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.dataset.dot = i;
        dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:#ACA899;border:1px solid #888;cursor:pointer;transition:background .15s;`;
        dot.addEventListener('click', () => { galeriaFotoAtual = i; renderizarFoto(i); });
        dotsContainer.appendChild(dot);
    });
}

function renderizarFoto(idx) {
    const foto = fotosData[idx];
    const wrap = document.getElementById('gal-foto-wrap');
    const img  = document.getElementById('gal-img');
    const emojiDiv = document.getElementById('gal-emoji-fallback');

    // Fade suave
    wrap.style.opacity = '0';
    setTimeout(() => {
        img.style.display = 'block';
        emojiDiv.style.display = 'none';
        img.src = foto.src;
        img.alt = foto.titulo;
        img.onerror = () => {
            img.style.display = 'none';
            emojiDiv.style.display = 'block';
            emojiDiv.textContent = foto.emoji;
        };
        document.getElementById('gal-nome').textContent = foto.emoji + '  ' + foto.titulo;
        document.getElementById('gal-legenda').textContent = foto.legenda;
        wrap.style.opacity = '1';
    }, 200);

    // Atualiza thumbs highlight
    document.querySelectorAll('.gal-thumb').forEach((t, i) => {
        t.style.borderColor = i === idx ? '#316AC5' : '#ACA899';
        t.style.boxShadow   = i === idx ? '0 0 6px rgba(49,106,197,0.4)' : 'none';
    });

    // Atualiza dots
    document.querySelectorAll('[data-dot]').forEach((d, i) => {
        d.style.background = i === idx ? '#316AC5' : '#ACA899';
        d.style.transform  = i === idx ? 'scale(1.3)' : 'scale(1)';
    });
}

function abrirGaleria() {
    galeriaAberta = true;
    galeriaFotoAtual = 0;
    const galEl = document.getElementById('foto-galeria');
    galEl.style.display = 'flex';
    renderizarFoto(0);
}

function fecharGaleria() {
    galeriaAberta = false;
    const galEl = document.getElementById('foto-galeria');
    if (galEl) galEl.style.display = 'none';
}

criarGaleriaFotos();

const btnFotos = document.getElementById('btn-fotos');
if (btnFotos) btnFotos.addEventListener('click', abrirGaleria);

function getAliadasVisiveisDaCena() {
    const aliadas = [];

    scene.traverse(obj => {
        if (
            obj.isGroup &&
            obj.visible &&
            (
                obj.userData?.nome === 'NALA STARWING' ||
                obj.userData?.nome === 'ALICE VIXEN'
            )
        ) {
            aliadas.push(obj);
        }
    });

    return aliadas;
}

function getCentroFormacao() {
    const pontos = [];

    if (naveJogador && naveJogador.visible) pontos.push(naveJogador.position.clone());

    for (const aliada of getAliadasVisiveisDaCena()) {
        pontos.push(aliada.position.clone());
    }

    if (pontos.length === 0) {
        return new THREE.Vector3(0, 2, 4);
    }

    const centro = new THREE.Vector3();
    for (const p of pontos) centro.add(p);
    centro.divideScalar(pontos.length);

    return centro;
}

// ── LOOP ──────────────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    // IMPORTANTE: não deixa a câmera do portfólio brigar com a câmera do diálogo
    if (!modoDialogo && !jogando && !modoBZero && !isModoCamera()) {
        configCamera.atualizarCamera();
    }

    estrelas.rotation.y += 0.0001;

    // ── MODO CÂMERA MÚSICA — órbita cinematic pelo cenário ───────────────────
    if (isModoCamera() && !modoViewer && !modoDialogo && !jogando) {
        controls.enabled = false;
        _musicaCamTempo += 0.0006;
        _musicaCamTimer += 0.0006;

        // Muda de trajetória a cada ~30s para dar variedade
        if (_musicaCamTimer > 0.6) { _musicaCamTimer = 0; _musicaCamFase = (_musicaCamFase + 1) % 4; }

        let posAlvo, lookAlvo;

        if (_musicaCamFase === 0) {
            // Órbita lenta ao redor do computador
            const r = 6 + Math.sin(_musicaCamTempo * 1.1) * 1.5;
            posAlvo  = new THREE.Vector3(Math.sin(_musicaCamTempo) * r, 2.5 + Math.sin(_musicaCamTempo * 0.7) * 1.2, Math.cos(_musicaCamTempo) * r);
            lookAlvo = new THREE.Vector3(0, 1.5, 0);
        } else if (_musicaCamFase === 1) {
            // Voo alto — visão do universo
            const r = 12 + Math.sin(_musicaCamTempo * 0.5) * 3;
            posAlvo  = new THREE.Vector3(Math.sin(_musicaCamTempo * 0.6) * r, 6 + Math.sin(_musicaCamTempo * 0.4) * 2, Math.cos(_musicaCamTempo * 0.6) * r);
            lookAlvo = new THREE.Vector3(0, 0, 0);
        } else if (_musicaCamFase === 2) {
            // Aproximação lenta da tela do monitor
            posAlvo  = new THREE.Vector3(Math.sin(_musicaCamTempo * 0.3) * 2, 2 + Math.sin(_musicaCamTempo * 0.5) * 0.5, 3 + Math.cos(_musicaCamTempo * 0.2) * 1);
            lookAlvo = new THREE.Vector3(0, 1.8, 0);
        } else {
            // Drift lateral suave — estilo cinematográfico
            posAlvo  = new THREE.Vector3(Math.sin(_musicaCamTempo * 0.4) * 8, 1.5 + Math.cos(_musicaCamTempo * 0.3) * 1.5, 5 + Math.sin(_musicaCamTempo * 0.2) * 3);
            lookAlvo = new THREE.Vector3(Math.sin(_musicaCamTempo * 0.1) * 2, 1.5, 0);
        }

        camera.position.lerp(posAlvo, 0.008);
        if (!animate._lookMusicaCurrent) animate._lookMusicaCurrent = lookAlvo.clone();
        animate._lookMusicaCurrent.lerp(lookAlvo, 0.012);
        camera.lookAt(animate._lookMusicaCurrent);

    // ── 0. VIEWER HOLOGRÁFICO ────────────────────────────────────────────────
    } else if (modoViewer) {
        controls.enabled = false;
        // Câmera voa suavemente para frente, dando sensação de "entrar" no painel
        camera.position.lerp(CAM_VIEWER_POS, 0.03);
        camera.lookAt(CAM_VIEWER_LOOK);

    // ── 1. CENA FINAL / DIÁLOGO ─────────────────────────────────────────────
    } else if (modoDialogo) {
        controls.enabled = false;

        // Centro entre as três naves (jogador + aliadas)
        const centro = getCentroFormacao();

        // Órbita contínua e muito suave
        // _orbitaTempo avança devagar — dá uma volta completa em ~80s
        _orbitaTempo  += 0.0008;
        _orbitaAngulo  = _orbitaTempo * Math.PI * 2;

        // Altura varia suavemente com frequência diferente — evita loop repetitivo
        const alturaBase  = centro.y + 2.4;
        const alturaOnda  = Math.sin(_orbitaTempo * 1.7) * 0.8;
        const alturaAlvo  = alturaBase + alturaOnda;

        // Raio da órbita também pulsa levemente
        const raio = 7.5 + Math.sin(_orbitaTempo * 2.3) * 1.2;

        const posAlvo = new THREE.Vector3(
            centro.x + Math.sin(_orbitaAngulo) * raio,
            alturaAlvo,
            centro.z + Math.cos(_orbitaAngulo) * raio
        );

        // lerp muito suave — câmera "flutua" até o alvo (nunca corta)
        camera.position.lerp(posAlvo, 0.018);

        // lookAt suave via interpolação de um vetor alvo
        const lookAlvo = new THREE.Vector3(
            centro.x,
            centro.y + 0.5,
            centro.z
        );
        // Usamos um objeto auxiliar para interpolar o lookAt
        if (!animate._lookCurrent) animate._lookCurrent = lookAlvo.clone();
        animate._lookCurrent.lerp(lookAlvo, 0.025);
        camera.lookAt(animate._lookCurrent);

    // ── 2. GAMEPLAY ─────────────────────────────────────────────────────────
    } else if (jogando && naveJogador) {
        controls.enabled = false;

        atualizarJogador();
        atualizarJogo(scene);

        camera.position.lerp(new THREE.Vector3(
            naveJogador.position.x * 0.25,
            naveJogador.position.y * 0.15 + 5,
            naveJogador.position.z + 10
        ), 0.06);

        camera.lookAt(
            naveJogador.position.x * 0.3,
            naveJogador.position.y * 0.3 - 1,
            naveJogador.position.z - 30
        );

    // ── 2b. B-ZERO 64 ───────────────────────────────────────────────────────
    } else if (modoBZero) {
        controls.enabled = false;
        atualizarBZero64();

    // ── 3. PORTFÓLIO ────────────────────────────────────────────────────────
    } else if (!modoJogo) {
        controls.enabled = true;
    }

    // Naves do esquadrão decorativo — apenas fora do jogo e do B-Zero
    if (!modoJogo && !jogando && !modoBZero) {
        esquadrao.forEach(nave => {
            if (!nave.ativa) {
                nave.timer--;
                if (nave.timer <= 0) {
                    nave.ativa = true;
                    nave.mesh.position.set(-20, Math.random() * 4 + 1, Math.random() > .5 ? 3 : -3);
                    nave.mesh.rotation.z = -Math.PI / 2;
                    nave.mesh.material.opacity = 0;
                }
            } else {
                nave.mesh.position.x += nave.velocidade;
                nave.mesh.rotation.x += 0.1;

                if (nave.mesh.position.x < -10) nave.mesh.material.opacity += 0.02;
                else if (nave.mesh.position.x > 10) nave.mesh.material.opacity -= 0.02;
                else nave.mesh.material.opacity = 1;

                if (nave.mesh.position.x > 20) {
                    nave.ativa = false;
                    nave.timer = Math.random() * 1000 + 200;
                }
            }
        });
    }

    if (aberto && !modoJogo && !modoBZero) fitOverlay();

    if (controls.enabled) controls.update();

    renderer.render(scene, camera);
    cssRenderer.render(cssScene, camera);
}

animate();
setTimeout(abrirPortfolio,5500);

window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
    cssRenderer.setSize(innerWidth,innerHeight);
    if(aberto) fitOverlay();
});

// ── CONTEÚDOS DOS PROJETOS (SOBRE) ─────────────────────────────
// ── CONTEÚDOS DOS PROJETOS (SOBRE) ─────────────────────────────
const dadosSobre = {
    "brayanos": {
        titulo: "Portfólio 3D — Nostalgia, Identidade e Engenharia WebGL",
        html: `
            <h3 style="color:#0A246A; margin-bottom: 8px; font-size: 1.2em;">A Visão: Nostalgia, Família e Identidade</h3>
            <p style="margin-bottom: 12px;">O Brayan_OS vai muito além de uma demonstração de código; é um reflexo de quem eu sou. Unir a interface clássica do <strong>Windows XP</strong> com a estética e a vibe do <strong>Nintendo 64</strong> foi a forma que encontrei de humanizar a tecnologia e contar a minha história.</p>
            <p style="margin-bottom: 12px;">O tema espacial não foi escolhido por acaso: ele representa a exploração e a liberdade criativa, pilares que me movem diariamente ao lado da minha base sólida: minha família, minha esposa e a Nala (minha cachorrinha, que inclusive ganhou uma participação especial como suporte no esquadrão da nave!). O objetivo final é provar que a engenharia de software pode, sim, transmitir emoção e carregar significado pessoal.</p>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/portfolio-nostalgia.png" alt="Setup retro com Windows XP e estética N64" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">O encontro entre duas eras marcantes, materializadas diretamente no navegador.</p>
            </div>

            <h3 style="color:#0A246A; margin-bottom: 8px; font-size: 1.2em;">Renderização Híbrida e Escala Espacial</h3>
            <p style="margin-bottom: 12px;">Para tornar essa visão realidade, o maior desafio técnico foi emular o sistema operacional funcional dentro do ecossistema 3D. Em vez de texturas estáticas, utilizei o <strong>CSS3DRenderer</strong> para injetar o DOM real na tela do monitor.</p>
            <p style="margin-bottom: 12px;">Isso exigiu cálculos precisos de escala (reduzindo a div HTML de 1024x768px em um fator de <code>0.00155</code> para caber nas unidades de mundo do Three.js), garantindo que os botões com efeitos de tubo CRT continuassem perfeitamente clicáveis na malha 3D.</p>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/portfolio-css3d.png" alt="Código do CSS3DRenderer no tela.js" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">Matemática de escala e injeção do DOM dentro do Canvas WebGL.</p>
            </div>

            <h3 style="color:#0A246A; margin-bottom: 8px; font-size: 1.2em;">Game Engine e Áudio Procedural (Web Audio API)</h3>
            <p style="margin-bottom: 12px;">Para fechar a experiência, desenvolvi uma homenagem aos clássicos espaciais. A engine de áudio gera lasers e explosões de forma 100% matemática via <em>GainNodes</em>, economizando banda. O loop de física independente gerencia 10 ondas de desafio, detecção de colisões e caixas de diálogo dinâmicas, integrando o enredo pessoal à gameplay imersiva.</p>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/portfolio-gameplay.png" alt="Gameplay embutido com a Nala" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">Simulação física e narrativa pessoal: Nala em ação no esquadrão de defesa.</p>
            </div>
        `
    },
   "beyondbits": {
        titulo: "Beyond Bits — Design Elegante, Funcional e Direto ao Ponto",
        html: `
            <h3 style="color:#0A246A; margin-bottom: 8px; font-size: 1.2em;">A Visão: Fugindo do "Mais do Mesmo"</h3>
            <p style="margin-bottom: 12px;">O mercado corporativo está saturado de templates genéricos e engessados. A premissa para o site da Beyond Bits foi criar uma experiência <strong>extremamente funcional e direta ao ponto</strong>, mas envelopada em um design elegante, moderno e com identidade própria.</p>
            <p style="margin-bottom: 12px;">A interface foi projetada com foco absoluto na conversão, apresentando soluções sem excesso de cliques, navegação confusa ou enrolação visual.</p>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/beyondbits-hero.png" alt="Visão geral do design da Beyond Bits" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">UI elegante e copy persuasiva, entregando o valor do negócio nos primeiros segundos.</p>
            </div>

            <h3 style="color:#0A246A; margin-bottom: 8px; font-size: 1.2em;">O Diferencial Visual: Imersão com WebGL</h3>
            <p style="margin-bottom: 12px;">Para materializar essa elegância e criar uma atmosfera de alta tecnologia, incorporei o <strong>Three.js</strong> ao background. Uma esfera de partículas interativa, gerada através de <code>BufferGeometry</code>, reage fluidamente ao scroll e ao mouse. Essa escolha traz um dinamismo sutil e premium, renderizando milhares de vértices direto na GPU sem comprometer o carregamento da página.</p>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/beyondbits-particle.png" alt="Esfera de partículas e temas Dark/Light" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">A transição perfeita entre Dark e Light mode com filtro SVG de ruído analógico ao fundo.</p>
            </div>

            <h3 style="color:#0A246A; margin-bottom: 8px; font-size: 1.2em;">Arquitetura Front-end Sênior</h3>
            <p style="margin-bottom: 12px;">Por trás da simplicidade visual, a engenharia foi otimizada para Core Web Vitals e segurança:</p>
            <ul style="margin-bottom: 15px; padding-left: 20px;">
                <li style="margin-bottom: 5px;"><strong>Performance e Scroll:</strong> A API nativa <code>IntersectionObserver</code> gerencia as animações de entrada de forma inteligente, acionando as classes CSS apenas quando entram na viewport, garantindo um scroll leve.</li>
                <li style="margin-bottom: 5px;"><strong>Dark Mode sem FOUC:</strong> O controle de temas (CSS Variables) é validado por um script inline no <code>&lt;head&gt;</code>, eliminando o temido "flash branco" antes do carregamento completo do DOM.</li>
                <li style="margin-bottom: 5px;"><strong>Segurança no Front-end:</strong> Rotas dinâmicas e o número de contato do WhatsApp são mascarados em Base64 e decodificados em tempo real no <code>whatsapp.js</code>, bloqueando robôs de spam e varredura de dados.</li>
            </ul>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/beyondbits-security.png" alt="Mascaramento em Base64 no código" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">Lógica de segurança e mascaramento de dados no client-side.</p>
            </div>
        `
    },
    "beyondbrain": {
        titulo: "Beyond Brain — Sistema Operacional de Conhecimento com IA",
        html: `
            <h3 style="color:#0A246A; margin-bottom: 8px;">A Solução: Terminal UI & Fluidez Cognitiva</h3>
            <p style="margin-bottom: 12px;">
                O Beyond Brain é um ambiente operacional completo onde ideias são capturadas, estruturadas e conectadas de forma inteligente. Com uma interface baseada em terminais clássicos, o sistema permite que o usuário interaja exclusivamente através de comandos customizados, criando um fluxo de pensamento direto, rápido e sem distrações visuais de UX tradicionais.
            </p>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/beyondbrain-terminal.png" alt="Interface do Terminal Beyond Brain" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">Terminal UI: Fluxo de pensamento direto através de comandos customizados.</p>
            </div>

            <h3 style="color:#0A246A; margin-bottom: 8px;">A Abordagem: Graph Engine e IA Aplicada</h3>
            <p style="margin-bottom: 12px;">
                O Beyond Brain transforma conhecimento em estrutura viva através de um sistema baseado em grafo, onde cada nota se conecta a outras, formando uma rede dinâmica de pensamento. Integrei APIs de IA para geração, análise e conexão automatizada de conteúdo, potencializando o fator humano sem engessar a operação.
            </p>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/beyondbrain-grafo.png" alt="Visualização de Grafo" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">Graph Engine: Visualização interativa das relações profundas entre as ideias.</p>
            </div>

            <h3 style="color:#0A246A; margin-bottom: 8px;">Arquitetura Modular Orientada a Eventos (Event-Driven)</h3>
            <p style="margin-bottom: 12px;">
                Para garantir a escalabilidade e o desacoplamento total, utilizei um <em>event bus</em> central que orquestra a comunicação entre a interface (DOM), o executor de comandos (router dedicado) e a lógica de persistência de dados.
            </p>
            <ul style="margin-bottom: 15px; padding-left: 20px;">
                <li style="margin-bottom: 5px;"><b>Command Engine:</b> parser de DSL própria com suporte a captura de fluxo e estados interativos.</li>
                <li style="margin-bottom: 5px;"><b>Graph Engine:</b> construção de rede de conhecimento com suporte a pesos e profundidade.</li>
                <li style="margin-bottom: 5px;"><b>Persistence Layer:</b> integração completa com Supabase para autenticação e armazenamento.</li>
            </ul>

            <div style="text-align: center; margin: 20px 0; background: #fff; padding: 10px; border: 1px solid #ACA899;">
                <img src="img/beyondbrain-code.png" alt="Arquitetura de Eventos" style="max-width: 100%; border: 1px solid #ccc;">
                <p style="font-size: 0.85em; color: #666; margin-top: 5px; font-style: italic;">Arquitetura Event-Driven desacoplando a lógica de IA e a interface.</p>
            </div>
        `
    }
};

// ── LÓGICA DA JANELA "SOBRE" ───────────────────────────────────
const aboutViewer  = document.getElementById('about-viewer');
const aboutTitle   = document.getElementById('about-title');
const aboutContent = document.getElementById('about-content');
const aboutClose   = document.getElementById('about-close');

// Captura todos os botões "Ver Sobre"
document.querySelectorAll('.proj-about-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const projId = e.target.getAttribute('data-project');
        const info = dadosSobre[projId];
        
        if (info) {
            aboutTitle.innerText = info.titulo;
            aboutContent.innerHTML = info.html;
            aboutViewer.style.display = 'flex'; // Exibe a tela por cima das abas
        }
    });
});

// Botão de fechar a janela
if (aboutClose) {
    aboutClose.addEventListener('click', () => {
        aboutViewer.style.display = 'none'; // Oculta a tela
        aboutContent.innerHTML = '';        // Limpa o conteúdo (opcional)
    });
}