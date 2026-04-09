// ── AUDIO.JS — Fox 64 Sound System v2 ────────────────────────────────────────
// Sons 100% procedurais via Web Audio API. Zero arquivos externos.
// Para usar áudio real, preencha os paths abaixo.
//
// EXPORTS:
//   tocarTiro()           — laser padrão
//   tocarTiroUpgrade()    — twin laser
//   tocarTiroHyper()      — hyper beam
//   tocarExplosao(tam)    — meteoro (escala com tamanho)
//   tocarDano()           — nave/base levou dano
//   tocarItem()           — coletou item genérico (cura)
//   tocarUpgrade()        — ativou power-up (twin/hyper)
//   tocarDialogo()        — personagem começa a falar
//   iniciarMusica()       — música tema em loop (4 fases ~90s)
//   pararMusica()         — fade out da música
//   tocarVitoria()        — fanfarra de vitória (cena final)
// ─────────────────────────────────────────────────────────────────────────────

// ── PATHS REAIS (deixe '' para sons procedurais) ──────────────────────────────
const PATH_MUSICA   = '';
const PATH_TIRO     = '';
const PATH_EXPLOSAO = '';
const PATH_DANO     = '';
const PATH_ITEM     = '';

// ── ESTADO GLOBAL ────────────────────────────────────────────────────────────
let ctx         = null;
let masterGain  = null;
let sfxGain     = null;
let musicaGain  = null;
let musicaAtiva = false;
let musicaSource= null;
let _oscs       = [];
let _mudo       = false;

export function setMudo(mudo) {
    _mudo = mudo;
    if (!masterGain) return;
    masterGain.gain.setTargetAtTime(_mudo ? 0 : 0.8, ctx.currentTime, 0.05);
}

export function isMudo() { return _mudo; }

// ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────────
function _ctx() {
    if (ctx) return ctx;
    ctx        = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(ctx.destination);
    sfxGain    = ctx.createGain(); sfxGain.gain.value   = 1.0; sfxGain.connect(masterGain);
    musicaGain = ctx.createGain(); musicaGain.gain.value = 0.0; musicaGain.connect(masterGain);
    return ctx;
}

function _now() { return _ctx().currentTime; }

// ── PRIMITIVO: OSC ───────────────────────────────────────────────────────────
function _osc({ type='sine', freq=440, vol=0.2, dur=0.2, delay=0,
                freqEnd=null, attack=0.005, release=null, sustain=0.8,
                vibrato=0, out=null }) {
    const ac = _ctx();
    const t  = ac.currentTime + delay;
    const g  = ac.createGain();
    g.connect(out || sfxGain);
    const osc = ac.createOscillator();
    osc.type  = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    if (vibrato > 0) {
        const lfo = ac.createOscillator(); const lfoG = ac.createGain();
        lfo.frequency.value = 5; lfoG.gain.value = vibrato;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        lfo.start(t); lfo.stop(t + dur);
    }
    const rel = release ?? dur * 0.3;
    const att = Math.min(attack, dur * 0.1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol * sustain, t + dur - rel);
    g.gain.linearRampToValueAtTime(0.00001, t + dur);
    osc.connect(g); osc.start(t); osc.stop(t + dur + 0.01);
    _oscs.push(osc);
}

// ── PRIMITIVO: NOISE ─────────────────────────────────────────────────────────
function _noise({ vol=0.1, dur=0.2, delay=0, filterFreq=2000, filterType='lowpass',
                  attack=0.005, release=null, out=null }) {
    const ac  = _ctx();
    const t   = ac.currentTime + delay;
    const len = Math.ceil(ac.sampleRate * (dur + 0.05));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const flt = ac.createBiquadFilter(); flt.type = filterType; flt.frequency.value = filterFreq;
    const g   = ac.createGain(); g.connect(out || sfxGain);
    const rel = release ?? dur * 0.4;
    const att = Math.min(attack, dur * 0.05);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + dur - rel);
    g.gain.linearRampToValueAtTime(0.00001, t + dur);
    src.connect(flt); flt.connect(g);
    src.start(t); src.stop(t + dur + 0.05);
    _oscs.push(src);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── EFEITOS SONOROS ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export function tocarTiro() {
    _ctx();
    if (PATH_TIRO) { _arquivo(PATH_TIRO, 0.35); return; }
    _osc({ type:'sawtooth', freq:900,  freqEnd:380, vol:0.16, dur:0.09, attack:0.002 });
    _osc({ type:'sine',     freq:1400, freqEnd:600, vol:0.07, dur:0.06, attack:0.001 });
    _noise({ vol:0.05, dur:0.04, filterFreq:8000 });
}

export function tocarTiroUpgrade() {
    _ctx();
    if (PATH_TIRO) { _arquivo(PATH_TIRO, 0.45); return; }
    _osc({ type:'sawtooth', freq:1100, freqEnd:500, vol:0.15, dur:0.09 });
    _osc({ type:'sawtooth', freq:950,  freqEnd:430, vol:0.14, dur:0.09, delay:0.035 });
    _osc({ type:'sine',     freq:1800, freqEnd:800, vol:0.06, dur:0.05, delay:0.01 });
}

export function tocarTiroHyper() {
    _ctx();
    if (PATH_TIRO) { _arquivo(PATH_TIRO, 0.65); return; }
    _osc({ type:'sawtooth', freq:110,  freqEnd:60,  vol:0.28, dur:0.22, attack:0.01 });
    _osc({ type:'square',   freq:220,  freqEnd:110, vol:0.18, dur:0.20, attack:0.01 });
    _osc({ type:'sine',     freq:2200, freqEnd:800, vol:0.10, dur:0.08 });
    _noise({ vol:0.20, dur:0.15, filterFreq:1800, attack:0.005 });
}

export function tocarExplosao(tamanho = 0.5) {
    _ctx();
    if (PATH_EXPLOSAO) { _arquivo(PATH_EXPLOSAO, Math.min(1, 0.3 + tamanho * 0.7)); return; }
    const v = 0.18 + tamanho * 0.32;
    const d = 0.20 + tamanho * 0.55;
    _noise({ vol: v,       dur: d,       filterFreq: 600 + tamanho * 800, attack: 0.003 });
    _osc({ type:'sine', freq: 90 + tamanho*50, freqEnd: 25, vol: v*0.9, dur: d*0.7, attack:0.003 });
    _noise({ vol: v*1.2,   dur: 0.04,    filterFreq: 4000 });
    _osc({ type:'sine', freq: 55, vol: v*0.4, dur: d*0.8, attack:0.01, sustain:0.3 });
}

