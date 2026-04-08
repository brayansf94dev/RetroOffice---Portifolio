// ═══════════════════════════════════════════════════════════════
//  musica.js — Player YouTube com Playlist Manual
//  Brayan_OS · Beyond Bits
//
//  Para adicionar músicas: cole o ID do vídeo do YouTube abaixo
//  Ex: youtube.com/watch?v=XXXXXXXXXXX  →  id: 'XXXXXXXXXXX'
// ═══════════════════════════════════════════════════════════════

// ── PLAYLIST ──────────────────────────────────────────────────
const PLAYLIST = [
    {
        id:     'sQ6f9tFbWNA',
        titulo: 'Nintendo 64 LoFi',
        canal:  'LoFi Mix',
        emoji:  '🎮'
    },
    {
        id:     'Z3GA0GQCE2M',
        titulo: 'Zelda LoFi',
        canal:  'LoFi Mix',
        emoji:  '🗡️'
    },
    {
        id:     '-iVACinS6EY',
        titulo: 'Pokémon Lo-fi Music',
        canal:  'Matcha',
        emoji:  '🐾'
    }
];

// ── ESTADO ────────────────────────────────────────────────────
let playerAberto  = false;
let ytPlayer      = null;
let ytApiPronta   = false;
let indexAtual    = 0;
let modoAleatorio = false;
let modoRepetir   = false;
let modoCamera    = false;
let cameraCb      = null;

// ── YOUTUBE IFRAME API ────────────────────────────────────────
function carregarYouTubeAPI() {
    if (document.getElementById('yt-iframe-api')) return;
    const s = document.createElement('script');
    s.id  = 'yt-iframe-api';
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
}

window.onYouTubeIframeAPIReady = () => { ytApiPronta = true; };
carregarYouTubeAPI();

// ── INICIAR PLAYER ────────────────────────────────────────────
function iniciarPlayer(videoId) {
    const container = document.getElementById('yt-player-container');
    if (!container) return;

    if (ytPlayer) { try { ytPlayer.destroy(); } catch(e) {} ytPlayer = null; }
    if (!ytApiPronta) { setTimeout(() => iniciarPlayer(videoId), 300); return; }

    container.innerHTML = '<div id="yt-iframe-el"></div>';

    ytPlayer = new YT.Player('yt-iframe-el', {
        height: '100%', width: '100%',
        videoId,
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3 },
        events: {
            onReady:       e => { e.target.playVideo(); e.target.setVolume(80); atualizarUI(); },
            onStateChange: e => { if (e.data === 0) proximaMusica(); atualizarBotaoPlay(e.data === 1); }
        }
    });
}

// ── CONTROLES ─────────────────────────────────────────────────
function tocar(idx) {
    if (idx < 0 || idx >= PLAYLIST.length) return;
    indexAtual = idx;
    iniciarPlayer(PLAYLIST[idx].id);
    atualizarUI();
    destacarItem(idx);
}

function proximaMusica() {
    let next;
    if (modoAleatorio)     next = Math.floor(Math.random() * PLAYLIST.length);
    else if (modoRepetir)  next = indexAtual;
    else                   next = (indexAtual + 1) % PLAYLIST.length;
    tocar(next);
}

function musicaAnterior() {
    tocar((indexAtual - 1 + PLAYLIST.length) % PLAYLIST.length);
}

function togglePlay() {
    if (!ytPlayer) { tocar(indexAtual); return; }
    ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
}

function setVolume(v) {
    if (ytPlayer) ytPlayer.setVolume(parseInt(v));
    const l = document.getElementById('yt-vol-label');
    if (l) l.textContent = v + '%';
}

// ── MODO CÂMERA CINEMATIC ─────────────────────────────────────
export function registrarCallbackCamera(fn) { cameraCb = fn; }

