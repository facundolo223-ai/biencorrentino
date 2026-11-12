import sqlite3
import os
import unicodedata
import re
from werkzeug.security import generate_password_hash

DB_PATH = os.environ.get(
    "SUPERMERCADO_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "supermercado.db"),
)

VALID_ROLES = ("admin", "dueño", "cajero", "empleado", "repositor")


def normalize_text(text):
    """Normaliza texto eliminando acentos, caracteres especiales y pasando a minúsculas para búsquedas insensibles."""
    if not text:
        return ""
    text = str(text)
    nfkd = unicodedata.normalize('NFKD', text)
    no_accents = ''.join(c for c in nfkd if not unicodedata.combining(c))
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', no_accents.lower())
    return ' '.join(cleaned.split())


def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=15, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 8000")
    conn.create_function("NORMALIZE", 1, normalize_text)
    return conn


def _table_columns(cur, table):
    cur.execute(f"PRAGMA table_info({table})")
    return {row["name"] for row in cur.fetchall()}


def _add_column_if_missing(cur, table, column, ddl):
    if column not in _table_columns(cur, table):
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#3B82F6',
            icon TEXT DEFAULT 'tag',
            sort_order INTEGER DEFAULT 0
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            name TEXT NOT NULL,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            cost_price REAL DEFAULT 0.0,
            sale_price REAL NOT NULL,
            stock REAL DEFAULT 0,
            min_stock REAL DEFAULT 5,
            control_stock INTEGER DEFAULT 1,
            unit_type TEXT DEFAULT 'un',
            is_weighable INTEGER DEFAULT 0,
            image_url TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            address TEXT DEFAULT '',
            credit_limit REAL DEFAULT 50000.0,
            current_balance REAL DEFAULT 0.0,
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS customer_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK(type IN ('DEBT', 'PAYMENT')),
            amount REAL NOT NULL,
            balance_after REAL NOT NULL,
            description TEXT DEFAULT '',
            order_id INTEGER,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            pin_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'empleado' CHECK(role IN ('admin', 'dueño', 'cajero', 'empleado', 'repositor')),
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS cash_shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cashier_name TEXT NOT NULL,
            opened_at DATETIME DEFAULT (datetime('now', 'localtime')),
            closed_at DATETIME,
            initial_cash REAL DEFAULT 0.0,
            final_cash REAL,
            expected_cash REAL,
            difference REAL,
            status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
            notes TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS cash_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shift_id INTEGER REFERENCES cash_shifts(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK(type IN ('IN', 'OUT')),
            amount REAL NOT NULL,
            concept TEXT NOT NULL,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT NOT NULL,
            cashier_name TEXT DEFAULT 'Caja 1',
            customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            shift_id INTEGER REFERENCES cash_shifts(id) ON DELETE SET NULL,
            subtotal REAL NOT NULL,
            discount_percent REAL DEFAULT 0.0,
            discount_amount REAL DEFAULT 0.0,
            total REAL NOT NULL,
            payment_method TEXT NOT NULL,
            amount_paid REAL DEFAULT 0.0,
            change_amount REAL DEFAULT 0.0,
            status TEXT DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED', 'CANCELLED')),
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            product_name TEXT NOT NULL,
            unit_type TEXT DEFAULT 'un',
            quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS order_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            method TEXT NOT NULL,
            amount REAL NOT NULL
        )
    """)

    default_configs = [
        ("business_name", "Super Almacen Central"),
        ("business_cuit", "20-38491823-9"),
        ("business_address", "Av. San Martin 1420"),
        ("business_phone", "+54 9 379 506-2876"),
        ("business_whatsapp", "5493794821358"),
        ("business_footer", "Gracias por su compra! Vuelva pronto."),
        ("currency_symbol", "$"),
        ("scale_prefix", "20"),
        ("ticket_width", "80mm"),
        ("cashier_name", "Caja 1")
    ]
    for key, val in default_configs:
        cur.execute("INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)", (key, val))

    # Usuarios del Negocio (Dueño y Empleados)
    default_users = [
        ("Dueño", "dueno", "1234", "dueño"),
        ("Ramiro", "ramiro", "1111", "empleado"),
        ("Luciana", "luciana", "2222", "empleado"),
        ("Nico", "nico", "3333", "empleado")
    ]
    for uname, uuser, upin, urole in default_users:
        existing = cur.execute("SELECT id FROM users WHERE username = ?", (uuser,)).fetchone()
        if not existing:
            cur.execute("""
                INSERT INTO users (name, username, pin_hash, role)
                VALUES (?, ?, ?, ?)
            """, (uname, uuser, generate_password_hash(upin), urole))

    cur.execute("SELECT COUNT(*) FROM categories")
    if cur.fetchone()[0] == 0:
        categories = [
            ("Almacen y Secos", "#3B82F6", "package", 1),
            ("Bebidas y Aguas", "#06B6D4", "cup-soda", 2),
            ("Lacteos y Fiambreria", "#EAB308", "milk", 3),
            ("Frutas y Verduras", "#22C55E", "apple", 4),
            ("Carniceria y Granja", "#EF4444", "beef", 5),
            ("Panaderia", "#F97316", "wheat", 6),
            ("Limpieza del Hogar", "#8B5CF6", "sparkles", 7),
            ("Perfumeria e Higiene", "#EC4899", "heart", 8),
            ("Kiosco y Golosinas", "#F43F5E", "candy", 9)
        ]
        cur.executemany("""
            INSERT INTO categories (name, color, icon, sort_order)
            VALUES (?, ?, ?, ?)
        """, categories)

    cur.execute("SELECT COUNT(*) FROM products")
    if cur.fetchone()[0] == 0:
        cur.execute("SELECT id, name FROM categories")
        cat_map = {row["name"]: row["id"] for row in cur.fetchall()}

        sample_products = [
            ("7790070411855", "Fideos Matarazzo Spaghetti 500g", cat_map.get("Almacen y Secos"), 950.0, 1450.0, 48.0, 10.0, 1, "un", 0, ""),
            ("7791120031558", "Arroz Gallo Oro Largo Fino 1kg", cat_map.get("Almacen y Secos"), 1800.0, 2600.0, 35.0, 10.0, 1, "un", 0, ""),
            ("7790272001005", "Aceite Girasol Natura 900ml", cat_map.get("Almacen y Secos"), 1650.0, 2390.0, 30.0, 8.0, 1, "un", 0, ""),
            ("7790040131448", "Harina Cañuelas 000 1kg", cat_map.get("Almacen y Secos"), 700.0, 1050.0, 50.0, 12.0, 1, "un", 0, ""),
            ("7790040131455", "Azucar Ledesma Clasica 1kg", cat_map.get("Almacen y Secos"), 800.0, 1200.0, 40.0, 10.0, 1, "un", 0, ""),
            ("7790580120000", "Pure de Tomate Noel 520g", cat_map.get("Almacen y Secos"), 600.0, 950.0, 45.0, 10.0, 1, "un", 0, ""),
            ("7790060023686", "Galletitas Oreo 118g", cat_map.get("Almacen y Secos"), 900.0, 1350.0, 60.0, 15.0, 1, "un", 0, ""),
            ("7790580131000", "Yerba Mate Playadito 1kg", cat_map.get("Almacen y Secos"), 2900.0, 4200.0, 30.0, 5.0, 1, "un", 0, ""),
            ("7790895000997", "Coca-Cola Sabor Original 2.25L", cat_map.get("Bebidas y Aguas"), 2200.0, 3100.0, 40.0, 12.0, 1, "un", 0, ""),
            ("7790895001000", "Sprite Lima-Limon 2.25L", cat_map.get("Bebidas y Aguas"), 2100.0, 2950.0, 24.0, 8.0, 1, "un", 0, ""),
            ("7790314057880", "Agua Mineral Villa del Sur 1.5L", cat_map.get("Bebidas y Aguas"), 750.0, 1150.0, 50.0, 12.0, 1, "un", 0, ""),
            ("7792798000018", "Cerveza Quilmes Clasica 1L Retornable", cat_map.get("Bebidas y Aguas"), 1500.0, 2200.0, 60.0, 15.0, 1, "un", 0, ""),
            ("7790742111111", "Leche La Serenisima Clasica 1L", cat_map.get("Lacteos y Fiambreria"), 1050.0, 1490.0, 50.0, 10.0, 1, "un", 0, ""),
            ("200001", "Queso Cremoso La Paulina (x Kg)", cat_map.get("Lacteos y Fiambreria"), 6200.0, 8900.0, 25.0, 5.0, 1, "kg", 1, ""),
            ("200002", "Jamon Cocido Paladini (x Kg)", cat_map.get("Lacteos y Fiambreria"), 8500.0, 12500.0, 18.0, 3.0, 1, "kg", 1, ""),
            ("200003", "Queso Tybo Barra (x Kg)", cat_map.get("Lacteos y Fiambreria"), 7000.0, 9900.0, 20.0, 4.0, 1, "kg", 1, ""),
            ("200010", "Papa Negra Cepillada (x Kg)", cat_map.get("Frutas y Verduras"), 550.0, 950.0, 120.0, 20.0, 1, "kg", 1, ""),
            ("200011", "Cebolla de Campo (x Kg)", cat_map.get("Frutas y Verduras"), 600.0, 1100.0, 80.0, 15.0, 1, "kg", 1, ""),
            ("200012", "Tomate Redondo Especial (x Kg)", cat_map.get("Frutas y Verduras"), 1100.0, 1890.0, 50.0, 10.0, 1, "kg", 1, ""),
            ("200013", "Banana Ecuador Premium (x Kg)", cat_map.get("Frutas y Verduras"), 1300.0, 2100.0, 60.0, 12.0, 1, "kg", 1, ""),
            ("200014", "Manzana Roja Elegida (x Kg)", cat_map.get("Frutas y Verduras"), 1400.0, 2200.0, 40.0, 10.0, 1, "kg", 1, ""),
            ("200020", "Pan Frances / Miñon (x Kg)", cat_map.get("Panaderia"), 1100.0, 1800.0, 45.0, 8.0, 1, "kg", 1, ""),
            ("200021", "Facturas Surtidas de Manteca (x Docena)", cat_map.get("Panaderia"), 3500.0, 5400.0, 20.0, 4.0, 1, "un", 0, ""),
            ("7790387013894", "Lavandina Ayudin Comun 1L", cat_map.get("Limpieza del Hogar"), 750.0, 1190.0, 36.0, 8.0, 1, "un", 0, ""),
            ("7790111124558", "Detergente Magistral Limon 500ml", cat_map.get("Limpieza del Hogar"), 1400.0, 2050.0, 25.0, 6.0, 1, "un", 0, ""),
            ("7790070114444", "Rollo de Cocina Elegante 3x50", cat_map.get("Limpieza del Hogar"), 1100.0, 1690.0, 30.0, 8.0, 1, "un", 0, "")
        ]

        cur.executemany("""
            INSERT INTO products (code, name, category_id, cost_price, sale_price, stock, min_stock, control_stock, unit_type, is_weighable, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_products)

    cur.execute("SELECT COUNT(*) FROM customers")
    if cur.fetchone()[0] == 0:
        sample_customers = [
            ("Consumidor Final", "", "", 0.0, 0.0, "Cliente general"),
            ("Carlos Martinez (Vecino Casa 4)", "3794123456", "San Martin 1432", 60000.0, 12500.0, "Fia hasta fin de mes"),
            ("Sra. Elena Gomez", "3794987654", "Belgrano 820", 40000.0, 0.0, "Paga semanal")
        ]
        cur.executemany("""
            INSERT INTO customers (name, phone, address, credit_limit, current_balance, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, sample_customers)

    cur.execute("SELECT COUNT(*) FROM cash_shifts WHERE status = 'OPEN'")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO cash_shifts (cashier_name, initial_cash, status)
            VALUES ('Caja 1', 25000.0, 'OPEN')
        """)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Base de datos de Supermercado inicializada correctamente.")
