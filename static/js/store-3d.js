/**
 * ============================================================================
 * R&S MARKET POS - MOTOR 3D DE SUPERMERCADO VIRTUAL INTERACTIVO
 * Desarrollado con Three.js para navegación en celulares y computadoras.
 * Permite caminar por los pasillos, abrir heladeras, mirar estantes y comprar.
 * ============================================================================
 */

// Variables globales Three.js
let scene, camera, renderer;
let clock = new THREE.Clock();
let interactiveObjects = []; // Objetos clickeables (productos)
let allProducts = [];
let categoriesList = [];

// Estado de la cámara y controles
let cameraTargetPos = null;
let cameraTargetLookAt = null;
let isTeleporting = false;
let moveState = { forward: false, backward: false, left: false, right: false };
let playerVelocity = new THREE.Vector3();
let playerRotation = { yaw: 0, pitch: 0 };
let isDraggingMouse = false;
let previousMousePosition = { x: 0, y: 0 };
let currentHoveredMesh = null;

// Joystick móvil
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };
let joystickTouchId = null;

// Carrito de compras virtual
let virtualCart = [];
let selectedProductForCard = null;
let cardQuantity = 1;

// Audio context para beeps agradables
let audioCtx = null;

/**
 * Inicialización principal al cargar la página
 */
document.addEventListener('DOMContentLoaded', async () => {
    initVirtualCart();
    initAudio();
    initThreeScene();
    setupControls();
    setupTouchJoystick();
    setupDeliveryToggle();
    init3dStoreSearch();

    // Cargar catálogo real desde la base de datos
    await loadProductsFromDatabase();

    // Construir el supermercado 3D (paredes, pisos, heladeras, estantes, cajas)
    buildSupermarketEnvironment();

    // Colocar los productos reales en sus estantes y heladeras
    placeProductsInShelves();

    // Ocultar pantalla de carga
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 700);
        }
    }, 800);

    // Ocultar hint de controles después de 6 segundos
    setTimeout(() => {
        const hint = document.getElementById('quick-controls-hint');
        if (hint) hint.style.opacity = '0';
    }, 6000);

    // Iniciar loop de renderizado a 60 FPS
    animate();

    if (window.lucide) lucide.createIcons();
});

/**
 * Audio sintetizado para compras y clicks
 */
function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
}

function playBeep(freq = 1200, duration = 0.08, type = 'sine') {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

/**
 * Configuración de Escena, Cámara y Luces Three.js
 */
function initThreeScene() {
    const container = document.getElementById('canvas-container');

    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.025);

    // Cámara (ojos a 1.68m del suelo)
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 80);
    camera.position.set(0, 1.68, 10); // Posición inicial en la entrada
    playerRotation.yaw = 0;
    playerRotation.pitch = -0.05;
    updateCameraRotation();

    // Renderer WebGL
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Iluminación cálida de supermercado
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    // Luz principal difusa cenital
    const mainLight = new THREE.DirectionalLight(0xfffaed, 0.8);
    mainLight.position.set(5, 12, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    scene.add(mainLight);

    // Luces de pasillos cenitales
    addCeilingSpotLight(0, 4.6, 4, 0xffffff, 0.6);
    addCeilingSpotLight(0, 4.6, -4, 0xffffff, 0.6);
    addCeilingSpotLight(-6, 4.6, 0, 0x38bdf8, 0.8); // Luz más fría para las heladeras
    addCeilingSpotLight(6, 4.6, 0, 0xffedd5, 0.6);  // Luz cálida góndola derecha

    // Redimensionar con la ventana
    window.addEventListener('resize', onWindowResize);
}

function addCeilingSpotLight(x, y, z, color, intensity) {
    const light = new THREE.PointLight(color, intensity, 14, 1.5);
    light.position.set(x, y, z);
    scene.add(light);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Cargar catálogo real desde la base de datos de SQLite
 */
async function loadProductsFromDatabase() {
    try {
        const res = await fetch('/api/products');
        if (res.ok) {
            allProducts = await res.json();
        }
    } catch (e) {
        console.warn("No se pudieron cargar productos en 3D:", e);
        allProducts = [];
    }

    try {
        const catRes = await fetch('/api/categories');
        if (catRes.ok) {
            categoriesList = await catRes.json();
        }
    } catch (e) {}
}

/**
 * Textura procedural de azulejos claros de supermercado con brillo
 */
function createTileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Fondo azulejo beige claro
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 256);

    // Moteado sutil
    ctx.fillStyle = '#f1f5f9';
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = Math.random() * 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Líneas de junta gris claro
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 20);
    return texture;
}

/**
 * Construcción del Local Comercial (Paredes, Piso, Techo, Mobiliario)
 */
