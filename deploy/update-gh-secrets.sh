#!/bin/bash
# Points the GitHub Actions secrets at the self-hosted Wodflow database (db.wodflow.co.za).
# Run from the Mac:  bash ~/wodflow/deploy/update-gh-secrets.sh     Prints no secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
echo -n "https://db.wodflow.co.za" | gh secret set NEXT_PUBLIC_SUPABASE_URL
echo -n "https://db.wodflow.co.za" | gh secret set SUPABASE_URL
ssh lxc-supabase 'grep -E "^ *ANON_KEY" /root/wodflow-provision.txt | sed -E "s/^ *ANON_KEY[: =]*//" | tr -d "\n"' | gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY
ssh lxc-supabase 'grep -E "^ *SERVICE_KEY" /root/wodflow-provision.txt | sed -E "s/^ *SERVICE_KEY[: =]*//" | tr -d "\n"' | gh secret set SUPABASE_SERVICE_ROLE_KEY
echo "Done. Test with: gh workflow run health-check.yml"
