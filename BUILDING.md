# Building EconoMonitor — Step-by-Step Guide

EconoMonitor is a full-stack economic research dashboard built with **Next.js**, **TypeScript**, and **Tailwind CSS**. It connects to two free public APIs from the Federal Reserve Bank of St. Louis:

- **FRED** — Federal Reserve Economic Data (thousands of economic time-series)
- **FRASER** — Federal Reserve Archival System for Economic Research (historical documents, themed collections, and event timelines)

This guide walks you through **every step from scratch**, including tooling setup, AI-assisted development workflow, and detailed explanations of implementation decisions and issues encountered along the way.

---

## Table of Contents

1. [Prerequisites — What You Need](#1-prerequisites--what-you-need)
2. [Install VS Code and Extensions](#2-install-vs-code-and-extensions)
3. [Set Up GitHub Copilot and AI Features](#3-set-up-github-copilot-and-ai-features)
4. [Understand the AI Workflow — Plan Before You Build](#4-understand-the-ai-workflow--plan-before-you-build)
5. [Scaffold the Next.js Project](#5-scaffold-the-nextjs-project)
6. [Install Dependencies](#6-install-dependencies)
7. [Configure Tailwind CSS and Theme Variables](#7-configure-tailwind-css-and-theme-variables)
8. [Configure Next.js and TypeScript](#8-configure-nextjs-and-typescript)
9. [Get Your API Keys](#9-get-your-api-keys)
10. [Build the API Proxy Routes](#10-build-the-api-proxy-routes)
11. [Build the Typed API Clients](#11-build-the-typed-api-clients)
12. [Build the React Query Hooks](#12-build-the-react-query-hooks)
13. [Build the Root Layout and Providers](#13-build-the-root-layout-and-providers)
14. [Build the Navbar](#14-build-the-navbar)
15. [Build the Utility Library](#15-build-the-utility-library)
16. [Build the Pinned Series Hook](#16-build-the-pinned-series-hook)
17. [Build the Chart Components](#17-build-the-chart-components)
18. [Build the Dashboard Page](#18-build-the-dashboard-page)
19. [Build the Search Page](#19-build-the-search-page)
20. [Build the Series Detail Page](#20-build-the-series-detail-page)
21. [Build the Compare Page](#21-build-the-compare-page)
22. [Build the Categories Pages](#22-build-the-categories-pages)
23. [Build the Releases Page](#23-build-the-releases-page)
24. [Build the Export Button](#24-build-the-export-button)
25. [Build the FRASER Section](#25-build-the-fraser-section)
26. [Issues Encountered and How They Were Fixed](#26-issues-encountered-and-how-they-were-fixed)
27. [Running the App](#27-running-the-app)
28. [Project File Reference](#28-project-file-reference)
29. [AI Economic Insights](#section-29--ai-economic-insights)
30. [Azure App Service Deployment](#section-30--azure-app-service-deployment)

---

## 1. Prerequisites — What You Need

Before starting, install the following tools on your machine. All of them are free.

### Node.js (JavaScript Runtime)

Next.js runs on Node.js. You need **version 18.18 or later** (version 24 LTS recommended).

1. Go to **https://nodejs.org**
2. Click **"LTS"** (Long-Term Support) — this is the most stable version
3. Download and run the installer for your operating system
4. After installation, open a terminal and verify:
   ```
   node --version
   npm --version
   ```
   You should see version numbers printed, like `v20.18.0` and `10.9.0`.

> **What is Node.js?** It is a program that lets JavaScript code run on your computer (not just inside a browser). Next.js uses it to run your web server.

### Git (Version Control)

Git tracks changes to your code over time and is required by many tools.

1. Go to **https://git-scm.com/downloads**
2. Download and install the version for your operating system
3. Verify installation:
   ```
   git --version
   ```

### A Terminal (Command Prompt)

- **Windows**: Use **PowerShell** (included with Windows). Open it from the Start Menu by searching "PowerShell".
- **Mac**: Use **Terminal** (found in Applications → Utilities)
- **Linux**: Use any terminal emulator

> Throughout this guide, commands starting with `$` should be typed into your terminal (without the `$` symbol).

---

## 2. Install VS Code and Extensions

### Visual Studio Code

VS Code is the code editor used for this project.

1. Go to **https://code.visualstudio.com**
2. Click **Download** for your operating system
3. Run the installer. Accept all defaults.
4. Open VS Code after installation.

### Required Extensions

Extensions add extra features to VS Code. Install them from the **Extensions panel** (the icon that looks like four squares on the left sidebar, or press `Ctrl+Shift+X` / `Cmd+Shift+X`).

Search for and install each of the following:

| Extension Name | Publisher | What It Does |
|---|---|---|
| **GitHub Copilot** | GitHub | AI code completion and chat |
| **GitHub Copilot Chat** | GitHub | Conversational AI assistant inside VS Code |
| **ESLint** | Microsoft | Shows code quality errors inline |
| **Prettier** | Prettier | Automatically formats your code |
| **Tailwind CSS IntelliSense** | Bradlc | Autocomplete for Tailwind class names |
| **TypeScript and JavaScript** | Microsoft | Built-in; improved by this extension |

> **What are extensions?** They are small add-on programs that give VS Code new capabilities, like syntax highlighting, error detection, and AI assistance.

---

### MCP Servers — Install These Before You Start

MCP (Model Context Protocol) servers are the single biggest upgrade you can give Copilot Agent. Without them, Copilot can only read and write files on your machine. With them, it can deploy to Azure, look up official documentation mid-task, browse the web for API specs, and execute cloud operations — all from a single chat message.

> **Set these up now, alongside your extensions.** They require a sign-in or one-time configuration step. Getting that done up front means they're ready to go the moment you need them, and you won't have to stop mid-task to authenticate.

#### What's the difference between an extension and an MCP?

| | Extension | MCP Server |
|---|---|---|
| **What it does** | Adds features to the VS Code editor (autocomplete, linting, highlighting) | Gives Copilot Agent access to external systems and live data |
| **Who uses it** | You — the developer | Copilot Agent — automatically, when relevant |
| **Example** | ESLint highlights a code error | Azure MCP creates an App Registration in your Azure tenant |

#### How to install an MCP in VS Code

Most MCPs are published as VS Code extensions and install the same way:

1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Search for the MCP by name
3. Click **Install**
4. Complete any sign-in prompt that appears
5. The MCP registers itself with Copilot Agent automatically — no further configuration needed

#### MCPs used in this project

| MCP | Publisher | What it enables |
|---|---|---|
| **Azure MCP** | Microsoft | Creates Azure resources, App Registrations, RBAC role assignments, and App Service config — directly from Agent chat |
| **Microsoft Learn MCP** | Microsoft | Fetches current official Microsoft documentation into Copilot's context so answers are based on the latest guidance, not training data |

#### Install: Azure MCP

1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Search **Azure MCP** (publisher: Microsoft) and click **Install**
3. Open a terminal in VS Code and run `az login` — this signs the Azure CLI into your Azure account
   - If `az` is not found, install the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) first, then run `az login`
4. Restart VS Code

Once signed in, Copilot Agent automatically uses the Azure MCP whenever a task involves Azure — you never have to invoke it manually.

#### Install: Microsoft Learn MCP

1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Search **Microsoft Learn MCP** (publisher: Microsoft) and click **Install**
3. No sign-in required — it reads public documentation on demand

> **Real-world impact:** In Section 30, a single prompt — *"Set up GitHub Actions OIDC deployment to Azure App Service"* — causes Copilot to use the Azure MCP to create cloud resources and the Microsoft Learn MCP to pull the current OIDC setup guidance. What would normally be 30 minutes of portal clicks and CLI commands completes in one chat exchange.

---

## 3. Set Up GitHub Copilot and AI Features

### Sign Up for GitHub Copilot

1. Go to **https://github.com/copilot** and sign in with a GitHub account
2. Choose a plan — **Copilot Free** is available and sufficient for this project
3. Authorize the VS Code extension when prompted after installing it

### Understanding the AI Chat Panel

Once GitHub Copilot is installed, you can open the Chat panel by clicking the chat icon in the VS Code sidebar (or pressing `Ctrl+Alt+I` / `Cmd+Alt+I`).

Github Copilot is the AI assistant used to build this entire application. You describe what you want and Github Copilot writes the code.

### Instruction Files (Custom Behavior)

Instruction files tell Copilot how to behave — you can specify coding conventions, language preferences, and context about your project. They live in `.github/copilot-instructions.md` or in your VS Code user settings folder.

A source of good starting instructions is available at https://github.com/github/awesome-copilot.

For this project, the most important instruction files were:
- **`azurecosmosdb.instructions.md`** — Azure Cosmos DB best practices (from the user settings)
- **`azure.instructions.md`** — General Azure guidance

You do **not** need to create these for the EconoMonitor project — they were pre-existing from the VS Code setup and applied automatically.

### MCP Servers

If you followed Section 2, the Azure MCP and Microsoft Learn MCP are already installed and signed in. Here's when Copilot activates each one automatically during this project:

| MCP | When Copilot uses it |
|---|---|
| **Azure MCP** | Section 30 — creating the App Service, App Registration, RBAC assignments, and federated credentials for GitHub Actions |
| **Microsoft Learn MCP** | Section 30 — fetching the current OIDC/Workload Identity Federation setup docs so the implementation follows the latest Microsoft guidance |
| **Built-in web fetch** | Section 25 — reading the FRASER API documentation at `fraser.stlouisfed.org/api-documentation` when you ask Copilot to add the FRASER feature |

No prompt is needed to activate them — Copilot selects the right MCP based on what the task requires.

### Chat Modes

VS Code Copilot Chat supports different modes:

- **Ask** — You ask a question, Github Copilot answers in the chat
- **Plan** — Github Copilot directly works with you to plan the creation.
- **Agent** — Github Copilot uses tools (file reading, terminal commands, web fetch) to reason and act step-by-step

> **For this project, Agent mode was used.** It can read your files, run terminal commands, check for errors, and make targeted edits — all without you needing to copy-paste code manually.

### Beast Mode — The Custom Agent Used for This Project

**Beast Mode** is a custom Copilot agent that combines a broader set of tools, skills, and reasoning strategies than the default Copilot agent. It is what was used to build EconoMonitor — it handles complex, multi-file implementations from a single high-level prompt without needing you to break the work down step by step.

**To use Beast Mode:**
1. Open the Copilot Chat panel (`Ctrl+Alt+I`)
2. Make sure you are in **Agent mode** (the mode selector is at the bottom of the chat input box)
3. Click the agent selector (shows the current agent name, e.g. "GitHub Copilot") and choose **Beast mode** from the list
4. Type your high-level prompt and press Enter

Beast Mode reads your existing files for context, picks the right tools and skills automatically, makes all edits, runs checks, and fixes errors — you just describe the outcome you want.

### Planning Before Coding

Before writing any code, kick off the project by asking Copilot in Agent mode (Beast Mode):

> "I want to build an economic research dashboard called EconoMonitor using the free FRED and FRASER APIs from the Federal Reserve Bank of St. Louis. Plan the full feature set and file structure — dashboard with live metric cards, search, series detail pages, multi-series compare chart, category browser, releases calendar, FRASER historical archive section, and AI-powered insights. Use Next.js with TypeScript, Tailwind CSS, and Chart.js. Keep all API keys on the server side so they never reach the browser."

Copilot then produces a detailed plan covering every page, component, and architectural decision before writing a single line of code.

> **Why plan first?** Planning surfaces decisions early (which charting library? how to handle auth?) so you avoid re-doing work later. Copilot keeps the plan in its context for all subsequent steps.

---

## 4. Understand the AI Workflow — Plan Before You Build

### The General Pattern Used

Every major feature was built using this workflow:

1. **Ask** — Describe the feature in plain English
2. **Copilot plans** — It proposes what files to create or modify
3. **Copilot implements** — It writes the code into your files
4. **Verify** — Run `npx tsc --noEmit` (TypeScript check) and `npm run lint` (code quality check)
5. **Fix** — If there are errors, copy nd paste them to Github Copilot and it attempts to fix them

### Sample Prompts — Full Build Sequence

The following are the actual high-level prompts used to build each part of EconoMonitor. Type these into Copilot Chat in **Agent mode (Beast Mode)**. You don't need to explain *how* to build anything — Beast Mode figures that out from the project context and its built-in skills.

#### Project Foundation

| Step | Prompt |
|------|--------|
| Scaffold project | *"Create a new Next.js app called EconoMonitor for an economic research dashboard. Use TypeScript, Tailwind CSS, and ESLint with all the recommended defaults. Open it in VS Code when done."* |
| Install packages | *"Install everything I'll need for interactive charts, smart data fetching with caching, and a clean icon set."* |
| Theme & colors | *"Set up a modern color system with light and dark mode. Use CSS variables for the colors so switching themes is instant. Accent color should be green. Put the dark mode toggle in the navbar."* |
| Lock down API keys | *"I have FRED and FRASER API keys that must never reach the browser. Set up server-side proxy routes so all API calls go through my Next.js backend, with the keys injected server-side."* |

#### Core Pages

| Step | Prompt |
|------|--------|
| Dashboard | *"Build the home page as a live economic dashboard showing GDP, unemployment, inflation, the Fed Funds Rate, the 10Y-2Y yield spread, and oil prices. Each metric gets a card with the current value, the change from a year ago, and a small trend chart."* |
| Search | *"Add a search page where I can type any economic term and get matching FRED series. Results should be paginated, and the search query should be in the URL so I can share links."* |
| Series detail | *"When I click on any series I want a full detail page — big interactive chart, metadata, 1Y/5Y/10Y/Max range selector, expandable notes, a pin/unpin button, and CSV and JSON download buttons."* |
| Compare | *"Add a compare page where I can overlay multiple economic indicators on the same chart to spot relationships. Make the comparison shareable via URL."* |
| Categories | *"Add a categories browser so I can explore FRED's full topic tree and drill down to find series by subject area."* |
| Releases | *"Add a releases page listing all upcoming FRED data publication dates so I know when new numbers are coming."* |
| Pinned series | *"Let me pin my favorite series so they always show up on my dashboard. Remember the pins between sessions using local storage."* |

#### FRASER Historical Archive

| Step | Prompt |
|------|--------|
| FRASER section | *"The Federal Reserve also has a historical document library called FRASER at fraser.stlouisfed.org. Review the API documentation at https://fraser.stlouisfed.org/api-documentation and add a full FRASER section to the site — themed collections, historical timelines, and individual publication pages."* |

#### AI Features

| Step | Prompt |
|------|--------|
| AI insights panel | *"Add an AI analysis feature. When I'm viewing a series or comparing indicators, I want an Analyze button that sends the data to an AI model and streams back a plain-English economic interpretation with key observations and context."* |
| AI chat page | *"Add an AI chat page where I can have a conversation about the economy and ask questions about any of the FRED series data."* |

#### Polish & Accessibility

| Step | Prompt |
|------|--------|
| Visual polish | *"Review every page and make sure the design is consistent — spacing, font sizes, card shadows, and hover states should all feel cohesive. Fix any rough edges."* |
| Accessibility | *"Audit the entire app for accessibility issues — color contrast, keyboard navigation, focus rings, ARIA labels, and screen reader support. Fix everything you find."* |

#### Deployment

| Step | Prompt |
|------|--------|
| Azure deployment | *"Set up GitHub Actions to automatically deploy this to Azure App Service whenever I push to main. Use OIDC (Workload Identity Federation) so no passwords or secrets are stored — just a trust relationship between GitHub and Azure. Create everything I need in Azure and tell me which values to put in my GitHub secrets."* |

> **How these prompts work:** Beast Mode reads your existing code, picks the right implementation approach, uses Azure MCP for any Azure steps, fetches external documentation when needed, writes all the files, runs `tsc` and ESLint to verify, and fixes any errors — all from a single plain-English prompt.

---

## 5. Scaffold the Project

### Create the Project

Open your terminal, navigate to where you want the project, and run:

```
cd c:\repos
npx create-next-app@latest EconoMonitor
```

You will be asked a series of questions. Answer them as follows:

```
Would you like to use TypeScript?         → Yes
Would you like to use ESLint?             → Yes
Would you like to use Tailwind CSS?       → Yes
Would you like your code inside a `src/` directory? → No
Would you like to use App Router?         → Yes
Would you like to use Turbopack?          → Yes
Would you like to customize the import alias? → Yes
What import alias would you like configured? → @/*
```

> **What does this do?** It creates a folder called `EconoMonitor` with a complete Next.js project inside it — similar to an empty starter kit.

### Open the Project in VS Code

```
cd EconoMonitor
code .
```

This opens the current folder in VS Code.

### What Was Scaffolded

After creation, your project contains:

```
EconoMonitor/
  app/
    globals.css       ← Global styles
    layout.tsx        ← Root HTML wrapper (applied to all pages)
    page.tsx          ← Homepage (/)
  public/             ← Static assets (images, fonts, icons)
  next.config.ts      ← Next.js configuration
  tsconfig.json       ← TypeScript configuration
  package.json        ← Project metadata and dependencies list
  eslint.config.mjs   ← ESLint (code quality) configuration
```

### Understanding the App Router

Next.js App Router organizes your app by **folder = page**:
- `app/page.tsx` → the homepage at `/`
- `app/search/page.tsx` → the search page at `/search`
- `app/series/[seriesId]/page.tsx` → a dynamic page at `/series/GDP`, `/series/UNRATE`, etc.

> Folder names in square brackets (`[seriesId]`) are **dynamic segments** — the value in the URL becomes available as a variable in your code.

---

## 6. Install Dependencies

In your terminal (inside the `EconoMonitor` folder):

```
npm install chart.js react-chartjs-2 chartjs-adapter-date-fns date-fns @tanstack/react-query lucide-react
```

### What Each Package Does

| Package | Purpose |
|---|---|
| `chart.js` | The core charting library — draws line charts, bar charts, etc. on an HTML `<canvas>` element |
| `react-chartjs-2` | React wrapper for Chart.js — lets you use Chart.js as React components |
| `chartjs-adapter-date-fns` | Teaches Chart.js how to format dates on chart axes (uses `date-fns` internally) |
| `date-fns` | A library of date/time formatting and manipulation utilities |
| `@tanstack/react-query` | Manages server-state (API data fetching, caching, loading/error states) in React |
| `lucide-react` | A collection of clean, consistent SVG icons as React components |

> **Why React Query?** Without it, every component would independently fetch data — causing duplicate network requests and no caching. React Query centralizes and caches API calls so the same data is only fetched once per 5 minutes.

---

## 7. Configure Tailwind CSS and Theme Variables

### How Tailwind Works in This Project

Tailwind CSS v4 (used here) is configured by importing it in `globals.css`. No separate `tailwind.config.js` file is needed:

**`app/globals.css`:**
```css
@import "tailwindcss";

/* Class-based dark mode — the .dark class on <html> triggers the dark theme */
@custom-variant dark (&:where(.dark, .dark *));
```

### CSS Custom Properties (Design Tokens)

Instead of hard-coding color values throughout the code, custom properties (CSS variables) define the color scheme in one place:

```css
:root {
  --bg:         #f8fafc;   /* Page background — light gray */
  --surface:    #ffffff;   /* Card backgrounds — white */
  --surface-2:  #f1f5f9;   /* Slightly darker surface for table headers, etc. */
  --border:     #e2e8f0;   /* Border color */
  --text:       #0f172a;   /* Primary text — near-black */
  --text-muted: #64748b;   /* Secondary text — gray */
  --accent:     #10b981;   /* Brand green for buttons, highlights */
  --red:        #ef4444;   /* Error/negative indicators */
  --blue:       #3b82f6;   /* Info/FRASER section */
}

.dark {
  --bg:         #0f172a;   /* Deep navy */
  --surface:    #1e293b;
  --surface-2:  #0f172a;
  --border:     #334155;
  --text:       #f1f5f9;   /* Light gray text */
  --text-muted: #94a3b8;
  --accent:     #10b981;
  --red:        #f87171;
  --blue:       #60a5fa;
}
```

In JSX, these are used as inline styles: `style={{ color: 'var(--text)' }}`. This works for HTML elements. However — see [Issue #1 in Section 26](#issue-1-css-custom-properties-do-not-work-inside-chartjs-canvas) — it does **not** work inside Chart.js canvas elements.

> **Why inline styles instead of Tailwind classes?** Tailwind v4 does not yet have built-in support for arbitrary CSS variables across dark/light mode transitions via the class strategy in all scenarios. Inline styles with CSS variables give reliable results and are the approach used by the existing app architecture.

---

## 8. Configure Next.js and TypeScript

### `next.config.ts`

The only configuration needed was to fix a Turbopack root detection warning caused by having multiple `package-lock.json` files in parent directories:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,  // Explicitly tell Turbopack this folder is the project root
  },
};

export default nextConfig;
```

### `tsconfig.json`

Key settings used:

```json
{
  "compilerOptions": {
    "strict": true,          // Enables all strict type checks
    "paths": {
      "@/*": ["./*"]         // @/components/... maps to components/... from project root
    }
  }
}
```

> **Why `@/*`?** Without it, import paths become long and fragile: `import ... from '../../../components/Navbar'`. With the alias: `import ... from '@/components/Navbar'` — always correct regardless of file depth.

---

## 9. Get Your API Keys

EconoMonitor uses two separate APIs, each requiring its own free key. This section explains what each API provides, who offers it, what you get access to, and exactly how to obtain the key.

---

### FRED — Federal Reserve Economic Data

#### What FRED Is

**FRED** is a database maintained by the **Federal Reserve Bank of St. Louis** containing over **800,000 economic time-series** from more than 100 sources. It is one of the most widely used economic data platforms in the world, used by economists, researchers, journalists, and financial professionals.

FRED covers:
- **Macroeconomic indicators** — GDP, unemployment rate, inflation (CPI, PCE), industrial production
- **Monetary policy data** — Federal Funds Rate, money supply (M1, M2), bank reserves
- **Labor market** — Payroll employment, labor force participation, jobless claims
- **Prices** — Consumer prices, producer prices, housing prices, energy prices
- **Financial markets** — Treasury yields, mortgage rates, corporate spreads, exchange rates
- **International** — Trade balances, foreign exchange rates, international GDP comparisons
- **Regional** — State-level unemployment, housing starts, income data

The FRED API gives programmatic access to all of this data. EconoMonitor uses it to power the Dashboard, Search, Series Detail, Compare, Categories, and Releases pages.

#### FRED API — What It Provides to EconoMonitor

| Feature | FRED Endpoint Used |
|---|---|
| Search for series by keyword | `series/search` |
| Fetch metadata for a series (title, units, frequency) | `series` |
| Fetch all historical observations (dates + values) | `series/observations` |
| Browse the category tree | `category`, `category/children`, `category/series` |
| List all data releases | `releases` |
| List upcoming release dates | `releases/dates` |

#### Getting Your FRED API Key (Step by Step)

The FRED API key is completely free. There is no paid tier — everyone who signs up gets the same full access.

1. Go to **https://fred.stlouisfed.org**
2. Click **"My Account"** in the top-right corner, then click **"Create New Account"**
3. Fill in your name, email address, and a password. Accept the terms of use.
4. Check your email for a verification link and click it to confirm your account.
5. Sign in to your new account.
6. Go directly to **https://fred.stlouisfed.org/docs/api/api_key.html**
7. Click the **"Request API Key"** button.
8. Fill in the short form:
   - **Name:** Your name or application name (e.g., `EconoMonitor`)
   - **Contact Email:** Your email
   - **Description:** A brief description (e.g., `Personal economic research dashboard`)
9. Click **"Request API Key"**.
10. Your 32-character key is shown immediately on the page. **Copy it now** — you will paste it into `.env.local`.

Your key looks like: `4229cbd34d9a7cd03c435aae8f9cea3e`

> **Rate limits:** The FRED API allows 120 requests per minute per key. EconoMonitor uses React Query's 5-minute caching, so in normal use you will stay well within this limit.

---

### FRASER — Federal Reserve Archival System for Economic Research

#### What FRASER Is

**FRASER** is a digital library, also operated by the **Federal Reserve Bank of St. Louis**, that preserves and provides access to historical U.S. economic, financial, and banking documents. While FRED contains raw data (numbers), FRASER contains the **documents and context behind those numbers**.

FRASER's collection includes:
- **Federal Reserve publications** — Annual reports, bulletins, policy statements, and research going back to 1914
- **U.S. Treasury documents** — Budget reports, Treasury bulletins, debt statistics
- **Banking statistics** — Historical bank directories, call report data, Federal Reserve banking statistics
- **Congressional testimony** — Congressional hearings on economic and monetary policy
- **Biographical records** — Records of Federal Reserve officials (e.g., Paul Volcker, Ben Bernanke)
- **Themed collections** — Curated sets of documents around major economic events (Great Depression, 2008 Financial Crisis, bank panics)
- **Historical timelines** — Chronological event records tracing major episodes in economic history

FRASER is invaluable for understanding *why* economic data looks the way it does at certain points in history — the primary source documents are right there alongside the data.

#### FRASER API — What It Provides to EconoMonitor

| Feature | FRASER Endpoint Used |
|---|---|
| Browse themed topic collections | `theme`, `theme/{id}`, `theme/{id}/records` |
| Browse historical timelines | `timeline`, `timeline/{id}`, `timeline/{id}/events` |
| View a title (publication) and its items | `title/{id}`, `title/{id}/items` |
| View an individual document/item | `item/{id}` |

#### Getting Your FRASER API Key (Step by Step)

FRASER uses a different method from FRED — instead of filling out a web form, you request a key by sending a small web request from your terminal. This is done with a tool called **`curl`**.

> **What is `curl`?** `curl` is a command-line program that sends HTTP requests — the same kind your browser makes when you load a page. It is pre-installed on Windows 10 and later, macOS, and all Linux distributions. Open your terminal and type `curl --version` to confirm it is available.

**Steps:**

1. Open your terminal (PowerShell on Windows, Terminal on Mac/Linux).
2. Run the following command, replacing the email address with your own:

   ```
   curl --data '{"email":"you@example.com","description":"EconoMonitor"}' https://fraser.stlouisfed.org/api-documentation/rest-api
   ```

   On **Windows PowerShell**, if the above fails due to quote handling, use this version instead:

   ```
   curl --data '{\"email\":\"you@example.com\",\"description\":\"EconoMonitor\"}' https://fraser.stlouisfed.org/api-documentation/rest-api
   ```

3. The FRASER server responds immediately with a JSON object containing your key:

   ```json
   {"api_key":"1234abcdefg"}
   ```

4. **Copy the value** after `"api_key":` (without the quotes). That is your key.

> **Rate limits:** The FRASER API allows 30 requests per minute per key. EconoMonitor uses 30–60 minute caching for FRASER content (which rarely changes), so this limit will never be reached in normal use.

---

### Store Both Keys in `.env.local`

Create a file called `.env.local` in the project root (`c:\repos\EconoMonitor\.env.local`). Paste both keys:

```
# FRED API key — get one free at https://fred.stlouisfed.org/docs/api/fred/
Click 'Tools' → 'FRED API'
FRED_API_KEY=your_fred_key_here

# FRASER API key — request via curl:
#   curl --data '{"email":"you@example.com","description":"EconoMonitor"}' https://fraser.stlouisfed.org/api/api_key
FRASER_API_KEY=your_fraser_key_here
```

After saving the file, restart the development server (`Ctrl+C` to stop, then `npm run dev` to start again).

> **Do not share this file.** The `.gitignore` file created by `create-next-app` already lists `.env.local`, so it will never be accidentally committed to version control. These keys are only used on the server side — they are never sent to the user's browser. See Section 10 for how the proxy enforces this.

#### Side-by-Side API Comparison

| | FRED | FRASER |
|---|---|---|
| **Operated by** | Federal Reserve Bank of St. Louis | Federal Reserve Bank of St. Louis |
| **Type of content** | Quantitative data (time-series observations) | Historical documents and archival records |
| **Primary use in EconoMonitor** | Charts, data tables, search, compare | Themed collections, timelines, document library |
| **Key request method** | Web form at fred.stlouisfed.org | `curl` POST request to API endpoint |
| **Authentication method** | `?api_key=` query parameter | `X-API-Key` HTTP request header |
| **Rate limit** | 120 requests/minute | 30 requests/minute |
| **Cache duration used** | 5 minutes | 30–60 minutes |
| **Cost** | Free | Free |

---

## 10. Build the API Proxy Routes

### Why a Proxy?

The FRED and FRASER APIs require an API key. If you called those APIs directly from the browser (client-side), the key would be visible to anyone who opened the browser's developer tools. The solution is a **server-side proxy**:

1. Browser → requests `/api/fred/series?series_id=GDP`
2. Next.js server → receives the request, **appends the API key**, forwards to FRED
3. FRED → returns data to the server
4. Server → sends data back to browser (without ever exposing the key)

### FRED Proxy: `app/api/fred/[...path]/route.ts`

The `[...path]` folder name is a **catch-all route** — it matches any URL like `/api/fred/series`, `/api/fred/series/search`, `/api/fred/series/observations`, etc.

```typescript
import { NextRequest, NextResponse } from 'next/server';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FRED_API_KEY environment variable is not configured.' },
      { status: 500 },
    );
  }

  const { path } = await params;
  const fredUrl = new URL(`${FRED_BASE}/${path.join('/')}`);

  // Copy all incoming query parameters to the upstream URL
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'api_key') {  // Strip any api_key the client tries to send
      fredUrl.searchParams.set(key, value);
    }
  });

  // Inject API key server-side — this is never visible to the browser
  fredUrl.searchParams.set('api_key', apiKey);
  fredUrl.searchParams.set('file_type', 'json');

  const upstream = await fetch(fredUrl.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },  // Cache this response for 5 minutes
  });

  const data = await upstream.json();
  return NextResponse.json(data);
}
```

### FRASER Proxy: `app/api/fraser/[...path]/route.ts`

FRASER authenticates differently — it expects the key as a **request header** (`X-API-Key`), not a query parameter:

```typescript
const upstream = await fetch(fraserUrl.toString(), {
  headers: {
    Accept: 'application/json',
    'X-API-Key': apiKey,  // Header-based auth — different from FRED
  },
  next: { revalidate: 3600 },  // 1-hour cache — archival content rarely changes
});
```

> **Caching difference:** FRED economic data updates frequently (daily/weekly), so a 5-minute cache is used. FRASER contains historical documents that almost never change, so a 1-hour cache is appropriate.

---

## 11. Build the Typed API Clients

### What is Type Safety?

TypeScript lets you define the **shape** of data. When you tell TypeScript "this API returns an object with a `title` field of type `string`", it warns you if you accidentally try to use it as a number. This catches bugs before the code even runs.

### `lib/fred.ts`

This file defines the data shapes (interfaces) and the functions that call the proxy:

```typescript
// This interface describes one economic time-series from FRED
export interface FredSeries {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  units: string;
  last_updated: string;
  popularity: number;
  notes?: string;  // The ? means this field is optional
}

// This interface describes one data point (date + value)
export interface FredObservation {
  date: string;
  value: string;  // FRED returns numbers as strings; "." means "no data"
}

// Internal helper — all API calls go through here
async function fredFetch<T>(path: string, params = {}): Promise<T> {
  const url = `/api/fred/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  return res.json();
}

// Public functions for each API endpoint
export async function searchSeries(query: string, offset = 0) {
  return fredFetch<{ seriess: FredSeries[]; count: number }>('series/search', {
    search_text: query,
    offset: String(offset),
    order_by: 'popularity',
    sort_order: 'desc',
  });
}
```

### `lib/fraser.ts`

FRASER's data is more complex — its API returns mixed-type arrays (a field might be either a plain string or an object). Helper extractor functions hide this complexity from the rest of the app:

```typescript
// FRASER's url field can be: string | { $: string; '@access'?: string }
// This helper always returns a plain string
export function extractUrl(location?: FraserLocation): string {
  const first = location?.url?.[0];
  if (typeof first === 'string') return first;
  return first?.$ ?? '#';
}
```

---

## 12. Build the React Query Hooks

### What is React Query?

React Query manages data fetching in React. Instead of writing `useEffect(() => { fetch(...).then(...) }, [])` in every component, you call a hook like `useSeriesSearch('GDP')` and get back `{ data, isLoading, error }` — React Query handles caching, stale-time, retries, and deduplication automatically.

### `hooks/useFredQuery.ts`

```typescript
'use client';  // This file only runs in the browser

import { useQuery } from '@tanstack/react-query';
import { searchSeries } from '@/lib/fred';

export function useSeriesSearch(query: string, offset = 0) {
  return useQuery({
    queryKey: ['series-search', query, offset],  // Cache key — same key = same cached result
    queryFn: () => searchSeries(query, offset),  // The function that fetches data
    enabled: query.trim().length > 0,            // Don't fetch if query is empty
    staleTime: 5 * 60 * 1000,                   // Data stays "fresh" for 5 minutes
  });
}
```

### `hooks/useFraserQuery.ts`

The FRASER hooks follow the same pattern but with longer stale times:

```typescript
export function useThemes() {
  return useQuery({
    queryKey: ['fraser', 'themes'],
    queryFn: () => getThemes(),
    staleTime: 30 * 60 * 1000,  // 30 minutes — archival themes rarely change
  });
}
```

---

## 13. Build the Root Layout and Providers

### `app/layout.tsx`

The root layout wraps every page in the app. It imports the global CSS, loads fonts, and renders the `Providers` and `Navbar` components:

```typescript
import { Providers } from "@/components/layout/Providers";
import { Navbar } from "@/components/layout/Navbar";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-6">
            {children}  {/* Each page renders here */}
          </main>
        </Providers>
      </body>
    </html>
  );
}
```

### `components/layout/Providers.tsx`

This component provides two things to all child components:

1. **Theme context** — which mode (light/dark) is active; a `toggle` function to switch
2. **React Query client** — makes caching available to all hooks

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a React context — any component can call useTheme() to get dark/toggle
const ThemeContext = createContext({ dark: false, toggle: () => {} });
export function useTheme() { return useContext(ThemeContext); }

// React Query client — configured once, shared across the whole app
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 2 } },
});

export function Providers({ children }) {
  const [dark, setDark] = useState(false);

  // On first mount, read the saved theme preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('econoMonitor:theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored !== null ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDark);  // See Issue #3 in Section 26 for why this comment is needed
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeContext.Provider>
  );
}
```

> **Why `'use client'`?** Next.js App Router renders components on the server by default. Components that use browser APIs (`localStorage`, `window`, React state/effects) must be marked `'use client'` to opt into client-side rendering.

---

## 14. Build the Navbar

### `components/layout/Navbar.tsx`

The Navbar renders at the top of every page. It contains:
- The app logo
- A global search bar (navigates to `/search?q=...`)
- Navigation links
- A dark mode toggle button

Key implementation detail — the navigation links array makes it easy to add new pages:

```typescript
const NAV = [
  { href: '/',           label: 'Dashboard',  icon: TrendingUp },
  { href: '/search',     label: 'Search',     icon: Search },
  { href: '/compare',    label: 'Compare',    icon: GitCompare },
  { href: '/categories', label: 'Categories', icon: List },
  { href: '/releases',   label: 'Releases',   icon: Tag },
  { href: '/fraser',     label: 'FRASER',     icon: BookOpen },
];
```

When the FRASER feature was added, only one line needed to be added to this array.

---

## 15. Build the Utility Library

### `lib/utils.ts`

Shared helper functions used across many components:

```typescript
// Format a FRED date string (YYYY-MM-DD) to "Jan 15, 2024"
export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// Format a FRED value with appropriate units
// e.g. "1234.5" with units "Percent" → "1234.50%"
// e.g. "26.5" with units "Trillions of Dollars" → "$26.500T"
export function formatValue(value: string, units = ''): string {
  if (value === '.' || value === '') return 'N/A'; // FRED uses "." for missing data
  const num = parseFloat(value);
  // ... unit-specific formatting
}

// Download data as a CSV file
export function exportToCSV(data, filename) { ... }

// Download data as a JSON file
export function exportToJSON(data, filename) { ... }
```

---

## 16. Build the Pinned Series Hook

### `hooks/usePinnedSeries.ts`

This hook lets users "pin" their favorite economic series (like bookmarks). The pinned list is saved to `localStorage` so it persists across page visits.

```typescript
const DEFAULT_PINNED = ['GDP', 'UNRATE', 'CPIAUCSL', 'DFF', 'T10Y2Y', 'DCOILWTICO'];

export function usePinnedSeries() {
  const [pinned, setPinned] = useState<string[]>(DEFAULT_PINNED);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Read saved pins from localStorage after the component mounts in the browser
    const stored = localStorage.getItem('econoMonitor:pinned');
    if (stored) {
      const parsed = JSON.parse(stored);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinned(parsed);  // See Issue #3 in Section 26
    }
    setHydrated(true);  // Signal that localStorage has been read
  }, []);

  // ... pin, unpin, toggle functions
  return { pinned, pin, unpin, toggle, isPinned, hydrated };
}
```

> **What is `hydrated`?** Because Next.js renders components on the server first (which has no `localStorage`), the initial render uses the default pins. After the browser loads the page, `useEffect` reads the saved pins. The `hydrated` flag tells components when this process is complete, preventing a flash of wrong content.

---

## 17. Build the Chart Components

### Understanding the Chart Color Problem (and Its Fix)

> This is one of the most important issues encountered. See [Issue #1 in Section 26](#issue-1-css-custom-properties-do-not-work-inside-chartjs-canvas) for full details.

**The problem:** Chart.js draws to an HTML `<canvas>` element. CSS custom properties (like `var(--text-muted)`) do not work inside canvas. If you write:

```typescript
// This looks correct but does NOT work in canvas:
ticks: { color: 'var(--text-muted)' }
```

Chart.js silently ignores the invalid color value, leaving axis labels black — invisible on a dark background.

**The fix:** Import `useTheme()` and compute real hex color strings at render time:

```typescript
const { dark } = useTheme();

// These are real hex values that canvas understands
const gridColor  = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
const tickColor  = dark ? '#94a3b8' : '#64748b';
const tooltipBg  = dark ? '#1e293b' : '#ffffff';
```

Then use these variables in the Chart.js configuration:

```typescript
scales: {
  x: {
    ticks: { color: tickColor },   // Works in canvas ✓
    grid: { color: gridColor },    // Works in canvas ✓
  },
}
```

### `components/charts/SeriesChart.tsx`

Renders a single-series line chart with fill underneath the line:

```typescript
<Line
  data={{
    datasets: [{
      label: title,
      data: points,            // Array of { x: '2024-01-15', y: 1234.5 }
      borderColor: color,      // Line color
      backgroundColor: rgba,  // Fill color (semi-transparent)
      fill: true,
      tension: 0.2,            // Slight curve on the line
    }],
  }}
  options={{
    scales: {
      x: { type: 'time', ... },  // X-axis shows dates
    },
  }}
/>
```

### `components/charts/CompareChart.tsx`

Renders multiple series overlaid on the same chart. If the series have very different scales (e.g., GDP in trillions vs. unemployment rate as a percentage), it automatically adds a second Y-axis:

```typescript
// If the value ranges differ by more than 100×, use dual axes
const needsDualAxis = maxRange / minRange > 100;
```

### `components/dashboard/SparklineChart.tsx`

A tiny mini-chart used in dashboard metric cards. It shows just the line (no axes, no labels, no tooltip) — just the trend shape.

---

## 18. Build the Dashboard Page

### `app/page.tsx`

The Dashboard (`/`) is the home page. It shows:
- A grid of **MetricCard** components for the default pinned series
- A strip of recent FRED data releases at the bottom

Each MetricCard shows the series title, the latest value, the change from a year ago, and a sparkline chart.

```
Dashboard
├── Header (EconoMonitor title + subtitle)
├── MetricCard grid (6 pinned series)
│   ├── MetricCard: GDP         → SparklineChart
│   ├── MetricCard: UNRATE      → SparklineChart
│   └── ... (4 more)
└── Recent Releases strip
```

---

## Section 29 — AI Economic Insights

### 29.1 Overview

EconoMonitor includes an AI analysis feature that sends FRED series data to a large language model and streams back a structured economic interpretation in plain English.

**What it does:**
- Downsamples each selected series to ≤60 representative data points
- Computes summary statistics (min, max, latest value, 12-period trend)
- Sends all series as a compact CSV-style prompt to gpt-4o
- Streams the response token-by-token back to the browser
- Renders the structured output with section headings, bold text, and bullet lists

**Where the panel appears:**
| Page | Condition |
|---|---|
| `/series/[seriesId]` | When the series has valid observations |
| `/compare` | When at least one series is added to the chart |
| `/insights` | Dedicated page — series picker + insights panel |

**Cost:** Free while using the GitHub Models API (rate-limited per PAT). Optional Azure OpenAI upgrade described in Section 29.4.

---

### 29.2 Getting a GitHub Token

GitHub Models gives free access to gpt-4o and other frontier models with a personal access token.

**Step-by-step:**

1. Go to [https://github.com](https://github.com) and sign in (or create an account).
2. Click your profile photo (top-right) → **Settings**.
3. Scroll to the bottom of the left sidebar → **Developer settings**.
4. Click **Personal access tokens** → **Tokens (classic)**.
5. Click **Generate new token** → **Generate new token (classic)**.
6. Give it a descriptive name, e.g. `economonitor-models`.
7. Set an expiration (90 days is a good starting point).
8. Under **Select scopes**, tick **`read:packages`** — GitHub Models does not require a dedicated "Models" scope for classic tokens; the token just needs to be valid.
    > Note: Some interfaces show a `models:read` scope for fine-grained tokens. If available, prefer a fine-grained token scoped only to Models access.
9. Click **Generate token** and copy it immediately — it will not be shown again.
10. Paste it into `.env.local`:
    ```
    GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    ```
11. Restart the dev server (`Ctrl+C` then `npm run dev`).

**To verify it works:** Open `/series/GDP`, scroll to the AI Insights panel, click **Analyze**. Text should begin streaming within 2–4 seconds.

---

### 29.3 Architecture

```
Browser
  └── InsightsPanel (components/ai/InsightsPanel.tsx)
        └── useAiAnalysis (hooks/useAiAnalysis.ts)
              └── POST /api/ai/analyze   (app/api/ai/analyze/route.ts)
                    ├── buildSystemPrompt  (lib/ai.ts)
                    ├── buildUserPrompt    (lib/ai.ts)
                    │     └── downsampleSeries (lib/ai.ts)
                    └── OpenAI SDK → GitHub Models API (models.inference.ai.azure.com)
                                        ↓ streamed plain text
                    ReadableStream → Response
              ↑ getReader() + TextDecoder → incremental state updates
        └── renderMarkdown (inline renderer — no external deps)
```

**Key files:**

| File | Role |
|---|---|
| `lib/ai.ts` | `AnalyzeDataset` type, `downsampleSeries`, `buildSystemPrompt`, `buildUserPrompt` |
| `app/api/ai/analyze/route.ts` | Server-side POST — validates input, calls OpenAI SDK, streams response |
| `hooks/useAiAnalysis.ts` | React state + streaming reader + AbortController |
| `components/ai/InsightsPanel.tsx` | Collapsible UI panel with mini-markdown renderer |
| `app/insights/page.tsx` | Standalone `/insights` page with full series picker |

**Why `runtime = 'nodejs'` in the route?**
The OpenAI Node.js SDK uses `node:stream` and `node:http` internally. Next.js defaults to the Edge runtime for API routes, which does not support those Node.js APIs. Setting `export const runtime = 'nodejs'` in `route.ts` forces the Route Handler to use the full Node.js runtime.

**Why plain text instead of SSE?**
Server-Sent Events (SSE) require a specific `data: ...\n\n` framing format. Using raw chunked plain text (`Content-Type: text/plain; charset=utf-8`) is simpler — the client just reads the stream with `getReader()` and appends chunks to state as they arrive.

**Prompt token budget:**
- System prompt: ~350 tokens
- User prompt: ~1,200–1,800 tokens (6 series × 60 points × ~5 tokens/row)
- Response budget: 2,048 tokens
- Total: well within gpt-4o's 128k context window

---

### 29.4 Optional: Switch to Azure OpenAI

If you need higher rate limits, SLA guarantees, or want to keep data within your Azure tenant, you can route AI calls through your own Azure OpenAI deployment. The exact same OpenAI SDK call is used — only the base URL, API key, and model name change.

**Step 1 — Create an Azure OpenAI resource:**
1. Log in to [portal.azure.com](https://portal.azure.com).
2. Search for **Azure OpenAI** → **Create**.
3. Fill in subscription, resource group, region (e.g. `East US`), and a resource name.
4. Select **Standard S0** pricing tier → **Review + create** → **Create**.

**Step 2 — Deploy gpt-4o:**
1. Once the resource is created, open it → **Model deployments** → **Manage deployments**.
2. Click **Deploy model** → select `gpt-4o` (or `gpt-4o-mini`).
3. Give the deployment a name (e.g. `gpt-4o`) and click **Deploy**.

**Step 3 — Get your endpoint and key:**
1. In the Azure OpenAI resource, go to **Keys and Endpoint**.
2. Copy **Key 1** and the **Endpoint** URL (format: `https://<your-resource>.openai.azure.com`).

**Step 4 — Set the three environment variables in `.env.local`:**
```bash
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<your-key-1>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```
Leave `GITHUB_TOKEN` in place — it will be ignored automatically when the Azure vars are present.

**Step 5 — Restart the dev server.**
The route checks `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` first. If both are set, Azure OpenAI is used; otherwise it falls back to GitHub Models.

No code changes are needed — the route already handles both paths:
```typescript
// app/api/ai/analyze/route.ts (already implemented)
const useAzure = Boolean(azureEndpoint && azureKey);
const client = useAzure
  ? new OpenAI({ baseURL: `${azureEndpoint}/openai/deployments/${azureDeployment}`, ... })
  : new OpenAI({ baseURL: 'https://models.inference.ai.azure.com', apiKey: githubToken });
```

---

### 29.5 Optional: Switch to Microsoft Foundry

Microsoft AI Foundry offers a managed model deployment layer on top of Azure AI, with additional monitoring, prompt evaluation, and safety filter capabilities.

**Additional steps on top of Section 29.4:**

1. In the Azure portal, navigate to your **Azure AI Foundry** hub or create one via the [Azure AI Foundry portal](https://ai.azure.com).
2. Inside Foundry, deploy `gpt-4o` from the **Model catalog**. This creates a Foundry-managed deployment with its own endpoint URL (different from the raw Azure OpenAI endpoint).
3. Use the Foundry deployment's **endpoint** and **API key** (found in the deployment detail page) in place of the Azure OpenAI values in Step 4 above. The endpoint format will be similar but routed through the Foundry infrastructure.

The application code requires no changes — the route sends the same OpenAI-SDK-formatted `chat.completions.create` call regardless of whether the endpoint is raw Azure OpenAI or Foundry-managed.

---

### 29.6 Security Notes

- `GITHUB_TOKEN`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_ENDPOINT` are read only inside `app/api/ai/analyze/route.ts`, which is a server-side Route Handler. They are never included in the client JavaScript bundle.
- Series IDs submitted to the route are validated against the pattern `^[A-Z0-9_\-]{1,30}$` before being forwarded. This prevents injection via the `seriesId` field.
- Observation values are numbers or the sentinel `'.'` — they are sent as-is to the prompt without further sanitization, which is appropriate for trusted FRED API data.
- The route returns `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` on every AI response.


---

## 19. Build the Search Page

### `app/search/page.tsx`

The Search page (`/search`) lets users find any FRED economic series:

- URL-driven: the search query is stored in the URL (`/search?q=inflation`), so search results are shareable
- **Debounced input:** Typing triggers the search after a 300ms pause, not on every keystroke — prevents flooding the API
- Paginated results (20 per page)

```typescript
// Read the search query from the URL, not from component state
const searchParams = useSearchParams();
const initialQuery = searchParams.get('q') ?? '';

// Debounce: don't search until user stops typing
useEffect(() => {
  const timer = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(timer);  // Cancel if they keep typing
}, [query]);
```

---

## 20. Build the Series Detail Page

### `app/series/[seriesId]/page.tsx`

Accessed at `/series/GDP`, `/series/UNRATE`, etc. Displays:
- Series metadata (title, source, frequency, units, seasonal adjustment)
- Range selector: 1Y, 5Y, 10Y, Max
- Full-size line chart
- Expandable "Notes" section (the FRED description for the series)
- Pin/Unpin button
- Export buttons (CSV, JSON)
- Link to the Compare page with this series pre-selected

The `seriesId` is extracted from the URL:
```typescript
const { seriesId } = useParams<{ seriesId: string }>();
```

---

## 21. Build the Compare Page

### `app/compare/page.tsx`

Accessed at `/compare`. Lets users overlay up to 6 series on one chart to visually compare them.

Features:
- **URL-shareable:** Selected series are stored in the URL query string (`/compare?ids=GDP,UNRATE`), so the comparison can be shared
- **Search to add series:** Type a series ID or name to add it
- **Pinned series dropdown:** A chevron button on the search input opens a dropdown showing all pinned series — click any to add it instantly

The dropdown fix (adding the chevron and pin list) was an enhancement requested after initial implementation.

---

## 22. Build the Categories Pages

### `app/categories/page.tsx` and `app/categories/[categoryId]/page.tsx`

FRED organizes series into a nested category tree (like folders within folders). These pages let users browse that tree and click through to find series.

---

## 23. Build the Releases Page

### `app/releases/page.tsx`

Shows all FRED data releases in a paginated table — useful for finding recently published data.

---

## 24. Build the Export Button

### `components/ExportButton.tsx`

A dropdown button that appears on the Series Detail page, offering download options:
- **CSV** (comma-separated values) — Opens in Excel/Numbers
- **JSON** — Machine-readable format for developers

The download is triggered entirely in the browser — no server required:

```typescript
function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);  // Create a temporary URL for the file
  const a = document.createElement('a');  // Create a hidden link
  a.href = url;
  a.download = filename;
  a.click();                              // Trigger the download
  URL.revokeObjectURL(url);              // Clean up the temporary URL
}
```

---

## 25. Build the FRASER Section

### What is FRASER?

FRASER (Federal Reserve Archival System for Economic Research) is a digital library of historical economic and financial documents — Federal Reserve annual reports, congressional testimonies, banking statistics publications going back to the 1800s, biographical records of Fed officials, and more.

The FRASER API provides access to:
- **Themes** — Curated topic collections (e.g., "The Great Depression", "Bank Panics", "Monetary Policy")
- **Timelines** — Chronological event records (e.g., the 2007-2009 Financial Crisis timeline)
- **Titles** — Individual publications (books, reports, periodicals)
- **Items** — Individual documents within a title (e.g., the January 1945 issue of Federal Reserve Bulletin)

### Why FRASER was Added

The FRED API covers quantitative data (numbers and charts). FRASER complements it with qualitative historical context — the documents and narratives behind the numbers.

### API Key Request Difference

Unlike FRED (which gives you a key via a web form), FRASER requires a `POST` request:

```bash
curl --data '{"email":"your@email.com","description":"EconoMonitor"}' \
  https://fraser.stlouisfed.org/api/api_key
```

The response contains your key immediately. This was run successfully in the terminal and the key was stored in `.env.local`.

### Authentication Difference

FRED: Key goes in the URL as `?api_key=...`  
FRASER: Key goes in the HTTP request headers as `X-API-Key: ...`

The server-side proxy handles this transparently — client code never deals with authentication.

### Pages Built

| Path | Description |
|---|---|
| `/fraser` | Hub page — theme grid + timeline list + API key setup instructions |
| `/fraser/themes/[themeId]` | Theme detail — abstract, topic tags, paginated records |
| `/fraser/timelines/[timelineId]` | Timeline viewer — chronological event cards |
| `/fraser/title/[titleId]` | Title detail — metadata, creators, paginated items with PDF links |

### API Key Not Yet Configured Warning

The hub page (`/fraser`) detects when the API key is missing and shows a helpful inline notice with the exact `curl` command needed:

```typescript
const apiKeyMissing =
  themes.error instanceof Error &&
  themes.error.message.includes('not configured');
```

---

## 26. Issues Encountered and How They Were Fixed

This section documents every significant problem that came up during development.

---

### Issue #1: CSS Custom Properties Do Not Work Inside Chart.js Canvas

**When it appeared:** After building the chart components.

**Symptom:** Charts appeared very dark — the grid lines and axis tick labels were invisible against dark backgrounds. In light mode, the tooltips had incorrect backgrounds.

**Root cause:** Chart.js renders onto an HTML `<canvas>` element using the browser's 2D Canvas API. CSS custom properties like `var(--text-muted)` are part of the CSS cascade and are only resolved by the CSS engine — the Canvas API does not go through the CSS engine and so cannot resolve them. Chart.js silently ignores the unresolved values, leaving the canvas styling broken.

This is a well-known limitation: CSS variables work on HTML elements (like `<div>`, `<p>`) but **not** inside canvas rendering contexts.

**The fix:** In both `SeriesChart.tsx` and `CompareChart.tsx`, import `useTheme()` and compute actual hex/rgba color strings at render time, then pass those real values to Chart.js:

```typescript
// Before (broken — canvas cannot resolve CSS vars):
ticks: { color: 'var(--text-muted)' }
grid:  { color: 'color-mix(in srgb, var(--border) 60%, transparent)' }

// After (fixed — real colors that canvas understands):
const { dark } = useTheme();
const tickColor = dark ? '#94a3b8' : '#64748b';
const gridColor = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';

ticks: { color: tickColor }
grid:  { color: gridColor }
```

**Key lesson:** When using Canvas-based rendering libraries (Chart.js, WebGL, `<canvas>` drawing), always use literal color values, not CSS variables.

---

### Issue #2: Duplicate Function Body After AI Multi-Edit

**When it appeared:** After using the AI to fix the chart color issue in `SeriesChart.tsx`.

**Symptom:** TypeScript reported:
```
error TS2323: Cannot redeclare exported variable 'SeriesChart'
error TS2393: Duplicate function implementation
```

**Root cause:** The AI's "replace imports" edit correctly replaced the old import block and inserted the new `useTheme`-based function. However, the old function body was not targeted by this edit — it remained appended at the end of the file, creating two copies of the `SeriesChart` function.

This is a risk whenever a tool replaces a partial section of a file without reading the full file first.

**How it was diagnosed:** The file was read from top to bottom, confirming two separate `Props` interface declarations and two separate `SeriesChart` function definitions. The first (newer) one had the `useTheme` theme colors. The second (older) one still used CSS variables.

**The fix:** A targeted find-and-replace removed the stale second copy — the old `Props` interface and old `SeriesChart` function — leaving only the corrected implementation.

**Key lesson:** After any AI-assisted multi-file edit, always run `npx tsc --noEmit` to catch structural errors like duplicate declarations. If errors appear, read the affected file top-to-bottom before attempting fixes.

---

### Issue #3: ESLint Warning — `setState` Called Inside `useEffect`

**When it appeared:** When ESLint was run for the first time.

**Symptom:** ESLint reported errors in `components/layout/Providers.tsx` and `hooks/usePinnedSeries.ts`:
```
error  Avoid calling setState() directly within an effect  react-hooks/set-state-in-effect
```

**Why ESLint flags this:** Calling `setState` synchronously inside `useEffect` (as opposed to inside a callback) can cause additional render cycles. ESLint's React hooks plugin considers this a code smell.

**Why the code is actually correct here:** This pattern is the standard, accepted way to hydrate state from `localStorage` in Next.js. The effect only runs once (empty dependency array `[]`), and the `setState` call is necessary to update React's state after reading from `localStorage`. This is not a real bug.

**The fix:** Suppress the ESLint rule with a targeted comment on the specific line, explaining why it is intentional:

```typescript
useEffect(() => {
  const isDark = ...;
  document.documentElement.classList.toggle('dark', isDark);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setDark(isDark);  // Required — this is the localStorage hydration pattern
}, []);
```

> **When to use eslint-disable:** Only use it when you are certain the code is correct and the rule is overly strict for your specific use case. Never use it to hide real bugs.

---

### Issue #4: Turbopack Root Detection Warning

**When it appeared:** When `npm run dev` was first run.

**Symptom:** Warning in the console:
```
⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
We detected multiple lockfiles...
```

**Root cause:** There was a `package-lock.json` in a parent directory (`c:\repos\`) in addition to the one in `c:\repos\EconoMonitor\`. Turbopack saw both and was confused about which was the project root.

**The fix:** Added `turbopack: { root: __dirname }` to `next.config.ts`, explicitly telling Turbopack to use the `EconoMonitor` directory as the root.

---

### Issue #5: VS Code Shows "CSS inline styles should not be used" Warnings

**When it appeared:** When VS Code's Problems panel showed warnings on the new FRASER pages.

**Symptom:** Every line containing `style={{ color: 'var(--text)' }}` showed a warning: "CSS inline styles should not be used, move styles to an external CSS file."

**Root cause:** This warning comes from a **VS Code extension** (likely a CSS or stylelint extension), not from TypeScript or ESLint. The same warning appeared on all pre-existing pages too.

**Verification:** Running `npm run lint` (ESLint) and `npx tsc --noEmit` (TypeScript) both exited with code 0 — no errors. The VS Code extension warnings are purely cosmetic.

**Why inline styles are used here:** The app's design system is built on CSS custom properties (`var(--text)`, `var(--accent)`, etc.) which must be referenced in JavaScript style objects to work across the light/dark theme system. Moving them to a CSS file would require adding Tailwind arbitrary value classes for every CSS variable, which is more complex and fragile.

**The fix:** None needed — the warnings are from an extension and do not affect compilation, linting, or runtime behavior.

---

## 27. Running the App

### Start the Development Server

```
cd c:\repos\EconoMonitor
npm run dev
```

Open your browser and go to **http://localhost:3000**

### Quality Checks

Run these before committing any changes:

```
# Check for TypeScript errors (must exit 0)
npx tsc --noEmit

# Check for ESLint errors (must exit 0)
npm run lint
```

### Build for Production

```
npm run build
npm run start
```

This compiles the app for optimal performance and starts the production server.

---

## 28. Project File Reference

### Complete File Tree

```
EconoMonitor/
│
├── .env.local                           ← API keys (never committed to git)
├── next.config.ts                       ← Next.js configuration
├── tsconfig.json                        ← TypeScript configuration
├── eslint.config.mjs                    ← ESLint configuration
├── package.json                         ← Dependencies and npm scripts
│
├── app/                                 ← Next.js App Router pages
│   ├── globals.css                      ← Global styles + CSS design tokens
│   ├── layout.tsx                       ← Root layout (wraps all pages)
│   ├── page.tsx                         ← Dashboard (/)
│   │
│   ├── api/
│   │   ├── fred/[...path]/route.ts      ← FRED API proxy (server-side)
│   │   └── fraser/[...path]/route.ts    ← FRASER API proxy (server-side)
│   │
│   ├── search/page.tsx                  ← Series search (/search)
│   ├── series/[seriesId]/page.tsx       ← Series detail (/series/GDP)
│   ├── compare/page.tsx                 ← Multi-series compare (/compare)
│   ├── categories/page.tsx              ← Root categories (/categories)
│   ├── categories/[categoryId]/page.tsx ← Category detail (/categories/32991)
│   ├── releases/page.tsx                ← FRED releases (/releases)
│   │
│   └── fraser/
│       ├── page.tsx                     ← FRASER hub (/fraser)
│       ├── themes/[themeId]/page.tsx    ← Theme detail (/fraser/themes/5)
│       ├── timelines/[timelineId]/page.tsx ← Timeline (/fraser/timelines/financial-crisis)
│       └── title/[titleId]/page.tsx     ← Title detail (/fraser/title/1)
│
├── components/
│   ├── layout/
│   │   ├── Providers.tsx                ← React Query + Theme context
│   │   └── Navbar.tsx                   ← Top navigation bar
│   ├── charts/
│   │   ├── SeriesChart.tsx              ← Single-series line chart
│   │   └── CompareChart.tsx             ← Multi-series overlay chart
│   ├── dashboard/
│   │   ├── MetricCard.tsx               ← Dashboard KPI card with sparkline
│   │   └── SparklineChart.tsx           ← Tiny trend chart for cards
│   ├── search/
│   │   └── SeriesCard.tsx               ← Search result row
│   └── ExportButton.tsx                 ← CSV/JSON download dropdown
│
├── hooks/
│   ├── useFredQuery.ts                  ← React Query hooks for FRED API
│   ├── useFraserQuery.ts                ← React Query hooks for FRASER API
│   └── usePinnedSeries.ts               ← Pinned series localStorage state
│
└── lib/
    ├── fred.ts                          ← Typed FRED API client
    ├── fraser.ts                        ← Typed FRASER API client + type extractors
    └── utils.ts                         ← Date/value formatting + CSV/JSON export
```

### Key Design Decisions

| Decision | Reason |
|---|---|
| API keys in server-side proxy | API keys must never reach the browser — the proxy is the security boundary |
| CSS custom properties for theming | Enables instant light/dark switching without re-rendering the whole tree |
| Hardcoded hex colors in Chart.js | CSS variables don't work in canvas — must use real color values |
| React Query for all data fetching | Centralizes caching, deduplication, and loading/error states |
| `hydrated` flag in localStorage hooks | Prevents SSR/client mismatch when reading browser-only APIs |
| `[...path]` catch-all proxy routes | One route handler covers all API endpoints for each API |
| URL-driven state in Search and Compare | Makes searches and comparisons shareable via link |

---

*Built with Next.js 16, TypeScript 5, Tailwind CSS 4, Chart.js 4, React Query 5, and GitHub Copilot Agent mode.*

---

## Section 30 — Azure App Service Deployment

The complete deployment reference is in [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md).
This section captures the key implementation decisions and how the Entra ID OIDC setup
was accomplished without manual CLI work.

---

### 30.1 How the Entra ID OIDC Setup Was Done (MCP-assisted)

Deploying from GitHub Actions to Azure App Service requires **Microsoft Entra ID OIDC**
(Workload Identity Federation). Normally this involves manually running several `az ad`
CLI commands. For this project the entire setup was handled by **GitHub Copilot in Agent
mode** using the **Azure MCP server** and **Microsoft Learn MCP server** — no manual CLI
work was needed for the Entra configuration.

**What the MCPs did automatically, in response to a single natural language prompt:**
1. Created an Entra ID **App Registration** (`sp-economonitor-github`)
2. Created the **service principal** and assigned it **Contributor** on `rg-economonitor`
3. Added **two federated credentials** (one for push-to-main, one for `workflow_dispatch`
   via the `production` environment)
4. Returned the `appId`, `tenantId`, and `subscriptionId` needed for the GitHub secrets

**How to reproduce this:**

Install the Azure MCP and Microsoft Learn MCP extensions in VS Code, open Copilot Chat
in **Agent mode**, and describe what you need:

```
I need to set up GitHub Actions OIDC (Workload Identity Federation) so my repo
<owner>/<repo> can deploy to Azure App Service in resource group <rg-name>.
Please create an App Registration, service principal, assign Contributor RBAC, and
add federated credentials for push-to-main and workflow_dispatch via a 'production'
GitHub environment. Then give me the three values I need for GitHub secrets.
```

Copilot uses the Azure MCP tools to execute each step directly in your Azure tenant
and surfaces the output. Full step-by-step instructions are in
AZURE_DEPLOYMENT.md Section 6a.

**Why OIDC is required (and why it can't be skipped):**

Azure's security model requires every actor that deploys to a resource to hold a
verifiable Entra ID identity. GitHub Actions has no Azure identity of its own. Entra
federated credentials bridge this by establishing a trust: "OIDC tokens issued by
GitHub for this specific repo and trigger are trusted as service principal `<appId>`."
When the workflow runs, GitHub provides a short-lived token; Azure exchanges it for a
scoped access token — no stored password or credential blob is ever created.

---

### 30.2 Two Federated Credentials Required

One common mistake is creating only a single federated credential for push-to-main.
The workflow also supports `workflow_dispatch` (manual triggers), which routes through
the `production` GitHub environment. GitHub sends a different `subject` claim for each
trigger type, and Entra ID uses **exact-match** on `subject`:

| Workflow trigger | Subject claim GitHub sends |
|-----------------|---------------------------|
| Push to `main` | `repo:russrimm/EconoMonitor:ref:refs/heads/main` |
| Manual `workflow_dispatch` (via `production` env) | `repo:russrimm/EconoMonitor:environment:production` |

Without the second credential, manual deploys fail with:
```
AADSTS70021: No matching federated identity record found for the presented assertion.
```

The Copilot/MCP prompt in Section 30.1 creates both credentials in a single interaction.

---

### 30.3 GitHub Environment: `production`

The deploy job declares `environment: production` in the workflow YAML. Create this in
your GitHub repo under **Settings → Environments → New environment** before the first
run. It serves two purposes:

1. **Federated credential matching** — the `workflow_dispatch` subject includes
   `environment:production`. GitHub only adds this claim when the job references a
   named environment.
2. **Deployment URL** — the `url:` field provides a clickable live-app link in the
   GitHub Actions summary.

---

### 30.4 The `GITHUB_TOKEN_AI` Naming Convention

The app reads `GITHUB_TOKEN` at runtime for the GitHub Models AI API. You cannot name
a GitHub repo secret `GITHUB_TOKEN` — GitHub automatically creates an ephemeral token
with that name for every workflow run and silently ignores any repo secret with the
same name.

**Solution:** Store the GitHub PAT as `GITHUB_TOKEN_AI`. The workflow's `Sync App
Settings` step maps it to the `GITHUB_TOKEN` app setting that the application reads:

```yaml
az webapp config appsettings set \
  --settings \
    GITHUB_TOKEN="${{ secrets.GITHUB_TOKEN_AI }}"
```

---

### 30.5 Standalone Build Output

Using `output: "standalone"` in `next.config.ts` reduces the deployment artifact from
~324 MB (full `.next` + `node_modules`) down to ~8.6 MB. Two copy steps are required
after `npm run build` before zipping:

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public        .next/standalone/public
```

The GitHub Actions workflow handles this automatically. For manual deploys, see
AZURE_DEPLOYMENT.md Section 5.
