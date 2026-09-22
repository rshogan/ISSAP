"""Zero-dependency static file server for the ISSAP practice test.

Serves the project root so the web app can fetch() its JSON data (blocked
under file:// by CORS). Stdlib only, no installs required.
"""
import socket
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = "127.0.0.1"
PREFERRED_PORT = 8420


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # This is a local single-user dev/practice tool -- always serve fresh
        # content rather than deal with cache invalidation.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        pass


def find_open_port(host, start_port, attempts=20):
    port = start_port
    for _ in range(attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                port += 1
    raise RuntimeError(f"Could not find an open port after {attempts} attempts starting at {start_port}")


def main():
    port = find_open_port(HOST, PREFERRED_PORT)
    url = f"http://{HOST}:{port}/web/"
    server = ThreadingHTTPServer((HOST, port), Handler)
    print("ISSAP Practice Test server")
    print(f"Serving {ROOT}")
    print(f"Open your browser to: {url}")
    print("Press Ctrl+C to stop.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        server.shutdown()


if __name__ == "__main__":
    main()
