import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';

export function criarComputador() {
    const pcGroup = new THREE.Group();

    // Materiais com cores mais sólidas e foscas (típico do N64)
    const pcMat = new THREE.MeshLambertMaterial({ color: 0xdddddd }); // Cinza claro
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x001a0d }); // Verde escuro de monitor CRT
    

    // --- MANIPULAÇÃO 1: O GABINETE ---
    const caseGeo = new THREE.BoxGeometry(2.5, 0.8, 2.5);
    const pcCase = new THREE.Mesh(caseGeo, pcMat);
    // Aqui manipulamos a POSIÇÃO Y para ele não ficar "enterrado" no meio do grupo
    pcCase.position.y = 0.4; 
    pcGroup.add(pcCase);

    // --- MANIPULAÇÃO 2: O MONITOR (Dependente do Gabinete) ---
    const monitorGeo = new THREE.BoxGeometry(2, 1.8, 1.8);
    const monitor = new THREE.Mesh(monitorGeo, pcMat);
    // Manipulamos a POSIÇÃO para ele ficar exatamente no topo do gabinete
    // Gabinete tem 0.8 de altura, então o monitor precisa subir
    monitor.position.y = 1.7; 
    // Manipulamos a ROTAÇÃO para ele ficar levemente virado para cima (mais ergonômico)
    monitor.rotation.x = -0.05; 
    pcGroup.add(monitor);

    // --- MANIPULAÇÃO 3: A TELA (Filha do Monitor) ---
    // Em vez de adicionar a tela direto no pcGroup, vamos adicionar no MONITOR!
    // Assim, se você girar o monitor, a tela gira junto automaticamente.
    const screenGeo = new THREE.PlaneGeometry(1.6, 1.3);
    const screen = new THREE.Mesh(screenGeo, screenMat);
    
    // Como ela é filha do monitor, a posição (0,0,0) dela agora é o CENTRO do monitor
    // Só precisamos "puxar" ela um pouco para a frente (eixo Z)
    screen.position.set(0, 0.05, 0.91); 
    monitor.add(screen); // ADICIONADA AO MONITOR

    // --- MANIPULAÇÃO 4: DETALHES (Botão de Power) ---
    const btnGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const powerBtn = new THREE.Mesh(btnGeo, darkMat);
    // Posicionando no canto inferior direito do monitor
    powerBtn.position.set(0.6, -0.75, 0.9);
    monitor.add(powerBtn);

    return pcGroup;
}