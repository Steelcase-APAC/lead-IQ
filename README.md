# CRE Lease-IQ - Pan-APAC Commercial Real Estate & Company Tracker Dashboard

An executive intelligence platform and account surveillance radar tracking high-value commercial leases, corporate relocations, and fit-out opportunities across **5 key APAC markets** (India, Malaysia, South Korea, Japan, and Sri Lanka).

**Live Google Sheet Source of Truth**: [Google Sheet Link](https://docs.google.com/spreadsheets/d/1DojjV8QQH2Xbd6mpETIrqhmGSbRqlOxpKZbQsA5dQB0/edit?usp=sharing)

---

## 🚀 How to Run & View

### Option 1: Live Interactive Server (Recommended)
The local server is already running at:
👉 **[http://localhost:8089](http://localhost:8089)**

To re-run the server at any time:
```bash
python3 server.py
```

### Option 2: Standalone Browser File
You can also open [`index.html`](file:///Users/arden/Documents/-%20Ai%20Software%20builts/scraped%20leads/index.html) directly in any browser:
```bash
open index.html
```

---

## 🌟 Key Features & Capabilities

### 1. Multi-Market Visualization (5 Countries + Pan-APAC View)
Easily toggle between all markets or drill into individual countries using the top country selector:
- 🌐 **All Markets (Pan-APAC)**: Combined 183 verified deals and 175 monitored accounts.
- 🇮🇳 **India**: 50 deals, ~13.0M sq ft, Currency in **INR (₹ Crores / Lakhs)**.
- 🇲🇾 **Malaysia**: 48 deals, ~4.1M sq ft, Currency in **MYR (RM Millions / Billions)**.
- 🇰🇷 **South Korea**: 25 deals, ~3.5M sq ft (converted from pyeong / sqm), Currency in **KRW (₩ Trillions / Billions)**.
- 🇯🇵 **Japan**: 32 deals, ~1.0M sq ft (converted from tsubo / sqm), Currency in **JPY (¥ Billions / Millions)**.
- 🇱🇰 **Sri Lanka**: 28 deals, major banking & telecom lease portfolios, Currency in **LKR (SL Rs Billions / Millions)**.

### 2. Dual-Engine Architecture
The dashboard features two dedicated operational modules:
1. 📊 **Market Deals Feed (183 Leads)**:
   - Volume, footprint, and timeline tracking for commercial leases, campus setups, and government tenders.
   - 4 Interactive Chart.js visualizations (City distribution, Sector breakdown donut, Deal size tiers, and Fit-out timing pipeline).
   - Instant search and multi-filtering (by City, Industry, and Urgency Window).
   - Dual view modes: Table View and Card Grid View.
2. 🎯 **Company Tracker (175 Enterprise Accounts)**:
   - Per-company monitoring database maintained across weekly audit cycles.
   - **Active vs. Watch Radar**: 18 high-priority sales triggers vs. 157 long-term monitored accounts.
   - **Weekly Delta Feed ("What Changed This Week")**: Instantly flags accounts with new leases, relocated HQs, or timeline accelerations (e.g. PwC Malaysia, Hana Financial, Maybank, Leadcorp).
   - **Side-by-Side Snapshot Diff Modal**: Visual comparison of *Previous Snapshot* vs. *Latest Snapshot* with computed change magnitude and trend recommendations.

### 3. Google Sheet as the Source of Truth
- Built-in **"🔄 Sync Sheet"** button that reaches out to the live Google Sheet, downloads all country tabs and the Company Tracker tab, parses the latest data, and updates the UI in real-time.
- Displays live sync timestamp badge (`🟢 Source: Google Sheet Live`).
- Automatic caching in `localStorage` and `data.js` so the application works seamlessly offline as well.

### 4. Country-Specific Currencies
Each country reflects its native currency and standard business denomination:
- **India**: `₹` (e.g. `₹84.8 Cr`, `₹9.23 Cr/mo`, `₹1,000 Cr`)
- **Malaysia**: `RM` (e.g. `RM 180M`, `RM 2.0 Bn`, `RM 92M`)
- **Korea**: `₩` (e.g. `₩8.0 Trillion`, `₩120 Billion`, `₩15 Billion`)
- **Japan**: `¥` (e.g. `¥25+ Billion`, `¥30,000 / tsubo`)
- **Sri Lanka**: `SL Rs` (e.g. `SL Rs 12.5 Bn`, `SL Rs 2.2 Bn`)

### 5. Dark Mode & Light Mode
- Clean, instantaneous theme switch (`🌙 Dark` / `☀️ Light`) in the top navigation bar.
- Smooth transitions and customized Chart.js color schemes (grid lines, tick labels, tooltip backgrounds) that re-render automatically.
- User preference is saved across sessions in `localStorage`.

### 6. One-Click CSV Export
- Export either the filtered deals list or the monitored company tracker records with full metadata to `.csv` at any time.
