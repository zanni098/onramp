<p align="center">
  <img src="https://img.shields.io/badge/status-active%20development-0070F3?style=for-the-badge&labelColor=000000" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-10B981?style=for-the-badge&labelColor=000000" alt="License" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react&labelColor=000000" alt="React" />
  <img src="https://img.shields.io/badge/typescript-6.0-3178C6?style=for-the-badge&logo=typescript&labelColor=000000" alt="TypeScript" />
  <img src="https://img.shields.io/badge/vite-8-646CFF?style=for-the-badge&logo=vite&labelColor=000000" alt="Vite" />
</p>

<h1 align="center">
  <br />
  ⚡ onramp
  <br />
</h1>

<h3 align="center">
  Non-custodial stablecoin payment gateway for the modern internet.
</h3>

<p align="center">
  Accept USDC & USDT payments directly to your Solana or Polygon wallet.<br />
  Zero middlemen · Instant settlement · No hidden fees.
</p>

---

## 🧭 Overview

**Onramp** is a non-custodial stablecoin payment gateway that lets merchants accept **USDC** and **USDT** payments on **Solana** and **Polygon** — with funds settling directly into their wallets. No intermediaries ever hold your funds.

The platform provides a complete merchant experience: a polished dashboard for managing products and payment links, real-time transaction monitoring, webhook integrations for order fulfilment, and a checkout flow customers actually enjoy using.

### Why Onramp?

| Problem | Onramp's Answer |
|---|---|
| Traditional payment processors take 2-3% + days to settle | **0% platform fees, instant on-chain settlement** |
| Crypto payment gateways are custodial — they hold your money | **Fully non-custodial — funds go directly to your wallet** |
| Cross-border payments are expensive and slow | **Stablecoins are borderless; pay from anywhere instantly** |
| Existing solutions have terrible merchant UX | **Modern dashboard with product management, webhooks & analytics** |

---

## ✨ Features

### For Merchants

- **📊 Dashboard** — Real-time overview of revenue, transaction count, and success rate
- **📦 Product Management** — Create and manage products with shareable payment links (`/checkout/:productId`)
- **🔗 Webhook Integration** — Configure endpoint URLs with HMAC-signed payloads for automated order fulfilment
- **🔑 API Keys** — Public/secret key pair for programmatic access and server-side verification
- **📈 Transaction History** — Full ledger of all incoming payments with status tracking

### For Customers

- **💳 Streamlined Checkout** — Clean, single-page checkout with wallet connection and chain selection
- **✅ Instant Confirmation** — On-chain confirmation with success page and merchant notification

### Platform

- **🔐 Authentication** — Merchant registration and login with Supabase Auth
- **🌐 Multi-Chain** — Solana and Polygon support (USDC/USDT)
- **🎨 Dark-Mode Design** — Cyber-professional aesthetic with glassmorphism and glow effects
- **📱 Responsive** — Fully responsive across desktop, tablet, and mobile

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (SPA)                    │
│              React 19 · TypeScript · Vite            │
├────────────┬───────────────┬────────────────────────┤
│  Landing   │   Dashboard   │   Checkout Flow        │
│  Page      │   Layout      │   /checkout/:id        │
│            │   ├ Overview   │   → Wallet Connect     │
│  Login     │   ├ Products   │   → Chain Select       │
│  Register  │   ├ Txns      │   → Pay (USDC/USDT)    │
│            │   ├ Webhooks   │   → /success           │
│            │   └ Settings   │                        │
├────────────┴───────────────┴────────────────────────┤
│                  Supabase Backend                    │
│         Auth · Database · Edge Functions             │
├─────────────────────────────────────────────────────┤
│              Blockchain Layer                        │
│         Solana (Helius RPC) · Polygon (Alchemy)      │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | React 19 | UI components & SPA |
| **Language** | TypeScript 6 | Type-safe development |
| **Build Tool** | Vite 8 | Lightning-fast HMR & bundling |
| **Styling** | Tailwind CSS 4 | Utility-first styling |
| **Fonts** | Instrument Serif + Inter | Heading & body typography |
| **Icons** | Lucide React | Consistent icon system |
| **Routing** | React Router 7 | Client-side routing with nested layouts |
| **Notifications** | React Hot Toast | Toast notifications |
| **Backend** | Supabase | Auth, database, edge functions |
| **Solana** | Helius RPC | Solana transaction monitoring |
| **Polygon** | Ethers.js v6 + Alchemy | EVM wallet interaction |

---

## 📂 Project Structure

