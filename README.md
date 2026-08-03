# EconoMonitor

A US economic dashboard powered by the FRED and FRASER APIs, with AI-driven
insights and an interactive chat interface.

**Features**

- Live metric cards for key economic indicators (GDP, unemployment, inflation, interest rates, and more)
- FRED data transformations — year-over-year and period percent change, absolute change, annualised rates, and natural log, plus optional frequency aggregation
- Interactive multi-series comparison charts with pinnable indicators and rebasing (index to 100, % change from start, z-score) so series with different units share one axis
- Browsable FRED category tree and full-text series search
- FRASER historical archives — themes, timelines, and primary-source documents
- AI Insights panel and streaming chat for natural-language economic Q&A
- Release calendar for upcoming FRED data publications
- Latest financial news headlines from the free GDELT DOC API and Federal Reserve RSS

FRED responses are cached for five minutes, FRASER responses for one hour, and news
responses for fifteen minutes. Observation dates and source links are shown in the UI;
data is current to each source's latest published release rather than tick-by-tick real time.

**Tech stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query v5 · Chart.js · Azure App Service

---

## Local Development

```bash
# Install dependencies
npm install

# Copy the example env file and fill in your API keys
cp .env.sample .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required environment variables (`.env.local`)

```env
FRED_API_KEY=your_fred_api_key
FRASER_API_KEY=your_fraser_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

| Key | Where to get it |
|-----|----------------|
| `FRED_API_KEY` | [api.stlouisfed.org/api_key.html](https://api.stlouisfed.org/api_key.html) (free) |
| `FRASER_API_KEY` | [fraser.stlouisfed.org](https://fraser.stlouisfed.org) — request via `curl` command (free, see [BUILDING.md](./BUILDING.md#9-get-your-api-keys)) |
| `AZURE_OPENAI_ENDPOINT` | Your Microsoft Foundry / Azure OpenAI resource endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Your model deployment name (defaults to `gpt-4o`) |

> **GitHub Models was retired on 2026-07-30** and is no longer a supported
> provider. Azure OpenAI is now the only backend for the AI features.

Authentication uses Microsoft Entra ID, not API keys. Locally, run `az login` and
the app authenticates as you; in Azure it uses the App Service managed identity.
Set `AZURE_OPENAI_API_KEY` only if you are targeting a resource that still
permits local auth.

AI features send the selected FRED series values or chat text to the configured
Azure OpenAI deployment. Do not enter personal, confidential, or regulated data.
The server bounds request size and model history, and AI responses are never cached.

### Quality checks

```bash
npm test
npm run check:secrets
npm run typecheck
npm run lint
npm run build
```

### Health checks

- `GET /api/health/live` reports process liveness.
- `GET /api/health/ready` returns `503` when the required FRED configuration is
  missing. Optional FRASER and AI configuration is reported only as boolean
  capability status; credential values are never returned.

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
    AZURE_OPENAI_ENDPOINT="https://<your-resource>.cognitiveservices.azure.com" `
    AZURE_OPENAI_DEPLOYMENT="gpt-4o"

# 6. Give the app a managed identity and grant it access to the model.
#    This is why there is no AZURE_OPENAI_API_KEY above.
az webapp identity assign `
  --name economonitor `
  --resource-group rg-economonitor

$principalId = az webapp identity show `
  --name economonitor --resource-group rg-economonitor --query principalId -o tsv

az role assignment create `
  --assignee-object-id $principalId `
  --assignee-principal-type ServicePrincipal `
  --role "Cognitive Services OpenAI User" `
  --scope $(az cognitiveservices account show `
    --name <your-openai-resource> --resource-group <its-rg> --query id -o tsv)
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

Pull requests run the secret check, tests, typecheck, lint, and production build.
Every push to `main` then builds and deploys automatically via
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

Required GitHub *variables* (same page, **Variables** tab). These are not
secrets — the app authenticates to Azure OpenAI with its managed identity:

| Variable | Value |
|----------|-------|
| `AZURE_OPENAI_ENDPOINT` | `https://<your-resource>.cognitiveservices.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | Your model deployment name, e.g. `gpt-4o` |

The easiest way to set up the OIDC trust and get the three Azure values is to use
GitHub Copilot in Agent mode with the Azure MCP extension installed. See
[AZURE_DEPLOYMENT.md § 6a](./AZURE_DEPLOYMENT.md#6a-recommended-use-github-copilot-with-azure-mcp-automated-setup)
for the exact prompt.

For the full guide — custom domains, TLS, Application Insights, troubleshooting — see
[AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md).
