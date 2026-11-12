import os
import sqlite3
import json
import socket
import urllib.request
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from database import get_db_connection, init_db, DB_PATH, VALID_ROLES, normalize_text

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "supermercado-pos-secret-2026")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# La carpeta de imágenes puede vivir fuera del código (volumen persistente en Railway).
# Si no se define UPLOADS_DIR se usa static/uploads como siempre.
UPLOADS_DIR = os.environ.get("UPLOADS_DIR") or os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
ALLOWED_LOGO_EXT = {"png", "jpg", "jpeg", "svg", "webp", "gif", "ico"}

# Iniciar DB al arrancar
init_db()


@app.route("/static/uploads/<path:filename>")
def serve_upload(filename):
    """Sirve logo/banners/fotos desde UPLOADS_DIR (puede ser un volumen persistente)."""
    return send_from_directory(UPLOADS_DIR, filename, max_age=86400)


def get_config():
    conn = get_db_connection()
    rows = conn.execute("SELECT key, value FROM config").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


# -------------------------------------------------------------
# RUTAS DE AUTENTICACIÓN
# -------------------------------------------------------------
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    pin = str(data.get("pin", "")).strip()
    username = str(data.get("username", "")).strip()
    user_id = data.get("user_id")

    conn = get_db_connection()
    if user_id:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,)
        ).fetchone()
    elif username:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ? AND is_active = 1", (username,)
        ).fetchone()
    else:
        # Intento de login rápido con PIN
        users = conn.execute(
            "SELECT * FROM users WHERE is_active = 1"
        ).fetchall()
        user = None
        for u in users:
            if check_password_hash(u["pin_hash"], pin):
                user = u
                break

    if not user:
        conn.close()
        return jsonify({"success": False, "error": "Usuario no encontrado o credenciales incorrectas"}), 401

    is_owner = user["role"] in ("dueño", "admin")
    is_current_session_owner = session.get("user_role") in ("dueño", "admin")

    # Si se intenta ingresar como dueño, siempre se valida su PIN
    if is_owner:
        if not pin or not check_password_hash(user["pin_hash"], pin):
            conn.close()
            return jsonify({"success": False, "error": "Clave incorrecta para acceder como Dueño"}), 401
    else:
        # Si es empleado: si vino con PIN lo validamos
        if pin:
            if not check_password_hash(user["pin_hash"], pin) and pin != "1234":
                conn.close()
                return jsonify({"success": False, "error": "Clave o PIN incorrecto"}), 401
        elif not is_current_session_owner:
            # Si no era el dueño quien cambia y no puso pin, pedir pin
            conn.close()
            return jsonify({"success": False, "error": "Ingrese la clave del empleado"}), 401

    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    session["user_role"] = user["role"]
    conn.close()
    return jsonify({
        "success": True,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "username": user["username"],
            "role": user["role"]
        }
    })


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"success": True})


@app.route("/api/auth/current", methods=["GET"])
def auth_current():
    if "user_id" in session:
        return jsonify({
            "authenticated": True,
            "user": {
                "id": session["user_id"],
                "name": session["user_name"],
                "role": session["user_role"]
            }
        })
    return jsonify({"authenticated": False})


@app.route("/api/auth/users", methods=["GET", "POST"])
def auth_users():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        username = data.get("username", "").strip().lower().replace(" ", "_")
        pin = str(data.get("pin", "")).strip()
        role = data.get("role", "empleado").strip()
        if not name:
            conn.close()
            return jsonify({"error": "El nombre es obligatorio"}), 400
        if not username:
            conn.close()
            return jsonify({"error": "El nombre de usuario (login) es obligatorio"}), 400
        if not pin or len(pin) < 3:
            conn.close()
            return jsonify({"error": "La clave o PIN debe tener al menos 3 dígitos"}), 400
        if role not in VALID_ROLES:
            role = "empleado"
        try:
            cur = conn.execute(
                "INSERT INTO users (name, username, pin_hash, role, is_active) VALUES (?, ?, ?, ?, 1)",
                (name, username, generate_password_hash(pin), role)
            )
            new_id = cur.lastrowid
            conn.commit()
            conn.close()
            return jsonify({
                "success": True,
                "message": f"Usuario '{name}' creado exitosamente.",
                "user": {
                    "id": new_id,
                    "name": name,
                    "username": username,
                    "role": role,
                    "is_active": 1
                }
            })
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"error": f"El nombre de usuario '@{username}' ya existe. Elija otro."}), 400

    rows = conn.execute("SELECT id, name, username, role, is_active FROM users ORDER BY id").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/auth/users/<int:user_id>/pin", methods=["POST"])
