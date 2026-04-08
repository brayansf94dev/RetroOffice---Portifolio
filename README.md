# BRAYAN_OS — Portfolio Interativo 3D

> Um portfólio pessoal imersivo construído com Three.js, CSS3DRenderer, Web Audio API e dois jogos embutidos — tudo rodando no browser, sem backend, sem build step.

---

## Visão Geral

**BRAYAN_OS** simula um desktop retrô com estética Windows XP / N64, renderizado em tempo real via WebGL. O visitante interage com um computador 3D dentro de uma cena espacial, assiste cutscenes com diálogos narrativos, joga um space shooter de 10 ondas (**jogo.js**) e um jogo de corrida espacial com física de pista spline (**bzero64.js**), enquanto navega pelos projetos do portfólio dentro de uma janela de sistema operacional animada.

```
┌─────────────────────────────────────────────────────────────┐
│                  BRAYAN_OS — Arquitetura                    │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  WebGL Scene        │  │  CSS3D Overlay Scene         │  │
│  │  (THREE.WebGLRend.) │◄─┤  (CSS3DRenderer — DOM real)  │  │
│  └────────┬────────────┘  └──────────────────────────────┘  │
│           │ requestAnimationFrame                           │
│  ┌────────▼────────────────────────────────────────────┐   │
│  │  main.js — Orquestrador + Loop de Animação          │   │
│  └──┬──────┬──────┬──────┬──────┬──────┬──────┬───────┘   │
│     │      │      │      │      │      │      │            │
│  tela   jogo  bzero  musica camera cenario comp  audio      │
│  .js    .js   64.js   .js   .js    .js   .js   .js         │
└─────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

```
/
├── index.html          # Ponto de entrada — monta o DOM base
├── style.css           # Estilos globais (estética XP, CRT, overlay)
├── main.js             # Orquestrador principal — loop, estados, portfólio
├── tela.js             # CSS3D: tela do monitor (DOM dentro do 3D)
├── computador.js       # Modelo 3D do computador (gabinete, monitor, drives)
├── cenario.js          # Sistema de estrelas (BufferGeometry) e esquadrão
├── camera.js           # Gerenciamento de modos de câmera (4 modos)
├── controles.js        # OrbitControls — interação orbital do usuário
├── jogo.js             # Game engine — space shooter com 10 ondas
├── bzero64.js          # Jogo de corrida espacial (pista spline 3D)
├── musica.js           # Music player YouTube com Modo Câmera cinematic
├── audio.js            # Web Audio API — SFX + música tema procedurais
└── imagens.js          # Assets de personagens em base64
```

---

## Módulos em Detalhe

### `main.js` — Orquestrador

O arquivo central que cria as duas cenas simultâneas, o loop de animação e gerencia todos os estados globais. Também embute os dados de conteúdo dos projetos (`dadosSobre`) como objetos JS puros, sem API externa.

**Padrão de inicialização:**
```js
const scene       = new THREE.Scene();          // Cena WebGL
const cssScene    = new THREE.Scene();          // Cena CSS3D (DOM)
const renderer    = new THREE.WebGLRenderer();  // GPU pipeline
const cssRenderer = new CSS3DRenderer();        // DOM projetado em 3D

