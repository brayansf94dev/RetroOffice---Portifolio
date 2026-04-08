import * as THREE from 'three';

export function criarComputador() {
    const pcGroup = new THREE.Group();

    // ── 1. MATERIAIS SEPARADOS E REALISTAS (Plástico ABS anos 90) ──
    const caseMat = new THREE.MeshPhongMaterial({ 
        color: 0xcecece, // Cinza/Bege base
        specular: 0x111111, // Reflexo baixo
        shininess: 15 
    });

    const monitorMat = new THREE.MeshPhongMaterial({ 
        color: 0xdedede, // Levemente mais claro que o gabinete
        specular: 0x222222, // Reflexo um pouco maior na carcaça do monitor
        shininess: 25 
    });

   const baseMat = new THREE.MeshPhongMaterial({ 
        color: 0x222222, // Plástico escuro/preto
        specular: 0x111111, 
        shininess: 10 
    });

    const screenMat = new THREE.MeshBasicMaterial({ color: 0x001a0d }); 

    // 👇 ADICIONE ESTA LINHA AQUI 👇
    const darkMat = baseMat;




    // ── 2. O GABINETE ──
    const caseGeo = new THREE.BoxGeometry(2.5, 0.8, 2.5);
    const pcCase = new THREE.Mesh(caseGeo, caseMat); // Usa o material do gabinete
    pcCase.position.y = 0.4; 
    pcGroup.add(pcCase);


    // ── 3. A BASE DO MONITOR (Cria separação física) ──
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.15, 16);
    const monitorBase = new THREE.Mesh(baseGeo, baseMat);
    monitorBase.position.y = 0.875; // Fica exatamente em cima do gabinete
    pcGroup.add(monitorBase);

    // Um "pescoço" menor para dar respiro
    const neckGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
    const monitorNeck = new THREE.Mesh(neckGeo, baseMat);
    monitorNeck.position.y = 0.95; 
    pcGroup.add(monitorNeck);


    // ── 4. O MONITOR (Dependente do Gabinete) ──
    const monitorGeo = new THREE.BoxGeometry(2, 1.8, 1.8);
    const monitor = new THREE.Mesh(monitorGeo, monitorMat); // Usa o material mais claro
    // Subimos o monitor para ele sentar sobre o "pescoço" que criamos
    monitor.position.y = 1.9; 
    monitor.rotation.x = -0.05; 
    pcGroup.add(monitor);


    // --- 5. A TELA (Filha do Monitor) ---
    const screenGeo = new THREE.PlaneGeometry(1.6, 1.3);
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.05, 0.91); 
    monitor.add(screen);
    
    // ... o resto do seu código (os botões frontais, drives, etc.) continua a partir daqui!
    
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

  // ── MATERIAIS PARA OS DETALHES (Refinados para Profundidade) ─────────────────────────
  const plasticoXP = new THREE.MeshPhongMaterial({ 
    color: 0xACA899, // Cor de plástico do Windows XP
    specular: 0x111111, // Reflexo especular baixo (plástico fosco)
    shininess: 30 // Brilho suave
  });

  const metalEscuro = new THREE.MeshPhongMaterial({ 
    color: 0x111111, // Metal quase preto
    specular: 0x333333, // Reflexo especular médio
    shininess: 50 // Mais brilhante
  });


  // ── 💾 DRIVE DE DISQUETE (Com Profundidade Real) ──────────────────────────────────
  const floppyGroup = new THREE.Group();
  floppyGroup.position.set(0, 0.25, 1.251); 
  pcGroup.add(floppyGroup);

  // Moldura externa do Drive (chanfrada para dar volume)
  const floppyFrameGeo = new THREE.BoxGeometry(0.35, 0.08, 0.04);
  const floppyFrame = new THREE.Mesh(floppyFrameGeo, plasticoXP);
  floppyGroup.add(floppyFrame);

  // Fenda do Disquete (uma CAIXA vazia que "entra" no gabinete)
  const floppySlotGeo = new THREE.BoxGeometry(0.28, 0.02, 0.03);
  floppySlotGeo.translate(0, 0, -0.015); // Recua o fundo da caixa
  const floppySlot = new THREE.Mesh(floppySlotGeo, metalEscuro);
  floppySlot.position.z = 0.021; // Posiciona a fenda para fora da moldura
  floppyGroup.add(floppySlot);

  // Botão de Ejeção (Cubo volumétrico)
  const ejectBtnGeo = new THREE.BoxGeometry(0.04, 0.03, 0.03); // Profundidade Z de 0.03
  const floppyEject = new THREE.Mesh(ejectBtnGeo, plasticoXP);
  floppyEject.position.set(0.18, -0.01, 0.036); // Posiciona para fora da moldura
  floppyGroup.add(floppyEject);


  // ── ⚡ BOTÕES E LEDS (Com Profundidade Real) ──────────────────────────────────────
  const powerGroup = new THREE.Group();
  powerGroup.position.set(-0.7, 0.15, 1.251); 
  pcGroup.add(powerGroup);

  // Botão Power (Cilindro com altura real)
  const powerBtnGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 24); // Altura de 0.04
  const powerBtnMat = new THREE.MeshPhongMaterial({ 
    color: 0x7FFF00, // Verde limão
    specular: 0x666666, // Reflexo especular alto (botão brilhante)
    shininess: 80 // Muito brilhante
  });
  const powerButton = new THREE.Mesh(powerBtnGeo, powerBtnMat);
  powerButton.rotation.x = Math.PI / 2; // Gira o cilindro para ficar de frente
  powerButton.position.z = 0.021; // Posiciona para fora do gabinete
  powerGroup.add(powerButton);

  // LEDs (Esferas projetadas para fora)
  const ledGeo = new THREE.SphereGeometry(0.018, 16, 16); // Esferas maiores
  const ledPowerMat = new THREE.MeshBasicMaterial({ color: 0x00FF00 }); // LED Verde
  const ledPower = new THREE.Mesh(ledGeo, ledPowerMat);
  ledPower.position.set(0.12, 0, 0.016); // Posiciona para fora
  powerGroup.add(ledPower);

  const ledActMat = new THREE.MeshBasicMaterial({ color: 0xFFA500, transparent: true, opacity: 0.7 }); // LED Laranja
  const ledActivity = new THREE.Mesh(ledGeo, ledActMat);
  ledActivity.position.set(0.17, 0, 0.016); // Posiciona para fora
  powerGroup.add(ledActivity);


  // ── 💿 DRIVE DE CD-ROM (Com Profundidade Real) ────────────────────────────────────
  const cdGroup = new THREE.Group();
  cdGroup.position.set(0, 0.55, 1.251); 
  pcGroup.add(cdGroup);

  // Moldura externa do Drive (Caudalosa e volumosa)
  const cdFrameGeo = new THREE.BoxGeometry(0.5, 0.12, 0.05); // Profundidade Z de 0.05
  const cdFrame = new THREE.Mesh(cdFrameGeo, plasticoXP);
  cdGroup.add(cdFrame);

  // Fenda do CD (Uma CAIXA vazia profunda)
  const cdSlotGeo = new THREE.BoxGeometry(0.45, 0.03, 0.04);
  cdSlotGeo.translate(0, 0, -0.02); // Recua o fundo da caixa
  const cdSlot = new THREE.Mesh(cdSlotGeo, metalEscuro);
  cdSlot.position.z = 0.026; // Posiciona a fenda para fora da moldura
  cdGroup.add(cdSlot);

  // Botão Eject e LED do CD (Volumétricos)
  const cdEjectGeo = new THREE.BoxGeometry(0.025, 0.018, 0.025); // Profundidade Z de 0.025
  const cdEject = new THREE.Mesh(cdEjectGeo, plasticoXP);
  cdEject.position.set(0.2, -0.03, 0.036); // Posiciona para fora da moldura
  cdGroup.add(cdEject);

  const cdLed = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 10), ledPowerMat);
  cdLed.position.set(-0.2, -0.03, 0.03); // Posiciona para fora da moldura
  cdGroup.add(cdLed);

  // ── 6. BOTÕES DO MONITOR (Ajuste de Tela) ─────────────────────────
    const monitorBtnGroup = new THREE.Group();
    // Posiciona na parte inferior da frente do monitor
    monitorBtnGroup.position.set(0, -0.75, 0.91); 
    monitor.add(monitorBtnGroup); // Adiciona ao MONITOR, não ao pcGroup!

    // Fileira de botões de ajuste (Menu, Menos, Mais, Select)
    const adjBtnGeo = new THREE.BoxGeometry(0.12, 0.04, 0.02);
    const adjBtnMat = new THREE.MeshPhongMaterial({ color: 0x999999, specular: 0x222222 }); // Plástico um pouco mais escuro
    
    for (let i = 0; i < 4; i++) {
        const btn = new THREE.Mesh(adjBtnGeo, adjBtnMat);
        btn.position.set(-0.35 + (i * 0.18), 0, 0); // Espalha horizontalmente
        monitorBtnGroup.add(btn);
    }

    // Botão de Força do Monitor (Cilindro e LED próprio)
    const monPowerGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
    const monPower = new THREE.Mesh(monPowerGeo, adjBtnMat);
    monPower.rotation.x = Math.PI / 2;
    monPower.position.set(0.6, 0, 0);
    monitorBtnGroup.add(monPower);

    const monLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00FF00 }));
    monLed.position.set(0.5, 0, 0);
    monitorBtnGroup.add(monLed);


    // ── 7. GRADES DE VENTILAÇÃO (Lateral do Gabinete) ────────────────
    const ventGroup = new THREE.Group();
    // Posiciona na lateral direita do gabinete (X=1.251)
    ventGroup.position.set(1.251, 0.3, 0.5); 
    pcGroup.add(ventGroup);

    // Cria as "ranhuras" (caixas afundadas escuras)
    const ventGeo = new THREE.BoxGeometry(0.02, 0.02, 0.8);
    const ventMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); // Escuro para parecer um buraco
    
    for (let i = 0; i < 8; i++) {
        const vent = new THREE.Mesh(ventGeo, ventMat);
        vent.position.set(0, i * 0.04, 0); // Empilha 8 ranhuras na vertical
        ventGroup.add(vent);
    }


    // ── 8. BADGE DA MARCA (Plaqueta de Metal Frontal) ────────────────
    const badgeGeo = new THREE.BoxGeometry(0.25, 0.08, 0.01);
    const badgeMat = new THREE.MeshPhongMaterial({ 
        color: 0xaaaaaa, // Cinza claro
        specular: 0xffffff, // Reflexo muito forte
        shininess: 100 // Metal polido
    });
    
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    // Posicionado na frente, no topo e centralizado
    badge.position.set(0, 0.65, 1.251); 
    pcGroup.add(badge);
    
    // Detalhe extra: um "relevo" preto no meio do metal para simular o texto do logo
    const logoGeo = new THREE.BoxGeometry(0.18, 0.03, 0.01);
    const logoMesh = new THREE.Mesh(logoGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    logoMesh.position.z = 0.005;
    badge.add(logoMesh);

    return pcGroup;
}