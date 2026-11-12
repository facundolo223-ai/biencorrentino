# 🛒 Supermercado & Almacén POS - Sistema Punto de Venta Profesional

Sistema completo de Punto de Venta (POS) y caja registradora de alta velocidad, optimizado específicamente para **Supermercados, Minimarkets, Autoservicios y Almacenes de Barrio**.

---

## 🚀 Inicio Rápido en Windows (1 Clic)

Simplemente haz doble clic en el archivo:
```bat
iniciar.bat
```
El sistema iniciará automáticamente y abrirá la pantalla en tu navegador en:
👉 **`http://localhost:5001`**

---

## 🌟 Funcionalidades Especializadas para Supermercado & Almacén

### 1. ⚡ Modo Escáner de Código de Barras Continuo
- El cursor se mantiene siempre en el campo de escaneo.
- Al pasar cualquier producto con lector láser o pistola de códigos de barras (EAN-13, EAN-8, UPC o códigos internos), se agrega al ticket instantáneamente con confirmación sonora.
- Si el producto ya está en el carrito, suma la cantidad de manera automática sin necesidad de usar el mouse.

### 2. ⚖️ Soporte para Balanza y Productos Pesables
- Soporte nativo para venta por peso (Kg, Gramos) en **Fiambrería, Verdulería, Carnicería y Panadería**.
- **Decodificación de Códigos de Balanza Electrónica:**
  - Compatible con balanzas comerciales (Systel, Kretz, Toledo, Moretti).
  - Lee códigos impresos con prefijo estándar (ej: `20` + código producto + peso/importe) y carga los kilogramos exactos al ticket de inmediato.
- **Acceso rápido con tecla `F8`**: Abre el pesador manual para ingresar gramos o kilos con cálculo instantáneo de subtotal según el precio por kilo.

### 3. 📒 Libreta de Almacén (Fiar a Vecinos & Cuentas Corrientes)
- Registro de clientes con límite de crédito y teléfono para recordatorios.
- Venta con medio de pago **"Fiar (Libreta)"**: carga la deuda automáticamente a la ficha del cliente.
- Módulo de cobro de **abonos / pagos parciales** en efectivo con actualización del saldo deudor y comprobante.

### 4. 📈 Aumento Masivo de Precios (%)
- Diseñado para actualizar precios rápidamente frente a aumentos de proveedores o inflación.
- Permite aumentar un porcentaje (ej: +10%, +15%, +20%) a una **categoría específica** o a **todo el inventario general**.
- Incluye redondeo comercial automático (a decenas o a $50/$100) para evitar monedas o centavos complicados al dar vuelto.

### 5. 💵 Control de Caja y Turnos (Arqueo X / Z)
- Apertura de turno con fondo inicial de cambio.
- Registro de **movimientos rápidos de caja** (Egresos para pago a repartidor/panadero, o ingresos de cambio).
- Cierre de turno con arqueo ciego: el cajero cuenta el efectivo y el sistema calcula la diferencia entre lo esperado y lo real.

### 6. 🧾 Impresión de Ticket Térmico
- Formato limpio optimizado para impresoras térmicas de **80mm y 58mm**.
- Detalle de productos, unidades/kilos, descuentos aplicados, medio de pago, vuelto entregado y mensaje de pie configurable.

---

## ⌨️ Atajos de Teclado Rápidos

| Tecla | Acción |
|---|---|
| **F1** | Enfocar el escáner de código de barras / volver a la caja |
| **F2** | Modificar cantidad o peso del último producto escaneado |
| **F4** | Abrir ventana de cobro rápido y emisión de ticket |
| **F6** | Ir a la pantalla de Inventario y Productos |
| **F8** | Abrir la balanza para pesar producto suelto |
| **Esc** | Cerrar ventanas emergentes o limpiar el ticket |

---

## 📁 Estructura del Proyecto

- `app.py`: Backend Flask con endpoints de caja rápida, balanza, libreta de fiar y estadísticas.
- `database.py`: Base de datos SQLite (`supermercado.db`) con catálogo inicial precargado (Almacén, Bebidas, Fiambrería, Verdulería, Panadería, Limpieza).
- `templates/index.html`: Interfaz moderna de cajero con diseño responsivo Tailwind CSS.
- `static/js/app.js`: Motor de alta velocidad para escaneo continuo, atajos y cálculo de vuelto.
- `static/css/style.css`: Reglas de maquetado e impresión térmica sin márgenes.
- `iniciar.bat`: Lanzador automático para Windows.

---

## ☁️ Deploy en Railway (producción)

| Variable | Valor | Para qué |
| --- | --- | --- |
| `SUPERMERCADO_DB` | `/app/data/supermercado.db` | Base SQLite dentro del volumen persistente |
| `UPLOADS_DIR` | `/app/data/uploads` | Logo, banners y fotos de productos |
| `SECRET_KEY` | (opcional) | Firma de sesiones |

- El volumen `rsmarket-volume` se monta en `/app/data`. Railway permite **un solo volumen por servicio**, por eso la base y las imágenes viven juntas ahí.
- Deploy automático: cada push a `main` reconstruye la imagen con el `Dockerfile`.
- La base **no** va en el repo (ver `.dockerignore`): si se incluyera, cada deploy pisaría los datos reales.
- Ruta que sirve las imágenes del volumen: `/static/uploads/<archivo>` (definida en `app.py`).

## 📱 Fix de cobro en celular (2026-11-12)

El botón de cobro quedaba tapado por la barra del navegador y el modal no tenía scroll:

- `body`/`html` usan `100dvh` en vez de `100%` (`static/css/style.css`).
- Botón **COBRAR** agregado al pie del ticket (`templates/index.html`), visible sin depender del footer.
- Modal de cobro con `overflow-y-auto` y `max-h-[calc(100dvh-...)]` para pantallas bajas o con teclado abierto.
- `service-worker.js` en `v3` para invalidar la caché vieja del celular.
