import * as THREE from 'three';
import { IMG_BRAYAN, IMG_NALA, IMG_ALICE, IMG_BASE, IMG_TEAM } from './imagens.js';
import {
    tocarTiro,
    tocarTiroUpgrade,
    tocarTiroHyper,
    tocarExplosao,
    tocarDano,
    tocarItem,
    tocarUpgrade,
    tocarDialogo,
    tocarVitoria,
    iniciarMusica,
    pararMusica,
    setMudo,
    isMudo,
} from './audio.js';

// ── ESTADO EXPORTADO ──────────────────────────────────────────────────────────
export const teclas = { w: false, a: false, s: false, d: false };
export let naveJogador = null;
export let jogando     = false;

// ── ESTADO INTERNO ────────────────────────────────────────────────────────────
let vidaPC           = 100;
let vidaNave         = 100;
let pontos           = 0;
let lasers           = [];
let meteoros         = [];
let itens            = [];
let sceneRef         = null;
let cameraRef        = null;
let onGameOver       = null;
let ondaAtual        = 1;
let mouseX           = 0;
let mouseY           = 0;
let imortalidade     = 0;
let tiroUpgrade      = false;   // twin laser (onda 5+)
let tiroUpgradeTimer = 0;
let tiroHyper        = false;   // HYPER BEAM (onda 3) — destrói tudo
let tiroHyperTimer   = 0;
let cutscenePausa    = false;   // pausa o loop de ondas durante cutscenes
let dialogoIntervalo = null;
let dialogoTimeout   = null;

// ── HUD ───────────────────────────────────────────────────────────────────────
let hudEl = null;

function criarHUD() {
    if (hudEl) return;
    const P = CFG_PERSONAGENS[personagemEscolhido];
    hudEl = document.createElement('div');
    hudEl.id = 'game-hud';
    hudEl.innerHTML = `
        <div id="hud-mira">
            <div class="mira-anel"></div>
            <div class="mira-cruz h"></div>
            <div class="mira-cruz v"></div>
            <div class="mira-dot"></div>
        </div>

        <div id="hud-painel-esq">
            <div class="hud-face">
                <img class="hud-face-img" src="${P.img()}" alt="${P.nome}">
                <div class="hud-nome">${P.nome.split(' ')[0]}</div>
            </div>
            <div class="hud-barras">
                <div class="hud-label-bar">SHIELD</div>
                <div class="hud-bar-bg"><div id="hud-vida-nave" class="hud-bar verde"></div></div>
                <span id="hud-vida-nave-num" class="hud-bar-num">100</span>
                <div id="hud-upgrade-badge" style="display:none">⚡ TWIN LASER</div>
            </div>
        </div>

        <div id="hud-painel-dir">
            <div class="hud-face">
                <img class="hud-face-img hud-face-base" src="${IMG_BASE}" alt="BASE">
                <div class="hud-nome">BASE</div>
            </div>
            <div class="hud-barras">
                <div class="hud-label-bar">HP</div>
                <div class="hud-bar-bg"><div id="hud-barra" class="hud-bar verde"></div></div>
                <span id="hud-vida-num" class="hud-bar-num">100</span>
            </div>
        </div>

        <div id="hud-topo">
            <div id="hud-onda-topo">WAVE <span id="hud-onda-num">1</span></div>
            <div id="hud-score-topo">SCORE <span id="hud-pts">0</span></div>
            <div id="hud-acoes">
                <button id="hud-mute"  title="Mudo · tecla M">🔊</button>
                <button id="hud-ajuda" title="Atalhos · tecla H">M</button>
            </div>
        </div>

        <div id="hud-dialogo" style="display:none">
            <img class="dialogo-face" id="dialogo-face-img" src="${P.img()}" alt="">
            <div class="dialogo-corpo">
                <div id="dialogo-nome" class="dialogo-nome"></div>
                <div id="dialogo-txt"  class="dialogo-texto"></div>
            </div>
        </div>

        <div id="hud-dica">🖱️ Mouse · Clique para atirar · WASD mover · <b>M</b> mudo · <b>H</b> atalhos</div>
    `;
    document.body.appendChild(hudEl);
    document.addEventListener('mousemove', onMouseMove);

    // ── Estilos injetados ────────────────────────────────────────────────────
    if (!document.getElementById('hud-extra-style')) {
        const s = document.createElement('style');
        s.id = 'hud-extra-style';
        s.textContent = `
            #hud-acoes {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            #hud-acoes button {
                background: rgba(0,0,0,0.55);
                border: 1px solid rgba(255,255,255,0.22);
                border-radius: 5px;
                color: #fff;
                font-size: 1em;
                width: 32px;
                height: 28px;
                cursor: pointer;
                line-height: 1;
                transition: background 0.15s, border-color 0.15s;
                font-family: 'Courier New', monospace;
            }
            #hud-acoes button:hover {
                background: rgba(255,255,255,0.18);
                border-color: rgba(255,255,255,0.5);
            }

            /* ── Tela de atalhos ── */
            #hud-atalhos-overlay {
                position: fixed;
                inset: 0;
                z-index: 600;
                background: rgba(0,0,0,0.72);
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
                animation: fadeInAtalhos .18s ease;
            }
            @keyframes fadeInAtalhos { from { opacity:0; transform:scale(.96); } to { opacity:1; transform:scale(1); } }
            #hud-atalhos-box {
                background: linear-gradient(160deg, #0a0e1a 0%, #0d1525 100%);
                border: 1px solid rgba(0,200,255,0.35);
                border-radius: 10px;
                padding: 28px 36px 24px;
                min-width: 340px;
                max-width: 420px;
                box-shadow: 0 0 40px rgba(0,180,255,0.18), 0 0 0 1px rgba(0,200,255,0.08);
                font-family: 'Courier New', monospace;
                color: #cce8ff;
                position: relative;
            }
            #hud-atalhos-box h2 {
                margin: 0 0 18px;
                font-size: 1em;
                letter-spacing: 4px;
                text-align: center;
                color: #00ccff;
                text-shadow: 0 0 12px #00ccff88;
            }
            .atalho-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .atalho-row:last-child { border-bottom: none; }
            .atalho-key {
                background: rgba(0,180,255,0.12);
                border: 1px solid rgba(0,180,255,0.35);
                border-radius: 5px;
                padding: 3px 10px;
                font-size: .82em;
                font-weight: bold;
                letter-spacing: 1px;
                color: #00ddff;
                min-width: 80px;
                text-align: center;
                white-space: nowrap;
            }
            .atalho-desc {
                font-size: .88em;
                color: #aac8e8;
                line-height: 1.3;
            }
            #hud-atalhos-mute-toggle {
                display: block;
                margin: 20px auto 0;
                background: rgba(0,180,255,0.12);
                border: 1px solid rgba(0,180,255,0.4);
                border-radius: 6px;
                color: #00ddff;
                font-family: 'Courier New', monospace;
                font-size: .9em;
                letter-spacing: 2px;
                padding: 8px 24px;
                cursor: pointer;
                transition: background .15s;
            }
            #hud-atalhos-mute-toggle:hover { background: rgba(0,180,255,0.25); }
            #hud-atalhos-fechar {
                position: absolute;
                top: 12px; right: 14px;
                background: none;
                border: none;
                color: #558;
                font-size: 1.1em;
                cursor: pointer;
                line-height: 1;
                transition: color .15s;
            }
            #hud-atalhos-fechar:hover { color: #fff; }
        `;
        document.head.appendChild(s);
    }

    // ── Toggle mudo ─────────────────────────────────────────────────────────
    function _atualizarIconeMute() {
        const mudo = isMudo();
        const btn  = document.getElementById('hud-mute');
        if (btn) btn.textContent = mudo ? '🔇' : '🔊';
        const tog = document.getElementById('hud-atalhos-mute-toggle');
        if (tog) tog.textContent = mudo ? '🔊 ATIVAR SOM' : '🔇 SILENCIAR';
    }

    function _toggleMudo() {
        setMudo(!isMudo());
        _atualizarIconeMute();
    }

    document.getElementById('hud-mute').addEventListener('click', e => {
        e.stopPropagation();
        _toggleMudo();
    });

    // ── Tela de atalhos ──────────────────────────────────────────────────────
    let atalhoAberto = false;

    function _abrirAtalhos() {
        if (atalhoAberto) return;
        atalhoAberto = true;

        const mudo = isMudo();
        const ov = document.createElement('div');
        ov.id = 'hud-atalhos-overlay';
        ov.innerHTML = `
            <div id="hud-atalhos-box">
                <button id="hud-atalhos-fechar" title="Fechar">✕</button>
                <h2>◆ ATALHOS ◆</h2>

                <div class="atalho-row">
                    <span class="atalho-key">CLIQUE</span>
                    <span class="atalho-desc">Disparar laser</span>
                </div>
                <div class="atalho-row">
                    <span class="atalho-key">MOUSE</span>
                    <span class="atalho-desc">Mira livre</span>
                </div>
                <div class="atalho-row">
                    <span class="atalho-key">W A S D</span>
                    <span class="atalho-desc">Mover nave</span>
                </div>
                <div class="atalho-row">
                    <span class="atalho-key">M</span>
                    <span class="atalho-desc">Silenciar / ativar som</span>
                </div>
                <div class="atalho-row">
                    <span class="atalho-key">H</span>
                    <span class="atalho-desc">Abrir / fechar atalhos</span>
                </div>
                <div class="atalho-row">
                    <span class="atalho-key">ESC</span>
                    <span class="atalho-desc">Sair do jogo</span>
                </div>

                <button id="hud-atalhos-mute-toggle">${mudo ? '🔊 ATIVAR SOM' : '🔇 SILENCIAR'}</button>
            </div>
        `;
        document.body.appendChild(ov);

        document.getElementById('hud-atalhos-fechar').addEventListener('click', _fecharAtalhos);
        document.getElementById('hud-atalhos-mute-toggle').addEventListener('click', () => {
            _toggleMudo();
        });
        ov.addEventListener('click', e => { if (e.target === ov) _fecharAtalhos(); });
    }

    function _fecharAtalhos() {
        atalhoAberto = false;
        const ov = document.getElementById('hud-atalhos-overlay');
        if (ov) ov.remove();
    }

    document.getElementById('hud-ajuda').addEventListener('click', e => {
        e.stopPropagation();
        atalhoAberto ? _fecharAtalhos() : _abrirAtalhos();
    });

    // ── Listener de teclado (M e H) ──────────────────────────────────────────
    window._muteKeyHandler = e => {
        const k = e.key;
        if (k === 'm' || k === 'M') { _toggleMudo(); return; }
        if (k === 'h' || k === 'H') { atalhoAberto ? _fecharAtalhos() : _abrirAtalhos(); }
    };
    window.addEventListener('keydown', window._muteKeyHandler);
}