```
onramp/
├── public/                     # Static assets
├── src/
│   ├── assets/                 # Images (hero.png, logos)
│   ├── layouts/
│   │   └── DashboardLayout.tsx # Sidebar + main content shell
│   ├── lib/
│   │   └── supabase.ts        # Supabase client initialisation
│   ├── pages/
│   │   ├── Landing.tsx         # Marketing homepage
│   │   ├── Login.tsx           # Merchant login
│   │   ├── Register.tsx        # Merchant registration
│   │   ├── Dashboard.tsx       # Revenue & stats overview
│   │   ├── Products.tsx        # Payment link management
│   │   ├── Transactions.tsx    # Transaction history
│   │   ├── Webhooks.tsx        # Webhook endpoint config
│   │   ├── Settings.tsx        # API key management
│   │   ├── Checkout.tsx        # Customer-facing payment page
│   │   └── Success.tsx         # Post-payment confirmation
│   ├── App.tsx                 # Route definitions
│   ├── App.css                 # Legacy component styles
│   ├── index.css               # Global styles & Tailwind layers
│   └── main.tsx                # React entry point
├── .env                        # Environment variables (not committed)
├── tailwind.config.js          # Custom theme tokens
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript project references
├── tsconfig.app.json           # App-specific TS config
├── tsconfig.node.json          # Node-specific TS config
├── eslint.config.js            # Linting rules
└── package.json                # Dependencies & scripts
```

---

## 🎨 Design System

Onramp uses a **"Cyber-Professional"** dark-mode design language built on a carefully curated set of tokens:

### Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `background` | `#000000` | Page background |
| `surface` | `#0A0A0A` | Card / panel backgrounds |
| `accent` | `#0070F3` | Primary interactive colour (links, CTAs, glows) |
| `success` | `#10B981` | Confirmation states |
| `zinc-400` | — | Body text |
| `zinc-800` | — | Borders & dividers |

### Typography

- **Headings** — [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) · tight tracking · white
- **Body** — [Inter](https://fonts.google.com/specimen/Inter) · 400–700 weights · zinc-400

### Component Classes

| Class | Description |
|---|---|
| `.glow-card` | Glass-panel card with rounded corners, border glow, and overflow hidden |
| `.glow-button` | Primary CTA — white background, black text, scale transform on hover/active |
| `.glow-button-secondary` | Ghost button with zinc border and subtle hover |
| `.glass-input` | Transparent input with backdrop blur and accent-coloured focus ring |

### Effects

- **Glow blurs** — Large radial `accent/20` blurs behind hero sections
- **Glassmorphism** — `backdrop-blur-md` on navbar and input elements
- **Micro-animations** — Pulsing accent dot in the logo, scale transforms on buttons, smooth transitions

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (or pnpm / yarn)
- A **Supabase** project (free tier works)
- **Helius** API key (free tier — Solana RPC)
- **Alchemy** API key (free tier — Polygon RPC)

### Installation

```bash
# Clone the repository
git clone https://github.com/zanni098/onramp.git
cd onramp

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_HELIUS_API_KEY=your_helius_api_key
VITE_ALCHEMY_API_KEY=your_alchemy_api_key
```

### Development

```bash
# Start the dev server with HMR
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build

```bash
# Type-check and build for production
npm run build

# Preview the production build
npm run preview
```

### Lint

```bash
npm run lint
```

---

## 🗺️ Route Map

| Path | Component | Access | Description |
|---|---|---|---|
| `/` | `Landing` | Public | Marketing homepage |
| `/login` | `Login` | Public | Merchant sign-in |
| `/register` | `Register` | Public | Merchant registration |
| `/checkout/:productId` | `Checkout` | Public | Customer payment page |
| `/success` | `Success` | Public | Payment confirmation |
| `/dashboard` | `Dashboard` | Auth | Revenue & stats overview |
| `/products` | `Products` | Auth | Payment link management |
| `/transactions` | `Transactions` | Auth | Transaction ledger |
| `/webhooks` | `Webhooks` | Auth | Webhook configuration |
| `/settings` | `Settings` | Auth | API key management |

Authenticated routes are wrapped in the `DashboardLayout` component, which provides a persistent sidebar navigation.

---

## 🔮 Roadmap

- [ ] **Wallet Adapter Integration** — Phantom, Backpack, MetaMask connect flow
- [ ] **On-Chain Monitoring** — Real-time transaction confirmation via Helius webhooks
- [ ] **Webhook Delivery** — HMAC-signed POST requests to merchant endpoints on payment events
- [ ] **Product CRUD** — Full create/edit/delete flow backed by Supabase
- [ ] **Multi-token Support** — USDC, USDT, DAI, and more
- [ ] **Payment Link Customisation** — Branding, descriptions, and images on checkout
- [ ] **Analytics Dashboard** — Charts, conversion funnels, and revenue trends
- [ ] **Email Notifications** — Payment receipts for both merchant and customer
- [ ] **Hosted Checkout** — Embeddable iframe / pop-up for third-party sites
- [ ] **Mobile Optimisation** — Deep-link to mobile wallets on checkout

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a **Pull Request**

Please use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ⚡ by <a href="https://github.com/zanni098">zanni098</a>
</p>
