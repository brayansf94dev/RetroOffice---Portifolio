import * as THREE from 'three';
import { criarComputador } from './computador.js';
import { bzAudio } from './audio.js';

// ══════════════════════════════════════════════════════════════════════════════
//  B-ZERO 64  v8 — Áudio procedural + correção colisão pista
// ══════════════════════════════════════════════════════════════════════════════

let _ativo       = false;
let _correndo    = false;
let _scene       = null;
let _camera      = null;
let _controls    = null;
let _onVoltar    = null;
let _onVoltarOrig = null; // referência permanente para uso no reiniciar
let _naves       = [];
let _pistaMesh   = [];
let _particulas  = [];
let _lasers      = [];          // lasers do PLAYER
let _lasersIA    = [];          // lasers das IAs
let _meteoros    = [];
let _estrelasBZ  = [];          // estrelas criadas dentro do jogo
let _diskos      = [];          // discos fantasmas — naves destruídas que viram perseguidores
let _hudEl       = null;
let _tempoInicio = 0;
let _frame       = 0;
let _camH        = 0;
let _camModo     = 'normal'; // 'normal' | 'chase'  — alterna com V
let _lap3Ativo   = false;
let _vidaPlayer  = 100;
let _tiroCD      = 0;
let _pilotoAtual = null;   // piloto selecionado pelo jogador
let _dialogoFila = [];     // fila de diálogos pendentes
let _dialogoAtivo= false;
let _dificuldade = 'normal'; // 'facil' | 'normal' | 'dificil'

// Multiplicadores por dificuldade
const DIFF_CFG = {
    facil:   { iaVelMult: 0.80, iaDanoMult: 0.50, iaCadencia: 90, meteoroMax: 8,  meteoroVelMult: 0.70 },
    normal:  { iaVelMult: 1.00, iaDanoMult: 1.00, iaCadencia: 55, meteoroMax: 20, meteoroVelMult: 1.00 },
    dificil: { iaVelMult: 1.22, iaDanoMult: 1.60, iaCadencia: 32, meteoroMax: 30, meteoroVelMult: 1.45 },
};

export function isBZeroAtivo() { return _ativo; }

// ── ESTRELAS INTERNAS DO JOGO ─────────────────────────────────────────────────
function criarEstrelasBZ() {
    // Estrelas espalhadas em uma esfera grande ao redor da pista
    // Cobre o interior e exterior — preenche o espaço vasto
    const N = 4000;
    const posArr = [];
    for (let i = 0; i < N; i++) {
        // Distribui em esfera de raio 400-1200 u
        const r   = 400 + Math.random() * 800;
        const phi = Math.acos(2 * Math.random() - 1);
        const th  = Math.random() * Math.PI * 2;
        posArr.push(
            r * Math.sin(phi) * Math.cos(th),
            r * Math.cos(phi) + 20,         // levemente acima do chão
            r * Math.sin(phi) * Math.sin(th)
        );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, fog: false });
    const pts = new THREE.Points(geo, mat);
    _scene.add(pts);
    _estrelasBZ.push(pts);

    // Nebulosas coloridas — nuvens de pontos coloridos no interior da pista
    const NEBULA_COLORS = [0x0033ff, 0x8800ff, 0x00ffcc, 0xff3300, 0xffaa00];
    NEBULA_COLORS.forEach((cor, ni) => {
        const nArr = [];
        const cx = (ni % 3 - 1) * 250, cz = (Math.floor(ni / 3) - 0.5) * 350;
        for (let i = 0; i < 300; i++) {
            nArr.push(
                cx + (Math.random() - 0.5) * 300,
                20  + Math.random() * 80,
                cz + (Math.random() - 0.5) * 300
            );
        }
        const ng = new THREE.BufferGeometry();
        ng.setAttribute('position', new THREE.Float32BufferAttribute(nArr, 3));
        const nm = new THREE.PointsMaterial({ color: cor, size: 1.8, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.35 });
        const np = new THREE.Points(ng, nm);
        _scene.add(np);
        _estrelasBZ.push(np);
    });
}

// ── PISTA ─────────────────────────────────────────────────────────────────────
const TOTAL_VOLTAS  = 3;
const LARGURA_PISTA = 14.0;   // pista mais larga
const PISTA_LEN     = 1200;   // mais subdivisões para a pista maior

const ALT_BASE = 3.0;

// ── TRAÇADO v11 — PISTA VASTA ─────────────────────────────────────────────────
// Pista 2.5× maior que a versão anterior. Diâmetro total ~900 u.
// Curvas com raio mínimo ~200 u — zero curvas agudas.
// Layout: grande oval alongado (eixo N-S ~600 u, eixo L-O ~500 u)
// com dois loops verticais suaves e ondulações de altitude na reta leste.
//
// Ponto de largada: meio da reta sul (Z≈-420), índice 16 de 32 pts.
//
// Monitor gigante reposicionado para fora do traçado.

const LOOP_ALT = 70; // raio dos loops (maior, para combinar com pista maior)

const _SPLINE_RAW_3D = [
    // ── Reta norte — de oeste para leste (Z≈+320) ────────────────
    [ -240.0, ALT_BASE,  320.0 ],  //  0  fecha/início
    [ -120.0, ALT_BASE,  320.0 ],  //  1
    [    0.0, ALT_BASE,  320.0 ],  //  2  cume norte
    [  120.0, ALT_BASE,  320.0 ],  //  3
    [  240.0, ALT_BASE,  320.0 ],  //  4

    // ── Curva NE — raio grande, suave (X≈+340, Z desce de +320→-50) ─
    [  310.0, ALT_BASE,  220.0 ],  //  5
    [  350.0, ALT_BASE,  100.0 ],  //  6
    [  360.0, ALT_BASE,    0.0 ],  //  7  extremo leste

    // ── Loop 1 — reta SE com loop vertical suave ─────────────────
    [  350.0, ALT_BASE                    , -100.0 ],  //  8
    [  330.0, ALT_BASE + LOOP_ALT * 0.35  , -180.0 ],  //  9
    [  310.0, ALT_BASE + LOOP_ALT * 0.75  , -240.0 ],  // 10
    [  290.0, ALT_BASE + LOOP_ALT * 1.00  , -290.0 ],  // 11  topo loop 1
    [  270.0, ALT_BASE + LOOP_ALT * 0.75  , -340.0 ],  // 12
    [  240.0, ALT_BASE + LOOP_ALT * 0.35  , -380.0 ],  // 13
    [  200.0, ALT_BASE                    , -420.0 ],  // 14

    // ── Reta sul — de leste para oeste (Z≈-420) ──────────────────
    [  100.0, ALT_BASE, -420.0 ],  // 15
    [    0.0, ALT_BASE, -420.0 ],  // 16  ← LARGADA (índice 16 de 32)
    [ -100.0, ALT_BASE, -420.0 ],  // 17
    [ -200.0, ALT_BASE, -420.0 ],  // 18

    // ── Curva SO — raio amplo ─────────────────────────────────────
    [ -260.0, ALT_BASE, -380.0 ],  // 19
    [ -310.0, ALT_BASE, -320.0 ],  // 20

    // ── Loop 2 — reta NO com loop vertical ───────────────────────
    [ -340.0, ALT_BASE                    , -240.0 ],  // 21
    [ -355.0, ALT_BASE + LOOP_ALT * 0.35  , -170.0 ],  // 22
    [ -360.0, ALT_BASE + LOOP_ALT * 0.75  , -100.0 ],  // 23
    [ -355.0, ALT_BASE + LOOP_ALT * 1.00  ,  -20.0 ],  // 24  topo loop 2
    [ -345.0, ALT_BASE + LOOP_ALT * 0.75  ,   60.0 ],  // 25
    [ -330.0, ALT_BASE + LOOP_ALT * 0.35  ,  140.0 ],  // 26
    [ -310.0, ALT_BASE                    ,  210.0 ],  // 27

    // ── Curva NO → norte, fecha o circuito ───────────────────────
    [ -280.0, ALT_BASE,  265.0 ],  // 28
    [ -260.0, ALT_BASE,  300.0 ],  // 29
    [ -240.0, ALT_BASE,  320.0 ],  // 30  = ponto 0
];

// t normalizado do ponto de largada (índice 16 de 30 segmentos)
const PISTA_T_LARGADA = 16 / (_SPLINE_RAW_3D.length - 1);

function _buildSpline() {
    const pts = _SPLINE_RAW_3D.map(([x,y,z]) => new THREE.Vector3(x,y,z));
    return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
}
const PISTA_CURVE = _buildSpline();

function pistaPos(t, latOffset = 0) {
    const pos  = PISTA_CURVE.getPointAt(t);
    if (latOffset === 0) return pos;
    const tang = PISTA_CURVE.getTangentAt(t).normalize();
    const lat  = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0,1,0)).normalize();
    return pos.clone().addScaledVector(lat, latOffset);
}
function pistaTang(t) { return PISTA_CURVE.getTangentAt(t).normalize(); }
function pistaLat(t) {
    const tang = pistaTang(t);
    return new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0,1,0)).normalize();
}
function pistaNormal(t) {
    // Normal perpendicular à pista (aponta "para cima" relativo à curva)
    const tang = pistaTang(t);
    const lat  = pistaLat(t);
    return new THREE.Vector3().crossVectors(lat, tang).normalize();
}

// ── PILOTOS ───────────────────────────────────────────────────────────────────
// img: caminho para imagem do personagem (PNG/JPG/WebP).
// Enquanto não tiver arte, o card exibe o fallback emoji.
const PILOTOS = [
    {
        nome:'RAEL',   tag:'B-01',
        sub:'Piloto Alfa · Dev + Produto · Precision Drive',
        lore:'Arquiteto de sistemas e velocidade. Constrói o caminho enquanto corre.',
        cor:0x1144cc, hex:'#4488ff',
        vel:0.00052, max:0.00095, acel:1.05e-6,
        img:'img/rael.png',      
        fallback:'🔵',
    },
    {
        nome:'NITRO',    tag:'N-77',
        sub:'Piloto Delta · Motor Overclocked · Full Throttle',
        lore:'Nasceu numa oficina de propulsores ilegais. Freios são opcionais.',
        cor:0xdd2200, hex:'#ff4422',
        vel:0.00060, max:0.00108, acel:1.3e-6,
        img:'img/nitro.png',
        fallback:'🔴',
    },
    {
        nome:'CIPHER',   tag:'C-33',
        sub:'Piloto Gama · IA Embarcada · Rota Calculada',
        lore:'Cada curva foi simulada 10 mil vezes antes da largada.',
        cor:0x00bb44, hex:'#33ff77',
        vel:0.00049, max:0.00088, acel:0.95e-6,
        img:'img/cipher.png',
        fallback:'🟢',
    },
    {
        nome:'VEGA',     tag:'V-09',
        sub:'Piloto Omega · Campo de Força · Guerreira da Órbita',
        lore:'Veterana das corridas lunares. Destruiu mais naves do que completou voltas.',
        cor:0xcc8800, hex:'#ffcc22',
        vel:0.00055, max:0.00100, acel:1.1e-6,
        img:'img/vega.png',
        fallback:'🟡',
    },
];

// ── DIÁLOGOS DOS PILOTOS ──────────────────────────────────────────────────────
const DIALOGOS = {
    RAEL: {
        largada:   ["Sistema online. Calculando rota ótima.", "Cada curva é uma decisão de produto.","Construindo o caminho enquanto corro."],
        volta2:    ["Segunda volta. Ajustando a estratégia.", "Dado coletado. Adaptando a execução."],
        meteoros:  ["Meteoros detectados. Esquivando com precisão.", "Obstáculos no sistema — tratando como bugs."],
        destruiuIA:["Oponente eliminado. Próximo.", "Registro: mais um nó removido do grafo."],
        vidaBaixa: ["Shield crítico. Reduzindo exposição.", "Aviso: integridade em risco. Priorizando defesa."],
        vitoria:   ["Missão cumprida. Solução entregue.", "Corrida encerrada. Resultado: exatamente o esperado."],
        derrota:   ["Falha de execução. Analisando o log.", "Nave destruída. Vou refatorar a abordagem."],
    },
    NITRO: {
        largada:   ["FREIOS SÃO OPCIONAIS, BEBÊ!", "Que comecem os fogos!", "Velocidade máxima, zero arrependimento!"],
        volta2:    ["Só aquecendo os motores!", "Segunda volta? Tô só começando!"],
        meteoros:  ["Meteoros?! ÓTIMO, mais obstáculos pra destruir!", "HA! Isso é o que chamo de dificuldade!"],
        destruiuIA:["MAIS UMA ELIMINADA! Quem é o próximo?!", "Kaboom! Essa não volta mais!"],
        vidaBaixa: ["Dói? NEM LIGO! Continua!", "Só um arranhão — avança!"],
        vitoria:   ["ISSO É O QUE SE CHAMA DE CORRIDA!", "VITÓRIA! Alguém ainda duvida de mim?!"],
        derrota:   ["Eita... mas foi divertido DEMAIS.", "Tudo bem. Revanche. Agora."],
    },
    CIPHER: {
        largada:   ["Simulação iniciada. Probabilidade de vitória: 73.4%.", "Todas as rotas foram calculadas. Executando.", "Processamento em curso. Humanos detectados."],
        volta2:    ["Ajuste de trajetória: 0.0012 graus. Executando.", "Dados suficientes coletados. Otimizando."],
        meteoros:  ["Meteoros calculados. Desvio automático ativado.", "Padrão de impacto previsto. Rota ajustada."],
        destruiuIA:["Análise: oponente eliminado. Eficiência: 94%.", "Registro atualizado. Competição reduzida."],
        vidaBaixa: ["Aviso de integridade. Recalculando risco.", "Dano acima do esperado. Revisando parâmetros."],
        vitoria:   ["Resultado: dentro das projeções. Eficiência máxima.", "Vitória confirmada. Probabilidade era de 73.4%."],
        derrota:   ["Erro não previsto. Atualizando modelo preditivo.", "Derrota registrada. Retreinamento necessário."],
    },
    VEGA: {
        largada:   ["Eu já corri em crateras lunares. Isso aqui é passear.", "Preparadas? Porque eu não espero.", "Mais uma corrida. Mais um troféu pra minha coleção."],
        volta2:    ["Veterana não cansa. Só acelera.", "Na lua não tinha atalhos. Aqui tem."],
        meteoros:  ["Meteoros? Saudades de casa.", "Já sobrevivi a pior coisa que o espaço tem. Isso? Brincadeira."],
        destruiuIA:["Mais uma no meu histórico.", "Devia ter ficado na garagem."],
        vidaBaixa: ["Já levei pior no meu segundo ano de corrida.", "Dano absorvido. Sigo."],
        vitoria:   ["Disseram que eu era velha demais. Olha o resultado.", "Veteranas não se aposentam — dominam."],
        derrota:   ["Interessante. Não esperava isso.", "Raro acontecer. Mas aconteceu. Aprendi."],
    }
};