function onMouseMove(e) {
    mouseX = (e.clientX / window.innerWidth)  * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    const mira = document.getElementById('hud-mira');
    if (mira) { mira.style.left = e.clientX + 'px'; mira.style.top = e.clientY + 'px'; }
}

function atualizarHUD() {
    if (!hudEl) return;
    const pn = Math.max(0, vidaNave);
    const bN = document.getElementById('hud-vida-nave');
    if (bN) { bN.style.width = pn+'%'; bN.className = 'hud-bar '+(pn>60?'verde':pn>30?'amarelo':'vermelho'); }
    const nN = document.getElementById('hud-vida-nave-num'); if (nN) nN.textContent = Math.ceil(pn);

    const pp = Math.max(0, vidaPC);
    const bP = document.getElementById('hud-barra');
    if (bP) { bP.style.width = pp+'%'; bP.className = 'hud-bar '+(pp>60?'verde':pp>30?'amarelo':'vermelho'); }
    const nP = document.getElementById('hud-vida-num'); if (nP) nP.textContent = Math.ceil(pp);

    const pts  = document.getElementById('hud-pts');      if (pts)  pts.textContent  = pontos;
    const onda = document.getElementById('hud-onda-num'); if (onda) onda.textContent = ondaAtual;
    const badge = document.getElementById('hud-upgrade-badge');
    if (badge) {
        if (tiroHyper) { badge.style.display='block'; badge.textContent='☄️ HYPER BEAM'; badge.style.color='#ff00ff'; badge.style.textShadow='0 0 12px #ff00ff'; }
        else if (tiroUpgrade) { badge.style.display='block'; badge.textContent='⚡ TWIN LASER'; badge.style.color='#ffcc00'; badge.style.textShadow='0 0 8px #ffcc00'; }
        else badge.style.display='none';
    }
}

function removerHUD() {
    document.removeEventListener('mousemove', onMouseMove);
    if (window._muteKeyHandler) {
        window.removeEventListener('keydown', window._muteKeyHandler);
        window._muteKeyHandler = null;
    }
    const ov = document.getElementById('hud-atalhos-overlay');
    if (ov) ov.remove();
    if (hudEl) { hudEl.remove(); hudEl = null; }
}

// ── DIÁLOGOS ──────────────────────────────────────────────────────────────────
// DIALOGOS_ONDA e mostrarDialogoOnda definidos mais abaixo junto às naves aliadas

function mostrarDialogo(img, nome, txt, duracao) {
    duracao = duracao || 3000;
    const box     = document.getElementById('hud-dialogo');
    const faceImg = document.getElementById('dialogo-face-img');
    const nomeEl  = document.getElementById('dialogo-nome');
    const txtEl   = document.getElementById('dialogo-txt');
    if (!box) return;
    if (dialogoIntervalo) { clearInterval(dialogoIntervalo); dialogoIntervalo = null; }
    if (dialogoTimeout)   { clearTimeout(dialogoTimeout);   dialogoTimeout   = null; }
    faceImg.src = img; faceImg.alt = nome;
    nomeEl.textContent = nome;
    txtEl.textContent  = '';
    box.style.display  = 'flex';
    tocarDialogo();
    let i = 0;
    dialogoIntervalo = setInterval(() => {
        if (i < txt.length) txtEl.textContent += txt[i++];
        else { clearInterval(dialogoIntervalo); dialogoIntervalo = null; }
    }, 30);
    dialogoTimeout = setTimeout(() => { box.style.display = 'none'; dialogoTimeout = null; }, duracao);
}

// ── DIFICULDADE ───────────────────────────────────────────────────────────────
export let dificuldade = 'facil';
export let personagemEscolhido = 'brayan'; // 'brayan' | 'nala' | 'alice'

// ── CONFIGURAÇÃO DOS PERSONAGENS ──────────────────────────────────────────────
const CFG_PERSONAGENS = {
    brayan: {
        nome:         'BRAYAN',
        img:          () => IMG_BRAYAN,
        corNave:      0x2266FF,
        corLaser:     0xff3300,       // vermelho — laser padrão
        corUpgrade:   0xffcc00,       // dourado — twin laser
        corHyper:     0xff00ff,       // roxo — hyper beam
        // Nave: cone 4 lados (original)
        criarCorpo: (grupo) => {
            const matC = new THREE.MeshLambertMaterial({ color: 0xDDDDDD });
            const matA = new THREE.MeshLambertMaterial({ color: 0x2266FF });
            const matK = new THREE.MeshPhongMaterial({ color: 0x00ffff, opacity: 0.7, transparent: true });
            const corpo = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.0, 4), matC);
            corpo.rotation.x = Math.PI / 2; grupo.add(corpo);
            const asaGeo = new THREE.BoxGeometry(0.9, 0.04, 0.35);
            const asaE = new THREE.Mesh(asaGeo, matA); asaE.position.set(-0.5,0,0.15); asaE.rotation.y=0.2; grupo.add(asaE);
            const asaD = new THREE.Mesh(asaGeo, matA); asaD.position.set(0.5,0,0.15);  asaD.rotation.y=-0.2; grupo.add(asaD);
            const ck = new THREE.Mesh(new THREE.SphereGeometry(0.11,8,8), matK);
            ck.position.set(0,0.08,-0.05); ck.scale.set(1,1,2); grupo.add(ck);
            const luzB = new THREE.PointLight(0x00ffff,2,3); luzB.position.set(0,0,0.8); grupo.add(luzB);
        },
        aliados:      ['nala','alice'],
        falaOnda7:    'Onda 7! Nala, Alice — precisamos de vocês agora!',
        falaVitoria:  'Conseguimos. Não acredito. Conseguimos de verdade.',
        falaDerrota:  '"Reagrupamos. Não é o fim — é só o começo."',
        dialogosFinal: [
            { p:'brayan', txt:'Conseguimos. Não acredito. Conseguimos de verdade.' },
            { p:'nala',   txt:'Claro que conseguimos. Sabia desde o início. Esse time é diferente.' },
            { p:'alice',  txt:'Sabe o que me fez continuar? Saber que vocês estavam aqui. Sempre.' },
            { p:'brayan', txt:'A gente se ajuda na vida, na carreira, em tudo. Isso vale mais que qualquer vitória.' },
            { p:'nala',   txt:'Crescemos juntos. Erramos juntos. Quando um cai, os outros dois levantam.' },
            { p:'alice',  txt:'Não é o cargo, não é o salário. É quem está do seu lado quando importa.' },
            { p:'brayan', txt:'Por mais missões juntos. Na tela e na vida real.', ultimo: true },
        ],
    },
    nala: {
        nome:         'NALA STARWING',
        img:          () => IMG_NALA,
        corNave:      0x4488ff,
        corLaser:     0x00ccff,       // ciano
        corUpgrade:   0x00ffff,
        corHyper:     0x0044ff,       // azul profundo
        criarCorpo: (grupo) => {
            const matC = new THREE.MeshLambertMaterial({ color: 0x4488ff });
            const matD = new THREE.MeshLambertMaterial({ color: 0xaaddff });
            const corpo = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.9, 4), matC);
            corpo.rotation.x = Math.PI/2; grupo.add(corpo);
            const asaGeo = new THREE.BoxGeometry(1.1, 0.03, 0.28);
            const asaE = new THREE.Mesh(asaGeo, matD); asaE.position.set(-0.5,0,0.1); asaE.rotation.y=0.15; grupo.add(asaE);
            const asaD = new THREE.Mesh(asaGeo, matD); asaD.position.set(0.5,0,0.1);  asaD.rotation.y=-0.15; grupo.add(asaD);
            const asaP = new THREE.BoxGeometry(0.5,0.03,0.2);
            const apE = new THREE.Mesh(asaP,matC); apE.position.set(-0.2,0,0.35); grupo.add(apE);
            const apD = new THREE.Mesh(asaP,matC); apD.position.set(0.2,0,0.35);  grupo.add(apD);
            const luzN = new THREE.PointLight(0x00ccff,2,3); luzN.position.set(0,0,0.8); grupo.add(luzN);
        },
        aliados:      ['brayan','alice'],
        falaOnda7:    'Aqui Nala! Brayan, Alice — formação de intercepção!',
        falaVitoria:  'Missão cumprida. Isso é o que acontece quando confiamos uns nos outros.',
        falaDerrota:  '"Não foi dessa vez. Mas voltamos mais fortes."',
        dialogosFinal: [
            { p:'nala',   txt:'Missão cumprida. Isso é o que acontece quando confiamos uns nos outros.' },
            { p:'brayan', txt:'Você me salvou lá atrás, Nala. Sem você eu não estaria aqui.' },
            { p:'alice',  txt:'Esse é o segredo. A gente não vence sozinho. Nunca.' },
            { p:'nala',   txt:'Crescemos juntos em tudo — no trabalho, na vida. É isso que nos torna fortes.' },
            { p:'brayan', txt:'Por mais missões. Por mais conquistas juntos.' },
            { p:'alice',  txt:'Para sempre na história. Os três.', ultimo: true },
        ],
    },
    alice: {
        nome:         'ALICE VIXEN',
        img:          () => IMG_ALICE,
        corNave:      0xff44aa,
        corLaser:     0xff00ff,       // magenta
        corUpgrade:   0xff88ff,
        corHyper:     0xcc00ff,       // violeta
        criarCorpo: (grupo) => {
            const matC = new THREE.MeshLambertMaterial({ color: 0xff44aa });
            const matA = new THREE.MeshLambertMaterial({ color: 0xffaadd });
            const corpo = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 6), matC);
            corpo.rotation.x = Math.PI/2; grupo.add(corpo);
            const asaGeo = new THREE.BoxGeometry(0.8,0.03,0.45);
            const asaE = new THREE.Mesh(asaGeo,matA); asaE.position.set(-0.35,0,0.2); asaE.rotation.y=0.35; grupo.add(asaE);
            const asaD = new THREE.Mesh(asaGeo,matA); asaD.position.set(0.35,0,0.2);  asaD.rotation.y=-0.35; grupo.add(asaD);
            const nac = new THREE.CylinderGeometry(0.06,0.06,0.5,6);
            const nE = new THREE.Mesh(nac,matC); nE.position.set(-0.5,0,0.3); nE.rotation.x=Math.PI/2; grupo.add(nE);
            const nD = new THREE.Mesh(nac,matC); nD.position.set(0.5,0,0.3);  nD.rotation.x=Math.PI/2; grupo.add(nD);
            const luzA = new THREE.PointLight(0xff00ff,2,3); luzA.position.set(0,0,0.8); grupo.add(luzA);
        },
        aliados:      ['brayan','nala'],
        falaOnda7:    'Alice Vixen chegando! Brayan, Nala — cobrindo vocês!',
        falaVitoria:  'Conseguimos porque nunca desistimos uns dos outros.',
        falaDerrota:  '"Juntos erramos, juntos aprendemos. É assim que crescemos."',
        dialogosFinal: [
            { p:'alice',  txt:'Conseguimos porque nunca desistimos uns dos outros.' },
            { p:'nala',   txt:'Você nos manteve de pé, Alice. Sua coragem é o que nos move.' },
            { p:'brayan', txt:'Esse é o nosso segredo — quando um vacila, os outros seguram.' },
            { p:'alice',  txt:'Na carreira, na vida, em tudo. A gente se completa.' },
            { p:'nala',   txt:'Para mais missões. Para mais histórias como essa.' },
            { p:'brayan', txt:'Juntos, sempre.', ultimo: true },
        ],
    },
}; // 'facil' | 'medio' | 'dificil'

