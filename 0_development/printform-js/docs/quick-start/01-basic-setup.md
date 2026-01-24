# Quick Start: Basic Setup

This guide shows the quickest way to preview a paginated document.

---

## Prerequisites

- Any modern browser (Chrome/Firefox/Safari/Edge)
- Basic HTML knowledge
- Optional: Python or Node.js for a local server

---

## Option A: No build, just the bundle

### Step 1: Download the bundle

Copy `dist/printform.js` into your project.

### Step 2: Create a simple HTML file

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PrintForm Quick Start</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    .paper_width { width: 750px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  </style>
</head>
<body>
  <div class="printform paper_width"
       data-papersize-width="750"
       data-papersize-height="1050"
       data-repeat-header="y"
       data-repeat-rowheader="y"
       data-repeat-footer-pagenum="y">

    <div class="pheader">
      <h1>Sales Report</h1>
      <p>Date: 2026-01-24</p>
    </div>

    <div class="prowheader">
      <table>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Amount</th>
        </tr>
      </table>
    </div>

    <div class="prowitem">
      <table>
        <tr>
          <td>Product A</td>
          <td>10</td>
          <td>$100.00</td>
        </tr>
      </table>
    </div>

    <div class="pfooter_pagenum">
      <table>
        <tr>
          <td style="text-align:center;">
            Page <span data-page-number></span> of <span data-page-total></span>
          </td>
        </tr>
      </table>
    </div>
  </div>

  <script src="./dist/printform.js"></script>
</body>
</html>
```

### Step 3: Start a local server

```bash
# Python
python3 -m http.server 8000

# Node (dev server)
npm install
npm run dev
```

### Step 4: Preview

Open `http://localhost:8000/your-file.html` and use print preview.

---

## Option B: Use the repo dev server

```bash
git clone <repo-url>
cd printform-js/0_development/printform-js
npm install
npm run dev
```

Preview:
- `http://localhost:8000/index.html` (full demo)
- `http://localhost:8000/index001.html` (basic structure)

---

## Next steps

- Full usage guide: `docs/USAGE_GUIDE.md`
- All config options: `docs/CONFIGURATION.md`
- Full example template: `docs/quick-start/02-full-example.md`
