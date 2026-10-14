# Deploy situs API docs (sa7tein-api.vercel.app)

Situs = statis: `index.html` (redirect) + `swagger.html` (Swagger UI) + `openapi.yaml` + `vendor/swagger-ui-*` + salinan `.md`.

Vendor **tidak** di-commit (biner besar); ambil dari npm saat membangun:

```bash
d=$(mktemp -d) && cd "$d" && npm pack swagger-ui-dist@5 >/dev/null && tar -xzf swagger-ui-dist-*.tgz
mkdir -p /tmp/sa7tein-api-site/vendor
cp package/swagger-ui.css package/swagger-ui-bundle.js /tmp/sa7tein-api-site/vendor/

cd /Users/muhammadbaihaqy/Downloads/za7tein-pwa
cp docs/backend/site/index.html docs/backend/site/swagger.html /tmp/sa7tein-api-site/
cp docs/backend/{openapi.yaml,ERD.md,CONSUME.md,M6-ADAPTER.md,MILESTONES.md} /tmp/sa7tein-api-site/

cd /tmp/sa7tein-api-site
vercel link --yes --project sa7tein-api && vercel deploy --prod --yes
```

> ⚠️ Folder build (`/tmp/sa7tein-api-site`) bisa terhapus → jangan simpan satu-satunya salinan di sana. Sumber HTML ada di `docs/backend/site/`, `openapi.yaml` di `docs/backend/`.
