# PrintForm.js

[English](./README.md) | [简体中文](./README.zh-CN.md)

**PrintForm.js** is a lightweight (zero-dependency Vanilla JS) browser-side pagination script.

Its core function is: **automatically splitting a long HTML container (`.printform`) into multiple pages that fit the print paper size**. It handles headers, footers, repeated table headers, page number updates, and dummy row filling automatically.

## Logic Diagram

To help understand how `printform.js` works, please refer to the flowchart below:

```mermaid
flowchart TD
    subgraph Raw_Input [Raw HTML Input]
        RawContainer[".printform Container"]
        Header[".pheader (Header)"]
        DocInfo[".pdocinfo (Document Info)"]
        RowHeader[".prowheader (Table Header)"]
        RowItems[".prowitem (Data Rows 1..N)"]
        Footer[".pfooter (Footer)"]
    end

    subgraph Processing [PrintForm.js Logic]
        Start(Start Formatting) --> InitPage[Create Page 1]
        InitPage --> AddHeader[Insert Header & DocInfo & RowHeader]
        AddHeader --> LoopRows{More rows?}
        
        LoopRows -- Yes --> CheckSpace{Fits in current page?}
        
        CheckSpace -- Yes --> AppendRow[Append .prowitem]
        AppendRow --> UpdateHeight[Update current height]
        UpdateHeight --> LoopRows
        
        CheckSpace -- No --> FillDummy[Fill Dummy Rows]
        FillDummy --> AddFooter[Insert Footer .pfooter]
        AddFooter --> NewPage[Create Page N+1]
        NewPage --> AddHeaderRepeat[Insert Repeated Header & RowHeader]
        AddHeaderRepeat --> LoopRows
        
        LoopRows -- No (Done) --> FillDummyFinal[Fill Remaining Dummy Rows]
        FillDummyFinal --> AddFooterFinal[Insert Final Footer]
        AddFooterFinal --> Finish(Done)
    end

    subgraph Output_Result [Print Output]
        Page1[Page 1 (A4)]
        PageBreak[Page Break]
        Page2[Page 2 (A4)]
        PageN[...]
    end

    RawContainer --> Start
    Finish --> Output_Result
```

---

## Quick Start

### 1. Start Server
You need a static server to preview the effect (to avoid browser local file restrictions).

```bash
# Option A: Python (Recommended)
python3 -m http.server 8000

# Option B: Node/Vite
npm install
npm run dev
```

### 2. Preview
Open in browser:
- `http://localhost:8000/index.html` (Full demo)
- `http://localhost:8000/example.html` (Basic structure)

---

## How to Use

PrintForm does not require complex build tools, just follow a specific **HTML structure convention**.

### 1. Basic Structure
Create a `div` with `class="printform"` and configure the paper size.

```html
<!-- Container: Define paper size (e.g. A4 width 750px height 1050px) -->
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050">

    <!-- 1. Header (Repeated at top of every page) -->
    <div class="pheader">...</div>

    <!-- 2. Doc Info (Usually on first page, can be repeated) -->
    <div class="pdocinfo">...</div>

    <!-- 3. Table Header (Column titles, repeated on new pages) -->
    <div class="prowheader">...</div>

    <!-- 4. Data Rows (Core content, split automatically) -->
    <div class="prowitem">Row 1</div>
    <div class="prowitem">Row 2</div>
    <div class="prowitem">Row 3...</div>

    <!-- 5. Footer (Repeated at bottom of every page) -->
    <div class="pfooter">...</div>
    
</div>

<!-- Include script -->
<script src="./dist/printform.js"></script>
```

### 2. Key Classes

| Class | Description | Default Behavior |
| :--- | :--- | :--- |
| `.printform` | **Root Container** | The script only processes content inside this container. |
| `.pheader` | **Header** | Repeats on **every page**. |
| `.pdocinfo` | **Doc Info** | Document metadata (e.g. invoice details), repeats on **every page** (configurable). |
| `.prowheader` | **Table Header** | Table column headers, repeats on **every page**. |
| `.prowitem` | **Data Row** | The **smallest unit** for splitting. The script will not split content inside a single `.prowitem`, but decides pagination row by row. |
| `.pfooter` | **Footer** | Defaults to **last page only** (can be configured to repeat). |
| `.ptac` | **Terms/Text** | For legal terms or long text, automatically splits by paragraph. |

---

## Configuration

You can use `data-*` attributes directly on the `.printform` element to control behavior.

### Common Configs

| Attribute | Example | Description |
| :--- | :--- | :--- |
| `data-papersize-width` | `750` | Paper width (px). |
| `data-papersize-height` | `1050` | Paper height (px). |
| `data-orientation` | `portrait` / `landscape` | Paper orientation. |
| `data-repeat-header` | `y` / `n` | Repeat header on every page (Default `y`). |
| `data-repeat-footer` | `y` / `n` | Repeat footer on every page (Default `n`). |
| `data-show-logical-page-number`| `y` / `n` | Show page numbers (e.g. "Page 1 of 3"). |
| `data-n-up` | `1` / `2` | **N-Up Printing**: Multiple logical pages per physical sheet. |

### Example
```html
<div class="printform"
     data-papersize-width="800"
     data-papersize-height="1100"
     data-repeat-footer="y"
     data-show-logical-page-number="y">
     ...
</div>
```

---

## Advanced Features

### 1. Dummy Rows (Filling Empty Space)
If a page is not full, PrintForm automatically inserts empty rows to push the footer to the bottom.
- You can customize the dummy row style:
```html
<template class="custom-dummy-row-item-content">
  <tr style="height:20px;"><td style="border:0;">...</td></tr>
</template>
```

### 2. JS API
The script runs automatically on load. If you generate content dynamically (e.g. AJAX), trigger formatting manually:

```javascript
// Format all .printform elements
PrintForm.formatAll();

// Or format a specific node
const myForm = document.querySelector('#invoice-1');
PrintForm.format(myForm);
```

### 3. Build for Production
If you modify the source (`js/` directory), rebuild:

```bash
npm run build
```
Output is in `dist/printform.js`.

---

## FAQ

**Q: Why is my content cut off?**
A: Check if a single `.prowitem` height exceeds `data-papersize-height` minus header/footer space. If one row is too tall, it won't fit on any page.

**Q: How to hide the header on the first page?**
A: The logic prefers consistency. For special cases, use CSS with the `.printform_page_1` class, or split the DOM during data preparation.

**Q: Margins are wrong when printing?**
A: Physical margins are controlled by the browser and printer driver. In the print dialog, enable "Background graphics" and set margins to "None" or "Minimum".

---

## Directory Structure

- `js/printform.js` - Entry point
- `js/printform/formatter.js` - **Core Logic** (Pagination calculation)
- `js/printform/config.js` - Configuration definitions
- `js/printform/dom.js` - DOM helpers
- `index.html` - Full test case
