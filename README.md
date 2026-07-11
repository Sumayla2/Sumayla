# Premium Work From Home CRM Dashboard & Survey App

A premium, dark-themed, glassmorphic CRM Dashboard and public Survey Form application. Designed with deep slate backgrounds, Royal Blue and Neon Blue accents, and rich animations.

## 🚀 Key Features

- **Auth Gating**: Simulated Base64 JWT session validation with BASE64 tokens stored in LocalStorage.
- **Dynamic Stats Aggregation**: Real-time stats calculation (Totals, Daily Submissions, Gender split ratios, Pending Leads).
- **Cross-Tab Synchronization**: Uses HTML5 storage listeners. Submitting the survey in one window instantly triggers toast alerts, audio alerts, bell badge counters, and chart/table refreshes on the admin panel in other tabs.
- **Filtering & Search**: Multi-column search with select dropdown filters by gender, status, and timeline.
- **Bulk Actions**: Check multiple records to execute bulk deletions.
- **CSV Data Exports**: Instantly compile active table views and trigger standard spreadsheet downloads.
- **Demographics Analytics**: Line, bar, and donut charts configured with custom gradients using Chart.js.
- **Database Maintenance**: Seeding/Wiping controls in the Settings section.

---

## 🛠️ Project Structure

```
work/
├── admin.html          # Admin Portal (Login Screen + CRM SPA Dashboard)
├── index.html          # Public WFH Contact Survey Form
├── package.json        # Node dependency manifest
├── README.md           # Documentation
├── css/
│   ├── style.css       # Design variables, typography, layouts, animations
│   └── survey.css      # Custom survey form stylesheet
└── js/
    ├── api.js          # Shared localStorage database access & CRUD logic
    ├── auth.js         # JWT token management and auth gates
    ├── leads.js        # Table renderer, pagination, filters, CSV compiler
    ├── analytics.js    # Chart.js gradient styles and configs
    ├── notifications.js# Toast alerts, synthesized beep, cross-tab event listeners
    └── app.js          # SPA hash router and Settings panel managers
```

---

## 🔑 Login Credentials

- **Username**: `admin`
- **Password**: `password123`

---

## ⚙️ Quick Start

This project is built using vanilla HTML5, CSS3, and JavaScript, meaning you can open the HTML files directly in your web browser. 

For the best experience (including hot-reloading asset files during editing), follow these steps:

1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Open a terminal in the project directory.
3. Install dev dependencies:
   ```bash
   npm install
   ```
4. Start the local server:
   ```bash
   npm start
   ```
5. Your browser will automatically open the Admin CRM Dashboard at `http://localhost:3000/admin.html` (and the public survey is available at `http://localhost:3000/index.html`).