const DIFI = {
    facil:   { velBase: 0.06, velVar: 0.04, velEsc: 0.09, perseguir: 0.35, escMin: 0.20, escVar: 0.50, danoNave: 10, danoPC: 6,  danoPass: 4,  imort: 80, qtdBase: 3, qtdEsc: 1, qtdMax: 14, qtdBaseAlta: 6,  qtdEscAlta: 2, qtdMaxAlta: 22 },
    medio:   { velBase: 0.08, velVar: 0.05, velEsc: 0.11, perseguir: 0.50, escMin: 0.25, escVar: 0.65, danoNave: 16, danoPC: 10, danoPass: 7,  imort: 60, qtdBase: 4, qtdEsc: 2, qtdMax: 18, qtdBaseAlta: 8,  qtdEscAlta: 3, qtdMaxAlta: 28 },
    dificil: { velBase: 0.10, velVar: 0.07, velEsc: 0.14, perseguir: 0.65, escMin: 0.30, escVar: 0.70, danoNave: 22, danoPC: 14, danoPass: 10, imort: 45, qtdBase: 5, qtdEsc: 2, qtdMax: 24, qtdBaseAlta: 10, qtdEscAlta: 4, qtdMaxAlta: 35 },
};

// ── SELEÇÃO DE PERSONAGEM ─────────────────────────────────────────────────────
export function mostrarSelecaoPersonagem(onProximo) {
    const el = document.createElement('div');
    el.id = 'sel-personagem';

    const cards = Object.entries(CFG_PERSONAGENS).map(([key, p]) => `
        <div class="sel-card ${key === 'brayan' ? 'act' : ''}" data-p="${key}">
            <img class="sel-face" src="${p.img()}" alt="${p.nome}">
            <div class="sel-info">
                <div class="sel-nome">${p.nome}</div>
                <div class="sel-laser" style="color:#${p.corLaser.toString(16).padStart(6,'0')}">
                    ● Laser ${key === 'brayan' ? 'Vermelho' : key === 'nala' ? 'Ciano' : 'Magenta'}
                </div>
                <div class="sel-desc">${
                    key === 'brayan' ? 'Piloto principal. Laser equilibrado e preciso.' :
                    key === 'nala'   ? 'Interceptadora. Laser veloz de longo alcance.' :
                                      'Suporte ofensivo. Laser amplo de alta energia.'
                }</div>
            </div>
        </div>
    `).join('');

    el.innerHTML = `
        <div class="sel-box">
            <div class="sel-titulo">★ ESCOLHA SEU PILOTO ★</div>
            <div class="sel-subtitulo">Cada piloto tem uma nave, laser e história únicos</div>
            <div class="sel-cards">${cards}</div>
            <div class="sel-preview">
                <div class="sel-aliados-label">ALIADOS NESSA MISSÃO:</div>
                <div id="sel-aliados"></div>
            </div>
            <button id="sel-confirmar">▶ CONFIRMAR PILOTO</button>
        </div>
    `;
    document.body.appendChild(el);

    function atualizarPreview(key) {
        const p = CFG_PERSONAGENS[key];
        const div = document.getElementById('sel-aliados');
        if (!div) return;
        div.innerHTML = p.aliados.map(a => {
            const al = CFG_PERSONAGENS[a];
            return `<div class="sel-aliado">
                <img src="${al.img()}" alt="${al.nome}">
                <span>${al.nome}</span>
            </div>`;
        }).join('');
    }
    atualizarPreview('brayan');

    el.querySelectorAll('.sel-card').forEach(card => {
        card.addEventListener('click', () => {
            el.querySelectorAll('.sel-card').forEach(c => c.classList.remove('act'));
            card.classList.add('act');
            personagemEscolhido = card.dataset.p;
            atualizarPreview(personagemEscolhido);
        });
    });

    document.getElementById('sel-confirmar').addEventListener('click', () => {
        el.remove();
        onProximo();
    });
}

// ── TELA DE INSTRUÇÕES com seleção de dificuldade ────────────────────────────
export function mostrarTelaInstrucoes(onStart) {
    const P = CFG_PERSONAGENS[personagemEscolhido];
    const el = document.createElement('div');
    el.id = 'game-instrucoes';
    el.innerHTML = `
        <div class="gi-box">
            <div class="gi-header">
                <div class="gi-logo">★ FOX 64 ★</div>
                <div class="gi-sub-logo">SISTEMA DE DEFESA ATIVO</div>
            </div>
            <div class="gi-dialogo-box">
                <img class="gi-face" src="${P.img()}" alt="${P.nome}">
                <div>
                    <div class="gi-nome-char">${P.nome}</div>
                    <div class="gi-fala">"${
                        personagemEscolhido === 'brayan' ? 'Alice e Nala em standby. Escolha a dificuldade!' :
                        personagemEscolhido === 'nala'   ? 'Sistemas calibrados. Brayan e Alice prontos!' :
                                                           'Upgrades carregados. Brayan e Nala esperando!'
                    }"</div>
                </div>
            </div>
            <div class="gi-regras">
                <div class="gi-regra"><span class="gi-icone">🖱️</span><span><b>MOUSE</b> — Mire livremente</span></div>
                <div class="gi-regra"><span class="gi-icone">🔫</span><span><b>CLIQUE</b> — Dispara laser</span></div>
                <div class="gi-regra"><span class="gi-icone">🎮</span><span><b>WASD</b> — Move a nave</span></div>
                <div class="gi-regra"><span class="gi-icone">💊</span><span>Acerte <b>itens</b> com laser para coletar</span></div>
                <div class="gi-regra"><span class="gi-icone">⚡</span><span>Aliados chegam na onda 7!</span></div>
            </div>
            <div class="gi-difi-titulo">DIFICULDADE</div>
            <div class="gi-difi-btns">
                <button class="gi-difi act" data-d="facil">
                    <span class="gi-difi-icon">🟢</span><span class="gi-difi-nome">FÁCIL</span>
                    <span class="gi-difi-desc">Meteoros lentos · Menos dano</span>
                </button>
                <button class="gi-difi" data-d="medio">
                    <span class="gi-difi-icon">🟡</span><span class="gi-difi-nome">MÉDIO</span>
                    <span class="gi-difi-desc">Equilibrado · Desafiador</span>
                </button>
                <button class="gi-difi" data-d="dificil">
                    <span class="gi-difi-icon">🔴</span><span class="gi-difi-nome">DIFÍCIL</span>
                    <span class="gi-difi-desc">Meteoros rápidos · Alto dano</span>
                </button>
            </div>
            <button id="gi-start">DO A BARREL ROLL!</button>
        </div>
    `;
    document.body.appendChild(el);
    el.querySelectorAll('.gi-difi').forEach(btn => {
        btn.addEventListener('click', () => {
            el.querySelectorAll('.gi-difi').forEach(b => b.classList.remove('act'));
            btn.classList.add('act');
            dificuldade = btn.dataset.d;
        });
    });
    document.getElementById('gi-start').addEventListener('click', () => { el.remove(); onStart(); });
}


