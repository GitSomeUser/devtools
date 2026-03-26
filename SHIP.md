# Ship checklist (one time)

The repo is ready **locally** at `~/devtools-build/` with `main` at the commit you last made.

## 1. Create the empty GitHub repo

1. Open **https://github.com/new**
2. Owner: **GitSomeUser**
3. Repository name: **`devtools`**
4. **Public**
5. Do **not** add README, .gitignore, or license (we already have commits).
6. Create repository.

## 2. Push from this machine

```bash
cd ~/devtools-build
git remote set-url origin https://github.com/GitSomeUser/devtools.git
# or: git@github.com:GitSomeUser/devtools.git
git push -u origin main
```

If prompted, use a **PAT** with `repo` scope or SSH key already on the account.

## 3. Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. **Build and deployment:** Deploy from branch **main**, folder **/ (root)**
3. Save. Site: **https://gitsomeuser.github.io/devtools/**

## 4. Verify

```bash
curl -sI https://gitsomeuser.github.io/devtools/ | head -n 5
```

Expect **HTTP/2 200** (may take 1–3 minutes after first push).
