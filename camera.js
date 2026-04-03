import * as THREE from 'three';

export function gerenciarCamera(camera, controls) {
    const posicaoFocada = new THREE.Vector3(0, 1.9, 3.3);
    const alvoFocado    = new THREE.Vector3(0, 1.75, 0);
    const posicaoLivre  = new THREE.Vector3(0, 2.5, 7);
    const alvoLivre     = new THREE.Vector3(0, 1, 0);

    let estado        = 'deriva';
    let tempo         = 0;
    let livreAnimando = false;

    function alternarModo(novoEstado) {
        estado = novoEstado;

        if (estado === 'livre') {
            // Libera todos os limites para exploração total
            controls.minDistance  = 1;
            controls.maxDistance  = 50;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI;
            controls.enabled      = false; // desliga enquanto anima
            livreAnimando         = true;
        } else {
            // Volta limites normais no modo foco
            controls.minDistance  = 2;
            controls.maxDistance  = 12;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI / 2.1;
            controls.enabled      = false;
            livreAnimando         = false;
        }
    }

    function atualizarCamera() {
        if (estado === 'deriva') {
            tempo += 0.015;
            camera.position.x = Math.sin(tempo) * 4;
            camera.position.y = 2 + Math.cos(tempo * 0.8) * 0.7;
            camera.position.z = 8 + Math.cos(tempo * 0.5) * 2;
            camera.lookAt(0, 1, 0);
            if (tempo > 2.5) alternarModo('foco');
        }
        else if (estado === 'foco') {
            camera.position.lerp(posicaoFocada, 0.07);
            controls.target.lerp(alvoFocado, 0.07);
        }
        else if (estado === 'livre') {
            if (livreAnimando) {
                // Anima suavemente até posição padrão
                camera.position.lerp(posicaoLivre, 0.06);
                controls.target.lerp(alvoLivre, 0.06);
                if (camera.position.distanceTo(posicaoLivre) < 0.3) {
                    livreAnimando    = false;
                    controls.enabled = true; // Libera OrbitControls — não volta a mexer
                }
            }
            // livreAnimando = false → OrbitControls tem controle total
        }
    }

    return { alternarModo, atualizarCamera };
}