export function tocarDano() {
    _ctx();
    if (PATH_DANO) { _arquivo(PATH_DANO, 0.6); return; }
    _osc({ type:'square', freq:380, freqEnd:180, vol:0.22, dur:0.18, attack:0.003 });
    _osc({ type:'square', freq:280, freqEnd:140, vol:0.16, dur:0.14, delay:0.06 });
    _noise({ vol:0.12, dur:0.10, filterFreq:1200 });
}

export function tocarItem() {
    _ctx();
    if (PATH_ITEM) { _arquivo(PATH_ITEM, 0.6); return; }
    [523, 659, 784].forEach((f, i) => {
        _osc({ type:'sine', freq:f, vol:0.15, dur:0.13, delay: i*0.08, attack:0.01, sustain:0.8 });
    });
}

// Som de UPGRADE (twin laser / hyper beam ativado)
export function tocarUpgrade() {
    _ctx();
    // Acorde heróico ascendente com shimmer
    const graus = [392, 523, 659, 784, 1047];
    graus.forEach((f, i) => {
        _osc({ type:'square',   freq:f,   vol:0.13, dur:0.55-i*0.04, delay:i*0.055, attack:0.01, sustain:0.65, vibrato:4 });
        _osc({ type:'triangle', freq:f*2, vol:0.05, dur:0.30-i*0.02, delay:i*0.055+0.025 });
    });
    // Whoosh de energia ascendente
    _osc({ type:'sawtooth', freq:200, freqEnd:2400, vol:0.10, dur:0.38, attack:0.01, sustain:0.5 });
    _noise({ vol:0.08, dur:0.28, filterFreq:5000, filterType:'highpass', attack:0.01 });
}

// Som de diálogo — "comm link" estilo Star Fox
export function tocarDialogo() {
    _ctx();
    _noise({ vol:0.14, dur:0.03, filterFreq:3500 });
    _osc({ type:'sine',   freq:880,  vol:0.11, dur:0.07, delay:0.02, attack:0.004 });
    _osc({ type:'square', freq:1320, vol:0.07, dur:0.04, delay:0.05, attack:0.003 });
    _osc({ type:'sine',   freq:1100, vol:0.06, dur:0.05, delay:0.09, attack:0.003 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MÚSICA TEMA — 4 FASES EM LOOP (~90 segundos) ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export function iniciarMusica() {
    _ctx();
    if (musicaAtiva) return;
    musicaAtiva = true;
    if (PATH_MUSICA) { _arquivoLoop(PATH_MUSICA, 0.28); return; }
    musicaGain.gain.cancelScheduledValues(_now());
    musicaGain.gain.setValueAtTime(0, _now());
    musicaGain.gain.linearRampToValueAtTime(0.28, _now() + 2.5);
    _loopMusica();
}

export function pararMusica() {
    if (!musicaAtiva && !musicaSource) return;
    musicaAtiva = false;
    if (ctx && musicaGain) {
        const t = _now();
        musicaGain.gain.cancelScheduledValues(t);
        musicaGain.gain.setValueAtTime(musicaGain.gain.value, t);
        musicaGain.gain.linearRampToValueAtTime(0, t + 2.0);
    }
    setTimeout(() => {
        _oscs.forEach(o => { try { o.stop(); } catch(e) {} });
        _oscs = [];
        if (musicaSource) { try { musicaSource.stop(); } catch(e) {} musicaSource = null; }
    }, 2200);
}

// ── NOTAS (frequências) ───────────────────────────────────────────────────────
const N = {
    C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196.00,A3:220.00,B3:246.94,
    C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392.00,A4:440.00,B4:493.88,
    C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880.00,B5:987.77,
    C6:1046.50,D6:1174.66,
};

const BPM = 138;
const B   = 60 / BPM;   // 1 beat
const HB  = B / 2;      // colcheia
const QB  = B / 4;      // semicolcheia

// ── PROGRESSÃO DE ACORDES ─────────────────────────────────────────────────────
// Am7 – Fmaj7 – C – G (Am relativo, sonoridade cinematográfica)
// Cada acorde dura 4 beats (1 compasso)
const PROG = [ N.A3, N.F3, N.C4, N.G3 ]; // fundamentais do baixo
const PROG_DUR = 4 * B;

// ── MELODIA A — frase principal (16 beats) ────────────────────────────────────
const MEL_A = [
    [N.A4,B],  [N.C5,HB],[N.B4,HB],[N.A4,B],[0,HB],[N.G4,HB],
    [N.A4,HB], [N.C5,HB],[N.E5,B+HB],[N.D5,HB],
    [N.C5,B],  [N.B4,HB],[N.A4,HB],[N.G4,B],[N.A4,B],
    [N.A4,4*B],
];

// ── MELODIA B — frase de tensão (16 beats) ───────────────────────────────────
const MEL_B = [
    [N.E5,B],  [N.F5,HB],[N.E5,HB],[N.D5,B],[N.C5,B],
    [N.B4,B],  [N.A4,HB],[N.G4,HB],[N.F4,B],[0,B],
    [N.G4,HB], [N.A4,HB],[N.C5,B], [N.E5,B],[N.D5,HB],[N.C5,HB],
    [N.A4,4*B],
];

// ── CONTRACANTO ───────────────────────────────────────────────────────────────
const CONTRA = [
    [N.E4,2*B],[N.A3,2*B],[N.C4,2*B],[N.G3,2*B],
    [N.F4,2*B],[N.C4,2*B],[N.G4,2*B],[N.E4,2*B],
];

// ── STABS RÍTMICOS ────────────────────────────────────────────────────────────
const STABS = [
    [N.A4,QB],[0,QB],[N.A4,QB],[0,HB+QB],[N.C5,QB],[0,QB],[N.E5,QB],[0,QB+HB],
    [N.G4,QB],[0,QB],[N.G4,QB],[0,HB+QB],[N.B4,QB],[0,QB],[N.D5,QB],[0,QB+HB],
];

// ── LINHA DE PAD ESPACIAL (fase 1, ambient) ───────────────────────────────────
// Notas longas que criam textura de fundo
const PAD = [
    [N.A3,8*B],[N.F3,8*B],[N.C4,8*B],[N.G3,8*B],
];

// ── SCHEDULERS ────────────────────────────────────────────────────────────────

// Agenda sequência de notas, retorna tempo final
function _seq(notas, t0, opts={}) {
    const { type='square', vol=0.12, sustain=0.85, attack=0.008,
            release=null, vibrato=0, out=null } = opts;
    let t = t0;
    if (!musicaAtiva) return t;
    notas.forEach(([freq, dur]) => {
        if (freq > 0) _nota({ type, freq, vol, dur: dur*0.92, at:t, attack, sustain, release, vibrato, out });
        t += dur;
    });
    return t;
}

// Nota agendada com tempo absoluto (para música)
function _nota({ type='square', freq, vol, dur, at, freqEnd=null,
                 attack=0.008, release=null, sustain=0.85, vibrato=0, out=null }) {
    if (!ctx || !musicaAtiva || freq <= 0) return;
    const g = ctx.createGain();
    g.connect(out || musicaGain);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, at + dur);
    if (vibrato > 0) {
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 5.5; lg.gain.value = vibrato;
        lfo.connect(lg); lg.connect(osc.frequency);
        lfo.start(at); lfo.stop(at + dur);
    }
    const rel = release ?? Math.min(dur * 0.25, 0.10);
    const att = Math.min(attack, dur * 0.1);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + att);
    g.gain.setValueAtTime(vol * sustain, at + dur - rel);
    g.gain.linearRampToValueAtTime(0.00001, at + dur);
    osc.connect(g); osc.start(at); osc.stop(at + dur + 0.05);
    _oscs.push(osc);
}

// Kick (pitch descendente)
function _kick(at, vol=0.18) {
    if (!ctx || !musicaAtiva) return;
    const g = ctx.createGain(); g.connect(musicaGain);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(200, at);
    o.frequency.exponentialRampToValueAtTime(35, at + 0.18);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.00001, at + 0.25);
    o.connect(g); o.start(at); o.stop(at + 0.26);
    _oscs.push(o);
}