// ── SISTEMA DE DIÁLOGO HUD ────────────────────────────────────────────────────
let _dialogoEl = null;
let _dialogoTimer = null;

function criarDialogoEl() {
    if (_dialogoEl) return;
    _dialogoEl = document.createElement('div');
    _dialogoEl.id = 'bz-dialogo';
    _dialogoEl.style.cssText = `
        display:none; position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
        z-index:8500; pointer-events:none; font-family:'Courier New',monospace;
        max-width:min(94vw,520px); width:max-content;
        animation:bz-fadein .25s ease;
    `;
    document.body.appendChild(_dialogoEl);
}

function mostrarDialogo(piloto, tipo) {
    if (!_dialogoEl || !piloto) return;
    const banco = DIALOGOS[piloto.nome];
    if (!banco || !banco[tipo]) return;
    const frases = banco[tipo];
    const frase = frases[Math.floor(Math.random() * frases.length)];

    // limpa timer anterior
    if (_dialogoTimer) clearTimeout(_dialogoTimer);

    _dialogoEl.innerHTML = `
        <div style="
            display:flex; align-items:center; gap:8px;
            background:rgba(0,0,16,0.88); border:1px solid ${piloto.hex}55;
            border-radius:7px; padding:6px 12px; box-shadow:0 0 18px ${piloto.hex}33;
        ">
            <div style="width:32px;height:32px;border-radius:50%;border:2px solid ${piloto.hex}88;overflow:hidden;flex-shrink:0;background:rgba(0,20,50,.7);display:flex;align-items:center;justify-content:center;">
                ${piloto.img ? `<img src="${piloto.img}" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.parentNode.innerHTML='<span style=font-size:1.1em>${piloto.fallback}</span>'">` : `<span style="font-size:1.1em">${piloto.fallback}</span>`}
            </div>
            <div>
                <div style="color:${piloto.hex};font-size:.55em;letter-spacing:2px;margin-bottom:1px;">${piloto.nome}</div>
                <div style="color:#c8e0ff;font-size:.68em;line-height:1.35;">"${frase}"</div>
            </div>
        </div>
    `;
    _dialogoEl.style.display = 'block';
    _dialogoEl.style.animation = 'none';
    _dialogoEl.offsetHeight;
    _dialogoEl.style.animation = 'bz-fadein .25s ease';

    _dialogoTimer = setTimeout(() => {
        if (_dialogoEl) _dialogoEl.style.display = 'none';
    }, 3800);
}

// ── MODELO BLUE FALCON ────────────────────────────────────────────────────────
function criarMeshNave(cor, isPlayer) {
    const g  = new THREE.Group();
    const M  = c       => new THREE.MeshBasicMaterial({ color: c, fog: false });
    const MT = (c, op) => new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: op });

    const corEsc  = new THREE.Color(cor).multiplyScalar(0.45).getHex();
    const corMid  = new THREE.Color(cor).multiplyScalar(0.72).getHex();
    const branco  = 0xeeeeff;
    const dourado = isPlayer ? 0xffaa00 : 0x886633;

    // Fuselagem principal
    const bodyGeo = new THREE.CylinderGeometry(0.30, 0.36, 1.10, 8);
    const body    = new THREE.Mesh(bodyGeo, M(cor));
    body.rotation.x = Math.PI / 2;
    body.scale.set(2.2, 1.0, 1.0);
    g.add(body);

    // Proa
    const proaGeo = new THREE.SphereGeometry(0.30, 8, 6);
    const proa    = new THREE.Mesh(proaGeo, M(cor));
    proa.scale.set(2.0, 0.85, 1.6);
    proa.position.set(0, 0, -0.72);
    g.add(proa);

    // Nariz
    const narizGeo = new THREE.ConeGeometry(0.13, 0.52, 7);
    const nariz    = new THREE.Mesh(narizGeo, M(corMid));
    nariz.rotation.x = Math.PI / 2;
    nariz.position.set(0, -0.02, -1.20);
    g.add(nariz);

    const pontaGeo = new THREE.ConeGeometry(0.04, 0.20, 5);
    const ponta    = new THREE.Mesh(pontaGeo, M(branco));
    ponta.rotation.x = Math.PI / 2;
    ponta.position.set(0, -0.02, -1.50);
    g.add(ponta);

    // Seção traseira
    const trasGeo = new THREE.CylinderGeometry(0.36, 0.44, 0.55, 8);
    const tras    = new THREE.Mesh(trasGeo, M(corEsc));
    tras.rotation.x = Math.PI / 2;
    tras.scale.set(2.4, 1.0, 1.0);
    tras.position.set(0, 0, 0.68);
    g.add(tras);

    // Cockpit
    const ckBaseGeo = new THREE.BoxGeometry(0.60, 0.18, 0.55);
    const ckBase    = new THREE.Mesh(ckBaseGeo, M(corEsc));
    ckBase.position.set(0, 0.26, -0.18);
    ckBase.rotation.x = 0.18;
    g.add(ckBase);

    const ckGlassGeo = new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI*2, 0, Math.PI*0.55);
    const ckGlass    = new THREE.Mesh(ckGlassGeo, MT(isPlayer ? 0x001133 : 0x001122, 0.82));
    ckGlass.scale.set(1.35, 0.55, 1.60);
    ckGlass.position.set(0, 0.30, -0.10);
    ckGlass.rotation.x = 0.22;
    g.add(ckGlass);

    const ckAroGeo = new THREE.TorusGeometry(0.22, 0.025, 6, 16, Math.PI);
    const ckAro    = new THREE.Mesh(ckAroGeo, M(corMid));
    ckAro.scale.set(1.35, 1.60, 0.55);
    ckAro.position.set(0, 0.30, -0.10);
    ckAro.rotation.x = 0.22 + Math.PI;
    g.add(ckAro);

    // Asas
    [-1, 1].forEach(side => {
        const av = new Float32Array([
             0.00, -0.04, -0.20,
             0.00, -0.04,  0.35,
             side*1.55, -0.04,  0.10,
             side*1.55, -0.04,  0.50,
        ]);
        const asaGeo = new THREE.BufferGeometry();
        asaGeo.setAttribute('position', new THREE.BufferAttribute(av, 3));
        asaGeo.setIndex([0,1,2, 1,3,2, 2,1,0, 2,3,1]);
        asaGeo.computeVertexNormals();
        g.add(new THREE.Mesh(asaGeo, MT(cor, 0.95)));

        const bordaGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0,-0.04,-0.20),
            new THREE.Vector3(side*1.55,-0.04,0.10),
            new THREE.Vector3(side*1.55,-0.04,0.50),
            new THREE.Vector3(0,-0.04,0.35),
        ]);
        g.add(new THREE.Line(bordaGeo, new THREE.LineBasicMaterial({ color: isPlayer ? branco : 0x4466aa, fog: false })));

        const fv = new Float32Array([
            side*0.3,  -0.035, -0.05,
            side*0.3,  -0.035,  0.08,
            side*1.0,  -0.035,  0.28,
            side*1.0,  -0.035,  0.41,
        ]);
        const faixaGeo = new THREE.BufferGeometry();
        faixaGeo.setAttribute('position', new THREE.BufferAttribute(fv, 3));
        faixaGeo.setIndex([0,1,2, 1,3,2, 2,1,0, 2,3,1]);
        g.add(new THREE.Mesh(faixaGeo, MT(dourado, 0.90)));
    });

    // Aletas verticais traseiras
    [-1, 1].forEach(side => {
        const av = new Float32Array([
            side*0.50,  0.00,  0.42,
            side*0.50,  0.00,  0.82,
            side*0.68,  0.58,  0.50,
            side*0.68,  0.58,  0.82,
        ]);
        const aletaGeo = new THREE.BufferGeometry();
        aletaGeo.setAttribute('position', new THREE.BufferAttribute(av, 3));
        aletaGeo.setIndex([0,1,2, 1,3,2, 2,1,0, 2,3,1]);
        aletaGeo.computeVertexNormals();
        g.add(new THREE.Mesh(aletaGeo, MT(corEsc, 0.95)));

        const bAletaGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(side*0.50,0.00,0.42),
            new THREE.Vector3(side*0.68,0.58,0.50),
            new THREE.Vector3(side*0.68,0.58,0.82),
            new THREE.Vector3(side*0.50,0.00,0.82),
        ]);
        g.add(new THREE.Line(bAletaGeo, new THREE.LineBasicMaterial({ color: isPlayer ? 0xaaccff : 0x335577, fog: false })));
    });

    // Motores
    [-0.55, 0, 0.55].forEach((ox, mi) => {
        const motorGeo = new THREE.CylinderGeometry(0.095, 0.11, 0.10, 7);
        const motor    = new THREE.Mesh(motorGeo, M(0x0a0a1a));
        motor.rotation.x = Math.PI / 2;
        motor.position.set(ox, -0.04, 0.98);
        g.add(motor);

        const chamaGeo = new THREE.ConeGeometry(0.09, 0.40, 7);
        const chama    = new THREE.Mesh(chamaGeo, MT(mi===1 ? 0xff8800 : cor, 0.85));
        chama.rotation.x = -Math.PI / 2;
        chama.position.set(ox, -0.04, 1.25);
        g.add(chama);

        const lm = new THREE.PointLight(cor, mi===1 ? 2.5 : 1.5, 5);
        lm.position.set(ox, -0.04, 1.38);
        g.add(lm);
    });

    [-1, 1].forEach(side => {
        const numGeo = new THREE.BoxGeometry(0.01, 0.10, 0.22);
        g.add(new THREE.Mesh(numGeo, MT(branco, 0.7)));
        g.children[g.children.length-1].position.set(side*0.62, 0.05, -0.30);
    });

    if (isPlayer) {
        const lf = new THREE.PointLight(0xffffff, 1.5, 18);
        lf.position.set(0, 0, -1.6);
        g.add(lf);
    }

    // FIX #1: Tamanho das naves reduzido de 1.80 para 0.85
    g.scale.setScalar(0.85);
    return g;
}

// ── COMPUTADOR GIGANTE NO CENTRO DA PISTA ─────────────────────────────────────
function criarMonitorGigante() {
    // Usa o mesmo modelo 3D do computador.js, escalado para ser monumental na pista
    const pc = criarComputador();

    // Escala gigante — o modelo original tem ~2.5 u de largura e ~3.5 u de altura
    // Com escala 10, o topo do monitor fica em ~ALT_BASE + 35 u
    // A pista passa por cima com arco em Y = ALT_BASE + 30 — espaço livre
    const escala = 18;
    pc.scale.setScalar(escala);

    // Posiciona no centro interno da pista (agora muito maior)
    pc.position.set(0, ALT_BASE, -60);

    // Rotaciona para ficar de frente para as naves que chegam pela direita
    pc.rotation.y = -Math.PI * 0.5;

    // Luzes neon como filhas do grupo → são limpas junto com o PC no limpar()
    const luzNeon1 = new THREE.PointLight(0x00ffcc, 10, escala * 16);
    luzNeon1.position.set(0, 2.5, 0); // topo do monitor (em espaço local, antes da escala)
    pc.add(luzNeon1);

    const luzNeon2 = new THREE.PointLight(0x2266ff, 6, escala * 12);
    luzNeon2.position.set(0, 1.0, 0);
    pc.add(luzNeon2);

    _scene.add(pc);
    _pistaMesh.push(pc); // inclui no cleanup automático

    pc.userData.isMonitor   = true;
    pc.userData.monitorLuz1 = luzNeon1;
    pc.userData.monitorLuz2 = luzNeon2;

    return pc;
}

// ── CRIAR PISTA VISUAL ────────────────────────────────────────────────────────
function criarPistaVisual() {
    const group = new THREE.Group();
    _pistaMesh.push(group);
    _scene.add(group);

    const N = PISTA_LEN;
    const W = LARGURA_PISTA / 2;

    // Superfície
    const posArr = [], idxArr = [];
    for (let i = 0; i <= N; i++) {
        const t   = i / N;
        const pos = pistaPos(t);
        const lat = pistaLat(t);
        posArr.push(
            pos.x - lat.x*W, pos.y - 0.07, pos.z - lat.z*W,
            pos.x + lat.x*W, pos.y - 0.07, pos.z + lat.z*W,
        );
        if (i < N) {
            const a=i*2, b=a+1, c=a+2, d=a+3;
            idxArr.push(a,b,c, b,d,c);
        }
    }
    const surfGeo = new THREE.BufferGeometry();
    surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    surfGeo.setIndex(idxArr);
    surfGeo.computeVertexNormals();
    group.add(new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({
        color:0x001a33, transparent:true, opacity:0.38,
        side:THREE.DoubleSide, fog:false, depthWrite:false,
    })));

    // Faixas
    const stripeArr=[], stripeIdx=[];
    const STRIPES=160;
    for (let i=0; i<STRIPES; i++) {
        if (i%4===0) continue;
        const t0=i/STRIPES, t1=(i+0.30)/STRIPES;
        const p0=pistaPos(t0), p1=pistaPos(t1);
        const l0=pistaLat(t0),  l1=pistaLat(t1);
        const base=stripeArr.length/3, wS=W*0.94;
        stripeArr.push(
            p0.x-l0.x*wS, p0.y, p0.z-l0.z*wS,
            p0.x+l0.x*wS, p0.y, p0.z+l0.z*wS,
            p1.x-l1.x*wS, p1.y, p1.z-l1.z*wS,
            p1.x+l1.x*wS, p1.y, p1.z+l1.z*wS,
        );
        stripeIdx.push(base,base+1,base+2, base+1,base+3,base+2);
    }
    const stripeGeo=new THREE.BufferGeometry();
    stripeGeo.setAttribute('position', new THREE.Float32BufferAttribute(stripeArr,3));
    stripeGeo.setIndex(stripeIdx);
    group.add(new THREE.Mesh(stripeGeo, new THREE.MeshBasicMaterial({
        color:0x000e22, transparent:true, opacity:0.22,
        side:THREE.DoubleSide, fog:false, depthWrite:false,
    })));

    // Bordas
    [-W, W].forEach((side, si) => {
        const pts=[];
        for (let i=0; i<=N; i++) {
            const t=i/N, pos=pistaPos(t), lat=pistaLat(t);
            pts.push(pos.x+lat.x*side, pos.y, pos.z+lat.z*side);
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
        group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color:si===0?0xff3300:0x00ccff, fog:false })));
    });

    // Linha central
    const cPts=[];
    for (let i=0; i<=N; i+=4) { const p=pistaPos(i/N); cPts.push(p.x, p.y+0.02, p.z); }
    const cGeo=new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(cPts,3));
    group.add(new THREE.Line(cGeo, new THREE.LineBasicMaterial({ color:0xffffff, fog:false, transparent:true, opacity:0.13 })));

    // Ripas
    const ripaMat=new THREE.LineBasicMaterial({ color:0x0077bb, fog:false, transparent:true, opacity:0.28 });
    for (let i=0; i<200; i++) {
        const t=i/200, pos=pistaPos(t), lat=pistaLat(t);
        const rGeo=new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(pos.x-lat.x*W*0.95, pos.y, pos.z-lat.z*W*0.95),
            new THREE.Vector3(pos.x+lat.x*W*0.95, pos.y, pos.z+lat.z*W*0.95),
        ]);
        group.add(new THREE.Line(rGeo, ripaMat));
    }

    // Checkpoints nos 4 quadrantes — norte, leste, sul, oeste
    [0.10, 0.38, PISTA_T_LARGADA, 0.78].forEach((t, ci) => {
        const pos=pistaPos(t), lat=pistaLat(t), norm=pistaNormal(t);
        const cor=ci===0?0xffdd00:0x00ffaa;
        const altP=6.0;
        [-1,1].forEach(s => {
            const base=pos.clone().addScaledVector(lat, s*W*0.90);
            group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([base.clone(), base.clone().addScaledVector(norm,altP)]),
                new THREE.LineBasicMaterial({ color:cor, fog:false })
            ));
            const cil=new THREE.Mesh(
                new THREE.CylinderGeometry(0.28,0.34,0.7,8),
                new THREE.MeshBasicMaterial({ color:cor, fog:false, transparent:true, opacity:0.7 })
            );
            cil.position.copy(base);
            group.add(cil);
        });
        const pL=pos.clone().addScaledVector(lat,-W*0.90).addScaledVector(norm,altP);
        const pR=pos.clone().addScaledVector(lat, W*0.90).addScaledVector(norm,altP);
        group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([pL,pR]),
            new THREE.LineBasicMaterial({ color:cor, fog:false })
        ));
        const lc=new THREE.PointLight(cor, 3.0, 28);
        lc.position.copy(pos).addScaledVector(norm, altP+2);
        group.add(lc);
    });

    // Anéis dos loops — Loop 1 (t≈0.28..0.48) e Loop 2 (t≈0.72..0.86)
    const loopRegions = [
        { start: 0.28, end: 0.48, cor1: 0x00ffff, cor2: 0xff6600 },
        { start: 0.72, end: 0.86, cor1: 0xff00ff, cor2: 0xffcc00 },
    ];
    loopRegions.forEach(({ start, end, cor1, cor2 }) => {
        for (let li=0; li<=8; li++) {
            const lt = start + (end - start) * (li / 8);
            const lpos = pistaPos(lt), llat = pistaLat(lt), lnrm = pistaNormal(lt);
            const ptsAnel = [];
            const SEG = 20, RAD = W * 1.18;
            for (let ai = 0; ai <= SEG; ai++) {
                const ang = (ai / SEG) * Math.PI * 2;
                ptsAnel.push(lpos.clone()
                    .addScaledVector(llat, Math.cos(ang) * RAD)
                    .addScaledVector(lnrm, Math.sin(ang) * RAD));
            }
            const anelCor = li % 2 === 0 ? cor1 : cor2;
            group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(ptsAnel),
                new THREE.LineBasicMaterial({ color: anelCor, fog: false, transparent: true, opacity: 0.55 })
            ));
            if (li % 2 === 0) {
                const ll = new THREE.PointLight(anelCor, 1.5, 20);
                ll.position.copy(lpos);
                group.add(ll);
            }
        }
    });

    // ── TÚNEIS TUBULARES ─────────────────────────────────────────────────
    // 5 trechos tubulares: entrada/saída dos dois loops + túnel na reta norte
    const TBSEGS = 80, TBRING = 16;
    const tubeMat  = new THREE.MeshBasicMaterial({ color: 0x001833, transparent: true, opacity: 0.55, side: THREE.BackSide, fog: false, depthWrite: false });
    const tubeEdge = new THREE.LineBasicMaterial({ color: 0x0099ff, transparent: true, opacity: 0.70, fog: false });
    const tubeEdge2 = new THREE.LineBasicMaterial({ color: 0xff44ff, transparent: true, opacity: 0.70, fog: false });
    // [start_t, end_t, edgeMat]
    [
        [0.24, 0.38, tubeEdge],   // entrada loop 1
        [0.38, 0.50, tubeEdge],   // saída loop 1 → reta sul
        [0.55, 0.64, tubeEdge2],  // túnel na reta sul oeste
        [0.66, 0.80, tubeEdge2],  // entrada loop 2
        [0.80, 0.90, tubeEdge2],  // saída loop 2
    ].forEach(([tS, tE, edgeMat]) => {
        const tv = [], ti = [];
        for (let si = 0; si <= TBSEGS; si++) {
            const t  = tS + (tE - tS) * (si / TBSEGS);
            const cp = pistaPos(t), cl = pistaLat(t), cn = pistaNormal(t);
            for (let ri = 0; ri <= TBRING; ri++) {
                const ang = (ri / TBRING) * Math.PI * 2;
                const dx = Math.cos(ang) * W * 1.12, dy = Math.sin(ang) * W * 1.12;
                tv.push(cp.x + cl.x*dx + cn.x*dy, cp.y + cl.y*dx + cn.y*dy, cp.z + cl.z*dx + cn.z*dy);
            }
        }
        for (let si = 0; si < TBSEGS; si++) {
            for (let ri = 0; ri < TBRING; ri++) {
                const a = si*(TBRING+1)+ri, b=a+1, c=a+(TBRING+1), d=c+1;
                ti.push(a,b,c, b,d,c);
            }
        }
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.Float32BufferAttribute(tv, 3));
        tg.setIndex(ti);
        group.add(new THREE.Mesh(tg, tubeMat));
        // Anéis de borda a cada 8 segmentos
        for (let si = 0; si <= TBSEGS; si += 8) {
            const t  = tS + (tE - tS) * (si / TBSEGS);
            const cp = pistaPos(t), cl = pistaLat(t), cn = pistaNormal(t);
            const rp = [];
            for (let ri = 0; ri <= TBRING; ri++) {
                const ang = (ri / TBRING) * Math.PI * 2;
                const dx = Math.cos(ang)*W*1.12, dy = Math.sin(ang)*W*1.12;
                rp.push(new THREE.Vector3(cp.x+cl.x*dx+cn.x*dy, cp.y+cl.y*dx+cn.y*dy, cp.z+cl.z*dx+cn.z*dy));
            }
            group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rp), edgeMat));
        }
    });

    // Linha de chegada — xadrez contínuo no plano da pista (lat × tang)
    // Posicionada no meio da reta sul (PISTA_T_LARGADA ≈ 0.50)
    {
        const lPos  = pistaPos(PISTA_T_LARGADA);
        const lTang = pistaTang(PISTA_T_LARGADA);
        const lLat  = pistaLat(PISTA_T_LARGADA);
        const lNorm = pistaNormal(PISTA_T_LARGADA);
        const COLS  = 10, ROWS = 3;          // 10 colunas laterais, 3 fileiras ao longo
        const wCol  = (W * 1.88) / COLS;     // largura de cada coluna
        const wRow  = 1.0;                    // comprimento de cada fileira
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cor = (row + col) % 2 === 0 ? 0xffee00 : 0xffffff;
                const u0  = -W * 0.94 + col * wCol;
                const u1  = u0 + wCol;
                const v0  = (row - ROWS / 2) * wRow;
                const v1  = v0 + wRow;
                const p00 = lPos.clone().addScaledVector(lLat, u0).addScaledVector(lTang, v0);
                const p10 = lPos.clone().addScaledVector(lLat, u1).addScaledVector(lTang, v0);
                const p01 = lPos.clone().addScaledVector(lLat, u0).addScaledVector(lTang, v1);
                const p11 = lPos.clone().addScaledVector(lLat, u1).addScaledVector(lTang, v1);
                const off = 0.08;   // ligeiramente acima da superfície
                const lift = v => v.clone().addScaledVector(lNorm, off);
                const pGeo = new THREE.BufferGeometry();
                pGeo.setAttribute('position', new THREE.Float32BufferAttribute([
                    ...lift(p00).toArray(), ...lift(p10).toArray(),
                    ...lift(p01).toArray(), ...lift(p11).toArray(),
                ], 3));
                pGeo.setIndex([0,1,2, 1,3,2]);
                pGeo.computeVertexNormals();
                group.add(new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({
                    color: cor, fog: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
                })));
            }
        }
        // Luz amarela sobre a linha
        const lLuz = new THREE.PointLight(0xffdd00, 4.0, 28);
        lLuz.position.copy(lPos).addScaledVector(lNorm, 5);
        group.add(lLuz);
    }

    // Monitor gigante central
    criarMonitorGigante();
}

// ── CRIAR NAVES ───────────────────────────────────────────────────────────────
function criarNaves(pilotoIdx) {
    _naves=[];
    const offsets=[0.000,0.003,0.006,0.009].map(o => PISTA_T_LARGADA + o);
    PILOTOS.forEach((p,i) => {
        const t=offsets[i];
        const lat=i%2===0?-LARGURA_PISTA*0.16:LARGURA_PISTA*0.16;
        const mesh=criarMeshNave(p.cor, i===pilotoIdx);
        mesh.position.copy(pistaPos(t,lat));
        _scene.add(mesh);
        // Aplicar orientação correta já na largada para evitar diagonal inicial
        const tang0 = pistaTang(t);
        const tNext0 = (t + 0.002) % 1;
        const tangNext0 = pistaTang(tNext0);
        let up0 = new THREE.Vector3().crossVectors(tang0, tangNext0);
        if (up0.lengthSq() < 1e-6) up0.set(0, 1, 0); else { up0.normalize(); if (up0.y < -0.1) up0.negate(); }
        const cima0 = up0.clone().sub(tang0.clone().multiplyScalar(up0.dot(tang0))).normalize();
        const dir0  = new THREE.Vector3().crossVectors(tang0, cima0).normalize();
        const mx0   = new THREE.Matrix4().makeBasis(dir0, cima0, tang0.clone().negate());
        mesh.setRotationFromMatrix(mx0);

        _naves.push({
            mesh, t,
            tPrev: t,
            latOff:lat, latAlvo:lat,
            velAtual:p.vel, velBase:p.vel, velMax:p.max, acel:p.acel,
            isPlayer:i===pilotoIdx,
            cor:p.cor, hex:p.hex, nome:p.nome,
            volta:0, distTotal:t, chegou:false, destruida:false,
            bankSmooth: 0,
            upSmooth: up0.clone(),
        });
        // Inicializa vida das IAs
        if (i !== pilotoIdx) _vidaIA[i] = 100;
    });
}

// ── PARTÍCULAS ────────────────────────────────────────────────────────────────
function emitirParticula(nave) {
    const geo=new THREE.SphereGeometry(0.12,4,4);
    const mat=new THREE.MeshBasicMaterial({ color:nave.cor, fog:false, transparent:true, opacity:0.55 });
    const p=new THREE.Mesh(geo,mat);
    const tang=pistaTang(nave.t);
    p.position.copy(nave.mesh.position)
        .sub(tang.clone().multiplyScalar(0.9))
        .add(new THREE.Vector3((Math.random()-.5)*.5,(Math.random()-.5)*.3,(Math.random()-.5)*.5));
    _scene.add(p);
    _particulas.push({ mesh:p, vida:24, max:24 });
}

function atualizarParticulas() {
    for (let i=_particulas.length-1; i>=0; i--) {
        const p=_particulas[i];
        p.vida--;
        p.mesh.material.opacity=(p.vida/p.max)*0.55;
        p.mesh.position.y+=0.007;
        if (p.vida<=0) { _scene.remove(p.mesh); _particulas.splice(i,1); }
    }
}

// ── TIROS ─────────────────────────────────────────────────────────────────────
const _geoLaser   = new THREE.CylinderGeometry(0.055, 0.055, 1.6, 5);
const _geoLaserIA = new THREE.CylinderGeometry(0.055, 0.055, 1.6, 5);
let _mouseX=0, _mouseY=0;
let _miraEl=null;

// Vida individual das naves IA
const _vidaIA = {};  // { idx: vida 0-100 }

function atirarMouse() {
    if (!_correndo || !_ativo) return;
    if (_tiroCD>0) return;
    _tiroCD=10;
    bzAudio.init();
    bzAudio.tiro();
    const player=_naves.find(n=>n.isPlayer);
    if (!player||!_camera) return;
    const raio=new THREE.Raycaster();
    raio.setFromCamera(new THREE.Vector2(_mouseX,_mouseY), _camera);
    const plano=new THREE.Plane(new THREE.Vector3(0,1,0), -player.mesh.position.y);
    const alvoMira=new THREE.Vector3();
    const hit=raio.ray.intersectPlane(plano,alvoMira);
    const origem=player.mesh.position.clone();
    let dir;
    if (hit&&alvoMira.distanceTo(origem)>1.5) { dir=alvoMira.clone().sub(origem).normalize(); }
    else { dir=pistaTang(player.t).clone().negate(); }
    const lat=pistaLat(player.t);
    [-1.0,1.0].forEach(lado => {
        const laser=new THREE.Mesh(_geoLaser, new THREE.MeshBasicMaterial({ color:0x00ffff, fog:false }));
        laser.position.copy(origem).addScaledVector(lat,lado*0.85);
        laser.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
        const lLuz=new THREE.PointLight(0x00ffff,3,6);
        laser.add(lLuz);
        laser.userData={ vel:dir.clone().multiplyScalar(1.8), vida:80 };
        _scene.add(laser);
        _lasers.push(laser);
    });
}

// IAs atiram no player quando estão próximas e na mesma reta
function atirarIA(nave, idx) {
    const player=_naves.find(n=>n.isPlayer);
    if (!player||player.chegou) return;
    const dist=nave.mesh.position.distanceTo(player.mesh.position);
    // Atira quando player está na frente (dist < 80) com probabilidade controlada
    if (dist>80) return;
    // Direção para o player
    const dir=player.mesh.position.clone().sub(nave.mesh.position).normalize();
    const lat=pistaLat(nave.t);
    [-0.8, 0.8].forEach(lado => {
        bzAudio.tiroIA();
        const laser=new THREE.Mesh(_geoLaserIA, new THREE.MeshBasicMaterial({ color:nave.cor, fog:false, transparent:true, opacity:0.85 }));
        laser.position.copy(nave.mesh.position).addScaledVector(lat,lado);
        laser.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
        const lLuz=new THREE.PointLight(nave.cor,2,5);
        laser.add(lLuz);
        laser.userData={ vel:dir.clone().multiplyScalar(1.6), vida:70 };
        _scene.add(laser);
        _lasersIA.push(laser);
    });
}

function atualizarLasers() {
    const player=_naves.find(n=>n.isPlayer);

    // ── Lasers do PLAYER ──────────────────────────────────────────────────────
    for (let i=_lasers.length-1; i>=0; i--) {
        const l=_lasers[i];
        l.userData.vida--;
        l.position.addScaledVector(l.userData.vel,1);
        let hit=false;

        // Acerta meteoro
        for (let j=_meteoros.length-1; j>=0; j--) {
            if (l.position.distanceTo(_meteoros[j].mesh.position)<2.5) {
                _scene.remove(_meteoros[j].mesh); _meteoros.splice(j,1);
                criarExplosao(l.position.clone(),0x00ffff);
                bzAudio.explosao(0.4);
                hit=true; break;
            }
        }

        // Acerta nave IA — causa dano real e pode destruí-la
        if (!hit) {
            for (let j=0; j<_naves.length; j++) {
                const n=_naves[j];
                if (n.isPlayer||n.chegou||n.destruida) continue;
                if (l.position.distanceTo(n.mesh.position)<2.8) {
                    if (_vidaIA[j]===undefined) _vidaIA[j]=100;
                    _vidaIA[j]-=28;
                    criarExplosao(l.position.clone(),n.cor);
                    bzAudio.explosao(0.5);
                    hit=true;
                    if (_vidaIA[j]<=0) {
                        _vidaIA[j]=0;
                        destruirNaveIA(n, j);
                    } else {
                        n.penalidade=60;
                        flashEvento(`🎯 ${n.nome} -28 SHIELD`, n.hex);
                    }
                    break;
                }
            }
        }

        // Acerta disco fantasma — 2 tiros o destroem
        if (!hit) {
            for (let j=_diskos.length-1; j>=0; j--) {
                const d=_diskos[j];
                if (!d.ativo) continue;
                if (l.position.distanceTo(d.mesh.position)<1.8) {
                    d.ativo=false;
                    criarExplosao(d.mesh.position.clone(), d.cor);
                    criarExplosao(d.mesh.position.clone(), 0xffffff);
                    bzAudio.explosao(0.6);
                    flashEvento(`💫 ${d.nome} DISCO DESTRUÍDO!`, '#ff88ff');
                    setTimeout(()=>{ _scene.remove(d.mesh); _diskos.splice(j,1); }, 80);
                    hit=true; break;
                }
            }
        }
        if (hit||l.userData.vida<=0) { _scene.remove(l); _lasers.splice(i,1); }
    }

    // ── Lasers das IAs ────────────────────────────────────────────────────────
    for (let i=_lasersIA.length-1; i>=0; i--) {
        const l=_lasersIA[i];
        l.userData.vida--;
        l.position.addScaledVector(l.userData.vel,1);
        let hit=false;

        if (player&&!player.chegou&&!player.destruida) {
            if (l.position.distanceTo(player.mesh.position)<2.5) {
                const dano = Math.round(14 * DIFF_CFG[_dificuldade].iaDanoMult);
                const vidaAntes = _vidaPlayer;
                _vidaPlayer=Math.max(0,_vidaPlayer-dano);
                criarExplosao(l.position.clone(),0xff2200);
                bzAudio.dano();
                flashEvento(`⚡ -${dano} SHIELD`,'#ff4400');
                atualizarHUD();
                hit=true;
                if (_vidaPlayer<=30 && vidaAntes>30) setTimeout(()=>mostrarDialogo(_pilotoAtual,'vidaBaixa'), 300);
                if (_vidaPlayer<=0) destruirPlayer();
            }
        }
        if (hit||l.userData.vida<=0) { _scene.remove(l); _lasersIA.splice(i,1); }
    }
}

// IA dispara periodicamente quando tem visão do player
function atualizarTiroIA() {
    if (!_correndo) return;
    const cadencia = DIFF_CFG[_dificuldade].iaCadencia;
    _naves.forEach((n, idx) => {
        if (n.isPlayer||n.chegou||n.destruida) return;
        if (_frame % (cadencia + idx*17) === 0) atirarIA(n, idx);
    });
}

// ── METEOROS ──────────────────────────────────────────────────────────────────
const _geoMet=new THREE.DodecahedronGeometry(1,0);

function spawnMeteoro() {
    const tAlvo=Math.random(), latAlvo=(Math.random()-.5)*LARGURA_PISTA*0.82;
    const alvo=pistaPos(tAlvo,latAlvo);
    const escala=0.5+Math.random()*1.1;
    const cor=new THREE.Color(0.45+Math.random()*.3,0.28+Math.random()*.1,0.1+Math.random()*.1);
    const mesh=new THREE.Mesh(_geoMet, new THREE.MeshBasicMaterial({ color:cor, fog:false }));
    mesh.scale.setScalar(escala);
    const tang=pistaTang(tAlvo);
    const spawnPos=alvo.clone()
        .addScaledVector(tang,-(160+Math.random()*100))
        .add(new THREE.Vector3((Math.random()-.5)*36, 24+Math.random()*48, (Math.random()-.5)*36));
    mesh.position.copy(spawnPos);
    _scene.add(mesh);
    const vel=alvo.clone().sub(spawnPos).normalize().multiplyScalar(0.40+Math.random()*0.22);
    _meteoros.push({ mesh, escala, vel, alvo, rotVel:(Math.random()-.5)*.055 });
}

function atualizarMeteoros() {
    const cfg = DIFF_CFG[_dificuldade];
    if (_lap3Ativo&&_frame%42===0&&_meteoros.length<cfg.meteoroMax) spawnMeteoro();
    const player=_naves.find(n=>n.isPlayer);
    for (let i=_meteoros.length-1; i>=0; i--) {
        const m=_meteoros[i];
        m.mesh.position.add(m.vel.clone().multiplyScalar(cfg.meteoroVelMult));
        m.mesh.rotation.x+=m.rotVel;
        m.mesh.rotation.y+=m.rotVel*0.7;
        if (player&&!player.chegou&&!player.destruida) {
            const dist=m.mesh.position.distanceTo(player.mesh.position);
            if (dist<2.2+m.escala) {
                const dano = Math.round(18 * cfg.iaDanoMult);
                const vidaAntes = _vidaPlayer;
                _vidaPlayer=Math.max(0,_vidaPlayer-dano);
                criarExplosao(m.mesh.position.clone(),0xff4400);
                bzAudio.explosao(0.5 + m.escala * 0.3);
                bzAudio.dano();
                _scene.remove(m.mesh); _meteoros.splice(i,1);
                flashEvento(`💥 -${dano} SHIELD`,'#ff4400');
                atualizarHUD();
                if (_vidaPlayer<=30 && vidaAntes>30) setTimeout(()=>mostrarDialogo(_pilotoAtual,'vidaBaixa'), 300);
                if (_vidaPlayer<=0) destruirPlayer();
                continue;
            } else if (dist < 10 + m.escala) {
                bzAudio.meteoro();
            }
        }
        if (i<_meteoros.length&&m.mesh.position.distanceTo(m.alvo)<1.8) {
            bzAudio.explosao(m.escala * 0.4);
            criarExplosao(m.mesh.position.clone(),0xff6600,m.escala*.6);
            _scene.remove(m.mesh); _meteoros.splice(i,1);
        }
    }
}

// ── EXPLOSÃO ──────────────────────────────────────────────────────────────────
const _explosoes=[];
const _geoExp=new THREE.SphereGeometry(0.14,4,4);

function criarExplosao(pos, cor) {
    const grupo=new THREE.Group(); grupo.position.copy(pos);
    const ps=[];
    for (let i=0; i<10; i++) {
        const mat=new THREE.MeshBasicMaterial({ color:cor, fog:false, transparent:true, opacity:1 });
        const p=new THREE.Mesh(_geoExp,mat);
        p.userData.vel=new THREE.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6);
        grupo.add(p); ps.push(p);
    }
    const luz=new THREE.PointLight(cor,5,9);
    grupo.add(luz); _scene.add(grupo);
    _explosoes.push({ grupo, ps, luz, frame:0 });
}

function atualizarExplosoes() {
    for (let i=_explosoes.length-1; i>=0; i--) {
        const e=_explosoes[i]; e.frame++;
        const op=1-e.frame/20;
        e.ps.forEach(p=>{ p.position.add(p.userData.vel); p.material.opacity=op; });
        e.luz.intensity=op*5;
        if (e.frame>=20) { _scene.remove(e.grupo); _explosoes.splice(i,1); }
    }
}

// ── LIMPAR ────────────────────────────────────────────────────────────────────
function limpar() {
    _naves.forEach(n=>_scene.remove(n.mesh));
    _pistaMesh.forEach(m=>_scene.remove(m));
    _particulas.forEach(p=>_scene.remove(p.mesh));
    _lasers.forEach(l=>_scene.remove(l));
    _lasersIA.forEach(l=>_scene.remove(l));
    _meteoros.forEach(m=>_scene.remove(m.mesh));
    _explosoes.forEach(e=>_scene.remove(e.grupo));
    _estrelasBZ.forEach(s=>_scene.remove(s));
    _diskos.forEach(d=>_scene.remove(d.mesh));
    _lasersDiskoArr.forEach(l=>_scene.remove(l));
    _naves=[]; _pistaMesh=[]; _particulas=[]; _lasers=[]; _lasersIA=[];
    _meteoros=[]; _explosoes.length=0; _estrelasBZ=[];
    _diskos=[]; _lasersDiskoArr=[];
    Object.keys(_vidaIA).forEach(k=>delete _vidaIA[k]);
    if (_hudEl) { _hudEl.remove(); _hudEl=null; }
    if (_dialogoEl) { _dialogoEl.remove(); _dialogoEl=null; }
    if (_dialogoTimer) { clearTimeout(_dialogoTimer); _dialogoTimer=null; }
    if (_miraEl) { _miraEl.remove(); _miraEl=null; }
    _pilotoAtual=null; _flashCount=0;
    _dialogoFila=[]; _dialogoAtivo=false;
    _lap3Ativo=false; _vidaPlayer=100; _tiroCD=0;
    _camModo='normal'; _flashAtivo=null;
    _camQuat = new THREE.Quaternion();
}

// ── CONTROLES ─────────────────────────────────────────────────────────────────
const _k={ w:false, s:false, a:false, d:false, boost:false };
let _kd=null, _ku=null, _mc=null, _mm=null;

function criarMira() {
    if (_miraEl) _miraEl.remove();
    _miraEl=document.createElement('div');
    _miraEl.id='bz-mira';
    _miraEl.innerHTML='<div class="bz-mira-anel"></div><div class="bz-mira-cruz bz-h"></div><div class="bz-mira-cruz bz-v"></div><div class="bz-mira-dot"></div>';
    document.body.appendChild(_miraEl);
}
function moverMira(e) {
    _mouseX=(e.clientX/window.innerWidth)*2-1;
    _mouseY=-(e.clientY/window.innerHeight)*2+1;
    if (_miraEl) { _miraEl.style.left=e.clientX+'px'; _miraEl.style.top=e.clientY+'px'; }
}
function removerMira() { if (_miraEl) { _miraEl.remove(); _miraEl=null; } }

function ligarControles() {
    _kd=e=>{
        const k=e.key.toLowerCase();
        if(k==='w'||k==='arrowup')    { _k.w=true;    e.preventDefault(); bzAudio.init(); }
        if(k==='s'||k==='arrowdown')  { _k.s=true;    e.preventDefault(); }
        if(k==='a'||k==='arrowleft')  { _k.a=true;    e.preventDefault(); }
        if(k==='d'||k==='arrowright') { _k.d=true;    e.preventDefault(); }
        if(k===' ')                   { _k.boost=true; e.preventDefault(); bzAudio.boost(); }
        if(k==='v') {
            const modos = ['normal','chase','fp'];
            const idx   = modos.indexOf(_camModo);
            _camModo    = modos[(idx+1) % modos.length];
            const labels = { normal:'📷 CAM NORMAL', chase:'📷 CHASE CAM', fp:'👁 1ª PESSOA' };
            flashEvento(labels[_camModo], '#00ddff');
            _atualizarIndicadorCam();
            e.preventDefault();
        }
        if(k==='escape') pararBZero();
    };
    _ku=e=>{
        const k=e.key.toLowerCase();
        if(k==='w'||k==='arrowup')    _k.w=false;
        if(k==='s'||k==='arrowdown')  _k.s=false;
        if(k==='a'||k==='arrowleft')  _k.a=false;
        if(k==='d'||k==='arrowright') _k.d=false;
        if(k===' ') _k.boost=false;
    };
    _mc=e=>{
        if(e.button===0){
            // Não interceptar cliques em botões/links da UI do jogo ou do portfólio
            const alvo = e.target;
            if(alvo && (alvo.tagName==='BUTTON'||alvo.tagName==='A'||alvo.closest('button')||alvo.closest('a'))) return;
            e.preventDefault();
            e.stopPropagation();
            atirarMouse();
        }
    };
    _mm=e=>moverMira(e);
    window.addEventListener('keydown',  _kd,{capture:true});
    window.addEventListener('keyup',    _ku,{capture:true});
    window.addEventListener('mousedown',_mc,{capture:true});
    window.addEventListener('mousemove',_mm);
}

function desligarControles() {
    if(_kd){window.removeEventListener('keydown',  _kd,{capture:true});_kd=null;}
    if(_ku){window.removeEventListener('keyup',    _ku,{capture:true});_ku=null;}
    if(_mc){window.removeEventListener('mousedown',_mc,{capture:true});_mc=null;}
    if(_mm){window.removeEventListener('mousemove',_mm);_mm=null;}
    Object.keys(_k).forEach(k=>_k[k]=false);
    removerMira();
    document.body.style.cursor='default';
}

function pararBZero() {
    _ativo=false; _correndo=false; _lap3Ativo=false;
    bzAudio.pararMotor();
    desligarControles(); limpar();
    ['bz-selecao','bz-instrucoes','bz-countdown','bz-resultado','bz-hud','bz-dialogo','bzero-style'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.remove();
    });
    // Remove quaisquer elementos do jogo residuais
    document.querySelectorAll('.bz-flash').forEach(el=>el.remove());
    document.querySelectorAll('[id^="bz-"]').forEach(el=>el.remove());
    document.body.style.cursor='default';
    document.body.style.overflow='';
    if(_controls) _controls.enabled = true;
    if(_onVoltar) { const cb=_onVoltar; _onVoltar=null; cb(); }
}

// ── CÂMERA ────────────────────────────────────────────────────────────────────
// Suavização de quaternion para 1ª pessoa (evita tremor no lookAt)
let _camQuat = new THREE.Quaternion();

function atualizarCam(player) {
    if (!player || !_camera) return;

    const pos  = player.mesh.position;
    const tang = pistaTang(player.t);
    const norm = pistaNormal(player.t);
    const lat  = pistaLat(player.t);

    if (_camModo === 'chase') {
        // ── Chase cam estilo Top Gear — baixa e grudada ───────────────────────
        _camH *= 0.94;
        const tras = tang.clone().negate().multiplyScalar(3.5);
        const dest = pos.clone().add(tras).addScaledVector(norm, 0.9 + _camH * 0.4);
        _camera.position.lerp(dest, 0.22);
        const lookAt = pos.clone()
            .addScaledVector(tang, 5.0)
            .addScaledVector(norm, 0.5);
        _camera.lookAt(lookAt);

    } else if (_camModo === 'fp') {
        // ── Primeira pessoa — dentro do cockpit ──────────────────────────────
        // Posição: cockpit fica em y≈+0.30, z≈-0.10 no espaço local da nave
        // Convertemos para espaço mundo via tangente/normal/lateral da pista

        // Base ortonormal da nave (igual à usada na orientação)
        const tNext = (player.t + 0.002) % 1;
        const tangNext = pistaTang(tNext);
        let upRaw = new THREE.Vector3().crossVectors(tang, tangNext);
        if (upRaw.lengthSq() < 1e-6) upRaw.set(0,1,0);
        else { upRaw.normalize(); if (upRaw.y < -0.1) upRaw.negate(); }
        // usa o upSmooth da nave para consistência
        const up = player.upSmooth.clone();
        const frente = tang.clone();
        const cima   = up.clone().sub(frente.clone().multiplyScalar(up.dot(frente))).normalize();
        const direita = new THREE.Vector3().crossVectors(frente, cima).normalize();

        // Ponto do cockpit no espaço mundo: +0.30 cima, -0.10 frente (nariz da nave), lat=0
        const cockpitPos = pos.clone()
            .addScaledVector(cima,   0.30)
            .addScaledVector(frente, 0.55); // um pouco à frente do centro

        // Oscilação sutil (suspensão da nave)
        const osc = Math.sin(_frame * 0.07) * 0.012;
        cockpitPos.addScaledVector(cima, osc);

        // Câmera teleporta direto (sem lerp) para evitar delay nauseante
        _camera.position.copy(cockpitPos);

        // Direção de olhar: tangente da pista (frente da nave)
        // Suaviza o quaternion do lookAt para evitar tremor
        const lookTarget = cockpitPos.clone().addScaledVector(frente, 10.0);
        const mx = new THREE.Matrix4().lookAt(cockpitPos, lookTarget, cima);
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(mx);
        _camQuat.slerp(targetQuat, 0.18);
        _camera.quaternion.copy(_camQuat);

    } else {
        // ── Câmera original — traseira alta ───────────────────────────────────
        _camH *= 0.96;
        const tras = tang.clone().negate().multiplyScalar(10);
        const dest = pos.clone().add(tras).addScaledVector(norm, 4.5 + _camH);
        _camera.position.lerp(dest, 0.10);
        _camera.lookAt(pos.clone().addScaledVector(norm, 1.0));
    }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function criarHUD() {
    if (_hudEl) _hudEl.remove();
    _hudEl=document.createElement('div');
    _hudEl.id='bz-hud';

    const p = _pilotoAtual;
    const avatarSrc = p && p.img
        ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        : '';
    const fallbackSpan = p ? `<span style="font-size:1.6em;display:${p.img?'none':'flex'};align-items:center;justify-content:center;width:100%;height:100%">${p.fallback}</span>` : '';
    const pilotoHex = p ? p.hex : '#00ff88';
    const pilotoNome = p ? p.nome : '—';

    _hudEl.innerHTML=`
        <div id="bz-topo">
            <div id="bz-titulo">★ B-ZERO 64 ★</div>
            <div id="bz-volta">VOLTA 1 / ${TOTAL_VOLTAS}</div>
            <div id="bz-tempo">00:00.00</div>
        </div>
        <div id="bz-ranking">
            <div id="bz-rank-tit">◆ POSIÇÕES ◆</div>
            <div id="bz-rank-lista"></div>
        </div>
        <div id="bz-speedo">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <div id="bz-pilot-avatar" style="width:52px;height:52px;border-radius:50%;border:2px solid ${pilotoHex}88;overflow:hidden;background:rgba(0,10,30,.8);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                    ${avatarSrc}${fallbackSpan}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="color:${pilotoHex};font-size:.6em;letter-spacing:2px;font-weight:bold;margin-bottom:2px;">${pilotoNome}</div>
                    <div id="bz-spd-lbl" style="color:#334455;font-size:.52em;letter-spacing:1px;">VELOCIDADE</div>
                    <div style="display:flex;align-items:baseline;gap:3px;">
                        <div id="bz-spd-val" style="color:#00eeff;font-size:1.5em;font-weight:bold;text-shadow:0 0 12px #00eeffcc;line-height:1;">000</div>
                        <div id="bz-spd-km" style="color:#445566;font-size:.55em;letter-spacing:1px;">km/h</div>
                    </div>
                </div>
            </div>
            <div id="bz-shield-lbl" style="color:#334455;font-size:.55em;letter-spacing:1px;margin-top:2px">SHIELD</div>
            <div id="bz-shield-bar" style="width:100%;height:5px;background:rgba(255,255,255,.1);border-radius:3px;margin-top:3px">
                <div id="bz-shield-fill" style="height:100%;width:100%;background:#00ff88;border-radius:3px;transition:width .2s,background .3s"></div>
            </div>
        </div>
        <div id="bz-lap3-warn" style="display:none;position:absolute;top:56px;right:14px;background:rgba(255,50,0,.18);border:1px solid rgba(255,80,0,.5);border-radius:7px;padding:7px 13px;color:#ff6622;font-size:.72em;letter-spacing:2px;text-align:center">⚠ METEOROS<br>DETECTADOS</div>
        <div id="bz-cam-ind" style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;pointer-events:none;">
            <div class="bz-cam-dot" data-cam="normal" title="Normal">◼</div>
            <div class="bz-cam-dot" data-cam="chase"  title="Chase">◼</div>
            <div class="bz-cam-dot" data-cam="fp"     title="1ª Pessoa">◼</div>
        </div>
    `;
    document.body.appendChild(_hudEl);
    _atualizarIndicadorCam();
}

function _atualizarIndicadorCam() {
    const dots = document.querySelectorAll('.bz-cam-dot');
    dots.forEach(d => {
        const ativo = d.dataset.cam === _camModo;
        d.style.color  = ativo ? '#00eeff' : 'rgba(255,255,255,.18)';
        d.style.textShadow = ativo ? '0 0 8px #00eeffcc' : 'none';
        d.style.fontSize = ativo ? '1.1em' : '0.75em';
        d.style.transition = 'all .2s';
    });
}

function atualizarHUD() {
    if (!_hudEl) return;
    const ord=[..._naves].sort((a,b)=>b.distTotal-a.distTotal);
    const lista=document.getElementById('bz-rank-lista');
    if(lista) lista.innerHTML=ord.map((n,i)=>{
        const idx=_naves.indexOf(n);
        const vidaStr=n.isPlayer
            ? ''
            : n.destruida
                ? `<span style="color:#ff4444;font-size:.72em">💥</span>`
                : `<span style="display:inline-block;width:30px;height:4px;background:rgba(255,255,255,.1);border-radius:2px;vertical-align:middle;margin-left:3px"><span style="display:block;height:100%;width:${_vidaIA[idx]||0}%;background:${(_vidaIA[idx]||0)>50?n.hex:'#ff4444'};border-radius:2px"></span></span>`;
        return `<div class="bz-rrow">
            <span class="bz-rpos">${i+1}°</span>
            <span class="bz-rnome" style="${n.isPlayer?'color:#ffcc00;font-weight:bold':''}">${n.nome}</span>
            ${vidaStr}
            <span class="bz-rvolt">V${Math.min(n.volta+1,TOTAL_VOLTAS)}</span>
        </div>`;
    }).join('');
    const player=_naves.find(n=>n.isPlayer);
    if(player){
        const vi=document.getElementById('bz-volta');
        if(vi) vi.textContent=`VOLTA ${Math.min(player.volta+1,TOTAL_VOLTAS)} / ${TOTAL_VOLTAS}`;
        const sv=document.getElementById('bz-spd-val');
        if(sv) sv.textContent=String(Math.round((player.velAtual/player.velMax)*999)).padStart(3,'0');
    }
    const fill=document.getElementById('bz-shield-fill');
    if(fill){ fill.style.width=_vidaPlayer+'%'; fill.style.background=_vidaPlayer>60?'#00ff88':_vidaPlayer>30?'#ffcc00':'#ff4400'; }
    const warn=document.getElementById('bz-lap3-warn');
    if(warn) warn.style.display=_lap3Ativo?'block':'none';
    if(_correndo){
        const ms=Date.now()-_tempoInicio;
        const mm=Math.floor(ms/60000),ss=Math.floor((ms%60000)/1000),cs=Math.floor((ms%1000)/10);
        const t=document.getElementById('bz-tempo');
        if(t) t.textContent=`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    }
}