// ── GAME OVER ─────────────────────────────────────────────────────────────────
function mostrarGameOver(pts, onVoltar) {
    let ranking = [];
    try { ranking = JSON.parse(localStorage.getItem('fox64_ranking') || '[]'); } catch(e) {}
    const ganhou = vidaNave > 0 && vidaPC > 0;
    const P = CFG_PERSONAGENS[personagemEscolhido];
    const S = aliadoSuporte();
    const el = document.createElement('div');
    el.id = 'game-over';
    el.innerHTML = `
        <div class="go-box">
            <div class="go-dialogo">
                <img class="go-face" src="${ganhou ? P.img() : S.img()}" alt="">
                <div class="go-fala">${ganhou
                    ? `"${P.falaVitoria}"`
                    : `"${P.falaDerrota}"`
                }</div>
            </div>
            <div class="go-title">${ganhou ? '★ MISSÃO CUMPRIDA ★' : '✕ SISTEMA ABATIDO ✕'}</div>
            <div class="go-pts">SCORE FINAL: <b>${pts}</b></div>
            <div class="go-input">
                <label>SUAS INICIAIS (3 letras):</label>
                <div class="go-input-row">
                    <input id="go-iniciais" maxlength="3" placeholder="AAA" autocomplete="off" spellcheck="false"/>
                    <button id="go-salvar">▶ SALVAR</button>
                </div>
            </div>
            <div class="go-ranking">
                <div class="go-rank-title">◆ HALL DA FAMA ◆</div>
                <div id="go-lista"></div>
            </div>
            <button id="go-voltar">◀ VOLTAR AO PORTFÓLIO</button>
        </div>
    `;
    document.body.appendChild(el);
    const input = document.getElementById('go-iniciais');
    input.focus();
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    function renderRanking(list) {
        const div = document.getElementById('go-lista'); if (!div) return;
        const sorted = [...list].sort((a,b)=>b.pts-a.pts).slice(0,10);
        div.innerHTML = sorted.length
            ? sorted.map((e,i)=>`<div class="go-rank-row"><span class="go-rank-pos">#${i+1}</span><span class="go-rank-ini">${e.ini}</span><span class="go-rank-pts">${e.pts}</span></div>`).join('')
            : '<div class="go-rank-empty">SEM REGISTROS</div>';
    }
    renderRanking(ranking);
    document.getElementById('go-salvar').addEventListener('click', () => {
        const raw = input.value.trim(); if (!raw) { input.focus(); return; }
        const ini = raw.padEnd(3,'?').slice(0,3);
        ranking.push({ ini, pts });
        try { localStorage.setItem('fox64_ranking', JSON.stringify(ranking)); } catch(e) {}
        renderRanking(ranking);
        document.querySelector('.go-input').innerHTML = `<div style="color:#FFD700;text-align:center;padding:.5em">★ ${ini} — ${pts} pts registrado!</div>`;
    });
    document.getElementById('go-voltar').addEventListener('click', () => { el.remove(); if (onVoltar) onVoltar(); });
}

// ── CONTROLES ─────────────────────────────────────────────────────────────────
const TECLAS_JOGO = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ']);
export function configurarControlesJogo() {
    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if (jogando && TECLAS_JOGO.has(k)) { e.preventDefault(); e.stopPropagation(); }
        if (k==='w'||k==='arrowup')    teclas.w=true;
        if (k==='a'||k==='arrowleft')  teclas.a=true;
        if (k==='s'||k==='arrowdown')  teclas.s=true;
        if (k==='d'||k==='arrowright') teclas.d=true;
    }, { capture: true });
    window.addEventListener('keyup', e => {
        const k = e.key.toLowerCase();
        if (jogando && TECLAS_JOGO.has(k)) { e.preventDefault(); e.stopPropagation(); }
        if (k==='w'||k==='arrowup')    teclas.w=false;
        if (k==='a'||k==='arrowleft')  teclas.a=false;
        if (k==='s'||k==='arrowdown')  teclas.s=false;
        if (k==='d'||k==='arrowright') teclas.d=false;
    }, { capture: true });
}

// ── NAVE JOGADOR ──────────────────────────────────────────────────────────────
export function criarNaveJogador(scene) {
    naveJogador = new THREE.Group();
    const P = CFG_PERSONAGENS[personagemEscolhido] || CFG_PERSONAGENS.brayan;
    P.criarCorpo(naveJogador);
    naveJogador.visible = false;
    scene.add(naveJogador);
}

// ── ITENS DA ALICE (voam até o jogador, coletáveis por tiro OU encosto) ───────
const CFG_ITEM = {
    cura:    { cor: 0x00ff88, hex: '#00ff88', label: '💊 +30 SHIELD',  geo: new THREE.OctahedronGeometry(0.38, 0) },
    upgrade: { cor: 0xffcc00, hex: '#ffcc00', label: '⚡ TWIN LASER',  geo: new THREE.OctahedronGeometry(0.38, 0) },
    hyper:   { cor: 0xff00ff, hex: '#ff00ff', label: '☄️ HYPER BEAM', geo: new THREE.OctahedronGeometry(0.52, 0) },
};

function mostrarNotificacao(msg, corHex) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:34%;left:50%;transform:translate(-50%,-50%);color:${corHex};font-family:'Courier New',monospace;font-size:1.1em;font-weight:bold;letter-spacing:3px;pointer-events:none;text-shadow:0 0 16px ${corHex};z-index:500;animation:fadeUpWave 1.6s ease-out forwards;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
}

// ── HELPERS DINÂMICOS DE PERSONAGEM ──────────────────────────────────────────
// Retorna o aliado que dá suporte/itens (primeiro aliado da lista)
function getAliado(idx) {
    const P = CFG_PERSONAGENS[personagemEscolhido];
    const chave = P.aliados[idx] || P.aliados[0];
    return CFG_PERSONAGENS[chave];
}
// Atalhos
function aliadoSuporte()  { return getAliado(0); } // dá itens, onda 3/5
function aliadoRadar()    { return getAliado(1); } // comenta radar, ondas pares
function aliadoPrincipal(){ return CFG_PERSONAGENS[personagemEscolhido]; }

function aplicarEfeitoItem(tipo) {
    const S = aliadoSuporte();
    if (tipo === 'cura') {
        vidaNave = Math.min(100, vidaNave + 30);
        atualizarHUD();
        mostrarDialogo(S.img(), S.nome, 'Shield restaurado! Bom trabalho, piloto!', 2500);
        mostrarNotificacao('💊 +30 SHIELD', '#00ff88');
    } else if (tipo === 'upgrade') {
        tiroUpgrade = true; tiroUpgradeTimer = 900;
        atualizarHUD();
        tocarUpgrade();
        mostrarDialogo(S.img(), S.nome, 'Twin Laser ativado! Boa caçada!', 2500);
        mostrarNotificacao('⚡ TWIN LASER ON', '#ffcc00');
    } else if (tipo === 'hyper') {
        tiroHyper = true; tiroHyperTimer = 480; tiroUpgrade = false;
        atualizarHUD();
        tocarUpgrade();
        mostrarDialogo(S.img(), S.nome, 'HYPER BEAM ATIVADO! Destrua tudo em 8 segundos!', 3000);
        mostrarNotificacao('☄️ HYPER BEAM ON!', '#ff00ff');
        const fl = document.createElement('div');
        fl.style.cssText = 'position:fixed;inset:0;z-index:499;pointer-events:none;background:rgba(180,0,255,0.18);animation:flashRed .6s ease-out forwards;';
        document.body.appendChild(fl); setTimeout(() => fl.remove(), 700);
    }
}