// Ambos os renderers empilhados no mesmo container
// WebGL (z-index: 1) — renderizado sobre o CSS3D (z-index: 0)
```

**Estados globais exportados:**
```js
export let modoDialogo = false;   // Câmera focada em nave durante diálogo
export let naveFalando = null;    // Referência à nave que está falando
```

---

### `computador.js` — Modelo 3D

Constrói o computador inteiramente com geometrias primitivas Three.js — sem arquivos `.glb` ou `.obj`. O modelo usa hierarquia de objetos, onde a tela e os botões do monitor são **filhos** do mesh do monitor, herdando sua posição e rotação automaticamente.

**Hierarquia de objetos:**
```
pcGroup (THREE.Group)
├── pcCase        (BoxGeometry)       — Gabinete principal
├── monitorBase   (CylinderGeometry)  — Base cilíndrica do monitor
├── monitorNeck   (CylinderGeometry)  — Pescoço
├── monitor       (BoxGeometry)       — Corpo do monitor
│   ├── screen    (PlaneGeometry)     — Tela (alvo do CSS3DObject)
│   ├── powerBtn  (BoxGeometry)       — Botão de power
│   └── monitorBtnGroup (Group)       — Fileira de botões de ajuste
├── floppyGroup   (Group)             — Drive de disquete + fenda + ejetor
├── powerGroup    (Group)             — Botão power + LEDs verde/laranja
├── cdGroup       (Group)             — Drive CD-ROM + fenda + botão
├── ventGroup     (Group)             — 8 ranhuras de ventilação lateral
└── badge         (BoxGeometry)       — Plaqueta metálica frontal
```

**Por que geometrias primitivas?** Zero dependências de assets externos, carregamento instantâneo, demonstração de domínio de composição 3D manual, e possibilidade de animar ou modificar qualquer parte via código.

---

### `cenario.js` — Cena Espacial

**Sistema de estrelas com `BufferGeometry` (15.000 pontos):**
```js
export function criarEstrelas() {
    const vertices = [];
    for (let i = 0; i < 15000; i++) {
        vertices.push(
            THREE.MathUtils.randFloatSpread(600),  // X: -300 a +300
            THREE.MathUtils.randFloatSpread(600),  // Y
            THREE.MathUtils.randFloatSpread(600)   // Z
        );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.8, sizeAttenuation: true }));
}
```

Uma única draw call GPU para 15.000 estrelas — esta é a vantagem do `BufferGeometry` com `Points` sobre criar 15.000 meshes individuais.

**Esquadrão de naves:**
- 4 naves com `ConeGeometry`, cada uma com cor e `PointLight` embutida
- Iniciam com `opacity: 0` e `transparent: true` — aparecem gradualmente
- Cada nave tem velocidade aleatória para movimento orgânico

---

### `controles.js` — OrbitControls

Encapsula a configuração do `OrbitControls` com `enableDamping` para movimento com inércia. Os limites de distância são redefinidos dinamicamente por `camera.js` conforme o modo ativo.

```js
export function configurarControles(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;   // Movimento com inércia suave
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);    // Ponto de orbita acima do chão
    controls.minDistance = 2;
    controls.maxDistance = 12;       // Redefinido por camera.js no modo livre
    return controls;
}
```

---

### `camera.js` — Modos de Câmera

Gerencia 4 modos com transições suaves via `lerp()`:

| Modo | Ativação | Comportamento |
|------|----------|---------------|
| `deriva` | Carregamento inicial | Órbita sinusoidal automática; transita para `foco` após 2.5s |
| `foco` | Click no monitor / botão Voltar | Câmera vai via lerp para frente do computador |
| `livre` | Abertura do portfólio | Voo animado para posição padrão, depois entrega ao OrbitControls |
| `jogo` | Início de qualquer jogo | OrbitControls desativado; câmera controlada pela engine do jogo |

**Callback de conclusão de animação:**
```js
// Dispara quando a câmera chega à posição-alvo no modo livre
function alternarModo('livre', () => {
    // Chamado quando distanceTo(posicaoLivre) < 0.25
    abrirPortfolio();
});
```

---

### `tela.js` — CSS3D no Monitor

Injeta um **elemento DOM real** com efeito CRT animado dentro do espaço 3D via `CSS3DObject`. Os botões permanecem clicáveis porque o renderer cria uma camada DOM espelhada com `transform: matrix3d(...)`.

**Cálculo de escala:**
```
escala = tamanho_desejado_em_unidades_de_mundo / tamanho_da_div_em_pixels
1.6 unidades / 1024 px = 0.001562
```

```js
const objetoCSS = new CSS3DObject(div);
objetoCSS.scale.set(0.00155, 0.00155, 0.00155);
objetoCSS.position.set(0, 1.83, 0.52);  // Alinhado com screen PlaneGeometry
objetoCSS.rotation.x = -0.05;            // Igual ao monitor
```

---

### `jogo.js` — Space Shooter

Engine completa com física AABB, HUD dinâmico, upgrades e narrativa com cutscenes.

**Sistema de upgrades por onda:**

| Onda | Upgrade | Mecânica |
|------|---------|----------|
| 3 | Hyper Beam | 1 uso — destrói todos os inimigos na tela |
| 5+ | Twin Laser | Permanente — dispara dois lasers em paralelo |

**Detecção de colisão:**
```js
const boxL = new THREE.Box3().setFromObject(laser);
const boxM = new THREE.Box3().setFromObject(meteoro);
if (boxL.intersectsBox(boxM)) { /* impacto */ }
```

**Cutscenes pausam o spawn:**
```js
function exibirDialogo(linhas, onFim) {
    cutscenePausa = true;   // Para spawning de meteoros
    // ... exibe diálogo linha a linha ...
    cutscenePausa = false;  // Retoma ao terminar
    if (onFim) onFim();
}
```

---

### `bzero64.js` — Jogo de Corrida Espacial

O módulo mais extenso (~2.000 linhas). Implementa um jogo estilo F-Zero com pista 3D spline, IAs com IA behavior, combate, diálogos e múltiplos modos de câmera.

**Pista via `CatmullRomCurve3`:**
```js
// 30 pontos de controle → oval ~900u com 2 loops verticais de 70u de raio
const PISTA_CURVE = new THREE.CatmullRomCurve3(pontos, true, 'catmullrom', 0.5);

