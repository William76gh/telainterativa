import os
import socket
from collections import Counter, deque

from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "escola")

# Default: Windows -> threading (mais estável), outros -> eventlet
_async = (os.environ.get("ASYNC_MODE") or "").strip().lower()
if not _async:
    _async = "threading" if os.name == "nt" else "eventlet"

# Se pedirem eventlet mas não estiver ok, cai pra threading
if _async == "eventlet":
    try:
        import eventlet  # noqa: F401
    except Exception:
        _async = "threading"

socketio = SocketIO(app, cors_allowed_origins="*", async_mode=_async)


# -------------------- stats (memória) --------------------
# Simples e efetivo pra entrada do colégio: contador + ranking em RAM.
_stats_total = 0
_stats_names = Counter()
_recent = deque(maxlen=8)


def _get_local_ip_fallback() -> str:
    """Tenta descobrir o IP local (LAN) pra montar um QR que funcione no celular."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # não precisa realmente enviar; só força escolha da interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _public_base_url() -> str:
    """URL pública usada no QR.

    Preferência:
    1) env PUBLIC_URL (ex: http://192.168.0.20:5001)
    2) host_url da request, mas trocando localhost/127.0.0.1 por IP local
    """
    env_url = (os.environ.get("PUBLIC_URL") or "").strip()
    if env_url:
        return env_url.rstrip("/")

    # request.host_url vem tipo http://localhost:5001/
    base = (request.host_url or "").rstrip("/")
    if "localhost" in base or "127.0.0.1" in base:
        ip = _get_local_ip_fallback()
        # preserva a porta se existir
        # request.host inclui host:porta
        host = request.host
        port = ""
        if ":" in host:
            port = host.split(":", 1)[1]
        base = f"{request.scheme}://{ip}{(':' + port) if port else ''}"
    return base


def _snapshot_stats():
    top = _stats_names.most_common(5)
    return {
        "total": _stats_total,
        "top": [{"nome": n, "qtd": q} for n, q in top],
        "recent": list(_recent),
    }


@app.route("/")
def celular():
    return render_template("celular.html")


@app.route("/lousa")
def lousa():
    return render_template("lousa.html", public_url=_public_base_url())


@app.route("/stats")
def stats():
    return jsonify(_snapshot_stats())


@app.route("/admin/reset")
def admin_reset():
    """Reset rápido (pra começar o dia do zero).

    Use: /admin/reset?token=SEU_TOKEN
    Configure ADMIN_TOKEN no .env/variável.
    """
    token = (request.args.get("token") or "").strip()
    expected = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not expected or token != expected:
        return "Acesso negado", 403

    global _stats_total, _stats_names, _recent
    _stats_total = 0
    _stats_names = Counter()
    _recent = deque(maxlen=8)
    socketio.emit("stats_update", _snapshot_stats(), broadcast=True)
    return "OK"


@socketio.on("connect")
def on_connect():
    # envia stats pro cliente que acabou de conectar
    emit("stats_update", _snapshot_stats())


@socketio.on("novo_responsavel")
def novo_responsavel(data):
    # data: { nome: "..." }
    nome = (data or {}).get("nome", "").strip()
    if not nome:
        return

    global _stats_total
    _stats_total += 1
    _stats_names[nome] += 1
    _recent.appendleft(nome)

    emit("atualizar_lousa", {"nome": nome}, broadcast=True)
    emit("stats_update", _snapshot_stats(), broadcast=True)


if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "5001"))

    print("\n=== Tela Interativa Resgate ===")
    print(f"Async mode: {_async}")
    print(f"Rodando em: http://{host}:{port}/ (celular)")
    print(f"Lousa:      http://{host}:{port}/lousa\n")

    socketio.run(app, host=host, port=port, debug=False, use_reloader=False)
