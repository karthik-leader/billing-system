# BillEase – Smart Billing System

A complete, browser-based billing system. No server required — all data is stored locally in the browser via `localStorage`.

## Features

| Screen | What you can do |
|---|---|
| **Login** | Admin login with username & password |
| **Inventory** | Add / edit / delete items; adjust stock with + / − buttons |
| **New Sale** | Click items to add to bill, set discount & GST, generate & print receipt |
| **Daily Report** | View all transactions by date; print a formatted daily report |
| **Settings** | Update shop info, import inventory from a CSV spreadsheet, and change password |

**Default credentials:** `admin` / `admin123`  
Change your password from the Settings screen after first login.

---

## Local Usage

Just open `index.html` in any modern browser — no installation needed.

### Import Inventory from a Spreadsheet

Open **Settings** and use **Import Inventory** to upload a CSV exported from Excel or Google Sheets. The file must include these columns:

```text
name,category,price,quantity,unit
```

`name`, `price`, and `quantity` are required. The import replaces the current inventory after validation and confirmation. Use **Download Template** in Settings to get a ready-to-fill example.

---

## Deploy to GitHub Pages (Free Public Hosting)

### Step 1 – Create a GitHub account
Sign up at https://github.com if you don't have one.

### Step 2 – Install Git
Download from https://git-scm.com/downloads and install.

### Step 3 – Create a new repository on GitHub
1. Go to https://github.com/new
2. Name it something like `billing-system`
3. Set visibility to **Public**
4. Do **not** initialise with README (you already have files)
5. Click **Create repository**

### Step 4 – Push your code (run in your project folder)

```bash
git init
git add .
git commit -m "Initial commit – BillEase billing system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/billing-system.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 5 – Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under *Branch*, select **main** and folder **/ (root)**
4. Click **Save**

Your site will be live in ~60 seconds at:

```
https://YOUR_USERNAME.github.io/billing-system/
```

Share that link with anyone — it's publicly accessible, free, and always up-to-date when you push changes.

---

## Data & Privacy

All data (inventory, sales, settings) is stored in the **browser's localStorage** on the device being used.  
- Each device/browser has its own independent data store.  
- Clearing browser data will erase records.  
- For multi-device shared data, a backend database would be needed.

---

## Tech Stack

- Pure **HTML5 / CSS3 / Vanilla JavaScript** — zero dependencies
- No build step, no framework, no server
