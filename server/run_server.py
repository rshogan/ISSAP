"""Zero-dependency static file server for the ISSAP practice test.

Serves the project root so the web app can fetch() its JSON data (blocked
under file:// by CORS). Stdlib only, no installs required.
"""
import os
import sys
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = "127.0.0.1"
# Fixed, never auto-incremented: localStorage is scoped to scheme+host+port,
# so every port is a separate, empty set of save slots. Drifting to 8421 when
# 8420 was busy is exactly how saves used to "disappear".
PORT = 8420
URL = f"http://{HOST}:{PORT}/web/"


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


class Server(ThreadingHTTPServer):
    # On Windows SO_REUSEADDR lets a second process bind a port that is already
    # being served, so the old server keeps answering and this one is silently
    # ignored. POSIX only uses it to skip TIME_WAIT, which is harmless.
    allow_reuse_address = os.name != "nt"


def already_serving():
    """True if the thing on PORT is a previous run of this server."""
    try:
        with urllib.request.urlopen(URL, timeout=2) as resp:
            return b"<title>ISSAP Cyber Redemption</title>" in resp.read(4096)
    except OSError:
        return False


def main():
    try:
        server = Server((HOST, PORT), Handler)
    except OSError:
        if already_serving():
            print(f"The ISSAP server is already running. Opening {URL}")
            webbrowser.open(URL)
            return
        print(f"Port {PORT} is in use by another program.")
        print("Close it and try again -- a different port would not see your saved games.")
        sys.exit(1)
    print("ISSAP Practice Test server")
    print(f"Serving {ROOT}")
    print(f"Open your browser to: {URL}")
    print("Press Ctrl+C to stop.")
    webbrowser.open(URL)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        server.shutdown()


if __name__ == "__main__":
    main()
