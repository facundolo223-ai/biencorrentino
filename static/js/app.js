/**
 * Supermercado & Almacén POS - Lógica Frontend de Alta Velocidad
 */

// Estado Global
let state = {
    cart: [],
    discountPercent: 0,
    categories: [],
    products: [],
    customers: [],
    users: [],
    currentUser: null,
    selectedSwitchUserId: null,
    selectedLoginUserId: null,
    currentShift: null,
    selectedPaymentMethod: 'EFECTIVO',
    activeTab: 'pos',
    selectedCategoryFilter: null,
    rankingFilters: {
        order: 'desc',
        period: 'all',
        category_id: '',
        search: ''
    }
};

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    checkCurrentUser();
    syncInitialLogo();
    loadUsers();
    loadCategories();
    loadProducts();
    loadCustomers();
    loadCurrentShift();
    setupEventListeners();
    setupKeyboardShortcuts();
    refreshNextTicketNumber();
    if (window.innerWidth < 1024) {
        setMobilePosTab('catalog');
    }
});

async function syncInitialLogo() {
    try {
        const res = await fetch('/api/config');
        const cfg = await res.json();
        if (cfg && cfg.business_logo) {
            updateLogoUI(cfg.business_logo);
        }
    } catch (e) {}
}

// --------------------------------------------------------------------------
// RELOJ EN VIVO
// --------------------------------------------------------------------------
function initClock() {
    function update() {
        const now = new Date();
        const str = now.toLocaleTimeString('es-AR', { hour12: false });
        const el = document.getElementById('live-clock');
        if (el) el.textContent = str;

        const posClock = document.getElementById('live-clock-pos');
        if (posClock) posClock.textContent = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        const posDate = document.getElementById('live-date-pos');
        if (posDate) {
            const dateStr = now.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
            posDate.textContent = dateStr;
        }
    }
    update();
    setInterval(update, 1000);
}

// --------------------------------------------------------------------------
// NAVEGACIÓN ENTRE PESTAÑAS
// --------------------------------------------------------------------------
function switchTab(tabId) {
    state.activeTab = tabId;
    const tabs = ['pos', 'products', 'customers', 'cash', 'reports', 'ranking', 'config'];
    
    tabs.forEach(t => {
        const section = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        const mobileBtn = document.getElementById(`mobile-nav-btn-${t}`);

        if (section) {
            if (t === tabId) {
                section.classList.remove('hidden');
                section.classList.add('flex');
            } else {
                section.classList.add('hidden');
                section.classList.remove('flex');
            }
        }
        if (btn) {
            if (t === tabId) {
                btn.className = 'tab-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 text-white shadow-sm transition';
            } else {
                if (t === 'ranking') {
                    btn.className = 'tab-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-white hover:bg-amber-500/20 transition';
                } else {
                    btn.className = 'tab-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-white hover:bg-gray-800 transition';
                }
            }
        }
        if (mobileBtn) {
            if (t === tabId) {
                mobileBtn.className = 'flex flex-col items-center justify-center flex-1 py-1 text-orange-600 font-bold text-[10px] transition active:scale-95';
            } else {
                mobileBtn.className = 'flex flex-col items-center justify-center flex-1 py-1 text-gray-400 hover:text-slate-800 font-medium text-[10px] transition active:scale-95';
            }
        }
    });

    if (tabId === 'pos') {
        focusBarcodeInput();
    } else if (tabId === 'products') {
        renderInventoryTable();
    } else if (tabId === 'customers') {
        loadCustomers();
    } else if (tabId === 'cash') {
        loadCurrentShift();
    } else if (tabId === 'reports') {
        loadReportsDashboard();
    } else if (tabId === 'ranking') {
        loadRankingDashboard();
    } else if (tabId === 'config') {
        loadConfigForm();
        loadUsers();
    }

    if (window.lucide) lucide.createIcons();
}

function focusBarcodeInput() {
    if (window.innerWidth < 1024) return; // Evitar que el teclado virtual tape la pantalla en celulares
    const input = document.getElementById('barcode-input');
    if (input) {
        setTimeout(() => input.focus(), 50);
    }
}

// --------------------------------------------------------------------------
// EVENT LISTENERS & ATAJOS DE TECLADO
// --------------------------------------------------------------------------
function setupEventListeners() {
    // Escáner y Buscador Inteligente en Tiempo Real de Productos
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
        barcodeInput.addEventListener('input', handleBarcodeInput);
        barcodeInput.addEventListener('keydown', handleBarcodeKeydown);
    }

    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
        const resultsEl = document.getElementById('barcode-search-results');
        const inputEl = document.getElementById('barcode-input');
        if (resultsEl && !resultsEl.contains(e.target) && e.target !== inputEl) {
            hideBarcodeSearchResults();
        }
    });

    // Buscador por nombre en POS
    const searchInput = document.getElementById('search-product-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterProductsGrid();
        });
    }

    // Buscador en Inventario
    const invSearch = document.getElementById('inventory-search');
    if (invSearch) {
        invSearch.addEventListener('input', () => renderInventoryTable());
    }
    const invCat = document.getElementById('inventory-cat-filter');
    if (invCat) {
        invCat.addEventListener('change', () => renderInventoryTable());
    }

    // Monto pagado en Modal de Checkout
    const paidInput = document.getElementById('modal-amount-paid');
    if (paidInput) {
        paidInput.addEventListener('input', () => updateChangeCalculation());
    }

    // Modal balanza peso input
    const weightInput = document.getElementById('scale-weight-input');
    if (weightInput) {
        weightInput.addEventListener('input', () => updateScaleSubtotalCalc());
    }

    // Input de PIN en Pantalla de Login (Enter para ingresar)
    const loginPinInput = document.getElementById('login-pin-input');
    if (loginPinInput) {
        loginPinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitLogin();
            }
        });
    }

    // Buscador y Filtro de Categoría en Ranking de Ventas
    const rankSearch = document.getElementById('ranking-search');
    if (rankSearch) {
        rankSearch.addEventListener('input', () => {
            state.rankingFilters.search = rankSearch.value.trim();
            loadRankingDashboard();
        });
    }
    const rankCat = document.getElementById('ranking-category-filter');
    if (rankCat) {
        rankCat.addEventListener('change', () => {
            state.rankingFilters.category_id = rankCat.value;
            loadRankingDashboard();
        });
    }
}

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // F1: Enfocar escáner / volver a Caja
        if (e.key === 'F1') {
            e.preventDefault();
            switchTab('pos');
            focusBarcodeInput();
        }
        // F2: Modificar cantidad último ítem
        else if (e.key === 'F2') {
            e.preventDefault();
            editLastItemQuantity();
        }
        // F4 o F10: Abrir Cobro (como en Posberry)
        else if (e.key === 'F4' || e.key === 'F10') {
            e.preventDefault();
            openFastCheckoutModal();
        }
        // F6: Ir a Inventario
        else if (e.key === 'F6') {
            e.preventDefault();
            switchTab('products');
        }
        // F8: Pesar en Balanza
        else if (e.key === 'F8') {
            e.preventDefault();
            openWeighItemModal();
        }
        // Esc: Cerrar modales o limpiar escáner
        else if (e.key === 'Escape') {
            closeAllModals();
            focusBarcodeInput();
        }
    });
}

function closeAllModals() {
    closeCheckoutModal();
    closeScaleModal();
    closeMassPriceModal();
    closeCashMovementModal();
    closeCloseShiftModal();
    closeProductModal();
    closeCustomerModal();
    closeUserPinModal();
    closeSwitchUserModal();
    closeCreateUserModal();
}

// --------------------------------------------------------------------------
// CARGA DE DATOS DESDE LA API
// --------------------------------------------------------------------------
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        state.categories = await res.json();
        renderCategoryChips();
        populateCategorySelects();
    } catch (err) {
        console.error("Error al cargar categorías:", err);
    }
}

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        state.products = await res.json();
        renderProductsGrid();
        renderInventoryTable();
    } catch (err) {
        console.error("Error al cargar productos:", err);
    }
}

async function loadCustomers() {
    try {
        const res = await fetch('/api/customers');
        state.customers = await res.json();
        renderCustomersDropdown();
        renderCustomersList();
    } catch (err) {
        console.error("Error al cargar clientes:", err);
    }
}

async function loadCurrentShift() {
    try {
        const res = await fetch('/api/cash/current');
        const data = await res.json();
        state.currentShift = data;

        const badge = document.getElementById('shift-status-badge');
        const text = document.getElementById('header-shift-text');
        if (data.has_open_shift) {
            badge.className = "inline-flex items-center gap-1 text-orange-600 font-medium";
            text.textContent = `${data.shift.cashier_name} - Turno Abierto`;
        } else {
            badge.className = "inline-flex items-center gap-1 text-rose-400 font-medium";
            text.textContent = `Caja Cerrada`;
        }
        renderCashSummaryCards(data);
    } catch (err) {
        console.error("Error al cargar turno de caja:", err);
    }
}

function refreshNextTicketNumber() {
    fetch('/api/orders?limit=1')
        .then(r => r.json())
        .then(orders => {
            const nextNum = (orders.length > 0) ? (orders[0].id + 1) : 1;
            const str = `T-${String(nextNum).padStart(5, '0')}`;
            const label = document.getElementById('next-ticket-label');
            if (label) label.textContent = str;
        })
        .catch(() => {});
}

// --------------------------------------------------------------------------
// MOTOR DE BÚSQUEDA INTELIGENTE & AUTOCOMPLETADO EN TIEMPO REAL
// --------------------------------------------------------------------------
let barcodeSearchActiveIndex = -1;
let barcodeSearchResultsList = [];
let barcodeSearchDebounceTimer = null;

