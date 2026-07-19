/* eslint-disable no-console */

export function attachPaginationDummyMethods(FormatterClass) {
  FormatterClass.prototype.insertFooterDummyRows = function insertFooterDummyRows(container, pageContext, currentHeight, reservedHeight, footerLabel) {
    const availableSpace = pageContext.limit - currentHeight - reservedHeight;
    const dummyHeight = this.config.heightOfDummyRowItem || 27;
    const numDummies = Math.floor(availableSpace / dummyHeight);

    if (numDummies > 0 && this.debug) {
      console.log(`[printform]   >> Inserting ${numDummies} dummy rows before ${footerLabel}`);
    }

    const defaultDummyContent = `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;" class="prowitem_dummy"><tr><td style="height:${dummyHeight}px;">&nbsp;</td></tr></table>`;
    const dummyContent = this.config.customDummyRowItemContent || defaultDummyContent;

    for (let i = 0; i < numDummies; i++) {
      if (dummyContent) {
        const dummyDiv = document.createElement('div');
        dummyDiv.innerHTML = dummyContent;
        let dummyNode = dummyDiv.firstElementChild;

        if (!dummyNode) {
          dummyDiv.innerHTML = `<div style="height:${dummyHeight}px" class="prowitem_dummy">&nbsp;</div>`;
          dummyNode = dummyDiv.firstElementChild;
        }

        if (dummyNode) {
          if (!dummyNode.classList.contains('prowitem_dummy')) {
            dummyNode.classList.add('prowitem_dummy');
          }
          container.appendChild(dummyNode);
        }
      }
    }

    return this.measureContentHeight(container, pageContext.repeatingHeight);
  };
}
