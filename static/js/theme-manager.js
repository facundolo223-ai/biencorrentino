/**
 * R&S MARKET POS - Gestor y Diseñador Visual de Interfaz (Theme Manager)
 * Permite cambiar en tiempo real:
 * 1. Paleta de colores (Predefinidas + Modo Claro / Oscuro)
 * 2. Familias tipográficas y tamaño de letra
 * 3. Diseño y estilo de pestañas de navegación
 * 4. Grosor y estilo de íconos
 * 5. Distribución de interfaz (Posberry vs Clásica), esquinas y densidad
 */

const THEME_STORAGE_KEY = 'rsmarket_ui_theme_v2';

// Temas y Paletas Predefinidas
const PRESET_PALETTES = {
    'orange-red': {
        name: 'Blanco, Naranja y Rojo',
        subtitle: 'Estilo Posberry clásico, comercial y enérgico',
        headerBg: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #dc2626 100%)',
        footerBg: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #dc2626 100%)',
        headerText: '#ffffff',
        primary: '#ea580c',
        primaryHover: '#c2410c',
        accent: '#dc2626',
        totalColor: '#dc2626',
        cobrarBg: '#dc2626',
        cobrarHover: '#b91c1c',
        badgeBg: 'rgba(234, 88, 12, 0.12)',
        badgeText: '#9a3412',
        borderFocus: '#ea580c',
        previewColors: ['#ea580c', '#ffffff', '#dc2626'],
        isDark: false
    },
    'blue-premium': {
        name: 'Azul Premium & Índigo',
        subtitle: 'Corporativo, profesional y elegante',
        headerBg: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #4338ca 100%)',
        footerBg: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #4338ca 100%)',
        headerText: '#ffffff',
        primary: '#2563eb',
        primaryHover: '#1d4ed8',
        accent: '#4f46e5',
        totalColor: '#2563eb',
        cobrarBg: '#059669',
        cobrarHover: '#047857',
        badgeBg: 'rgba(37, 99, 235, 0.12)',
        badgeText: '#1e40af',
        borderFocus: '#2563eb',
        previewColors: ['#2563eb', '#ffffff', '#4338ca'],
        isDark: false
    },
    'emerald-green': {
        name: 'Verde Almacén & Esmeralda',
        subtitle: 'Fresco, natural y enfocado a ventas',
        headerBg: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%)',
        footerBg: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%)',
        headerText: '#ffffff',
        primary: '#059669',
        primaryHover: '#047857',
        accent: '#0d9488',
        totalColor: '#059669',
        cobrarBg: '#059669',
        cobrarHover: '#047857',
        badgeBg: 'rgba(5, 150, 105, 0.12)',
        badgeText: '#065f46',
        borderFocus: '#059669',
        previewColors: ['#059669', '#ffffff', '#10b981'],
        isDark: false
    },
    'neon-purple': {
        name: 'Púrpura Neón & Violeta',
        subtitle: 'Moderno, boutique y tecnológico',
        headerBg: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #6d28d9 100%)',
        footerBg: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #6d28d9 100%)',
        headerText: '#ffffff',
        primary: '#7c3aed',
        primaryHover: '#6d28d9',
        accent: '#ec4899',
        totalColor: '#7c3aed',
        cobrarBg: '#059669',
        cobrarHover: '#047857',
        badgeBg: 'rgba(124, 58, 237, 0.12)',
        badgeText: '#5b21b6',
        borderFocus: '#7c3aed',
        previewColors: ['#7c3aed', '#ffffff', '#8b5cf6'],
        isDark: false
    },
    'dark-gold': {
        name: 'Modo Oscuro & Dorado (Dark Luxury)',
        subtitle: 'Fondo negro mate con acentos dorados ámbar',
        headerBg: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
        footerBg: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
        headerText: '#f59e0b',
        primary: '#f59e0b',
        primaryHover: '#d97706',
        accent: '#fbbf24',
        totalColor: '#f59e0b',
        cobrarBg: '#f59e0b',
        cobrarHover: '#d97706',
        badgeBg: 'rgba(245, 158, 11, 0.2)',
        badgeText: '#fbbf24',
        borderFocus: '#f59e0b',
        previewColors: ['#18181b', '#27272a', '#f59e0b'],
        isDark: true
    },
    'crimson-slate': {
        name: 'Rojo Carmesí & Pizarra',
        subtitle: 'Fuerte, dinámico y de máximo impacto',
        headerBg: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #991b1b 100%)',
        footerBg: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #991b1b 100%)',
        headerText: '#ffffff',
        primary: '#dc2626',
        primaryHover: '#b91c1c',
        accent: '#f97316',
        totalColor: '#dc2626',
        cobrarBg: '#dc2626',
        cobrarHover: '#b91c1c',
        badgeBg: 'rgba(220, 38, 38, 0.12)',
        badgeText: '#991b1b',
        borderFocus: '#dc2626',
        previewColors: ['#dc2626', '#ffffff', '#b91c1c'],
        isDark: false
    }
};