function buildSupermarketEnvironment() {
    // 1. PISO DEL SUPERMERCADO
    const floorGeo = new THREE.PlaneGeometry(24, 30);
    const floorMat = new THREE.MeshStandardMaterial({
        map: createTileTexture(),
        roughness: 0.25,
        metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 2. TECHO INDUSTRIAL CON PANELES LED
    const ceilingGeo = new THREE.PlaneGeometry(24, 30);
    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.8
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.y = 5.0;
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    // Paneles de luces LED en el techo
    for (let z = -10; z <= 10; z += 5) {
        for (let x = -6; x <= 6; x += 6) {
            const ledGeo = new THREE.BoxGeometry(1.2, 0.05, 3);
            const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const ledMesh = new THREE.Mesh(ledGeo, ledMat);
            ledMesh.position.set(x, 4.95, z);
            scene.add(ledMesh);
        }
    }

    // 3. PAREDES DEL SUPERMERCADO
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const wallAccentMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 }); // Franja naranja corporativa

    // Pared trasera (z = -15)
    buildWall(24, 5, wallMat, 0, 2.5, -15, 0);
    // Franja naranja en pared trasera
    const stripeBack = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 0.1), wallAccentMat);
    stripeBack.position.set(0, 3.8, -14.94);
    scene.add(stripeBack);

    // Cartel Principal en Pared Trasera
    createStoreBannerMesh(0, 4.2, -14.9);

    // Pared izquierda (Heladeras, x = -12)
    buildWall(30, 5, wallMat, -12, 2.5, 0, Math.PI / 2);
    // Pared derecha (x = 12)
    buildWall(30, 5, wallMat, 12, 2.5, 0, -Math.PI / 2);
    // Pared delantera (Entrada con ventanales, z = 15)
    buildWall(24, 5, wallMat, 0, 2.5, 15, Math.PI);

    // -------------------------------------------------------------
    // 4. MOBILIARIO COMERCIAL
    // -------------------------------------------------------------

    // A) GÓNDOLAS DE PARED IZQUIERDA (Lácteos y Bebidas en estantes descubiertos, x = -9.8)
    buildWallShelfUnit(-9.8, -7, "LÁCTEOS & QUESOS", 0x38bdf8, 1);
    buildWallShelfUnit(-9.8, 2, "BEBIDAS & GASEOSAS", 0x06b6d4, 1);

    // B) GÓNDOLAS CENTRALES DOBLES (Pasillos de Almacén)
    buildCentralGondola(-3, -2, "ALMACÉN & SECOS", 0xf97316);
    buildCentralGondola(3, -2, "KIOSCO & GOLOSINAS", 0xec4899);

    // C) GÓNDOLA LATERAL DERECHA (Limpieza & Higiene, x = 9.8)
    buildWallShelfUnit(9.8, -2, "LIMPIEZA & HOGAR", 0x10b981);

    // D) ISLA CENTRAL DE FRUTAS & VERDURAS (z = 6, x = 0)
    buildFruitStandTable(0, 6, "VERDULERÍA FRESCA");

    // E) MOSTRADOR DE CAJA / CHECKOUT (Salida, x = 4.5, z = 11)
    buildCheckoutCounter(4.5, 11);
}

function buildWall(width, height, material, x, y, z, rotY) {
    const geo = new THREE.PlaneGeometry(width, height);
    const wall = new THREE.Mesh(geo, material);
    wall.position.set(x, y, z);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    scene.add(wall);
}

/**
 * Cartel corporativo de la tienda en 3D
 */
function createStoreBannerMesh(x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 1012, 244);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("R&S MARKET", 512, 120);

    ctx.fillStyle = '#fb923c';
    ctx.font = 'bold 44px Outfit, sans-serif';
    ctx.fillText("SUPERMERCADO & ALMACÉN", 512, 195);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
}

/**
 * Heladera Exhibidora con vidrio semi-transparente y luz interior
 */
function buildCoolerUnit(x, z, label, lightColorHex) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Cuerpo exterior metálico oscuro
    const bodyGeo = new THREE.BoxGeometry(2.4, 3.4, 4.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.7;
    body.castShadow = true;
    group.add(body);

    // Hueco interno iluminado
    const insideGeo = new THREE.BoxGeometry(2.1, 2.7, 4.3);
    const insideMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
    const inside = new THREE.Mesh(insideGeo, insideMat);
    inside.position.set(0.1, 1.65, 0);
    group.add(inside);

    // Estantes internos (4 niveles)
    for (let h = 0.6; h <= 2.6; h += 0.65) {
        const shelfGeo = new THREE.BoxGeometry(1.9, 0.04, 4.2);
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
        const shelf = new THREE.Mesh(shelfGeo, shelfMat);
        shelf.position.set(0.15, h, 0);
        group.add(shelf);
    }

    // Puertas de vidrio transparentes con reflejos
    const glassGeo = new THREE.BoxGeometry(0.06, 2.7, 4.3);
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.6
    });
    const glassDoor = new THREE.Mesh(glassGeo, glassMat);
    glassDoor.position.set(1.15, 1.65, 0);
    group.add(glassDoor);

    // Luz fría interior de la heladera
    const coolerLight = new THREE.PointLight(lightColorHex, 0.8, 6, 2);
    coolerLight.position.set(0.6, 2.0, 0);
    group.add(coolerLight);

    // Cartel superior luminoso de la heladera
    createSignMesh(1.22, 3.2, 0, 0.5, 4.0, label, lightColorHex, group, Math.PI / 2);

    scene.add(group);
}

/**
 * Góndola central de doble cara para alimentos y secos
 */
function buildCentralGondola(x, z, label, themeColor) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Columna central de la góndola
    const spineGeo = new THREE.BoxGeometry(0.15, 2.5, 9.0);
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.position.y = 1.25;
    group.add(spine);

    // Zócalo base
    const baseGeo = new THREE.BoxGeometry(1.6, 0.25, 9.0);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.125;
    group.add(base);

    // 4 niveles de estantes a ambos lados
    for (let h = 0.5; h <= 2.1; h += 0.5) {
        // Estante lado A
        const shelfA = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 8.8), spineMat);
        shelfA.position.set(0.4, h, 0);
        shelfA.castShadow = true;
        group.add(shelfA);

        // Estante lado B
        const shelfB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 8.8), spineMat);
        shelfB.position.set(-0.4, h, 0);
        shelfB.castShadow = true;
        group.add(shelfB);
    }

    // Cabecera promocional frontal
    createSignMesh(0, 2.3, 4.6, 0.45, 1.4, label, themeColor, group, 0);
    // Cabecera promocional trasera
    createSignMesh(0, 2.3, -4.6, 0.45, 1.4, label, themeColor, group, Math.PI);

    scene.add(group);
}