function ativarModoCamera() {
    modoCamera = true;
    if (cameraCb) cameraCb(true);

    const btn = document.getElementById('yt-btn-camera');
    if (btn) { btn.classList.add('ativo'); }

    // Esconde o portfólio e libera o canvas
    const overlay = document.getElementById('xp-overlay');
    if (overlay) { overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none'; }

    // Esconde o FAB para não atrapalhar a cena
    const fab = document.getElementById('yt-fab');
    if (fab) fab.style.opacity = '0.3';

    mostrarToast('🎥 Modo Câmera ativado — viajando pelo universo...');
}

function desativarModoCamera() {
    modoCamera = false;
    if (cameraCb) cameraCb(false);

    const btn = document.getElementById('yt-btn-camera');
    if (btn) { btn.classList.remove('ativo'); }

    const overlay = document.getElementById('xp-overlay');
    if (overlay && overlay.classList.contains('vis')) {
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    }

    const fab = document.getElementById('yt-fab');
    if (fab) fab.style.opacity = '1';

    mostrarToast('🖥️ Modo Câmera desativado');
}

function toggleModoCamera() {
    modoCamera ? desativarModoCamera() : ativarModoCamera();
}

// ── Exporta estado do modo câmera para o main.js consultar no loop ──
export function isModoCamera() { return modoCamera; }

// ── UI ────────────────────────────────────────────────────────
function atualizarUI() {
    const m = PLAYLIST[indexAtual];
    if (!m) return;
    const t = document.getElementById('yt-playing-titulo');
    const c = document.getElementById('yt-playing-canal');
    const e = document.getElementById('yt-playing-emoji');
    if (t) t.textContent = m.titulo;
    if (c) c.textContent = m.canal;
    if (e) e.textContent = m.emoji;
}

function atualizarBotaoPlay(tocando) {
    const btn = document.getElementById('yt-btn-play');
    if (btn) btn.textContent = tocando ? '⏸' : '▶';
}

function destacarItem(idx) {
    document.querySelectorAll('.yt-pl-item').forEach((el, i) => {
        el.classList.toggle('tocando', i === idx);
        const n = el.querySelector('.yt-pl-num');
        if (n) n.textContent = i === idx ? '♪' : (i + 1);
    });
}

function mostrarToast(msg) {
    let t = document.getElementById('yt-toast');
    if (!t) { t = document.createElement('div'); t.id = 'yt-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('vis');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('vis'), 3000);
}

// ── CRIAR JANELA ──────────────────────────────────────────────
function criarJanela() {
    const el = document.createElement('div');
    el.id = 'musica-player';

    el.innerHTML = `
        <div id="yt-titlebar">
            <span style="font-size:1.2em">🎵</span>
            <span style="flex:1;font-size:.95em;text-shadow:1px 1px 2px #0008;white-space:nowrap;overflow:hidden;">
                Brayan_OS — Music Player
            </span>
            <button id="yt-btn-min" title="Minimizar">─</button>
            <button id="yt-btn-close" title="Fechar" class="yt-xp-close">✕</button>
        </div>

        <div id="yt-player-container"></div>

        <div id="yt-nowplaying">
            <span id="yt-playing-emoji" style="font-size:2.2em;line-height:1;flex-shrink:0;">🎵</span>
            <div style="flex:1;overflow:hidden;">
                <div id="yt-playing-titulo">Selecione uma música</div>
                <div id="yt-playing-canal">Brayan_OS Music Player</div>
            </div>
        </div>

        <div id="yt-controles">
            <button class="yt-ctrl" id="yt-btn-anterior" title="Anterior">⏮</button>
            <button class="yt-ctrl yt-ctrl-play" id="yt-btn-play" title="Play/Pause">▶</button>
            <button class="yt-ctrl" id="yt-btn-proximo" title="Próxima">⏭</button>
            <div class="yt-sep"></div>
            <button class="yt-ctrl yt-toggle" id="yt-btn-shuffle" title="Aleatório">🔀</button>
            <button class="yt-ctrl yt-toggle" id="yt-btn-repeat"  title="Repetir">🔁</button>
            <div style="flex:1"></div>
            <span style="color:rgba(0,200,255,.6);font-size:.9em;">🔊</span>
            <input id="yt-volume" type="range" min="0" max="100" value="80">
            <span id="yt-vol-label" style="color:rgba(0,200,255,.7);font-size:.9em;min-width:2.5em;">80%</span>
        </div>

        <div id="yt-camera-area">
            <button id="yt-btn-camera">
                🎥 Modo Câmera — Viajar pelo Universo 3D
            </button>
            <div id="yt-camera-hint">A câmera voa suavemente pelo cenário enquanto a música toca</div>
        </div>

        <div id="yt-playlist-header">
            <span>🎶 Playlist</span>
            <span style="color:rgba(0,100,200,.6);font-size:.9em;">${PLAYLIST.length} músicas</span>
        </div>
     <div id="yt-playlist">
            ${PLAYLIST.map((m, i) => `
                <div class="yt-pl-item" data-idx="${i}">
                    <span class="yt-pl-num">${i + 1}</span>
                    
                    <img src="https://img.youtube.com/vi/${m.id}/mqdefault.jpg" 
                         style="width: 52px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(0,200,255,0.2); flex-shrink: 0;">
                    
                    <div class="yt-pl-info">
                        <div class="yt-pl-titulo">${m.titulo}</div>
                        <div class="yt-pl-canal">${m.canal}</div>
                    </div>
                    <button class="yt-pl-play" data-idx="${i}">▶</button>
                </div>
            `).join('')}
        </div>
    `;

    document.body.appendChild(el);
    injetarCSS();
    vincularEventos(el);
    ativarDrag(el);
}

function vincularEventos(el) {
    document.getElementById('yt-btn-close').addEventListener('click', fecharPlayer);
    document.getElementById('yt-btn-min').addEventListener('click', () => {
        const min = el.dataset.min === '1';
        el.dataset.min = min ? '0' : '1';
        ['yt-player-container','yt-nowplaying','yt-controles','yt-camera-area','yt-playlist-header','yt-playlist']
            .forEach(id => { const d = document.getElementById(id); if (d) d.style.display = min ? '' : 'none'; });
    });

    document.getElementById('yt-btn-play').addEventListener('click', togglePlay);
    document.getElementById('yt-btn-proximo').addEventListener('click', proximaMusica);
    document.getElementById('yt-btn-anterior').addEventListener('click', musicaAnterior);

    document.getElementById('yt-btn-shuffle').addEventListener('click', function() {
        modoAleatorio = !modoAleatorio;
        this.classList.toggle('ativo', modoAleatorio);
        mostrarToast(modoAleatorio ? '🔀 Modo aleatório ativado' : '🔀 Aleatório desativado');
    });
    document.getElementById('yt-btn-repeat').addEventListener('click', function() {
        modoRepetir = !modoRepetir;
        this.classList.toggle('ativo', modoRepetir);
        mostrarToast(modoRepetir ? '🔁 Repetindo música atual' : '🔁 Repetição desativada');
    });

    document.getElementById('yt-volume').addEventListener('input', e => setVolume(e.target.value));
    document.getElementById('yt-btn-camera').addEventListener('click', toggleModoCamera);

    el.querySelectorAll('.yt-pl-play').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); tocar(parseInt(btn.dataset.idx)); });
    });
    el.querySelectorAll('.yt-pl-item').forEach(item => {
        item.addEventListener('click', () => tocar(parseInt(item.dataset.idx)));
    });
}