// Configuración por Defecto
const DEFAULT_THEME = {
    palette: 'orange-red',
    mode: 'light',           // 'light' | 'dark'
    fontFamily: 'inter',      // 'inter' | 'roboto' | 'poppins' | 'roboto-mono' | 'outfit' | 'system'
    fontSize: 'normal',       // 'compact' | 'normal' | 'large'
    tabStyle: 'pills',        // 'pills' | 'classic' | 'underline' | 'folder'
    iconStroke: 2.0,          // 1.5 | 2.0 | 2.5
    borderRadius: 'smooth',   // 'sharp' | 'smooth' | 'round'
    layoutColumns: 'posberry' // 'posberry' (ticket izq) | 'classic' (ticket der)
};

// Estado Activo
let currentTheme = { ...DEFAULT_THEME };

/**
 * Inicializa el gestor de temas y carga configuración guardada
 */
function initThemeManager() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved) {
            currentTheme = { ...DEFAULT_THEME, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('[Theme] No se pudo leer tema guardado:', e);
    }
    applyTheme(currentTheme, false);
}

/**
 * Aplica todas las propiedades del tema en el DOM
 */
function applyTheme(theme, save = true) {
    currentTheme = { ...theme };
    const palette = PRESET_PALETTES[theme.palette] || PRESET_PALETTES['orange-red'];
    const isDark = theme.mode === 'dark' || palette.isDark;

    const root = document.documentElement;
    const body = document.body;

    // 1. Variables CSS dinámicas
    root.style.setProperty('--theme-header-bg', palette.headerBg);
    root.style.setProperty('--theme-footer-bg', palette.footerBg);
    root.style.setProperty('--theme-primary', palette.primary);
    root.style.setProperty('--theme-primary-hover', palette.primaryHover);
    root.style.setProperty('--theme-accent', palette.accent);
    root.style.setProperty('--theme-total', palette.totalColor);
    root.style.setProperty('--theme-cobrar-bg', palette.cobrarBg);
    root.style.setProperty('--theme-cobrar-hover', palette.cobrarHover);

    // 2. Modo Claro vs Oscuro en Fondo y Superficies
    if (isDark) {
        body.classList.remove('bg-slate-100', 'text-slate-800');
        body.classList.add('bg-gray-950', 'text-gray-100', 'theme-dark');
        root.style.setProperty('--theme-card-bg', '#111827');
        root.style.setProperty('--theme-card-border', '#1f2937');
        root.style.setProperty('--theme-text-main', '#f3f4f6');
        root.style.setProperty('--theme-text-muted', '#9ca3af');
    } else {
        body.classList.remove('bg-gray-950', 'text-gray-100', 'theme-dark');
        body.classList.add('bg-slate-100', 'text-slate-800');
        root.style.setProperty('--theme-card-bg', '#ffffff');
        root.style.setProperty('--theme-card-border', '#e2e8f0');
        root.style.setProperty('--theme-text-main', '#0f172a');
        root.style.setProperty('--theme-text-muted', '#64748b');
    }

    // 3. Familia Tipográfica
    const fontClasses = ['font-inter', 'font-roboto', 'font-poppins', 'font-mono-pos', 'font-outfit', 'font-system'];
    body.classList.remove(...fontClasses);
    body.classList.add(`font-${theme.fontFamily}`);

    // 4. Escala de Tamaño de Letra
    const sizeClasses = ['text-scale-compact', 'text-scale-normal', 'text-scale-large'];
    body.classList.remove(...sizeClasses);
    body.classList.add(`text-scale-${theme.fontSize}`);

    // 5. Esquinas / Bordes
    const radiusClasses = ['radius-sharp', 'radius-smooth', 'radius-round'];
    body.classList.remove(...radiusClasses);
    body.classList.add(`radius-${theme.borderRadius}`);

    // 6. Estilo de Pestañas
    const tabClasses = ['tab-style-pills', 'tab-style-classic', 'tab-style-underline', 'tab-style-folder'];
    body.classList.remove(...tabClasses);
    body.classList.add(`tab-style-${theme.tabStyle}`);

    // 7. Distribución de Columnas en el POS
    const posSection = document.getElementById('tab-pos');
    const posCartPanel = document.getElementById('pos-cart-panel');
    const posProductsPanel = document.getElementById('pos-products-panel');

    if (posCartPanel && posProductsPanel) {
        if (theme.layoutColumns === 'classic') {
            // Clásico: Catálogo a la izquierda, Ticket a la derecha
            posCartPanel.style.order = '2';
            posProductsPanel.style.order = '1';
            posCartPanel.classList.remove('border-r');
            posCartPanel.classList.add('border-l');
            posProductsPanel.classList.add('border-r');
        } else {
            // Posberry: Ticket a la izquierda, Catálogo a la derecha
            posCartPanel.style.order = '1';
            posProductsPanel.style.order = '2';
            posCartPanel.classList.add('border-r');
            posCartPanel.classList.remove('border-l');
            posProductsPanel.classList.remove('border-r');
        }
    }

    // 8. Elementos Clave del Header y Footer
    const header = document.querySelector('header');
    if (header) {
        header.style.background = palette.headerBg;
        header.style.color = palette.headerText;
    }
    const footer = document.querySelector('footer');
    if (footer) {
        footer.style.background = palette.footerBg;
        footer.style.color = palette.headerText;
    }

    // 9. Total Gigante
    const grandTotal = document.getElementById('cart-grand-total');
    if (grandTotal) {
        grandTotal.style.color = palette.totalColor;
    }

    // 10. Botón Cobrar
    const btnCheckout = document.getElementById('btn-checkout-trigger');
    if (btnCheckout) {
        btnCheckout.style.background = palette.cobrarBg;
    }

    // 11. Escáner input border color
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
        barcodeInput.style.borderColor = palette.primary;
    }

    // 12. Re-render Lucide Icons con el grosor seleccionado
    if (window.lucide) {
        lucide.createIcons({
            attrs: {
                'stroke-width': theme.iconStroke || 2.0
            }
        });
    }

    // 13. Persistencia en localStorage
    if (save) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(currentTheme));
        } catch (e) {
            console.warn('[Theme] No se pudo guardar tema:', e);
        }
    }
}

