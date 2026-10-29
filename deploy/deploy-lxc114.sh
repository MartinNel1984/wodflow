#!/bin/bash
# Deploys Wodflow (wodflow.co.za + rumbleinrandburg.co.za) to LXC 114 on Optimus. Idempotent: run again to update.
# Prints no secrets. Run from the Mac:   bash ~/wodflow/deploy/deploy-lxc114.sh
# First run copies the env from .env.selfhost; later runs keep the server's own /opt/wodflow/.env.production.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=homeserver; CT=114; APP=/opt/wodflow

ssh "$HOST" "pct status $CT" | grep -q running
if ! ssh "$HOST" "pct exec $CT -- test -f $APP/.env.production"; then
  echo "==> Creating $APP/.env.production from .env.selfhost"
  ssh "$HOST" "pct exec $CT -- bash -c 'id app >/dev/null 2>&1 || useradd -r -m -d $APP -s /usr/sbin/nologin app; mkdir -p $APP; chown app:app $APP'"
  { grep -v -E '^(NODE_ENV|PORT|HOSTNAME)=' .env.selfhost; printf 'NODE_ENV=production\nPORT=3000\nHOSTNAME=0.0.0.0\nNEXT_TELEMETRY_DISABLED=1\n'; } \
    | ssh "$HOST" "pct exec $CT -- bash -c 'umask 077; cat > $APP/.env.production; chown app:app $APP/.env.production'"
fi

echo "==> Sending source"
tar czf - --exclude=node_modules --exclude=.next --exclude=.open-next --exclude=.git --exclude='.env*' -C . . \
  | ssh "$HOST" "pct exec $CT -- tar xzf - -C $APP"
ssh "$HOST" "pct exec $CT -- chown -R app:app $APP"

echo "==> Building (standalone; webpack, because turbopack cannot resolve postcss plugins inside the unprivileged LXC)"
ssh "$HOST" "pct exec $CT -- su -s /bin/bash app -c 'cd $APP && set -a && . ./.env.production && set +a && npm ci --include=dev --no-audit --no-fund >/dev/null 2>&1 && BUILD_STANDALONE=1 npx next build --webpack 2>&1 | tail -3 && mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/'"

echo "==> Cluster launcher (one Node process only uses 1 of the 4 cores)"
ssh "$HOST" "pct exec $CT -- bash -c 'cat > $APP/.next/standalone/cluster.js <<JS
const cluster = require(\"node:cluster\");
const WORKERS = Number(process.env.WEB_WORKERS || 4);
if (cluster.isPrimary) {
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on(\"exit\", () => setTimeout(() => cluster.fork(), 1000));
} else {
  require(\"./server.js\");
}
JS
chown app:app $APP/.next/standalone/cluster.js'"

echo "==> Service"
ssh "$HOST" "pct exec $CT -- bash -c 'cat > /etc/systemd/system/wodflow.service <<UNIT
[Unit]
Description=Wodflow web app
After=network-online.target
[Service]
User=app
WorkingDirectory=$APP/.next/standalone
EnvironmentFile=$APP/.env.production
ExecStart=/usr/bin/node cluster.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable wodflow >/dev/null 2>&1 && systemctl restart wodflow && sleep 4 && systemctl is-active wodflow'"
echo "==> Local check"
ssh "$HOST" "pct exec $CT -- curl -s -o /dev/null -w 'home %{http_code}\n' http://127.0.0.1:3000/"
