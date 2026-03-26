# Ship checklist

**Done:** repo **https://github.com/GitSomeUser/devtools** exists; **`main` pushed** from `~/devtools-build`.

## 1. Enable GitHub Pages (do this if https://gitsomeuser.github.io/devtools/ is 404)

1. Repo → **Settings** → **Pages**
2. **Build and deployment:** Deploy from branch **main**, folder **/ (root)**
3. Save. Wait 1–3 min. Site: **https://gitsomeuser.github.io/devtools/**

## 2. Verify

```bash
curl -sI https://gitsomeuser.github.io/devtools/ | head -n 5
```

Expect **HTTP/2 200** (may take 1–3 minutes after first push).