// Qualquer ponto na pista com t ∈ [0, 1]:
function pistaPos(t, latOffset = 0) {
    const pos  = PISTA_CURVE.getPointAt(t);
    const tang = PISTA_CURVE.getTangentAt(t).normalize();
    const lat  = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0,1,0)).normalize();
    return pos.clone().addScaledVector(lat, latOffset); // deslocamento lateral para IAs
}
```

**Modos de câmera do jogo:**
- `normal` — perseguidora atrás/acima da nave
- `chase` — mais próxima e baixa (tecla `V`)
- `fp` — primeira pessoa, mesh do player oculto

**Dificuldade:**
```js
const DIFF_CFG = {
    facil:   { iaVelMult: 0.80, iaDanoMult: 0.50, iaCadencia: 90 },
    normal:  { iaVelMult: 1.00, iaDanoMult: 1.00, iaCadencia: 55 },
    dificil: { iaVelMult: 1.22, iaDanoMult: 1.60, iaCadencia: 32 },
};
```

**Integração com `main.js`:**
```js
import { iniciarBZero64, atualizarBZero64, isBZeroAtivo } from './bzero64.js';

// No loop de animação:
if (isBZeroAtivo()) atualizarBZero64();
```

---

### `musica.js` — Music Player

Janela flutuante arrastável (drag & drop) com visual Windows XP, playlist configurável e Modo Câmera cinematic sincronizado.

**Como adicionar músicas:**
```js
const PLAYLIST = [
    { id: 'sQ6f9tFbWNA', titulo: 'Nintendo 64 LoFi', canal: 'LoFi Mix', emoji: '🎮' },
    // Cole o ID de: youtube.com/watch?v=XXXXXXXXXX
    { id: 'SEU_VIDEO_ID', titulo: 'Nome', canal: 'Canal', emoji: '🎵' },
];
```

---

### `audio.js` — Engine de Áudio Procedural

Dois sistemas de áudio no mesmo arquivo — zero arquivos de som externos.

**Sistema 1 — SFX do Space Shooter** (exports individuais):
```js
export function tocarTiro()        // Sawtooth 900→380 Hz + shimmer
export function tocarTiroUpgrade() // Twin: dois osciladores em detuning
export function tocarTiroHyper()   // Sawtooth 110Hz + square + noise
export function tocarExplosao(tam) // Noise buffer + sine descendente
export function tocarDano()        // Square descendente + noise
export function tocarVitoria()     // Fanfarra chiptune (melodia schedulada)
export function iniciarMusica()    // Música tema 4 fases ~90s em loop
```

**Sistema 2 — `bzAudio` (IIFE para bzero64.js):**
```js
// Motor de nave em loop contínuo + cooldowns por SFX
export const bzAudio = (() => {
    return { init, motor, pararMotor, tiro, tiroIA, explosao,
             dano, volta, meteoro, boost, ui, vitoria, derrota };
})();
```

**Hierarquia de ganho (AudioContext):**
```
destination
└── masterGain (0.8) — controle global / mute
     ├── sfxGain (1.0)    — SFX do jogo
     └── musicaGain (0.28) — música tema procedural