function spawnItem(scene, tipo) {
    const cfg = CFG_ITEM[tipo];
    const mat = new THREE.MeshBasicMaterial({ color: cfg.cor, transparent: true, opacity: 0.92 });
    const mesh = new THREE.Mesh(cfg.geo, mat);

    // Nasce bem longe, à frente da nave
    const nx = naveJogador ? naveJogador.position.x : 0;
    const ny = naveJogador ? naveJogador.position.y : 2;
    const nz = naveJogador ? naveJogador.position.z : 0;
    mesh.position.set(
        nx + (Math.random() - 0.5) * 12,
        ny + (Math.random() - 0.5) * 4,
        nz - 25
    );

    // Luz pulsante
    const luz = new THREE.PointLight(cfg.cor, 5, 6);
    mesh.add(luz);

    // Anel externo para destacar o item
    const anel = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.05, 8, 24),
        new THREE.MeshBasicMaterial({ color: cfg.cor, transparent: true, opacity: 0.6 })
    );
    mesh.add(anel);

    mesh.userData = {
        tipo,
        vida: 700,       // frames até expirar (~11s)
        voando: true,    // voa em direção à nave
        velPropria: new THREE.Vector3(), // calculada por frame
    };

    scene.add(mesh);
    itens.push(mesh);

    // Notificação de spawn — vem do aliado de suporte
    const S = aliadoSuporte();
    mostrarNotificacao(`${S.nome.split(' ')[0]}: ${cfg.label}`, cfg.hex);
    mostrarDialogo(S.img(), S.nome,
        tipo === 'upgrade'
            ? 'Item de upgrade em rota — acerte com o laser ou encoste!'
            : tipo === 'hyper'
            ? 'HYPER BEAM em rota — acerte o item roxo!'
            : 'Item de cura a caminho — acerte com o laser ou encoste!',
        3000
    );
}

function atualizarItens(scene) {
    if (!naveJogador || !jogando) return;

    for (let i = itens.length - 1; i >= 0; i--) {
        const item = itens[i];
        const ud   = item.userData;

        // Rotação constante
        item.rotation.y += 0.06;
        item.rotation.x += 0.03;
        // Anel interno gira no eixo oposto
        if (item.children[1]) item.children[1].rotation.z += 0.05;

        // Voa suavemente em direção à nave
        if (ud.voando && naveJogador) {
            const dir = naveJogador.position.clone().sub(item.position);
            const dist = dir.length();
            // Acelera conforme chega perto
            const velocidade = Math.min(0.08 + (1 / (dist + 0.5)) * 0.3, 0.25);
            ud.velPropria.lerp(dir.normalize().multiplyScalar(velocidade), 0.04);
            item.position.add(ud.velPropria);
        }

        ud.vida--;

        // Pisca quando está para expirar
        if (ud.vida < 150) item.visible = Math.floor(ud.vida / 10) % 2 === 0;

        // Expirou
        if (ud.vida <= 0) { scene.remove(item); itens.splice(i, 1); continue; }

        // Coletado por encosto
        if (naveJogador.position.distanceTo(item.position) < 1.1) {
            criarExplosao(scene, item.position.clone(), item.material.color.getHex(), 0.3);
            scene.remove(item); itens.splice(i, 1);
            tocarItem();
            aplicarEfeitoItem(ud.tipo);
            continue;
        }

        // Coletado por tiro (verificado no loop de lasers — veja atualizarJogo)
    }

    // Decrementa timers de upgrade
    if (tiroHyper && tiroHyperTimer > 0) {
        tiroHyperTimer--;
        if (tiroHyperTimer <= 0) {
            tiroHyper = false; atualizarHUD();
            mostrarNotificacao('☄️ HYPER BEAM EXPIRADO', '#888888');
        }
    }
    if (tiroUpgrade && tiroUpgradeTimer > 0) {
        tiroUpgradeTimer--;
        if (tiroUpgradeTimer <= 0) {
            tiroUpgrade = false; atualizarHUD();
            mostrarNotificacao('⚡ TWIN LASER EXPIRADO', '#888888');
        }
    }
}

// ── METEOROS ──────────────────────────────────────────────────────────────────
const geoMet = new THREE.DodecahedronGeometry(1, 0);

function spawnMeteoro(scene) {
    const D = DIFI[dificuldade];
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(
        0.4+Math.random()*0.3, 0.25+Math.random()*0.1, 0.1+Math.random()*0.1
    )});
    const mesh = new THREE.Mesh(geoMet, mat);
    const escala = D.escMin + Math.random() * D.escVar;
    mesh.scale.setScalar(escala);
    mesh.position.set((Math.random()-0.5)*18, 0.5+Math.random()*7, -55-Math.random()*35);
    const mirarNave = Math.random() > (1 - D.perseguir) && naveJogador;
    const alvo = mirarNave
        ? naveJogador.position.clone().add(new THREE.Vector3((Math.random()-0.5),(Math.random()-0.5),0))
        : new THREE.Vector3((Math.random()-0.5)*1.5, 0.8+Math.random()*1.5, 0);
    const spd = (D.velBase + Math.random()*D.velVar) * (1 + (ondaAtual-1) * D.velEsc);
    const dir = alvo.clone().sub(mesh.position).normalize();
    mesh.userData = { vel: dir.clone().multiplyScalar(spd), rotVel: (Math.random()-0.5)*0.04, escala, perseguir: mirarNave };
    scene.add(mesh); meteoros.push(mesh);
}

// ── LASER ─────────────────────────────────────────────────────────────────────
const geoLaserNormal = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4);
const geoLaserHyper  = new THREE.CylinderGeometry(0.28, 0.28, 2.5, 6);

// Cache de materiais por cor — evita criar new MeshBasicMaterial a cada tiro
const _matLaserCache = {};
function _getMatLaser(cor) {
    if (!_matLaserCache[cor]) _matLaserCache[cor] = new THREE.MeshBasicMaterial({ color: cor });
    return _matLaserCache[cor];
}

// Raycaster reutilizado — evita new a cada disparo
const _ray = new THREE.Raycaster();

// Hyper beam contínuo — removido, agora é projétil como o normal
let hyperBeamMesh  = null;  // mantido para cleanup mas não usado
let hyperBeamAtivo = false;
function criarHyperBeamMesh() {}   // no-op
function atualizarHyperBeam()  {}  // no-op
function checarHyperBeamColisoes() {} // no-op

function dispararRaio(scene, offsetX, ehHyper) {
    if (!naveJogador || !cameraRef) return;
    const P   = CFG_PERSONAGENS[personagemEscolhido] || CFG_PERSONAGENS.brayan;
    const cor = ehHyper ? P.corHyper : tiroUpgrade ? P.corUpgrade : P.corLaser;
    const geo = ehHyper ? geoLaserHyper : geoLaserNormal;
    // Reutiliza material cacheado — evita alocação a cada tiro
    const laser = new THREE.Mesh(geo, _getMatLaser(cor));
    laser.position.copy(naveJogador.position);
    if (offsetX) laser.position.x += offsetX;
    // Reutiliza o mesmo Raycaster
    _ray.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef);
    const dir = _ray.ray.direction.clone().normalize();
    const spd = ehHyper ? 3.5 : 1.8;
    laser.userData = { vel: dir.clone().multiplyScalar(spd), hitbox: ehHyper ? 1.4 : tiroUpgrade ? 0.55 : 0.45 };
    laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    // Sem PointLight por laser — muito custoso com múltiplos tiros simultâneos
    scene.add(laser);
    lasers.push(laser);
}

function atirarLaser(scene) {
    if (!jogando) return;

    if (tiroHyper) {
        dispararRaio(scene, 0, true);
        tocarTiroHyper();
    } else {
        dispararRaio(scene, 0, false);
        if (tiroUpgrade) {
            dispararRaio(scene,  0.28, false);
            dispararRaio(scene, -0.28, false);
            tocarTiroUpgrade();
        } else {
            tocarTiro();
        }
    }
}

// ── INICIAR JOGO ──────────────────────────────────────────────────────────────
export function iniciarJogo(scene, camera, onOver) {
    sceneRef=scene; cameraRef=camera; onGameOver=onOver;
    jogando=true; vidaPC=100; vidaNave=100; pontos=0; ondaAtual=1;
    imortalidade=0; tiroUpgrade=false; tiroUpgradeTimer=0;
    tiroHyper=false; tiroHyperTimer=0;
    cutscenePausa=false;
    naveAliada = [];
    lasers.forEach(l=>scene.remove(l));   lasers=[];
    meteoros.forEach(m=>scene.remove(m)); meteoros=[];
    itens.forEach(it=>scene.remove(it));  itens=[];
    criarHUD(); atualizarHUD();
    document.body.classList.add('modo-jogo');
    iniciarMusica();
    criarHyperBeamMesh(scene);
    if (naveJogador) { naveJogador.visible=true; naveJogador.position.set(0,2,5); }
    for (let i=0; i<5; i++) spawnMeteoro(scene);
    setTimeout(() => mostrarDialogoOnda(1), 800);
    window._laserHandler = (e) => { if (e.button===0) { e.preventDefault(); e.stopPropagation(); atirarLaser(scene); } };
    window.addEventListener('mousedown', window._laserHandler, { capture: true });
    window._ctxHandler    = (e) => e.preventDefault();
    window._selectHandler = (e) => e.preventDefault();
    window.addEventListener('contextmenu', window._ctxHandler,   { capture: true });
    window.addEventListener('selectstart', window._selectHandler, { capture: true });
}

