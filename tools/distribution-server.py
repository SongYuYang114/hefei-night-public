"""Read-only HTTPS mirror. Runtime paths and TLS material come from arguments."""
import argparse
import functools
import http.server
import re
import ssl
from pathlib import Path

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        relative = self.path.split('?', 1)[0].lstrip('/')
        if not re.fullmatch(r'(latest\.json|\d+\.\d+\.\d+/(latest\.json|HefeiNight-\d+\.\d+\.\d+-win-x64\.exe|SHA256SUMS))', relative):
            self.send_error(404)
            return
        target = (Path(self.directory) / relative).resolve()
        if not target.is_relative_to(Path(self.directory).resolve()):
            self.send_error(403)
            return
        super().do_GET()

    def do_HEAD(self):
        self.send_error(405)

    def list_directory(self, path):
        self.send_error(404)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache' if self.path.endswith('latest.json') else 'public, max-age=31536000, immutable')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--cert', required=True)
    parser.add_argument('--key', required=True)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8444)
    args = parser.parse_args()
    root = Path(args.root).resolve(strict=True)
    server = http.server.ThreadingHTTPServer((args.host, args.port), functools.partial(Handler, directory=str(root)))
    server.daemon_threads = True
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(args.cert, args.key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
