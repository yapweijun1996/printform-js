import { renderEmptyDocument, renderRows } from "./pagination-render-rows.js";

export function attachPaginationRenderMethods(FormatterClass) {
  FormatterClass.prototype.renderRows = renderRows;
  FormatterClass.prototype.renderEmptyDocument = renderEmptyDocument;
}