let _flashCount = 0;
let _flashAtivo = null; // só um flash por vez
function flashEvento(texto, cor) {
    // Remove o flash anterior imediatamente se existir
    if (_flashAtivo) { _flashAtivo.remove(); _flashAtivo = null; }
    const el = document.createElement('div');
    el.className = 'bz-flash';
    el.style.cssText = `color:${cor};font-size:1.45em;text-shadow:0 0 14px ${cor},0 0 28px ${cor}66;top:42%`;
    el.textContent = texto;
    document.body.appendChild(el);
    _flashAtivo = el;
    setTimeout(() => { el.remove(); if(_flashAtivo===el) _flashAtivo=null; }, 1600);
}

function countdown(onGo) {
    const wrap=document.createElement('div'); wrap.id='bz-countdown';
    const num=document.createElement('div');  num.id='bz-cd-num';
    wrap.appendChild(num); document.body.appendChild(wrap);
    let v=3; num.textContent=v; bzAudio.ui('countdown');
    const iv=setInterval(()=>{
        v--; num.style.animation='none'; num.offsetHeight;
        num.style.animation='bz-cdpulse .85s ease-in-out';
        if(v>0){num.textContent=v; bzAudio.ui('countdown');}
        else{num.textContent='GO!!';num.classList.add('go');bzAudio.ui('go');clearInterval(iv);setTimeout(()=>{wrap.remove();onGo();},750);}
    },950);
}

