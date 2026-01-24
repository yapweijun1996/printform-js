# Quick Start: Full Invoice Example

Use this full template to verify headers, footers, page numbers, and dummy rows.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
    .paper_width { width: 750px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 8px; }
    th { background: #f2f2f2; font-weight: bold; }
    .pheader { text-align: center; padding: 20px; }
    .pfooter { text-align: center; padding: 10px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="printform paper_width"
       data-papersize-width="750"
       data-papersize-height="1050"
       data-repeat-header="y"
       data-repeat-rowheader="y"
       data-repeat-footer-pagenum="y"
       data-height-of-dummy-row-item="26">

    <div class="pheader">
      <h1>Sales Invoice</h1>
      <p>Invoice: INV-2026-001 | Date: 2026-01-24</p>
    </div>

    <div class="pdocinfo">
      <table>
        <tr>
          <td><strong>Customer:</strong> ABC Corp</td>
          <td><strong>Address:</strong> 123 Example Road</td>
        </tr>
      </table>
    </div>

    <div class="prowheader">
      <table>
        <tr>
          <th style="width: 50%">Description</th>
          <th style="width: 15%">Qty</th>
          <th style="width: 15%">Unit</th>
          <th style="width: 20%">Amount</th>
        </tr>
      </table>
    </div>

    <div class="prowitem">
      <table>
        <tr>
          <td>Premium Coffee Beans</td>
          <td style="text-align:right;">10 kg</td>
          <td style="text-align:right;">$200.00</td>
          <td style="text-align:right;">$2,000.00</td>
        </tr>
      </table>
    </div>

    <div class="prowitem">
      <table>
        <tr>
          <td>Espresso Machine</td>
          <td style="text-align:right;">2 units</td>
          <td style="text-align:right;">$5,000.00</td>
          <td style="text-align:right;">$10,000.00</td>
        </tr>
      </table>
    </div>

    <!-- Duplicate prowitem blocks to test pagination -->

    <div class="pfooter">
      <p>Thank you for your business! | Phone: 123-456-7890</p>
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

    <template class="custom-dummy-row-item-content">
      <tr style="height: 26px;">
        <td style="border: 1px solid #ddd;"></td>
        <td style="border: 1px solid #ddd;"></td>
        <td style="border: 1px solid #ddd;"></td>
        <td style="border: 1px solid #ddd;"></td>
      </tr>
    </template>
  </div>

  <script src="./dist/printform.js"></script>
</body>
</html>
```

