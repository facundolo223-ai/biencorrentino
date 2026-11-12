import subprocess
import os
import sys
import time
import json
import re
import urllib.request

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
INFO_PATH = os.path.join(STATIC_DIR, 'tunnel_info.json')
PORT = 5055

CLOUDFLARED_BIN = os.path.join(BASE_DIR, "cloudflared.exe")
if not os.path.exists(CLOUDFLARED_BIN):
    alt_paths = [
        r"C:\Program Files (x86)\cloudflared\cloudflared.exe",
        r"C:\Program Files\cloudflared\cloudflared.exe",
        "cloudflared"
    ]
    for p in alt_paths:
        if os.path.exists(p) or p == "cloudflared":
            CLOUDFLARED_BIN = p
            break

def write_info(url=None, status='connecting'):
    os.makedirs(STATIC_DIR, exist_ok=True)
    with open(INFO_PATH, 'w', encoding='utf-8') as f:
        json.dump({
            'status': status,
            'url': url,
            'updated_at': time.strftime('%Y-%m-%d %H:%M:%S')
        }, f, indent=2)

def run_tunnel():
    print('\n' + '='*64)
    print(' [ONLINE] SUPERMERCADO POS - TUNEL RAPIDO 100% GRATIS')
    print('='*64)
    print(f' Puerto local: {PORT}')
    print(f' Binario: {CLOUDFLARED_BIN}')

    write_info(status='connecting')

    while True:
        try:
            # Iniciar cloudflared quick tunnel 100% gratuito (sin tarjeta/cuenta)
            cmd = [CLOUDFLARED_BIN, "tunnel", "--url", f"http://127.0.0.1:{PORT}"]
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                bufsize=1
            )

            current_url = None
            url_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

            for line in iter(proc.stdout.readline, ''):
                if not line:
                    break
                
                # Buscar enlace en la salida
                match = url_pattern.search(line)
                if match:
                    current_url = match.group(0)
                    write_info(url=current_url, status='online')
                    print('\n' + '*'*64)
                    print(' [OK] ¡NUEVO ENLACE ONLINE INDEPENDIENTE PARA TU SUPERMERCADO!')
                    print(f'    {current_url}')
                    print('*'*64 + '\n')

            proc.wait()
            print("[WARN] El túnel se desconectó. Reconectando en 3 segundos...")
            time.sleep(3)
        except Exception as e:
            print(f"[ERROR] Error en túnel: {e}")
            time.sleep(5)

if __name__ == '__main__':
    run_tunnel()

