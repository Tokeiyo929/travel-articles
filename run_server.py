#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""山河手帖本地预览服务器: python run_server.py [端口]"""
import http.server
import socketserver
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".md": "text/markdown; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
        print(f"山河手帖预览: http://localhost:{PORT}  (Ctrl+C 停止)")
        httpd.serve_forever()
