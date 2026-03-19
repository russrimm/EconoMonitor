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

> **Location choice**: `eastus` is generally the lowest-latency region for US users.
> However, quota for new App Service plans can be 0 in eastus — if you hit that error,
> use `westus2` (or `eastus2`, `westeurope`). The live deployment uses **westus2**.

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
automates build and deploy on every push to `main`. It uses **OIDC (OpenID Connect)**
to authenticate with Azure — no long-lived credential JSON is stored in GitHub.

### 6a. Create a Service Principal

```bash
# Create the service principal with Contributor access to the resource group
az ad sp create-for-rbac \
  --name sp-economonitor-github \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-economonitor \
  --sdk-auth false
```

Note the `appId` (client ID) from the output — you will need it in 6b.

> If the SP already exists, retrieve its `appId` with:
> ```bash
> az ad sp list --display-name "sp-economonitor-github" --query "[0].appId" -o tsv
> ```

### 6b. Add Federated Credentials (OIDC)

Federated credentials let GitHub Actions prove its identity to Azure without a password.
Create one credential for each trigger that should be able to deploy:

```bash
# 1. Pushes to main branch
az ad app federated-credential create \
  --id <appId-from-6a> \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:russrimm/EconoMonitor:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 2. Manual workflow_dispatch (via 'production' environment)
az ad app federated-credential create \
  --id <appId-from-6a> \
  --parameters '{
    "name": "github-actions-dispatch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:russrimm/EconoMonitor:environment:production",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

Both credentials are already created on the live service principal.

### 6c. Add GitHub Repository Secrets

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Add each of the following **repository secrets**:

| Secret Name | Value | How to find it |
|-------------|-------|----------------|
| `AZURE_CLIENT_ID` | SP app ID | `az ad sp list --display-name sp-economonitor-github --query "[0].appId" -o tsv` |
| `AZURE_TENANT_ID` | Azure tenant ID | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | `az account show --query id -o tsv` |
| `FRED_API_KEY` | FRED API key | [api.stlouisfed.org](https://api.stlouisfed.org/api_key.html) |
| `FRASER_API_KEY` | FRASER API key | [fraser.stlouisfed.org](https://fraser.stlouisfed.org) |
| `GITHUB_TOKEN_AI` | GitHub PAT (Models API) | GitHub → Settings → Personal access tokens |

> `GITHUB_TOKEN_AI` is used instead of `GITHUB_TOKEN` to avoid conflicting with
> GitHub Actions' built-in `GITHUB_TOKEN` secret. The workflow maps it to the
> `GITHUB_TOKEN` App Setting that the app reads at runtime.

### 6d. How the Workflow Runs

Every push to `main` (or a manual dispatch) triggers three sequential jobs:

| Job | What it does |
|-----|--------------|
| **Build** | `npm ci` → `npm run build` → assembles standalone bundle → uploads `deploy.zip` artifact |
| **Deploy** | Downloads artifact → logs in via OIDC → deploys zip → syncs App Settings from secrets |
| **Validate** | Waits 20 s → `curl` homepage (200) → `curl` AI chat endpoint (200/206) |

See [`.github/workflows/azure-deploy.yml`](./.github/workflows/azure-deploy.yml)
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
3. Confirm the startup command is `node server.js` (not `npm run start`)
4. Make sure the standalone bundle was zipped correctly — `server.js` must be at the zip root

### "Cannot find module" errors in logs

The standalone bundle was not assembled correctly. Re-run the build and copy steps:

```bash
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public        .next/standalone/public
cd .next/standalone && zip -r ../../deploy.zip . && cd ../..  
```

`server.js` and `.next/` must both be at the root of the zip.

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
Resource Group : rg-economonitor  (region: westus2)
App Service Plan: asp-economonitor  (Linux, B2)
Web App        : economonitor
Runtime        : NODE:20-lts
Startup command: node server.js
Deploy output  : standalone  (next.config.ts → output: "standalone")
Deploy size    : ~8.6 MB zip  (vs 324 MB full .next)
CI/CD auth     : OIDC (azure/login@v2, no stored credential blob)
Default URL    : https://economonitor.azurewebsites.net
```