```

**Música tema:** progressão Am7–Fmaj7–C–G, BPM 138, 4 fases em loop incluindo melodia A, melodia B, contracanto, stabs rítmicos e pad espacial — tudo sintetizado via `OscillatorNode` agendados com `AudioContext.currentTime`.

---

## Como Replicar Esta Arquitetura

### Pré-requisitos

```bash
# ES Modules exigem HTTP — não abra index.html via file://
npx serve .            # Node.js
python -m http.server  # Python
```

### Checklist CSS3D + WebGL

```js
// 1. Dois renderers no mesmo container
renderer.domElement.style.cssText    = 'position:absolute;top:0;left:0;z-index:1';
cssRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;z-index:0;pointer-events:none';

// 2. Escala da div
// escala = unidades_de_mundo / pixels_da_div
const obj = new CSS3DObject(minhaDiv);
obj.scale.setScalar(larguraMundo / larguraPixels);

// 3. Alinhar com mesh WebGL
obj.position.copy(meshAlvo.getWorldPosition(new THREE.Vector3()));

// 4. Loop com MESMA câmera
renderer.render(scene, camera);
cssRenderer.render(cssScene, camera);
```

### Adicionar Projeto ao Portfólio

Em `main.js`:
```js
"meu-projeto": { titulo: "Título", html: `<h3>Seção</h3><p>Descrição...</p>` }
```

Em `index.html`:
```html
<button class="proj-about-btn" data-project="meu-projeto">Ver Detalhes</button>
```

### Adicionar Nova Pista ao B-Zero 64

Em `bzero64.js`, substitua `_SPLINE_RAW_3D` com novos pontos `[x, y, z]`. A `CatmullRomCurve3` interpolará automaticamente. Use `closed: true` para circuito fechado.

---

## Decisões Técnicas

| Decisão | Alternativa | Justificativa |
|---------|-------------|---------------|
| CSS3DRenderer para tela | Textura canvas/vídeo | Preserva eventos DOM nativos (click, hover) |
| Web Audio API procedural | Arquivos .mp3/.ogg | Zero latência, zero assets, zero licença |
| ES Modules nativos | Webpack/Vite | Zero build step, zero node_modules em produção |
| YouTube Iframe API | Servidor de streaming | Gratuito, sem hospedagem de áudio |
| `THREE.Box3` para colisão | Cannon.js / Rapier | AABB suficiente para 2.5D |
| `CatmullRomCurve3` para pista | Mesh manual | Tangente e normal calculáveis em qualquer `t` |
| Geometrias primitivas para o PC | Modelo .glb | Zero assets, carregamento instantâneo |
| IIFE para `bzAudio` | Módulo separado | Encapsula estado de áudio sem poluir escopo global |
| Imagens em base64 | Arquivos .png | Elimina requests extras, disponibilidade offline |

---

## Compatibilidade

| Plataforma | Suporte | Nota |
|------------|---------|------|
| Chrome 90+ | ✅ Total | — |
| Firefox 88+ | ✅ Total | — |
| Safari 15+ | ✅ Total | AudioContext requer interação prévia do usuário |
| Edge 90+ | ✅ Total | — |
| Mobile (touch) | ⚠️ Parcial | Portfólio funcional; jogos sem joystick virtual |
| `file://` protocol | ❌ Bloqueado | ES Modules exigem servidor HTTP |