/**
 * Góndola adosada a la pared (Estante abierto)
 * facing: +1 para pared izquierda (mirando hacia el centro x > -9.8) o -1 para pared derecha (x < 9.8)
 */
function buildWallShelfUnit(x, z, label, themeColor, facing = -1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const backGeo = new THREE.BoxGeometry(0.15, 2.6, 9.0);
    const backMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3 });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.y = 1.3;
    group.add(back);

    // Estantes orientados hacia el pasillo
    const shelfOffsetX = facing * 0.45;
    for (let h = 0.5; h <= 2.2; h += 0.55) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 8.8), backMat);
        shelf.position.set(shelfOffsetX, h, 0);
        shelf.castShadow = true;
        group.add(shelf);
    }

    // Luz cenital propia del estante
    const shelfLight = new THREE.PointLight(themeColor, 0.8, 8, 1.5);
    shelfLight.position.set(shelfOffsetX * 1.5, 2.4, 0);
    group.add(shelfLight);

    // Cartel superior
    const signRotY = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    createSignMesh(facing * 0.55, 2.45, 0, 0.45, 4.0, label, themeColor, group, signRotY);
    scene.add(group);
}

/**
 * Isla de Frutería y Verdulería con cajones de madera
 */
function buildFruitStandTable(x, z, label) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Mesa de madera rústica
    const tableGeo = new THREE.BoxGeometry(3.6, 0.9, 2.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
    const table = new THREE.Mesh(tableGeo, woodMat);
    table.position.y = 0.45;
    group.add(table);

    // Cajones inclinados
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });
    for (let cx = -1.2; cx <= 1.2; cx += 1.2) {
        for (let cz = -0.6; cz <= 0.6; cz += 1.2) {
            const boxGeo = new THREE.BoxGeometry(1.0, 0.25, 0.9);
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(cx, 1.0, cz);
            box.rotation.x = 0.15;
            group.add(box);
        }
    }

    createSignMesh(0, 1.7, 0, 0.4, 2.4, label, 0x84cc16, group, 0);
    scene.add(group);
}

/**
 * Mostrador de Checkout y Caja Registradora
 */
function buildCheckoutCounter(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Mueble de caja
    const counterGeo = new THREE.BoxGeometry(3.2, 1.05, 1.4);
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.y = 0.525;
    group.add(counter);

    // Cinta transportadora negra
    const beltGeo = new THREE.BoxGeometry(2.2, 0.05, 0.9);
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.set(-0.4, 1.075, 0);
    group.add(belt);

    // Monitor POS y caja
    const posScreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.05), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    posScreen.position.set(1.0, 1.4, 0);
    group.add(posScreen);

    // Cartel iluminado "CAJA 1"
    createSignMesh(0, 2.5, 0, 0.5, 1.8, "CAJA 1 - SALIDA", 0xea580c, group, 0);

    scene.add(group);
}

/**
 * Cartel indicador luminoso para pasillos
 */
function createSignMesh(x, y, z, h, w, text, colorHex, parentGroup, rotY = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = '#' + colorHex.toString(16).padStart(6, '0');
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 78);

    const texture = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    parentGroup.add(mesh);
}

/**
 * Colocar los productos reales de la base de datos en los estantes 3D
 */
function placeProductsInShelves() {
    if (!allProducts || allProducts.length === 0) return;

    // Agrupar productos por categorías
    const grouped = {
        bebidas: [],
        lacteos: [],
        almacen: [],
        kiosco: [],
        limpieza: [],
        verduleria: [],
        otros: []
    };

    allProducts.forEach(p => {
        const cat = (p.category_name || '').toLowerCase();
        if (cat.includes('bebida') || cat.includes('alcohol') || cat.includes('cerveza') || cat.includes('gaseosa')) {
            grouped.bebidas.push(p);
        } else if (cat.includes('lcteo') || cat.includes('lacteo') || cat.includes('queso') || cat.includes('fiambrer')) {
            grouped.lacteos.push(p);
        } else if (cat.includes('almacn') || cat.includes('almacen') || cat.includes('seco') || cat.includes('panader')) {
            grouped.almacen.push(p);
        } else if (cat.includes('kiosco') || cat.includes('golosina') || cat.includes('cigarro') || cat.includes('cigarrillo')) {
            grouped.kiosco.push(p);
        } else if (cat.includes('limpieza') || cat.includes('higiene')) {
            grouped.limpieza.push(p);
        } else if (cat.includes('fruta') || cat.includes('verdura')) {
            grouped.verduleria.push(p);
        } else {
            grouped.almacen.push(p);
        }
    });

    // 1. Colocar en Góndola de Lácteos & Quesos (x = -9.35, z = -10.5 a -3.5)
    spawnProductBatch(grouped.lacteos, {
        baseX: -9.35,
        zStart: -10.5,
        zEnd: -3.5,
        heightLevels: [0.6, 1.15, 1.7, 2.25],
        meshType: 'carton'
    });

    // 2. Colocar en Góndola de Bebidas & Gaseosas (x = -9.35, z = -1.5 a 5.5)
    spawnProductBatch(grouped.bebidas, {
        baseX: -9.35,
        zStart: -1.5,
        zEnd: 5.5,
        heightLevels: [0.6, 1.15, 1.7, 2.25],
        meshType: 'bottle'
    });

    // 3. Colocar en Góndola Central 1 (Almacén, x = -2.6 y -3.4, z = -6 a 2)
    spawnProductBatch(grouped.almacen, {
        baseX: -2.6,
        zStart: -6.0,
        zEnd: 2.0,
        heightLevels: [0.6, 1.1, 1.6, 2.1],
        meshType: 'box'
    });

    // 4. Colocar en Góndola Central 2 (Kiosco & Snacks, x = 2.6 y 3.4, z = -6 a 2)
    spawnProductBatch(grouped.kiosco, {
        baseX: 2.6,
        zStart: -6.0,
        zEnd: 2.0,
        heightLevels: [0.6, 1.1, 1.6, 2.1],
        meshType: 'snack'
    });

    // 5. Colocar en Góndola de Limpieza (x = 9.3, z = -6 a 2)
    spawnProductBatch(grouped.limpieza, {
        baseX: 9.3,
        zStart: -6.0,
        zEnd: 2.0,
        heightLevels: [0.6, 1.15, 1.7, 2.25],
        meshType: 'bottle_large'
    });

    // 6. Colocar en Isla de Verdulería (x = -1.2 a 1.2, z = 5.4 a 6.6)
    spawnFruitBatch(grouped.verduleria, 0, 6.0);
}