/**
 * Abre el Modal de Personalización de Interfaz
 */
function openThemeModal() {
    let modal = document.getElementById('modal-theme-customizer');
    if (!modal) {
        createThemeModal();
        modal = document.getElementById('modal-theme-customizer');
    }
    modal.classList.remove('hidden');
    syncThemeModalControls();
    if (window.lucide) lucide.createIcons();
}

/**
 * Cierra el Modal
 */
function closeThemeModal() {
    const modal = document.getElementById('modal-theme-customizer');
    if (modal) modal.classList.add('hidden');
}

/**
 * Sincroniza los controles del modal con el tema activo
 */
function syncThemeModalControls() {
    // 1. Selector de Paleta
    document.querySelectorAll('.palette-preset-card').forEach(card => {
        const id = card.dataset.palette;
        if (id === currentTheme.palette) {
            card.classList.add('ring-2', 'ring-orange-500', 'border-transparent', 'bg-orange-50/60');
        } else {
            card.classList.remove('ring-2', 'ring-orange-500', 'border-transparent', 'bg-orange-50/60');
        }
    });

    // 2. Modo Claro / Oscuro
    const modeLight = document.getElementById('theme-mode-light');
    const modeDark = document.getElementById('theme-mode-dark');
    if (modeLight && modeDark) {
        if (currentTheme.mode === 'dark') {
            modeDark.checked = true;
        } else {
            modeLight.checked = true;
        }
    }

    // 3. Familia Tipográfica
    const fontSelect = document.getElementById('theme-font-select');
    if (fontSelect) fontSelect.value = currentTheme.fontFamily;

    // 4. Tamaño de Letra
    const sizeRadios = document.querySelectorAll('input[name="theme-font-size"]');
    sizeRadios.forEach(r => {
        if (r.value === currentTheme.fontSize) r.checked = true;
    });

    // 5. Estilo de Pestañas
    const tabRadios = document.querySelectorAll('input[name="theme-tab-style"]');
    tabRadios.forEach(r => {
        if (r.value === currentTheme.tabStyle) r.checked = true;
    });

    // 6. Grosor de Íconos
    const iconRadios = document.querySelectorAll('input[name="theme-icon-stroke"]');
    iconRadios.forEach(r => {
        if (parseFloat(r.value) === currentTheme.iconStroke) r.checked = true;
    });

    // 7. Esquinas
    const radiusRadios = document.querySelectorAll('input[name="theme-border-radius"]');
    radiusRadios.forEach(r => {
        if (r.value === currentTheme.borderRadius) r.checked = true;
    });

    // 8. Distribución de Columnas
    const layoutRadios = document.querySelectorAll('input[name="theme-layout-columns"]');
    layoutRadios.forEach(r => {
        if (r.value === currentTheme.layoutColumns) r.checked = true;
    });
}

