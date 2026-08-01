#!/usr/bin/env python3
"""Static dev server for the Wrabble web app.

Identical to `python3 -m http.server` except it forbids caching. Browsers hold
ES modules in memory aggressively, so plain http.server hands you a stale
js/*.js after an edit and you end up debugging code that isn't running.

    python3 serve.py [port]      # default 5173
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):  # quieter: errors only
        if not args or not str(args[0]).startswith(('GET', 'HEAD')) or ' 200 ' not in ' '.join(map(str, args)):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'Wrabble web app on http://localhost:{port}  (no-cache)')
    ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
