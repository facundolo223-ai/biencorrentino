/**
 * ============================================================================
 * R&S MARKET POS - LECTOR DE CÓDIGO DE BARRAS POR CÁMARA (CELULAR & WEBCAM)
 * Soporta escaneo en vivo con cámara trasera, linterna, subida de fotos,
 * modo continuo para cobro rápido y carga directa en el inventario.
 * ============================================================================
 */

let html5QrCodeScanner = null;
let currentScannerMode = 'pos'; // 'pos' | 'product' | 'search'
let isScannerRunning = false;
let availableCameras = [];
let currentCameraIndex = 0;
let isTorchOn = false;
let lastScannedCode = null;
let lastScanTimestamp = 0;
const SCAN_DEBOUNCE_MS = 1400; // Evita lecturas duplicadas en ráfaga del mismo código

/**
 * Abrir el modal de escaneo de cámara
 * @param {string} mode - 'pos' (cobro), 'product' (cargar código a formulario), 'search' (filtrar inventario)
 */
async function openCameraScannerModal(mode = 'pos') {
    currentScannerMode = mode;
    const modal = document.getElementById('modal-camera-scanner');
    const titleEl = document.getElementById('camera-scanner-title');
    const subtitleEl = document.getElementById('camera-scanner-subtitle');
    const posControls = document.getElementById('camera-pos-controls');
    const loadingEl = document.getElementById('camera-scanner-loading');

    if (!modal) return;

    // Configurar textos según el modo
    if (mode === 'pos') {
        titleEl.innerHTML = '<i data-lucide="shopping-cart" class="w-4 h-4 text-orange-500"></i> Escanear para Cobrar';
        subtitleEl.textContent = 'Apuntá al código para agregarlo directamente al ticket';
        if (posControls) posControls.classList.remove('hidden');
    } else if (mode === 'product') {
        titleEl.innerHTML = '<i data-lucide="package-plus" class="w-4 h-4 text-orange-500"></i> Cargar Código a Producto';
        subtitleEl.textContent = 'Apuntá al código de barras para asignarlo al producto';
        if (posControls) posControls.classList.add('hidden');
    } else if (mode === 'search') {
        titleEl.innerHTML = '<i data-lucide="search" class="w-4 h-4 text-orange-500"></i> Buscar en Inventario';
        subtitleEl.textContent = 'Apuntá al código para consultar precio y stock';
        if (posControls) posControls.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    hideScannerToast();
    if (window.lucide) lucide.createIcons();

    // Iniciar cámara
    await startCameraStream();
}

/**
 * Cerrar el modal y liberar la cámara
 */
async function closeCameraScannerModal() {
    const modal = document.getElementById('modal-camera-scanner');
    if (modal) modal.classList.add('hidden');

    await stopCameraStream();
    hideScannerToast();
}

/**
 * Iniciar el stream de video con Html5Qrcode
 */
async function startCameraStream() {
    const loadingEl = document.getElementById('camera-scanner-loading');
    const readerDivId = 'camera-scanner-reader';

    try {
        if (!window.Html5Qrcode) {
            console.error("Html5Qrcode no está cargado.");
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="text-rose-400 font-bold text-xs">Error: Biblioteca de escáner no disponible</div>
                    <p class="text-[11px] text-slate-400">Verificá tu conexión a internet o recargá la página.</p>
                `;
            }
            return;
        }

        // Si ya había una instancia previa corriendo, detenerla
        if (html5QrCodeScanner && isScannerRunning) {
            await stopCameraStream();
        }

        html5QrCodeScanner = new Html5Qrcode(readerDivId);

        // Detectar cámaras disponibles
        try {
            availableCameras = await Html5Qrcode.getCameras();
        } catch (camErr) {
            console.warn("No se pudo enumerar cámaras explícitamente:", camErr);
            availableCameras = [];
        }

        // Mostrar u ocultar botón de cambiar cámara
        const btnFlip = document.getElementById('btn-camera-flip');
        if (btnFlip) {
            btnFlip.style.display = availableCameras.length > 1 ? 'flex' : 'none';
        }

        // Configuración de escaneo (formatos soportados)
        const config = {
            fps: 15,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                // Caja de escaneo optimizada horizontal para códigos de barras comerciales EAN / UPC
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const width = Math.min(viewfinderWidth * 0.85, 320);
                const height = Math.min(viewfinderHeight * 0.65, 200);
                return { width: Math.round(width), height: Math.round(height) };
            },
            aspectRatio: 1.3333,
            showTorchButtonIfSupported: true
        };

        // Preferir cámara trasera del celular (facingMode: "environment")
        let cameraTarget = { facingMode: "environment" };
        if (availableCameras.length > 0) {
            // Buscar cámara que tenga 'back' o 'environment' en su label
            const backIndex = availableCameras.findIndex(c => 
                c.label && (c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('trasera'))
            );
            if (backIndex !== -1) {
                currentCameraIndex = backIndex;
                cameraTarget = availableCameras[backIndex].id;
            } else {
                cameraTarget = availableCameras[currentCameraIndex % availableCameras.length].id;
            }
        }

        await html5QrCodeScanner.start(
            cameraTarget,
            config,
            (decodedText, decodedResult) => handleBarcodeDecoded(decodedText, decodedResult),
            (errorMessage) => {
                // Errores de frame individual (silenciosos para no saturar consola)
            }
        );

        isScannerRunning = true;
        if (loadingEl) loadingEl.classList.add('hidden');

        // Chequear soporte de linterna / flash
        checkTorchSupport();

    } catch (err) {
        console.error("Error al iniciar cámara:", err);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2">
                    <i data-lucide="camera-off" class="w-5 h-5"></i>
                </div>
                <div class="text-rose-400 font-bold text-xs">No se pudo acceder a la cámara</div>
                <p class="text-[11px] text-slate-400 max-w-xs">
                    Permití el permiso de cámara en tu navegador o usá el botón <b>"Cargar Foto"</b> para escanear desde una imagen.
                </p>
                <button onclick="document.getElementById('camera-file-scanner-input').click()" class="mt-2 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs">
                    Cargar Foto de Código
                </button>
            `;
            if (window.lucide) lucide.createIcons();
        }
    }
}

/**
 * Detener el stream de cámara
 */
async function stopCameraStream() {
    if (html5QrCodeScanner && isScannerRunning) {
        try {
            await html5QrCodeScanner.stop();
        } catch (e) {
            console.warn("Error al detener cámara:", e);
        }
        isScannerRunning = false;
        isTorchOn = false;
    }
}

/**
 * Alternar entre cámara trasera y delantera
 */
async function flipCamera() {
    if (availableCameras.length <= 1) return;
    currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
    await stopCameraStream();
    await startCameraStream();
}

/**
 * Verificar y activar/desactivar linterna si está disponible
 */
function checkTorchSupport() {
    const btnTorch = document.getElementById('btn-camera-torch');
    if (!btnTorch || !html5QrCodeScanner) return;

    try {
        // En Html5Qrcode podemos inspeccionar las capacidades de la pista de video
        const tracks = html5QrCodeScanner.getRunningTrackCameraCapabilities();
        if (tracks && tracks.torchFeature && tracks.torchFeature().isSupported()) {
            btnTorch.classList.remove('hidden');
            btnTorch.classList.add('flex');
        } else {
            btnTorch.classList.add('hidden');
            btnTorch.classList.remove('flex');
        }
    } catch (e) {
        btnTorch.classList.add('hidden');
        btnTorch.classList.remove('flex');
    }
}

async function toggleCameraTorch() {
    if (!html5QrCodeScanner || !isScannerRunning) return;
    const btnTorch = document.getElementById('btn-camera-torch');
    const labelTorch = document.getElementById('camera-torch-label');

    try {
        isTorchOn = !isTorchOn;
        await html5QrCodeScanner.applyVideoConstraints({
            advanced: [{ torch: isTorchOn }]
        });
        if (labelTorch) labelTorch.textContent = isTorchOn ? 'Apagar' : 'Luz';
        if (btnTorch) {
            btnTorch.className = isTorchOn 
                ? 'px-3 py-2 rounded-xl bg-amber-500 text-slate-900 font-bold flex items-center gap-1.5 transition'
                : 'px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold flex items-center gap-1.5 transition';
        }
    } catch (e) {
        console.warn("Error al cambiar antorcha:", e);
    }
}

/**
 * Procesar lectura exitosa del código de barras
 */
async function handleBarcodeDecoded(code, decodedResult) {
    if (!code) return;
    const cleanCode = code.trim();

    // Debounce: evitar lecturas duplicadas inmediatas del mismo código en ráfaga
    const now = Date.now();
    if (cleanCode === lastScannedCode && (now - lastScanTimestamp) < SCAN_DEBOUNCE_MS) {
        return;
    }
    lastScannedCode = cleanCode;
    lastScanTimestamp = now;

    // Reproducir feedback sonoro "bip"
    if (typeof playBeepSuccess === 'function') {
        playBeepSuccess();
    }

    // Efecto de parpadeo en la mira
    flashScannerLaser();

    // -------------------------------------------------------------
    // CASO 1: MODO VENTA / COBRO EN CAJA (POS)
    // -------------------------------------------------------------
    if (currentScannerMode === 'pos') {
        await handlePosBarcodeScan(cleanCode);
    }
    // -------------------------------------------------------------
    // CASO 2: MODO CARGAR / ASIGNAR CÓDIGO A PRODUCTO (INVENTARIO)
    // -------------------------------------------------------------
    else if (currentScannerMode === 'product') {
        handleProductFormBarcodeScan(cleanCode);
    }
    // -------------------------------------------------------------
    // CASO 3: MODO BÚSQUEDA EN INVENTARIO
    // -------------------------------------------------------------
    else if (currentScannerMode === 'search') {
        handleSearchBarcodeScan(cleanCode);
    }
}

/**
 * Procesa el escaneo en el POS: busca en la BD y agrega al carrito
 */
async function handlePosBarcodeScan(code) {
    showScannerToast(`Buscando código ${code}...`, code, 'loading');

    try {
        const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
        
        if (!res.ok) {
            if (typeof playBeepError === 'function') playBeepError();
            showScannerNotFoundDialog(code);
            return;
        }

        const data = await res.json();
        if (data.found && data.product) {
            const product = data.product;
            const qty = data.quantity || 1.0;

            // Agregar al carrito
            if (typeof addToCart === 'function') {
                addToCart(product, qty);
            }

            // Mostrar toast verde de éxito
            const priceFormatted = typeof formatMoney === 'function' ? formatMoney(product.sale_price) : product.sale_price;
            showScannerToast(`✓ Agregado: ${product.name} ($${priceFormatted})`, code, 'success');

            // Si no está en modo continuo, cerrar el escáner
            const continuousCheckbox = document.getElementById('camera-continuous-scan');
            if (continuousCheckbox && !continuousCheckbox.checked) {
                setTimeout(() => {
                    closeCameraScannerModal();
                }, 800);
            }
        } else {
            if (typeof playBeepError === 'function') playBeepError();
            showScannerNotFoundDialog(code);
        }
    } catch (err) {
        console.error("Error al buscar producto escaneado:", err);
        showScannerToast(`Error de conexión al consultar código`, code, 'error');
    }
}

/**
 * Procesa el escaneo en el formulario de producto
 */
async function handleProductFormBarcodeScan(code) {
    const codeInput = document.getElementById('prod-code');
    if (codeInput) {
        codeInput.value = code;
    }

    showScannerToast(`✓ Código cargado: ${code}`, code, 'success');

    // Cerrar el escáner y enfocar el formulario
    setTimeout(async () => {
        await closeCameraScannerModal();

        // Opcional: verificar si ya existe un producto con este código
        try {
            const checkRes = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.found && checkData.product) {
                    alert(`Aviso: Este código ya está asignado al producto "${checkData.product.name}" ($${checkData.product.sale_price}). Podés editarlo o cambiar el código.`);
                }
            }
        } catch (e) {}

        const nameInput = document.getElementById('prod-name');
        if (nameInput && !nameInput.value) {
            nameInput.focus();
        }
    }, 700);
}