/**
 * Genera una serie de productos organizados ordenadamente en los estantes
 */
function spawnProductBatch(products, config) {
    if (!products || products.length === 0) return;

    const { baseX, zStart, zEnd, heightLevels, meshType } = config;
    const totalSlots = heightLevels.length * 8; // Hasta 8 productos por nivel
    const zStep = (zEnd - zStart) / 7;

    products.forEach((p, index) => {
        if (index >= totalSlots) return;

        const levelIndex = Math.floor(index / 8);
        const colIndex = index % 8;
        const y = heightLevels[levelIndex % heightLevels.length];
        const z = zStart + (colIndex * zStep);

        const mesh = createProductMesh(p, meshType);
        mesh.position.set(baseX, y, z);
        mesh.userData = { product: p, originalY: y };

        scene.add(mesh);
        interactiveObjects.push(mesh);
    });
}

function spawnFruitBatch(products, centerX, centerZ) {
    if (!products || products.length === 0) return;

    products.forEach((p, i) => {
        if (i >= 12) return;
        const row = Math.floor(i / 4);
        const col = i % 4;
        const x = centerX - 1.2 + (col * 0.8);
        const z = centerZ - 0.6 + (row * 0.6);
        const y = 1.05;

        const mesh = createProductMesh(p, 'fruit');
        mesh.position.set(x, y, z);
        mesh.userData = { product: p, originalY: y };

        scene.add(mesh);
        interactiveObjects.push(mesh);
    });
}

/**
 * Crea la malla geométrica 3D representativa del producto según su tipo
 */
function createProductMesh(product, type) {
    const group = new THREE.Group();

    // Color basado en el hash del nombre para variedad vibrante
    const colorHex = stringToColor(product.name || 'Prod');
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.3,
        metalness: 0.2
    });

    let mainMesh;
    if (type === 'bottle') {
        // Botella cilíndrica de gaseosa / agua
        const geo = new THREE.CylinderGeometry(0.08, 0.09, 0.32, 12);
        mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.position.y = 0.16;
    } else if (type === 'bottle_large') {
        // Botella detergente / lavandina
        const geo = new THREE.CylinderGeometry(0.11, 0.12, 0.38, 12);
        mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.position.y = 0.19;
    } else if (type === 'carton') {
        // Sachet o cartón de leche / yogurt
        const geo = new THREE.BoxGeometry(0.14, 0.3, 0.14);
        mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.position.y = 0.15;
    } else if (type === 'snack') {
        // Paquete de galletitas o golosinas
        const geo = new THREE.BoxGeometry(0.18, 0.16, 0.12);
        mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.position.y = 0.08;
    } else if (type === 'fruit') {
        // Fruta redondeada
        const geo = new THREE.SphereGeometry(0.12, 12, 12);
        mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.position.y = 0.12;
    } else {
        // Paquete caja de fideos / arroz (por defecto)
        const geo = new THREE.BoxGeometry(0.18, 0.28, 0.14);
        mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.position.y = 0.14;
    }

    mainMesh.castShadow = true;
    group.add(mainMesh);

    // Etiqueta de precio flotante estilo supermercado ($XXX)
    const priceTag = createMiniPriceTag(product.sale_price);
    priceTag.position.set(0, 0.04, 0.14);
    group.add(priceTag);

    return group;
}

function createMiniPriceTag(price) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 0, 128, 64);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$' + Math.round(price), 64, 46);

    const texture = new THREE.CanvasTexture(canvas);
    const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.08),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    );
    return tag;
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return parseInt("00000".substring(0, 6 - c.length) + c, 16);
}

/**
 * Configuración de Controles (Teclado, Mouse y Raycaster)
 */