function mostrarGameOver() {
    _correndo = false;
    desligarControles();
    const ms = Date.now() - _tempoInicio;
    const mm = Math.floor(ms/60000), ss = Math.floor((ms%60000)/1000), cs = Math.floor((ms%1000)/10);
    const tStr = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    const el = document.createElement('div'); el.id = 'bz-resultado';
    el.innerHTML = `
        <div id="bz-res-box" style="border-color:rgba(255,50,0,.7);box-shadow:0 0 80px rgba(255,30,0,.35)">
            <div id="bz-res-titulo" style="color:#ff4400;text-shadow:0 0 18px #ff440099">💀 GAME OVER 💀</div>
            <div id="bz-res-pos" style="color:#ff2200;font-size:2.8em">NAVE DESTRUÍDA</div>
            <div id="bz-res-tempo" style="color:#ff6644">SOBREVIVEU: ${tStr}</div>
            <div style="color:#556677;font-size:.72em;letter-spacing:1px;margin:14px 0 8px">SUA NAVE FOI ELIMINADA DA CORRIDA</div>
            <button id="bz-res-voltar" style="border-color:rgba(255,80,0,.4);color:#ff8844">◀ VOLTAR AO PORTFÓLIO</button>
            <button id="bz-res-tentar" style="display:block;width:100%;margin-top:8px;background:rgba(8,24,8,.9);border:1px solid rgba(124,255,124,.38);border-radius:6px;color:#7CFF7C;font-family:'Courier New',monospace;font-size:.88em;letter-spacing:3px;padding:11px 0;cursor:pointer">▶ TENTAR DE NOVO</button>
        </div>`;
    document.body.appendChild(el);
    document.getElementById('bz-res-voltar').addEventListener('click', () => { el.remove(); pararBZero(); });
    document.getElementById('bz-res-tentar').addEventListener('click', () => {
        el.remove();
        _reiniciarJogo();
    });
}

