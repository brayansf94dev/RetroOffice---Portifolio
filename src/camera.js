import * as THREE from 'three';

export function gerenciarCamera(camera, controls) {
    const posicaoFocada = new THREE.Vector3(0, 1.9, 5.5); 
    const alvoFocado    = new THREE.Vector3(0, 1.75, 0);
    const posicaoLivre  = new THREE.Vector3(0, 2.5, 7);
    const alvoLivre     = new THREE.Vector3(0, 1, 0);

    let estado        = 'deriva';
    let tempo         = 0;
    let livreAnimando = false;
    let onLivreReady  = null; // callback chamado quando animação de entrada termina

    function alternarModo(novoEstado, callback) {
        estado = novoEstado;

        if (estado === 'livre') {
            onLivreReady = callback || null;

            // Limites generosos para exploração total
            controls.minDistance   = 1;
            controls.maxDistance   = 80;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI;

            // Desliga OrbitControls durante a animação de voo
            controls.enabled = false;
            livreAnimando    = true;

        } else if (estado === 'jogo') {
            // Modo Jogo: Desativa os controles orbitais completamente
            // para que a câmera siga a nave no loop principal (animate)
            controls.enabled = false;
            livreAnimando    = false;
            onLivreReady     = null;
            
        } else {
            // Modo foco: câmera vai via lerp, OrbitControls desligado
            controls.minDistance   = 2;
            controls.maxDistance   = 12;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI / 2.1;
            controls.enabled       = false;
            livreAnimando          = false;
            onLivreReady           = null;
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

                if (camera.position.distanceTo(posicaoLivre) < 0.25) {
                    livreAnimando    = false;
                    controls.enabled = true; // Entrega controle total ao OrbitControls

                    if (onLivreReady) { onLivreReady(); onLivreReady = null; }
                }

                } else if (estado === 'jogo') {
                // Desliga os controles orbitais para o script do jogo assumir
                controls.enabled = false;
                livreAnimando = false;
                onLivreReady = null;
                }
            // Quando livreAnimando = false, OrbitControls tem controle total
        }
    }

    return { alternarModo, atualizarCamera };
}
