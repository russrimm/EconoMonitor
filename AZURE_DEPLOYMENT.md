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

**Recommended VS Code extensions for minimal-effort deployment:**

| Extension | Publisher | Purpose |
|-----------|-----------|---------|
| [Azure MCP](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azure-mcp) | Microsoft | Lets Copilot create App Registrations, federated credentials, and RBAC assignments via natural language |
| [Microsoft Learn MCP](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-learn-mcp) | Microsoft | Gives Copilot access to up-to-date Azure docs for accurate step-by-step guidance |
| [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) | GitHub | Required to use Agent mode with the MCP servers |

With these extensions installed, the entire Entra ID / OIDC setup in Section 6 can be
completed by describing what you want to Copilot in Agent mode — no manual CLI work needed.

**API Keys you will need (all free tiers):**

| Variable | Where to get it |
|----------|----------------|
| `FRED_API_KEY` | [api.stlouisfed.org/api_key.html](https://api.stlouisfed.org/api_key.html) |
| `FRASER_API_KEY` | [fraser.stlouisfed.org](https://fraser.stlouisfed.org) developer portal |
| `GITHUB_TOKEN_AI` | GitHub → Settings → Personal Access Tokens (classic, `read:packages` scope; stored as `GITHUB_TOKEN_AI` — see Section 6b) |

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
  --runtime "NODE:24-lts"
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

### Authentication: Microsoft Entra ID OIDC (Workload Identity Federation)

The workflow authenticates to Azure using **Microsoft Entra ID OIDC** — also called
**Workload Identity Federation**. This is a hard requirement: GitHub Actions cannot
deploy to Azure App Service without a federated credential trust established between
your Entra ID tenant and the GitHub repository.

**No JSON credentials blob is stored in GitHub.** OIDC tokens are short-lived and
scoped to a single job run — far safer than the older approach of storing a long-lived
`AZURE_CREDENTIALS` secret.

---

### 6a. Recommended: Use GitHub Copilot with Azure MCP (Automated Setup)

The easiest way to complete the Entra ID setup is to let GitHub Copilot do it for you
using the **Azure MCP server** and **Microsoft Learn MCP server** — the same approach
used when setting up the live deployment. These tools give Copilot the ability to create
App Registrations, configure federated credentials, and assign RBAC roles directly
through natural language instructions, with no manual CLI work needed.

#### Install the MCP Servers

In VS Code, open **Settings** (`Ctrl+,`) → search `mcp` → open `settings.json` and
ensure you have both MCP servers configured. They are available from the
[Azure MCP extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azure-mcp)
and the
[Microsoft Learn MCP extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-learn-mcp).

Alternatively, install both from the VS Code Extensions panel:
- Search **"Azure MCP"** → install `ms-azuretools.vscode-azure-mcp`
- Search **"Microsoft Learn MCP"** → install `ms-vscode.vscode-learn-mcp`

#### Run the Setup via Copilot

1. Open **GitHub Copilot Chat** in VS Code (sidebar icon or `Ctrl+Alt+I`)
2. Switch to **Agent mode** (dropdown at the bottom of the chat panel)
3. Make sure you are signed in to Azure (`az login` in a terminal, or use the Azure
   extension sign-in)
4. Paste the following prompt, substituting your repo name and subscription:

```
I need to set up GitHub Actions OIDC (Workload Identity Federation) so my repo
russrimm/EconoMonitor can deploy to Azure App Service.

Please:
1. Create an Entra ID App Registration named "sp-economonitor-github"
2. Create a service principal for it and assign it Contributor role on
   resource group rg-economonitor in subscription <your-subscription-id>
3. Add two federated credentials:
   - name: github-actions-main
     subject: repo:russrimm/EconoMonitor:ref:refs/heads/main
   - name: github-actions-dispatch
     subject: repo:russrimm/EconoMonitor:environment:production
4. Tell me the appId, tenantId, and subscriptionId I need to add as GitHub secrets
```

Copilot will use the Azure MCP tools to execute each step, show you the results, and
provide the three values you need for step 6b.

> **Why this works:** The Azure MCP server has direct access to your Azure tenant via
> your VS Code / Azure CLI session. Copilot orchestrates `az ad app create`,
> `az ad sp create`, `az role assignment create`, and `az ad app federated-credential create`
> calls on your behalf — the same commands listed in the manual fallback below, but
> without requiring you to construct them yourself.

---

### 6b. Add GitHub Repository Secrets

After the Copilot/MCP setup in 6a provides the three Azure values, add all secrets to
your GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `AZURE_CLIENT_ID` | App Registration application (client) ID | Output from Copilot in step 6a |
| `AZURE_TENANT_ID` | Azure tenant ID | Output from Copilot in step 6a |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Output from Copilot in step 6a |
| `FRED_API_KEY` | FRED API key | [api.stlouisfed.org](https://api.stlouisfed.org/api_key.html) |
| `FRASER_API_KEY` | FRASER API key | [fraser.stlouisfed.org](https://fraser.stlouisfed.org) |
| `GITHUB_TOKEN_AI` | GitHub PAT (for Models API) | GitHub → Settings → Personal access tokens |

> **Why `GITHUB_TOKEN_AI` and not `GITHUB_TOKEN`?** GitHub Actions automatically creates
> a built-in ephemeral secret named `GITHUB_TOKEN` for every workflow run. You cannot
> override it with a repo secret — GitHub silently ignores any repo secret with that
> name. Store your GitHub PAT under `GITHUB_TOKEN_AI` instead; the workflow's
> `Sync App Settings` step maps it to the `GITHUB_TOKEN` app setting that the
> application reads at runtime.

### 6c. Create the GitHub `production` Environment

The deploy job declares `environment: production` in the workflow YAML. This environment
must exist in GitHub before the first run:

1. Go to your repo → **Settings** → **Environments** → **New environment**
2. Name it exactly `production`
3. Optionally add protection rules (e.g., required reviewers for manual deploys)

This is required for two reasons:
- The `workflow_dispatch` federated credential uses `subject: ...environment:production`;
  the environment tag is only present in the OIDC token when the job references a named
  GitHub environment
- The `url:` on the environment provides a clickable deployment link in the Actions UI

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

### Manual Fallback: CLI Commands (if MCP is unavailable)

If you prefer to run the Entra ID setup manually without Copilot, these are the
equivalent CLI commands:

```bash
# 1. Create the service principal with Contributor on the resource group
az ad sp create-for-rbac \
  --name sp-economonitor-github \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-economonitor \
  --sdk-auth false

# Note the appId from the output, then:

# 2. Add federated credential for push-to-main
az ad app federated-credential create \
  --id <appId> \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:russrimm/EconoMonitor:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 3. Add federated credential for workflow_dispatch via production environment
az ad app federated-credential create \
  --id <appId> \
  --parameters '{
    "name": "github-actions-dispatch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:russrimm/EconoMonitor:environment:production",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 4. Get the values you need for GitHub secrets
az ad sp list --display-name "sp-economonitor-github" --query "[0].appId" -o tsv
az account show --query tenantId -o tsv
az account show --query id -o tsv
```

**Two federated credentials are required** (not one) because the `subject` field is an
exact-match filter. A push to `main` and a `workflow_dispatch` through the `production`
environment produce different subject claims. Without both, manual deploys fail with
`AADSTS70021: No matching federated identity record found`.

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
Resource Group  : rg-economonitor  (region: westus2)
App Service Plan: asp-economonitor  (Linux, B2)
Web App         : economonitor
Runtime         : NODE:20-lts
Startup command : node server.js
Deploy output   : standalone  (next.config.ts → output: "standalone")
Deploy size     : ~8.6 MB zip  (vs 324 MB full .next)
CI/CD auth      : Microsoft Entra ID OIDC / Workload Identity Federation
                  (azure/login@v2 — no stored JSON credential)
GitHub env      : production  (required for workflow_dispatch federated credential)
Federated creds : 2 — one for push-to-main, one for environment:production dispatch
Default URL     : https://economonitor.azurewebsites.net
```