function _reiniciarJogo() {
    // Para o motor e reseta o áudio antes de qualquer outra coisa
    bzAudio.resetar();

    // Limpa estado sem chamar _onVoltar
    _ativo=false; _correndo=false; _lap3Ativo=false; _frame=0; _camH=0; _vidaPlayer=100; _tiroCD=0;
    desligarControles();
    limpar();
    ['bz-selecao','bz-instrucoes','bz-countdown','bz-resultado','bz-hud','bz-dialogo'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.remove();
    });
    document.querySelectorAll('.bz-flash').forEach(e=>e.remove());
    document.querySelectorAll('[id^="bz-"]').forEach(e=>{ if(e.id!=='bzero-style') e.remove(); });
    document.body.style.cursor='default';

    // Restaura estado ativo e callback original antes de reiniciar
    _ativo = true;
    _onVoltar = _onVoltarOrig;
    if(_controls) _controls.enabled = false;

    // Reinicia o fluxo de seleção
    mostrarSelecao(pilotoIdx=>{
        _pilotoAtual = PILOTOS[pilotoIdx];
        criarEstrelasBZ();
        criarPistaVisual();
        criarNaves(pilotoIdx);
        criarHUD();
        criarDialogoEl();
        ligarControles();

        const posL=pistaPos(PISTA_T_LARGADA), tangL=pistaTang(PISTA_T_LARGADA), normL=pistaNormal(PISTA_T_LARGADA);
        const camS=posL.clone()
            .add(tangL.clone().negate().multiplyScalar(28))
            .addScaledVector(normL,12);
        _camera.position.copy(camS);
        _camera.lookAt(posL.x, posL.y+1.0, posL.z);

        criarMira();
        document.body.style.cursor='none';
        mostrarInstrucoes(()=>{
            countdown(()=>{
                _tempoInicio=Date.now();
                _correndo=true;
                setTimeout(()=>mostrarDialogo(_pilotoAtual,'largada'), 600);
            });
        });
    });
}

