# 💸 Okane

<div align="center">
  <p><strong>A modern, privacy-first personal finance, expense tracking, and bill-splitting ledger app.</strong></p>
  <p>
    <a href="#-key-features">Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-mobile--desktop-builds">Platform Builds</a> •
    <a href="#-architecture--storage">Architecture</a> •
    <a href="#-data-privacy--security">Privacy</a>
  </p>
</div>

---

## 🌟 Overview

**Okane** is an offline-first, feature-packed financial management app designed to give you complete control over your money. Track income and expenses, manage multi-wallet accounts, split complex bills with friends and trip groups, manage recurring subscriptions, and visualize your financial health with rich analytics—all without tracking, advertisements, or mandatory cloud lock-in.

---

## ✨ Key Features

### 📊 Comprehensive Dashboard
- **Financial Snapshot**: Real-time net worth, liquid balance, and monthly cash flow metrics (Income vs. Expense).
- **Smart Insights Engine**: Automated alerts on high spending, pending dues, and upcoming recurring bills.
- **Quick Action Bar**: Fast access to record expenses, transfer funds, log settlements, or split bills.

### 💰 Transactions & Expense Management
- **Detailed Ledger**: Record expenses, income, transfers, and friend lend/borrow transactions.
- **Smart Categorization**: Custom category palette with intuitive iconography and automatic keyword detection.
- **Multi-Wallet Support**: Manage physical cash, bank accounts, credit cards, and e-wallets with transfer tracking.
- **Rich Metadata**: Attach tags, detailed notes, receipt info, and payment methods.
- **High-Performance List**: Virtualized transaction lists with search, multi-filter drawers, and date clustering.

### 🤝 Contacts, Friends & Split Engine
- **Unified Contact Ledger**: Track Friends, Vendors, and Subscription services with balance summaries.
- **Bill Splitting**: Split expenses equally, by exact custom amounts, or shares with real-time balance calculations.
- **Trip & Group Splitting**: Organize travel groups and shared events with multi-payer expense recording and debt simplification matrices.
- **Settlement Tracking**: Settle individual debts or bulk transactions with payment proofs and history logs.
- **Consistent Visual Identity**: Deterministic avatar generation and customizable 2-digit contact badges.

### 🔄 Recurring Expenses & Subscriptions
- **Subscription Tracker**: Monitor active services, billing cycles (weekly, monthly, quarterly, annual), and renewal dates.
- **Forecasts & Projections**: Preview upcoming dues and monthly subscription overhead at a glance.
- **Automated Processing**: Option to auto-log or notify when recurring payments are due.

### 📈 Analytics & Reporting
- **Interactive Visualizations**: Category spend distributions, monthly spending trends, and income comparison charts.
- **Filterable Timeframes**: Analyze by week, month, quarter, year, or custom date ranges.
- **Export & Statements**: Generate professional PDF reports (with `jspdf` & `jspdf-autotable`) and CSV exports.

### 🔒 Privacy-First & Data Sovereignty
- **Local-First Database**: Runs on an in-memory SQL database powered by **AlaSQL** with automated local storage synchronization.
- **SQL Backup & Restore**: Full SQL dump exports and imports for reliable manual backups.
- **Optional Cloud Sync**: Optional encrypted backup and synchronization via Supabase.
- **Biometric Security**: Native biometric and PIN authentication support on mobile devices.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler** | [Vite](https://vitejs.dev/) |
| **Styling & Design System** | [Tailwind CSS](https://tailwindcss.com/) + Custom CSS Design Tokens |
| **Icons & Motion** | [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/) |
| **Local Database Engine** | [AlaSQL](https://alasql.org/) (Embedded SQL Engine) |
| **List Virtualization** | [@tanstack/react-virtual](https://tanstack.com/virtual) |
| **Export & Documents** | [jsPDF](https://github.com/parallax/jsPDF), `jspdf-autotable` |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Android) |
| **Desktop Runtime** | [Tauri 2](https://tauri.app/) (macOS, Windows, Linux) |
| **Cloud Sync (Optional)** | [Supabase](https://supabase.com/) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm** / **yarn**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/prathambahekar/okane.git
   cd okane
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000` (or the port specified in your console).

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📱 Mobile & Desktop Builds

### Android (Capacitor)
Okane includes full Android support configured via Capacitor:

```bash
# Build web assets
npm run build

# Sync web assets to native Android project
npx cap sync android

# Open project in Android Studio
npx cap open android

# Or run directly on connected device/emulator
npx cap run android
```

### Desktop (Tauri)
Okane can also be packaged as a lightweight desktop application using Tauri:

```bash
# Run desktop dev environment
npm run tauri dev

# Build production desktop binary
npm run tauri build
```

---

## 📂 Project Structure

```text
okane/
├── android/               # Native Android Capacitor wrapper
├── src-tauri/             # Tauri native desktop configuration & Rust backend
├── src/
│   ├── components/        # Reusable UI components, modals, and widgets
│   │   ├── common/        # Shared atoms (ContactAvatar, SearchBar, etc.)
│   │   ├── expense/       # Expense split modals, debt settlement cards
│   │   ├── expenses/      # Virtualized table rows, search filters
│   │   └── settlements/   # Settlement cards & detail modals
│   ├── context/           # App context providers
│   ├── styles/            # CSS tokens, theme variables, and modular stylesheets
│   ├── utils/             # Helper utilities, avatar generator, date & money formatters
│   ├── views/             # Core application screens
│   │   ├── Dashboard.tsx  # Overview & financial insights
│   │   ├── Expenses.tsx   # Transaction ledger & search
│   │   ├── Wallets.tsx    # Accounts & multi-wallet management
│   │   ├── Friends.tsx    # Contacts, vendors & subscriptions list
│   │   ├── FriendDetail.tsx # Contact profile, balance & settlement view
│   │   ├── SplitTrips.tsx # Group & trip bill-splitting manager
│   │   ├── Recurring.tsx  # Subscriptions & recurring bills
│   │   ├── Analytics.tsx  # Visual charts & financial reports
│   │   └── Settings.tsx   # Currencies, themes, backup & data management
│   ├── db.ts              # AlaSQL schema definitions, seeds & database functions
│   ├── store.ts           # Central state management store
│   ├── types.ts           # Global TypeScript interfaces & types
│   ├── App.tsx            # Main shell, navigation bar & view router
│   └── main.tsx           # React DOM root entry point
├── package.json
└── vite.config.ts
```

---

## 🛡️ Data Privacy & Security

- **Zero Telemetry**: Okane does not track user behavior or send personal analytics.
- **Client-Side Storage**: Your ledger and financial records stay stored on your device via SQLite / Local Storage.
- **Export Freedom**: Export your entire database as a standard SQL file at any time from **Settings → Data Management**.

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are welcome!
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with care by <a href="https://github.com/prathambahekar">Pratham Bahekar</a></sub>
</div>
