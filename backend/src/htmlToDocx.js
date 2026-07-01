const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, AlignmentType, Header, Footer, WidthType, BorderStyle } = docx;
const fs = require('fs');
const path = require('path');

/**
 * Parses simple HTML tags to construct a docx Document.
 * Supports: p, h1, h2, h3, strong, em, br, table, tr, td, th, ul, ol, li, and inline image placeholders.
 */
function convertHtmlToDocx(html, options = {}) {
  const {
    letterheadPath,
    letterheadBuffer,
    letterheadExt: optLetterheadExt,
    stampPath,
    stampBuffer,
    margins = { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // in twips (1 inch = 1440)
    hasStamp = false
  } = options;

  // Let's tokenize the HTML using regex
  const tagRegex = /(<[^>]+>)/g;
  const tokens = html.split(tagRegex);

  const children = [];
  let currentParagraphRuns = [];
  let currentParagraphAlignment = AlignmentType.LEFT;
  let currentParagraphHeading = null;

  let inTable = false;
  let tableRows = [];
  let currentRowCells = [];
  let currentCellParagraphs = [];
  let inCell = false;
  let cellIsHeader = false;
  let currentColSpan = 1;
  let cellShading = undefined;

  let inList = false;
  let listLevel = 0;
  let listType = 'bullet'; // bullet or number

  // Styling state stack for inline styles
  const styleStack = {
    bold: false,
    italic: false,
    underline: false,
  };

  const flushParagraph = () => {
    if (currentParagraphRuns.length > 0) {
      const headingVal = currentParagraphHeading;
      const p = new Paragraph({
        children: currentParagraphRuns,
        alignment: currentParagraphAlignment,
        heading: headingVal,
        spacing: { after: 120, before: 60 } // subtle spacing
      });
      
      if (inCell) {
        currentCellParagraphs.push(p);
      } else {
        children.push(p);
      }
      currentParagraphRuns = [];
    }
    currentParagraphHeading = null;
    currentParagraphAlignment = AlignmentType.LEFT;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.startsWith('<')) {
      const lowerToken = token.toLowerCase();
      const tagNameMatch = lowerToken.match(/<\/?([a-z0-9]+)/);
      const tagName = tagNameMatch ? tagNameMatch[1] : '';

      if (lowerToken.startsWith('</')) {
        // Closing tag
        switch (tagName) {
          case 'p':
            flushParagraph();
            break;
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
            flushParagraph();
            break;
          case 'strong':
          case 'b':
            styleStack.bold = false;
            break;
          case 'em':
          case 'i':
            styleStack.italic = false;
            break;
          case 'u':
            styleStack.underline = false;
            break;
          case 'table':
            if (tableRows.length > 0) {
              const tbl = new Table({
                rows: tableRows,
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: "888888" },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "EAEAEA" },
                  insideVertical: { style: BorderStyle.NONE }
                }
              });
              children.push(tbl);
              // Add a blank spacer paragraph after tables
              children.push(new Paragraph({ spacing: { after: 120 } }));
            }
            tableRows = [];
            inTable = false;
            break;
          case 'tr':
            if (currentRowCells.length > 0) {
              tableRows.push(new TableRow({ children: currentRowCells }));
            }
            currentRowCells = [];
            break;
          case 'td':
          case 'th':
            flushParagraph();
            if (currentCellParagraphs.length === 0) {
              currentCellParagraphs.push(new Paragraph(""));
            }
            
            // Design the table cell
            currentRowCells.push(new TableCell({
              children: currentCellParagraphs,
              shading: cellShading ? { fill: cellShading } : undefined,
              columnSpan: currentColSpan > 1 ? currentColSpan : undefined,
              margins: {
                top: 140,
                bottom: 140,
                left: 140,
                right: 140,
              }
            }));
            currentCellParagraphs = [];
            inCell = false;
            cellIsHeader = false;
            currentColSpan = 1;
            cellShading = undefined;
            break;
          case 'ul':
          case 'ol':
            inList = false;
            break;
          case 'li':
            flushParagraph();
            break;
        }
      } else {
        // Opening tag
        switch (tagName) {
          case 'p':
            flushParagraph();
            break;
          case 'h1':
            flushParagraph();
            currentParagraphHeading = docx.HeadingLevel.HEADING_1;
            break;
          case 'h2':
            flushParagraph();
            currentParagraphHeading = docx.HeadingLevel.HEADING_2;
            break;
          case 'h3':
            flushParagraph();
            currentParagraphHeading = docx.HeadingLevel.HEADING_3;
            break;
          case 'strong':
          case 'b':
            styleStack.bold = true;
            break;
          case 'em':
          case 'i':
            styleStack.italic = true;
            break;
          case 'u':
            styleStack.underline = true;
            break;
          case 'br':
            currentParagraphRuns.push(new TextRun({ text: "", break: 1 }));
            break;
          case 'table':
            inTable = true;
            tableRows = [];
            break;
          case 'tr':
            currentRowCells = [];
            break;
          case 'td':
          case 'th':
            inCell = true;
            cellIsHeader = (tagName === 'th');
            if (cellIsHeader) styleStack.bold = true;
            currentCellParagraphs = [];
            
            // Extract colspan attribute
            currentColSpan = 1;
            const colspanMatch = token.match(/colspan=["'](\d+)["']/i);
            if (colspanMatch) {
              currentColSpan = parseInt(colspanMatch[1], 10);
            }
            
            // Extract shading color from style="background-color: #HEX"
            cellShading = cellIsHeader ? "F3F4F6" : undefined;
            const shadingMatch = token.match(/background-color:\s*#([a-fA-F0-9]{6})/i);
            if (shadingMatch) {
              cellShading = shadingMatch[1];
            }
            break;
          case 'ul':
            inList = true;
            listType = 'bullet';
            break;
          case 'ol':
            inList = true;
            listType = 'number';
            break;
          case 'li':
            flushParagraph();
            // Prefix bullets or numbers
            if (listType === 'bullet') {
              currentParagraphRuns.push(new TextRun({ text: "•  ", bold: true }));
            }
            break;
          case 'img':
            // Check if there is a stamp placeholder inside or image
            // Typically images inside paragraphs are custom handled, but we'll support inline images if needed.
            break;
        }
      }
    } else {
      // Text node
      const text = token;
      
      // If we are replacing the stamp image
      if (text.includes('{{company_stamp}}') && hasStamp && (stampBuffer || (stampPath && fs.existsSync(stampPath)))) {
        try {
          const finalStampBuffer = stampBuffer || fs.readFileSync(stampPath);
          const stampImg = new ImageRun({
            data: finalStampBuffer,
            transformation: {
              width: 100,
              height: 100,
            },
          });
          currentParagraphRuns.push(stampImg);
        } catch (e) {
          console.error("Failed to insert stamp in DOCX", e);
          currentParagraphRuns.push(new TextRun({ text: "[Stamp Image Error]", color: "FF0000" }));
        }
      } else {
        // Standard text run
        currentParagraphRuns.push(new TextRun({
          text: text,
          bold: styleStack.bold,
          italic: styleStack.italic,
          underline: styleStack.underline ? {} : undefined,
          font: "Arial",
          size: inTable ? 20 : 22, // Word size is in half-points (22 = 11pt, 20 = 10pt)
        }));
      }
    }
  }

  // Flush any final paragraph runs
  flushParagraph();

  // If stamp was requested and not inserted via a placeholder, append it to the end of the document
  if (hasStamp && (stampBuffer || (stampPath && fs.existsSync(stampPath))) && !html.includes('{{company_stamp}}')) {
    try {
      const finalStampBuffer = stampBuffer || fs.readFileSync(stampPath);
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Authorized Stamp & Signature:", bold: true, break: 2 }),
          new TextRun({ text: "", break: 1 }),
          new ImageRun({
            data: finalStampBuffer,
            transformation: {
              width: 120,
              height: 120,
            },
          })
        ],
        spacing: { before: 240 }
      }));
    } catch (e) {
      console.error("Failed to append final stamp in DOCX", e);
    }
  }

  // Set up Header / Footer
  const docHeaderChildren = [];
  if (letterheadBuffer || (letterheadPath && fs.existsSync(letterheadPath))) {
    // Note: Word headers only support images (PNG/JPG). If letterhead is a PDF, we won't embed it directly,
    // but if it is an image (PNG/JPG), we can embed it perfectly in the header.
    const ext = optLetterheadExt || (letterheadPath ? path.extname(letterheadPath).toLowerCase() : '');
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      try {
        const finalHeaderBuffer = letterheadBuffer || fs.readFileSync(letterheadPath);
        docHeaderChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: finalHeaderBuffer,
              transformation: {
                width: 600, // Wide header
                height: 100,
              },
            })
          ],
          spacing: { after: 200 }
        }));
      } catch (e) {
        console.error("Failed to add letterhead to DOCX header", e);
      }
    } else {
      console.warn("Letterhead is a PDF; DOCX headers only support images. Skipping image embedding in DOCX header.");
    }
  }

  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Page ", size: 18, font: "Arial" }),
          new TextRun({ text: "1 of 1", size: 18, font: "Arial" }) // Simple placeholder
        ],
      }),
    ],
  });

  // Construct Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: margins.top,
              bottom: margins.bottom,
              left: margins.left,
              right: margins.right,
            },
          },
        },
        headers: docHeaderChildren.length > 0 ? {
          default: new Header({ children: docHeaderChildren }),
        } : undefined,
        footers: {
          default: docFooter,
        },
        children: children,
      },
    ],
  });

  return doc;
}

module.exports = {
  convertHtmlToDocx
};