export function pararJogo(manterAliadas = false) {
    jogando = false;
    pararMusica();
    document.body.classList.remove('modo-jogo');

    if (naveJogador) naveJogador.visible = false;
    removerHUD();

    if (dialogoIntervalo) { clearInterval(dialogoIntervalo); dialogoIntervalo = null; }
    if (dialogoTimeout)   { clearTimeout(dialogoTimeout);   dialogoTimeout   = null; }

    if (hyperBeamMesh) {
        sceneRef && sceneRef.remove(hyperBeamMesh);
        hyperBeamMesh = null;
        hyperBeamAtivo = false;
    }

    if (sceneRef) {
        lasers.forEach(l => sceneRef.remove(l));
        meteoros.forEach(m => sceneRef.remove(m));
        itens.forEach(it => sceneRef.remove(it));
    }

    if (sceneRef && !manterAliadas) {
        removerNavesAliadas(sceneRef);
    }

    lasers = [];
    meteoros = [];
    itens = [];

    if (window._laserHandler)  {
        window.removeEventListener('mousedown', window._laserHandler, { capture: true });
        window._laserHandler = null;
    }
    if (window._ctxHandler) {
        window.removeEventListener('contextmenu', window._ctxHandler, { capture: true });
        window._ctxHandler = null;
    }
    if (window._selectHandler) {
        window.removeEventListener('selectstart', window._selectHandler, { capture: true });
        window._selectHandler = null;
    }
}

// ── ATUALIZAR JOGADOR ─────────────────────────────────────────────────────────
export function atualizarJogador() {
    if (!jogando || !naveJogador) return;
    if (imortalidade > 0) imortalidade--;
    const vel = 0.12;
    if (teclas.w && naveJogador.position.y <  6)  naveJogador.position.y += vel;
    if (teclas.s && naveJogador.position.y > 0.2) naveJogador.position.y -= vel;
    if (teclas.a && naveJogador.position.x > -9)  naveJogador.position.x -= vel;
    if (teclas.d && naveJogador.position.x <  9)  naveJogador.position.x += vel;
    naveJogador.rotation.z = THREE.MathUtils.lerp(naveJogador.rotation.z, teclas.a?0.45:teclas.d?-0.45:0, 0.12);
    naveJogador.rotation.x = THREE.MathUtils.lerp(naveJogador.rotation.x, teclas.w?-0.2:teclas.s?0.2:0,   0.12);
    if (cameraRef) {
        naveJogador.position.x += (mouseX*3    - naveJogador.position.x) * 0.02;
        naveJogador.position.y += (mouseY*1.5+2 - naveJogador.position.y) * 0.02;
    }
}

// ── LOOP DO JOGO ──────────────────────────────────────────────────────────────
export function atualizarJogo(scene) {
    if (!jogando) return;

    atualizarItens(scene);
    atualizarExplosoes();
    atualizarHyperBeam();
    checarHyperBeamColisoes(scene);
    atualizarNavesAliadas(scene);

    // Move lasers + colisão precisa por segmento
    for (let i = lasers.length - 1; i >= 0; i--) {
        const l    = lasers[i];
        const prev = l.position.clone();          // posição anterior
        l.position.add(l.userData.vel);           // move
        const hitbox = l.userData.hitbox || 0.5;

        // Saiu dos limites
        if (l.position.z < -130 || l.position.z > 20 ||
            Math.abs(l.position.x) > 60 || Math.abs(l.position.y) > 60) {
            scene.remove(l); lasers.splice(i, 1); continue;
        }

        let removeu = false;

        // Colisão com itens (ponto simples — itens são grandes e lentos)
        for (let k = itens.length - 1; k >= 0; k--) {
            if (l.position.distanceTo(itens[k].position) < 1.0) {
                const tipo = itens[k].userData.tipo;
                criarExplosao(scene, itens[k].position.clone(), itens[k].material.color.getHex(), 0.3);
                scene.remove(itens[k]); itens.splice(k, 1);
                scene.remove(l);       lasers.splice(i, 1);
                tocarItem();
                aplicarEfeitoItem(tipo);
                removeu = true; break;
            }
        }
        if (removeu) continue;

        // Colisão com meteoros — swept: verifica ao longo do segmento prev→atual
        const segDir = l.position.clone().sub(prev);
        const segLen = segDir.length();
        segDir.normalize();

        for (let j = meteoros.length - 1; j >= 0; j--) {
            const m  = meteoros[j];
            const ud = m.userData;
            const raioTotal = hitbox + ud.escala * 0.55;

            // Distância do meteoro ao segmento de deslocamento do laser
            const toM = m.position.clone().sub(prev);
            const t   = Math.max(0, Math.min(segLen, toM.dot(segDir)));
            const closest = prev.clone().add(segDir.clone().multiplyScalar(t));
            const dist = m.position.distanceTo(closest);

            if (dist < raioTotal) {
                const corExp = tiroHyper ? 0xff00ff : tiroUpgrade ? 0xffcc00 : 0xff8800;
                criarExplosao(scene, m.position.clone(), corExp, ud.escala);
                scene.remove(m);   meteoros.splice(j, 1);
                scene.remove(l);   lasers.splice(i, 1);
                pontos += Math.ceil((100 * ondaAtual) / (ud.escala + 0.1));
                atualizarHUD();
                removeu = true; break;
            }
        }
        if (removeu) continue;
    }

    const pcPos = new THREE.Vector3(0,1,0);

    for (let i=meteoros.length-1; i>=0; i--) {
        const m=meteoros[i]; const ud=m.userData;
        if (ud.perseguir && naveJogador) {
            const d=naveJogador.position.clone().sub(m.position).normalize();
            ud.vel.lerp(d.multiplyScalar(ud.vel.length()), 0.015);
        }
        m.position.add(ud.vel);
        m.rotation.x+=ud.rotVel; m.rotation.y+=ud.rotVel*0.7;

        // Bateu no PC?
        if (m.position.distanceTo(pcPos) < 1.2+ud.escala*0.5) {
            vidaPC -= DIFI[dificuldade].danoPC + ud.escala * DIFI[dificuldade].danoPC;
            criarExplosao(scene, m.position.clone(), 0xff4400, ud.escala);
            scene.remove(m); meteoros.splice(i,1);
            tocarDano();
            atualizarHUD(); flashDano('base');
            if (vidaPC<=0) { vidaPC=0; atualizarHUD(); encerrarJogo(scene); return; }
            continue;
        }

        // Bateu na nave?
        if (naveJogador && imortalidade===0 && m.position.distanceTo(naveJogador.position) < 0.6+ud.escala*0.5) {
            vidaNave -= DIFI[dificuldade].danoNave + ud.escala * 6; imortalidade = DIFI[dificuldade].imort;
            criarExplosao(scene, m.position.clone(), 0x0088ff, ud.escala);
            scene.remove(m); meteoros.splice(i,1);
            tocarDano();
            atualizarHUD(); flashDano('nave');
            if (vidaNave<=0) { vidaNave=0; atualizarHUD(); encerrarJogo(scene); return; }
            continue;
        }

        // Passou pela nave?
        if (naveJogador && m.position.z > naveJogador.position.z+1.5) {
            const dx=m.position.x-naveJogador.position.x, dy=m.position.y-naveJogador.position.y;
            if (Math.sqrt(dx*dx+dy*dy) < 3.5+ud.escala && imortalidade===0) {
                vidaNave -= DIFI[dificuldade].danoPass + ud.escala * 3; imortalidade=45;
                criarExplosao(scene, m.position.clone(), 0x4444ff, ud.escala * 0.5);
                tocarDano();
                atualizarHUD(); flashDano('nave');
                if (vidaNave<=0) { vidaNave=0; atualizarHUD(); scene.remove(m); meteoros.splice(i,1); encerrarJogo(scene); return; }
            }
            scene.remove(m); meteoros.splice(i,1); continue;
        }

        if (m.position.distanceTo(new THREE.Vector3(0,0,0)) > 120) { scene.remove(m); meteoros.splice(i,1); continue; }
    }

    // Nova onda
    if (meteoros.length===0 && jogando && !cutscenePausa) {

        // Onda 10 completa = vitória!
        if (ondaAtual >= 10) { venceuJogo(scene); return; }

        ondaAtual++;
        const D = DIFI[dificuldade];
        const qtd = ondaAtual >= 8
            ? Math.min(D.qtdBaseAlta + ondaAtual * D.qtdEscAlta, D.qtdMaxAlta)
            : Math.min(D.qtdBase    + ondaAtual * D.qtdEsc,      D.qtdMax);
        for (let i=0; i<qtd; i++) spawnMeteoro(scene);
        flashOnda(); atualizarHUD(); mostrarDialogoOnda(ondaAtual);

        // Itens por onda
        if (ondaAtual === 3) {
            setTimeout(() => { if (jogando) spawnItem(scene, 'hyper'); }, 1200);
            setTimeout(() => {
                const S = aliadoSuporte();
                mostrarDialogo(S.img(), S.nome, 'HYPER BEAM a caminho! Acerte o item especial!', 3500);
            }, 200);
        } else if (ondaAtual >= 5 && !tiroUpgrade && !tiroHyper) {
            setTimeout(() => { if (jogando) spawnItem(scene, 'upgrade'); }, 1500);
        } else if (ondaAtual >= 4) {
            setTimeout(() => { if (jogando) spawnItem(scene, 'cura'); }, 1500);
        }
        // Cura extra nas ondas duras
        if (ondaAtual >= 6) setTimeout(() => { if (jogando) spawnItem(scene, 'cura'); }, 5000);
        if (ondaAtual >= 8) setTimeout(() => { if (jogando) spawnItem(scene, 'cura'); }, 9000);

        // Onda 7: pausa para cutscene de entrada das aliadas, depois spawna meteoros
        if (ondaAtual === 7) {
            cutscenePausa = true;
            setTimeout(() => { if (jogando) ativarNavesAliadas(scene); }, 800);
            // Meteoros só aparecem depois dos diálogos de entrada (≈13s)
            setTimeout(() => {
                if (jogando) {
                    for (let i = 0; i < qtd; i++) spawnMeteoro(scene);
                    mostrarDialogo(aliadoPrincipal().img(), aliadoPrincipal().nome, 'Formação completa — atacar!', 2000);
                    cutscenePausa = false;
                }
            }, 13500);
            return; // não spawna agora
        }
    }
}

