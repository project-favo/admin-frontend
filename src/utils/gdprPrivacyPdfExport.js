import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';

function addCalendarMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * @param {{ dataRetentionMonths: string | number, accountEmail?: string | null }} p
 */
export function downloadGdprPrivacyPdf({ dataRetentionMonths, accountEmail }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxW = pageWidth - margin * 2;

  const monthsNum = Number(dataRetentionMonths);
  const months = Number.isFinite(monthsNum) && monthsNum > 0 ? Math.round(monthsNum) : null;
  const retentionLabel =
    months != null
      ? `${months} months`
      : String(dataRetentionMonths ?? '—');

  const generated = new Date();
  const nominalHorizon =
    months != null ? addCalendarMonths(generated, months) : null;
  const horizonStr =
    nominalHorizon != null ? nominalHorizon.toLocaleDateString() : '—';
  const stamp = generated.toISOString().slice(0, 10);

  let y = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('GDPR & data privacy report', margin, y);
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Generated: ${generated.toLocaleString()}`, margin, y);
  y += 22;
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    head: [['Setting', 'Value']],
    body: [
      ['User data retention (selected)', retentionLabel],
      [
        'Nominal retention horizon (from report date)',
        months != null
          ? `${horizonStr} (${months} months after ${generated.toLocaleDateString()})`
          : '—',
      ],
      ['Administrator account', accountEmail != null && String(accountEmail).trim() !== '' ? String(accountEmail) : '—'],
      ['Scope', 'Browser-stored admin preference (see notes below)'],
    ],
    styles: { fontSize: 9, cellPadding: 8 },
    headStyles: { fillColor: [55, 55, 55], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 170 },
      1: { cellWidth: maxW - 170 },
    },
  });

  y = doc.lastAutoTable.finalY + 18;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const summary =
    months != null
      ? `This report documents the user data retention period currently selected in the admin portal: ${retentionLabel}. ` +
        'Align internal processes and any backend retention policies with this period where applicable.'
      : 'No valid retention period was selected. Choose 12, 24, or 36 months in Settings before relying on this report.';

  const summaryLines = doc.splitTextToSize(summary, maxW);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 12 + 14;

  doc.setFont('helvetica', 'bold');
  doc.text('Notes', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');

  const notes = [
    'Retention and moderation-related values in Settings are stored locally in this browser until a system-wide API is available.',
    'This PDF is a configuration snapshot for documentation; it is not a substitute for legal advice or a full data processing register.',
    'For data subject requests or erasure, follow your organization’s procedures and backend tooling when provided.',
  ];

  for (const para of notes) {
    const lines = doc.splitTextToSize(para, maxW);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 10;
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  doc.save(`gdpr-data-privacy-report-${stamp}.pdf`);
}
