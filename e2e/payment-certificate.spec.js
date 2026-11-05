import { test, expect } from '@playwright/test';

test('payment certificate retains all recovery rows and prints through Gallery', async ({ page }) => {
  await page.addInitScript(() => {
    const captureSourceRows = () => {
      if (window.__pf068SourceRows) return;
      const form = document.querySelector('.printform[data-repeat-header="y"]');
      const rows = form ? [...form.querySelectorAll('.recovery-entry')] : [];
      if (rows.length !== 200) return;
      window.__pf068SourceRows = rows.map((row) => ({
        id: row.dataset.rowId,
        text: row.textContent.replace(/\s+/g, ' ').trim(),
      }));
    };
    const installCapture = () => {
      if (window.__pf068CaptureInstalled) return;
      window.__pf068CaptureInstalled = true;
      new MutationObserver(captureSourceRows).observe(document.documentElement, { childList: true, subtree: true });
      captureSourceRows();
    };
    if (document.documentElement) installCapture();
    else document.addEventListener('DOMContentLoaded', installCapture, { once: true });
  });
  await page.goto('/gallery/index.html?q=PF-068');
  await expect(page.locator('.gallery-card')).toHaveCount(1);
  await page.locator('.gallery-card').click();
  const frame = page.frameLocator('dialog iframe');
  await expect(frame.locator('.printform_page')).toHaveCount(6, { timeout: 60000 });
  await expect(frame.locator('.recovery-entry.prowitem_processed')).toHaveCount(200);
  await expect(frame.locator('[data-row-id="signatures"].prowitem_processed')).toHaveCount(1);
  await expect(frame.locator('[data-page-number]')).toHaveText(['1', '2', '3', '4', '5', '6']);
  const child = page.frames().find(f => f.url().includes('subcontractor-payment-certificate'));
  expect(child).toBeTruthy();
  await child.waitForFunction(() => Array.isArray(window.__pf068SourceRows) && window.__pf068SourceRows.length === 200);
  const sourceRows = await child.evaluate(() => window.__pf068SourceRows);
  const renderedRows = await frame.locator('.recovery-entry.prowitem_processed').evaluateAll((rows) => rows.map((row) => ({
    id: row.dataset.rowId,
    text: row.textContent.replace(/\s+/g, ' ').trim(),
  })));
  expect(renderedRows).toEqual(sourceRows);
  const headerBoundaries = await frame.locator('.printform_page').evaluateAll((pages) => pages.map((pageNode) => {
    const mainHeader = pageNode.querySelector(':scope > .pdocinfo002_processed');
    const recoveryHeader = pageNode.querySelector(':scope > .recovery-detail-heading.prowheader_processed');
    const mainCell = mainHeader?.querySelector(':scope > tbody > tr > td:nth-child(2) > table > tbody > tr > td');
    const recoveryCells = recoveryHeader
      ? [...recoveryHeader.querySelectorAll(':scope > tbody > tr > td:nth-child(2) > table > tbody > tr > td')]
      : [];
    return {
      mainBottom: mainCell ? getComputedStyle(mainCell).borderBottomWidth : null,
      recoveryTop: recoveryCells.map((cell) => getComputedStyle(cell).borderTopWidth),
      recoveryFirstId: pageNode.querySelector(':scope > .recovery-entry.prowitem_processed')?.dataset.rowId || null,
    };
  }));
  expect(headerBoundaries.map(({ mainBottom }) => mainBottom)).toEqual(['1px', '1px', '1px', '1px', '1px', '1px']);
  expect(headerBoundaries[0].recoveryTop).toEqual(['1px', '1px', '1px', '1px']);
  headerBoundaries.slice(1).forEach(({ recoveryTop }) => expect(recoveryTop).toEqual(['0px', '0px', '0px', '0px']));
  expect(headerBoundaries.map(({ recoveryFirstId }) => recoveryFirstId)).toEqual([
    'recovery-001', 'recovery-029', 'recovery-068', 'recovery-107', 'recovery-146', 'recovery-185',
  ]);
});