// Snare
function _snare(at, vol=0.10) {
    if (!ctx || !musicaAtiva) return;
    const len = Math.ceil(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type='bandpass'; flt.frequency.value=1200; flt.Q.value=0.9;
    const g   = ctx.createGain(); g.connect(musicaGain);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.00001, at+0.13);
    const o = ctx.createOscillator(); const og = ctx.createGain();
    o.type='triangle'; o.frequency.value=200;
    og.gain.setValueAtTime(vol*0.45, at); og.gain.exponentialRampToValueAtTime(0.00001, at+0.08);
    og.connect(musicaGain); o.connect(og); o.start(at); o.stop(at+0.09);
    src.connect(flt); flt.connect(g); src.start(at); src.stop(at+0.15);
    _oscs.push(src); _oscs.push(o);
}

// Hi-hat
function _hat(at, vol=0.035, dur=0.04) {
    if (!ctx || !musicaAtiva) return;
    const len = Math.ceil(ctx.sampleRate * (dur+0.01));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type='highpass'; flt.frequency.value=7000;
    const g   = ctx.createGain(); g.connect(musicaGain);
    g.gain.setValueAtTime(vol, at); g.gain.linearRampToValueAtTime(0.00001, at+dur);
    src.connect(flt); flt.connect(g); src.start(at); src.stop(at+dur+0.01);
    _oscs.push(src);
}

// Agenda bateria para N compassos de 4 beats
function _bateria(t0, compassos, { kick=[1,0,0,0], snare=[0,0,1,0], hatStep=HB, hatVol=0.035 }={}) {
    for (let c = 0; c < compassos; c++) {
        for (let b = 0; b < 4; b++) {
            const bt = t0 + c*4*B + b*B;
            if (kick[b])  _kick(bt);
            if (snare[b]) _snare(bt + B*0.5);
            for (let h = 0; h * hatStep < B - 0.001; h++) _hat(bt + h*hatStep, hatVol);
        }
    }
}

// Baixo — agenda 1 ciclo de 4 acordes (16 beats)
function _baixo(t0, vol=0.14, type='sawtooth') {
    PROG.forEach((freq, i) => {
        const t = t0 + i * PROG_DUR;
        // Nota principal
        _nota({ type, freq, vol, dur: PROG_DUR*0.9, at:t, attack:0.02, sustain:0.7 });
        // Oitava acima suave
        _nota({ type:'sine', freq:freq*2, vol:vol*0.4, dur: PROG_DUR*0.8, at:t+B, attack:0.03, sustain:0.6 });
        // Walking bass no 3º beat
        _nota({ type, freq:freq*1.5, vol:vol*0.55, dur:B*0.88, at:t+2*B, attack:0.01, sustain:0.6 });
    });
}

// Pad ambiente (fase 1)
function _pad(t0, vol=0.05) {
    PAD.forEach(([freq, dur]) => {
        const t = t0;
        _nota({ type:'sine',     freq,     vol,      dur, at:t, attack:0.8, sustain:0.9, release:1.5 });
        _nota({ type:'triangle', freq:freq*1.5, vol:vol*0.4, dur, at:t, attack:1.2, sustain:0.8, release:1.5 });
        t0 += dur;
    });
}