// ── EXPLOSÃO ──────────────────────────────────────────────────────────────────
// Geometria compartilhada — evita criar centenas de objetos por explosão
const _geoParticula = new THREE.SphereGeometry(0.1, 4, 4);
const _explosoes = []; // lista de explosões ativas — atualizadas no loop principal

function criarExplosao(scene, pos, cor, escala = 0.5) {
    tocarExplosao(escala);
    // Limita explosões simultâneas para não travar
    if (_explosoes.length > 12) {
        const antiga = _explosoes.shift();
        if (antiga.grupo.parent) scene.remove(antiga.grupo);
    }
    const grupo = new THREE.Group();
    grupo.position.copy(pos);
    const ps = [];
    const count = escala > 0.6 ? 10 : 7;
    for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 1 });
        const p = new THREE.Mesh(_geoParticula, mat);
        p.userData.vel = new THREE.Vector3(
            (Math.random()-0.5)*0.4,
            (Math.random()-0.5)*0.4,
            (Math.random()-0.5)*0.4
        );
        grupo.add(p);
        ps.push(p);
    }
    scene.add(grupo);
    _explosoes.push({ grupo, ps, frame: 0, scene });
}

// Chamado uma vez por frame dentro de atualizarJogo — sem rAF extra
function atualizarExplosoes() {
    for (let i = _explosoes.length - 1; i >= 0; i--) {
        const e = _explosoes[i];
        e.frame++;
        const opacidade = 1 - e.frame / 20;
        e.ps.forEach(p => {
            p.position.add(p.userData.vel);
            p.material.opacity = opacidade;
        });
        if (e.frame >= 20) {
            e.scene.remove(e.grupo);
            _explosoes.splice(i, 1);
        }
    }
}

// ── FLASH ─────────────────────────────────────────────────────────────────────
function flashDano(alvo) {
    const cor=alvo==='nave'?'rgba(0,100,255,0.28)':'rgba(255,0,0,0.28)';
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;inset:0;z-index:500;pointer-events:none;background:${cor};animation:flashRed .4s ease-out forwards;`;
    document.body.appendChild(el); setTimeout(()=>el.remove(),450);
}

function flashOnda() {
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;top:38%;left:50%;transform:translate(-50%,-50%);z-index:500;color:#FFD700;font-size:3em;font-weight:bold;font-family:'Courier New',monospace;text-shadow:0 0 24px #FFD700,0 0 48px #ff8800;pointer-events:none;animation:fadeUpWave 1.2s ease-out forwards;letter-spacing:4px;`;
    el.textContent=`◆ WAVE ${ondaAtual} ◆`;
    document.body.appendChild(el); setTimeout(()=>el.remove(),1300);
}

// ── NAVES ALIADAS (onda 7+) ───────────────────────────────────────────────────
let naveAliada = [];  // [{mesh, laser[], timer, alvo, falaTimer, cfg}]

const CFG_ALIADAS = [
    {
        nome:     'NALA STARWING',
        img:      IMG_NALA,
        corNave:  0x4488ff,   // azul
        corLaser: 0x00ccff,
        posX:     -2.5,
        fala: [
            'Cobrindo o flanco esquerdo!',
            'Deixa esse pra mim, Brayan!',
            'Radar limpo por aqui!',
            'Mais um destruído!',
        ],
    },
    {
        nome:     'ALICE VIXEN',
        img:      IMG_ALICE,
        corNave:  0xff44aa,   // rosa/magenta
        corLaser: 0xff00ff,
        posX:     2.5,
        fala: [
            'Flanco direito coberto!',
            'Sistema de mira online!',
            'Destruindo hostis!',
            'Segura que eu chego!',
        ],
    },
];

function criarNaveAliada(scene, chavePersonagem, posX) {
    const P   = CFG_PERSONAGENS[chavePersonagem];
    const grupo = new THREE.Group();
    P.criarCorpo(grupo);

    const luzMotor = new THREE.PointLight(P.corNave, 3, 3);
    luzMotor.position.set(0, 0, 0.6);
    grupo.add(luzMotor);

    grupo.position.set(posX, 2, 6);
    grupo.userData.nome = P.nome;
    scene.add(grupo);

    const cfg = {
        nome:     P.nome,
        img:      P.img(),
        corNave:  P.corNave,
        corLaser: P.corLaser,
        posX,
        fala:     P === CFG_PERSONAGENS.nala
            ? ['Cobrindo o flanco esquerdo!','Deixa esse pra mim!','Radar limpo!','Mais um destruído!']
            : P === CFG_PERSONAGENS.alice
            ? ['Flanco direito coberto!','Sistema de mira online!','Destruindo hostis!','Segura que eu chego!']
            : ['Vou abrir caminho!','Segurem posição!','Fogo concentrado!','Não deixem passar!'],
    };

    return {
        mesh: grupo, cfg, lasers: [],
        timerTiro: 40 + Math.random() * 40,
        falaTimer: 180 + Math.random() * 300,
        alvo: null, vivo: true,
        flutuacao: Math.random() * Math.PI * 2,
    };
}

const geoLaserAliado = new THREE.CylinderGeometry(0.035, 0.035, 1.4, 4);

function dispararLaserAliado(scene, aliada) {
    if (!aliada.alvo) return;
    const laser = new THREE.Mesh(geoLaserAliado, new THREE.MeshBasicMaterial({ color: aliada.cfg.corLaser }));
    laser.position.copy(aliada.mesh.position);
    const dir = aliada.alvo.position.clone().sub(aliada.mesh.position).normalize();
    laser.userData = { vel: dir.multiplyScalar(2.2) };
    laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    laser.add(new THREE.PointLight(aliada.cfg.corLaser, 3, 3));
    scene.add(laser);
    aliada.lasers.push(laser);
}

function removerNavesAliadas(scene) {
    for (const a of naveAliada) {
        a.lasers.forEach(l => scene.remove(l));
        scene.remove(a.mesh);
    }
    naveAliada = [];
}

function ativarNavesAliadas(scene) {
    removerNavesAliadas(scene);

    const P       = CFG_PERSONAGENS[personagemEscolhido];
    const aliados = P.aliados; // ex: ['nala','alice']
    const posicoes = [-2.5, 2.5];

    aliados.forEach((chave, idx) => {
        const a = criarNaveAliada(scene, chave, posicoes[idx]);
        a.mesh.position.set(posicoes[idx] < 0 ? -35 : 35, 2, 6);
        a.chegando = true;
        a.chegandoTimer = 120;
        naveAliada.push(a);
    });

    // Diálogos de entrada dinâmicos baseados no personagem escolhido
    const al0 = CFG_PERSONAGENS[aliados[0]];
    const al1 = CFG_PERSONAGENS[aliados[1]];

    setTimeout(() => mostrarDialogo(P.img(),   P.nome,   P.falaOnda7, 2800), 200);
    setTimeout(() => mostrarDialogo(al0.img(), al0.nome, `Aqui ${al0.nome}! Cobrindo o flanco esquerdo!`, 3000), 3400);
    setTimeout(() => mostrarDialogo(al1.img(), al1.nome, `${al1.nome} chegando pela direita! Formação!`, 3000), 7000);
    setTimeout(() => mostrarDialogo(P.img(),   P.nome,   'Que time! Juntos somos imparáveis!', 3000), 10500);
}

function getNaveAliadaPorNome(nome) {
    return naveAliada.find(a => a?.cfg?.nome === nome)?.mesh || null;
}

function getNaveDaCenaFinal(nomePersonagem) {
    const P = CFG_PERSONAGENS[personagemEscolhido];
    // Se é o personagem jogador
    if (nomePersonagem === P.nome) return naveJogador;
    // Se é um dos aliados
    const aliado = naveAliada.find(a => a?.cfg?.nome === nomePersonagem);
    if (aliado) return aliado.mesh;
    return naveJogador;
}

// ── CENA FINAL ÉPICA (no cenário 3D, câmera dinâmica) ────────────────────────
let _cenaFinalCameraCallback = null;

export function setCenaFinalCameraCallback(fn) {
    _cenaFinalCameraCallback = fn;
}

