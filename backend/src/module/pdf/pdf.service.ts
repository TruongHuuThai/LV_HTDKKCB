import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
type PdfKitDocument = InstanceType<typeof PDFDocument>;

export interface PdfKeyValueRow {
  label: string;
  value: string;
}

export interface PdfTable {
  headers: string[];
  rows: string[][];
}

export interface PdfSection {
  heading?: string;
  paragraphs?: string[];
  keyValues?: PdfKeyValueRow[];
  table?: PdfTable;
}

export interface PdfReportInput {
  title: string;
  subtitle?: string;
  metadataLines?: string[];
  sections: PdfSection[];
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly regularFontCandidates: string[];
  private readonly boldFontCandidates: string[];
  private resolvedRegularFont: string | null = null;
  private resolvedBoldFont: string | null = null;
  private fontsResolved = false;

  constructor(private readonly config: ConfigService) {
    this.regularFontCandidates = [
      this.config.get<string>('PDF_FONT_PATH', ''),
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\times.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    ].filter(Boolean);

    this.boldFontCandidates = [
      this.config.get<string>('PDF_FONT_BOLD_PATH', ''),
      'C:\\Windows\\Fonts\\arialbd.ttf',
      'C:\\Windows\\Fonts\\timesbd.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ].filter(Boolean);
  }

  async buildReport(input: PdfReportInput) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: input.title,
        Author: 'UMC System',
        Subject: 'PDF report',
      },
    });

    this.applyFonts(doc);

    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error) => reject(error));

      this.setFont(doc, true);
      doc.fontSize(18).text(input.title, { align: 'left' });

      if (input.subtitle) {
        this.setFont(doc, false);
        doc.moveDown(0.25);
        doc.fontSize(11).fillColor('#374151').text(input.subtitle, { align: 'left' });
      }

      const generatedAt = new Date().toISOString();
      const metadataLines = [...(input.metadataLines || []), `Generated at: ${generatedAt}`];
      this.setFont(doc, false);
      doc.moveDown(0.25);
      doc.fontSize(9).fillColor('#6B7280');
      metadataLines.forEach((line) => {
        doc.text(line, { align: 'left' });
      });
      doc.moveDown(0.6);

      for (const section of input.sections) {
        doc.x = doc.page.margins.left;
        this.ensureBottomSpace(doc, 80);
        if (section.heading) {
          this.setFont(doc, true);
          doc.fontSize(13).fillColor('#111827').text(section.heading);
          doc.moveDown(0.25);
        }

        if ((section.paragraphs || []).length > 0) {
          this.setFont(doc, false);
          doc.fontSize(10).fillColor('#1F2937');
          section.paragraphs?.forEach((line) => {
            this.ensureBottomSpace(doc, 24);
            doc.text(line);
          });
          doc.moveDown(0.4);
        }

        if ((section.keyValues || []).length > 0) {
          this.renderKeyValues(doc, section.keyValues || []);
          doc.moveDown(0.35);
        }

        if (section.table) {
          this.renderTable(doc, section.table);
          doc.moveDown(0.5);
        }
      }

      doc.end();
    });
  }

  private applyFonts(doc: PdfKitDocument) {
    if (!this.fontsResolved) {
      this.resolvedRegularFont = this.findExistingPath(this.regularFontCandidates);
      this.resolvedBoldFont = this.findExistingPath(this.boldFontCandidates);
      this.fontsResolved = true;

      if (!this.resolvedRegularFont) {
        this.logger.warn(
          'No system TTF font found for PDF unicode rendering. Falling back to built-in Helvetica.',
        );
      }
    }

    if (this.resolvedRegularFont) {
      doc.registerFont('UMCRegular', this.resolvedRegularFont);
    }
    if (this.resolvedBoldFont) {
      doc.registerFont('UMCBold', this.resolvedBoldFont);
    }
  }

  private setFont(doc: PdfKitDocument, bold: boolean) {
    if (bold && this.resolvedBoldFont) {
      doc.font('UMCBold');
      return;
    }
    if (!bold && this.resolvedRegularFont) {
      doc.font('UMCRegular');
      return;
    }
    if (bold) {
      doc.font('Helvetica-Bold');
      return;
    }
    doc.font('Helvetica');
  }

  private findExistingPath(paths: string[]) {
    for (const candidate of paths) {
      try {
        if (candidate && existsSync(candidate)) return candidate;
      } catch {
        continue;
      }
    }
    return null;
  }

  private ensureBottomSpace(doc: PdfKitDocument, minimumSpace: number) {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + minimumSpace > bottom) {
      doc.addPage();
      this.setFont(doc, false);
    }
  }

  private renderKeyValues(doc: PdfKitDocument, rows: PdfKeyValueRow[]) {
    doc.x = doc.page.margins.left;
    const labelWidth = 170;
    const valueWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - labelWidth - 8;
    this.setFont(doc, false);
    doc.fontSize(10).fillColor('#111827');

    for (const row of rows) {
      this.ensureBottomSpace(doc, 24);
      const startY = doc.y;
      this.setFont(doc, true);
      doc.text(`${row.label}:`, doc.page.margins.left, startY, { width: labelWidth });
      this.setFont(doc, false);
      doc.text(row.value || '-', doc.page.margins.left + labelWidth + 8, startY, {
        width: valueWidth,
      });
      doc.y = Math.max(
        startY + 16,
        doc.y + 4,
      );
    }
  }

  private renderTable(doc: PdfKitDocument, table: PdfTable) {
    if (!table.headers.length) return;
    doc.x = doc.page.margins.left;
    const columnCount = table.headers.length;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = tableWidth / columnCount;
    let y = doc.y;

    const drawHeader = () => {
      this.ensureBottomSpace(doc, 34);
      y = doc.y;
      this.setFont(doc, true);
      doc.fontSize(9).fillColor('#111827');
      for (let index = 0; index < columnCount; index += 1) {
        const x = doc.page.margins.left + index * columnWidth;
        doc
          .rect(x, y, columnWidth, 24)
          .fillAndStroke('#E5E7EB', '#D1D5DB');
        doc
          .fillColor('#111827')
          .text(table.headers[index] || '-', x + 4, y + 7, {
            width: columnWidth - 8,
            align: 'left',
          });
      }
      doc.y = y + 24;
      y = doc.y;
    };

    drawHeader();
    this.setFont(doc, false);
    doc.fontSize(9).fillColor('#111827');

    table.rows.forEach((row) => {
      const normalized = Array.from({ length: columnCount }).map((_, index) => row[index] || '-');
      const textHeights = normalized.map((cell) =>
        doc.heightOfString(cell, { width: columnWidth - 8 }),
      );
      const rowHeight = Math.max(22, ...textHeights.map((height) => height + 8));
      this.ensureBottomSpace(doc, rowHeight + 2);
      if (doc.y !== y) {
        drawHeader();
      }

      y = doc.y;
      for (let index = 0; index < columnCount; index += 1) {
        const x = doc.page.margins.left + index * columnWidth;
        doc.rect(x, y, columnWidth, rowHeight).stroke('#E5E7EB');
        doc.fillColor('#111827').text(normalized[index], x + 4, y + 4, {
          width: columnWidth - 8,
          align: 'left',
        });
      }
      doc.y = y + rowHeight;
    });

    doc.x = doc.page.margins.left;
  }
}