/**
 * Crea dinámicamente el HTML del Modal de Personalización
 */
function createThemeModal() {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'modal-theme-customizer';
    modalDiv.className = 'fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-3 sm:p-4';

    modalDiv.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            
            <!-- Cabecera del Modal -->
            <div class="px-5 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white flex items-center justify-between flex-shrink-0 shadow-sm">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                        <i data-lucide="palette" class="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h2 class="text-base font-extrabold tracking-tight">Diseñador de Interfaz & Temas</h2>
                        <p class="text-[11px] text-orange-100">Personalizá colores, letras, pestañas, iconos y distribución en vivo</p>
                    </div>
                </div>
                <button onclick="closeThemeModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Navegación interna de pestañas del Diseñador -->
            <div class="flex items-center bg-slate-100 border-b border-slate-200 px-4 gap-2 text-xs font-bold overflow-x-auto no-scrollbar flex-shrink-0 py-2">
                <button type="button" onclick="switchThemeTab('colors')" id="theme-tab-btn-colors" class="theme-tab-btn px-3 py-1.5 rounded-xl bg-orange-600 text-white shadow-sm flex items-center gap-1.5 transition">
                    <i data-lucide="palette" class="w-3.5 h-3.5"></i> 1. Colores & Paleta
                </button>
                <button type="button" onclick="switchThemeTab('typography')" id="theme-tab-btn-typography" class="theme-tab-btn px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center gap-1.5 transition">
                    <i data-lucide="type" class="w-3.5 h-3.5"></i> 2. Tipografía & Letras
                </button>
                <button type="button" onclick="switchThemeTab('tabs-icons')" id="theme-tab-btn-tabs-icons" class="theme-tab-btn px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center gap-1.5 transition">
                    <i data-lucide="layout-grid" class="w-3.5 h-3.5"></i> 3. Pestañas & Íconos
                </button>
                <button type="button" onclick="switchThemeTab('layout')" id="theme-tab-btn-layout" class="theme-tab-btn px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center gap-1.5 transition">
                    <i data-lucide="monitor" class="w-3.5 h-3.5"></i> 4. Interfaz & Pantalla
                </button>
                <button type="button" onclick="switchThemeTab('logo')" id="theme-tab-btn-logo" class="theme-tab-btn px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center gap-1.5 transition">
                    <i data-lucide="image" class="w-3.5 h-3.5"></i> 5. Logo & Marca
                </button>
            </div>

            <!-- Cuerpo Scrolleable con las 4 Secciones -->
            <div class="flex-1 overflow-y-auto p-5 space-y-6">

                <!-- SECCIÓN 1: PALETAS DE COLORES -->
                <div id="theme-section-colors" class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-bold text-slate-900">Paleta de Colores Principal</h3>
                            <p class="text-xs text-slate-500">Seleccioná un tema predefinido para aplicar de inmediato</p>
                        </div>
                        
                        <!-- Modo Claro / Oscuro -->
                        <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                            <label class="flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer transition has-[:checked]:bg-white has-[:checked]:text-orange-600 has-[:checked]:shadow-sm">
                                <input type="radio" name="theme-mode" id="theme-mode-light" value="light" class="hidden" onchange="onThemeModeChange('light')">
                                <i data-lucide="sun" class="w-3.5 h-3.5"></i> Claro
                            </label>
                            <label class="flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer transition has-[:checked]:bg-slate-800 has-[:checked]:text-white has-[:checked]:shadow-sm">
                                <input type="radio" name="theme-mode" id="theme-mode-dark" value="dark" class="hidden" onchange="onThemeModeChange('dark')">
                                <i data-lucide="moon" class="w-3.5 h-3.5"></i> Oscuro
                            </label>
                        </div>
                    </div>

                    <!-- Grilla de Tarjetas de Paletas -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="theme-palettes-grid">
                        ${Object.entries(PRESET_PALETTES).map(([key, pal]) => `
                            <div onclick="selectPalette('${key}')" 
                                data-palette="${key}"
                                class="palette-preset-card p-3 rounded-2xl border border-slate-200 hover:border-orange-400 cursor-pointer transition active:scale-98 flex items-start gap-3 bg-slate-50/60 hover:bg-orange-50/40">
                                <div class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm" style="background: ${pal.headerBg}">
                                    <div class="w-3.5 h-3.5 rounded-full border-2 border-white shadow" style="background: ${pal.totalColor}"></div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center justify-between">
                                        <h4 class="font-bold text-xs text-slate-900 truncate">${pal.name}</h4>
                                        <div class="flex gap-1">
                                            ${pal.previewColors.map(c => `<span class="w-2.5 h-2.5 rounded-full border border-slate-200" style="background: ${c}"></span>`).join('')}
                                        </div>
                                    </div>
                                    <p class="text-[11px] text-slate-500 line-clamp-1 mt-0.5">${pal.subtitle}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- SECCIÓN 2: TIPOGRAFÍA & LETRAS -->
                <div id="theme-section-typography" class="space-y-5 hidden">
                    <div>
                        <h3 class="text-sm font-bold text-slate-900">Fuente / Familia Tipográfica</h3>
                        <p class="text-xs text-slate-500">Elegí la tipografía que mejor se adapte a tu monitor o tablet</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 flex items-center justify-between has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                            <div>
                                <div class="font-inter font-bold text-sm text-slate-900">Inter (Moderna)</div>
                                <div class="text-[11px] text-slate-500">Limpia, elegante y estándar de la industria</div>
                            </div>
                            <input type="radio" name="theme-font" value="inter" onchange="onFontFamilyChange('inter')" class="text-orange-600 focus:ring-orange-500">
                        </label>

                        <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 flex items-center justify-between has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                            <div>
                                <div class="font-roboto font-bold text-sm text-slate-900">Roboto (POS Tradicional)</div>
                                <div class="text-[11px] text-slate-500">Clásica de terminales Android y táctiles</div>
                            </div>
                            <input type="radio" name="theme-font" value="roboto" onchange="onFontFamilyChange('roboto')" class="text-orange-600 focus:ring-orange-500">
                        </label>

                        <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 flex items-center justify-between has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                            <div>
                                <div class="font-poppins font-bold text-sm text-slate-900">Poppins (Geométrica)</div>
                                <div class="text-[11px] text-slate-500">Letras redondeadas y muy llamativas</div>
                            </div>
                            <input type="radio" name="theme-font" value="poppins" onchange="onFontFamilyChange('poppins')" class="text-orange-600 focus:ring-orange-500">
                        </label>

                        <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 flex items-center justify-between has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                            <div>
                                <div class="font-mono-pos font-bold text-sm text-slate-900">Roboto Mono (Ticket Retro)</div>
                                <div class="text-[11px] text-slate-500">Estilo máquina registradora e impresora fiscal</div>
                            </div>
                            <input type="radio" name="theme-font" value="roboto-mono" onchange="onFontFamilyChange('roboto-mono')" class="text-orange-600 focus:ring-orange-500">
                        </label>
                    </div>

                    <!-- Tamaño de Texto -->
                    <div class="pt-3 border-t border-slate-200 space-y-2">
                        <div class="flex items-center justify-between">
                            <h4 class="text-xs font-bold text-slate-900">Escala de Tamaño de Letra</h4>
                            <span class="text-xs text-orange-600 font-semibold" id="font-size-label">Normal (100%)</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <label class="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition">
                                <input type="radio" name="theme-font-size" value="compact" onchange="onFontSizeChange('compact')" class="hidden">
                                <span>Compacto (85%)</span>
                            </label>
                            <label class="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition">
                                <input type="radio" name="theme-font-size" value="normal" onchange="onFontSizeChange('normal')" class="hidden">
                                <span>Normal (100%)</span>
                            </label>
                            <label class="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition">
                                <input type="radio" name="theme-font-size" value="large" onchange="onFontSizeChange('large')" class="hidden">
                                <span>Grande (115%)</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 3: PESTAÑAS & ÍCONOS -->
                <div id="theme-section-tabs-icons" class="space-y-5 hidden">
                    <!-- Estilo de Pestañas -->
                    <div class="space-y-3">
                        <div>
                            <h3 class="text-sm font-bold text-slate-900">Diseño de Pestañas de Navegación</h3>
                            <p class="text-xs text-slate-500">Cómo se ven los botones superiores del sistema</p>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-xs text-slate-900">Pastillas Modernas (Pills)</span>
                                    <input type="radio" name="theme-tab-style" value="pills" onchange="onTabStyleChange('pills')">
                                </div>
                                <div class="flex gap-1.5 p-1 bg-slate-200 rounded-xl">
                                    <span class="px-2 py-0.5 rounded-lg bg-white shadow-sm text-[10px] font-bold text-orange-600">Activa</span>
                                    <span class="px-2 py-0.5 text-[10px] text-slate-600">Inactiva</span>
                                </div>
                            </label>

                            <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-xs text-slate-900">Clásico POS con Borde</span>
                                    <input type="radio" name="theme-tab-style" value="classic" onchange="onTabStyleChange('classic')">
                                </div>
                                <div class="flex gap-1 border-b border-slate-300">
                                    <span class="px-2 py-0.5 bg-white border border-b-0 border-slate-300 text-[10px] font-bold text-slate-900">Caja</span>
                                    <span class="px-2 py-0.5 bg-slate-100 text-[10px] text-slate-500">Stock</span>
                                </div>
                            </label>

                            <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-xs text-slate-900">Línea Inferior (Underline)</span>
                                    <input type="radio" name="theme-tab-style" value="underline" onchange="onTabStyleChange('underline')">
                                </div>
                                <div class="flex gap-2 border-b border-slate-200 pb-0.5">
                                    <span class="text-[10px] font-bold text-orange-600 border-b-2 border-orange-600">Inicio</span>
                                    <span class="text-[10px] text-slate-500">Ventas</span>
                                </div>
                            </label>

                            <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-xs text-slate-900">Fichas de Carpeta</span>
                                    <input type="radio" name="theme-tab-style" value="folder" onchange="onTabStyleChange('folder')">
                                </div>
                                <div class="flex gap-1">
                                    <span class="px-2 py-0.5 rounded-t-lg bg-orange-600 text-white text-[10px] font-bold">Principal</span>
                                    <span class="px-2 py-0.5 rounded-t-lg bg-slate-200 text-slate-600 text-[10px]">Reportes</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Grosor de Íconos -->
                    <div class="pt-3 border-t border-slate-200 space-y-3">
                        <div>
                            <h4 class="text-xs font-bold text-slate-900">Grosor de Íconos (Trazos)</h4>
                            <p class="text-[11px] text-slate-500">Ajustá la visibilidad de los iconos de la interfaz</p>
                        </div>

                        <div class="grid grid-cols-3 gap-2">
                            <label class="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition flex flex-col items-center gap-1">
                                <input type="radio" name="theme-icon-stroke" value="1.5" onchange="onIconStrokeChange(1.5)" class="hidden">
                                <i data-lucide="shopping-cart" class="w-4 h-4 stroke-[1.5]"></i>
                                <span>Fino (1.5px)</span>
                            </label>
                            <label class="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition flex flex-col items-center gap-1">
                                <input type="radio" name="theme-icon-stroke" value="2.0" onchange="onIconStrokeChange(2.0)" class="hidden">
                                <i data-lucide="shopping-cart" class="w-4 h-4 stroke-[2.0]"></i>
                                <span>Medio (2.0px)</span>
                            </label>
                            <label class="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition flex flex-col items-center gap-1">
                                <input type="radio" name="theme-icon-stroke" value="2.5" onchange="onIconStrokeChange(2.5)" class="hidden">
                                <i data-lucide="shopping-cart" class="w-4 h-4 stroke-[2.5]"></i>
                                <span>Grueso / Táctil (2.5px)</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 4: INTERFAZ & PANTALLA -->
                <div id="theme-section-layout" class="space-y-5 hidden">
                    <!-- Distribución de Columnas -->
                    <div class="space-y-3">
                        <div>
                            <h3 class="text-sm font-bold text-slate-900">Distribución de Pantalla de Venta (POS)</h3>
                            <p class="text-xs text-slate-500">Ubicación del ticket y del teclado táctil de productos</p>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-xs text-slate-900">Estilo Posberry (Recomendado)</span>
                                    <input type="radio" name="theme-layout-columns" value="posberry" onchange="onLayoutColumnsChange('posberry')">
                                </div>
                                <div class="grid grid-cols-5 gap-1 h-8 rounded border border-slate-300 p-0.5 bg-white">
                                    <div class="col-span-3 bg-orange-100 rounded text-[9px] flex items-center justify-center font-bold text-orange-800">Ticket (60%)</div>
                                    <div class="col-span-2 bg-slate-100 rounded text-[9px] flex items-center justify-center text-slate-600">Catálogo</div>
                                </div>
                            </label>

                            <label class="p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50/40 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/60">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-xs text-slate-900">Estilo Clásico</span>
                                    <input type="radio" name="theme-layout-columns" value="classic" onchange="onLayoutColumnsChange('classic')">
                                </div>
                                <div class="grid grid-cols-5 gap-1 h-8 rounded border border-slate-300 p-0.5 bg-white">
                                    <div class="col-span-3 bg-slate-100 rounded text-[9px] flex items-center justify-center text-slate-600">Catálogo</div>
                                    <div class="col-span-2 bg-orange-100 rounded text-[9px] flex items-center justify-center font-bold text-orange-800">Ticket</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Esquinas / Bordes Redondeados -->
                    <div class="pt-3 border-t border-slate-200 space-y-3">
                        <div>
                            <h4 class="text-xs font-bold text-slate-900">Estilo de Bordes y Esquinas</h4>
                            <p class="text-[11px] text-slate-500">Sensación visual de botones y tarjetas</p>
                        </div>

                        <div class="grid grid-cols-3 gap-2">
                            <label class="py-2.5 px-3 rounded-none border border-slate-300 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition">
                                <input type="radio" name="theme-border-radius" value="sharp" onchange="onBorderRadiusChange('sharp')" class="hidden">
                                <span>Rectos / Clásico</span>
                            </label>
                            <label class="py-2.5 px-3 rounded-xl border border-slate-300 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition">
                                <input type="radio" name="theme-border-radius" value="smooth" onchange="onBorderRadiusChange('smooth')" class="hidden">
                                <span>Suaves / Moderno</span>
                            </label>
                            <label class="py-2.5 px-3 rounded-3xl border border-slate-300 bg-slate-50 text-center cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:text-white has-[:checked]:border-orange-600 text-xs font-bold transition">
                                <input type="radio" name="theme-border-radius" value="round" onchange="onBorderRadiusChange('round')" class="hidden">
                                <span>Muy Redondeados</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 5: LOGO & IDENTIDAD -->
                <div id="theme-section-logo" class="space-y-4 hidden">
                    <div>
                        <h3 class="text-sm font-bold text-slate-900">Logo del Comercio & Identidad Visual</h3>
                        <p class="text-xs text-slate-500">Subí o cambiá el logo que se muestra en la barra superior, pantalla de acceso y tickets térmicos</p>
                    </div>

                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                        <div class="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center p-2 overflow-hidden shadow-inner flex-shrink-0">
                            <img id="modal-logo-preview" src="${window.currentBusinessLogo || ''}" alt="Logo" class="max-w-full max-h-full object-contain ${window.currentBusinessLogo ? '' : 'hidden'}">
                            <div id="modal-logo-placeholder" class="text-center text-slate-400 ${window.currentBusinessLogo ? 'hidden' : ''}">
                                <i data-lucide="image" class="w-7 h-7 mx-auto mb-1 opacity-60"></i>
                                <span class="text-[10px] block font-semibold">Sin logo</span>
                            </div>
                        </div>
                        <div class="flex-1 w-full space-y-2.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <input type="file" id="modal-logo-file-input" accept="image/*" class="hidden" onchange="handleModalLogoUpload(event)">
                                <button type="button" onclick="document.getElementById('modal-logo-file-input').click()" class="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95">
                                    <i data-lucide="upload" class="w-3.5 h-3.5"></i> Subir Imagen
                                </button>
                                <button type="button" onclick="removeModalLogo()" id="modal-btn-remove-logo" class="px-3 py-2 rounded-xl bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition ${window.currentBusinessLogo ? '' : 'hidden'}">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Quitar Logo
                                </button>
                            </div>
                            <div class="flex items-center gap-2">
                                <input type="text" id="modal-logo-url-input" placeholder="O pegar enlace URL de imagen..." value="${window.currentBusinessLogo || ''}" class="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono">
                                <button type="button" onclick="saveModalLogoFromUrl()" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition flex-shrink-0">
                                    Aplicar
                                </button>
                            </div>
                            <p class="text-[11px] text-slate-400">💡 Sugerencia: formato PNG con transparencia o JPG.</p>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Pie del Modal con Acciones -->
            <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                <button type="button" onclick="resetDefaultTheme()" class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 transition border border-slate-300 flex items-center gap-1.5">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Restablecer Valores
                </button>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="closeThemeModal()" class="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition flex items-center gap-1.5">
                        <i data-lucide="check" class="w-4 h-4"></i> Listo / Guardar
                    </button>
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(modalDiv);
}

/**
 * Navegación entre pestañas dentro del modal
 */
function switchThemeTab(tabId) {
    const tabs = ['colors', 'typography', 'tabs-icons', 'layout', 'logo'];
    tabs.forEach(t => {
        const btn = document.getElementById(`theme-tab-btn-${t}`);
        const sec = document.getElementById(`theme-section-${t}`);
        if (t === tabId) {
            if (btn) btn.className = 'theme-tab-btn px-3 py-1.5 rounded-xl bg-orange-600 text-white shadow-sm flex items-center gap-1.5 transition font-bold';
            if (sec) sec.classList.remove('hidden');
        } else {
            if (btn) btn.className = 'theme-tab-btn px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center gap-1.5 transition';
            if (sec) sec.classList.add('hidden');
        }
    });
    if (window.lucide) lucide.createIcons();
}

function handleModalLogoUpload(event) {
    if (typeof handleLogoFileUpload === 'function') {
        handleLogoFileUpload(event);
    }
}

function saveModalLogoFromUrl() {
    const inp = document.getElementById('modal-logo-url-input');
    const cfgInp = document.getElementById('cfg-logo-url-input');
    if (inp && cfgInp) {
        cfgInp.value = inp.value;
    }
    if (typeof saveLogoFromUrl === 'function') {
        saveLogoFromUrl();
    }
}

function removeModalLogo() {
    if (typeof removeLogo === 'function') {
        removeLogo();
    }
}

/**
 * Event Handlers
 */
function selectPalette(key) {
    currentTheme.palette = key;
    applyTheme(currentTheme, true);
    syncThemeModalControls();
}

function onThemeModeChange(mode) {
    currentTheme.mode = mode;
    applyTheme(currentTheme, true);
}

function onFontFamilyChange(font) {
    currentTheme.fontFamily = font;
    applyTheme(currentTheme, true);
}

function onFontSizeChange(size) {
    currentTheme.fontSize = size;
    applyTheme(currentTheme, true);
}

function onTabStyleChange(style) {
    currentTheme.tabStyle = style;
    applyTheme(currentTheme, true);
}

function onIconStrokeChange(stroke) {
    currentTheme.iconStroke = stroke;
    applyTheme(currentTheme, true);
}

function onBorderRadiusChange(radius) {
    currentTheme.borderRadius = radius;
    applyTheme(currentTheme, true);
}

function onLayoutColumnsChange(layout) {
    currentTheme.layoutColumns = layout;
    applyTheme(currentTheme, true);
}

function resetDefaultTheme() {
    currentTheme = { ...DEFAULT_THEME };
    applyTheme(currentTheme, true);
    syncThemeModalControls();
}

// Iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    initThemeManager();
});
