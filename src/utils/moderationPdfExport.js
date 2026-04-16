import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';

/**
 * @param {{ rows: { contentPreview: string, productLabel: string, collaborativeLabel: string, likeCountDisplay: string, aiScore: string }[], filterLabel: string }} p
 */
export function downloadModerationPdf({ rows, filterLabel }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = 40;
  doc.setFontSize(14);
  doc.text('Content moderation export', margin, margin);
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Filter: ${filterLabel}`, margin, margin + 18);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 32);
  doc.setTextColor(0, 0, 0);

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = filterLabel
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  if (!rows.length) {
    doc.setFontSize(11);
    doc.text('No reviews match this filter.', margin, margin + 58);
    doc.save(`moderation-export-${slug || 'all'}-${stamp}.pdf`);
    return;
  }

  const body = rows.map((r) => [
    r.contentPreview,
    r.productLabel,
    r.collaborativeLabel,
    r.likeCountDisplay,
    r.aiScore,
  ]);
  autoTable(doc, {
    startY: margin + 48,
    head: [['Content preview', 'Product', 'Collaborative', 'Likes', 'AI toxicity']],
    body,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: margin, right: margin },
  });

  doc.save(`moderation-export-${slug || 'all'}-${stamp}.pdf`);
}