function setupControls() {
    // Teclado (W, A, S, D, Flechas)
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': moveState.forward = true; break;
            case 'KeyS': case 'ArrowDown': moveState.backward = true; break;
            case 'KeyA': case 'ArrowLeft': moveState.left = true; break;
            case 'KeyD': case 'ArrowRight': moveState.right = true; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': moveState.forward = false; break;
            case 'KeyS': case 'ArrowDown': moveState.backward = false; break;
            case 'KeyA': case 'ArrowLeft': moveState.left = false; break;
            case 'KeyD': case 'ArrowRight': moveState.right = false; break;
        }
    });

    // Mouse Drag para rotar la cámara
    const container = document.getElementById('canvas-container');

    container.addEventListener('mousedown', (e) => {
        isDraggingMouse = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
        isDraggingMouse = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingMouse) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            playerRotation.yaw -= deltaX * 0.0035;
            playerRotation.pitch -= deltaY * 0.0035;
            playerRotation.pitch = Math.max(-0.6, Math.min(0.6, playerRotation.pitch)); // Limitar cabeceo

            updateCameraRotation();
            previousMousePosition = { x: e.clientX, y: e.clientY };
        } else {
            // Raycasting de hover para resaltar productos
            handlePointerHover(e.clientX, e.clientY);
        }
    });

    // Click / Tap para seleccionar un producto
    container.addEventListener('click', (e) => {
        handlePointerClick(e.clientX, e.clientY);
    });

    // Touch en pantalla para girar la mirada en móviles
    let touchStartPos = null;
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && e.touches[0].clientX > window.innerWidth * 0.35) {
            touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (touchStartPos && e.touches.length === 1) {
            const currentTouch = e.touches[0];
            const deltaX = currentTouch.clientX - touchStartPos.x;
            const deltaY = currentTouch.clientY - touchStartPos.y;

            playerRotation.yaw -= deltaX * 0.005;
            playerRotation.pitch -= deltaY * 0.005;
            playerRotation.pitch = Math.max(-0.6, Math.min(0.6, playerRotation.pitch));

            updateCameraRotation();
            touchStartPos = { x: currentTouch.clientX, y: currentTouch.clientY };
        }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
            const t = e.changedTouches[0];
            // Si fue un toque rápido sin arrastrar mucho, verificar si tocó un producto
            handlePointerClick(t.clientX, t.clientY);
        }
        touchStartPos = null;
    });
}

function updateCameraRotation() {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = playerRotation.yaw;
    camera.rotation.x = playerRotation.pitch;
}

/**
 * Joystick táctil virtual en móviles
 */
function setupTouchJoystick() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    if (!zone || !knob) return;

    const maxRadius = 35;
    let baseCenter = { x: 0, y: 0 };

    zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        joystickTouchId = touch.identifier;
        joystickActive = true;
        const rect = zone.getBoundingClientRect();
        baseCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        updateJoystickPosition(touch.clientX, touch.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!joystickActive) return;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === joystickTouchId) {
                updateJoystickPosition(e.touches[i].clientX, e.touches[i].clientY);
                break;
            }
        }
    }, { passive: false });

    const resetJoystick = (e) => {
        joystickActive = false;
        joystickVector = { x: 0, y: 0 };
        joystickTouchId = null;
        knob.style.transform = `translate(0px, 0px)`;
    };

    zone.addEventListener('touchend', resetJoystick);
    zone.addEventListener('touchcancel', resetJoystick);

    function updateJoystickPosition(touchX, touchY) {
        let dx = touchX - baseCenter.x;
        let dy = touchY - baseCenter.y;
        const dist = Math.hypot(dx, dy);

        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }

        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        joystickVector = { x: dx / maxRadius, y: -dy / maxRadius };
    }
}

/**
 * Raycasting para detectar productos bajo el puntero
 */
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

function getIntersectedProduct(clientX, clientY) {
    mouseVec.x = (clientX / window.innerWidth) * 2 - 1;
    mouseVec.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouseVec, camera);

    const intersects = raycaster.intersectObjects(interactiveObjects, true);
    if (intersects.length > 0) {
        // Encontrar el grupo padre con userData
        let obj = intersects[0].object;
        while (obj && !obj.userData.product && obj.parent) {
            obj = obj.parent;
        }
        if (obj && obj.userData && obj.userData.product) {
            return obj;
        }
    }
    return null;
}

function handlePointerHover(clientX, clientY) {
    const prodGroup = getIntersectedProduct(clientX, clientY);
    if (prodGroup !== currentHoveredMesh) {
        if (currentHoveredMesh) {
            // Restaurar escala
            currentHoveredMesh.scale.set(1, 1, 1);
        }
        currentHoveredMesh = prodGroup;
        if (currentHoveredMesh) {
            currentHoveredMesh.scale.set(1.18, 1.18, 1.18);
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'default';
        }
    }
}

function handlePointerClick(clientX, clientY) {
    const prodGroup = getIntersectedProduct(clientX, clientY);
    if (prodGroup && prodGroup.userData.product) {
        playBeep(1400, 0.1);
        openProductCard(prodGroup.userData.product);
    }
}

/**
 * Teletransporte cinematográfico a pasillos y heladeras
 */