function atualizarNavesAliadas(scene) {
    if (naveAliada.length === 0 || !naveJogador) return;

    for (const aliada of naveAliada) {
        if (!aliada.vivo) continue;

        // Animação de chegada — desliza da lateral até posição de combate
        if (aliada.chegando) {
            aliada.chegandoTimer--;
            const alvoEntrada = new THREE.Vector3(aliada.cfg.posX, 2, 6);
            aliada.mesh.position.lerp(alvoEntrada, 0.06);
            // Inclinação dramática durante entrada
            aliada.mesh.rotation.z = THREE.MathUtils.lerp(
                aliada.mesh.rotation.z,
                aliada.cfg.posX < 0 ? 0.6 : -0.6,
                0.05
            );
            if (aliada.chegandoTimer <= 0) {
                aliada.chegando = false;
                aliada.mesh.rotation.z = 0;
            }
            continue; // não atira durante a entrada
        }

        // Flutuação suave ao lado do jogador
        aliada.flutuacao += 0.025;
        const alvoX = aliada.cfg.posX + naveJogador.position.x * 0.3;
        const alvoY = naveJogador.position.y + Math.sin(aliada.flutuacao) * 0.4;
        const alvoZ = naveJogador.position.z + 1.5;
        aliada.mesh.position.x += (alvoX - aliada.mesh.position.x) * 0.05;
        aliada.mesh.position.y += (alvoY - aliada.mesh.position.y) * 0.05;
        aliada.mesh.position.z += (alvoZ - aliada.mesh.position.z) * 0.05;
        aliada.mesh.rotation.z = THREE.MathUtils.lerp(
            aliada.mesh.rotation.z,
            (alvoX - aliada.mesh.position.x) * -0.8, 0.1
        );

        // Escolhe o meteoro mais próximo como alvo
        let melhorAlvo = null, melhorDist = Infinity;
        for (const m of meteoros) {
            const dist = aliada.mesh.position.distanceTo(m.position);
            if (dist < melhorDist && m.position.z > -60) { melhorDist = dist; melhorAlvo = m; }
        }
        aliada.alvo = melhorAlvo;

        // Tiro automático — mais frequente nas ondas altas
        aliada.timerTiro--;
        const freqTiro = ondaAtual >= 9 ? 30 : ondaAtual >= 8 ? 40 : 55;
        if (aliada.timerTiro <= 0 && aliada.alvo) {
            aliada.timerTiro = freqTiro + Math.random() * 30;
            dispararLaserAliado(scene, aliada);
        }

        // Move e colide lasers da aliada
        for (let i = aliada.lasers.length - 1; i >= 0; i--) {
            const l = aliada.lasers[i];
            l.position.add(l.userData.vel);
            if (l.position.z < -130 || Math.abs(l.position.x) > 60) {
                scene.remove(l); aliada.lasers.splice(i, 1); continue;
            }
            const prev = l.position.clone().sub(l.userData.vel);
            const segDir = l.userData.vel.clone().normalize();
            const segLen = l.userData.vel.length();
            let acertou = false;
            for (let j = meteoros.length - 1; j >= 0; j--) {
                const m = meteoros[j];
                const toM = m.position.clone().sub(prev);
                const t = Math.max(0, Math.min(segLen, toM.dot(segDir)));
                const closest = prev.clone().add(segDir.clone().multiplyScalar(t));
                if (m.position.distanceTo(closest) < 0.45 + m.userData.escala * 0.5) {
                    criarExplosao(scene, m.position.clone(), aliada.cfg.corLaser);
                    scene.remove(m); meteoros.splice(j, 1);
                    scene.remove(l); aliada.lasers.splice(i, 1);
                    pontos += Math.ceil((80 * ondaAtual) / (m.userData.escala + 0.1));
                    atualizarHUD(); acertou = true; break;
                }
            }
            if (acertou) continue;
        }

        // Falas periódicas
        aliada.falaTimer--;
        if (aliada.falaTimer <= 0 && meteoros.length > 0) {
            aliada.falaTimer = 300 + Math.random() * 400;
            const fala = aliada.cfg.fala[Math.floor(Math.random() * aliada.cfg.fala.length)];
            mostrarDialogo(aliada.cfg.img, aliada.cfg.nome, fala, 2000);
        }
    }
}


function mostrarCenaFinal(onVoltar) {
    const P = CFG_PERSONAGENS[personagemEscolhido];
    const CENAS = P.dialogosFinal.map(d => {
        const pc = CFG_PERSONAGENS[d.p];
        return {
            img:    pc.img(),
            nome:   pc.nome,
            txt:    d.txt,
            dur:    d.ultimo ? 5500 : 4500 + d.txt.length * 18,
            ultimo: d.ultimo || false,
        };
    });

    const el = document.createElement('div');
    el.id = 'cf-hud';
    el.innerHTML = `
        <div id="cf-dialogo">
            <img id="cf-face" src="${P.img()}" alt="">
            <div id="cf-corpo">
                <div id="cf-nome"></div>
                <div id="cf-txt"></div>
            </div>
        </div>
        <div id="cf-foto-wrap" style="display:none">
            <div id="cf-foto-titulo">★ MISSÃO CUMPRIDA ★</div>
            <div id="cf-foto-sub">Uma história de amizade, código e conquistas</div>
            <div id="cf-foto-frame">
                <img src="${IMG_TEAM}" alt="O Time">
            </div>
            <div id="cf-foto-legenda">Brayan · Nala · Alice — Para sempre na história</div>
            <button id="cf-btn-voltar">◀ VOLTAR AO PORTFÓLIO</button>
        </div>
    `;
    document.body.appendChild(el);

    let digIntervalo = null;
    function limparDigitacao() {
        if (digIntervalo) { clearInterval(digIntervalo); digIntervalo = null; }
    }

    function mostrarFotoFinal() {
        limparDigitacao();
        const dialogo = document.getElementById('cf-dialogo');
        const fotoWrap = document.getElementById('cf-foto-wrap');
        if (dialogo) dialogo.style.display = 'none';
        if (fotoWrap) { fotoWrap.style.display = 'flex'; fotoWrap.style.animation = 'cf-entrada 1.2s ease-out forwards'; }
        import('./main.js').then(m => m.pararCameraDialogo());
        const btnVoltar = document.getElementById('cf-btn-voltar');
        if (btnVoltar) { btnVoltar.onclick = () => { el.remove(); if (onVoltar) onVoltar(); }; }
    }

    function mostrarCena(idx) {
        if (idx >= CENAS.length) { import('./main.js').then(m => m.pararCameraDialogo()); mostrarFotoFinal(); return; }
        const c = CENAS[idx];
        const naveDaFala = getNaveDaCenaFinal(c.nome);
        import('./main.js').then(m => {
            if (naveDaFala) m.iniciarCicloCameraDialogo(naveDaFala);
            else m.focarNaveDialogo(naveJogador);
        });
        const face = document.getElementById('cf-face');
        const nome = document.getElementById('cf-nome');
        const txt  = document.getElementById('cf-txt');
        if (!face || !nome || !txt) return;
        face.src = c.img; face.alt = c.nome;
        nome.textContent = c.nome;
        txt.textContent = '';
        limparDigitacao();
        let i = 0;
        digIntervalo = setInterval(() => {
            if (i < c.txt.length) txt.textContent += c.txt[i++];
            else { clearInterval(digIntervalo); digIntervalo = null; }
        }, 28);
        setTimeout(() => mostrarCena(idx + 1), c.dur);
    }

    mostrarCena(0);
}

// ── DIALOGOS ONDA ─────────────────────────────────────────────────────────────
// DIALOGOS_ONDA — dinâmico conforme personagem escolhido
function getDiálogoOnda(onda) {
    const P = aliadoPrincipal();
    const S = aliadoSuporte();   // dá itens (ondas 3, 5)
    const R = aliadoRadar();     // comenta radar (ondas pares)
    const tbl = {
        1:  { img: P.img(), nome: P.nome, txt: 'Sistema de defesa ativo! Destruam esses meteoros!' },
        2:  { img: R.img(), nome: R.nome, txt: 'Radar confirmado — mais hostis a caminho!' },
        3:  { img: S.img(), nome: S.nome, txt: 'HYPER BEAM em rota! Acerte o item especial!' },
        4:  { img: R.img(), nome: R.nome, txt: `Muitos meteoros! ${S.nome.split(' ')[0]} está enviando reforços!` },
        5:  { img: S.img(), nome: S.nome, txt: 'Twin Laser disponível — acerte o item dourado!' },
        6:  { img: P.img(), nome: P.nome, txt: 'Onda 6. Sem recuar — resistimos até o fim!' },
        7:  { img: R.img(), nome: R.nome, txt: 'ONDA 7! Pedindo reforços — a caminho!' },
        8:  { img: S.img(), nome: S.nome, txt: 'Onda 8! Eles estão mais fortes — mas nós também!' },
        9:  { img: P.img(), nome: P.nome, txt: 'Penúltima onda! Juntos chegamos até aqui!' },
        10: { img: R.img(), nome: R.nome, txt: 'ONDA FINAL! Tudo ou nada — deem o melhor!' },
    };
    return tbl[Math.min(onda, 10)] || tbl[10];
}

function mostrarDialogoOnda(onda) {
    const d = getDiálogoOnda(onda);
    mostrarDialogo(d.img, d.nome, d.txt);
}

export let cenaFinalAtiva = false;
export function isCenaFinalAtiva() { return cenaFinalAtiva; }

function encerrarJogo(scene) {
    const pts = pontos;
    pararJogo();
    mostrarGameOver(pts, onGameOver);
}

function venceuJogo(scene) {
    cenaFinalAtiva = true;
    tocarVitoria();

    // mantém Alice e Nala na cena final
    pararJogo(true);

    // garante que a nave do Brayan continue visível
    if (naveJogador) {
        naveJogador.visible = true;
        naveJogador.position.set(0, 2, 5);
        naveJogador.rotation.set(0, 0, 0);
    }

    const ptsFinais = pontos;

    mostrarCenaFinal(() => {
        cenaFinalAtiva = false;

        // agora sim limpa as aliadas ao sair da cena final
        if (sceneRef) removerNavesAliadas(sceneRef);

        // Mostra tela de registro de pontos (vitória)
        mostrarGameOver(ptsFinais, onGameOver);
    });
}