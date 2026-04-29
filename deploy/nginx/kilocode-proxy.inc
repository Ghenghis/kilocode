# =============================================================================
# Shared proxy location blocks (included by both HTTP and HTTPS server blocks)
# =============================================================================

    # Logging
    access_log /var/log/nginx/kilocode_access.log;
    error_log  /var/log/nginx/kilocode_error.log warn;

    # Common proxy headers
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;

    # WebSocket support (needed by Open WebUI / Gradio)
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Timeouts
    proxy_read_timeout    300s;
    proxy_connect_timeout  10s;
    proxy_send_timeout    300s;

    # ---------------------------------------------------------------------------
    # /api/  →  KiloCode Runtime API (port 8080)
    # ---------------------------------------------------------------------------
    location /api/ {
        limit_req zone=api_limit burst=60 nodelay;
        proxy_pass http://kilocode_runtime/;
        proxy_buffering off;
    }

    # ---------------------------------------------------------------------------
    # /hermes/  →  Hermes Orchestrator (port 8090)
    # ---------------------------------------------------------------------------
    location /hermes/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://kilocode_hermes/;
        proxy_buffering off;
    }

    # ---------------------------------------------------------------------------
    # /  →  WebUI Control Center (port 7860, Open WebUI convention)
    # ---------------------------------------------------------------------------
    location / {
        proxy_pass http://kilocode_webui/;
        # Large body for file uploads
        client_max_body_size 100M;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        proxy_pass http://kilocode_webui;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options       "SAMEORIGIN"   always;
    add_header X-Content-Type-Options "nosniff"     always;
    add_header X-XSS-Protection      "1; mode=block" always;
    add_header Referrer-Policy       "strict-origin-when-cross-origin" always;