function teleportToSection(sectionId) {
    playBeep(900, 0.08);

    const positions = {
        bebidas:    { pos: new THREE.Vector3(-7.2, 1.68, -1.0), lookAt: new THREE.Vector3(-9.8, 1.68, -1.0) },
        lacteos:    { pos: new THREE.Vector3(-7.2, 1.68, -8.0), lookAt: new THREE.Vector3(-9.8, 1.68, -8.0) },
        almacen:    { pos: new THREE.Vector3(-0.8, 1.68, -2.0), lookAt: new THREE.Vector3(-2.6, 1.5, -2.0) },
        kiosco:     { pos: new THREE.Vector3(0.8, 1.68, -2.0),  lookAt: new THREE.Vector3(2.6, 1.5, -2.0) },
        limpieza:   { pos: new THREE.Vector3(7.2, 1.68, -2.0),  lookAt: new THREE.Vector3(9.8, 1.5, -2.0) },
        verduleria: { pos: new THREE.Vector3(0, 1.68, 8.5),    lookAt: new THREE.Vector3(0, 1.0, 6.0) },
        caja:       { pos: new THREE.Vector3(4.5, 1.68, 13.0),  lookAt: new THREE.Vector3(4.5, 1.2, 11.0) }
    };

    const target = positions[sectionId];
    if (!target) return;

    cameraTargetPos = target.pos.clone();
    cameraTargetLookAt = target.lookAt.clone();
    isTeleporting = true;
}

/**
 * Loop principal de animación (60 FPS)
 */
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // 1. Teletransporte suave (lerp)
    if (isTeleporting && cameraTargetPos) {
        camera.position.lerp(cameraTargetPos, delta * 3.5);

        // Orientar hacia el objetivo
        const currentLook = new THREE.Vector3();
        camera.getWorldDirection(currentLook);
        const desiredLook = cameraTargetLookAt.clone().sub(camera.position).normalize();
        
        playerRotation.yaw = Math.atan2(-desiredLook.x, -desiredLook.z);
        playerRotation.pitch = Math.asin(desiredLook.y);
        updateCameraRotation();

        if (camera.position.distanceTo(cameraTargetPos) < 0.15) {
            isTeleporting = false;
            cameraTargetPos = null;
        }
    } 
    // 2. Movimiento normal del jugador (WASD + Joystick)
    else {
        const moveSpeed = 4.2; // metros por segundo
        const moveX = (moveState.right ? 1 : 0) - (moveState.left ? 1 : 0) + joystickVector.x;
        const moveZ = (moveState.forward ? 1 : 0) - (moveState.backward ? 1 : 0) + joystickVector.y;

        if (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05) {
            const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRotation.yaw);
            const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRotation.yaw);

            const moveDir = new THREE.Vector3()
                .addScaledVector(forward, moveZ)
                .addScaledVector(side, moveX)
                .normalize();

            camera.position.addScaledVector(moveDir, moveSpeed * delta);

            // Límites perimetrales del local (colisión con paredes)
            camera.position.x = Math.max(-10.5, Math.min(10.5, camera.position.x));
            camera.position.z = Math.max(-13.5, Math.min(13.5, camera.position.z));
            camera.position.y = 1.68; // Mantener altura humana fija
        }
    }

    // Animación sutil flotante en el producto que tiene hover
    if (currentHoveredMesh) {
        const time = clock.getElapsedTime();
        currentHoveredMesh.position.y = (currentHoveredMesh.userData.originalY || 1) + Math.sin(time * 5) * 0.02;
    }

    renderer.render(scene, camera);
}

// ============================================================================
// LÓGICA DE COMPRA & CARRITO VIRTUAL (MODALES Y CHECKOUT)
// ============================================================================

function initVirtualCart() {
    try {
        const saved = localStorage.getItem('rsmarket_virtual_cart_v1');
        if (saved) virtualCart = JSON.parse(saved);
    } catch (e) {
        virtualCart = [];
    }
    updateCartHUD();
}

function saveVirtualCart() {
    try {
        localStorage.setItem('rsmarket_virtual_cart_v1', JSON.stringify(virtualCart));
    } catch (e) {}
    updateCartHUD();
}

function updateCartHUD() {
    const badge = document.getElementById('hud-cart-badge');
    const totalEl = document.getElementById('hud-cart-total');
    const drawerCount = document.getElementById('cart-drawer-count');
    const drawerTotal = document.getElementById('cart-drawer-total');

    const totalQty = virtualCart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = virtualCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (badge) badge.textContent = totalQty;
    if (totalEl) totalEl.textContent = `$${formatPrice(totalPrice)}`;
    if (drawerCount) drawerCount.textContent = totalQty;
    if (drawerTotal) drawerTotal.textContent = `$${formatPrice(totalPrice)}`;
}

function formatPrice(val) {
    return Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Tarjeta Flotante de Producto Seleccionado en 3D
 */
function openProductCard(product) {
    selectedProductForCard = product;
    cardQuantity = 1;

    document.getElementById('prod-card-name').textContent = product.name;
    document.getElementById('prod-card-category').textContent = product.category_name || 'Almacén';
    document.getElementById('prod-card-price').textContent = `$${formatPrice(product.sale_price)}`;
    document.getElementById('prod-card-qty').textContent = '1';

    const stockEl = document.getElementById('prod-card-stock');
    if (stockEl) {
        if (product.stock > 0) {
            stockEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Stock: ${product.stock}`;
            stockEl.className = 'text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end';
        } else {
            stockEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Disponible`;
            stockEl.className = 'text-xs font-bold text-amber-400 flex items-center gap-1 justify-end';
        }
    }

    const modal = document.getElementById('product-card-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeProductCard() {
    const modal = document.getElementById('product-card-modal');
    if (modal) modal.classList.add('hidden');
    selectedProductForCard = null;
}

function changeCardQuantity(delta) {
    cardQuantity = Math.max(1, cardQuantity + delta);
    const qtyEl = document.getElementById('prod-card-qty');
    if (qtyEl) qtyEl.textContent = cardQuantity;
}

function addSelectedProductToCart() {
    if (!selectedProductForCard) return;

    playBeep(1600, 0.12);

    const existingIndex = virtualCart.findIndex(x => x.id === selectedProductForCard.id);
    if (existingIndex !== -1) {
        virtualCart[existingIndex].quantity += cardQuantity;
    } else {
        virtualCart.push({
            id: selectedProductForCard.id,
            name: selectedProductForCard.name,
            price: Number(selectedProductForCard.sale_price),
            category: selectedProductForCard.category_name || 'General',
            unit_type: selectedProductForCard.unit_type || 'un',
            quantity: cardQuantity
        });
    }

    saveVirtualCart();
    closeProductCard();

    // Animación de pulso en el botón del carrito
    const hudBtn = document.getElementById('hud-cart-btn');
    if (hudBtn) {
        hudBtn.classList.add('scale-110');
        setTimeout(() => hudBtn.classList.remove('scale-110'), 250);
    }
}

/**
 * Cajón Deslizante del Carrito (Drawer)
 */
function openCartDrawer() {
    playBeep(1100, 0.08);
    renderCartDrawerItems();
    const drawer = document.getElementById('cart-drawer');
    if (drawer) drawer.classList.remove('translate-x-full');
}

function closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) drawer.classList.add('translate-x-full');
}