function ativarDrag(el) {
    const bar = document.getElementById('yt-titlebar');
    let drag = false, ox = 0, oy = 0;
    bar.addEventListener('mousedown', e => {
        drag = true;
        const r = el.getBoundingClientRect();
        ox = e.clientX - r.left; oy = e.clientY - r.top;
    });
    document.addEventListener('mousemove', e => {
        if (!drag) return;
        el.style.left   = Math.max(0, Math.min(innerWidth  - el.offsetWidth,  e.clientX - ox)) + 'px';
        el.style.top    = Math.max(0, Math.min(innerHeight - el.offsetHeight, e.clientY - oy)) + 'px';
        el.style.right  = 'auto';
        el.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { drag = false; });
}

// ── ABRIR / FECHAR ────────────────────────────────────────────
function abrirPlayer() {
    playerAberto = true;
    const el = document.getElementById('musica-player');
    if (el) el.style.display = 'flex';
}

function fecharPlayer() {
    playerAberto = false;
    if (modoCamera) desativarModoCamera();
    const el = document.getElementById('musica-player');
    if (el) el.style.display = 'none';
}

// ── CSS ───────────────────────────────────────────────────────
function injetarCSS() {
    if (document.getElementById('musica-css')) return;
    const s = document.createElement('style');
    s.id = 'musica-css';
    s.textContent = `
        #musica-player {
            display:none; position:fixed; bottom:80px; right:24px;
            width:min(400px,95vw); z-index:500;
            background:#ECE9D8; border:2px solid #0A246A;
            border-radius:6px 6px 3px 3px;
            box-shadow:0 8px 40px rgba(0,0,0,.75);
            font-family:Tahoma,Arial,sans-serif; font-size:11px;
            flex-direction:column; overflow:hidden;
        }
        #yt-titlebar {
            background:linear-gradient(to bottom,#2461EA,#1941C0 30%,#1636A8 70%,#0F2A8A);
            color:#fff; font-weight:bold;
            padding:.27em .5em .35em .65em;
            display:flex; align-items:center; gap:.4em;
            flex-shrink:0; cursor:move; user-select:none;
        }
        #yt-titlebar button {
            width:1.8em; height:1.7em; border:1px solid #1a3a9a; border-radius:3px;
            font-size:.9em; font-weight:bold; cursor:pointer; color:#fff; padding:0; line-height:1;
            background:linear-gradient(to bottom,#4a7ee8,#1a4ac0);
        }
        #yt-titlebar button:hover { background:linear-gradient(to bottom,#6a9eff,#2a5adf); }
        #yt-titlebar .yt-xp-close { background:linear-gradient(to bottom,#e04040,#a02020)!important; border-color:#801010!important; }
        #yt-titlebar .yt-xp-close:hover { background:linear-gradient(to bottom,#ff5555,#cc2222)!important; }
        #yt-player-container { width:100%; height:0; overflow:hidden; pointer-events:none; }
        #yt-nowplaying {
            background:linear-gradient(135deg,#001428,#002040);
            padding:10px 14px; display:flex; align-items:center; gap:10px; flex-shrink:0;
        }
        #yt-playing-titulo { color:#e0f4ff; font-weight:bold; font-size:1.05em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        #yt-playing-canal  { color:rgba(0,200,255,.7); font-size:.9em; margin-top:2px; }
        #yt-controles {
            background:#001e3c; padding:8px 12px;
            display:flex; align-items:center; gap:6px; flex-shrink:0;
            border-top:1px solid rgba(0,200,255,.2);
        }
        .yt-ctrl {
            background:rgba(0,40,80,.5); border:1px solid rgba(0,200,255,.3);
            color:#80ccff; border-radius:4px; font-size:13px;
            cursor:pointer; padding:4px 9px; transition:all .15s; line-height:1;
        }
        .yt-ctrl:hover { background:rgba(0,60,120,.7); border-color:rgba(0,200,255,.7); color:#fff; }
        .yt-ctrl-play { font-size:15px; padding:4px 14px; background:rgba(0,80,160,.6); }
        .yt-toggle { opacity:.45; }
        .yt-toggle.ativo { opacity:1; box-shadow:0 0 8px rgba(0,200,255,.4); }
        .yt-sep { width:1px; height:20px; background:rgba(0,200,255,.2); margin:0 2px; }
        #yt-volume { width:65px; accent-color:#00ccff; cursor:pointer; }
        #yt-camera-area {
            background:linear-gradient(135deg,#0a0020,#001428);
            border-top:1px solid rgba(0,200,255,.15);
            border-bottom:1px solid rgba(0,200,255,.15);
            padding:10px 14px; flex-shrink:0;
        }
        #yt-btn-camera {
            width:100%;
            background:linear-gradient(135deg,rgba(0,40,80,.8),rgba(0,20,50,.9));
            border:1px solid rgba(0,200,255,.4); border-radius:4px;
            color:#80ccff; font-family:Tahoma,Arial,sans-serif; font-size:11px;
            padding:8px 14px; cursor:pointer; letter-spacing:.5px;
            transition:all .2s; display:flex; align-items:center; justify-content:center; gap:6px;
        }
        #yt-btn-camera:hover {
            background:linear-gradient(135deg,rgba(0,60,120,.9),rgba(0,30,70,1));
            border-color:rgba(0,200,255,.8); color:#c0eeff;
            box-shadow:0 0 16px rgba(0,150,255,.25);
        }
        #yt-btn-camera.ativo {
            background:linear-gradient(135deg,rgba(0,100,200,.7),rgba(0,60,120,.9));
            border-color:rgba(0,220,255,.9); color:#fff;
            box-shadow:0 0 20px rgba(0,180,255,.35);
            animation: camera-pulse 2s ease-in-out infinite;
        }
        @keyframes camera-pulse {
            0%,100% { box-shadow:0 0 20px rgba(0,180,255,.35); }
            50%      { box-shadow:0 0 35px rgba(0,200,255,.6); }
        }
        #yt-camera-hint {
            text-align:center; color:rgba(0,180,255,.45);
            font-size:.88em; margin-top:5px; letter-spacing:.3px;
        }
        #yt-playlist-header {
            background:linear-gradient(to bottom,#EBE8D7,#D7D4C8);
            border-top:1px solid #ACA899; border-bottom:1px solid #ACA899;
            padding:5px 10px; display:flex; justify-content:space-between; align-items:center;
            font-weight:bold; font-size:.9em; flex-shrink:0;
        }
        #yt-playlist { overflow-y:auto; max-height:190px; background:#fff; scrollbar-width:thin; scrollbar-color:#ACA899 #ECE9D8; }
        .yt-pl-item {
            display:flex; align-items:center; gap:8px;
            padding:7px 10px; border-bottom:1px solid #f0ede6;
            cursor:pointer; transition:background .1s;
        }
        .yt-pl-item:hover { background:#EEF4FF; }
        .yt-pl-item.tocando { background:#EEF4FF; border-left:3px solid #316AC5; }
        .yt-pl-num { width:16px; text-align:center; color:#999; font-size:10px; flex-shrink:0; }
        .yt-pl-item.tocando .yt-pl-num { color:#316AC5; font-size:13px; }
        .yt-pl-emoji { font-size:1.3em; flex-shrink:0; }
        .yt-pl-info  { flex:1; overflow:hidden; }
        .yt-pl-titulo { font-weight:bold; color:#111; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .yt-pl-canal  { color:#888; font-size:10px; margin-top:1px; }
        .yt-pl-play {
            background:linear-gradient(to bottom,#4a7ee8,#1a4ac0);
            border:1px solid #1a3a9a; border-radius:3px;
            color:#fff; font-size:11px; cursor:pointer; padding:3px 9px; flex-shrink:0;
        }
        .yt-pl-play:hover { background:linear-gradient(to bottom,#6a9eff,#2a5adf); }
        #yt-fab {
            position:fixed; bottom:28px; right:24px; z-index:400;
            background:rgba(10,10,20,.88); color:#80ccff;
            border:1px solid rgba(0,200,255,.4); border-radius:50%;
            width:46px; height:46px; font-size:20px; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 0 18px rgba(0,200,255,.2); transition:all .2s;
        }
        #yt-fab:hover { background:rgba(0,40,80,.95); box-shadow:0 0 28px rgba(0,200,255,.4); transform:scale(1.1); }
        #yt-toast {
            position:fixed; bottom:24px; left:50%;
            transform:translateX(-50%) translateY(20px);
            background:rgba(0,20,50,.92); color:#80ccff;
            border:1px solid rgba(0,200,255,.4); border-radius:4px;
            padding:8px 20px; font-size:11px; font-family:Tahoma,Arial,sans-serif;
            z-index:9999; opacity:0; pointer-events:none;
            transition:opacity .3s, transform .3s; white-space:nowrap;
        }
        #yt-toast.vis { opacity:1; transform:translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(s);
}

// ── FAB ───────────────────────────────────────────────────────
function criarFAB() {
    const fab = document.createElement('button');
    fab.id = 'yt-fab'; fab.title = 'Music Player'; fab.innerHTML = '🎵';
    fab.addEventListener('click', () => playerAberto ? fecharPlayer() : abrirPlayer());
    document.body.appendChild(fab);
}

// ── INIT ──────────────────────────────────────────────────────
criarJanela();
criarFAB();

window.addEventListener('load', () => {
    const btn = document.getElementById('btn-musica');
    if (btn) btn.addEventListener('click', abrirPlayer);
});

export { abrirPlayer, fecharPlayer };