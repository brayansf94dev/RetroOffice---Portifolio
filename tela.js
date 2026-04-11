import * as THREE from 'three';
import { CSS3DObject } from 'https://unpkg.com/three@0.150.1/examples/jsm/renderers/CSS3DRenderer.js';

export function criarTelaInterativa() {
    const div = document.createElement('div');
    div.className = 'tela-crt-real';

    div.innerHTML = `
        <div class="crt-vignette"></div>
        <div class="crt-scanlines"></div>
        <div class="crt-noise"></div>

        <div class="crt-content">
            <h1 data-text="BRAYAN_OS v1.0">BRAYAN_OS v1.0</h1>
            <p data-text="> KERNEL: OK">&gt; KERNEL: OK</p>
            <p data-text="> VIDEO: CRT_EMULATION_ON">&gt; VIDEO: CRT_EMULATION_ON</p>
            <p data-text="> STATUS: SISTEMA ATIVO">&gt; STATUS: SISTEMA ATIVO</p>
            <br>
            <button class="retro-btn">ACESSAR PORTFOLIO</button>
        </div>
    `;

    const objetoCSS = new CSS3DObject(div);

    // CSS3DRenderer trabalha em pixels reais — a escala precisa ser pequena
    // para caber no espaço 3D do Three.js (que usa unidades de mundo)
    // A div tem 1024×768 px → queremos ela com ~1.6×1.3 unidades de mundo
    // Escala: 1.6 / 1024 ≈ 0.00156
    objetoCSS.scale.set(0.00155, 0.00155, 0.00155);

    // Posição alinhada com a PlaneGeometry da tela no computador.js:
    //   monitor.position.y = 1.7  →  tela.position.set(0, 0.05, 0.91) (local do monitor)
    //   monitor.rotation.x = -0.05
    // Em world-space aproximado:
    objetoCSS.position.set(0, 1.83, 0.52);

    // Inclina levemente igual ao monitor (rotation.x = -0.05)
    objetoCSS.rotation.x = -0.05;

    return objetoCSS;
}