test('global main header stays above two active child tables', async ({ page }) => {
  await page.goto('/index001.html');
  await page.evaluate(() => {
    document.querySelectorAll('.printform_formatter_processed, .div_page_break_before').forEach((node) => node.remove());
    const style = document.createElement('style');
    style.textContent = '.gallery-header-proof{width:420px;font:14px Arial}.gallery-header-proof .pdocinfo002,.gallery-header-proof .pdocinfo002_processed{height:34px;font-weight:700;background:#ddd}.gallery-header-proof .prowheader,.gallery-header-proof .prowheader_processed{height:28px;font-weight:700}.gallery-header-proof .prowitem,.gallery-header-proof .prowitem_processed{height:36px}';
    document.head.appendChild(style);
    const form = document.createElement('div');
    form.className = 'paper_width printform gallery-header-proof';
    Object.assign(form.dataset, {
      papersizeWidth: '420', papersizeHeight: '260', repeatHeader: 'n', repeatDocinfo: 'n', repeatDocinfo002: 'y',
      repeatRowheader: 'y', insertDummyRowItemWhileFormatTable: 'n', insertFooterSpacerWhileFormatTable: 'n',
    });
    const mainHeader = document.createElement('div');
    mainHeader.className = 'pdocinfo002';
    mainHeader.textContent = 'Global main heading';
    form.appendChild(mainHeader);
    [['claims', 'Claims', 44], ['recoveries', 'Recoveries', 10]].forEach(([tableId, label, count]) => {
      const header = document.createElement('div');
      header.className = 'prowheader';
      header.dataset.pfTableId = tableId;
      header.dataset.pfKeepWithNext = 'true';
      header.textContent = `${label} header`;
      form.appendChild(header);
      for (let index = 0; index < count; index += 1) {
        const row = document.createElement('div');
        row.className = 'prowitem';
        row.dataset.pfTableId = tableId;
        row.dataset.rowId = `${tableId}-${index + 1}`;
        row.textContent = `${label} row ${index + 1}`;
        form.appendChild(row);
      }
    });
    document.body.appendChild(form);
    window.PrintForm.format(form);
  });
  const pages = page.locator('.gallery-header-proof.printform_formatter_processed .printform_page');
  await expect(pages.first()).toBeVisible({ timeout: 15_000 });
  const summaries = await pages.evaluateAll((pageNodes) => pageNodes.map((pageNode) => ({
    children: [...pageNode.children].map((node) => node.className),
    rows: [...pageNode.querySelectorAll('.prowitem_processed')].map((row) => row.dataset.pfTableId),
    rowIds: [...pageNode.querySelectorAll('.prowitem_processed')].map((row) => row.dataset.rowId),
    headers: [...pageNode.querySelectorAll('.prowheader_processed')].map((header) => ({
      id: header.dataset.pfTableId,
      keepWithNext: header.dataset.pfKeepWithNext,
    })),
    mainHeaders: pageNode.querySelectorAll('.pdocinfo002_processed').length,
  })));
  expect(summaries.length).toBeGreaterThan(8);
  expect([...new Set(summaries.flatMap(({ rows }) => rows))]).toEqual(['claims', 'recoveries']);
  summaries.forEach(({ children, rows, headers, mainHeaders }) => {
    const rowTables = [...new Set(rows)];
    expect(mainHeaders).toBe(1);
    expect(children[0]).toBe('pdocinfo002_processed');
    expect(children[1]).toBe('prowheader_processed');
    expect(children.every((className, index) => className !== 'prowheader_processed' || index > 0)).toBe(true);
    expect(headers.map(({ id }) => id)).toEqual(rowTables);
    headers.forEach(({ keepWithNext }) => expect(keepWithNext).toBe('true'));
  });
  const firstRecoveriesPage = summaries.findIndex(({ rows }) => rows.includes('recoveries'));
  expect(firstRecoveriesPage).toBeGreaterThan(0);
  expect(summaries[firstRecoveriesPage - 1].rows.every((tableId) => tableId === 'claims')).toBe(true);
  ['claims', 'recoveries'].forEach((tableId) => {
    const firstChildPage = summaries.find(({ rowIds }) => rowIds.includes(`${tableId}-1`));
    expect(firstChildPage?.headers.map(({ id }) => id)).toContain(tableId);
    expect(firstChildPage?.rowIds[0]).toBe(`${tableId}-1`);
    expect(firstChildPage?.children.slice(0, 3)).toEqual([
      'pdocinfo002_processed', 'prowheader_processed', 'prowitem_processed',
    ]);
  });
});

test('header fixtures preserve empty, single-row, and short-row behavior', async ({ page }) => {
  await page.goto('/index001.html');
  const result = await page.evaluate(() => [0, 1, 20].map((count) => {
    const form = document.createElement('div');
    form.className = `paper_width printform gallery-row-count-${count}`;
    Object.assign(form.dataset, {
      papersizeWidth: '420', papersizeHeight: '260', repeatHeader: 'n', repeatDocinfo: 'n',
      repeatRowheader: 'y', insertDummyRowItemWhileFormatTable: 'n', insertFooterSpacerWhileFormatTable: 'n',
    });
    const header = document.createElement('div');
    header.className = 'prowheader';
    header.dataset.pfTableId = 'recovery';
    header.dataset.pfKeepWithNext = 'true';
    header.textContent = 'Recovery header';
    form.appendChild(header);
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement('div');
      row.className = 'prowitem';
      row.dataset.pfTableId = 'recovery';
      row.dataset.rowId = `recovery-${index + 1}`;
      row.textContent = `Recovery row ${index + 1}`;
      form.appendChild(row);
    }
    document.body.appendChild(form);
    window.PrintForm.format(form);
    const output = document.querySelector(`.gallery-row-count-${count}.printform_formatter_processed`);
    return {
      count,
      pages: output?.querySelectorAll('.printform_page').length || 0,
      rows: output?.querySelectorAll('.prowitem_processed').length || 0,
      headers: output?.querySelectorAll('.prowheader_processed').length || 0,
    };
  }));
  expect(result).toEqual([
    { count: 0, pages: 1, rows: 0, headers: 0 },
    { count: 1, pages: 1, rows: 1, headers: 1 },
    { count: 20, pages: 2, rows: 20, headers: 2 },
  ]);
});

test('payment certificate PDF has six pages', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'PDF page-count verification uses Chromium page.pdf');
  await page.goto('/gallery/designs/subcontractor-payment-certificate.html');
  await page.waitForFunction(() => window.__printFormProcessed === true, null, { timeout: 60000 });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBe(6);
});
