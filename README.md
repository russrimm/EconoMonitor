# EconoMonitor

A real-time US economic dashboard powered by the FRED and FRASER APIs, with AI-driven
insights and an interactive chat interface.

**Features**

- Live metric cards for key economic indicators (GDP, unemployment, inflation, interest rates, and more)
- Interactive multi-series comparison charts with pinnable indicators
- Browsable FRED category tree and full-text series search
- FRASER historical archives — themes, timelines, and primary-source documents
- AI Insights panel and streaming chat for natural-language economic Q&A
- Release calendar for upcoming FRED data publications

**Tech stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query v5 · Chart.js · Azure App Service

---

## Local Development

```bash
# Install dependencies
npm install

# Copy the example env file and fill in your API keys
cp .env.local.example .env.local   # or create .env.local manually (see below)

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required environment variables (`.env.local`)

```env
FRED_API_KEY=your_fred_api_key
FRASER_API_KEY=your_fraser_api_key
GITHUB_TOKEN=your_github_pat
```

| Key | Where to get it |
|-----|----------------|
| `FRED_API_KEY` | [api.stlouisfed.org/api_key.html](https://api.stlouisfed.org/api_key.html) (free) |
| `FRASER_API_KEY` | [fraser.stlouisfed.org](https://fraser.stlouisfed.org) — request via `curl` command (free, see [BUILDING.md](./BUILDING.md#9-get-your-api-keys)) |
| `GITHUB_TOKEN` | GitHub → Settings → Personal Access Tokens → Tokens (classic) — no scopes needed for Models API |

---

## Deploy to Azure App Service

EconoMonitor runs on **Azure App Service** (Linux, Node 22 LTS, B2 plan).

### One-time infrastructure setup

Run these commands once to create the Azure resources. You need the
[Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed and
`az login` completed.

```powershell
# 1. Create a resource group
az group create --name rg-economonitor --location eastus

# 2. Create a Linux App Service plan (B2 = 1 vCPU / 3.5 GB RAM)
az appservice plan create `
  --name asp-economonitor `
  --resource-group rg-economonitor `
  --sku B2 `
  --is-linux

# 3. Create the web app on Node 22 LTS
az webapp create `
  --name economonitor `
  --resource-group rg-economonitor `
  --plan asp-economonitor `
  --runtime "NODE:22-lts"

# 4. Set the startup command
# The app uses Next.js standalone output — server.js is the entry point
az webapp config set `
  --name economonitor `
  --resource-group rg-economonitor `
  --startup-file "node server.js"

# 5. Configure environment variables (replace placeholder values)
az webapp config appsettings set `
  --name economonitor `
  --resource-group rg-economonitor `
  --settings `
    NODE_ENV=production `
    FRED_API_KEY="<your-fred-api-key>" `
    FRASER_API_KEY="<your-fraser-api-key>" `
    GITHUB_TOKEN="<your-github-pat>"
```

### Deploy (every release)

```powershell
# 1. Build the production bundle (standalone mode)
npm run build

# 2. Copy static assets into the standalone output
Copy-Item -Recurse -Force .next\static .next\standalone\.next\static
Copy-Item -Recurse -Force public        .next\standalone\public

# 3. Zip only the standalone directory (~8 MB vs 324 MB for the full .next)
Set-Location .next\standalone
Compress-Archive -Path * -DestinationPath ..\..\deploy.zip -Force
Set-Location ..\..

# 4. Upload and deploy
az webapp deploy `
  --name economonitor `
  --resource-group rg-economonitor `
  --src-path deploy.zip `
  --type zip
```

The app will be live at **https://economonitor.azurewebsites.net** within ~60 seconds.

### Automated CI/CD (GitHub Actions)

Every push to `main` builds and deploys automatically via
[`.github/workflows/azure-deploy.yml`](./.github/workflows/azure-deploy.yml)
using **OIDC (Workload Identity Federation)** — no stored credentials.

Required GitHub secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | Entra ID App Registration client ID |
| `AZURE_TENANT_ID` | Your Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID |
| `FRED_API_KEY` | Your FRED API key |
| `FRASER_API_KEY` | Your FRASER API key |
| `GITHUB_TOKEN_AI` | Your GitHub PAT (for the AI features — stored as `GITHUB_TOKEN_AI` because GitHub reserves the name `GITHUB_TOKEN`) |

The easiest way to set up the OIDC trust and get the three Azure values is to use
GitHub Copilot in Agent mode with the Azure MCP extension installed. See
[AZURE_DEPLOYMENT.md § 6a](./AZURE_DEPLOYMENT.md#6a-recommended-use-github-copilot-with-azure-mcp-automated-setup)
for the exact prompt.

For the full guide — custom domains, TLS, Application Insights, troubleshooting — see
[AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md).