// ── LOOP PRINCIPAL ────────────────────────────────────────────────────────────
function _loopMusica() {
    if (!ctx || !musicaAtiva) return;

    const t0 = _now() + 0.05;

    // Duração de cada fase em beats
    const F1_B = 16;  // ~7s intro
    const F2_B = 32;  // ~14s desenvolvimento
    const F3_B = 32;  // ~14s clímax
    const F4_B = 16;  // ~7s resolução
    const TOTAL_B = F1_B + F2_B + F3_B + F4_B; // 96 beats ~ 41.7s a 138bpm

    let t = t0;

    // ── FASE 1: Introdução — pad + baixo suave + melodia entrando ─────────────
    const t_f2 = t + F1_B * B;
    _pad(t, 0.055);
    _baixo(t, 0.11, 'triangle');
    _bateria(t, 4, { kick:[1,0,0,0], snare:[0,0,0,0], hatStep:HB, hatVol:0.025 });
    // Melodia A entra no compasso 3 (suave)
    _seq(MEL_A, t + 8*B, { type:'triangle', vol:0.10, sustain:0.85, attack:0.02, vibrato:1.5 });

    // ── FASE 2: Desenvolvimento — melodia plena + contracanto ─────────────────
    t = t_f2;
    const t_f3 = t + F2_B * B;
    // 2 ciclos de baixo
    _baixo(t,         0.14, 'sawtooth');
    _baixo(t + 16*B,  0.15, 'sawtooth');
    // Melodia A e B
    _seq(MEL_A, t,        { type:'square',   vol:0.13, sustain:0.87, attack:0.008, vibrato:2 });
    _seq(MEL_B, t + 16*B, { type:'square',   vol:0.14, sustain:0.87, attack:0.008, vibrato:2 });
    // Contracanto
    _seq(CONTRA, t,        { type:'triangle', vol:0.08, sustain:0.7, attack:0.02 });
    _seq(CONTRA, t + 16*B, { type:'triangle', vol:0.09, sustain:0.7, attack:0.02 });
    // Bateria mais cheia
    _bateria(t, 8, { kick:[1,0,0,1], snare:[0,0,1,0], hatStep:QB, hatVol:0.04 });

    // ── FASE 3: Clímax — todas as camadas + stabs + energia máxima ────────────
    t = t_f3;
    const t_f4 = t + F3_B * B;
    // Baixo duplo (fundamental + sub)
    _baixo(t,        0.16, 'sawtooth');
    _baixo(t + 16*B, 0.16, 'sawtooth');
    // Baixo sub (oitava abaixo)
    PROG.forEach((freq, i) => {
        _nota({ type:'sine', freq:freq/2, vol:0.12, dur:PROG_DUR*0.95, at:t + i*PROG_DUR, attack:0.015, sustain:0.75 });
        _nota({ type:'sine', freq:freq/2, vol:0.12, dur:PROG_DUR*0.95, at:t + 16*B + i*PROG_DUR, attack:0.015, sustain:0.75 });
    });
    // Melodia A em oitava alta + sawtooth para mais punch
    _seq(MEL_A.map(([f,d])=>[f,d]), t,        { type:'sawtooth', vol:0.15, sustain:0.88, attack:0.006, vibrato:3 });
    _seq(MEL_A.map(([f,d])=>[f*2,d]), t,       { type:'square',   vol:0.08, sustain:0.85, attack:0.006 });
    _seq(MEL_B,                       t + 16*B, { type:'sawtooth', vol:0.13, sustain:0.88, attack:0.008, vibrato:2.5 });
    _seq(MEL_B.map(([f,d])=>[f*2,d]), t + 16*B,{ type:'square',   vol:0.07, sustain:0.82, attack:0.006 });
    // Stabs rítmicos
    _seq(STABS, t,        { type:'square', vol:0.14, sustain:0.45, attack:0.003, release:0.02 });
    _seq(STABS, t + 16*B, { type:'square', vol:0.15, sustain:0.45, attack:0.003, release:0.02 });
    // Contracanto em oitava alta
    _seq(CONTRA.map(([f,d])=>[f*2,d]), t,        { type:'triangle', vol:0.07, sustain:0.6, attack:0.015 });
    _seq(CONTRA.map(([f,d])=>[f*2,d]), t + 16*B, { type:'triangle', vol:0.08, sustain:0.6, attack:0.015 });
    // Bateria cheia
    _bateria(t, 8, { kick:[1,0,1,0], snare:[0,0,1,0], hatStep:QB, hatVol:0.05 });

    // ── FASE 4: Resolução — recua para clima, mas mantém energia ─────────────
    t = t_f4;
    _baixo(t, 0.12, 'triangle');
    _seq(MEL_A, t, { type:'triangle', vol:0.11, sustain:0.82, attack:0.02, vibrato:2 });
    _seq(CONTRA, t, { type:'sine',    vol:0.07, sustain:0.65, attack:0.03 });
    _pad(t, 0.06);
    _bateria(t, 4, { kick:[1,0,0,0], snare:[0,0,1,0], hatStep:HB, hatVol:0.028 });

    // ── PRÓXIMO LOOP ──────────────────────────────────────────────────────────
    const msTotal = TOTAL_B * B * 1000;
    setTimeout(() => {
        if (!musicaAtiva) return;
        _oscs = _oscs.filter(() => true); // limpa referências mortas
        _loopMusica();
    }, msTotal - 80);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── FANFARRA DE VITÓRIA ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export function tocarVitoria() {
    _ctx();
    pararMusica();

    setTimeout(() => {
        if (!ctx) return;
        const G = ctx.createGain(); G.gain.value = 0.55; G.connect(masterGain);
        const t = ctx.currentTime + 0.15;

        // Frequências para a fanfarra
        const Nv = N;

        // ── Fanfarra (trompete chiptune, square) ─────────────────────────────
        const fanfarra = [
            // Chamada heróica inicial
            [Nv.C5,QB*2],[Nv.C5,QB*2],[Nv.C5,QB*2],[Nv.E5,QB*3],[Nv.C5,QB],
            [Nv.E5,QB*2],[Nv.G5,QB*6],
            // Resposta triunfante
            [Nv.G5,QB*2],[Nv.A5,QB*2],[Nv.G5,QB*2],[Nv.F5,QB*2],
            [Nv.E5,QB*2],[Nv.D5,QB*2],[Nv.C5,QB*8],
            // Coda gloriosa
            [Nv.E5,QB*2],[Nv.G5,QB*2],[Nv.A5,QB*2],[Nv.C6,QB*8],
        ];

        // ── Harmonias de suporte (triângulo) ─────────────────────────────────
        const harm = [
            [[Nv.E4,Nv.G4,Nv.C5], QB*8],
            [[Nv.F4,Nv.A4,Nv.C5], QB*4],
            [[Nv.G4,Nv.B4,Nv.D5], QB*4],
            [[Nv.C4,Nv.E4,Nv.G4], QB*8],
            [[Nv.F4,Nv.A4,Nv.C5], QB*4],
            [[Nv.G4,Nv.B4,Nv.D5], QB*4],
            [[Nv.C4,Nv.E4,Nv.G4,Nv.C5], QB*8],
        ];

        // Agenda fanfarra principal
        let ft = t;
        fanfarra.forEach(([freq, dur]) => {
            if (freq <= 0) { ft += dur; return; }
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.type = 'square'; o.frequency.value = freq;
            g.connect(G);
            g.gain.setValueAtTime(0, ft);
            g.gain.linearRampToValueAtTime(0.28, ft + 0.012);
            g.gain.setValueAtTime(0.28, ft + dur - 0.04);
            g.gain.linearRampToValueAtTime(0, ft + dur);
            o.connect(g); o.start(ft); o.stop(ft + dur + 0.05);
            ft += dur;
        });

        // Agenda harmonias
        let ht = t;
        harm.forEach(([freqs, dur]) => {
            freqs.forEach(freq => {
                const o = ctx.createOscillator(); const g = ctx.createGain();
                o.type = 'triangle'; o.frequency.value = freq;
                g.connect(G);
                g.gain.setValueAtTime(0, ht);
                g.gain.linearRampToValueAtTime(0.07, ht + 0.03);
                g.gain.setValueAtTime(0.07, ht + dur - 0.08);
                g.gain.linearRampToValueAtTime(0, ht + dur);
                o.connect(g); o.start(ht); o.stop(ht + dur + 0.05);
            });
            ht += dur;
        });

        // Kicks em cada compasso
        [0, QB*8, QB*16, QB*24, QB*32].forEach(off => {
            const bt = t + off;
            const ko = ctx.createOscillator(); const kg = ctx.createGain();
            ko.type = 'sine';
            ko.frequency.setValueAtTime(200, bt);
            ko.frequency.exponentialRampToValueAtTime(35, bt + 0.18);
            kg.gain.setValueAtTime(0.30, bt);
            kg.gain.exponentialRampToValueAtTime(0.00001, bt + 0.25);
            kg.connect(masterGain); ko.connect(kg); ko.start(bt); ko.stop(bt + 0.26);
        });

        // Glitter final — campaninhas em cascata
        [Nv.C5,Nv.E5,Nv.G5,Nv.A5,Nv.C6,Nv.E6||Nv.C6*2].forEach((freq, i) => {
            const gt = t + QB*32 + i * QB * 1.8;
            const go = ctx.createOscillator(); const gg = ctx.createGain();
            go.type = 'sine'; go.frequency.value = freq * 2;
            gg.connect(G);
            gg.gain.setValueAtTime(0.14, gt);
            gg.gain.exponentialRampToValueAtTime(0.00001, gt + 0.65);
            go.connect(gg); go.start(gt); go.stop(gt + 0.7);
        });

        // Fade out da vitória
        const durTotal = QB * 44;
        G.gain.setValueAtTime(0.55, t + durTotal - QB*8);
        G.gain.linearRampToValueAtTime(0, t + durTotal);

    }, 1800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SUPORTE A ARQUIVOS REAIS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const _bufs = {};

async function _carregarBuf(path) {
    if (_bufs[path]) return _bufs[path];
    try {
        const r = await fetch(path); const a = await r.arrayBuffer();
        const b = await ctx.decodeAudioData(a); _bufs[path] = b; return b;
    } catch(e) { console.warn('[audio.js]', path, e); return null; }
}

function _arquivo(path, vol=1) {
    _ctx();
    _carregarBuf(path).then(buf => {
        if (!buf) return;
        const src = ctx.createBufferSource(); const g = ctx.createGain();
        g.gain.value = vol; src.buffer = buf;
        src.connect(g); g.connect(sfxGain); src.start();
    });
}

async function _arquivoLoop(path, vol=0.28) {
    _ctx();
    const buf = await _carregarBuf(path);
    if (!buf || !musicaAtiva) return;
    musicaGain.gain.setValueAtTime(vol, _now());
    musicaSource = ctx.createBufferSource();
    musicaSource.buffer = buf; musicaSource.loop = true;
    musicaSource.connect(musicaGain); musicaSource.start();
}

// ══════════════════════════════════════════════════════════════════════════════
//  BZERO-AUDIO.JS — Módulo de Áudio Procedural para B-Zero 64
//  Sons 100% Web Audio API · Zero arquivos externos
//  Ambiência espacial, não agressiva — clima F-Zero / WipeOut suave
//
//  EXPORTS:
//    bzAudio.init()               — inicia contexto (chamar no primeiro gesto)
//    bzAudio.motor(vel, velMax)   — som contínuo de motor (chamar todo frame)
//    bzAudio.tiro()               — laser do player
//    bzAudio.tiroIA()             — laser das IAs (tom diferente)
//    bzAudio.explosao(escala)     — explosão (0.0–1.0)
//    bzAudio.dano()               — player levou hit
//    bzAudio.volta()              — cruzou linha / nova volta
//    bzAudio.meteoro()            — meteoro passou perto
//    bzAudio.boost()              — ativou boost
//    bzAudio.ui(tipo)             — sons de interface: 'hover'|'click'|'countdown'|'go'
//    bzAudio.vitoria()            — jogador venceu
//    bzAudio.derrota()            — nave destruída
//    bzAudio.setPausa(bool)       — pausa/retoma todos os sons
//    bzAudio.setVolume(0–1)       — volume master
// ══════════════════════════════════════════════════════════════════════════════

const bzAudio = (() => {
    // ── Estado interno ────────────────────────────────────────────────────────
    let _ac      = null;   // AudioContext
    let _master  = null;   // GainNode master
    let _sfx     = null;   // GainNode SFX
    let _amb     = null;   // GainNode ambiente
    let _pronto  = false;
    let _pausado = false;
    let _vol     = 0.82;

    // Motor contínuo
    let _motorOsc1   = null;
    let _motorOsc2   = null;
    let _motorSub    = null;
    let _motorGain   = null;
    let _motorFilt   = null;
    let _motorAtivo  = false;

    // Osciladores de ambiente (drone, harm, shimmer, LFO) — precisam ser parados ao sair
    let _ambOscs     = [];
    let _ambAtivo    = false;

    // Cooldowns para evitar spam
    let _cdTiro    = 0;
    let _cdDano    = 0;
    let _cdVolta   = 0;
    let _cdMeteoro = 0;
    let _cdBoost   = 0;
    const _agora   = () => _ac ? _ac.currentTime : 0;

    // ── Inicialização ─────────────────────────────────────────────────────────
    function init() {
        if (_pronto) return;
        try {
            _ac     = new (window.AudioContext || window.webkitAudioContext)();
            _master = _ac.createGain(); _master.gain.value = _vol;
            _master.connect(_ac.destination);

            _sfx = _ac.createGain(); _sfx.gain.value = 1.0;
            _sfx.connect(_master);

            _amb = _ac.createGain(); _amb.gain.value = 0.42;
            _amb.connect(_master);

            _pronto = true;
            _iniciarAmb();
        } catch(e) {
            console.warn('[bzero-audio] Falha ao criar AudioContext:', e);
        }
    }

    // ── Primitivos ────────────────────────────────────────────────────────────
    function _osc({ type='sine', freq=220, freqEnd=null, vol=0.15, dur=0.2,
                    delay=0, attack=0.005, release=null, sustain=0.85, out=null }) {
        if (!_pronto) return null;
        const ac = _ac, t = ac.currentTime + delay;
        const g  = ac.createGain();
        g.connect(out || _sfx);
        const o  = ac.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (freqEnd !== null) {
            o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 10), t + dur);
        }
        const rel = release ?? dur * 0.28;
        const att = Math.min(attack, dur * 0.12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + att);
        g.gain.setValueAtTime(vol * sustain, t + dur - rel);
        g.gain.linearRampToValueAtTime(0.00001, t + dur);
        o.connect(g); o.start(t); o.stop(t + dur + 0.02);
        return o;
    }

    function _noise({ vol=0.08, dur=0.3, delay=0, fFreq=800, fType='lowpass',
                      attack=0.006, release=null, out=null }) {
        if (!_pronto) return;
        const ac = _ac, t = ac.currentTime + delay;
        const len = Math.ceil(ac.sampleRate * (dur + 0.05));
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(); src.buffer = buf;
        const flt = ac.createBiquadFilter(); flt.type = fType; flt.frequency.value = fFreq;
        const g   = ac.createGain(); g.connect(out || _sfx);
        const rel = release ?? dur * 0.35;
        const att = Math.min(attack, dur * 0.06);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + att);
        g.gain.setValueAtTime(vol, t + dur - rel);
        g.gain.linearRampToValueAtTime(0.00001, t + dur);
        src.connect(flt); flt.connect(g);
        src.start(t); src.stop(t + dur + 0.05);
    }

    // ── Ambiente espacial ─────────────────────────────────────────────────────
    // Fundo suave: drone profundo + shimmer de estrelas + ruído côsmico filtrado
    // Tudo muito baixo na mix — só "preenche" o espaço
    function _iniciarAmb() {
        if (!_pronto || _ambAtivo) return;
        _ambAtivo = true;

        // Drone sub-grave (55 Hz) — pulsa muito lentamente
        const drone = _ac.createOscillator();
        const droneG = _ac.createGain();
        const droneFilt = _ac.createBiquadFilter();
        drone.type = 'sine'; drone.frequency.value = 55;
        droneFilt.type = 'lowpass'; droneFilt.frequency.value = 120; droneFilt.Q.value = 0.8;
        droneG.gain.value = 0.14;
        drone.connect(droneFilt); droneFilt.connect(droneG); droneG.connect(_amb);
        drone.start();
        _ambOscs.push(drone);

        // LFO suave no drone (0.08 Hz — ciclo de ~12s)
        const lfoD = _ac.createOscillator();
        const lfoGD = _ac.createGain();
        lfoD.frequency.value = 0.08; lfoGD.gain.value = 4;
        lfoD.connect(lfoGD); lfoGD.connect(drone.frequency);
        lfoD.start();
        _ambOscs.push(lfoD);

        // Segunda harmônica suave (110 Hz)
        const harm2 = _ac.createOscillator();
        const harm2G = _ac.createGain();
        harm2.type = 'triangle'; harm2.frequency.value = 110;
        harm2G.gain.value = 0.04;
        harm2.connect(harm2G); harm2G.connect(_amb);
        harm2.start();
        _ambOscs.push(harm2);

        // Shimmer etéreo — sine suave em frequência média-alta
        const shimmer = _ac.createOscillator();
        const shimmG  = _ac.createGain();
        shimmer.type = 'sine'; shimmer.frequency.value = 880;
        shimmG.gain.value = 0.008;
        shimmer.connect(shimmG); shimmG.connect(_amb);
        shimmer.start();
        _ambOscs.push(shimmer);

        // Ruído côsmico — filtrado passa-baixo suavíssimo
        function _gerarRuidoCosm() {
            if (!_pronto || !_ac || !_ambAtivo) return;
            const dur = 8.5;
            const len = Math.ceil(_ac.sampleRate * dur);
            const buf = _ac.createBuffer(1, len, _ac.sampleRate);
            const dd  = buf.getChannelData(0);
            for (let i = 0; i < len; i++) dd[i] = Math.random() * 2 - 1;
            const src = _ac.createBufferSource(); src.buffer = buf;
            const flt = _ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 180;
            const g   = _ac.createGain(); g.gain.value = 0.028;
            src.connect(flt); flt.connect(g); g.connect(_amb);
            const t = _ac.currentTime;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.028, t + 0.6);
            g.gain.setValueAtTime(0.028, t + dur - 0.8);
            g.gain.linearRampToValueAtTime(0, t + dur);
            src.start(t); src.stop(t + dur);
            setTimeout(_gerarRuidoCosm, (dur - 0.9) * 1000);
        }
        _gerarRuidoCosm();
    }

    // ── Motor da nave ─────────────────────────────────────────────────────────
    // Dois osciladores (fundamental + harmônica) com filtro passa-banda
    // Frequência e timbre mudam de acordo com velocidade
    function _iniciarMotor() {
        if (!_pronto || _motorAtivo) return;
        _motorAtivo = true;

        const ac = _ac;
        _motorGain = ac.createGain();
        _motorGain.gain.value = 0;
        _motorFilt = ac.createBiquadFilter();
        _motorFilt.type = 'bandpass';
        _motorFilt.frequency.value = 200;
        _motorFilt.Q.value = 1.4;

        // Fundamental
        _motorOsc1 = ac.createOscillator();
        _motorOsc1.type = 'sawtooth';
        _motorOsc1.frequency.value = 80;

        // Harmônica (quinta acima)
        _motorOsc2 = ac.createOscillator();
        _motorOsc2.type = 'square';
        _motorOsc2.frequency.value = 120;

        // Sub-grave (oitava abaixo, bem suave)
        _motorSub = ac.createOscillator();
        _motorSub.type = 'sine';
        _motorSub.frequency.value = 40;

        const subG = ac.createGain(); subG.gain.value = 0.3;
        _motorSub.connect(subG);

        _motorOsc1.connect(_motorFilt);
        _motorOsc2.connect(_motorFilt);
        subG.connect(_motorGain);
        _motorFilt.connect(_motorGain);
        _motorGain.connect(_sfx);

        _motorOsc1.start();
        _motorOsc2.start();
        _motorSub.start();
    }

    function motor(velAtual, velMax) {
        if (!_pronto) return;
        if (!_motorAtivo) _iniciarMotor();
        if (!_motorOsc1) return;

        const ratio = Math.max(0.05, Math.min(1.0, velAtual / velMax));
        const t = _ac.currentTime;

        // Frequência fundamental: 80 Hz parado → 320 Hz velocidade máxima
        const freqBase = 80 + ratio * 240;
        _motorOsc1.frequency.setTargetAtTime(freqBase,         t, 0.18);
        _motorOsc2.frequency.setTargetAtTime(freqBase * 1.52,  t, 0.18);
        _motorSub.frequency.setTargetAtTime (freqBase * 0.50,  t, 0.18);

        // Filtro: abre à medida que acelera
        _motorFilt.frequency.setTargetAtTime(150 + ratio * 800, t, 0.12);
        _motorFilt.Q.setTargetAtTime(1.4 + ratio * 1.8,         t, 0.12);

        // Volume: mais audível em velocidade alta
        const vol = 0.06 + ratio * 0.16;
        _motorGain.gain.setTargetAtTime(vol, t, 0.10);
    }

    // ── Tiro do player ────────────────────────────────────────────────────────
    // Tom médio-grave, "fwomp" techno — nada estridente
    function tiro() {
        if (!_pronto) return;
        const n = _agora();
        if (n - _cdTiro < 0.08) return;
        _cdTiro = n;

        // Pulso principal — descida rápida de tom
        _osc({ type:'triangle', freq:420, freqEnd:180, vol:0.18, dur:0.11, attack:0.003, sustain:0.7 });
        // Harmônica mais suave
        _osc({ type:'sine',    freq:280, freqEnd:140, vol:0.08, dur:0.09, attack:0.003, delay:0.005 });
        // Transiente curto de ruído (textura)
        _noise({ vol:0.06, dur:0.04, fFreq:2400, fType:'bandpass', attack:0.002 });
    }

    // ── Tiro das IAs ─────────────────────────────────────────────────────────
    // Tom diferente — mais grave e "rouco" para distinguir do player
    function tiroIA() {
        if (!_pronto) return;
        _osc({ type:'sawtooth', freq:200, freqEnd:80, vol:0.09, dur:0.10, attack:0.004 });
        _noise({ vol:0.04, dur:0.05, fFreq:900, fType:'bandpass', attack:0.003 });
    }

    // ── Explosão ──────────────────────────────────────────────────────────────
    // Boom profundo com rumble — escala com tamanho do meteoro/nave
    function explosao(escala = 0.5) {
        if (!_pronto) return;
        const s = Math.max(0.15, Math.min(1.0, escala));
        const vol  = 0.14 + s * 0.22;
        const dur  = 0.25 + s * 0.45;

        // Kick/boom — descida de frequência rápida
        _osc({ type:'sine', freq:120 + s*60, freqEnd:28, vol:vol*1.1, dur:dur*0.75, attack:0.003, sustain:0.4 });
        // Rumble de baixo (mais longo)
        _osc({ type:'sine', freq:55, freqEnd:22, vol:vol*0.55, dur:dur, attack:0.005, sustain:0.25 });
        // Crack inicial
        _noise({ vol:vol*0.8, dur:0.07, fFreq:3000, fType:'bandpass', attack:0.002 });
        // Debris (ruído filtrado que dura mais)
        _noise({ vol:vol*0.45, dur:dur*0.7, fFreq:600 + s*400, attack:0.008, release:dur*0.5 });
    }

    // ── Dano recebido ─────────────────────────────────────────────────────────
    // "Thunk" de impacto + alerta grave — não agudo
    function dano() {
        if (!_pronto) return;
        const n = _agora();
        if (n - _cdDano < 0.20) return;
        _cdDano = n;

        _osc({ type:'square', freq:160, freqEnd:80,  vol:0.22, dur:0.20, attack:0.003, sustain:0.6 });
        _osc({ type:'sine',   freq:280, freqEnd:140, vol:0.10, dur:0.14, attack:0.003, delay:0.03 });
        _noise({ vol:0.10, dur:0.12, fFreq:1000, fType:'bandpass', attack:0.004 });
    }

    // ── Nova volta ────────────────────────────────────────────────────────────
    // Arpejo ascendente curto — positivo sem ser excessivo
    function volta() {
        if (!_pronto) return;
        const n = _agora();
        if (n - _cdVolta < 1.0) return;
        _cdVolta = n;

        const notas = [330, 415, 523, 659]; // E4-G#4-C5-E5
        notas.forEach((f, i) => {
            _osc({ type:'triangle', freq:f, vol:0.14, dur:0.18, delay:i*0.075, attack:0.01, sustain:0.75 });
            // Brilho sutil na oitava acima
            _osc({ type:'sine', freq:f*2, vol:0.04, dur:0.12, delay:i*0.075+0.02 });
        });
    }

    // ── Meteoro (aviso de proximidade) ────────────────────────────────────────
    // Whoosh descendente + rumble — nada estridente
    function meteoro() {
        if (!_pronto) return;
        const n = _agora();
        if (n - _cdMeteoro < 0.40) return;
        _cdMeteoro = n;

        _osc({ type:'sawtooth', freq:320, freqEnd:60, vol:0.12, dur:0.28, attack:0.01, sustain:0.55 });
        _noise({ vol:0.07, dur:0.22, fFreq:500, fType:'lowpass', attack:0.005 });
    }

    // ── Boost ─────────────────────────────────────────────────────────────────
    // Subida de energia — whine ascendente suave
    function boost() {
        if (!_pronto) return;
        const n = _agora();
        if (n - _cdBoost < 0.35) return;
        _cdBoost = n;

        _osc({ type:'sawtooth', freq:150, freqEnd:480, vol:0.15, dur:0.30, attack:0.02, sustain:0.65 });
        _osc({ type:'sine',     freq:220, freqEnd:660, vol:0.07, dur:0.25, attack:0.02, delay:0.03 });
        _noise({ vol:0.05, dur:0.20, fFreq:4000, fType:'highpass', attack:0.01 });
    }

    // ── Sons de UI ────────────────────────────────────────────────────────────
    function ui(tipo) {
        if (!_pronto) return;
        if (tipo === 'hover') {
            _osc({ type:'sine', freq:660, freqEnd:880, vol:0.06, dur:0.08, attack:0.005 });
        } else if (tipo === 'click') {
            _osc({ type:'triangle', freq:440, freqEnd:330, vol:0.10, dur:0.10, attack:0.003 });
            _noise({ vol:0.04, dur:0.05, fFreq:3000, fType:'highpass', attack:0.002 });
        } else if (tipo === 'countdown') {
            // Tick grave — como relógio analógico
            _osc({ type:'triangle', freq:280, freqEnd:220, vol:0.18, dur:0.14, attack:0.004, sustain:0.5 });
            _noise({ vol:0.07, dur:0.06, fFreq:2000, fType:'bandpass', attack:0.003 });
        } else if (tipo === 'go') {
            // "GO!" — acorde energético ascendente
            const notas = [330, 523, 660, 880];
            notas.forEach((f, i) => {
                _osc({ type:'square',   freq:f, vol:0.14, dur:0.45-i*0.05, delay:i*0.04, attack:0.006, sustain:0.7 });
                _osc({ type:'triangle', freq:f, vol:0.06, dur:0.30,         delay:i*0.04+0.02 });
            });
            _noise({ vol:0.10, dur:0.12, fFreq:4000, fType:'highpass', attack:0.003 });
        }
    }

    // ── Vitória ───────────────────────────────────────────────────────────────
    // Fanfarra compacta, heroica — 3 acordes brilhantes
    function vitoria() {
        if (!_pronto) return;

        const G = _ac.createGain(); G.gain.value = 0.50; G.connect(_master);
        const t = _ac.currentTime + 0.1;
        const QB = 0.14; // quarter-beat rápido

        // Chamada principal (square — chiptune heroico)
        const mel = [
            [523,QB*2],[523,QB],[659,QB*3],
            [523,QB],[659,QB],[784,QB*6],
            [784,QB],[880,QB],[784,QB],[698,QB],
            [659,QB*2],[523,QB*8],
        ];
        let mt = t;
        mel.forEach(([freq,dur]) => {
            const o = _ac.createOscillator(); const g = _ac.createGain();
            o.type='square'; o.frequency.value=freq; g.connect(G);
            g.gain.setValueAtTime(0,mt);
            g.gain.linearRampToValueAtTime(0.24,mt+0.01);
            g.gain.setValueAtTime(0.24,mt+dur-0.04);
            g.gain.linearRampToValueAtTime(0,mt+dur);
            o.connect(g); o.start(mt); o.stop(mt+dur+0.02);
            mt+=dur;
        });

        // Harmonia de suporte (triangle — suave)
        const harm = [[330,QB*6],[392,QB*6],[392,QB*14]];
        let ht = t;
        harm.forEach(([freq,dur]) => {
            const o=_ac.createOscillator(); const g=_ac.createGain();
            o.type='triangle'; o.frequency.value=freq; g.connect(G);
            g.gain.setValueAtTime(0,ht);
            g.gain.linearRampToValueAtTime(0.07,ht+0.04);
            g.gain.setValueAtTime(0.07,ht+dur-0.08);
            g.gain.linearRampToValueAtTime(0,ht+dur);
            o.connect(g); o.start(ht); o.stop(ht+dur+0.02);
            ht+=dur;
        });

        // Kicks
        [0, QB*8].forEach(off => {
            const bt=t+off;
            const ko=_ac.createOscillator(); const kg=_ac.createGain();
            ko.type='sine';
            ko.frequency.setValueAtTime(180,bt);
            ko.frequency.exponentialRampToValueAtTime(32,bt+0.16);
            kg.gain.setValueAtTime(0.28,bt);
            kg.gain.exponentialRampToValueAtTime(0.00001,bt+0.22);
            kg.connect(G); ko.connect(kg); ko.start(bt); ko.stop(bt+0.23);
        });

        // Fade out
        const durTotal = QB * 28;
        G.gain.setValueAtTime(0.50, t+durTotal-QB*6);
        G.gain.linearRampToValueAtTime(0, t+durTotal);
    }

    // ── Derrota / Game Over ───────────────────────────────────────────────────
    // Tom descendente sombrio — curto e não perturbador
    function derrota() {
        if (!_pronto) return;

        const G = _ac.createGain(); G.gain.value = 0.45; G.connect(_master);
        const t = _ac.currentTime + 0.15;
        const QB = 0.18;

        // Descida cromática
        const notas = [392, 349, 311, 261];
        let nt = t;
        notas.forEach((freq, i) => {
            const o=_ac.createOscillator(); const g=_ac.createGain();
            o.type='triangle'; o.frequency.value=freq; g.connect(G);
            g.gain.setValueAtTime(0,nt);
            g.gain.linearRampToValueAtTime(0.18,nt+0.02);
            g.gain.setValueAtTime(0.18,nt+QB*1.8-0.05);
            g.gain.linearRampToValueAtTime(0,nt+QB*2);
            o.connect(g); o.start(nt); o.stop(nt+QB*2+0.02);
            nt += QB * (i < 3 ? 1.5 : 3);
        });

        // Ruído de "sistema falhou"
        setTimeout(() => {
            _noise({ vol:0.12, dur:0.40, fFreq:300, fType:'lowpass', attack:0.01 });
        }, 600);

        const durTotal = QB * 10;
        G.gain.setValueAtTime(0.45, t+durTotal-0.5);
        G.gain.linearRampToValueAtTime(0, t+durTotal);
    }

    // ── Parar ambiente (fade out e stop dos osciladores contínuos) ───────────
    function pararAmb() {
        _ambAtivo = false;
        // Fade out do gain de ambiente
        if (_amb && _ac) {
            const t = _ac.currentTime;
            _amb.gain.cancelScheduledValues(t);
            _amb.gain.setValueAtTime(_amb.gain.value, t);
            _amb.gain.linearRampToValueAtTime(0, t + 0.8);
        }
        // Para todos os osciladores de ambiente após o fade
        setTimeout(() => {
            _ambOscs.forEach(o => { try { o.stop(); } catch(e) {} });
            _ambOscs = [];
        }, 900);
    }

    // ── Parar motor (fade out suave) ──────────────────────────────────────────
    function pararMotor() {
        if (!_pronto || !_motorGain) return;
        const t = _ac.currentTime;
        _motorGain.gain.setTargetAtTime(0, t, 0.25); // fade em ~0.75s
        _motorAtivo = false;
        // Depois de 2s, desconecta os osciladores para liberar recursos
        setTimeout(() => {
            try { _motorOsc1 && _motorOsc1.stop(); } catch(e){}
            try { _motorOsc2 && _motorOsc2.stop(); } catch(e){}
            try { _motorSub  && _motorSub.stop();  } catch(e){}
            _motorOsc1 = null; _motorOsc2 = null; _motorSub = null;
            _motorGain = null; _motorFilt = null;
        }, 2000);
    }

    // ── Resetar motor (para jogar de novo) ───────────────────────────────────
    // Para o motor e ambiente atual e permite reiniciar tudo
    function resetar() {
        pararMotor();
        pararAmb();
        // Zera os cooldowns para evitar silêncio no início da nova partida
        _cdTiro = 0; _cdDano = 0; _cdVolta = 0; _cdMeteoro = 0; _cdBoost = 0;
    }

    // ── Controles gerais ──────────────────────────────────────────────────────
    function setPausa(pausa) {
        if (!_pronto) return;
        _pausado = pausa;
        if (pausa) {
            _ac.suspend().catch(()=>{});
        } else {
            _ac.resume().catch(()=>{});
        }
    }

    function setVolume(v) {
        _vol = Math.max(0, Math.min(1, v));
        if (_master) _master.gain.setTargetAtTime(_vol, _ac.currentTime, 0.05);
    }

    // ── API pública ───────────────────────────────────────────────────────────
    return { init, motor, pararMotor, pararAmb, resetar, tiro, tiroIA, explosao, dano, volta, meteoro, boost, ui, vitoria, derrota, setPausa, setVolume };
})();

export { bzAudio };
