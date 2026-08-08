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
| Node.js | 22 or newer | `package.json` requires `>=22`; the App Service runtime is `NODE:24-lts` |
| npm | ≥ 10 | Bundled with Node 22+ |
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
| `EIA_API_KEY` | [eia.gov/opendata/register.php](https://www.eia.gov/opendata/register.php) — optional, powers `/energy` |
| `BEA_API_KEY` | [apps.bea.gov/API/signup](https://apps.bea.gov/API/signup/) — optional, powers state GDP on `/regional` |
| `CENSUS_API_KEY` | [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html) — optional, powers the indicators on `/regional` |
| Azure OpenAI access | A Microsoft Foundry / Azure OpenAI resource with a chat deployment (e.g. `gpt-4o`). No key required — see Section 3a. |

The three optional keys are genuinely optional. `/rates` needs no key at all,
and `/energy` and `/regional` render a signup prompt rather than an error when
theirs are absent, so readiness stays healthy either way.

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
  --sku F1 \
  --is-linux
```

| SKU | vCores | RAM | Monthly cost (approx.) | Notes |
|-----|--------|-----|------------------------|-------|
| **F1** | **shared** | **1 GB** | **Free** | **Testing and validation only.** No custom domain, no Always On, 60 min/day CPU quota |
| B1  | 1 | 1.75 GB | ~$13 | Lowest tier that supports Always On — start here for real traffic |
| B2  | 1 | 3.5 GB | ~$27 | Comfortable headroom for Next.js |
| B3  | 2 | 7 GB | ~$54 | Use if you expect concurrent AI calls |
| P1v3 | 1 | 8 GB | ~$81 | Production with auto-scale support |

> **This deployment runs on F1 (Free) deliberately — treat it as a test and
> validation environment, not production.** F1 is the right choice while you are
> proving out the build, the deployment pipeline, and the Azure OpenAI wiring at
> zero cost. Be aware of what you are accepting:
>
> - **No Always On.** `az webapp config set --always-on true` returns `Conflict`
>   on Free tier. The Node.js process is unloaded after ~20 minutes idle, so the
>   next request pays a 30–60 second cold start.
> - **60 CPU-minutes per day.** Once the quota is exhausted the app stops
>   serving until it resets, and returns `403` in the meantime.
> - **No custom domain and no TLS binding**, so you are limited to
>   `*.azurewebsites.net`.
> - **Shared compute**, so response times vary with neighbouring workloads.
>
> Before putting this in front of real users, move to B1 or higher and then
> enable Always On:
>
> ```bash
> az appservice plan update --name asp-economonitor \
>   --resource-group rg-economonitor --sku B1
>
> az webapp config set --name economonitor \
>   --resource-group rg-economonitor --always-on true
> ```
>
> Nothing else in this guide changes with the SKU — the deployment pipeline,
> managed identity, and app settings are identical on F1 and B1.

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
    EIA_API_KEY="<your-eia-api-key>" \
    BEA_API_KEY="<your-bea-api-key>" \
    CENSUS_API_KEY="<your-census-api-key>" \
    AZURE_OPENAI_ENDPOINT="https://<your-resource>.cognitiveservices.azure.com" \
    AZURE_OPENAI_DEPLOYMENT="gpt-4o"
```

> **There is deliberately no AI API key here.** GitHub Models was retired on
> 2026-07-30, and the replacement — Azure OpenAI — is accessed with the app's
> managed identity. See Section 3a.

> **Do not add `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, or `AZURE_SUBSCRIPTION_ID`
> as App Settings.** Those belong in GitHub Secrets for the deploy workflow.
> The application never reads them, and an `AZURE_CLIENT_ID` App Setting breaks
> managed identity, because the Azure SDK then looks for a *user-assigned*
> identity with that client ID and fails to get a token.

### 3a. Grant the App Access to the Model (Managed Identity)

Give the web app an identity and authorize it against your Azure OpenAI
resource. No key is created, stored, or rotated.

```bash
az webapp identity assign \
  --name economonitor \
  --resource-group rg-economonitor

PRINCIPAL_ID=$(az webapp identity show \
  --name economonitor --resource-group rg-economonitor --query principalId -o tsv)

SCOPE=$(az cognitiveservices account show \
  --name <your-openai-resource> --resource-group <its-rg> --query id -o tsv)

az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Cognitive Services OpenAI User" \
  --scope "$SCOPE"
```

The role is scoped to the single resource, not the subscription, so the app can
call that one model deployment and nothing else.

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
> On the current F1 (Free) plan this also happens after ~20 minutes of
> inactivity, because Always On is unavailable below B1. That is expected for a
> test and validation environment — see Section 2b before going to production.

---

## 6. Automated CI/CD (GitHub Actions)

The workflow at [`.github/workflows/azure-deploy.yml`](./.github/workflows/azure-deploy.yml)
validates pull requests and automates deployment on every push to `main`.

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

Both MCP servers install from the VS Code Extensions panel (`Ctrl+Shift+X`) exactly
like any other extension — search by name and click **Install**:

- Search **"Azure MCP"** → install `ms-azuretools.vscode-azure-mcp`
- Search **"Microsoft Learn MCP"** → install `ms-vscode.vscode-learn-mcp`

After installing the Azure MCP, run `az login` in a VS Code terminal to authenticate.
The MCP registers itself with Copilot Agent automatically — no additional configuration
or `settings.json` edits required.

For full MCP setup guidance including the Azure CLI prerequisite, see
[BUILDING.md § 2 (MCP Servers)](./BUILDING.md#mcp-servers--install-these-before-you-start).

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
| `EIA_API_KEY` | EIA API key (optional) | [eia.gov/opendata](https://www.eia.gov/opendata/register.php) |
| `BEA_API_KEY` | BEA API key (optional) | [apps.bea.gov/API/signup](https://apps.bea.gov/API/signup/) |
| `CENSUS_API_KEY` | Census API key (optional) | [api.census.gov](https://api.census.gov/data/key_signup.html) |

Then add these as repository **Variables** (same page, *Variables* tab). They
are configuration, not secrets — the app authenticates with managed identity:

| Variable Name | Value |
|---------------|-------|
| `AZURE_OPENAI_ENDPOINT` | `https://<your-resource>.cognitiveservices.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name, e.g. `gpt-4o` |

> **The `Sync App Settings` step skips empty values.** If a secret or variable
> is missing it logs a warning and leaves the existing App Setting alone. An
> earlier version wrote empty strings, which silently disabled the AI features
> on every deploy.

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

Pull requests run only the Build job. A push to `main` or manual dispatch runs
all three jobs:

| Job | What it does |
|-----|--------------|
| **Build** | Checks tracked files for secret patterns → `npm ci` → tests → typecheck → lint → production build. Deployment events also assemble and upload `deploy.zip`. |
| **Deploy** | Downloads artifact → logs in via OIDC → deploys zip → syncs App Settings from secrets |
| **Validate** | Waits 20 s → checks the homepage (200) → verifies AI request validation (400, without model inference) |

See [`.github/workflows/azure-deploy.yml`](./.github/workflows/azure-deploy.yml)
for the full workflow definition. Third-party actions are pinned to immutable
commit SHAs, and only the Deploy job can request an OIDC token.

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

Should return `"NODE|24-lts"` (matching the runtime set in Section 2c).

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

- **503** means no provider is configured — check `AZURE_OPENAI_ENDPOINT` is set
  as an App Setting.
- **502** means the provider rejected the call. Most often the managed identity
  is missing the `Cognitive Services OpenAI User` role on the resource (Section
  3a), or an `AZURE_CLIENT_ID` App Setting is shadowing the system-assigned
  identity. Verify with:

  ```bash
  az role assignment list --assignee "$(az webapp identity show \
    --name economonitor --resource-group rg-economonitor --query principalId -o tsv)" \
    --all --output table
  ```

- If the resource has `disableLocalAuth: true`, API keys will always fail;
  managed identity is the only option.
- GitHub Models (`models.inference.ai.azure.com`) was retired on 2026-07-30 and
  returns `410`. Any lingering `GITHUB_TOKEN` setting is dead configuration and
  should be deleted.

### App is slow on first request (cold start)

This is expected on the current **F1 (Free)** plan: Always On is not available
below B1, so the process is unloaded after roughly 20 minutes of inactivity and
the next request pays the start-up cost. F1 is intended for testing and
validation, so this trade-off is deliberate.

If the app returns `403` rather than being merely slow, you have likely
exhausted the F1 quota of 60 CPU-minutes per day; it resets on a daily cycle.
Check with:

```bash
az appservice plan show --name asp-economonitor \
  --resource-group rg-economonitor --query "{sku:sku.name,status:status}" -o json
```

To keep the process warm, move to B1 or higher first — `--always-on true`
returns `Conflict` on Free tier:

```bash
az appservice plan update \
  --name asp-economonitor \
  --resource-group rg-economonitor \
  --sku B1

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
