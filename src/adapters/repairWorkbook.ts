import JSZip from 'jszip';

/**
 * Rewrites a workbook that the xlsx reader refuses, dropping the parts it
 * cannot parse.
 *
 * One real customer export (MEDİTERA) is a valid Excel file that fails to
 * open: its sheet is an Excel Table whose autoFilter filters by cell colour,
 * and the reader throws on the `<colorFilter>` node before a single row is
 * read. None of that is ledger data — a table is a formatting wrapper and a
 * filter is a view — so the honest repair is to strip the wrapper and keep
 * the cells.
 *
 * This runs only after a parse has already failed, so a workbook that opens
 * normally never goes near it.
 */
export async function stripPresentationParts(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const out = new JSZip();

  for (const path of Object.keys(zip.files)) {
    const file = zip.files[path];
    if (file.dir) continue;
    // Table definitions carry the filters that break the reader.
    if (path.startsWith('xl/tables/')) continue;

    if (path.endsWith('.xml') || path.endsWith('.rels')) {
      let text = await file.async('string');
      if (path.startsWith('xl/worksheets/')) {
        text = text
          .replace(/<tableParts[\s\S]*?<\/tableParts>/g, '')
          .replace(/<tableParts[^>]*\/>/g, '')
          .replace(/<autoFilter[\s\S]*?<\/autoFilter>/g, '')
          .replace(/<autoFilter[^>]*\/>/g, '');
      }
      if (path.endsWith('.rels')) {
        text = text.replace(/<Relationship[^>]*\/tables\/[^>]*\/>/g, '');
      }
      if (path === '[Content_Types].xml') {
        text = text.replace(/<Override[^>]*\/xl\/tables\/[^>]*\/>/g, '');
      }
      out.file(path, text);
    } else {
      out.file(path, await file.async('uint8array'));
    }
  }

  return out.generateAsync({ type: 'arraybuffer' });
}
