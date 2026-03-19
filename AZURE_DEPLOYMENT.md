# EconoMonitor — Azure App Service Deployment Guide

This document covers everything needed to publish EconoMonitor to Azure App Service:
from provisioning infrastructure, through first-time deployment, to automated CI/CD and
post-deployment validation.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Azure Resource Creation](#2-azure-resource-creation)
3. [Configure Environment Variables](#3-configure-environment-variables)
4. [Build for Production](#4-build-for-production)
5. [First-Time Deployment (Zip Deploy)](#5-first-time-deployment-zip-deploy)
6. [Automated CI/CD (GitHub Actions)](#6-automated-cicd-github-actions)
7. [Custom Domain & HTTPS](#7-custom-domain--https)
8. [Post-Deployment Validation](#8-post-deployment-validation)
9. [Monitoring & Logging](#9-monitoring--logging)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) | ≥ 2.60 | `az --version` to confirm |
| Node.js | 20 LTS | Must match the App Service runtime |
| npm | ≥ 10 | Bundled with Node 20 |
| An Azure subscription | — | Free trial works fine |

**API Keys you will need (all free tiers):**

| Variable | Where to get it |
|----------|----------------|
| `FRED_API_KEY` | [api.stlouisfed.org/api_key.html](https://api.stlouisfed.org/api_key.html) |
| `FRASER_API_KEY` | [fraser.stlouisfed.org](https://fraser.stlouisfed.org) developer portal |
| `GITHUB_TOKEN` | GitHub → Settings → Personal Access Tokens (classic, no scopes needed for Models API) |
| `OPENAI_API_KEY` | Optional Azure OpenAI fallback; omit if using GitHub Models only |

Log in to Azure before running any commands below:

```bash
az login
az account set --subscription "<your-subscription-id>"
```

---

## 2. Azure Resource Creation

All commands use the same group name (`rg-economonitor`) and app name (`economonitor`).
Adjust these to match your naming conventions.

### 2a. Resource Group

```bash
az group create \
  --name rg-economonitor \
  --location eastus
```

> **Location choice**: `eastus` is generally the lowest-latency region for US users and
> has broad service availability. Other good choices: `westus2`, `eastus2`, `westeurope`.

### 2b. App Service Plan

```bash
az appservice plan create \
  --name asp-economonitor \
  --resource-group rg-economonitor \
  --sku B2 \
  --is-linux
```

| SKU | vCores | RAM | Monthly cost (approx.) | Notes |
|-----|--------|-----|------------------------|-------|
| F1  | shared | 1 GB | Free | No custom domain, 60 min/day CPU limit |
| B1  | 1 | 1.75 GB | ~$13 | Good for low-traffic testing |
| **B2** | **1** | **3.5 GB** | **~$27** | **Recommended minimum for Next.js** |
| B3  | 2 | 7 GB | ~$54 | Use if you expect concurrent AI calls |
| P1v3 | 1 | 8 GB | ~$81 | Production with auto-scale support |

### 2c. Web App

```bash
az webapp create \
  --name economonitor \
  --resource-group rg-economonitor \
  --plan asp-economonitor \
  --runtime "NODE:20-lts"
```

This creates `https://economonitor.azurewebsites.net`.

> **App names are globally unique** — if `economonitor` is taken, try something like
> `economonitor-prod` or `econoapp-<yourname>`.

### 2d. Configure the Startup Command

With `output: "standalone"` in `next.config.ts`, Next.js produces a self-contained
server in `.next/standalone/server.js`. Azure must be told to run it directly:

```bash
az webapp config set \
  --name economonitor \
  --resource-group rg-economonitor \
  --startup-file "node server.js"
```

---

## 3. Configure Environment Variables

Set all required secrets as App Settings (encrypted at rest by Azure):

```bash
az webapp config appsettings set \
  --name economonitor \
  --resource-group rg-economonitor \
  --settings \
    NODE_ENV=production \
    FRED_API_KEY="<your-fred-api-key>" \
    FRASER_API_KEY="<your-fraser-api-key>" \
    GITHUB_TOKEN="<your-github-pat>"
```

To verify the settings were saved (values redacted):

```bash
az webapp config appsettings list \
  --name economonitor \
  --resource-group rg-economonitor \
  --output table
```

> **Never commit `.env.local` to source control.** The `.gitignore` already excludes it.
> App Settings in Azure App Service are equivalent to environment variables and are
> injected into the Node.js process at runtime.

---

## 4. Build for Production

The project uses `output: "standalone"` in `next.config.ts`, which produces a minimal
self-contained server bundle (`~37 MB`) instead of shipping the entire `.next` directory
(`~324 MB`) and a separate `node_modules`.

```bash
npm ci
npm run build
```

A successful build produces:
- `.next/standalone/` — complete Node.js server with only required dependencies
- `.next/static/` — compiled JS/CSS/assets (must be copied into standalone)
- `public/` — static public files (must be copied into standalone)

---

## 5. First-Time Deployment (Zip Deploy)

Because the project uses `output: "standalone"`, only the `.next/standalone/` directory
(plus its required static assets) needs to be deployed — no `node_modules` upload needed.

### PowerShell (Windows)

```powershell
# 1. Copy static assets into the standalone bundle
Copy-Item -Recurse -Force .next\static .next\standalone\.next\static
Copy-Item -Recurse -Force public    .next\standalone\public

# 2. Zip the standalone directory contents
Set-Location .next\standalone
Compress-Archive -Path * -DestinationPath ..\..\deploy.zip -Force
Set-Location ..\..

# 3. Deploy
az webapp deploy `
  --name economonitor `
  --resource-group rg-economonitor `
  --src-path deploy.zip `
  --type zip
```

### Bash (macOS / Linux / WSL)

```bash
# 1. Copy static assets
cp -r .next/static .next/standalone/.next/static
cp -r public        .next/standalone/public

# 2. Zip
cd .next/standalone && zip -r ../../deploy.zip . && cd ../..

# 3. Deploy
az webapp deploy \
  --name economonitor \
  --resource-group rg-economonitor \
  --src-path deploy.zip \
  --type zip
```

### What happens on the Azure side

1. Azure extracts the zip into `/home/site/wwwroot/`
2. Azure finds `server.js` and runs `node server.js` per the startup command
3. The app becomes available at `https://economonitor.azurewebsites.net`

> **First cold start** after a fresh deployment can take 30–60 seconds.
> Enable **Always On** (`az webapp config set --always-on true`) on B1+ plans to keep warm.

---

## 6. Automated CI/CD (GitHub Actions)

The workflow at [`.github/workflows/azure-deploy.yml`](./.github/workflows/azure-deploy.yml)
automates build and deploy on every push to `main`.

### 6a. Get the Publish Profile

```bash
az webapp deployment list-publishing-profiles \
  --name economonitor \
  --resource-group rg-economonitor \
  --xml \
  --output tsv
```

Copy the entire XML output.

### 6b. Add the Secret to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
4. Value: paste the XML from the previous step

### 6c. Add API Key Secrets

Repeat step 6b for each of these secrets (matching the names in the workflow file):

| Secret Name | Value |
|-------------|-------|
| `FRED_API_KEY` | Your FRED API key |
| `FRASER_API_KEY` | Your FRASER API key |
| `GITHUB_TOKEN_AI` | Your GitHub PAT for Models API |

> The workflow uses `GITHUB_TOKEN_AI` to avoid conflicting with GitHub's built-in
> `GITHUB_TOKEN` secret.

After both secrets are in place, every push to `main` will trigger an automatic
build + deploy. See [`.github/workflows/azure-deploy.yml`](./.github/workflows/azure-deploy.yml)
for the full workflow definition.

---

## 7. Custom Domain & HTTPS

### Add a Custom Domain

```bash
# Verify you own the domain first (add a TXT record as instructed)
az webapp custom-hostname-add \
  --webapp-name economonitor \
  --resource-group rg-economonitor \
  --hostname www.yourdomain.com
```

### Enable Managed TLS Certificate (free)

```bash
az webapp config ssl create \
  --name economonitor \
  --resource-group rg-economonitor \
  --hostname www.yourdomain.com

# Bind the certificate
az webapp config ssl bind \
  --name economonitor \
  --resource-group rg-economonitor \
  --certificate-thumbprint "<thumbprint-from-previous-output>" \
  --ssl-type SNI
```

Azure automatically renews managed certificates before expiry.

---

## 8. Post-Deployment Validation

Run through this checklist after every deployment:

### 8a. Basic Availability

```bash
# Should return HTTP 200
curl -o /dev/null -s -w "%{http_code}" https://economonitor.azurewebsites.net
```

Or open the URL in a browser and confirm the dashboard loads.

### 8b. Page-by-Page Smoke Test

| Page | URL | Expected |
|------|-----|----------|
| Dashboard | `/` | Metric cards load with live data |
| Search | `/search?q=gdp` | Series results appear |
| Compare | `/compare` | Chart renders; pin/unpin works |
| Categories | `/categories` | Root category tree visible |
| Releases | `/releases` | Table of FRED data releases |
| Archives | `/fraser` | FRASER themes listed |
| Insights | `/insights` | Series picker + AI panel available |
| Chat | `/chat` | Chat box accepts a message and streams a reply |
| About | `/about` | Page loads, LinkedIn link resolves |

### 8c. API Health Checks

```bash
# AI chat endpoint
curl -X POST https://economonitor.azurewebsites.net/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is GDP?"}]}' \
  --max-time 30
```

Expected: a streaming response with economic context.

```bash
# FRED proxy (if exposed)
curl "https://economonitor.azurewebsites.net/api/fred/series?series_id=GDP" \
  --max-time 10
```

### 8d. Environment Variable Check

If any page shows "data unavailable" or the AI returns generic errors, confirm the
App Settings are set correctly:

```bash
az webapp config appsettings list \
  --name economonitor \
  --resource-group rg-economonitor \
  --query "[].{Name:name,Value:value}" \
  --output table
```

### 8e. Verify the Node.js Version

```bash
az webapp config show \
  --name economonitor \
  --resource-group rg-economonitor \
  --query "linuxFxVersion"
```

Should return `"NODE|20-lts"`.

---

## 9. Monitoring & Logging

### Enable Application Logging

```bash
az webapp log config \
  --name economonitor \
  --resource-group rg-economonitor \
  --application-logging filesystem \
  --level information \
  --web-server-logging filesystem \
  --detailed-error-messages true
```

### Tail Logs in Real Time

```bash
az webapp log tail \
  --name economonitor \
  --resource-group rg-economonitor
```

### Download Recent Logs

```bash
az webapp log download \
  --name economonitor \
  --resource-group rg-economonitor \
  --log-file economonitor-logs.zip
```

### Application Insights (Optional but Recommended)

```bash
# Create an Application Insights resource
az monitor app-insights component create \
  --app economonitor-insights \
  --location eastus \
  --resource-group rg-economonitor \
  --application-type web

# Get the instrumentation key
az monitor app-insights component show \
  --app economonitor-insights \
  --resource-group rg-economonitor \
  --query "instrumentationKey" \
  --output tsv
```

Add the returned key as an App Setting:

```bash
az webapp config appsettings set \
  --name economonitor \
  --resource-group rg-economonitor \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="<connection-string>"
```

---

## 10. Troubleshooting

### App returns HTTP 500 or blank page

1. Check live logs: `az webapp log tail --name economonitor --resource-group rg-economonitor`
2. Confirm `NODE_ENV=production` is set in App Settings
3. Confirm the startup command is `npm run start`
4. Make sure `.next/` was included in the zip — it is required at runtime

### "Cannot find module" errors in logs

The build output was not included. Re-run `npm run build` locally and re-zip:
`.next` directory must be in the zip root alongside `package.json`.

### AI chat returns errors

- Confirm `GITHUB_TOKEN` is set and has not expired
- The GitHub Models API has per-token rate limits; switching to the Azure OpenAI
  fallback requires setting `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT`

### App is slow on first request (cold start)

Enable **Always On** to keep the Node.js process warm (requires B1 or higher):

```bash
az webapp config set \
  --name economonitor \
  --resource-group rg-economonitor \
  --always-on true
```

### Port binding errors

Azure sets the `PORT` environment variable automatically. `next start` reads `PORT`
natively. Do **not** hard-code a port in `next.config.ts`.

### Restart the app

```bash
az webapp restart \
  --name economonitor \
  --resource-group rg-economonitor
```

### Remove all resources when done

```bash
az group delete \
  --name rg-economonitor \
  --yes \
  --no-wait
```

---

## Quick Reference

```
Resource Group : rg-economonitor
App Service Plan: asp-economonitor  (Linux, B2)
Web App        : economonitor
Runtime        : NODE:20-lts
Startup command: npm run start
Default URL    : https://economonitor.azurewebsites.net
```
