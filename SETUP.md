# Local Development Setup Guide

Step-by-step instructions to run the **SelectAI** website on your Windows machine.

---

## Prerequisites

You need the following installed before starting:

| Tool | Purpose | Download |
|------|---------|----------|
| **Git** | Clone the repository | https://git-scm.com/download/win |
| **Node.js** (v18 or later) | Run the local dev server (`http-server`) | https://nodejs.org/en/download |
| A modern browser | View the site | Chrome / Edge / Firefox |

> **Check if already installed** — open **PowerShell** and run:
> ```powershell
> git --version
> node --version
> ```

---

## Step 1 — Clone the Repository

1. Open **PowerShell** (press `Win + S`, type *PowerShell*, hit Enter)
2. Navigate to the folder where you want the project to live:
   ```powershell
   cd C:\Projects        # or any folder you prefer, e.g. C:\Users\YourName\dev
   ```
3. Clone the repo (replace `YourGitHubUsername` if prompted for credentials):
   ```powershell
   git clone https://github.com/Janakar-cloud/SelectAI.git
   ```
4. Move into the project folder:
   ```powershell
   cd SelectAI
   ```

---

## Step 2 — Start the Local Development Server

The site is a **static HTML/CSS/JS project** — no build step needed.  
We use `npx http-server` (comes with Node.js) to serve it locally.

```powershell
npx http-server . -p 8080
```

You should see output like:

```
Starting up http-server, serving .
Available on:
  http://127.0.0.1:8080
  http://192.168.x.x:8080
Hit CTRL-C to stop the server
```

---

## Step 3 — Open the Site in Your Browser

Open your browser and go to:

```
http://127.0.0.1:8080
```

| Page | URL |
|------|-----|
| Homepage | http://127.0.0.1:8080 |
| AI Tools Guide | http://127.0.0.1:8080/tools.html |

---

## Step 4 — Making Changes

1. Open the `SelectAI` folder in **VS Code**:
   ```powershell
   code .
   ```
2. Edit files — key files to know:

   | File | What it controls |
   |------|-----------------|
   | `index.html` | Main homepage |
   | `tools.html` | AI DevOps tools guide page |
   | `css/style.css` | All site styles |
   | `js/main.js` | Navbar scroll behaviour, scroll-to-top |
   | `js/kpi.js` | Live KPI counter animations |
   | `js/lead-form.js` | Contact / lead form logic |
   | `js/app-config.js` | Site-wide configuration values |

3. **Hard-refresh** the browser after changes to clear the cache:
   - Chrome / Edge: `Ctrl + Shift + R`
   - Firefox: `Ctrl + F5`

---

## Step 5 — Pulling Latest Changes

Whenever the main repository is updated, pull the latest:

```powershell
git pull origin main
```

Then restart the server if it was stopped:

```powershell
npx http-server . -p 8080
```

---

## Step 6 — Pushing Your Changes (contributors only)

If you have write access and want to push changes:

```powershell
# Stage all changes
git add .

# Commit with a meaningful message
git commit -m "describe what you changed"

# Push to the main branch
git push origin main
```

> **Tip:** For larger changes, create a new branch and open a Pull Request:
> ```powershell
> git checkout -b your-feature-branch
> # ... make changes ...
> git add .
> git commit -m "your change description"
> git push origin your-feature-branch
> ```
> Then open a PR at: https://github.com/Janakar-cloud/SelectAI/pulls

---

## Troubleshooting

### `npx: command not found` or `node is not recognized`
Node.js is not installed or not on your PATH.  
Re-install from https://nodejs.org and **restart PowerShell** after installing.

### Port 8080 already in use
Use a different port:
```powershell
npx http-server . -p 3000
```
Then open http://127.0.0.1:3000 in your browser.

### Git authentication error when cloning
Make sure you have been granted access to the repository at https://github.com/Janakar-cloud/SelectAI.  
When prompted, sign in with your GitHub account. You can also set up a **Personal Access Token**:
1. Go to https://github.com/settings/tokens
2. Generate a new token (classic) with `repo` scope
3. Use it as your password when Git prompts for credentials

### Images / logos not loading
Ensure you cloned the **full** repository including the `1_logo_png/` folder.  
Check with:
```powershell
ls 1_logo_png
```
If the folder is empty or missing, run `git pull origin main` again.

---

## Project Structure Overview

```
SelectAI/
├── index.html              ← Homepage
├── tools.html              ← AI DevOps tools guide
├── css/
│   └── style.css           ← All styles
├── js/
│   ├── app-config.js       ← Config / constants
│   ├── kpi.js              ← KPI counters
│   ├── lead-form.js        ← Lead / contact form
│   └── main.js             ← Core behaviour (nav, scroll)
├── 1_logo_png/
│   ├── 1_main_logo_png/    ← White wordmark (used in nav/footer)
│   └── 2_black_logo_png/   ← Black logo mark (favicon / OG image)
├── assets/                 ← Other static assets
└── SETUP.md                ← This file
```

---

*Built by **SelectAI Innovations** — Established by 2 Strong Women.*