function destruirPlayer() {
    if (!_correndo) return;
    const player = _naves.find(n => n.isPlayer);
    if (!player || player.destruida) return;
    player.destruida = true;
    player.chegou    = true;
    _correndo        = false;
    bzAudio.pararMotor();

    // Explosão grande — múltiplas ondas
    bzAudio.explosao(1.0);
    for (let w = 0; w < 4; w++) {
        setTimeout(() => {
            criarExplosao(player.mesh.position.clone(), 0xff4400);
            criarExplosao(player.mesh.position.clone().add(new THREE.Vector3((Math.random()-.5)*3,(Math.random()-.5)*3,(Math.random()-.5)*3)), 0xffcc00);
            criarExplosao(player.mesh.position.clone().add(new THREE.Vector3((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2)), 0xffffff);
        }, w * 180);
    }
    setTimeout(() => { _scene.remove(player.mesh); }, 300);
    setTimeout(() => mostrarDialogo(_pilotoAtual,'derrota'), 400);
    setTimeout(() => bzAudio.derrota(), 600);
    setTimeout(() => { mostrarGameOver(); }, 2000);
}

function destruirNaveIA(n, j) {
    if (n.destruida) return;
    n.destruida = true;
    n.chegou    = true;

    // Captura posição/cor/nome ANTES de qualquer setTimeout
    const posCapturada = n.mesh.position.clone();
    const corCapturada = n.cor;
    const nomeCapturado = n.nome;

    bzAudio.explosao(0.85);
    for (let w = 0; w < 3; w++) {
        setTimeout(() => {
            criarExplosao(posCapturada.clone(), corCapturada);
            criarExplosao(posCapturada.clone().add(new THREE.Vector3((Math.random()-.5)*3,(Math.random()-.5)*3,(Math.random()-.5)*3)), 0xffffff);
        }, w * 150);
    }
    setTimeout(() => {
        _scene.remove(n.mesh);
        // Spawna o disco JÁ próximo ao player (atrás dele) para aparecer na tela imediatamente
        const player = _naves.find(p => p.isPlayer);
        let spawnPos = posCapturada.clone();
        if (player && player.mesh) {
            // Aparece 8u atrás do player
            const tang = pistaTang(player.t);
            spawnPos = player.mesh.position.clone()
                .addScaledVector(tang.negate(), 8)
                .add(new THREE.Vector3((Math.random()-.5)*4, 2+Math.random()*2, (Math.random()-.5)*4));
        }
        _spawnDisko(spawnPos, corCapturada, nomeCapturado);
    }, 380);
    flashEvento(`💥 ${nomeCapturado} DESTRUÍDA!`, n.hex);
    setTimeout(()=>mostrarDialogo(_pilotoAtual,'destruiuIA'), 400);
}

// ── DISCOS FANTASMAS ──────────────────────────────────────────────────────────
// Mini disco voador que persegue e atira no player após a nave ser destruída
const _geoDisko = new THREE.CylinderGeometry(0.9, 0.9, 0.22, 14);
const _geoDiskoTopo = new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI*2, 0, Math.PI*0.5);
let _lasersDiskoArr = []; // lasers específicos dos discos

function _spawnDisko(posInicial, cor, nome) {
    if (!_scene) return; // só protege contra cena nula
    const grupo = new THREE.Group();

    const corObj   = new THREE.Color(cor);
    const corClamp = corObj.clone().multiplyScalar(1.3).convertSRGBToLinear();
    const corBrilhoHex = corClamp.getHex();

    const disco = new THREE.Mesh(_geoDisko,
        new THREE.MeshBasicMaterial({ color: cor, fog: false, transparent: true, opacity: 0.88 }));
    grupo.add(disco);

    const topo = new THREE.Mesh(_geoDiskoTopo,
        new THREE.MeshBasicMaterial({ color: corBrilhoHex, fog: false, transparent: true, opacity: 0.75 }));
    topo.position.y = 0.11;
    grupo.add(topo);

    // Anel brilhante
    const anel = new THREE.Mesh(
        new THREE.TorusGeometry(0.92, 0.07, 6, 18),
        new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.55 })
    );
    anel.rotation.x = Math.PI / 2;
    grupo.add(anel);

    // Luz pulsante embaixo
    const luz = new THREE.PointLight(cor, 4, 10);
    luz.position.y = -0.3;
    grupo.add(luz);

    grupo.position.copy(posInicial);
    _scene.add(grupo);

    _diskos.push({
        mesh: grupo,
        luz,
        cor,
        nome,
        vel: new THREE.Vector3(),
        cdTiro: 0,
        frame: 0,
        ativo: true,
    });

    flashEvento(`☠ ${nome} VIROU DISCO!`, new THREE.Color(cor).getStyle());
}

function atualizarDiskos() {
    const player = _naves.find(n => n.isPlayer);

    for (let i = _diskos.length - 1; i >= 0; i--) {
        const d = _diskos[i];
        if (!d.ativo) continue;
        d.frame++;

        // ── Perseguição: voa ACIMA da nave do player ─────────────────────────
        if (player && player.mesh && !player.destruida && !player.chegou) {
            // Alvo = posição do player + offset acima
            const alvoBase = player.mesh.position.clone();
            alvoBase.y += 3.5 + Math.sin(d.frame * 0.05) * 0.8; // flutua entre 2.7u e 4.3u acima

            const dir  = alvoBase.clone().sub(d.mesh.position).normalize();
            const dist = d.mesh.position.distanceTo(alvoBase);

            // Velocidade: sempre supera o player (velMax*1.28 boost ≈ 0.46 u/frame)
            const speed = dist < 4 ? 0.15 : 0.62 + Math.min(dist * 0.005, 0.20);
            d.vel.lerp(dir.clone().multiplyScalar(speed), 0.14);
            d.mesh.position.add(d.vel);

            // Rotação do disco no eixo Y (efeito prato voador)
            d.mesh.rotation.y += 0.10;
            d.luz.intensity = 4 + Math.sin(d.frame * 0.20) * 2;

            // ── Dispara míssil quando está perto ─────────────────────────────
            d.cdTiro = (d.cdTiro || 60) - 1;
            if (d.cdTiro <= 0 && dist < 80) {
                d.cdTiro = 32 + Math.floor(Math.random() * 18);
                _atirarDisko(d, player);
            }
        }
    }

    // ── Lasers/mísseis dos discos ─────────────────────────────────────────────
    const player2 = player; // referência limpa para o bloco abaixo
    for (let i = _lasersDiskoArr.length - 1; i >= 0; i--) {
        const l = _lasersDiskoArr[i];
        l.userData.vida--;

        // Míssil homing: corrige direção a cada frame em direção ao player
        if (player2 && player2.mesh && !player2.destruida) {
            const toPlayer = player2.mesh.position.clone().sub(l.position).normalize();
            l.userData.vel.lerp(toPlayer.multiplyScalar(1.9), 0.04); // leve homing
        }

        l.position.addScaledVector(l.userData.vel, 1);

        if (player2 && player2.mesh && !player2.destruida && !player2.chegou) {
            if (l.position.distanceTo(player2.mesh.position) < 2.5) {
                const dano = Math.round(7 * DIFF_CFG[_dificuldade].iaDanoMult);
                const vidaAntes = _vidaPlayer;
                _vidaPlayer = Math.max(0, _vidaPlayer - dano);
                criarExplosao(l.position.clone(), 0xff00ff);
                bzAudio.dano();
                flashEvento(`☠ -${dano}`, '#dd00ff');
                atualizarHUD();
                if (_vidaPlayer <= 30 && vidaAntes > 30) setTimeout(() => mostrarDialogo(_pilotoAtual, 'vidaBaixa'), 300);
                if (_vidaPlayer <= 0) destruirPlayer();
                _scene.remove(l);
                _lasersDiskoArr.splice(i, 1);
                continue;
            }
        }
        if (l.userData.vida <= 0) { _scene.remove(l); _lasersDiskoArr.splice(i, 1); }
    }
}

function _atirarDisko(d, player) {
    const origem = d.mesh.position.clone();
    const alvo   = player.mesh.position.clone();
    const dir    = alvo.clone().sub(origem).normalize();

    // Míssil: esfera brilhante magenta — bem visível
    const geo  = new THREE.SphereGeometry(0.28, 7, 7);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff00ff, fog: false });
    const miss = new THREE.Mesh(geo, mat);
    miss.position.copy(origem);

    // Luz de rastro
    const lLuz = new THREE.PointLight(0xff00ff, 5, 8);
    miss.add(lLuz);

    miss.userData = {
        vel:  dir.clone().multiplyScalar(1.6), // velocidade inicial
        vida: 120,
    };
    _scene.add(miss);
    _lasersDiskoArr.push(miss);
    bzAudio.tiroIA();
}

