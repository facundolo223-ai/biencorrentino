"""
R&S MARKET POS - Service Watchdog & Auto-Start Manager
Mantiene app.py (Flask 5055) y tunnel.py (Cloudflare) corriendo de forma continua
en segundo plano sin ventanas molestas. Si alguno se cae o se cierra, lo reinicia solo.
"""

import os
import sys
import time
import subprocess
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_EXE = os.path.join(r"C:\Users\facun\.gemini\antigravity\scratch\posberry-custom\.venv\Scripts", "python.exe")
if not os.path.exists(PYTHON_EXE):
    PYTHON_EXE = sys.executable

APP_SCRIPT = os.path.join(BASE_DIR, "app.py")
TUNNEL_SCRIPT = os.path.join(BASE_DIR, "tunnel.py")
PORT = 5055

def is_port_responding(port=5055, timeout=2):
    """Verifica si el servidor Flask en el puerto 5055 responde HTTP."""
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/")
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status == 200
    except Exception:
        return False

def main():
    os.chdir(BASE_DIR)
    app_proc = None
    tunnel_proc = None

    # Opciones de creación para proceso completamente oculto en Windows
    creationflags = 0
    if os.name == 'nt':
        # CREATE_NO_WINDOW = 0x08000000
        creationflags = 0x08000000

    while True:
        try:
            # 1. Monitorear y levantar Servidor Flask (app.py)
            if not is_port_responding(PORT):
                if app_proc is not None and app_proc.poll() is None:
                    # El proceso existe pero no responde aún, darle unos segundos
                    pass
                else:
                    # Iniciar app.py silencioso
                    app_proc = subprocess.Popen(
                        [PYTHON_EXE, APP_SCRIPT],
                        cwd=BASE_DIR,
                        creationflags=creationflags,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                    time.sleep(3)

            # 2. Monitorear y levantar Túnel (tunnel.py)
            if tunnel_proc is None or tunnel_proc.poll() is not None:
                tunnel_proc = subprocess.Popen(
                    [PYTHON_EXE, TUNNEL_SCRIPT],
                    cwd=BASE_DIR,
                    creationflags=creationflags,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

        except Exception as e:
            pass

        # Chequeo cada 10 segundos
        time.sleep(10)

if __name__ == "__main__":
    main()