/**
 * Procesa el escaneo para buscar en inventario
 */
function handleSearchBarcodeScan(code) {
    const searchInput = document.getElementById('inventory-search');
    if (searchInput) {
        searchInput.value = code;
        if (typeof renderInventoryTable === 'function') {
            renderInventoryTable();
        }
    }
    showScannerToast(`✓ Filtrado por código: ${code}`, code, 'success');
    setTimeout(() => {
        closeCameraScannerModal();
    }, 600);
}

/**
 * Diálogo interactivo cuando un código no existe en el catálogo
 */
function showScannerNotFoundDialog(code) {
    showScannerToast(`No encontrado: ${code}`, code, 'error');

    // Modal flotante o confirmación para dar de alta
    setTimeout(() => {
        const createNow = confirm(
            `El producto con código [${code}] no está registrado en el sistema.\n\n¿Deseas darlo de alta ahora mismo en el inventario?`
        );
        if (createNow) {
            closeCameraScannerModal();
            // Abrir modal de nuevo producto con el código ya completado
            if (typeof openCreateProductModal === 'function') {
                openCreateProductModal();
                const codeInput = document.getElementById('prod-code');
                if (codeInput) codeInput.value = code;
            } else if (typeof openProductModal === 'function') {
                openProductModal();
                const codeInput = document.getElementById('prod-code');
                if (codeInput) codeInput.value = code;
            }
        }
    }, 300);
}