function mostrarResultado() {
    desligarControles();
    const ms=Date.now()-_tempoInicio;
    const mm=Math.floor(ms/60000),ss=Math.floor((ms%60000)/1000),cs=Math.floor((ms%1000)/10);
    const tStr=`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    const ord=[..._naves].sort((a,b)=>b.distTotal-a.distTotal);
    const pos=ord.findIndex(n=>n.isPlayer)+1;
    const med=pos===1?'🥇':pos===2?'🥈':pos===3?'🥉':'💀';
    const msg=pos===1?'VITÓRIA!!':pos===2?'2° LUGAR!':pos===3?'3° LUGAR!':`${pos}° LUGAR`;
    const corP=pos===1?'#ffcc00':pos<=3?'#aaccff':'#ff4444';
    const el=document.createElement('div'); el.id='bz-resultado';
    el.innerHTML=`
        <div id="bz-res-box">
            <div id="bz-res-titulo">★ CORRIDA ENCERRADA ★</div>
            <div id="bz-res-pos" style="color:${corP}">${med} ${msg}</div>
            <div id="bz-res-tempo">TEMPO: ${tStr}</div>
            ${ord.map((n,i)=>`<div class="bz-res-row">
                <span class="bz-res-p">${i+1}°</span>
                <span class="bz-res-n" style="${n.isPlayer?'color:#ffcc00;font-weight:bold':''}">${n.nome}</span>
                <span class="bz-res-t">${n.isPlayer?tStr:'---'}</span>
            </div>`).join('')}
            <button id="bz-res-voltar">◀ VOLTAR AO PORTFÓLIO</button>
            <button id="bz-res-tentar" style="display:block;width:100%;margin-top:8px;background:rgba(8,24,8,.9);border:1px solid rgba(124,255,124,.38);border-radius:6px;color:#7CFF7C;font-family:'Courier New',monospace;font-size:.88em;letter-spacing:3px;padding:11px 0;cursor:pointer">▶ JOGAR DE NOVO</button>
        </div>`;
    document.body.appendChild(el);
    document.getElementById('bz-res-voltar').addEventListener('click',()=>{el.remove();pararBZero();});
    document.getElementById('bz-res-tentar').addEventListener('click',()=>{el.remove();_reiniciarJogo();});
}

function mostrarSelecao(onConfirmar) {
    const el=document.createElement('div'); el.id='bz-selecao';

    // Gera o avatar: imagem real se disponível, senão fallback estilizado
    function avatarHTML(p) {
        if (p.img) {
            return `<div class="bz-avatar-wrap" style="border-color:${p.hex}55">
                        <img class="bz-avatar-img" src="${p.img}" alt="${p.nome}" onerror="this.parentNode.innerHTML='<span class=bz-avatar-fb>${p.fallback}</span>'">
                    </div>`;
        }
        return `<div class="bz-avatar-wrap" style="border-color:${p.hex}55">
                    <span class="bz-avatar-fb">${p.fallback}</span>
                </div>`;
    }

    const cards=PILOTOS.map((p,i)=>{
        const vP=Math.round((p.vel /0.00060)*100);
        const mP=Math.round((p.max /0.00108)*100);
        const aP=Math.round((p.acel/1.30e-6)*100);
        const shP=72; // shield padrão para todos
        return `<div class="bz-card${i===0?' act':''}" data-idx="${i}" style="--card-clr:${p.hex};border-top:3px solid ${p.hex}88">
            ${avatarHTML(p)}
            <div class="bz-card-tag" style="color:${p.hex};border-color:${p.hex}44">${p.tag}</div>
            <div class="bz-card-nome" style="text-shadow:0 0 12px ${p.hex}66">${p.nome}</div>
            <div class="bz-card-sub">${p.sub}</div>
            <div class="bz-card-lore">${p.lore}</div>
            <div class="bz-stats-sep"></div>
            <div class="bz-stat"><span class="bz-stat-lbl">VEL</span><div class="bz-stat-bar"><div class="bz-stat-fill" style="width:${vP}%;background:${p.hex}"></div></div><span class="bz-stat-val">${vP}</span></div>
            <div class="bz-stat"><span class="bz-stat-lbl">MAX</span><div class="bz-stat-bar"><div class="bz-stat-fill" style="width:${mP}%;background:${p.hex}"></div></div><span class="bz-stat-val">${mP}</span></div>
            <div class="bz-stat"><span class="bz-stat-lbl">ACEL</span><div class="bz-stat-bar"><div class="bz-stat-fill" style="width:${aP}%;background:${p.hex}"></div></div><span class="bz-stat-val">${aP}</span></div>
            <div class="bz-stat"><span class="bz-stat-lbl">SHIELD</span><div class="bz-stat-bar"><div class="bz-stat-fill" style="width:${shP}%;background:${p.hex}"></div></div><span class="bz-stat-val">${shP}</span></div>
        </div>`;
    }).join('');

    el.innerHTML=`
        <div id="bz-sel-box">
            <div id="bz-sel-header">
                <div id="bz-sel-titulo">★ B-ZERO 64 ★</div>
                <div id="bz-sel-sub">SELECIONE SEU PILOTO — APENAS UM SOBREVIVERÁ</div>
            </div>
            <div class="bz-grid">${cards}</div>
            <div id="bz-diff-row">
                <span class="bz-diff-lbl">DIFICULDADE:</span>
                <button class="bz-diff-btn" data-diff="facil">🟢 FÁCIL</button>
                <button class="bz-diff-btn act" data-diff="normal">🟡 NORMAL</button>
                <button class="bz-diff-btn" data-diff="dificil">🔴 DIFÍCIL</button>
            </div>
            <button id="bz-sel-start">▶ ENTRAR NA CORRIDA</button>
            <div id="bz-sel-dica">CLIQUE em um piloto para selecionar · ESC para cancelar</div>
        </div>`;
    document.body.appendChild(el);

    let sel=0;
    el.querySelectorAll('.bz-card').forEach(c=>c.addEventListener('click',()=>{
        el.querySelectorAll('.bz-card').forEach(x=>x.classList.remove('act'));
        c.classList.add('act'); sel=parseInt(c.dataset.idx);
    }));
    el.querySelectorAll('.bz-diff-btn').forEach(b=>b.addEventListener('click',()=>{
        el.querySelectorAll('.bz-diff-btn').forEach(x=>x.classList.remove('act'));
        b.classList.add('act'); _dificuldade=b.dataset.diff;
    }));
    document.getElementById('bz-sel-start').addEventListener('click',()=>{el.remove();onConfirmar(sel);});
    const esc=e=>{if(e.key==='Escape'){window.removeEventListener('keydown',esc);el.remove();pararBZero();}};
    window.addEventListener('keydown',esc);
}

function mostrarInstrucoes(onStart) {
    const diffLabel = _dificuldade==='facil'?'🟢 FÁCIL':_dificuldade==='dificil'?'🔴 DIFÍCIL':'🟡 NORMAL';
    const el=document.createElement('div'); el.id='bz-instrucoes';
    el.innerHTML=`
        <div id="bz-inst-box">
            <div id="bz-inst-titulo">★ B-ZERO 64 ★</div>
            <div id="bz-inst-sub">${TOTAL_VOLTAS} VOLTAS · DUPLO OVAL · 2 LOOPS · ${diffLabel}</div>
            <div class="bz-inst-row"><span class="bz-inst-key">W / ↑</span><span class="bz-inst-desc">Acelerar</span></div>
            <div class="bz-inst-row"><span class="bz-inst-key">S / ↓</span><span class="bz-inst-desc">Freiar</span></div>
            <div class="bz-inst-row"><span class="bz-inst-key">A / ←</span><span class="bz-inst-desc">Faixa esquerda</span></div>
            <div class="bz-inst-row"><span class="bz-inst-key">D / →</span><span class="bz-inst-desc">Faixa direita</span></div>
            <div class="bz-inst-row"><span class="bz-inst-key">ESPAÇO</span><span class="bz-inst-desc">Boost turbo!</span></div>
            <div class="bz-inst-row"><span class="bz-inst-key">CLIQUE</span><span class="bz-inst-desc">Atirar laser!</span></div>
            <div class="bz-inst-row"><span class="bz-inst-key">V</span><span class="bz-inst-desc">Câmera Chase / Normal</span></div>
            <div class="bz-inst-row"><span class="bz-inst-key">ESC</span><span class="bz-inst-desc">Abandonar</span></div>
            <div style="margin-top:12px;padding:9px 12px;background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.3);border-radius:5px;color:#00ddff;font-size:.72em;letter-spacing:1px">
                🔄 LOOP 1 no corredor central · LOOP 2 no lobo direito
            </div>
            <div style="margin-top:8px;padding:9px 12px;background:rgba(255,80,0,.1);border:1px solid rgba(255,100,0,.3);border-radius:5px;color:#ff8844;font-size:.72em;letter-spacing:1px">
                ⚠ Na 3ª volta meteoros invadem a pista!
            </div>
            <button id="bz-inst-start">DO A BARREL ROLL!</button>
        </div>`;
    document.body.appendChild(el);
    document.getElementById('bz-inst-start').addEventListener('click',()=>{el.remove();onStart();});
}

// ── ESTILOS ───────────────────────────────────────────────────────────────────
function injetarEstilos() {
    if(document.getElementById('bzero-style')) return;
    const s=document.createElement('style'); s.id='bzero-style';
    s.textContent=`
#bz-mira{position:fixed;pointer-events:none;z-index:9600;transform:translate(-50%,-50%)}
.bz-mira-anel{position:absolute;width:28px;height:28px;border:2px solid #00ffff;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%);opacity:.85;box-shadow:0 0 8px #00ffff88;animation:bz-mirapulse 1.2s ease-in-out infinite}
@keyframes bz-mirapulse{0%,100%{opacity:.7;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}}
.bz-mira-cruz{position:absolute;background:#00ffff;top:50%;left:50%;opacity:.7}
.bz-h{width:14px;height:1px;transform:translate(-50%,-50%)}
.bz-v{width:1px;height:14px;transform:translate(-50%,-50%)}
.bz-mira-dot{position:absolute;width:4px;height:4px;background:#00ffff;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%)}
@keyframes bz-fadein{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes bz-cdpulse{0%{transform:scale(1.35);opacity:.5}100%{transform:scale(1);opacity:1}}
@keyframes bz-flashup{0%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}65%{opacity:1;transform:translate(-50%,-68%) scale(1)}100%{opacity:0;transform:translate(-50%,-90%) scale(.9)}}
#bz-selecao{position:fixed;inset:0;z-index:9000;background:radial-gradient(ellipse at 50% 30%, #060d20 0%, #020408 100%);display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;animation:bz-fadein .3s ease;overflow-y:auto;padding:16px 0}
#bz-sel-box{width:min(96vw,820px);display:flex;flex-direction:column;align-items:center;gap:0}
#bz-sel-header{text-align:center;margin-bottom:22px}
#bz-sel-titulo{color:#ffcc00;font-size:1.5em;letter-spacing:6px;text-shadow:0 0 24px #ffcc0099,0 0 48px #ffaa0044;margin-bottom:6px}
#bz-sel-sub{color:#2a4a6a;font-size:.63em;letter-spacing:3px;text-transform:uppercase}
.bz-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:100%;margin-bottom:20px}
@media(max-width:640px){.bz-grid{grid-template-columns:repeat(2,1fr)}}
.bz-card{background:linear-gradient(160deg,#040c1e,#080f24);border:1px solid rgba(0,160,255,.18);border-radius:10px;padding:16px 12px 14px;cursor:pointer;text-align:center;transition:border-color .18s,background .18s,transform .12s,box-shadow .18s;position:relative;overflow:hidden}
.bz-card::before{content:'';position:absolute;inset:0;background:linear-gradient(160deg,var(--card-clr,#4488ff)08,transparent 60%);pointer-events:none;opacity:0;transition:opacity .2s}
.bz-card:hover{border-color:rgba(0,220,255,.5);transform:translateY(-4px) scale(1.01);box-shadow:0 8px 32px rgba(0,180,255,.14)}
.bz-card:hover::before{opacity:1}
.bz-card.act{border-color:var(--card-clr,#ffcc00) !important;background:linear-gradient(160deg,#0d1830,#0a1228);box-shadow:0 0 28px rgba(0,120,255,.18),inset 0 0 20px rgba(0,80,200,.08)}
.bz-card.act::before{opacity:1}
.bz-avatar-wrap{width:88px;height:88px;border-radius:50%;border:2px solid rgba(255,255,255,.1);margin:0 auto 10px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,20,50,.6);flex-shrink:0}
.bz-avatar-img{width:100%;height:100%;object-fit:cover;object-position:top center}
.bz-avatar-fb{font-size:2.6em;line-height:1}
.bz-card-tag{font-size:.6em;letter-spacing:3px;border:1px solid;border-radius:3px;padding:1px 7px;display:inline-block;margin-bottom:7px;opacity:.8}
.bz-card-nome{color:#ddeeff;font-size:.95em;font-weight:bold;letter-spacing:3px;margin-bottom:4px}
.bz-card-sub{color:#334a60;font-size:.6em;margin-bottom:7px;line-height:1.5;letter-spacing:.5px}
.bz-card-lore{color:#445566;font-size:.6em;font-style:italic;line-height:1.55;margin-bottom:10px;min-height:36px}
.bz-stats-sep{height:1px;background:rgba(255,255,255,.06);margin-bottom:8px}
.bz-stat{display:flex;align-items:center;gap:5px;margin-bottom:5px;font-size:.62em}
.bz-stat-lbl{color:#2a4050;min-width:38px;text-align:left;letter-spacing:.5px}
.bz-stat-bar{flex:1;height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden}
.bz-stat-fill{height:100%;border-radius:2px;transition:width .4s ease}
.bz-stat-val{color:#334455;min-width:22px;text-align:right}
#bz-sel-start{display:block;width:100%;max-width:380px;background:linear-gradient(to bottom,#16401a,#0d2811);border:1px solid rgba(100,255,100,.4);border-radius:7px;color:#7CFF7C;font-family:'Courier New',monospace;font-size:1em;letter-spacing:4px;padding:14px 0;cursor:pointer;text-shadow:0 0 10px #7CFF7C66;transition:background .15s,box-shadow .2s;margin:0 auto}
#bz-sel-start:hover{background:linear-gradient(to bottom,#1e5225,#112e17);box-shadow:0 0 32px rgba(100,255,100,.22)}
#bz-sel-dica{color:#1a2a3a;font-size:.62em;text-align:center;margin-top:12px;letter-spacing:1px}
#bz-diff-row{display:flex;align-items:center;gap:10px;margin:0 auto 14px;flex-wrap:wrap;justify-content:center}
.bz-diff-lbl{color:#2a4a6a;font-size:.68em;letter-spacing:2px;flex-shrink:0}
.bz-diff-btn{background:rgba(10,20,40,.8);border:1px solid rgba(0,140,255,.25);border-radius:5px;color:#446688;font-family:'Courier New',monospace;font-size:.72em;letter-spacing:2px;padding:6px 14px;cursor:pointer;transition:all .15s}
.bz-diff-btn:hover{border-color:rgba(0,200,255,.5);color:#88ccee}
.bz-diff-btn.act{border-color:#ffcc00;color:#ffcc00;background:rgba(40,30,0,.6);box-shadow:0 0 14px rgba(255,200,0,.2)}
#bz-instrucoes{position:fixed;inset:0;z-index:9000;background:rgba(0,0,8,.94);display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;animation:bz-fadein .2s ease}
#bz-inst-box{background:linear-gradient(155deg,#05091a,#0a1530);border:2px solid rgba(0,200,255,.4);border-radius:10px;padding:28px 34px;width:min(94vw,460px);box-shadow:0 0 50px rgba(0,140,255,.18)}
#bz-inst-titulo{color:#ffcc00;font-size:1.1em;letter-spacing:5px;text-align:center;text-shadow:0 0 14px #ffcc0088;margin-bottom:3px}
#bz-inst-sub{color:#335566;font-size:.67em;letter-spacing:2px;text-align:center;margin-bottom:18px}
.bz-inst-row{display:flex;gap:12px;align-items:flex-start;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.8em}
.bz-inst-row:last-of-type{border:none}
.bz-inst-key{background:rgba(0,140,255,.1);border:1px solid rgba(0,160,255,.3);border-radius:4px;padding:2px 9px;color:#00ccff;font-size:.78em;min-width:90px;text-align:center;letter-spacing:1px;white-space:nowrap;flex-shrink:0}
.bz-inst-desc{color:#99bbcc;line-height:1.4}
#bz-inst-start{display:block;width:100%;margin-top:16px;background:linear-gradient(to bottom,#101e40,#080f28);border:1px solid rgba(0,200,255,.4);border-radius:6px;color:#00eeff;font-family:'Courier New',monospace;font-size:.95em;letter-spacing:3px;padding:12px 0;cursor:pointer;transition:background .15s}
#bz-inst-start:hover{background:linear-gradient(to bottom,#152548,#0c1330)}
#bz-countdown{position:fixed;inset:0;z-index:9000;pointer-events:none;display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace}
#bz-cd-num{font-size:8em;font-weight:bold;letter-spacing:4px;color:#ffcc00;text-shadow:0 0 40px #ffcc00,0 0 80px #ff8800;animation:bz-cdpulse .85s ease-in-out}
#bz-cd-num.go{color:#00ff88;text-shadow:0 0 40px #00ff88,0 0 80px #00cc44}
#bz-hud{position:fixed;inset:0;z-index:8000;pointer-events:none;font-family:'Courier New',monospace}
#bz-topo{position:absolute;top:0;left:0;right:0;height:48px;background:linear-gradient(to bottom,rgba(0,0,0,.9),transparent);display:flex;align-items:center;justify-content:space-between;padding:0 20px}
#bz-titulo{color:#ffcc00;font-size:1em;font-weight:bold;letter-spacing:5px;text-shadow:0 0 12px #ffcc00aa}
#bz-volta{color:#cceeff;font-size:.85em;letter-spacing:2px}
#bz-tempo{color:#00eeff;font-size:.88em;letter-spacing:2px;font-variant-numeric:tabular-nums}
#bz-ranking{position:absolute;top:56px;left:14px;background:rgba(0,0,0,.72);border:1px solid rgba(0,200,255,.22);border-radius:7px;padding:8px 12px;min-width:160px}
#bz-rank-tit{color:#00aacc;font-size:.68em;letter-spacing:3px;text-align:center;margin-bottom:6px}
.bz-rrow{display:flex;gap:7px;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.76em}
.bz-rrow:last-child{border:none}
.bz-rpos{color:#ffcc00;font-weight:bold;min-width:20px}
.bz-rnome{color:#cce8ff;flex:1}
.bz-rvolt{color:#557799;font-size:.85em}
#bz-speedo{position:absolute;bottom:20px;right:20px;background:rgba(0,0,0,.82);border:1px solid rgba(0,200,255,.28);border-radius:10px;padding:10px 14px;min-width:150px}
.bz-flash{position:fixed;left:50%;transform:translate(-50%,-50%);font-family:'Courier New',monospace;font-weight:bold;letter-spacing:3px;pointer-events:none;z-index:9500;animation:bz-flashup 1.6s ease-out forwards;white-space:nowrap}
#bz-dialogo{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:8500;pointer-events:none;font-family:'Courier New',monospace;}
#bz-resultado{position:fixed;inset:0;z-index:9000;background:rgba(0,0,8,.94);display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;animation:bz-fadein .3s ease}
#bz-res-box{background:linear-gradient(155deg,#05091a,#0a1530);border:2px solid rgba(0,200,255,.4);border-radius:10px;padding:30px 40px;width:min(94vw,380px);text-align:center;box-shadow:0 0 60px rgba(0,150,255,.2)}
#bz-res-titulo{color:#ffcc00;font-size:1.1em;letter-spacing:5px;text-shadow:0 0 16px #ffcc0088;margin-bottom:8px}
#bz-res-pos{font-size:3.8em;font-weight:bold;margin:8px 0 4px}
#bz-res-tempo{color:#00eeff;font-size:.82em;letter-spacing:2px;margin-bottom:18px}
.bz-res-row{display:flex;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.8em;text-align:left}
.bz-res-row:last-of-type{border:none}
.bz-res-p{color:#ffcc00;font-weight:bold;min-width:24px}
.bz-res-n{color:#cce8ff;flex:1}
.bz-res-t{color:#557799}
#bz-res-voltar{display:block;width:100%;margin-top:22px;background:rgba(8,12,24,.9);border:1px solid rgba(124,255,124,.38);border-radius:6px;color:#7CFF7C;font-family:'Courier New',monospace;font-size:.88em;letter-spacing:3px;padding:11px 0;cursor:pointer;transition:background .15s}
#bz-res-voltar:hover{background:rgba(16,32,18,.9)}
#bz-res-tentar:hover{background:rgba(16,40,16,.9)}
#bz-cam-ind{font-family:'Courier New',monospace;letter-spacing:4px}
.bz-cam-dot{transition:all .22s ease;display:inline-block}
`;
    document.head.appendChild(s);
}

// ══════════════════════════════════════════════════════════════════════════════
//  LOOP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export function atualizarBZero64() {
    if(!_ativo) return;
    atualizarParticulas();
    atualizarExplosoes();
    atualizarDiskos();       // discos rodam sempre que o jogo está ativo
    if(!_correndo) return;

    _frame++;
    if(_tiroCD>0) _tiroCD--;
    atualizarTiroIA();

    // Animar PC gigante (pulsar luz neon em sync com o frame)
    _pistaMesh.forEach(m => {
        if (m.userData && m.userData.isMonitor) {
            const pulse = 0.5 + 0.5 * Math.sin(_frame * 0.06);
            if (m.userData.monitorLuz1) m.userData.monitorLuz1.intensity = 7 + pulse * 6;
            if (m.userData.monitorLuz2) m.userData.monitorLuz2.intensity = 3 + pulse * 4;
        }
    });

    const player=_naves.find(n=>n.isPlayer);
    atualizarLasers();
    atualizarMeteoros();

    // Atualiza som do motor a cada frame (suave via AudioContext)
    if (player && _correndo && _frame % 3 === 0) {
        bzAudio.motor(player.velAtual, player.velMax * 1.28);
    }

    _naves.forEach((nave,idx)=>{
        if(nave.chegou) return;

        if(nave.isPlayer){
            if     (_k.w) nave.velAtual=Math.min(nave.velAtual+nave.acel*4.5, nave.velMax);
            else if(_k.s) nave.velAtual=Math.max(nave.velAtual-nave.acel*8,   nave.velBase*0.12);
            else          nave.velAtual+=(nave.velBase-nave.velAtual)*0.008;
            if(_k.boost)  nave.velAtual=Math.min(nave.velAtual+nave.acel*7,   nave.velMax*1.28);
        } else {
            const cfg = DIFF_CFG[_dificuldade];
            const diff=player?(player.distTotal-nave.distTotal):0;
            const rb=diff>0.08?1.08:diff<-0.04?0.93:1.0;
            const ruido=Math.sin(_frame*0.04+idx*2.3)*(nave.acel*0.3);
            nave.velAtual=THREE.MathUtils.clamp(nave.velBase*rb*cfg.iaVelMult+ruido, nave.velBase*0.78*cfg.iaVelMult, nave.velMax*1.06*cfg.iaVelMult);
        }

        if(nave.penalidade>0){
            nave.penalidade--;
            nave.velAtual=Math.max(nave.velAtual-nave.acel*3, nave.velBase*0.22);
        }

        if(nave.isPlayer){
            const maxLat=LARGURA_PISTA*0.41;
            if(_k.a) nave.latAlvo-=0.16;
            if(_k.d) nave.latAlvo+=0.16;
            nave.latAlvo=THREE.MathUtils.clamp(nave.latAlvo,-maxLat,maxLat);
        } else {
            nave.latAlvo=Math.sin(_frame*0.013+idx*1.9)*LARGURA_PISTA*0.26;
        }
        nave.latOff=THREE.MathUtils.lerp(nave.latOff,nave.latAlvo,0.08);

        // ── CORREÇÃO: garante que a nave nunca saia da pista ──────────────────
        // Raio da fuselagem: ~1.0 u. Borda da pista: LARGURA_PISTA/2.
        // Clamp duro do deslocamento lateral após o lerp.
        const BORDA_MAX = LARGURA_PISTA * 0.5 - 1.0;
        nave.latOff = THREE.MathUtils.clamp(nave.latOff, -BORDA_MAX, BORDA_MAX);
        nave.latAlvo = THREE.MathUtils.clamp(nave.latAlvo, -BORDA_MAX, BORDA_MAX);

        nave.tPrev = nave.t;
        nave.t        +=nave.velAtual;
        nave.distTotal+=nave.velAtual;

        // Normalizar t para [0,1)
        if(nave.t>=1) nave.t-=1;

        // Detectar cruzamento da linha de largada (tPrev < LARGADA ≤ t, ou wrap-around)
        const TL = PISTA_T_LARGADA;
        const cruzou = (nave.tPrev < TL && nave.t >= TL) ||
                       (nave.tPrev > nave.t && (nave.tPrev < TL || nave.t >= TL)); // wrap
        // Ignorar cruzamento na primeira passagem (largada)
        if(cruzou && nave.distTotal > TL + 0.05){
            nave.volta++;
            if(nave.isPlayer){
                if(nave.volta<TOTAL_VOLTAS) {
                    bzAudio.volta();
                    flashEvento(`◆ VOLTA ${nave.volta+1} ◆`,'#ffcc00');
                    if(nave.volta===1) setTimeout(()=>mostrarDialogo(_pilotoAtual,'volta2'), 500);
                }
                if(nave.volta===TOTAL_VOLTAS-1&&!_lap3Ativo){
                    _lap3Ativo=true;
                    flashEvento('⚠ METEOROS NA PISTA!','#ff6622');
                    setTimeout(()=>mostrarDialogo(_pilotoAtual,'meteoros'), 800);
                    for(let i=0;i<7;i++) setTimeout(spawnMeteoro,i*200);
                }
            }
            if(nave.volta>=TOTAL_VOLTAS&&!nave.chegou){
                nave.chegou=true;
                if(nave.isPlayer){
                    const pF=[..._naves].sort((a,b)=>b.distTotal-a.distTotal).findIndex(n=>n.isPlayer)+1;
                    const m=pF===1?'🥇 VITÓRIA!!':pF===2?'🥈 2° LUGAR':pF===3?'🥉 3° LUGAR':`${pF}° LUGAR`;
                    const c=pF===1?'#ffcc00':pF<=3?'#aaccff':'#ff4444';
                    flashEvento(m,c);
                    if(pF===1) setTimeout(()=>bzAudio.vitoria(), 400);
                    setTimeout(()=>mostrarDialogo(_pilotoAtual,'vitoria'), 400);
                    setTimeout(()=>{_correndo=false;_lap3Ativo=false;bzAudio.pararMotor();mostrarResultado();},2800);
                }
            }
        }

        // ── ORIENTAÇÃO DA NAVE — quaternion puro, sem acúmulo ──────────────
        // Passo 1: tangente da curva neste ponto (direção do movimento)
        const tang = pistaTang(nave.t);

        // Passo 2: calcular upRef instantâneo via binormal de Frenet
        const tNext = (nave.t + 0.002) % 1;
        const tangNext = pistaTang(tNext);
        let upRaw = new THREE.Vector3().crossVectors(tang, tangNext);
        if (upRaw.lengthSq() < 1e-6) {
            upRaw.set(0, 1, 0);
        } else {
            upRaw.normalize();
            if (upRaw.y < -0.1) upRaw.negate();
        }
        // Suaviza o upRef com lerp para eliminar tremor em loops e terrenos acidentados
        // Fator 0.04: suficientemente lento para absorver oscilações, rápido o bastante para loops
        nave.upSmooth.lerp(upRaw, 0.04).normalize();
        const upRef = nave.upSmooth.clone();

        // Passo 3: construir base ortonormal  frente/cima/direita
        const frente = tang.clone(); // direção do movimento
        const cima = upRef.clone().sub(frente.clone().multiplyScalar(upRef.dot(frente))).normalize();
        const direita = new THREE.Vector3().crossVectors(frente, cima).normalize();

        // Posição
        const pos = pistaPos(nave.t, nave.latOff);
        nave.mesh.position.copy(pos);

        // Passo 4: banking suavizado (inclina sobre o eixo "frente")
        let bankAlvo = 0;
        if (nave.isPlayer) {
            if (_k.a) bankAlvo =  0.20;
            else if (_k.d) bankAlvo = -0.20;
        } else {
            bankAlvo = Math.sin(_frame * 0.05 + idx) * 0.10;
        }
        nave.bankSmooth = THREE.MathUtils.lerp(nave.bankSmooth, bankAlvo, 0.08);

        // Aplicar banking: rotacionar cima/direita ao redor de frente
        const cosB = Math.cos(nave.bankSmooth);
        const sinB = Math.sin(nave.bankSmooth);
        const cimaB    = cima.clone().multiplyScalar(cosB).addScaledVector(direita, -sinB);
        const direitaB = direita.clone().multiplyScalar(cosB).addScaledVector(cima,   sinB);

        // Passo 5: montar matrix — colunas = eixos mundiais dos eixos locais X, Y, Z
        // Eixo local X = direita da nave  → direitaB
        // Eixo local Y = cima da nave     → cimaB
        // Eixo local Z = costas da nave   → -frente  (nariz aponta -Z local)
        const mx = new THREE.Matrix4();
        mx.makeBasis(direitaB, cimaB, frente.clone().negate());
        nave.mesh.setRotationFromMatrix(mx);

        if(_frame%3===0) emitirParticula(nave);
    });

    if(player) {
        // No modo primeira pessoa, esconde a nave do player (câmera está dentro dela)
        player.mesh.visible = (_camModo !== 'fp');
        atualizarCam(player);
    }
    if(_frame%3===0) atualizarHUD();
    if(_correndo && _naves.length>0 && _naves.every(n=>n.chegou)){ _correndo=false; bzAudio.pararMotor(); setTimeout(mostrarResultado,900); }
}

// ══════════════════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════════════════════════════════════════
export function iniciarBZero64(scene, camera, controls, onVoltar) {
    if(_ativo) return;
    _scene=scene; _camera=camera; _controls=controls; _onVoltar=onVoltar; _onVoltarOrig=onVoltar;
    _ativo=true; _correndo=false; _frame=0; _camH=0;
    _lap3Ativo=false; _vidaPlayer=100; _tiroCD=0; _dificuldade='normal';
    if(_controls) _controls.enabled=false;

    injetarEstilos();

    mostrarSelecao(pilotoIdx=>{
        _pilotoAtual = PILOTOS[pilotoIdx];
        criarEstrelasBZ();
        criarPistaVisual();
        criarNaves(pilotoIdx);
        criarHUD();
        criarDialogoEl();
        ligarControles();

        const posL=pistaPos(PISTA_T_LARGADA), tangL=pistaTang(PISTA_T_LARGADA), normL=pistaNormal(PISTA_T_LARGADA);
        const camS=posL.clone()
            .add(tangL.clone().negate().multiplyScalar(28))
            .addScaledVector(normL,12);
        camera.position.copy(camS);
        camera.lookAt(posL.x, posL.y+1.0, posL.z);

        criarMira();
        document.body.style.cursor='none';
        mostrarInstrucoes(()=>{
            countdown(()=>{
                _tempoInicio=Date.now();
                _correndo=true;
                setTimeout(()=>mostrarDialogo(_pilotoAtual,'largada'), 600);
            });
        });
    });
}