function normalizeSearchText(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesProductSearch(product, rawQuery) {
    if (!rawQuery || !rawQuery.trim()) return true;
    const queryNorm = normalizeSearchText(rawQuery);
    if (!queryNorm) return true;

    // Coincidencia exacta o directa de código de barras
    const code = (product.code || '').trim().toLowerCase();
    const queryClean = rawQuery.trim().toLowerCase();
    if (code && (code === queryClean || code.startsWith(queryClean))) {
        return true;
    }

    // Coincidencia multi-token (cada palabra debe aparecer en nombre, código o categoría)
    const targetNorm = normalizeSearchText(`${product.name || ''} ${product.code || ''} ${product.category_name || ''}`);
    const tokens = queryNorm.split(/\s+/).filter(Boolean);
    return tokens.every(token => targetNorm.includes(token));
}

function highlightSearchMatch(text, query) {
    if (!query || !text) return text || '';
    const queryNorm = normalizeSearchText(query);
    const tokens = queryNorm.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;

    const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    try {
        const regex = new RegExp(`(${escaped})`, 'gi');
        return String(text).replace(regex, '<mark class="bg-orange-200 text-orange-950 font-bold px-0.5 rounded">$1</mark>');
    } catch (e) {
        return text;
    }
}

function handleBarcodeInput(e) {
    clearTimeout(barcodeSearchDebounceTimer);
    const input = e.target;
    const val = (input.value || '').trim();

    // Si tiene menos de 2 caracteres, ocultar desplegable
    if (val.length < 2) {
        hideBarcodeSearchResults();
        return;
    }

    // Si parece un escaneo directo de lector óptico (12-14 dígitos puros ingresados en milisegundos), no interferir
    if (/^\d{12,14}$/.test(val)) {
        hideBarcodeSearchResults();
        return;
    }

    barcodeSearchDebounceTimer = setTimeout(() => {
        executeBarcodePredictiveSearch(val);
    }, 80);
}

function executeBarcodePredictiveSearch(query) {
    if (!state.products || state.products.length === 0) {
        hideBarcodeSearchResults();
        return;
    }

    const normQuery = normalizeSearchText(query);
    let matches = state.products.filter(p => matchesProductSearch(p, query));

    // Ordenar por relevancia
    matches.sort((a, b) => {
        const aCode = (a.code || '').toLowerCase();
        const bCode = (b.code || '').toLowerCase();
        const aNorm = normalizeSearchText(a.name || '');
        const bNorm = normalizeSearchText(b.name || '');

        // 1. Coincidencia exacta de código
        if (aCode === query.toLowerCase()) return -1;
        if (bCode === query.toLowerCase()) return 1;

        // 2. Coincidencia exacta de nombre
        if (aNorm === normQuery) return -1;
        if (bNorm === normQuery) return 1;

        // 3. Nombre empieza con la búsqueda
        if (aNorm.startsWith(normQuery) && !bNorm.startsWith(normQuery)) return -1;
        if (!aNorm.startsWith(normQuery) && bNorm.startsWith(normQuery)) return 1;

        return aNorm.localeCompare(bNorm);
    });

    barcodeSearchResultsList = matches.slice(0, 8);
    barcodeSearchActiveIndex = barcodeSearchResultsList.length > 0 ? 0 : -1;
    renderBarcodeSearchResults(barcodeSearchResultsList, query);
}

function renderBarcodeSearchResults(list, query) {
    const resultsContainer = document.getElementById('barcode-search-results');
    const countEl = document.getElementById('barcode-search-count');
    const listEl = document.getElementById('barcode-search-list');

    if (!resultsContainer || !listEl) return;

    if (list.length === 0) {
        countEl.textContent = '0 resultados';
        listEl.innerHTML = `
            <div class="p-4 text-center text-slate-500 text-xs">
                <i data-lucide="package-search" class="w-8 h-8 text-slate-400 mx-auto mb-1 stroke-[1.5]"></i>
                <p class="font-semibold text-slate-700">No encontramos productos con "${query}"</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Presioná <span class="font-mono font-bold text-orange-600">[Enter]</span> para buscar en el servidor o cargalo en Inventario</p>
            </div>
        `;
        resultsContainer.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
        return;
    }

    countEl.textContent = `${list.length} producto${list.length > 1 ? 's' : ''} encontrado${list.length > 1 ? 's' : ''}`;
    
    listEl.innerHTML = list.map((p, idx) => {
        const isKg = p.unit_type === 'kg' || p.is_weighable;
        const lowStock = p.control_stock && (p.stock <= p.min_stock);
        const highlightedName = highlightSearchMatch(p.name, query);
        const imgThumb = p.image_url ? `
            <img src="${p.image_url}" alt="${p.name}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 flex-shrink-0" onerror="this.style.display='none'">
        ` : `
            <div class="w-10 h-10 rounded-xl bg-orange-100/70 border border-orange-200 text-orange-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                <i data-lucide="package" class="w-5 h-5"></i>
            </div>
        `;

        return `
            <div id="barcode-result-item-${idx}" 
                 onclick="selectBarcodeSearchResult(${idx})"
                 class="barcode-search-item px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition hover:bg-orange-50 select-none ${idx === barcodeSearchActiveIndex ? 'bg-orange-100/80 border-l-4 border-orange-600' : ''}">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    ${imgThumb}
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs font-bold text-slate-900 truncate">${highlightedName}</span>
                            <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                ${p.category_name || 'Almacén'}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                            <span>Cod: <b class="text-slate-700">${p.code || 'S/C'}</b></span>
                            <span>•</span>
                            <span class="${lowStock ? 'text-rose-600 font-bold' : 'text-slate-600'}">
                                Stock: ${p.stock} ${isKg ? 'kg' : 'u'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-3 text-right flex-shrink-0">
                    <div>
                        <div class="text-sm font-black font-mono text-orange-600">$${formatMoney(p.sale_price)}</div>
                        <div class="text-[10px] text-slate-400 font-semibold">${isKg ? 'por Kilo' : 'por Unidad'}</div>
                    </div>
                    <button type="button" class="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span class="hidden sm:inline">Agregar</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    resultsContainer.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function highlightBarcodeSearchActiveItem() {
    const listEl = document.getElementById('barcode-search-list');
    if (!listEl) return;

    const items = listEl.querySelectorAll('.barcode-search-item');
    items.forEach((item, idx) => {
        if (idx === barcodeSearchActiveIndex) {
            item.classList.add('bg-orange-100/80', 'border-l-4', 'border-orange-600');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('bg-orange-100/80', 'border-l-4', 'border-orange-600');
        }
    });
}

function handleBarcodeKeydown(e) {
    const resultsContainer = document.getElementById('barcode-search-results');
    const isVisible = resultsContainer && !resultsContainer.classList.contains('hidden');

    if (e.key === 'ArrowDown') {
        if (isVisible && barcodeSearchResultsList.length > 0) {
            e.preventDefault();
            barcodeSearchActiveIndex = (barcodeSearchActiveIndex + 1) % barcodeSearchResultsList.length;
            highlightBarcodeSearchActiveItem();
        }
    } else if (e.key === 'ArrowUp') {
        if (isVisible && barcodeSearchResultsList.length > 0) {
            e.preventDefault();
            barcodeSearchActiveIndex = (barcodeSearchActiveIndex - 1 + barcodeSearchResultsList.length) % barcodeSearchResultsList.length;
            highlightBarcodeSearchActiveItem();
        }
    } else if (e.key === 'Escape') {
        hideBarcodeSearchResults();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        // Si el menú de sugerencias está abierto y hay un ítem seleccionado
        if (isVisible && barcodeSearchActiveIndex >= 0 && barcodeSearchResultsList[barcodeSearchActiveIndex]) {
            selectBarcodeSearchResult(barcodeSearchActiveIndex);
            return;
        }
        // Si hay resultados y no se movió con flechas, elegir el primer producto coincidente
        if (isVisible && barcodeSearchResultsList.length > 0) {
            selectBarcodeSearchResult(0);
            return;
        }

        // Si no hay sugerencias visibles, procesar con el backend (código directo, balanza o búsqueda profunda)
        const code = (e.target.value || '').trim();
        if (code) {
            processBarcodeScan(code);
        }
    }
}

function selectBarcodeSearchResult(idx) {
    const product = barcodeSearchResultsList[idx];
    if (product) {
        playBeepSuccess();
        flashBarcodeBorder('border-blue-400');
        
        if (product.unit_type === 'kg' || product.is_weighable) {
            // Producto pesado: abrir modal de balanza para ingresar peso exacto
            openWeighItemModal(product);
        } else {
            addToCart(product, 1.0);
        }
    }
    hideBarcodeSearchResults();
    const input = document.getElementById('barcode-input');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function hideBarcodeSearchResults() {
    const resultsContainer = document.getElementById('barcode-search-results');
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
    }
    barcodeSearchActiveIndex = -1;
    barcodeSearchResultsList = [];
}

// --------------------------------------------------------------------------
// PROCESAMIENTO INTELIGENTE DE ESCÁNER DE CÓDIGO DE BARRAS / BALANZA
// --------------------------------------------------------------------------
async function processBarcodeScan(code) {
    const input = document.getElementById('barcode-input');
    hideBarcodeSearchResults();

    try {
        const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
        if (!res.ok) {
            playBeepError();
            flashBarcodeBorder('border-rose-500');
            alert(`No se encontró ningún producto para: "${code}". Podés buscarlo por palabras o agregarlo desde Inventario.`);
            return;
        }

        const data = await res.json();
        if (data.found && data.product) {
            playBeepSuccess();
            flashBarcodeBorder('border-blue-400');
            
            const prod = data.product;
            if (prod.unit_type === 'kg' || prod.is_weighable) {
                if (data.scale_detected && data.quantity) {
                    addToCart(prod, data.quantity);
                } else {
                    openWeighItemModal(prod);
                }
            } else {
                const qty = data.quantity || 1.0;
                addToCart(prod, qty);
            }
        } else {
            playBeepError();
            flashBarcodeBorder('border-rose-500');
            alert(`No se encontró ningún producto para: "${code}"`);
        }
    } catch (err) {
        console.error("Error en escaneo de código:", err);
    } finally {
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function flashBarcodeBorder(colorClass) {
    const input = document.getElementById('barcode-input');
    if (input) {
        input.classList.remove('border-orange-500/60', 'border-rose-500');
        input.classList.add(colorClass);
        setTimeout(() => {
            input.classList.remove(colorClass);
            input.classList.add('border-orange-500/60');
        }, 400);
    }
}

function playBeepSuccess() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
}

function playBeepError() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
}

// --------------------------------------------------------------------------
// RENDERIZADO DE CATEGORÍAS & GRILLA DE PRODUCTOS
// --------------------------------------------------------------------------
function renderCategoryChips() {
    const container = document.getElementById('category-chips-container');
    if (!container) return;

    let html = `
        <button onclick="filterByCategory(null)" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${state.selectedCategoryFilter === null ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-orange-50'}">
            Todos
        </button>
    `;

    state.categories.forEach(cat => {
        const isActive = state.selectedCategoryFilter === cat.id;
        html += `
            <button onclick="filterByCategory(${cat.id})" class="px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${isActive ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-orange-50'}">
                <span class="w-2 h-2 rounded-full" style="background-color: ${cat.color || '#3b82f6'}"></span>
                <span>${cat.name}</span>
            </button>
        `;
    });

    container.innerHTML = html;
}

function filterByCategory(catId) {
    state.selectedCategoryFilter = catId;
    renderCategoryChips();
    filterProductsGrid();
}

function filterProductsGrid() {
    const search = (document.getElementById('search-product-input')?.value || '').trim();
    let filtered = state.products;

    if (state.selectedCategoryFilter !== null) {
        filtered = filtered.filter(p => p.category_id === state.selectedCategoryFilter);
    }
    if (search) {
        filtered = filtered.filter(p => matchesProductSearch(p, search));
    }

    renderProductsCards(filtered);
}

function renderProductsGrid() {
    filterProductsGrid();
}

function renderProductsCards(productsList) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (productsList.length === 0) {
        grid.innerHTML = `
            <div class="h-64 flex flex-col items-center justify-center text-gray-500 text-xs">
                <i data-lucide="package-search" class="w-10 h-10 mb-2 stroke-[1.5]"></i>
                <span>No se encontraron productos coincidentes</span>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    grid.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            ${productsList.map(p => {
                const isKg = p.unit_type === 'kg' || p.is_weighable;
                const imgThumb = p.image_url ? `
                    <img src="${p.image_url}" alt="${p.name}" class="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-slate-200" onerror="this.style.display='none'">
                ` : '';

                return `
                    <div onclick="handleProductCardClick(${p.id})" class="group bg-white hover:bg-orange-50/80 border border-slate-200 hover:border-orange-500 rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition active:scale-95 shadow-sm text-left h-24 select-none">
                        <div class="flex items-start gap-2 min-w-0">
                            ${imgThumb}
                            <div class="min-w-0 flex-1">
                                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isKg ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-orange-100 text-orange-800'}">
                                    ${isKg ? 'x Kg' : 'Unidad'}
                                </span>
                                <h4 class="text-xs font-bold text-slate-800 group-hover:text-orange-600 line-clamp-2 leading-tight mt-0.5">
                                    ${p.name}
                                </h4>
                            </div>
                        </div>
                        <div class="flex items-baseline justify-between pt-1 border-t border-slate-100 mt-1">
                            <span class="text-xs font-mono font-black text-red-600 font-extrabold">$${formatMoney(p.sale_price)}</span>
                            <span class="text-[9px] text-gray-400">Stock: ${p.stock}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function handleProductCardClick(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;

    if (prod.unit_type === 'kg' || prod.is_weighable) {
        openWeighItemModal(prod.id);
    } else {
        addToCart(prod, 1);
        if (navigator.vibrate) {
            try { navigator.vibrate(35); } catch(e) {}
        }
        playBeepSuccess();
        if (window.innerWidth >= 1024) {
            focusBarcodeInput();
        }
    }
}

// --------------------------------------------------------------------------
// GESTIÓN DEL CARRITO / TICKET EN CURSO
// --------------------------------------------------------------------------
function addToCart(product, quantity = 1) {
    const existingIndex = state.cart.findIndex(it => it.id === product.id);

    if (existingIndex >= 0) {
        state.cart[existingIndex].quantity = roundQty(state.cart[existingIndex].quantity + quantity);
        state.cart[existingIndex].subtotal = roundMoney(state.cart[existingIndex].quantity * product.sale_price);
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            code: product.code,
            unit_type: product.unit_type || 'un',
            is_weighable: product.is_weighable || 0,
            sale_price: product.sale_price,
            quantity: roundQty(quantity),
            subtotal: roundMoney(quantity * product.sale_price)
        });
    }

    renderCart();
}

function updateCartQuantity(index, newQty) {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) {
        removeFromCart(index);
        return;
    }
    state.cart[index].quantity = roundQty(qty);
    state.cart[index].subtotal = roundMoney(state.cart[index].quantity * state.cart[index].sale_price);
    renderCart();
}

function changeItemQtyBy(index, delta) {
    const item = state.cart[index];
    if (!item) return;
    const isKg = item.unit_type === 'kg' || item.is_weighable;
    const step = isKg ? (delta > 0 ? 0.25 : -0.25) : delta;
    updateCartQuantity(index, item.quantity + step);
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    renderCart();
    focusBarcodeInput();
}

function clearCart() {
    if (state.cart.length === 0) return;
    state.cart = [];
    state.discountPercent = 0;
    renderCart();
    focusBarcodeInput();
}

function editLastItemQuantity() {
    if (state.cart.length === 0) return;
    const lastIndex = state.cart.length - 1;
    const item = state.cart[lastIndex];
    const val = prompt(`Ingrese nueva cantidad/peso para '${item.name}':`, item.quantity);
    if (val !== null) {
        updateCartQuantity(lastIndex, parseFloat(val));
    }
}

function promptDiscount() {
    const val = prompt("Ingrese porcentaje de descuento (%):", state.discountPercent || "10");
    if (val !== null) {
        const num = parseFloat(val);
        state.discountPercent = (!isNaN(num) && num >= 0 && num <= 100) ? num : 0;
        renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cart-items-list');
    if (!container) return;

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-500 text-xs py-12">
                <i data-lucide="shopping-basket" class="w-12 h-12 mb-2 stroke-[1.5] text-gray-600"></i>
                <span class="font-medium">Ticket vacío</span>
                <span class="text-[11px] text-gray-500 mt-1">Escanee un código de barras o seleccione un producto</span>
            </div>
        `;
        updateCartTotalsDisplay(0, 0, 0);
        if (window.lucide) lucide.createIcons();
        return;
    }

    let subtotal = 0;

    container.innerHTML = state.cart.map((item, idx) => {
        subtotal += item.subtotal;
        const isKg = item.unit_type === 'kg' || item.is_weighable;

        return `
            <div class="grid grid-cols-12 items-center py-2 px-2 hover:bg-orange-50/60 rounded-xl transition gap-2 text-xs border-b border-slate-100">
                <!-- Control de Cantidad (col-span-2) -->
                <div class="col-span-2 flex items-center gap-0.5">
                    <button type="button" onclick="changeItemQtyBy(${idx}, -1)" class="w-5 h-5 rounded bg-slate-100 hover:bg-orange-200 text-slate-700 hover:text-orange-900 flex items-center justify-center">
                        <i data-lucide="minus" class="w-3 h-3"></i>
                    </button>
                    <input type="number" step="${isKg ? '0.001' : '1'}" min="0.001" value="${item.quantity}" 
                        onchange="updateCartQuantity(${idx}, this.value)"
                        class="w-10 text-center bg-white border border-slate-200 rounded font-mono font-bold text-slate-900 text-[11px] focus:outline-none focus:border-orange-500">
                    <button type="button" onclick="changeItemQtyBy(${idx}, 1)" class="w-5 h-5 rounded bg-slate-100 hover:bg-orange-200 text-slate-700 hover:text-orange-900 flex items-center justify-center">
                        <i data-lucide="plus" class="w-3 h-3"></i>
                    </button>
                </div>

                <!-- Detalle del Producto (col-span-5) -->
                <div class="col-span-5 min-w-0 pr-1">
                    <div class="font-bold text-slate-800 truncate text-xs" title="${item.name}">${item.name}</div>
                    <div class="text-[10px] text-gray-500 font-mono">${isKg ? 'Pesable / kg' : 'Unidad'}</div>
                </div>

                <!-- Precio Unitario (col-span-2 text-right) -->
                <div class="col-span-2 text-right font-mono text-gray-400 text-xs">
                    $${formatMoney(item.sale_price)}
                </div>

                <!-- Subtotal (col-span-2 text-right) -->
                <div class="col-span-2 text-right font-mono font-black text-red-600 text-xs">
                    $${formatMoney(item.subtotal)}
                </div>

                <!-- Eliminar ítem (col-span-1 text-center) -->
                <div class="col-span-1 text-center">
                    <button type="button" onclick="removeFromCart(${idx})" class="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 transition">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    const discountAmount = roundMoney(subtotal * (state.discountPercent / 100));
    const total = Math.max(0, subtotal - discountAmount);

    updateCartTotalsDisplay(subtotal, discountAmount, total);
    if (window.lucide) lucide.createIcons();
}

function updateCartTotalsDisplay(subtotal, discountAmount, total) {
    const subText = document.getElementById('cart-subtotal-text');
    const grandText = document.getElementById('cart-grand-total');
    const discRow = document.getElementById('cart-discount-row');
    const discPercent = document.getElementById('cart-discount-percent');
    const discAmount = document.getElementById('cart-discount-amount');

    if (subText) subText.textContent = `$${formatMoney(subtotal)}`;
    if (grandText) grandText.textContent = `$${formatMoney(total)}`;

    if (discRow) {
        if (state.discountPercent > 0) {
            discRow.classList.remove('hidden');
            if (discPercent) discPercent.textContent = state.discountPercent;
            if (discAmount) discAmount.textContent = `-$${formatMoney(discountAmount)}`;
        } else {
            discRow.classList.add('hidden');
        }
    }

    // Sincronizar contadores y badges para celulares
    const totalItems = state.cart.length;
    const cartCountEl = document.getElementById('mobile-cart-count');
    const cartTotalEl = document.getElementById('mobile-cart-total');
    const floatCountEl = document.getElementById('mobile-floating-count');
    const floatTotalEl = document.getElementById('mobile-floating-total');
    const floatBarEl = document.getElementById('mobile-floating-cart-bar');
    const cartHeaderItems = document.getElementById('mobile-cart-header-items');

    if (cartCountEl) cartCountEl.textContent = totalItems;
    if (cartTotalEl) cartTotalEl.textContent = `$${formatMoney(total)}`;
    if (floatCountEl) floatCountEl.textContent = totalItems;
    if (floatTotalEl) floatTotalEl.textContent = `$${formatMoney(total)}`;
    if (cartHeaderItems) cartHeaderItems.textContent = `${totalItems} ítem${totalItems === 1 ? '' : 's'}`;

    if (floatBarEl) {
        if (totalItems > 0 && mobilePosActiveTab === 'catalog') {
            floatBarEl.classList.remove('hidden');
        } else {
            floatBarEl.classList.add('hidden');
        }
    }
}

// --------------------------------------------------------------------------
// CONTROL DE VISTA MÓVIL EN CAJA (CATÁLOGO vs TICKET)
// --------------------------------------------------------------------------
let mobilePosActiveTab = 'catalog';

function setMobilePosTab(tab) {
    mobilePosActiveTab = tab;
    const prodPanel = document.getElementById('pos-products-panel');
    const cartPanel = document.getElementById('pos-cart-panel');
    const btnCatalog = document.getElementById('mobile-pos-tab-catalog');
    const btnCart = document.getElementById('mobile-pos-tab-cart');
    const floatBarEl = document.getElementById('mobile-floating-cart-bar');

    if (!prodPanel || !cartPanel) return;

    if (tab === 'catalog') {
        prodPanel.classList.remove('hidden');
        prodPanel.classList.add('flex');

        cartPanel.classList.add('hidden');
        cartPanel.classList.remove('flex');

        if (btnCatalog) {
            btnCatalog.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition bg-orange-600 text-white shadow-sm';
        }
        if (btnCart) {
            btnCart.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition bg-gray-800 text-slate-700';
        }
        if (floatBarEl && state.cart.length > 0) {
            floatBarEl.classList.remove('hidden');
        }
    } else {
        // Vista de Ticket en móvil
        prodPanel.classList.add('hidden');
        prodPanel.classList.remove('flex');

        cartPanel.classList.remove('hidden');
        cartPanel.classList.add('flex');

        if (btnCatalog) {
            btnCatalog.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition bg-gray-800 text-slate-700';
        }
        if (btnCart) {
            btnCart.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition bg-orange-600 text-white shadow-sm';
        }
        if (floatBarEl) {
            floatBarEl.classList.add('hidden');
        }
    }

    if (window.lucide) lucide.createIcons();
}

// --------------------------------------------------------------------------
// MODAL DE BALANZA (VENTA PESABLE F8)
// --------------------------------------------------------------------------
function openWeighItemModal(preselectedId = null) {
    const select = document.getElementById('scale-product-select');
    if (!select) return;

    // Filtrar productos pesables (unit_type == 'kg' o is_weighable)
    const weighableProds = state.products.filter(p => p.unit_type === 'kg' || p.is_weighable);

    select.innerHTML = weighableProds.map(p => `
        <option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>
            ${p.name} ($${formatMoney(p.sale_price)}/kg)
        </option>
    `).join('');

    updateScaleProductInfo();
    const modal = document.getElementById('modal-scale');
    if (modal) {
        modal.classList.remove('hidden');
        const input = document.getElementById('scale-weight-input');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 100);
        }
    }
}

function closeScaleModal() {
    const modal = document.getElementById('modal-scale');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

function updateScaleProductInfo() {
    const select = document.getElementById('scale-product-select');
    const priceText = document.getElementById('scale-price-per-kg');
    if (!select || !priceText) return;

    const pid = parseInt(select.value);
    const prod = state.products.find(p => p.id === pid);
    if (prod) {
        priceText.textContent = `$${formatMoney(prod.sale_price)}`;
    }
    updateScaleSubtotalCalc();
}

function updateScaleSubtotalCalc() {
    const select = document.getElementById('scale-product-select');
    const input = document.getElementById('scale-weight-input');
    const subtotalText = document.getElementById('scale-subtotal-calc');
    if (!select || !input || !subtotalText) return;

    const pid = parseInt(select.value);
    const prod = state.products.find(p => p.id === pid);
    const weight = parseFloat(input.value) || 0;

    if (prod && weight > 0) {
        const sub = roundMoney(prod.sale_price * weight);
        subtotalText.textContent = `$${formatMoney(sub)}`;
    } else {
        subtotalText.textContent = "$0.00";
    }
}

function confirmScaleItemAdd() {
    const select = document.getElementById('scale-product-select');
    const input = document.getElementById('scale-weight-input');
    if (!select || !input) return;

    const pid = parseInt(select.value);
    const prod = state.products.find(p => p.id === pid);
    const weight = parseFloat(input.value);

    if (!prod || isNaN(weight) || weight <= 0) {
        alert("Ingrese un peso válido en kilogramos.");
        return;
    }

    addToCart(prod, weight);
    closeScaleModal();
}

// --------------------------------------------------------------------------
// MODAL DE COBRO RÁPIDO (F4)
// --------------------------------------------------------------------------
function openFastCheckoutModal() {
    if (state.cart.length === 0) {
        alert("El ticket está vacío. Agregue productos antes de cobrar.");
        focusBarcodeInput();
        return;
    }

    const subtotal = state.cart.reduce((sum, it) => sum + it.subtotal, 0);
    const discount = roundMoney(subtotal * (state.discountPercent / 100));
    const total = Math.max(0, subtotal - discount);

    document.getElementById('modal-checkout-total').textContent = `$${formatMoney(total)}`;
    
    // Reset medio de pago a Efectivo
    selectPaymentMethod('EFECTIVO');
    
    const paidInput = document.getElementById('modal-amount-paid');
    if (paidInput) {
        paidInput.value = '';
        setTimeout(() => paidInput.focus(), 100);
    }
    updateChangeCalculation();

    const modal = document.getElementById('modal-checkout');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeCheckoutModal() {
    const modal = document.getElementById('modal-checkout');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

function selectPaymentMethod(method) {
    state.selectedPaymentMethod = method;
    const methods = ['EFECTIVO', 'DEBITO', 'TRANSFERENCIA', 'CREDITO', 'CUENTA_CORRIENTE'];
    
    methods.forEach(m => {
        const btn = document.getElementById(`btn-pay-${m.toLowerCase().replace('_', '')}`);
        if (btn) {
            if (m === method) {
                btn.className = 'pay-method-btn py-2.5 px-3 rounded-xl bg-orange-600 text-white text-xs font-bold flex flex-col items-center gap-1 border border-orange-500 shadow-md';
            } else {
                btn.className = 'pay-method-btn py-2.5 px-3 rounded-xl bg-gray-800 text-slate-700 text-xs font-medium flex flex-col items-center gap-1 border border-gray-700 hover:bg-gray-700';
            }
        }
    });

    const cashSec = document.getElementById('cash-payment-section');
    if (cashSec) {
        if (method === 'EFECTIVO') {
            cashSec.classList.remove('hidden');
        } else {
            cashSec.classList.add('hidden');
        }
    }
}

function addQuickCash(amount) {
    const input = document.getElementById('modal-amount-paid');
    if (!input) return;
    const current = parseFloat(input.value) || 0;
    input.value = current + amount;
    updateChangeCalculation();
}

function setExactCash() {
    const subtotal = state.cart.reduce((sum, it) => sum + it.subtotal, 0);
    const discount = roundMoney(subtotal * (state.discountPercent / 100));
    const total = Math.max(0, subtotal - discount);

    const input = document.getElementById('modal-amount-paid');
    if (input) {
        input.value = total;
        updateChangeCalculation();
    }
}

function updateChangeCalculation() {
    const subtotal = state.cart.reduce((sum, it) => sum + it.subtotal, 0);
    const discount = roundMoney(subtotal * (state.discountPercent / 100));
    const total = Math.max(0, subtotal - discount);

    const paidInput = document.getElementById('modal-amount-paid');
    const changeText = document.getElementById('modal-change-text');
    if (!paidInput || !changeText) return;

    const paid = parseFloat(paidInput.value) || 0;
    const change = Math.max(0, paid - total);
    changeText.textContent = `$${formatMoney(change)}`;
}

async function confirmCheckout() {
    const subtotal = state.cart.reduce((sum, it) => sum + it.subtotal, 0);
    const discount = roundMoney(subtotal * (state.discountPercent / 100));
    const total = Math.max(0, subtotal - discount);

    const paidInput = document.getElementById('modal-amount-paid');
    let amountPaid = parseFloat(paidInput?.value) || total;

    if (state.selectedPaymentMethod === 'EFECTIVO' && amountPaid < total) {
        alert("El monto entregado no puede ser menor al total de la venta.");
        return;
    }

    const customerSelect = document.getElementById('cart-customer-select');
    const customerId = customerSelect?.value ? parseInt(customerSelect.value) : null;

    if (state.selectedPaymentMethod === 'CUENTA_CORRIENTE' && !customerId) {
        alert("Para fiar la compra, debe seleccionar un cliente en el encabezado del ticket.");
        return;
    }

    const payload = {
        items: state.cart.map(it => ({
            id: it.id,
            quantity: it.quantity
        })),
        payment_method: state.selectedPaymentMethod,
        amount_paid: amountPaid,
        discount_percent: state.discountPercent,
        customer_id: customerId,
        cashier_name: state.currentUser ? state.currentUser.name : 'Caja 1'
    };

    // La pestaña automática la bloquea Chrome y además window.print() congela el JS,
    // así que después de la venta mostramos un aviso con un botón real (nunca se bloquea).

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            alert(data.error || "Error al procesar la venta");
            return;
        }

        // Impresión de Ticket Térmico
        printThermalTicket(data.order);
        window.lastSaleOrder = data.order;   // para el botón "TICKET WA"

        // Limpiar ticket y refrescar datos
        closeCheckoutModal();
        clearCart();
        refreshNextTicketNumber();
        loadCurrentShift();
        loadProducts(); // para refrescar stock

        // Aviso para mandar el ticket al WhatsApp del local
        showTicketWhatsAppModal(data.order);

    } catch (err) {
        console.error("Error en checkout:", err);
        alert("Hubo un error de conexión al procesar la venta.");
    }
}

/**
 * Muestra el aviso posterior a la venta con el acceso directo al WhatsApp del local.
 */
function showTicketWhatsAppModal(order) {
    if (!window.SEND_TICKET_WHATSAPP || !order) return;

    const url = `https://wa.me/${getShopWhatsApp()}?text=${encodeURIComponent(buildSaleMessage(order))}`;
    const link = document.getElementById('wa-ticket-link');
    if (link) link.href = url;

    const numEl = document.getElementById('wa-ticket-number');
    if (numEl) numEl.textContent = order.order_number || '-';

    const totalEl = document.getElementById('wa-ticket-total');
    if (totalEl) totalEl.textContent = '$' + formatMoney(order.total);

    const modal = document.getElementById('modal-wa-ticket');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeTicketWhatsAppModal() {
    const modal = document.getElementById('modal-wa-ticket');
    if (modal) modal.classList.add('hidden');
}

/**
 * WhatsApp del local (misma normalización que la Tienda 3D).
 */
function getShopWhatsApp() {
    let n = String(window.STORE_WHATSAPP || '5493794821358').replace(/\D/g, '');
    n = n.replace(/^0+/, '');
    if (n.length === 10) {
        n = '549' + n;
    } else if (n.length === 11 && n.startsWith('54')) {
        n = '549' + n.slice(2);
    }
    return n;
}

/**
 * Reenvía el último ticket cobrado al WhatsApp del local.
 * Sirve como respaldo cuando el navegador bloquea la pestaña automática.
 */
function resendLastTicketWhatsApp() {
    if (!window.lastSaleOrder) {
        alert("Todavía no hay ningún ticket cobrado en esta sesión.\nCobrá una venta y después usá este botón.");
        return;
    }
    showTicketWhatsAppModal(window.lastSaleOrder);
}

/**
 * Arma el mensaje del ticket para mandarlo al WhatsApp del local como pedido.
 */
function buildSaleMessage(order) {
    const labels = {
        EFECTIVO: 'Efectivo',
        DEBITO: 'Débito',
        CREDITO: 'Crédito',
        TRANSFERENCIA: 'QR / Transferencia',
        CUENTA_CORRIENTE: 'Fiado (Libreta)'
    };

    let msg = `🧾 *TICKET ${order.order_number}*\n`;
    msg += `📅 ${order.date || ''}\n`;
    msg += `👤 ${order.customer_name || 'Consumidor Final'}\n`;
    msg += `💳 ${labels[order.payment_method] || order.payment_method || ''}\n`;
    msg += `🧑‍💼 Cajero: ${order.cashier_name || ''}\n`;
    msg += `\n*Detalle:*\n`;

    (order.items || []).forEach(it => {
        const qty = Number(it.quantity);
        const isKg = it.unit_type === 'kg';
        const qtyTxt = isKg ? `${qty.toFixed(3)}kg` : `${qty}un`;
        msg += `• ${qtyTxt} ${it.product_name} - $${formatMoney(it.subtotal)}\n`;
    });

    if (Number(order.discount_amount) > 0) {
        msg += `\nSubtotal: $${formatMoney(order.subtotal)}\n`;
        msg += `Descuento (${order.discount_percent}%): -$${formatMoney(order.discount_amount)}\n`;
    }

    msg += `\n💰 *TOTAL:* $${formatMoney(order.total)}\n`;
    msg += `\n_Pedido generado en la caja_`;
    return msg;
}

// --------------------------------------------------------------------------
// IMPRESIÓN DE TICKET TÉRMICO (58mm / 80mm)
// --------------------------------------------------------------------------
function printThermalTicket(order) {
    const container = document.getElementById('thermal-ticket-container');
    if (!container) return;

    const cfg = order.config || {};
    const dateStr = order.date || new Date().toLocaleString();

    let itemsRows = order.items.map(it => {
        const isKg = it.unit_type === 'kg';
        const qtyDisplay = isKg ? `${Number(it.quantity).toFixed(3)}kg` : `${it.quantity}un`;
        return `
            <tr>
                <td style="text-align: left; padding: 2px 0;">${it.product_name}</td>
                <td style="text-align: center; padding: 2px 0;">${qtyDisplay}</td>
                <td style="text-align: right; padding: 2px 0;">$${formatMoney(it.subtotal)}</td>
            </tr>
        `;
    }).join('');

    const ticketLogoUrl = cfg.business_logo || window.currentBusinessLogo || '';
    const logoMarkup = ticketLogoUrl ? `
        <div style="text-align: center; margin-bottom: 6px;">
            <img src="${ticketLogoUrl}" style="max-height: 48px; max-width: 140px; margin: 0 auto; display: block; filter: grayscale(100%) contrast(150%);" alt="Logo">
        </div>
    ` : '';

    container.innerHTML = `
        <div style="text-align: center; font-family: monospace; font-size: 11px; line-height: 1.3;">
            ${logoMarkup}
            <div style="font-weight: bold; font-size: 14px;">${cfg.business_name || 'SUPERMERCADO & ALMACEN'}</div>
            <div>${cfg.business_address || ''}</div>
            <div>CUIT: ${cfg.business_cuit || ''} • TEL: ${cfg.business_phone || ''}</div>
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            <div style="display: flex; justify-content: space-between;">
                <span>TICKET: ${order.order_number}</span>
                <span>${dateStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>CAJERO: ${order.cashier_name || 'Caja 1'}</span>
                <span>${order.customer_name ? 'CTE: ' + order.customer_name : 'CONS. FINAL'}</span>
            </div>
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px dashed #000;">
                        <th style="text-align: left;">DESCRIPCIÓN</th>
                        <th style="text-align: center;">CANT</th>
                        <th style="text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span>SUBTOTAL:</span>
                <span>$${formatMoney(order.subtotal)}</span>
            </div>
            ${order.discount_amount > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span>DESCUENTO (${order.discount_percent}%):</span>
                <span>-$${formatMoney(order.discount_amount)}</span>
            </div>` : ''}
            
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin: 4px 0;">
                <span>TOTAL:</span>
                <span>$${formatMoney(order.total)}</span>
            </div>

            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            <div style="display: flex; justify-content: space-between;">
                <span>MEDIO DE PAGO:</span>
                <span>${order.payment_method}</span>
            </div>
            ${order.payment_method === 'EFECTIVO' ? `
            <div style="display: flex; justify-content: space-between;">
                <span>PAGÓ CON:</span>
                <span>$${formatMoney(order.amount_paid)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>VUELTO:</span>
                <span>$${formatMoney(order.change_amount)}</span>
            </div>` : ''}

            <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
            <div style="font-size: 10px; margin-top: 4px;">
                ${cfg.business_footer || '¡Gracias por su compra! Vuelva pronto.'}
            </div>
        </div>
    `;

    container.classList.remove('hidden');
    window.print();
    container.classList.add('hidden');
}

// --------------------------------------------------------------------------
// AUMENTO MASIVO DE PRECIOS (%)
// --------------------------------------------------------------------------
function openMassPriceModal() {
    const select = document.getElementById('mass-price-category');
    if (select) {
        select.innerHTML = `
            <option value="">TODAS las Categorías (General)</option>
            ${state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        `;
    }
    const modal = document.getElementById('modal-mass-price');
    if (modal) modal.classList.remove('hidden');
}

function closeMassPriceModal() {
    const modal = document.getElementById('modal-mass-price');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

async function executeMassPriceUpdate() {
    const catSelect = document.getElementById('mass-price-category');
    const percentInput = document.getElementById('mass-price-percent');
    const roundSelect = document.getElementById('mass-price-round');

    const percent = parseFloat(percentInput.value);
    if (isNaN(percent) || percent === 0) {
        alert("Ingrese un porcentaje válido distinto de cero.");
        return;
    }

    const payload = {
        percentage: percent,
        category_id: catSelect.value ? parseInt(catSelect.value) : null,
        round_to: parseInt(roundSelect.value) || 10
    };

    if (!confirm(`¿Está seguro de aumentar un ${percent}% los precios seleccionados?`)) {
        return;
    }

    try {
        const res = await fetch('/api/products/bulk_price_update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
            closeMassPriceModal();
            loadProducts();
        } else {
            alert(data.error || "Error al actualizar precios");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

// --------------------------------------------------------------------------
// LIBRETA DE ALMACÉN (FIAR A CLIENTES)
// --------------------------------------------------------------------------
function renderCustomersDropdown() {
    const select = document.getElementById('cart-customer-select');
    if (!select) return;

    select.innerHTML = `
        <option value="">Consumidor Final</option>
        ${state.customers.map(c => {
            const hasDebt = c.current_balance > 0;
            return `
                <option value="${c.id}">
                    ${c.name} ${hasDebt ? `(Debe: $${formatMoney(c.current_balance)})` : ''}
                </option>
            `;
        }).join('')}
    `;
}

function renderCustomersList() {
    const container = document.getElementById('customers-list-container');
    if (!container) return;

    if (state.customers.length === 0) {
        container.innerHTML = `<div class="text-xs text-gray-500 p-4 text-center">No hay clientes registrados</div>`;
        return;
    }

    container.innerHTML = state.customers.map(c => {
        const isDebtor = c.current_balance > 0;
        return `
            <div onclick="selectCustomerForDetail(${c.id})" 
                class="p-3 bg-gray-950 hover:bg-gray-800 border border-slate-200/80 rounded-xl cursor-pointer transition flex items-center justify-between">
                <div>
                    <div class="text-xs font-semibold text-white">${c.name}</div>
                    <div class="text-[11px] text-gray-400">${c.phone || 'Sin teléfono'}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-mono font-bold ${isDebtor ? 'text-rose-400' : 'text-orange-600'}">
                        $${formatMoney(c.current_balance)}
                    </div>
                    <div class="text-[10px] text-gray-500">${isDebtor ? 'Deuda' : 'Al día'}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function selectCustomerForDetail(customerId) {
    try {
        const res = await fetch(`/api/customers/${customerId}/ledger`);
        const data = await res.json();
        const panel = document.getElementById('customer-detail-panel');
        if (!panel) return;

        const cust = data.customer;
        const movs = data.movements || [];

        panel.innerHTML = `
            <div class="flex flex-col h-full space-y-4">
                <div class="flex items-start justify-between border-b border-slate-200 pb-3">
                    <div>
                        <h3 class="text-base font-bold text-white">${cust.name}</h3>
                        <p class="text-xs text-gray-400">Tel: ${cust.phone || '-'} • Dirección: ${cust.address || '-'}</p>
                    </div>
                    <button onclick="promptCustomerPayment(${cust.id})" class="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition">
                        <i data-lucide="hand-coins" class="w-4 h-4"></i> Cobrar Abono / Pago
                    </button>
                </div>

                <!-- Resumen Saldo -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-gray-950 p-3 rounded-xl border border-slate-200">
                        <span class="text-[11px] text-gray-400">Saldo Adeudado:</span>
                        <div class="text-2xl font-mono font-extrabold ${cust.current_balance > 0 ? 'text-rose-400' : 'text-orange-600'}">
                            $${formatMoney(cust.current_balance)}
                        </div>
                    </div>
                    <div class="bg-gray-950 p-3 rounded-xl border border-slate-200">
                        <span class="text-[11px] text-gray-400">Límite de Crédito:</span>
                        <div class="text-2xl font-mono font-bold text-slate-800">
                            $${formatMoney(cust.credit_limit)}
                        </div>
                    </div>
                </div>

                <!-- Historial de compras y pagos -->
                <div class="flex-1 overflow-y-auto space-y-2">
                    <h4 class="text-xs font-bold text-slate-700">Movimientos de la Cuenta:</h4>
                    <table class="w-full text-left text-xs text-slate-700">
                        <thead class="bg-gray-950 text-gray-500 border-b border-slate-200">
                            <tr>
                                <th class="py-2 px-2">Fecha</th>
                                <th class="py-2 px-2">Tipo</th>
                                <th class="py-2 px-2">Concepto</th>
                                <th class="py-2 px-2 text-right">Monto</th>
                                <th class="py-2 px-2 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-800/60 font-mono">
                            ${movs.map(m => `
                                <tr>
                                    <td class="py-2 px-2 text-gray-400">${m.created_at}</td>
                                    <td class="py-2 px-2">
                                        <span class="px-1.5 py-0.5 rounded text-[10px] ${m.type === 'DEBT' ? 'bg-rose-950 text-rose-300' : 'bg-blue-950 text-blue-300'}">
                                            ${m.type === 'DEBT' ? 'Compra (Fiar)' : 'Abono'}
                                        </span>
                                    </td>
                                    <td class="py-2 px-2 font-sans">${m.description}</td>
                                    <td class="py-2 px-2 text-right font-bold ${m.type === 'DEBT' ? 'text-rose-400' : 'text-orange-600'}">
                                        ${m.type === 'DEBT' ? '+' : '-'}$${formatMoney(m.amount)}
                                    </td>
                                    <td class="py-2 px-2 text-right text-slate-700">$${formatMoney(m.balance_after)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Error al cargar detalle del cliente:", err);
    }
}

async function promptCustomerPayment(customerId) {
    const val = prompt("Ingrese el monto del abono / pago en efectivo ($):");
    if (!val) return;
    const amount = parseFloat(val);
    if (isNaN(amount) || amount <= 0) {
        alert("Monto inválido");
        return;
    }

    try {
        const res = await fetch(`/api/customers/${customerId}/ledger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description: 'Abono en efectivo en mostrador' })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Abono registrado. Nuevo saldo del cliente: $${formatMoney(data.new_balance)}`);
            loadCustomers();
            selectCustomerForDetail(customerId);
            loadCurrentShift();
        }
    } catch (err) {
        console.error(err);
    }
}

function openCustomerModal() {
    const modal = document.getElementById('modal-customer');
    if (modal) modal.classList.remove('hidden');
}

function closeCustomerModal() {
    const modal = document.getElementById('modal-customer');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

async function saveCustomer() {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const credit_limit = parseFloat(document.getElementById('cust-credit-limit').value) || 50000;
    const notes = document.getElementById('cust-notes').value.trim();

    if (!name) {
        alert("El nombre es obligatorio");
        return;
    }

    try {
        const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, address, credit_limit, notes })
        });
        if (res.ok) {
            closeCustomerModal();
            loadCustomers();
        }
    } catch (err) {
        console.error(err);
    }
}

// --------------------------------------------------------------------------
// MOVIMIENTOS & TURNOS DE CAJA (ARQUEO X / Z)
// --------------------------------------------------------------------------
function renderCashSummaryCards(data) {
    const container = document.getElementById('cash-summary-cards');
    if (!container) return;

    if (!data.has_open_shift) {
        container.innerHTML = `
            <div class="sm:col-span-2 lg:col-span-4 bg-rose-950/40 border border-rose-800 p-6 rounded-2xl text-center">
                <i data-lucide="alert-circle" class="w-10 h-10 text-rose-400 mx-auto mb-2"></i>
                <h3 class="text-base font-bold text-white">No hay un turno de caja abierto</h3>
                <p class="text-xs text-gray-400 mt-1 mb-4">Abra un turno de caja para comenzar a registrar ventas y movimientos</p>
                <button onclick="promptOpenShift()" class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition">
                    Abrir Turno Ahora
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const shift = data.shift;
    const salesBy = data.sales_by_method || {};

    container.innerHTML = `
        <div class="bg-white p-4 rounded-2xl border border-slate-200">
            <span class="text-[11px] text-gray-400">Efectivo Inicial:</span>
            <div class="text-xl font-mono font-bold text-slate-800 mt-1">$${formatMoney(shift.initial_cash)}</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200">
            <span class="text-[11px] text-gray-400">Ventas en Efectivo:</span>
            <div class="text-xl font-mono font-bold text-orange-600 mt-1">$${formatMoney(salesBy.EFECTIVO || 0)}</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200">
            <span class="text-[11px] text-gray-400">Tarjetas / QR / Fiar:</span>
            <div class="text-xl font-mono font-bold text-cyan-400 mt-1">
                $${formatMoney((data.total_sales_amount || 0) - (salesBy.EFECTIVO || 0))}
            </div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-orange-500/40 shadow-lg shadow-blue-500/10">
            <span class="text-[11px] text-orange-600 font-bold uppercase">Efectivo en Cajón:</span>
            <div class="text-2xl font-mono font-black text-orange-600 mt-1">$${formatMoney(data.expected_cash_in_drawer)}</div>
        </div>
    `;

    // Movimientos tabla
    const tbody = document.getElementById('cash-movements-tbody');
    if (tbody) {
        const movs = data.movements || [];
        tbody.innerHTML = movs.map(m => `
            <tr>
                <td class="py-2 px-3 font-mono text-gray-400">${m.created_at}</td>
                <td class="py-2 px-3">
                    <span class="px-1.5 py-0.5 rounded text-[10px] ${m.type === 'IN' ? 'bg-blue-950 text-blue-300' : 'bg-rose-950 text-rose-300'}">
                        ${m.type === 'IN' ? 'Ingreso' : 'Egreso'}
                    </span>
                </td>
                <td class="py-2 px-3">${m.concept}</td>
                <td class="py-2 px-3 text-right font-mono font-bold ${m.type === 'IN' ? 'text-orange-600' : 'text-rose-400'}">
                    ${m.type === 'IN' ? '+' : '-'}$${formatMoney(m.amount)}
                </td>
            </tr>
        `).join('');
    }

    if (window.lucide) lucide.createIcons();
}

async function promptOpenShift() {
    const val = prompt("Ingrese el fondo de efectivo inicial en caja ($):", "25000");
    if (val === null) return;
    const initial_cash = parseFloat(val) || 0;

    try {
        const res = await fetch('/api/cash/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashier_name: 'Caja 1', initial_cash })
        });
        if (res.ok) {
            loadCurrentShift();
        }
    } catch (err) {
        console.error(err);
    }
}

function openCashMovementModal() {
    const modal = document.getElementById('modal-cash-movement');
    if (modal) modal.classList.remove('hidden');
}

function closeCashMovementModal() {
    const modal = document.getElementById('modal-cash-movement');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

async function saveCashMovement() {
    const type = document.getElementById('cash-mov-type').value;
    const amount = parseFloat(document.getElementById('cash-mov-amount').value);
    const concept = document.getElementById('cash-mov-concept').value.trim();

    if (isNaN(amount) || amount <= 0 || !concept) {
        alert("Complete el monto y motivo del movimiento.");
        return;
    }

    try {
        const res = await fetch('/api/cash/movement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, amount, concept })
        });
        if (res.ok) {
            closeCashMovementModal();
            loadCurrentShift();
        }
    } catch (err) {
        console.error(err);
    }
}

function openCloseShiftModal() {
    if (!state.currentShift || !state.currentShift.has_open_shift) {
        alert("No hay un turno de caja abierto.");
        return;
    }
    document.getElementById('shift-expected-cash-modal').textContent = `$${formatMoney(state.currentShift.expected_cash_in_drawer)}`;
    const modal = document.getElementById('modal-close-shift');
    if (modal) modal.classList.remove('hidden');
}

function closeCloseShiftModal() {
    const modal = document.getElementById('modal-close-shift');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

async function confirmCloseShift() {
    const input = document.getElementById('shift-counted-cash');
    const notes = document.getElementById('shift-close-notes').value.trim();
    const final_cash = parseFloat(input.value);

    if (isNaN(final_cash)) {
        alert("Ingrese el efectivo contado en el cajón.");
        return;
    }

    try {
        const res = await fetch('/api/cash/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ final_cash, notes })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Turno cerrado con éxito.\nEfectivo Esperado: $${formatMoney(data.expected_cash)}\nEfectivo Contado: $${formatMoney(data.final_cash)}\nDiferencia: $${formatMoney(data.difference)}`);
            closeCloseShiftModal();
            loadCurrentShift();
        }
    } catch (err) {
        console.error(err);
    }
}

// --------------------------------------------------------------------------
// INVENTARIO DE PRODUCTOS (CREAR, EDITAR, ELIMINAR)
// --------------------------------------------------------------------------
let pendingProductImageFile = null;

function renderInventoryTable() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    const search = (document.getElementById('inventory-search')?.value || '').trim();
    const catFilter = document.getElementById('inventory-cat-filter')?.value;

    let list = state.products;
    if (catFilter) {
        list = list.filter(p => String(p.category_id) === String(catFilter));
    }
    if (search) {
        list = list.filter(p => matchesProductSearch(p, search));
    }

    tbody.innerHTML = list.map(p => {
        const isKg = p.unit_type === 'kg' || p.is_weighable;
        const lowStock = p.control_stock && (p.stock <= p.min_stock);
        const imgThumb = p.image_url ? `
            <img src="${p.image_url}" alt="${p.name}" class="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-sm mx-auto" onerror="this.style.display='none'">
        ` : `
            <div class="w-9 h-9 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 mx-auto">
                <i data-lucide="image" class="w-4 h-4 text-slate-300"></i>
            </div>
        `;

        return `
            <tr class="hover:bg-white/60 transition">
                <td class="py-2 px-2 text-center">${imgThumb}</td>
                <td class="py-2.5 px-4 font-mono text-gray-400">${p.code || '-'}</td>
                <td class="py-2.5 px-4 font-semibold text-white">${p.name}</td>
                <td class="py-2.5 px-4">
                    <span class="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-slate-700">
                        ${p.category_name || 'Sin Categoría'}
                    </span>
                </td>
                <td class="py-2.5 px-4 font-mono">${isKg ? 'Kg (Balanza)' : 'Unidad'}</td>
                <td class="py-2.5 px-4 text-right font-mono text-gray-400">$${formatMoney(p.cost_price)}</td>
                <td class="py-2.5 px-4 text-right font-mono font-bold text-orange-600">$${formatMoney(p.sale_price)}</td>
                <td class="py-2.5 px-4 text-right font-mono font-bold ${lowStock ? 'text-rose-400' : 'text-slate-800'}">
                    ${p.stock} ${lowStock ? '⚠️' : ''}
                </td>
                <td class="py-2.5 px-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="editProduct(${p.id})" class="p-1 rounded text-gray-400 hover:text-cyan-300 transition" title="Editar">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="deleteProduct(${p.id})" class="p-1 rounded text-gray-400 hover:text-rose-400 transition" title="Eliminar">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function populateCategorySelects() {
    const invSelect = document.getElementById('inventory-cat-filter');
    const prodSelect = document.getElementById('prod-category');

    if (invSelect) {
        invSelect.innerHTML = `<option value="">Todas las categorías</option>` + 
            state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    if (prodSelect) {
        prodSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

function handleProductImageFileChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    pendingProductImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        setProductImagePreviewSrc(e.target.result);
    };
    reader.readAsDataURL(file);
}

function handleProductImageUrlInput(url) {
    pendingProductImageFile = null;
    const fileInput = document.getElementById('prod-image-file');
    if (fileInput) fileInput.value = '';

    if (url && url.trim()) {
        setProductImagePreviewSrc(url.trim());
    } else {
        clearProductImagePreview();
    }
}

function setProductImagePreviewSrc(src) {
    const preview = document.getElementById('prod-image-preview');
    const placeholder = document.getElementById('prod-image-placeholder');
    const removeBtn = document.getElementById('btn-remove-prod-image');

    if (preview) {
        preview.src = src;
        preview.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
}

function clearProductImagePreview() {
    pendingProductImageFile = null;
    const fileInput = document.getElementById('prod-image-file');
    const urlInput = document.getElementById('prod-image-url');
    const preview = document.getElementById('prod-image-preview');
    const placeholder = document.getElementById('prod-image-placeholder');
    const removeBtn = document.getElementById('btn-remove-prod-image');

    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
}

function openProductModal(isEdit = false) {
    document.getElementById('product-modal-title').textContent = isEdit ? 'Editar Producto' : 'Nuevo Producto';
    if (!isEdit) {
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-code').value = '';
        document.getElementById('prod-cost').value = '0.00';
        document.getElementById('prod-price').value = '0.00';
        document.getElementById('prod-stock').value = '10';
        document.getElementById('prod-min-stock').value = '5';
        clearProductImagePreview();
    }
    const modal = document.getElementById('modal-product');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeProductModal() {
    const modal = document.getElementById('modal-product');
    if (modal) modal.classList.add('hidden');
    clearProductImagePreview();
    focusBarcodeInput();
}

function editProduct(prodId) {
    const p = state.products.find(x => x.id === prodId);
    if (!p) return;

    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-code').value = p.code || '';
    document.getElementById('prod-category').value = p.category_id || '';
    document.getElementById('prod-unit-type').value = p.unit_type || 'un';
    document.getElementById('prod-cost').value = p.cost_price;
    document.getElementById('prod-price').value = p.sale_price;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-min-stock').value = p.min_stock;

    const urlInput = document.getElementById('prod-image-url');
    if (urlInput) urlInput.value = p.image_url || '';

    if (p.image_url) {
        setProductImagePreviewSrc(p.image_url);
    } else {
        clearProductImagePreview();
    }

    openProductModal(true);
}

async function saveProduct() {
    const prodId = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const code = document.getElementById('prod-code').value.trim();
    const category_id = document.getElementById('prod-category').value || null;
    const unit_type = document.getElementById('prod-unit-type').value;
    const cost_price = parseFloat(document.getElementById('prod-cost').value) || 0;
    const sale_price = parseFloat(document.getElementById('prod-price').value) || 0;
    const stock = parseFloat(document.getElementById('prod-stock').value) || 0;
    const min_stock = parseFloat(document.getElementById('prod-min-stock').value) || 5;
    let image_url = (document.getElementById('prod-image-url')?.value || '').trim();

    if (!name || sale_price <= 0) {
        alert("El nombre y precio de venta son obligatorios.");
        return;
    }

    const payload = {
        name, code, category_id, unit_type,
        cost_price, sale_price, stock, min_stock,
        control_stock: 1,
        image_url
    };

    const url = prodId ? `/api/products/${prodId}` : '/api/products';
    const method = prodId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            const savedProdId = prodId || data.id;

            // Si hay un archivo subido pendiente, enviarlo al endpoint de imagen
            if (pendingProductImageFile && savedProdId) {
                const formData = new FormData();
                formData.append('image', pendingProductImageFile);
                try {
                    await fetch(`/api/products/${savedProdId}/image`, {
                        method: 'POST',
                        body: formData
                    });
                } catch (imgErr) {
                    console.error("Error subiendo foto de producto:", imgErr);
                }
            }

            closeProductModal();
            loadProducts();
        } else {
            alert(data.error || "Error al guardar producto");
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteProduct(prodId) {
    if (!confirm("¿Desea dar de baja este producto?")) return;
    try {
        const res = await fetch(`/api/products/${prodId}`, { method: 'DELETE' });
        if (res.ok) loadProducts();
    } catch (err) {
        console.error(err);
    }
}

// --------------------------------------------------------------------------
// REPORTES & HISTORIAL DE VENTAS
// --------------------------------------------------------------------------
async function loadReportsDashboard() {
    try {
        const [dashRes, ordersRes] = await Promise.all([
            fetch('/api/reports/dashboard'),
            fetch('/api/orders?limit=50')
        ]);
        const dash = await dashRes.json();
        const orders = await ordersRes.json();

        // KPI Cards
        const kpi = document.getElementById('report-kpi-cards');
        if (kpi) {
            kpi.innerHTML = `
                <div class="bg-white p-4 rounded-2xl border border-slate-200">
                    <span class="text-xs text-gray-400">Total Vendido Hoy:</span>
                    <div class="text-2xl font-mono font-extrabold text-orange-600 mt-1">$${formatMoney(dash.today_total)}</div>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-200">
                    <span class="text-xs text-gray-400">Cantidad de Tickets Emitidos:</span>
                    <div class="text-2xl font-mono font-extrabold text-cyan-400 mt-1">${dash.today_count}</div>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-200">
                    <span class="text-xs text-gray-400">Ticket Promedio:</span>
                    <div class="text-2xl font-mono font-extrabold text-amber-400 mt-1">$${formatMoney(dash.average_ticket)}</div>
                </div>
            `;
        }

        // Desmarcar checkbox master al recargar
        const masterCheck = document.getElementById('check-all-orders');
        if (masterCheck) masterCheck.checked = false;

        // Historial de Tickets con Selección Múltiple
        const tbody = document.getElementById('orders-history-tbody');
        if (tbody) {
            if (!orders || orders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-gray-500 font-medium">No hay tickets ni reportes de ventas registrados</td></tr>`;
            } else {
                tbody.innerHTML = orders.map(o => `
                    <tr class="hover:bg-white/70 transition border-b border-slate-200/80" id="order-row-${o.id}">
                        <td class="py-2.5 px-3 w-8 text-center">
                            <input type="checkbox" class="order-checkbox w-4 h-4 rounded bg-white border-gray-700 text-blue-500 focus:ring-0 cursor-pointer" data-id="${o.id}" onchange="updateSelectedOrdersCount()">
                        </td>
                        <td class="py-2.5 px-3 font-mono font-bold text-white">${o.order_number}</td>
                        <td class="py-2.5 px-3 text-gray-400 font-mono text-[11px]">${o.created_at}</td>
                        <td class="py-2.5 px-3 font-medium text-slate-800">${o.customer_name || 'Consumidor Final'}</td>
                        <td class="py-2.5 px-3 text-gray-400 text-xs">${o.cashier_name || 'Caja 1'}</td>
                        <td class="py-2.5 px-3">
                            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-slate-700">
                                ${o.payment_method}
                            </span>
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-orange-600">$${formatMoney(o.total)}</td>
                        <td class="py-2.5 px-3 text-center">
                            <div class="flex items-center justify-center gap-1.5">
                                <button onclick="reprintTicket(${o.id})" class="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition" title="Reimprimir Ticket">
                                    <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                                </button>
                                <button onclick="deleteSingleOrder(${o.id}, '${o.order_number}')" class="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-950/60 transition" title="Eliminar este reporte (Solo Dueño)">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }

        updateSelectedOrdersCount();
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

// --------------------------------------------------------------------------
// SELECCIÓN MÚLTIPLE Y BORRADO DE REPORTES (SOLO DUEÑO)
// --------------------------------------------------------------------------
function toggleSelectAllOrders(isChecked) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const row = document.getElementById(`order-row-${cb.dataset.id}`);
        if (row) {
            if (isChecked) {
                row.classList.add('bg-gray-800/60');
            } else {
                row.classList.remove('bg-gray-800/60');
            }
        }
    });
    updateSelectedOrdersCount();
}

function updateSelectedOrdersCount() {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    const checked = document.querySelectorAll('.order-checkbox:checked');
    const count = checked.length;

    // Resaltar visualmente las filas marcadas
    checkboxes.forEach(cb => {
        const row = document.getElementById(`order-row-${cb.dataset.id}`);
        if (row) {
            if (cb.checked) {
                row.classList.add('bg-gray-800/60');
            } else {
                row.classList.remove('bg-gray-800/60');
            }
        }
    });

    const badge = document.getElementById('selected-orders-badge');
    const deleteBtn = document.getElementById('btn-delete-selected-orders');
    const masterCheck = document.getElementById('check-all-orders');

    if (badge) {
        if (count > 0) {
            badge.textContent = `${count} seleccionado${count > 1 ? 's' : ''}`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (deleteBtn) {
        if (count > 0) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Borrar (${count}) Seleccionadas`;
            if (window.lucide) lucide.createIcons();
        } else {
            deleteBtn.classList.add('hidden');
        }
    }

    if (masterCheck && checkboxes.length > 0) {
        masterCheck.checked = (count === checkboxes.length);
    }
}

async function promptOwnerPin() {
    const isOwnerRole = state.currentUser && (state.currentUser.role === 'dueño' || state.currentUser.role === 'admin');
    const pin = prompt(
        "🔒 Autorización Requerida (Solo Dueño):\nPara eliminar reportes o tickets de venta, ingrese la clave o PIN del Dueño:",
        isOwnerRole ? "1234" : ""
    );
    return pin;
}

async function deleteSelectedOrders() {
    const checked = Array.from(document.querySelectorAll('.order-checkbox:checked')).map(cb => parseInt(cb.dataset.id));
    if (checked.length === 0) {
        alert("Seleccione al menos una venta o reporte marcando las casillas.");
        return;
    }

    if (!confirm(`¿Está seguro de que desea eliminar ${checked.length} reporte(s) de ventas seleccionados?\nEsta acción es irreversible.`)) {
        return;
    }

    const pin = await promptOwnerPin();
    if (pin === null) return; // Cancelado por el usuario

    try {
        const res = await fetch('/api/orders/bulk_delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: checked, pin: pin })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert(data.message || `Se eliminaron ${data.deleted_count} reportes correctamente.`);
            loadReportsDashboard();
            loadCurrentShift();
        } else {
            alert(data.error || "Error al eliminar los reportes seleccionados.");
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al eliminar reportes.");
    }
}

async function deleteAllOrders() {
    if (!confirm("⚠️ ¡ADVERTENCIA CRÍTICA!\n¿Está seguro de que desea VACIAR TODO el historial de reportes y ventas?\nSe borrarán permanentemente todos los tickets emitidos.")) {
        return;
    }

    const pin = await promptOwnerPin();
    if (pin === null) return; // Cancelado

    try {
        const res = await fetch('/api/orders/bulk_delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delete_all: true, pin: pin })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert(data.message || "Se vació todo el historial de ventas exitosamente.");
            loadReportsDashboard();
            loadCurrentShift();
        } else {
            alert(data.error || "Error al vaciar el historial.");
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al vaciar reportes.");
    }
}

async function deleteSingleOrder(orderId, orderNumber) {
    if (!confirm(`¿Desea eliminar el reporte del ticket ${orderNumber}?`)) {
        return;
    }

    const pin = await promptOwnerPin();
    if (pin === null) return;

    try {
        const res = await fetch('/api/orders/bulk_delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: [orderId], pin: pin })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert(`Ticket ${orderNumber} eliminado correctamente.`);
            loadReportsDashboard();
            loadCurrentShift();
        } else {
            alert(data.error || "Error al eliminar el ticket.");
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al eliminar el ticket.");
    }
}

async function reprintTicket(orderId) {
    try {
        const res = await fetch(`/api/orders/${orderId}`);
        const data = await res.json();
        if (data.order) {
            const orderObj = {
                ...data.order,
                items: data.items,
                config: data.config
            };
            printThermalTicket(orderObj);
        }
    } catch (err) {
        console.error(err);
    }
}

// --------------------------------------------------------------------------
// CONFIGURACIÓN DEL SISTEMA
// --------------------------------------------------------------------------
function updateLogoUI(logoUrl) {
    window.currentBusinessLogo = logoUrl || '';
    
    // 1. Header Logo
    const headerLogo = document.getElementById('header-store-logo');
    const headerIcon = document.getElementById('header-store-icon');
    if (headerLogo && headerIcon) {
        if (logoUrl) {
            headerLogo.src = logoUrl;
            headerLogo.classList.remove('hidden');
            headerIcon.classList.add('hidden');
        } else {
            headerLogo.src = '';
            headerLogo.classList.add('hidden');
            headerIcon.classList.remove('hidden');
        }
    }

    // 2. Login Screen Logo
    const loginLogo = document.getElementById('login-store-logo');
    const loginIcon = document.getElementById('login-store-icon');
    if (loginLogo && loginIcon) {
        if (logoUrl) {
            loginLogo.src = logoUrl;
            loginLogo.classList.remove('hidden');
            loginIcon.classList.add('hidden');
        } else {
            loginLogo.src = '';
            loginLogo.classList.add('hidden');
            loginIcon.classList.remove('hidden');
        }
    }

    // 3. Config Preview & Inputs
    const cfgPreview = document.getElementById('cfg-logo-preview');
    const cfgPlaceholder = document.getElementById('cfg-logo-placeholder');
    const btnRemove = document.getElementById('btn-remove-logo');
    const urlInput = document.getElementById('cfg-logo-url-input');

    if (cfgPreview && cfgPlaceholder) {
        if (logoUrl) {
            cfgPreview.src = logoUrl;
            cfgPreview.classList.remove('hidden');
            cfgPlaceholder.classList.add('hidden');
            if (btnRemove) btnRemove.classList.remove('hidden');
            if (urlInput) urlInput.value = logoUrl;
        } else {
            cfgPreview.src = '';
            cfgPreview.classList.add('hidden');
            cfgPlaceholder.classList.remove('hidden');
            if (btnRemove) btnRemove.classList.add('hidden');
            if (urlInput) urlInput.value = '';
        }
    }

    // 4. Modal Theme Logo Elements (si el diseñador está abierto)
    const modalPreview = document.getElementById('modal-logo-preview');
    const modalPlaceholder = document.getElementById('modal-logo-placeholder');
    const modalBtnRemove = document.getElementById('modal-btn-remove-logo');
    const modalUrlInput = document.getElementById('modal-logo-url-input');

    if (modalPreview && modalPlaceholder) {
        if (logoUrl) {
            modalPreview.src = logoUrl;
            modalPreview.classList.remove('hidden');
            modalPlaceholder.classList.add('hidden');
            if (modalBtnRemove) modalBtnRemove.classList.remove('hidden');
            if (modalUrlInput) modalUrlInput.value = logoUrl;
        } else {
            modalPreview.src = '';
            modalPreview.classList.add('hidden');
            modalPlaceholder.classList.remove('hidden');
            if (modalBtnRemove) modalBtnRemove.classList.add('hidden');
            if (modalUrlInput) modalUrlInput.value = '';
        }
    }
}

async function handleLogoFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Por favor seleccioná un archivo de imagen válido (PNG, JPG, SVG, WebP).');
        return;
    }

    // Preview inmediato en el navegador
    const reader = new FileReader();
    reader.onload = function(e) {
        updateLogoUI(e.target.result);
    };
    reader.readAsDataURL(file);

    // Enviar al servidor Flask
    const formData = new FormData();
    formData.append('logo', file);

    try {
        const res = await fetch('/api/config/logo', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
            updateLogoUI(data.logo_url);
            alert('¡Logo subido y aplicado exitosamente a la aplicación!');
        } else {
            alert('Error al subir el logo: ' + (data.error || 'Intente nuevamente'));
        }
    } catch (err) {
        console.error('Error subiendo logo:', err);
        alert('Hubo un error de conexión al subir el logo.');
    }
}

async function saveLogoFromUrl() {
    const urlInput = document.getElementById('cfg-logo-url-input');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) {
        alert('Ingresá una URL válida de imagen.');
        return;
    }

    try {
        const res = await fetch('/api/config/logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logo_url: url })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            updateLogoUI(data.logo_url);
            alert('¡Logo aplicado desde la URL exitosamente!');
        } else {
            alert('Error al aplicar el logo: ' + (data.error || 'Verifique el enlace'));
        }
    } catch (err) {
        console.error('Error aplicando URL de logo:', err);
        alert('Hubo un error de conexión.');
    }
}

async function removeLogo() {
    if (!confirm('¿Deseas quitar el logo del comercio y volver al ícono estándar?')) {
        return;
    }

    try {
        const res = await fetch('/api/config/logo', {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            updateLogoUI('');
            const fileInput = document.getElementById('cfg-logo-file-input');
            if (fileInput) fileInput.value = '';
            alert('Logo eliminado correctamente.');
        } else {
            alert('Error al eliminar logo: ' + (data.error || 'Intente nuevamente'));
        }
    } catch (err) {
        console.error('Error eliminando logo:', err);
    }
}

async function loadConfigForm() {
    try {
        const res = await fetch('/api/config');
        const cfg = await res.json();

        document.getElementById('cfg-business-name').value = cfg.business_name || '';
        document.getElementById('cfg-business-cuit').value = cfg.business_cuit || '';
        document.getElementById('cfg-business-address').value = cfg.business_address || '';
        document.getElementById('cfg-business-phone').value = cfg.business_phone || '';
        const waField = document.getElementById('cfg-business-whatsapp');
        if (waField) waField.value = cfg.business_whatsapp || '';
        const sendWaBox = document.getElementById('cfg-send-ticket-wa');
        if (sendWaBox) sendWaBox.checked = String(cfg.send_ticket_whatsapp ?? '1') !== '0';
        document.getElementById('cfg-scale-prefix').value = cfg.scale_prefix || '20';
        document.getElementById('cfg-ticket-width').value = cfg.ticket_width || '80mm';
        document.getElementById('cfg-business-footer').value = cfg.business_footer || '';

        // Sincronizar estado del logo
        if (cfg.business_logo) {
            updateLogoUI(cfg.business_logo);
        } else {
            updateLogoUI('');
        }
    } catch (err) {
        console.error(err);
    }
}

async function saveConfiguration() {
    const payload = {
        business_name: document.getElementById('cfg-business-name').value.trim(),
        business_cuit: document.getElementById('cfg-business-cuit').value.trim(),
        business_address: document.getElementById('cfg-business-address').value.trim(),
        business_phone: document.getElementById('cfg-business-phone').value.trim(),
        scale_prefix: document.getElementById('cfg-scale-prefix').value.trim(),
        ticket_width: document.getElementById('cfg-ticket-width').value,
        business_footer: document.getElementById('cfg-business-footer').value.trim()
    };

    const waInput = document.getElementById('cfg-business-whatsapp');
    if (waInput && waInput.value.trim()) {
        payload.business_whatsapp = waInput.value.trim();
    }
    const sendWaChk = document.getElementById('cfg-send-ticket-wa');
    if (sendWaChk) {
        payload.send_ticket_whatsapp = sendWaChk.checked ? '1' : '0';
    }

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Configuración guardada correctamente.");
            const storeNameElem = document.getElementById('header-store-name');
            if (storeNameElem) storeNameElem.textContent = payload.business_name;
            const loginNameElem = document.getElementById('login-store-name');
            if (loginNameElem) loginNameElem.textContent = payload.business_name;
        }
    } catch (err) {
        console.error(err);
    }
}

// --------------------------------------------------------------------------
// UTILIDADES NUMÉRICAS
// --------------------------------------------------------------------------
function formatMoney(amount) {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function roundMoney(num) {
    return Math.round((parseFloat(num) + Number.EPSILON) * 100) / 100;
}

function roundQty(num) {
    return Math.round((parseFloat(num) + Number.EPSILON) * 1000) / 1000;
}

// --------------------------------------------------------------------------
// GESTIÓN DE USUARIOS, EMPLEADOS Y CLAVES / PIN
// --------------------------------------------------------------------------
function checkCurrentUser() {
    const saved = localStorage.getItem('superpos_user');
    if (saved) {
        try {
            state.currentUser = JSON.parse(saved);
        } catch (e) {
            state.currentUser = null;
        }
    }

    if (state.currentUser) {
        hideLoginOverlay();
        updateCurrentUserBadge();
    } else {
        showLoginOverlay();
    }
}

function updateCurrentUserBadge() {
    const el = document.getElementById('current-user-display');
    const iconEl = document.getElementById('current-user-icon');
    const badgeEl = document.getElementById('current-user-role-badge');
    const quickBtn = document.getElementById('quick-role-toggle-btn');
    const quickText = document.getElementById('quick-role-toggle-text');

    if (!state.currentUser) return;

    const isOwner = state.currentUser.role === 'dueño' || state.currentUser.role === 'admin';

    if (el) el.textContent = state.currentUser.name;
    if (iconEl) iconEl.textContent = isOwner ? '👑' : '👤';
    if (badgeEl) {
        badgeEl.textContent = isOwner ? 'DUEÑO' : 'EMPLEADO';
        badgeEl.className = isOwner 
            ? 'px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400 text-amber-950 shadow-sm'
            : 'px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-300';
    }

    if (quickText) {
        quickText.textContent = isOwner ? 'Pasar a Empleado' : 'Cambiar a Dueño';
    }
    if (quickBtn) {
        if (isOwner) {
            quickBtn.className = 'hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black border border-amber-300 transition shadow-sm';
        } else {
            quickBtn.className = 'hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-black border border-orange-400 transition shadow-sm';
        }
    }

    // Aplicar permisos visuales en pestañas
    applyRoleUIPermissions(isOwner);
}

function applyRoleUIPermissions(isOwner) {
    const configTabBtn = document.getElementById('tab-btn-config');
    const massPriceBtn = document.querySelector('button[onclick="openMassPriceModal()"]');
    
    if (massPriceBtn) {
        massPriceBtn.style.display = isOwner ? 'flex' : 'none';
    }
    if (configTabBtn) {
        configTabBtn.style.display = isOwner ? 'flex' : 'none';
    }

    // Si el usuario es empleado y está en config, mover a pos
    if (!isOwner && state.activeTab === 'config') {
        switchTab('pos');
    }
}

async function loadUsers() {
    try {
        const res = await fetch('/api/auth/users');
        state.users = await res.json();
        renderUsersTable();
    } catch (err) {
        console.error("Error cargando usuarios:", err);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('users-table-tbody');
    if (!tbody) return;

    if (!state.users || state.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">No hay usuarios registrados</td></tr>`;
        return;
    }

    tbody.innerHTML = state.users.map(u => {
        const isOwner = u.role === 'dueño' || u.role === 'admin';
        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${isOwner ? 'bg-amber-600 text-white shadow-sm' : 'bg-orange-600 text-white shadow-sm'}">
                        ${u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold text-slate-900">${u.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">ID #${u.id}</div>
                    </div>
                </td>
                <td class="py-3 px-3 font-mono text-slate-600 font-medium">@${u.username}</td>
                <td class="py-3 px-3">
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${isOwner ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">
                        ${isOwner ? '👑 ' + u.role : '👤 ' + u.role}
                    </span>
                </td>
                <td class="py-3 px-3">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold ${u.is_active ? 'text-emerald-700' : 'text-slate-400'}">
                        <span class="w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
                        ${u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="py-3 px-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="openUserPinModal(${u.id})" class="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition border border-slate-200" title="Cambiar clave de acceso">
                            <i data-lucide="key" class="w-3.5 h-3.5 text-amber-600"></i> Clave
                        </button>
                        <button onclick="deleteUser(${u.id}, '${escapeHtml(u.name)}', '${u.role}')" class="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-semibold flex items-center gap-1 transition border border-rose-200" title="Eliminar usuario del sistema">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-600"></i> Borrar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

async function deleteUser(userId, userName, userRole) {
    const isOwner = userRole === 'dueño' || userRole === 'admin';
    const warning = isOwner
        ? `⚠️ ATENCIÓN: ¿Seguro que deseás ELIMINAR definitivamente al usuario Dueño/Admin "${userName}"?`
        : `¿Confirmás que deseás ELIMINAR definitivamente al empleado "${userName}" del sistema?`;

    if (!confirm(warning)) return;

    try {
        const res = await fetch(`/api/auth/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert(data.message || `Usuario "${userName}" eliminado correctamente.`);
            if (state.currentUser && state.currentUser.id === userId) {
                state.currentUser = null;
                localStorage.removeItem('superpos_user');
                await checkCurrentUser();
            }
            await loadUsers();
            if (typeof renderSwitchEmployeeCards === 'function') {
                renderSwitchEmployeeCards();
            }
        } else {
            alert(data.error || "No se pudo eliminar el usuario.");
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al eliminar usuario.");
    }
}

function autoFillUsername(name) {
    const input = document.getElementById('new-user-username');
    if (!input) return;
    const clean = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 20);
    input.value = clean;
}

function openUserPinModal(userId) {
    const u = state.users.find(x => x.id === userId);
    if (!u) return;

    document.getElementById('pin-modal-user-id').value = u.id;
    document.getElementById('pin-modal-user-name').textContent = `${u.name} (@${u.username})`;
    const pinInput = document.getElementById('pin-modal-new-pin');
    pinInput.value = '';

    const modal = document.getElementById('modal-user-pin');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => pinInput.focus(), 100);
    }
}

function closeUserPinModal() {
    const modal = document.getElementById('modal-user-pin');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

async function confirmSaveUserPin() {
    const userId = document.getElementById('pin-modal-user-id').value;
    const pin = document.getElementById('pin-modal-new-pin').value.trim();

    if (!pin || pin.length < 3) {
        alert("La clave o PIN debe contener al menos 3 caracteres o números.");
        return;
    }

    try {
        const res = await fetch(`/api/auth/users/${userId}/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message || "Clave actualizada exitosamente");
            closeUserPinModal();
        } else {
            alert(data.error || "Error al actualizar la clave");
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al cambiar la clave");
    }
}

// --------------------------------------------------------------------------
// MODAL CAMBIAR DE USUARIO ENTRE DUEÑO Y EMPLEADO
// --------------------------------------------------------------------------
let currentSwitchTab = 'dueño';
let selectedEmployeeToSwitch = null;

function setSwitchUserTab(tab) {
    currentSwitchTab = tab;
    const tabDueño = document.getElementById('switch-tab-dueño');
    const tabEmpleado = document.getElementById('switch-tab-empleado');
    const contentDueño = document.getElementById('switch-content-dueño');
    const contentEmpleado = document.getElementById('switch-content-empleado');

    if (tab === 'dueño') {
        if (tabDueño) {
            tabDueño.className = 'py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 bg-white text-slate-900 shadow-sm border border-slate-200/80';
        }
        if (tabEmpleado) {
            tabEmpleado.className = 'py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900';
        }
        if (contentDueño) contentDueño.classList.remove('hidden');
        if (contentEmpleado) contentEmpleado.classList.add('hidden');

        const pinInput = document.getElementById('switch-dueño-pin');
        if (pinInput) {
            pinInput.value = '';
            setTimeout(() => pinInput.focus(), 80);
        }
    } else {
        if (tabDueño) {
            tabDueño.className = 'py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900';
        }
        if (tabEmpleado) {
            tabEmpleado.className = 'py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 bg-white text-slate-900 shadow-sm border border-slate-200/80';
        }
        if (contentDueño) contentDueño.classList.add('hidden');
        if (contentEmpleado) contentEmpleado.classList.remove('hidden');

        renderSwitchEmployeeCards();
    }
}

function openSwitchUserModal(targetRole = null) {
    const isOwner = state.currentUser && (state.currentUser.role === 'dueño' || state.currentUser.role === 'admin');
    
    // Si no se especificó rol, sugerir el rol opuesto
    if (!targetRole) {
        targetRole = isOwner ? 'empleado' : 'dueño';
    }

    setSwitchUserTab(targetRole);

    const modal = document.getElementById('modal-switch-user');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeSwitchUserModal() {
    const modal = document.getElementById('modal-switch-user');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

function quickToggleOwnerEmployee() {
    const isOwner = state.currentUser && (state.currentUser.role === 'dueño' || state.currentUser.role === 'admin');
    openSwitchUserModal(isOwner ? 'empleado' : 'dueño');
}

function appendSwitchDueñoPin(val) {
    const pinInput = document.getElementById('switch-dueño-pin');
    if (!pinInput) return;
    if (val === '1234') {
        pinInput.value = '1234';
    } else {
        pinInput.value = (pinInput.value || '') + val;
    }
    pinInput.focus();
}

function clearSwitchDueñoPin() {
    const pinInput = document.getElementById('switch-dueño-pin');
    if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
    }
}

async function confirmSwitchToOwner() {
    const pin = (document.getElementById('switch-dueño-pin')?.value || '').trim();
    if (!pin) {
        alert("Ingresá la clave del Dueño (PIN por defecto: 1234).");
        return;
    }

    const ownerUser = state.users.find(u => u.role === 'dueño' || u.role === 'admin') || { username: 'dueno' };

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: ownerUser.id, username: ownerUser.username, pin: pin })
        });
        const data = await res.json();
        if (data.success && data.user) {
            state.currentUser = data.user;
            localStorage.setItem('superpos_user', JSON.stringify(data.user));
            updateCurrentUserBadge();
            playBeepSuccess();
            closeSwitchUserModal();
        } else {
            playBeepError();
            alert("Clave incorrecta para Dueño. El PIN por defecto es 1234.");
            clearSwitchDueñoPin();
        }
    } catch (e) {
        console.error(e);
        alert("Error al validar clave de Dueño.");
    }
}

function renderSwitchEmployeeCards() {
    const container = document.getElementById('switch-employee-cards');
    if (!container) return;

    const employees = state.users.filter(u => u.is_active && u.role !== 'dueño' && u.role !== 'admin');

    if (employees.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center text-xs text-slate-400 py-4">No hay empleados registrados aún. Hacé clic en "+ Nuevo Empleado".</div>`;
        const confirmBox = document.getElementById('switch-employee-confirm-box');
        if (confirmBox) confirmBox.classList.add('hidden');
        return;
    }

    container.innerHTML = employees.map(emp => {
        const isCurrent = state.currentUser && state.currentUser.id === emp.id;
        const isSelected = selectedEmployeeToSwitch === emp.id;
        return `
            <div onclick="selectEmployeeToSwitch(${emp.id})" id="switch-emp-card-${emp.id}"
                class="group relative p-3 rounded-2xl border ${isSelected ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-400' : (isCurrent ? 'border-blue-400 bg-blue-50/70' : 'border-slate-200 bg-slate-50 hover:bg-slate-100')} cursor-pointer transition flex items-center justify-between gap-2.5">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                        ${emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-900 truncate">${emp.name}</div>
                        <div class="text-[10px] text-slate-500 font-mono">@${emp.username}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    ${isCurrent ? '<span class="text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Actual</span>' : ''}
                    <button type="button" onclick="event.stopPropagation(); deleteUser(${emp.id}, '${escapeHtml(emp.name)}', '${emp.role}')" class="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition" title="Borrar empleado">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                    ${!isCurrent ? '<i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>' : ''}
                </div>
            </div>
        `;
    }).join('');

    const defaultEmp = employees.find(e => e.id === selectedEmployeeToSwitch) || employees[0];
    if (defaultEmp) {
        selectEmployeeToSwitch(defaultEmp.id);
    }

    if (window.lucide) lucide.createIcons();
}

function selectEmployeeToSwitch(empId) {
    selectedEmployeeToSwitch = empId;
    const emp = state.users.find(u => u.id === empId);
    if (!emp) return;

    document.querySelectorAll('[id^="switch-emp-card-"]').forEach(el => {
        el.classList.remove('border-orange-500', 'bg-orange-50', 'ring-2', 'ring-orange-400');
    });
    const card = document.getElementById(`switch-emp-card-${empId}`);
    if (card) {
        card.classList.add('border-orange-500', 'bg-orange-50', 'ring-2', 'ring-orange-400');
    }

    const btnName = document.getElementById('switch-selected-employee-btn-name');
    if (btnName) btnName.textContent = emp.name;

    const confirmBox = document.getElementById('switch-employee-confirm-box');
    if (confirmBox) confirmBox.classList.remove('hidden');
}

async function confirmSwitchToSelectedEmployee() {
    if (!selectedEmployeeToSwitch) {
        alert("Seleccioná un empleado.");
        return;
    }
    const emp = state.users.find(u => u.id === selectedEmployeeToSwitch);
    if (!emp) return;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: emp.id, username: emp.username, pin: '1234' })
        });
        const data = await res.json();
        if (data.success && data.user) {
            state.currentUser = data.user;
            localStorage.setItem('superpos_user', JSON.stringify(data.user));
            updateCurrentUserBadge();
            playBeepSuccess();
            closeSwitchUserModal();
        } else {
            playBeepError();
            alert("No se pudo cambiar al usuario: " + (data.error || "Error de autorización"));
        }
    } catch (e) {
        console.error(e);
        alert("Error al cambiar al empleado.");
    }
}

// --------------------------------------------------------------------------
// MODAL CREAR NUEVO USUARIO / EMPLEADO
// --------------------------------------------------------------------------
function openCreateUserModal() {
    const nameInput = document.getElementById('new-user-name');
    const userInput = document.getElementById('new-user-username');
    const roleInput = document.getElementById('new-user-role');
    const pinInput = document.getElementById('new-user-pin');

    if (nameInput) nameInput.value = '';
    if (userInput) userInput.value = '';
    if (roleInput) roleInput.value = 'empleado';
    if (pinInput) pinInput.value = '1234';

    const modal = document.getElementById('modal-create-user');
    if (modal) {
        modal.classList.remove('hidden');
        if (nameInput) setTimeout(() => nameInput.focus(), 100);
    }
}

function closeCreateUserModal() {
    const modal = document.getElementById('modal-create-user');
    if (modal) modal.classList.add('hidden');
}

async function saveNewUser() {
    const name = document.getElementById('new-user-name').value.trim();
    const username = document.getElementById('new-user-username').value.trim();
    const role = document.getElementById('new-user-role').value;
    const pin = document.getElementById('new-user-pin').value.trim();

    if (!name || !username || !pin) {
        alert("Por favor completá todos los campos del nuevo usuario.");
        return;
    }

    try {
        const res = await fetch('/api/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, role, pin })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert(data.message || `Usuario '${name}' creado con éxito.`);
            closeCreateUserModal();
            await loadUsers();
            if (typeof renderSwitchEmployeeCards === 'function') {
                renderSwitchEmployeeCards();
            }
        } else {
            alert(data.error || "Error al crear usuario.");
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al guardar usuario.");
    }
}

// --------------------------------------------------------------------------
// MODAL ACCESO EN RED & ONLINE (3G/4G / WI-FI)
// --------------------------------------------------------------------------
async function openNetworkInfoModal() {
    try {
        const res = await fetch('/api/server/network_info');
        if (res.ok) {
            const data = await res.json();
            const localEl = document.getElementById('network-access-url');
            const pubEl = document.getElementById('network-public-url');
            const pubLink = document.getElementById('network-public-link');
            const qrImg = document.getElementById('network-qr-img');

            if (localEl && data.network_url) localEl.textContent = data.network_url;
            if (pubEl && data.public_url) pubEl.textContent = data.public_url;
            if (pubLink && data.public_url) pubLink.href = data.public_url;

            const targetUrl = data.public_url || data.network_url;
            if (qrImg && targetUrl) {
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(targetUrl)}`;
            }
        }
    } catch (e) {
        console.warn("No se pudo obtener información dinámica de red:", e);
    }

    const modal = document.getElementById('modal-network-info');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeNetworkInfoModal() {
    const modal = document.getElementById('modal-network-info');
    if (modal) modal.classList.add('hidden');
    focusBarcodeInput();
}

function copyPublicUrl() {
    const pubEl = document.getElementById('network-public-url');
    if (!pubEl) return;
    const text = pubEl.textContent.trim();
    navigator.clipboard.writeText(text).then(() => {
        alert(`¡Enlace Remoto (3G/Internet) copiado!\n${text}\n\nPodés enviarlo por WhatsApp o abrirlo desde cualquier celular o PC fuera del local.`);
    }).catch(() => {
        prompt("Copiá esta dirección para acceder desde cualquier celular:", text);
    });
}

function copyNetworkUrl() {
    const urlEl = document.getElementById('network-access-url');
    if (!urlEl) return;
    const text = urlEl.textContent.trim();
    navigator.clipboard.writeText(text).then(() => {
        alert(`¡Enlace Local copiado!\n${text}\n\nUsalo para equipos conectados al mismo Wi-Fi del comercio.`);
    }).catch(() => {
        prompt("Copiá esta dirección para acceder en Wi-Fi:", text);
    });
}

// --------------------------------------------------------------------------
// PANTALLA PRINCIPAL DE LOGIN / AUTENTICACIÓN AL INICIO
// --------------------------------------------------------------------------
function showLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        renderLoginUsers();
        state.selectedLoginUserId = null;
        const pinSec = document.getElementById('login-pin-section');
        if (pinSec) pinSec.classList.add('hidden');
        const pinInput = document.getElementById('login-pin-input');
        if (pinInput) pinInput.value = '';
        const errMsg = document.getElementById('login-error-msg');
        if (errMsg) {
            errMsg.textContent = '';
            errMsg.classList.add('hidden');
        }
    }
}

function hideLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    focusBarcodeInput();
}

async function renderLoginUsers() {
    const grid = document.getElementById('login-user-grid');
    if (!grid) return;

    if (!state.users || state.users.length === 0) {
        try {
            const res = await fetch('/api/auth/users');
            state.users = await res.json();
        } catch (e) {
            console.error("Error cargando usuarios para login:", e);
        }
    }

    const activeUsers = state.users.filter(u => u.is_active);

    if (activeUsers.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center text-xs text-gray-500 py-3">No hay usuarios activos</div>`;
        return;
    }

    grid.innerHTML = activeUsers.map(u => {
        const isOwner = u.role === 'dueño' || u.role === 'admin';
        const isSelected = state.selectedLoginUserId === u.id;
        return `
            <button type="button" onclick="selectLoginUser(${u.id})" id="login-user-card-${u.id}"
                class="login-user-card p-3 rounded-2xl border ${isSelected ? 'border-orange-500 bg-blue-950/40 ring-2 ring-blue-500/50' : 'border-slate-200 bg-gray-950/80 hover:bg-gray-800/80'} text-left transition flex items-center gap-2.5 active:scale-95 cursor-pointer">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow ${isOwner ? 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white' : 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white'}">
                    ${u.name.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold text-white truncate">${u.name}</div>
                    <div class="text-[10px] text-gray-400 capitalize">${u.role}</div>
                </div>
            </button>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function selectLoginUser(userId) {
    state.selectedLoginUserId = userId;
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    // Resaltar tarjeta seleccionada en el login
    document.querySelectorAll('.login-user-card').forEach(el => {
        el.classList.remove('border-orange-500', 'bg-blue-950/40', 'ring-2', 'ring-blue-500/50');
        el.classList.add('border-slate-200', 'bg-gray-950/80');
    });
    const card = document.getElementById(`login-user-card-${userId}`);
    if (card) {
        card.classList.remove('border-slate-200', 'bg-gray-950/80');
        card.classList.add('border-orange-500', 'bg-blue-950/40', 'ring-2', 'ring-blue-500/50');
    }

    const nameEl = document.getElementById('login-selected-name');
    if (nameEl) nameEl.textContent = user.name;

    const pinSection = document.getElementById('login-pin-section');
    if (pinSection) pinSection.classList.remove('hidden');

    const pinInput = document.getElementById('login-pin-input');
    if (pinInput) {
        pinInput.value = '';
        if (window.innerWidth >= 1024) {
            setTimeout(() => pinInput.focus(), 80);
        }
    }

    const errMsg = document.getElementById('login-error-msg');
    if (errMsg) errMsg.classList.add('hidden');

    if (window.lucide) lucide.createIcons();
}

function appendLoginPin(digit) {
    const pinInput = document.getElementById('login-pin-input');
    if (pinInput && pinInput.value.length < 12) {
        pinInput.value += digit;
    }
}

function clearLoginPin() {
    const pinInput = document.getElementById('login-pin-input');
    if (pinInput) pinInput.value = '';
    const errMsg = document.getElementById('login-error-msg');
    if (errMsg) errMsg.classList.add('hidden');
}

function backspaceLoginPin() {
    const pinInput = document.getElementById('login-pin-input');
    if (pinInput && pinInput.value.length > 0) {
        pinInput.value = pinInput.value.slice(0, -1);
    }
}

async function submitLogin() {
    if (!state.selectedLoginUserId) {
        const errMsg = document.getElementById('login-error-msg');
        if (errMsg) {
            errMsg.textContent = "Por favor seleccioná tu usuario arriba.";
            errMsg.classList.remove('hidden');
        }
        return;
    }

    const user = state.users.find(u => u.id === state.selectedLoginUserId);
    const pinInput = document.getElementById('login-pin-input');
    const pin = pinInput ? pinInput.value.trim() : '';

    if (!pin) {
        const errMsg = document.getElementById('login-error-msg');
        if (errMsg) {
            errMsg.textContent = "Ingresá tu clave o PIN numérico.";
            errMsg.classList.remove('hidden');
        }
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-login');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.classList.add('opacity-75');
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.username, pin: pin })
        });
        const data = await res.json();

        if (res.ok && data.success && data.user) {
            state.currentUser = data.user;
            localStorage.setItem('superpos_user', JSON.stringify(data.user));
            updateCurrentUserBadge();
            playBeepSuccess();
            hideLoginOverlay();
        } else {
            playBeepError();
            const errMsg = document.getElementById('login-error-msg');
            if (errMsg) {
                errMsg.textContent = data.error || "Clave incorrecta. Reintentá.";
                errMsg.classList.remove('hidden');
            }
            if (pinInput) {
                pinInput.value = '';
                pinInput.focus();
            }
        }
    } catch (err) {
        console.error("Error en login:", err);
        const errMsg = document.getElementById('login-error-msg');
        if (errMsg) {
            errMsg.textContent = "Error de conexión con el servidor.";
            errMsg.classList.remove('hidden');
        }
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('opacity-75');
        }
    }
}

async function logoutUser() {
    if (!confirm("¿Deseas cerrar la sesión actual?")) return;

    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}

    localStorage.removeItem('superpos_user');
    state.currentUser = null;
    showLoginOverlay();
}

// --------------------------------------------------------------------------
// PESTAÑA RANKING DE VENTAS (DEL MÁS VENDIDO AL MENOS VENDIDO)
// --------------------------------------------------------------------------
function populateRankingCategorySelect() {
    const sel = document.getElementById('ranking-category-filter');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">Todas las categorías</option>` + 
        state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    sel.value = currentVal;
}

function setRankingOrder(order) {
    state.rankingFilters.order = order;
    
    // Actualizar estilo de los botones Más Vendidos vs Menos Vendidos
    const btnDesc = document.getElementById('btn-rank-order-desc');
    const btnAsc = document.getElementById('btn-rank-order-asc');
    const sortIcon = document.getElementById('rank-sort-icon');

    if (btnDesc && btnAsc) {
        if (order === 'desc') {
            btnDesc.className = "px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm bg-orange-600 text-white shadow-blue-600/20";
            btnAsc.className = "px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 bg-gray-800 text-slate-700 hover:text-white hover:bg-gray-700";
            if (sortIcon) sortIcon.setAttribute('data-lucide', 'arrow-down');
        } else {
            btnAsc.className = "px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm bg-rose-600 text-white shadow-rose-600/20";
            btnDesc.className = "px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 bg-gray-800 text-slate-700 hover:text-white hover:bg-gray-700";
            if (sortIcon) sortIcon.setAttribute('data-lucide', 'arrow-up');
        }
    }

    if (window.lucide) lucide.createIcons();
    loadRankingDashboard();
}

function toggleRankingOrderDirection() {
    const newOrder = state.rankingFilters.order === 'desc' ? 'asc' : 'desc';
    setRankingOrder(newOrder);
}

function setRankingPeriod(period) {
    state.rankingFilters.period = period;
    const periods = ['all', 'month', 'week', 'today'];
    periods.forEach(p => {
        const btn = document.getElementById(`btn-period-${p}`);
        if (btn) {
            if (p === period) {
                btn.className = "flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold transition bg-amber-600 text-white shadow";
            } else {
                btn.className = "flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition";
            }
        }
    });
    loadRankingDashboard();
}

async function loadRankingDashboard() {
    populateRankingCategorySelect();

    const tbody = document.getElementById('ranking-table-tbody');
    if (!tbody) return;

    const { order, period, category_id, search } = state.rankingFilters;
    const params = new URLSearchParams({
        order,
        period,
        category_id: category_id || '',
        search: search || ''
    });

    try {
        const res = await fetch(`/api/reports/products_ranking?${params.toString()}`);
        const data = await res.json();
        renderRankingTable(data.ranking || [], order);
    } catch (err) {
        console.error("Error cargando ranking de ventas:", err);
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-rose-400 font-medium">Error al cargar datos del ranking</td></tr>`;
    }
}

function renderRankingTable(items, order) {
    const tbody = document.getElementById('ranking-table-tbody');
    if (!tbody) return;

    // Actualizar KPIs del ranking
    const totalProdEl = document.getElementById('rank-kpi-total-products');
    const withSalesEl = document.getElementById('rank-kpi-with-sales');
    const topNameEl = document.getElementById('rank-kpi-top-name');
    const topQtyEl = document.getElementById('rank-kpi-top-qty');
    const revNameEl = document.getElementById('rank-kpi-rev-name');
    const revAmountEl = document.getElementById('rank-kpi-rev-amount');

    if (totalProdEl) totalProdEl.textContent = items.length;
    const countWithSales = items.filter(i => i.total_sold > 0).length;
    if (withSalesEl) withSalesEl.textContent = `${countWithSales} con ventas registradas`;

    // Buscar el de mayor recaudación y el de mayores ventas totales
    let topSeller = null;
    let topRevenue = null;
    items.forEach(i => {
        if (!topSeller || i.total_sold > topSeller.total_sold) topSeller = i;
        if (!topRevenue || i.total_revenue > topRevenue.total_revenue) topRevenue = i;
    });

    if (topNameEl && topQtyEl) {
        if (topSeller && topSeller.total_sold > 0) {
            topNameEl.textContent = topSeller.name;
            topQtyEl.textContent = `${topSeller.total_sold} ${topSeller.unit_type || 'un'}`;
        } else {
            topNameEl.textContent = "Sin ventas aún";
            topQtyEl.textContent = "0 un";
        }
    }

    if (revNameEl && revAmountEl) {
        if (topRevenue && topRevenue.total_revenue > 0) {
            revNameEl.textContent = topRevenue.name;
            revAmountEl.textContent = `$${formatMoney(topRevenue.total_revenue)}`;
        } else {
            revNameEl.textContent = "Sin ventas aún";
            revAmountEl.textContent = "$0.00";
        }
    }

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-gray-500 font-medium">No se encontraron productos coincidentes</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((p, index) => {
        const rankPos = index + 1;
        
        // Medalla / Color de puesto según posición
        let badgeClass = "bg-gray-800 text-gray-400 font-mono";
        let rankIcon = "";
        if (order === 'desc') {
            if (rankPos === 1) {
                badgeClass = "bg-gradient-to-tr from-amber-600 to-yellow-500 text-white font-extrabold shadow-lg shadow-amber-500/30";
                rankIcon = `<i data-lucide="crown" class="w-3.5 h-3.5 inline mr-0.5 text-yellow-200"></i>`;
            } else if (rankPos === 2) {
                badgeClass = "bg-gradient-to-tr from-gray-400 to-gray-300 text-gray-900 font-extrabold shadow";
                rankIcon = `<i data-lucide="medal" class="w-3.5 h-3.5 inline mr-0.5 text-gray-800"></i>`;
            } else if (rankPos === 3) {
                badgeClass = "bg-gradient-to-tr from-amber-800 to-amber-700 text-amber-100 font-extrabold shadow";
                rankIcon = `<i data-lucide="medal" class="w-3.5 h-3.5 inline mr-0.5 text-amber-200"></i>`;
            }
        } else {
            // Menos vendidos (color tenue o alerta de bajo movimiento)
            if (p.total_sold === 0) {
                badgeClass = "bg-rose-950/60 border border-rose-800/60 text-rose-300 font-mono";
            }
        }

        const hasZeroSales = p.total_sold === 0;

        return `
            <tr class="hover:bg-white/70 transition border-b border-slate-200/80">
                <td class="py-3 px-4 text-center">
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs ${badgeClass}">
                        ${rankIcon}${rankPos}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-white text-xs leading-tight">${p.name}</div>
                    <div class="text-[10px] font-mono text-gray-400 mt-0.5">${p.code || 'Sin código'}</div>
                </td>
                <td class="py-3 px-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-950 border border-slate-200">
                        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${p.category_color || '#3b82f6'}"></span>
                        <span class="text-slate-700 truncate">${p.category_name || 'Sin Categoría'}</span>
                    </span>
                </td>
                <td class="py-3 px-4 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${p.unit_type === 'kg' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-gray-800 text-slate-700'}">
                        ${p.unit_type || 'un'}
                    </span>
                </td>
                <td class="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                    $${formatMoney(p.sale_price)}
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="font-mono text-sm font-extrabold ${hasZeroSales ? 'text-gray-500' : (order === 'desc' ? 'text-orange-600' : 'text-amber-400')}">
                        ${formatDecimal(p.total_sold)} <span class="text-[10px] font-normal text-gray-400">${p.unit_type || 'un'}</span>
                    </div>
                    ${p.orders_count > 0 ? `<div class="text-[10px] text-gray-400">${p.orders_count} ticket${p.orders_count > 1 ? 's' : ''}</div>` : `<div class="text-[10px] text-rose-400/80">Sin ventas</div>`}
                </td>
                <td class="py-3 px-4 text-right font-mono font-bold ${hasZeroSales ? 'text-gray-500' : 'text-orange-600'}">
                    $${formatMoney(p.total_revenue)}
                </td>
                <td class="py-3 px-4 text-right font-mono text-xs">
                    <span class="${p.stock <= 5 ? 'text-rose-400 font-bold' : 'text-slate-700'}">
                        ${formatDecimal(p.stock)} ${p.unit_type || 'un'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}