/**
 * Escanear código de barras a partir de un archivo de imagen subido
 */
async function scanBarcodeFromImageFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!html5QrCodeScanner) {
        html5QrCodeScanner = new Html5Qrcode('camera-scanner-reader');
    }

    showScannerToast(`Analizando imagen...`, '', 'loading');

    try {
        const decodedText = await html5QrCodeScanner.scanFile(file, true);
        if (decodedText) {
            handleBarcodeDecoded(decodedText, { text: decodedText });
        }
    } catch (err) {
        console.warn("No se detectó código de barras en la imagen:", err);
        showScannerToast(`No se detectó ningún código nítido en la imagen`, '', 'error');
        alert("No se pudo detectar un código de barras en la foto. Procurá que esté bien iluminado y enfocado.");
    } finally {
        event.target.value = '';
    }
}

/**
 * Efectos visuales de notificación dentro del escáner
 */
function showScannerToast(message, code, type = 'success') {
    const toast = document.getElementById('camera-scanner-toast');
    const msgEl = document.getElementById('camera-scanner-toast-msg');
    const codeEl = document.getElementById('camera-scanner-toast-code');

    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    if (codeEl) {
        codeEl.textContent = code || '';
        codeEl.style.display = code ? 'inline-block' : 'none';
    }

    toast.classList.remove('hidden');

    // Estilos según el tipo
    const container = toast.firstElementChild;
    if (container) {
        if (type === 'success') {
            container.className = 'bg-emerald-600/95 backdrop-blur-md text-white text-xs font-bold py-2.5 px-3.5 rounded-2xl shadow-xl flex items-center justify-between border border-emerald-400/40 animate-bounce-once';
        } else if (type === 'error') {
            container.className = 'bg-rose-600/95 backdrop-blur-md text-white text-xs font-bold py-2.5 px-3.5 rounded-2xl shadow-xl flex items-center justify-between border border-rose-400/40';
        } else {
            container.className = 'bg-amber-600/95 backdrop-blur-md text-white text-xs font-bold py-2.5 px-3.5 rounded-2xl shadow-xl flex items-center justify-between border border-amber-400/40';
        }
    }

    if (type !== 'loading') {
        setTimeout(() => {
            hideScannerToast();
        }, 3200);
    }
}

function hideScannerToast() {
    const toast = document.getElementById('camera-scanner-toast');
    if (toast) toast.classList.add('hidden');
}

function flashScannerLaser() {
    const overlay = document.getElementById('camera-scanner-overlay');
    if (overlay) {
        const box = overlay.querySelector('div');
        if (box) {
            box.classList.add('border-emerald-400');
            box.classList.remove('border-orange-500/80');
            setTimeout(() => {
                box.classList.remove('border-emerald-400');
                box.classList.add('border-orange-500/80');
            }, 500);
        }
    }
}