function renderCartDrawerItems() {
    const container = document.getElementById('cart-drawer-items');
    if (!container) return;

    if (virtualCart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400 space-y-2">
                <i data-lucide="shopping-bag" class="w-12 h-12 mx-auto text-slate-600 opacity-50"></i>
                <p class="text-sm">Tu carrito todavía está vacío.</p>
                <p class="text-xs text-slate-500">Caminá por los estantes y tocá cualquier producto para agregarlo.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    container.innerHTML = virtualCart.map((it, idx) => `
        <div class="py-2.5 flex items-center justify-between gap-3 text-xs">
            <div class="flex-1 min-w-0">
                <div class="font-bold text-white truncate">${it.name}</div>
                <div class="text-[11px] text-slate-400 font-mono">$${formatPrice(it.price)} c/u</div>
            </div>

            <div class="flex items-center gap-1.5 bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button onclick="updateCartItemQty(${idx}, -1)" class="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center transition">
                    -
                </button>
                <span class="w-7 text-center font-bold font-mono">${it.quantity}</span>
                <button onclick="updateCartItemQty(${idx}, 1)" class="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center transition">
                    +
                </button>
            </div>

            <div class="text-right min-w-[70px]">
                <div class="font-black text-orange-400 font-mono">$${formatPrice(it.price * it.quantity)}</div>
                <button onclick="removeCartItem(${idx})" class="text-[10px] text-rose-400 hover:underline">
                    Quitar
                </button>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function updateCartItemQty(index, delta) {
    if (!virtualCart[index]) return;
    virtualCart[index].quantity += delta;
    if (virtualCart[index].quantity <= 0) {
        virtualCart.splice(index, 1);
    }
    saveVirtualCart();
    renderCartDrawerItems();
}

function removeCartItem(index) {
    virtualCart.splice(index, 1);
    saveVirtualCart();
    renderCartDrawerItems();
}

function setupDeliveryToggle() {
    const sel = document.getElementById('order-delivery-type');
    const addrInput = document.getElementById('order-delivery-address');
    if (sel && addrInput) {
        sel.addEventListener('change', () => {
            addrInput.style.display = sel.value === 'delivery' ? 'block' : 'none';
        });
    }
}

/**
 * Enviar pedido formateado por WhatsApp
 */
function sendOrderViaWhatsApp() {
    if (virtualCart.length === 0) {
        alert("Tu carrito está vacío. Elegí algún producto de las góndolas antes de pedir.");
        return;
    }

    const name = (document.getElementById('order-customer-name')?.value || '').trim();
    const delivery = document.getElementById('order-delivery-type')?.value;
    const address = (document.getElementById('order-delivery-address')?.value || '').trim();

    if (!name) {
        alert("Por favor ingresá tu nombre para que el comercio identifique tu pedido.");
        document.getElementById('order-customer-name')?.focus();
        return;
    }

    let msg = `🛒 *NUEVO PEDIDO DESDE LA TIENDA 3D*\n`;
    msg += `👤 *Cliente:* ${name}\n`;
    msg += `📦 *Modalidad:* ${delivery === 'delivery' ? 'Envío a Domicilio' : 'Retiro en el local'}\n`;
    if (delivery === 'delivery' && address) {
        msg += `📍 *Dirección:* ${address}\n`;
    }
    msg += `\n*Detalle del Pedido:*\n`;

    let total = 0;
    virtualCart.forEach(it => {
        const sub = it.price * it.quantity;
        total += sub;
        msg += `• ${it.quantity}x ${it.name} - $${formatPrice(sub)}\n`;
    });

    msg += `\n💰 *TOTAL:* $${formatPrice(total)}\n`;
    msg += `\n_Pedido realizado a través del Supermercado Virtual 3D_`;

    const phone = "5493795062876"; // Teléfono configurado del comercio
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

/**
 * Confirmar el pedido directamente en la base de datos local del POS
 */
async function submitDirectStoreOrder() {
    if (virtualCart.length === 0) {
        alert("Tu carrito está vacío.");
        return;
    }

    const name = (document.getElementById('order-customer-name')?.value || '').trim() || 'Cliente Tienda 3D';
    const delivery = document.getElementById('order-delivery-type')?.value;
    const address = (document.getElementById('order-delivery-address')?.value || '').trim();

    const payload = {
        items: virtualCart.map(it => ({ id: it.id, quantity: it.quantity })),
        payment_method: 'TIENDA_3D_ONLINE',
        amount_paid: virtualCart.reduce((s, it) => s + (it.price * it.quantity), 0),
        notes: `Pedido Tienda 3D - Cliente: ${name} (${delivery === 'delivery' ? 'Envío: ' + address : 'Retiro en Local'})`,
        cashier_name: 'Tienda Virtual 3D'
    };

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            playBeep(1800, 0.2);
            alert(`¡Excelente ${name}!\nTu pedido fue enviado directamente a la caja del comercio.\nTicket generado: ${data.order_number || 'OK'}`);
            virtualCart = [];
            saveVirtualCart();
            closeCartDrawer();
        } else {
            const err = await res.json();
            alert("No se pudo procesar: " + (err.error || "Intente nuevamente"));
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión al enviar el pedido.");
    }
}

function toggleHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.classList.toggle('hidden');
    if (window.lucide) lucide.createIcons();
}

// ============================================================================
// BUSCADOR INTELIGENTE EN TIENDA 3D
// ============================================================================
function normalize3dSearch(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function init3dStoreSearch() {
    const searchInput = document.getElementById('store3d-search-input');
    const resultsContainer = document.getElementById('store3d-search-results');
    const clearBtn = document.getElementById('store3d-search-clear');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const val = (searchInput.value || '').trim();
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', val.length === 0);
        }

        if (val.length < 2) {
            if (resultsContainer) resultsContainer.classList.add('hidden');
            return;
        }

        const normVal = normalize3dSearch(val);
        const tokens = normVal.split(/\s+/).filter(Boolean);

        const matches = allProducts.filter(p => {
            const target = normalize3dSearch(`${p.name || ''} ${p.code || ''} ${p.category_name || ''}`);
            return tokens.every(tok => target.includes(tok));
        });

        render3dSearchResults(matches, val);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearStore3dSearch();
        } else if (e.key === 'Enter') {
            const firstResult = resultsContainer?.querySelector('.store3d-search-item');
            if (firstResult) {
                firstResult.click();
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (resultsContainer && !resultsContainer.contains(e.target) && e.target !== searchInput) {
            resultsContainer.classList.add('hidden');
        }
    });
}

function render3dSearchResults(matches, query) {
    const resultsContainer = document.getElementById('store3d-search-results');
    if (!resultsContainer) return;

    if (matches.length === 0) {
        resultsContainer.innerHTML = `
            <div class="p-3 text-center text-xs text-slate-400">
                No encontramos productos con "${query}"
            </div>
        `;
        resultsContainer.classList.remove('hidden');
        return;
    }

    const itemsToShow = matches.slice(0, 7);
    resultsContainer.innerHTML = itemsToShow.map(p => {
        const imgThumb = p.image_url ? `
            <img src="${p.image_url}" alt="${p.name}" class="w-9 h-9 rounded-xl object-cover border border-slate-700 flex-shrink-0" onerror="this.style.display='none'">
        ` : `
            <div class="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-orange-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                <i data-lucide="package" class="w-4 h-4"></i>
            </div>
        `;

        return `
            <div onclick="selectProductFrom3dSearch(${p.id})" 
                 class="store3d-search-item p-2.5 flex items-center justify-between gap-2.5 hover:bg-slate-800/80 cursor-pointer transition select-none">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    ${imgThumb}
                    <div class="min-w-0 flex-1">
                        <div class="text-xs font-bold text-white truncate">${p.name}</div>
                        <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span class="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-semibold">${p.category_name || 'Almacén'}</span>
                            <span>Stock: ${p.stock || 0}</span>
                        </div>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="text-xs font-bold font-mono text-orange-400">$${formatPrice(p.sale_price)}</div>
                    <span class="text-[9px] text-emerald-400 font-bold uppercase">Ver</span>
                </div>
            </div>
        `;
    }).join('');

    resultsContainer.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function selectProductFrom3dSearch(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    clearStore3dSearch();
    playBeep(1400, 0.1);
    openProductCard(product);

    // Teletransportar a la sección correspondiente del supermercado
    const cat = (product.category_name || '').toLowerCase();
    if (cat.includes('bebida') || cat.includes('gaseosa') || cat.includes('agua') || cat.includes('jugo') || cat.includes('vino') || cat.includes('cerveza')) {
        teleportToSection('bebidas');
    } else if (cat.includes('lacteo') || cat.includes('lácteo') || cat.includes('queso') || cat.includes('yogur') || cat.includes('leche')) {
        teleportToSection('lacteos');
    } else if (cat.includes('kiosco') || cat.includes('golosina') || cat.includes('galletita') || cat.includes('snack') || cat.includes('alfajor')) {
        teleportToSection('kiosco');
    } else if (cat.includes('limpieza') || cat.includes('higiene') || cat.includes('lavandina') || cat.includes('jabon')) {
        teleportToSection('limpieza');
    } else if (cat.includes('verduleria') || cat.includes('fruta') || cat.includes('verdura')) {
        teleportToSection('verduleria');
    } else {
        teleportToSection('almacen');
    }
}

function clearStore3dSearch() {
    const searchInput = document.getElementById('store3d-search-input');
    const resultsContainer = document.getElementById('store3d-search-results');
    const clearBtn = document.getElementById('store3d-search-clear');
    if (searchInput) searchInput.value = '';
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (clearBtn) clearBtn.classList.add('hidden');
}