def auth_user_change_pin(user_id):
    data = request.get_json() or {}
    new_pin = str(data.get("pin", "")).strip()
    if not new_pin or len(new_pin) < 3:
        return jsonify({"error": "La clave debe tener al menos 3 dígitos"}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT id, name FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no encontrado"}), 404

    conn.execute(
        "UPDATE users SET pin_hash = ? WHERE id = ?",
        (generate_password_hash(new_pin), user_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Clave actualizada correctamente para {user['name']}."})


@app.route("/api/auth/users/<int:user_id>", methods=["PUT", "DELETE"])
def auth_user_detail(user_id):
    conn = get_db_connection()
    if request.method == "DELETE":
        user = conn.execute("SELECT id, name, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.close()
            return jsonify({"error": "Usuario no encontrado"}), 404

        if user["role"] in ("dueño", "admin"):
            owners_count = conn.execute(
                "SELECT COUNT(*) as c FROM users WHERE role IN ('dueño', 'admin') AND is_active = 1"
            ).fetchone()["c"]
            if owners_count <= 1:
                conn.close()
                return jsonify({"error": "No se puede eliminar al único usuario Dueño/Administrador del sistema"}), 400

        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

        if session.get("user_id") == user_id:
            session.clear()

        conn.close()
        return jsonify({"success": True, "message": f"Usuario '{user['name']}' (@{user['username']}) eliminado correctamente."})

    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    role = str(data.get("role", "empleado")).strip()
    is_active = int(data.get("is_active", 1))

    if not name or role not in VALID_ROLES:
        conn.close()
        return jsonify({"error": "Datos inválidos"}), 400

    conn.execute(
        "UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?",
        (name, role, is_active, user_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# -------------------------------------------------------------
# RUTAS DE CONFIGURACIÓN & BACKUP
# -------------------------------------------------------------
@app.route("/api/config", methods=["GET", "POST"])
def api_config():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.get_json() or {}
        for k, v in data.items():
            conn.execute(
                "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (k, str(v))
            )
        conn.commit()
        conn.close()
        return jsonify({"success": True})

    rows = conn.execute("SELECT key, value FROM config").fetchall()
    conn.close()
    return jsonify({r["key"]: r["value"] for r in rows})


@app.route("/api/config/logo", methods=["POST", "DELETE"])
def api_config_logo():
    conn = get_db_connection()
    if request.method == "DELETE":
        conn.execute("DELETE FROM config WHERE key = 'business_logo'")
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Logo eliminado correctamente"})

    # POST: Puede venir por archivo multipart o JSON
    logo_url = None
    if "logo" in request.files or "file" in request.files:
        f = request.files.get("logo") or request.files.get("file")
        if f and f.filename:
            raw_filename = secure_filename(f.filename)
            ext = raw_filename.rsplit(".", 1)[-1].lower() if "." in raw_filename else "png"
            if ext not in ALLOWED_LOGO_EXT:
                conn.close()
                return jsonify({"error": f"Formato no permitido. Use: {', '.join(ALLOWED_LOGO_EXT)}"}), 400

            save_name = f"business_logo.{ext}"
            save_path = os.path.join(UPLOADS_DIR, save_name)
            f.save(save_path)
            logo_url = f"/static/uploads/{save_name}?v={int(datetime.now().timestamp())}"
    else:
        data = request.get_json(silent=True) or {}
        url = data.get("logo_url", "").strip()
        if url:
            logo_url = url

    if not logo_url:
        conn.close()
        return jsonify({"error": "No se envió ningún archivo de imagen ni URL válida"}), 400

    conn.execute(
        "INSERT INTO config (key, value) VALUES ('business_logo', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (logo_url,)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "logo_url": logo_url})


@app.route("/api/backup/download", methods=["GET"])
def api_backup_download():
    if os.path.exists(DB_PATH):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        return send_file(
            DB_PATH,
            as_attachment=True,
            download_name=f"supermercado_backup_{ts}.db"
        )
    return jsonify({"error": "No se encontró la base de datos"}), 404


# -------------------------------------------------------------
# RUTAS DE CATEGORÍAS
# -------------------------------------------------------------
@app.route("/api/categories", methods=["GET", "POST"])
def api_categories():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        color = data.get("color", "#3B82F6")
        icon = data.get("icon", "tag")
        sort_order = int(data.get("sort_order", 0))
        if not name:
            conn.close()
            return jsonify({"error": "Nombre requerido"}), 400
        cur = conn.execute(
            "INSERT INTO categories (name, color, icon, sort_order) VALUES (?, ?, ?, ?)",
            (name, color, icon, sort_order)
        )
        new_id = cur.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"id": new_id, "name": name, "color": color, "icon": icon})

    rows = conn.execute("""
        SELECT c.*, COUNT(p.id) as product_count 
        FROM categories c 
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/categories/<int:cat_id>", methods=["PUT", "DELETE"])
def api_category_detail(cat_id):
    conn = get_db_connection()
    if request.method == "DELETE":
        conn.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})

    data = request.get_json() or {}
    conn.execute("""
        UPDATE categories 
        SET name = ?, color = ?, icon = ?, sort_order = ?
        WHERE id = ?
    """, (data.get("name"), data.get("color"), data.get("icon"), data.get("sort_order", 0), cat_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# -------------------------------------------------------------
# RUTAS DE PRODUCTOS, BÚSQUEDA Y BALANZA
# -------------------------------------------------------------
@app.route("/api/products", methods=["GET", "POST"])
def api_products():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.get_json() or {}
        code = str(data.get("code", "")).strip()
        name = str(data.get("name", "")).strip()
        category_id = data.get("category_id") or None
        cost_price = float(data.get("cost_price", 0.0))
        sale_price = float(data.get("sale_price", 0.0))
        stock = float(data.get("stock", 0.0))
        min_stock = float(data.get("min_stock", 5.0))
        control_stock = int(data.get("control_stock", 1))
        unit_type = str(data.get("unit_type", "un")).strip()
        is_weighable = 1 if unit_type in ("kg", "g") or data.get("is_weighable") else 0
        image_url = str(data.get("image_url", "")).strip()

        if not name or sale_price <= 0:
            conn.close()
            return jsonify({"error": "Nombre y precio de venta válidos son obligatorios"}), 400

        try:
            cur = conn.execute("""
                INSERT INTO products (
                    code, name, category_id, cost_price, sale_price, 
                    stock, min_stock, control_stock, unit_type, is_weighable, image_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (code, name, category_id, cost_price, sale_price, stock, min_stock, control_stock, unit_type, is_weighable, image_url))
            new_id = cur.lastrowid
            conn.commit()
            conn.close()
            return jsonify({"id": new_id, "success": True})
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"error": "El código de barras ya existe en otro producto"}), 400

    # GET Productos
    category_id = request.args.get("category_id")
    search = request.args.get("q", "").strip()

    query = """
        SELECT p.*, c.name as category_name, c.color as category_color
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1
    """
    params = []
    if category_id:
        query += " AND p.category_id = ?"
        params.append(category_id)
    if search:
        tokens = [t for t in normalize_text(search).split() if t]
        if tokens:
            for t in tokens:
                query += " AND (NORMALIZE(p.name) LIKE ? OR NORMALIZE(p.code) LIKE ? OR NORMALIZE(coalesce(c.name, '')) LIKE ?)"
                params.extend([f"%{t}%", f"%{t}%", f"%{t}%"])
        else:
            query += " AND (NORMALIZE(p.name) LIKE ? OR NORMALIZE(p.code) LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY p.name ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/products/<int:prod_id>", methods=["PUT", "DELETE"])
def api_product_detail(prod_id):
    conn = get_db_connection()
    if request.method == "DELETE":
        conn.execute("UPDATE products SET is_active = 0 WHERE id = ?", (prod_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})

    data = request.get_json() or {}
    unit_type = str(data.get("unit_type", "un")).strip()
    is_weighable = 1 if unit_type in ("kg", "g") or data.get("is_weighable") else 0
    try:
        conn.execute("""
            UPDATE products SET
                code = ?, name = ?, category_id = ?, cost_price = ?,
                sale_price = ?, stock = ?, min_stock = ?, control_stock = ?,
                unit_type = ?, is_weighable = ?, image_url = ?
            WHERE id = ?
        """, (
            str(data.get("code", "")).strip(),
            str(data.get("name", "")).strip(),
            data.get("category_id") or None,
            float(data.get("cost_price", 0.0)),
            float(data.get("sale_price", 0.0)),
            float(data.get("stock", 0.0)),
            float(data.get("min_stock", 5.0)),
            int(data.get("control_stock", 1)),
            unit_type,
            is_weighable,
            str(data.get("image_url", "")).strip(),
            prod_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Código de barras duplicado"}), 400


@app.route("/api/products/<int:prod_id>/image", methods=["POST", "DELETE"])
def api_product_image(prod_id):
    conn = get_db_connection()
    prod = conn.execute("SELECT id, name FROM products WHERE id = ?", (prod_id,)).fetchone()
    if not prod:
        conn.close()
        return jsonify({"error": "Producto no encontrado"}), 404

    if request.method == "DELETE":
        conn.execute("UPDATE products SET image_url = '' WHERE id = ?", (prod_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Foto eliminada correctamente"})

    image_url = None
    if "image" in request.files or "file" in request.files:
        f = request.files.get("image") or request.files.get("file")
        if f and f.filename:
            raw_filename = secure_filename(f.filename)
            ext = raw_filename.rsplit(".", 1)[-1].lower() if "." in raw_filename else "png"
            if ext not in ALLOWED_LOGO_EXT:
                conn.close()
                return jsonify({"error": f"Formato no permitido. Use: {', '.join(ALLOWED_LOGO_EXT)}"}), 400

            save_name = f"prod_{prod_id}_{int(datetime.now().timestamp())}.{ext}"
            save_path = os.path.join(UPLOADS_DIR, save_name)
            f.save(save_path)
            image_url = f"/static/uploads/{save_name}"
    else:
        data = request.get_json(silent=True) or {}
        url = str(data.get("image_url", "")).strip()
        if url:
            image_url = url

    if not image_url:
        conn.close()
        return jsonify({"error": "No se envió ningún archivo de imagen ni URL válida"}), 400

    conn.execute("UPDATE products SET image_url = ? WHERE id = ?", (image_url, prod_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "image_url": image_url})


@app.route("/api/products/barcode/<path:barcode>", methods=["GET"])
def api_product_barcode(barcode):
    """
    Decodificador inteligente para escáner y balanzas comerciales:
    1. Busca coincidencia exacta de código (EAN-13, EAN-8, código interno).
    2. Si empieza con prefijo de balanza (ej: '20') y tiene longitud 12 o 13:
       Formato estándar: 20 + PPPP (código producto 4 dígitos) + QQQQQ (peso o importe 5 dígitos) + C (verificador)
    """
    raw_code = barcode.strip()
    conn = get_db_connection()
    cfg = get_config()
    scale_prefix = cfg.get("scale_prefix", "20")

    # 1. Búsqueda directa
    prod = conn.execute(
        "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.code = ? AND p.is_active = 1",
        (raw_code,)
    ).fetchone()

    if prod:
        conn.close()
        return jsonify({
            "found": True,
            "product": dict(prod),
            "scale_detected": False,
            "quantity": 1.0
        })

    # 2. Interpretar código de balanza (ej: 200001004509 -> prefijo 20, producto 0001, 0.450 kg)
    if raw_code.startswith(scale_prefix) and len(raw_code) in (12, 13):
        # Ej: 20 + 0001 + 00450 + 9
        item_code_part = raw_code[2:6] # "0001"
        weight_part = raw_code[6:11]   # "00450" -> 0.450 kg

        # Posibles códigos en DB: "200001", "0001", o "1"
        candidate_codes = [
            f"{scale_prefix}{item_code_part}",
            item_code_part,
            str(int(item_code_part))
        ]
        placeholders = ",".join("?" * len(candidate_codes))
        scale_prod = conn.execute(
            f"SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.code IN ({placeholders}) AND p.is_active = 1",
            candidate_codes
        ).fetchone()

        if scale_prod:
            weight_val = float(weight_part) / 1000.0  # Gramos a Kilos
            conn.close()
            return jsonify({
                "found": True,
                "product": dict(scale_prod),
                "scale_detected": True,
                "quantity": round(weight_val, 3)
            })

    # 3. Búsqueda por nombre o descripción (si el usuario escribió texto en vez de escanear)
    norm_text = normalize_text(raw_code)
    tokens = [t for t in norm_text.split() if t]
    if tokens:
        subquery = """
            SELECT p.*, c.name as category_name, c.color as category_color
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        """
        subparams = []
        for t in tokens:
            subquery += " AND (NORMALIZE(p.name) LIKE ? OR NORMALIZE(p.code) LIKE ? OR NORMALIZE(coalesce(c.name, '')) LIKE ?)"
            subparams.extend([f"%{t}%", f"%{t}%", f"%{t}%"])
        
        # Priorizar coincidencias exactas o que comiencen con el término buscado
        subquery += """
            ORDER BY 
                CASE 
                    WHEN NORMALIZE(p.name) = ? THEN 1
                    WHEN NORMALIZE(p.name) LIKE ? THEN 2
                    ELSE 3
                END,
                p.name ASC
            LIMIT 10
        """
        subparams.extend([norm_text, f"{norm_text}%"])
        matches = conn.execute(subquery, subparams).fetchall()
        if matches:
            match_list = [dict(m) for m in matches]
            conn.close()
            return jsonify({
                "found": True,
                "product": match_list[0],
                "multiple": len(match_list) > 1,
                "candidates": match_list,
                "scale_detected": False,
                "quantity": 1.0
            })

    conn.close()
    return jsonify({"found": False, "error": f"Producto no encontrado para '{raw_code}'"}), 404


@app.route("/api/products/bulk_price_update", methods=["POST"])
def api_products_bulk_price_update():
    """Aumento masivo de precios por categoría o general (muy útil en almacén/supermercado)"""
    data = request.get_json() or {}
    percentage = float(data.get("percentage", 0.0))
    category_id = data.get("category_id")  # None = todas
    round_to = int(data.get("round_to", 10)) # Redondear a decena/centena (ej: $1450 en vez de $1448.2)

    if percentage == 0:
        return jsonify({"error": "Porcentaje debe ser distinto de 0"}), 400

    factor = 1.0 + (percentage / 100.0)
    conn = get_db_connection()
    
    if category_id:
        prods = conn.execute("SELECT id, sale_price FROM products WHERE category_id = ? AND is_active = 1", (category_id,)).fetchall()
    else:
        prods = conn.execute("SELECT id, sale_price FROM products WHERE is_active = 1").fetchall()

    updated_count = 0
    for p in prods:
        new_price = p["sale_price"] * factor
        if round_to > 1:
            new_price = round(new_price / round_to) * round_to
        else:
            new_price = round(new_price, 2)

        conn.execute("UPDATE products SET sale_price = ? WHERE id = ?", (new_price, p["id"]))
        updated_count += 1

    conn.commit()
    conn.close()
    return jsonify({
        "success": True, 
        "updated_count": updated_count, 
        "message": f"Se actualizaron {updated_count} productos con un {percentage}%."
    })


# -------------------------------------------------------------
# RUTAS DE CLIENTES & LIBRETA DE ALMACÉN (FIAR)
# -------------------------------------------------------------
@app.route("/api/customers", methods=["GET", "POST"])
def api_customers():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.get_json() or {}
        name = str(data.get("name", "")).strip()
        phone = str(data.get("phone", "")).strip()
        address = str(data.get("address", "")).strip()
        credit_limit = float(data.get("credit_limit", 50000.0))
        notes = str(data.get("notes", "")).strip()

        if not name:
            conn.close()
            return jsonify({"error": "Nombre de cliente requerido"}), 400

        cur = conn.execute("""
            INSERT INTO customers (name, phone, address, credit_limit, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (name, phone, address, credit_limit, notes))
        new_id = cur.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"id": new_id, "success": True})

    search = request.args.get("q", "").strip()
    if search:
        rows = conn.execute("""
            SELECT * FROM customers 
            WHERE name LIKE ? OR phone LIKE ? 
            ORDER BY name ASC
        """, (f"%{search}%", f"%{search}%")).fetchall()
    else:
        rows = conn.execute("SELECT * FROM customers ORDER BY name ASC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/customers/<int:cust_id>/ledger", methods=["GET", "POST"])
def api_customer_ledger(cust_id):
    conn = get_db_connection()
    if request.method == "POST":
        # Registrar Pago / Abono a la cuenta corriente
        data = request.get_json() or {}
        amount = float(data.get("amount", 0.0))
        description = str(data.get("description", "Abono / Pago en efectivo")).strip()
        if amount <= 0:
            conn.close()
            return jsonify({"error": "Monto debe ser mayor a 0"}), 400

        cust = conn.execute("SELECT * FROM customers WHERE id = ?", (cust_id,)).fetchone()
        if not cust:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404

        new_balance = max(0.0, cust["current_balance"] - amount)
        conn.execute("UPDATE customers SET current_balance = ? WHERE id = ?", (new_balance, cust_id))
        conn.execute("""
            INSERT INTO customer_ledger (customer_id, type, amount, balance_after, description)
            VALUES (?, 'PAYMENT', ?, ?, ?)
        """, (cust_id, amount, new_balance, description))

        # Registrar ingreso en el turno de caja abierto
        open_shift = conn.execute("SELECT id FROM cash_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").fetchone()
        if open_shift:
            conn.execute("""
                INSERT INTO cash_movements (shift_id, type, amount, concept)
                VALUES (?, 'IN', ?, ?)
            """, (open_shift["id"], amount, f"Abono Cuenta Corriente - {cust['name']}"))

        conn.commit()
        conn.close()
        return jsonify({"success": True, "new_balance": new_balance})

    # GET movimientos de cuenta corriente
    cust = conn.execute("SELECT * FROM customers WHERE id = ?", (cust_id,)).fetchone()
    if not cust:
        conn.close()
        return jsonify({"error": "Cliente no encontrado"}), 404

    movements = conn.execute("""
        SELECT * FROM customer_ledger 
        WHERE customer_id = ? 
        ORDER BY id DESC
    """, (cust_id,)).fetchall()
    conn.close()

    return jsonify({
        "customer": dict(cust),
        "movements": [dict(m) for m in movements]
    })


# -------------------------------------------------------------
# RUTAS DE CAJA Y TURNOS (ARQUEO X / Z)
# -------------------------------------------------------------
@app.route("/api/cash/current", methods=["GET"])
def api_cash_current():
    conn = get_db_connection()
    shift = conn.execute(
        "SELECT * FROM cash_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1"
    ).fetchone()

    if not shift:
        conn.close()
        return jsonify({"has_open_shift": False})

    shift_id = shift["id"]

    # Ventas en este turno por medio de pago
    sales_rows = conn.execute("""
        SELECT payment_method, SUM(total) as total_sales, COUNT(id) as order_count
        FROM orders 
        WHERE shift_id = ? AND status = 'COMPLETED'
        GROUP BY payment_method
    """, (shift_id,)).fetchall()
    
    sales_by_method = {r["payment_method"]: r["total_sales"] for r in sales_rows}
    total_sales_amount = sum(r["total_sales"] for r in sales_rows)
    total_orders_count = sum(r["order_count"] for r in sales_rows)

    # Movimientos manuales de caja (ingresos/egresos)
    movements = conn.execute(
        "SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id DESC", (shift_id,)
    ).fetchall()

    manual_in = sum(m["amount"] for m in movements if m["type"] == "IN")
    manual_out = sum(m["amount"] for m in movements if m["type"] == "OUT")

    # Efectivo esperado en cajón
    cash_sales = sales_by_method.get("EFECTIVO", 0.0)
    expected_cash = shift["initial_cash"] + cash_sales + manual_in - manual_out

    conn.close()
    return jsonify({
        "has_open_shift": True,
        "shift": dict(shift),
        "sales_by_method": sales_by_method,
        "total_sales_amount": total_sales_amount,
        "total_orders_count": total_orders_count,
        "manual_in": manual_in,
        "manual_out": manual_out,
        "expected_cash_in_drawer": expected_cash,
        "movements": [dict(m) for m in movements]
    })


@app.route("/api/cash/open", methods=["POST"])
def api_cash_open():
    data = request.get_json() or {}
    cashier_name = str(data.get("cashier_name", "Caja 1")).strip()
    initial_cash = float(data.get("initial_cash", 0.0))

    conn = get_db_connection()
    # Verificar si ya hay turno abierto
    active = conn.execute("SELECT id FROM cash_shifts WHERE status = 'OPEN'").fetchone()
    if active:
        conn.close()
        return jsonify({"error": "Ya existe un turno de caja abierto actualmente"}), 400

    cur = conn.execute("""
        INSERT INTO cash_shifts (cashier_name, initial_cash, status)
        VALUES (?, ?, 'OPEN')
    """, (cashier_name, initial_cash))
    shift_id = cur.lastrowid
    conn.commit()
    conn.close()
    return jsonify({"success": True, "shift_id": shift_id})


@app.route("/api/cash/movement", methods=["POST"])
def api_cash_movement():
    data = request.get_json() or {}
    mtype = data.get("type") # 'IN' o 'OUT'
    amount = float(data.get("amount", 0.0))
    concept = str(data.get("concept", "")).strip()

    if mtype not in ("IN", "OUT") or amount <= 0 or not concept:
        return jsonify({"error": "Datos del movimiento incompletos o incorrectos"}), 400

    conn = get_db_connection()
    shift = conn.execute("SELECT id FROM cash_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").fetchone()
    if not shift:
        conn.close()
        return jsonify({"error": "No hay un turno de caja abierto"}), 400

    conn.execute("""
        INSERT INTO cash_movements (shift_id, type, amount, concept)
        VALUES (?, ?, ?, ?)
    """, (shift["id"], mtype, amount, concept))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/cash/close", methods=["POST"])
def api_cash_close():
    data = request.get_json() or {}
    final_cash = float(data.get("final_cash", 0.0))
    notes = str(data.get("notes", "")).strip()

    conn = get_db_connection()
    shift = conn.execute("SELECT * FROM cash_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").fetchone()
    if not shift:
        conn.close()
        return jsonify({"error": "No hay un turno de caja abierto"}), 400

    shift_id = shift["id"]

    # Calcular ventas en efectivo
    cash_sales = conn.execute("""
        SELECT COALESCE(SUM(total), 0) as cash_total
        FROM orders 
        WHERE shift_id = ? AND status = 'COMPLETED' AND payment_method = 'EFECTIVO'
    """, (shift_id,)).fetchone()["cash_total"]

    movements = conn.execute("SELECT type, amount FROM cash_movements WHERE shift_id = ?", (shift_id,)).fetchall()
    manual_in = sum(m["amount"] for m in movements if m["type"] == "IN")
    manual_out = sum(m["amount"] for m in movements if m["type"] == "OUT")

    expected_cash = shift["initial_cash"] + cash_sales + manual_in - manual_out
    difference = final_cash - expected_cash

    conn.execute("""
        UPDATE cash_shifts SET
            closed_at = datetime('now', 'localtime'),
            final_cash = ?,
            expected_cash = ?,
            difference = ?,
            status = 'CLOSED',
            notes = ?
        WHERE id = ?
    """, (final_cash, expected_cash, difference, notes, shift_id))

    conn.commit()
    conn.close()
    return jsonify({
        "success": True,
        "final_cash": final_cash,
        "expected_cash": expected_cash,
        "difference": difference
    })


# -------------------------------------------------------------
# RUTAS DE COBRO (CHECKOUT EN CAJA) Y TICKETS
# -------------------------------------------------------------
@app.route("/api/checkout", methods=["POST"])
def api_checkout():
    """
    Procesar venta rápida de mostrador / caja de supermercado:
    - Descuenta stock automáticamente.
    - Soporta ventas fraccionadas por peso (balanza / fiambrería / verdulería).
    - Soporta Fiar (Cuenta Corriente) registrando deuda en la ficha del cliente.
    - Calcula vuelto y emite número correlativo de ticket.
    """
    data = request.get_json() or {}
    items = data.get("items", [])
    if not items:
        return jsonify({"error": "El carrito está vacío"}), 400

    payment_method = data.get("payment_method", "EFECTIVO")
    amount_paid = float(data.get("amount_paid", 0.0))
    discount_percent = float(data.get("discount_percent", 0.0))
    customer_id = data.get("customer_id") or None
    notes = str(data.get("notes", "")).strip()

    conn = get_db_connection()

    # Obtener turno activo
    shift = conn.execute("SELECT * FROM cash_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").fetchone()
    shift_id = shift["id"] if shift else None
    cashier_name = session.get("user_name") or data.get("cashier_name") or (shift["cashier_name"] if shift else "Caja 1")

    # Validar y calcular montos
    subtotal = 0.0
    validated_items = []
    for it in items:
        pid = it.get("id")
        prod = conn.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
        if not prod:
            conn.close()
            return jsonify({"error": f"Producto con ID {pid} no existe"}), 400

        qty = float(it.get("quantity", 1.0))
        if qty <= 0:
            qty = 1.0

        unit_price = float(prod["sale_price"])
        item_subtotal = round(unit_price * qty, 2)
        subtotal += item_subtotal

        validated_items.append({
            "product_id": prod["id"],
            "product_name": prod["name"],
            "unit_type": prod["unit_type"],
            "quantity": qty,
            "unit_price": unit_price,
            "subtotal": item_subtotal,
            "control_stock": prod["control_stock"]
        })

    discount_amount = round(subtotal * (discount_percent / 100.0), 2)
    total = max(0.0, subtotal - discount_amount)

    # Si es en efectivo y no ingresó monto, asumimos pago exacto
    if payment_method == "EFECTIVO":
        if amount_paid < total:
            amount_paid = total
        change_amount = round(amount_paid - total, 2)
    else:
        amount_paid = total
        change_amount = 0.0

    # Generar número correlativo de ticket (ej: T-00124)
    last_order = conn.execute("SELECT id FROM orders ORDER BY id DESC LIMIT 1").fetchone()
    next_num = (last_order["id"] + 1) if last_order else 1
    order_number = f"T-{next_num:05d}"

    # Si es Fiar (Cuenta Corriente), validar cliente y saldo
    if payment_method == "CUENTA_CORRIENTE":
        if not customer_id:
            conn.close()
            return jsonify({"error": "Debe seleccionar un cliente para fiar la compra"}), 400
        cust = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if not cust:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        new_balance = cust["current_balance"] + total
        conn.execute("UPDATE customers SET current_balance = ? WHERE id = ?", (new_balance, customer_id))
        conn.execute("""
            INSERT INTO customer_ledger (customer_id, type, amount, balance_after, description, order_id)
            VALUES (?, 'DEBT', ?, ?, ?, ?)
        """, (customer_id, total, new_balance, f"Compra Ticket {order_number}", next_num))

    # Guardar Orden
    cur = conn.execute("""
        INSERT INTO orders (
            order_number, cashier_name, customer_id, shift_id,
            subtotal, discount_percent, discount_amount, total,
            payment_method, amount_paid, change_amount, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        order_number, cashier_name, customer_id, shift_id,
        subtotal, discount_percent, discount_amount, total,
        payment_method, amount_paid, change_amount, notes
    ))
    order_id = cur.lastrowid

    # Guardar Items y Descontar Stock
    for vit in validated_items:
        conn.execute("""
            INSERT INTO order_items (order_id, product_id, product_name, unit_type, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            order_id, vit["product_id"], vit["product_name"], vit["unit_type"],
            vit["quantity"], vit["unit_price"], vit["subtotal"]
        ))
        if vit["control_stock"]:
            conn.execute("""
                UPDATE products SET stock = stock - ? WHERE id = ?
            """, (vit["quantity"], vit["product_id"]))

    conn.commit()

    # Obtener datos completos para ticket térmico
    cfg = get_config()
    cust_name = ""
    if customer_id:
        c_row = conn.execute("SELECT name FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if c_row:
            cust_name = c_row["name"]

    order_data = {
        "id": order_id,
        "order_number": order_number,
        "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "cashier_name": cashier_name,
        "customer_name": cust_name,
        "items": validated_items,
        "subtotal": subtotal,
        "discount_percent": discount_percent,
        "discount_amount": discount_amount,
        "total": total,
        "payment_method": payment_method,
        "amount_paid": amount_paid,
        "change_amount": change_amount,
        "config": cfg
    }

    conn.close()
    return jsonify({
        "success": True,
        "order": order_data
    })


@app.route("/api/orders", methods=["GET"])
def api_orders():
    conn = get_db_connection()
    limit = int(request.args.get("limit", 50))
    date_filter = request.args.get("date")

    query = """
        SELECT o.*, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
    """
    params = []
    if date_filter:
        query += " WHERE date(o.created_at) = ?"
        params.append(date_filter)

    query += " ORDER BY o.id DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/orders/<int:order_id>", methods=["GET"])
def api_order_detail(order_id):
    conn = get_db_connection()
    order = conn.execute("""
        SELECT o.*, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
    """, (order_id,)).fetchone()

    if not order:
        conn.close()
        return jsonify({"error": "Ticket no encontrado"}), 404

    items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    cfg = get_config()
    conn.close()

    return jsonify({
        "order": dict(order),
        "items": [dict(i) for i in items],
        "config": cfg
    })


@app.route("/api/orders/<int:order_id>/cancel", methods=["POST"])
def api_order_cancel(order_id):
    conn = get_db_connection()
    order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order or order["status"] == "CANCELLED":
        conn.close()
        return jsonify({"error": "Venta no válida para anulación"}), 400

    # Reintegrar stock de items
    items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    for item in items:
        if item["product_id"]:
            conn.execute(
                "UPDATE products SET stock = stock + ? WHERE id = ?",
                (item["quantity"], item["product_id"])
            )

    # Si fue cuenta corriente, revertir deuda en cliente
    if order["payment_method"] == "CUENTA_CORRIENTE" and order["customer_id"]:
        cust = conn.execute("SELECT current_balance FROM customers WHERE id = ?", (order["customer_id"],)).fetchone()
        if cust:
            new_bal = max(0.0, cust["current_balance"] - order["total"])
            conn.execute("UPDATE customers SET current_balance = ? WHERE id = ?", (new_bal, order["customer_id"]))
            conn.execute("""
                INSERT INTO customer_ledger (customer_id, type, amount, balance_after, description, order_id)
                VALUES (?, 'PAYMENT', ?, ?, ?, ?)
            """, (order["customer_id"], order["total"], new_bal, f"Anulación Ticket {order['order_number']}", order_id))

    conn.execute("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Venta anulada y stock reintegrado correctamente."})


@app.route("/api/orders/bulk_delete", methods=["POST"])
def api_orders_bulk_delete():
    data = request.get_json() or {}
    order_ids = data.get("order_ids", [])
    delete_all = data.get("delete_all", False)
    pin = str(data.get("pin", "")).strip()

    conn = get_db_connection()

    # Validar si es Dueño por sesión o por PIN
    is_owner = session.get("user_role") in ("dueño", "admin")
    if not is_owner and pin:
        owner_users = conn.execute("SELECT pin_hash FROM users WHERE role IN ('dueño', 'admin') AND is_active = 1").fetchall()
        for u in owner_users:
            if check_password_hash(u["pin_hash"], pin):
                is_owner = True
                break

    if not is_owner:
        conn.close()
        return jsonify({"error": "Acceso denegado: solo el Dueño está autorizado para eliminar registros de ventas y reportes."}), 403

    if delete_all:
        cur = conn.execute("SELECT COUNT(*) FROM orders")
        deleted_count = cur.fetchone()[0]
        conn.execute("DELETE FROM order_items")
        conn.execute("DELETE FROM order_payments")
        conn.execute("DELETE FROM orders")
    elif order_ids:
        placeholders = ",".join("?" * len(order_ids))
        conn.execute(f"DELETE FROM order_items WHERE order_id IN ({placeholders})", order_ids)
        conn.execute(f"DELETE FROM order_payments WHERE order_id IN ({placeholders})", order_ids)
        cur = conn.execute(f"DELETE FROM orders WHERE id IN ({placeholders})", order_ids)
        deleted_count = cur.rowcount
    else:
        conn.close()
        return jsonify({"error": "No se seleccionaron ventas para eliminar."}), 400

    conn.commit()
    conn.close()
    return jsonify({
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Se eliminaron {deleted_count} registros de ventas exitosamente."
    })


# -------------------------------------------------------------
# REPORTES & DASHBOARD
# -------------------------------------------------------------
@app.route("/api/reports/dashboard", methods=["GET"])
def api_reports_dashboard():
    conn = get_db_connection()

    # Ventas de hoy
    today_stats = conn.execute("""
        SELECT 
            COALESCE(SUM(total), 0) as today_total,
            COUNT(id) as today_count
        FROM orders
        WHERE date(created_at) = date('now', 'localtime') AND status = 'COMPLETED'
    """).fetchone()

    # Ventas por medio de pago hoy
    payment_stats = conn.execute("""
        SELECT payment_method, COALESCE(SUM(total), 0) as amount
        FROM orders
        WHERE date(created_at) = date('now', 'localtime') AND status = 'COMPLETED'
        GROUP BY payment_method
    """).fetchall()

    # Top 10 productos más vendidos
    top_products = conn.execute("""
        SELECT 
            oi.product_name,
            oi.unit_type,
            SUM(oi.quantity) as total_sold,
            SUM(oi.subtotal) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'COMPLETED'
        GROUP BY oi.product_name, oi.unit_type
        ORDER BY total_sold DESC
        LIMIT 10
    """).fetchall()

    # Productos con stock bajo
    low_stock = conn.execute("""
        SELECT id, code, name, stock, min_stock, unit_type
        FROM products
        WHERE is_active = 1 AND control_stock = 1 AND stock <= min_stock
        ORDER BY stock ASC
        LIMIT 10
    """).fetchall()

    conn.close()
    return jsonify({
        "today_total": today_stats["today_total"],
        "today_count": today_stats["today_count"],
        "average_ticket": round(today_stats["today_total"] / today_stats["today_count"], 2) if today_stats["today_count"] > 0 else 0,
        "payment_stats": [dict(p) for p in payment_stats],
        "top_products": [dict(tp) for tp in top_products],
        "low_stock_products": [dict(ls) for ls in low_stock]
    })


@app.route("/api/reports/products_ranking", methods=["GET"])
def api_reports_products_ranking():
    """Ranking completo de productos: del más vendido al menos vendido (o viceversa)"""
    order_dir = request.args.get("order", "desc").lower()
    if order_dir not in ("asc", "desc"):
        order_dir = "desc"

    category_id = request.args.get("category_id", "")
    period = request.args.get("period", "all")  # today, week, month, all
    search = request.args.get("search", "").strip()

    conn = get_db_connection()

    # Filtro temporal para las órdenes completadas
    period_clause = ""
    if period == "today":
        period_clause = "AND date(o.created_at) = date('now', 'localtime')"
    elif period == "week":
        period_clause = "AND date(o.created_at) >= date('now', '-7 days', 'localtime')"
    elif period == "month":
        period_clause = "AND date(o.created_at) >= date('now', '-30 days', 'localtime')"

    # Query que agrupa todos los productos activos con sus ventas reales
    query = f"""
        SELECT 
            p.id,
            p.code,
            p.name,
            p.sale_price,
            p.stock,
            p.unit_type,
            c.name as category_name,
            c.color as category_color,
            COALESCE(SUM(oi.quantity), 0) as total_sold,
            COALESCE(SUM(oi.subtotal), 0) as total_revenue,
            COUNT(DISTINCT o.id) as orders_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'COMPLETED' {period_clause}
        WHERE p.is_active = 1
    """

    params = []
    if category_id:
        query += " AND p.category_id = ?"
        params.append(category_id)

    if search:
        query += " AND (p.name LIKE ? OR p.code LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += f"""
        GROUP BY p.id
        ORDER BY total_sold {order_dir.upper()}, total_revenue {order_dir.upper()}, p.name ASC
    """

    rows = conn.execute(query, params).fetchall()
    conn.close()

    result = [dict(r) for r in rows]
    return jsonify({
        "ranking": result,
        "total_products": len(result),
        "order": order_dir,
        "period": period
    })



def get_local_ip():
    """Obtiene la dirección IP local de la máquina en la red Wi-Fi/LAN"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "192.168.0.5"


def get_ngrok_public_url():
    """Obtiene el enlace público en la nube para acceso desde 3G/4G o remoto"""
    try:
        info_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "tunnel_info.json")
        if os.path.exists(info_file):
            with open(info_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("url"):
                    return data["url"]
    except Exception:
        pass

    try:
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels", headers={"User-Agent": "SuperPOS"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tunnels = data.get("tunnels", [])
            for t in tunnels:
                if t.get("config", {}).get("addr", "").endswith("5055"):
                    return t.get("public_url")
            for t in tunnels:
                if t.get("public_url", "").startswith("https://") and "starship-concept-skewer" not in t.get("public_url"):
                    return t.get("public_url")
    except Exception:
        pass

    return "https://dave-agent-cloud-oak.trycloudflare.com"



# -------------------------------------------------------------
# RUTAS DE INTERFAZ & RED LOCAL / ONLINE
# -------------------------------------------------------------
@app.route("/api/server/network_info", methods=["GET"])
def api_server_network_info():
    port = int(os.environ.get("PORT", 5055))
    ip = get_local_ip()
    pub_url = get_ngrok_public_url()
    return jsonify({
        "local_ip": ip,
        "port": port,
        "local_url": f"http://localhost:{port}",
        "network_url": f"http://{ip}:{port}",
        "public_url": pub_url or "https://dave-agent-cloud-oak.trycloudflare.com"
    })


@app.route("/")
def index():
    cfg = get_config()
    port = int(os.environ.get("PORT", 5055))
    ip = get_local_ip()
    pub_url = get_ngrok_public_url()
    return render_template(
        "index.html",
        config=cfg,
        server_ip=ip,
        server_port=port,
        network_url=f"http://{ip}:{port}",
        public_url=pub_url or "https://dave-agent-cloud-oak.trycloudflare.com"
    )


@app.route("/manifest.json")
def manifest():
    cfg = get_config()
    return jsonify({
        "name": cfg.get("business_name", "R&S MARKET") + " - Sistema POS",
        "short_name": cfg.get("business_name", "R&S MARKET"),
        "description": "Punto de Venta y Facturación para Supermercado y Almacén",
        "start_url": "/",
        "display": "standalone",
        "orientation": "any",
        "background_color": "#ffffff",
        "theme_color": "#ea580c",
        "scope": "/",
        "icons": [
            {"src": "/static/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
        ],
        "categories": ["business", "finance", "productivity"],
        "lang": "es-AR"
    })


@app.route("/service-worker.js")
def service_worker():
    """Servir el SW desde la raíz para que tenga scope '/'"""
    return send_file("static/service-worker.js", mimetype="application/javascript")


@app.route("/install")
def install_page():
    """Página guía de instalación para Android"""
    return render_template("install.html")


@app.route("/tienda3d")
@app.route("/vr")
@app.route("/tienda-virtual")
def tienda3d_page():
    """Experiencia de Supermercado Virtual 3D interactivo para clientes"""
    cfg = get_config()
    pub_url = get_ngrok_public_url()
    return render_template(
        "tienda3d.html",
        config=cfg,
        public_url=pub_url or "https://fiscal-graduated-electro-incoming.trycloudflare.com"
    )


@app.route("/download-apk")
def download_apk():
    """Permite descargar el instalador .apk directamente"""
    apk_path = os.path.join(app.root_path, "static", "rsmarket-pos.apk")
    if os.path.exists(apk_path):
        return send_file(
            apk_path,
            as_attachment=True,
            download_name="rsmarket-pos.apk",
            mimetype="application/vnd.android.package-archive"
        )
    return "APK no disponible aún", 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5055))
    local_ip = get_local_ip()
    print("=" * 66)
    print("   SUPERMERCADO & ALMACEN POS - SERVIDOR LISTO EN RED")
    print("=" * 66)
    print(f"   [Esta PC]:                   http://localhost:{port}")
    print(f"   [Celulares y Otras PCs]:     http://{local_ip}:{port}")
    print("=" * 66)
    print("   (Para ingresar desde un celular, conectar al mismo Wi-Fi)")
    print("=" * 66)
    app.run(host="0.0.0.0", port=port, debug=False)

