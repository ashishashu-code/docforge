const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const { Packer } = require('docx');
const { parseDocx, parsePdf } = require('./parser');
const { convertHtmlToDocx } = require('./htmlToDocx');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Ensure standard directories exist
const letterheadDir = path.join(__dirname, '../assets/letterheads');
const stampDir = path.join(__dirname, '../assets/stamps');
const templatesDir = path.join(__dirname, '../templates');
const productsPath = path.join(__dirname, '../products.json');

[letterheadDir, stampDir, templatesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for local uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'letterhead') cb(null, letterheadDir);
    else if (file.fieldname === 'stamp') cb(null, stampDir);
    else cb(null, templatesDir);
  },
  filename: (req, file, cb) => {
    // Keep a predictable name for primary letterhead and stamp, or original name for templates
    if (file.fieldname === 'letterhead') {
      cb(null, `letterhead${path.extname(file.originalname)}`);
    } else if (file.fieldname === 'stamp') {
      cb(null, `stamp${path.extname(file.originalname)}`);
    } else {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }
});

const upload = multer({ storage });

// ----------------------------------------------------
// Asset Information Endpoints
// ----------------------------------------------------

app.get('/api/assets/info', (req, res) => {
  try {
    const letterheads = fs.readdirSync(letterheadDir);
    const stamps = fs.readdirSync(stampDir);
    res.json({
      letterhead: letterheads.length > 0 ? letterheads[0] : null,
      stamp: stamps.length > 0 ? stamps[0] : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/letterhead', upload.single('letterhead'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  // Clean up any other old files in the directory
  try {
    const files = fs.readdirSync(letterheadDir);
    files.forEach(file => {
      if (file !== req.file.filename) {
        fs.unlinkSync(path.join(letterheadDir, file));
      }
    });
  } catch (err) {
    console.error("Cleanup error for old letterheads:", err);
  }
  
  res.json({ success: true, filename: req.file.filename });
});

app.post('/api/upload/stamp', upload.single('stamp'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  // Clean up any other old files in the directory
  try {
    const files = fs.readdirSync(stampDir);
    files.forEach(file => {
      if (file !== req.file.filename) {
        fs.unlinkSync(path.join(stampDir, file));
      }
    });
  } catch (err) {
    console.error("Cleanup error for old stamps:", err);
  }
  
  res.json({ success: true, filename: req.file.filename });
});

// ----------------------------------------------------
// Template Parsing Endpoints
// ----------------------------------------------------

app.post('/api/templates/parse-sample', upload.single('templateFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    
    let result;
    if (ext === '.docx') {
      result = await parseDocx(buffer);
    } else if (ext === '.pdf') {
      result = await parsePdf(buffer);
    } else {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file format. Please upload PDF or DOCX.' });
    }
    
    // Return parsing result and temporary file path
    res.json({
      name: path.basename(req.file.originalname, ext),
      htmlContent: result.htmlContent,
      placeholders: result.placeholders,
      hasSpecificationsTable: result.hasSpecificationsTable,
    });
    
    // Clean up temporary file
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("Parsing error:", err);
    res.status(500).json({ error: 'Failed to parse the sample document: ' + err.message });
  }
});

// Save, List, and Delete Templates
app.get('/api/templates', (req, res) => {
  try {
    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));
    const templates = files.map(file => {
      const content = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
      return JSON.parse(content);
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', (req, res) => {
  const { id, name, htmlContent, placeholders, hasSpecificationsTable, marginSettings, useLetterhead } = req.body;
  if (!name || !htmlContent) {
    return res.status(400).json({ error: 'Template name and content are required' });
  }
  
  const templateId = id || `tpl_${Date.now()}`;
  const templateData = {
    id: templateId,
    name,
    htmlContent,
    placeholders: placeholders || [],
    hasSpecificationsTable: !!hasSpecificationsTable,
    marginSettings: marginSettings || { top: '25mm', bottom: '25mm', left: '25mm', right: '25mm' },
    useLetterhead: useLetterhead !== undefined ? useLetterhead : true,
    updatedAt: new Date().toISOString()
  };
  
  try {
    fs.writeFileSync(
      path.join(templatesDir, `${templateId}.json`),
      JSON.stringify(templateData, null, 2),
      'utf-8'
    );
    res.json({ success: true, template: templateData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/templates/:id', (req, res) => {
  const file = path.join(templatesDir, `${req.params.id}.json`);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Template not found' });
  }
  try {
    fs.unlinkSync(file);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Product Library Endpoints
// ----------------------------------------------------

app.get('/api/products', (req, res) => {
  try {
    if (!fs.existsSync(productsPath)) {
      fs.writeFileSync(productsPath, '[]', 'utf-8');
    }
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const products = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Products must be an array' });
    }
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf-8');
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Document Generation Engine
// ----------------------------------------------------

function convertNumberToWords(amount) {
  const number = Math.round(amount);
  if (number === 0) return 'ZERO RUPEES ONLY';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHelper(n) {
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertHelper(n % 100) : '');
    if (n < 100000) return convertHelper(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convertHelper(n % 1000) : '');
    if (n < 10000000) return convertHelper(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convertHelper(n % 100000) : '');
    return convertHelper(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convertHelper(n % 10000000) : '');
  }

  return (convertHelper(number) + ' RUPEES ONLY').toUpperCase();
}

async function overlayLetterhead(documentPdfBuffer, letterheadPathOrBuffer, letterheadExtInput) {
  const docPdf = await PDFDocument.load(documentPdfBuffer);
  const letterheadBytes = Buffer.isBuffer(letterheadPathOrBuffer)
    ? letterheadPathOrBuffer
    : fs.readFileSync(letterheadPathOrBuffer);
  const letterheadExt = letterheadExtInput || (typeof letterheadPathOrBuffer === 'string' ? path.extname(letterheadPathOrBuffer).toLowerCase() : '');
  
  const outPdf = await PDFDocument.create();
  const pages = docPdf.getPages();
  
  let embeddedImage;
  let letterheadPdfDoc;
  
  const isImage = letterheadExt === '.png' || letterheadExt === '.jpg' || letterheadExt === '.jpeg';
  
  if (isImage) {
    if (letterheadExt === '.png') {
      embeddedImage = await outPdf.embedPng(letterheadBytes);
    } else {
      embeddedImage = await outPdf.embedJpg(letterheadBytes);
    }
  } else if (letterheadExt === '.pdf') {
    letterheadPdfDoc = await PDFDocument.load(letterheadBytes);
  }
  
  for (let i = 0; i < pages.length; i++) {
    const docPage = pages[i];
    const { width, height } = docPage.getSize();
    
    let addedPage;
    if (isImage) {
      // Create a page of matching size and draw image on background
      addedPage = outPdf.addPage([width, height]);
      addedPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
    } else if (letterheadPdfDoc) {
      // For PDF letterhead, copy the page
      const [lhPage] = await outPdf.copyPages(letterheadPdfDoc, [0]);
      addedPage = outPdf.addPage(lhPage);
    } else {
      // Fallback
      addedPage = outPdf.addPage([width, height]);
    }
    
    // Draw document page content on top
    const embeddedDocPage = await outPdf.embedPage(docPage);
    addedPage.drawPage(embeddedDocPage, {
      x: 0,
      y: 0,
      width: width,
      height: height,
    });
  }
  
  return await outPdf.save();
}

app.post('/api/generate', async (req, res) => {
  const { 
    templateId, 
    formValues, 
    specifications, 
    outputFormat, 
    hasStamp,
    letterheadData,
    letterheadName,
    stampData,
    stampName
  } = req.body;
  
  if (!templateId || !outputFormat) {
    return res.status(400).json({ error: 'templateId and outputFormat are required' });
  }
  
  const templatePath = path.join(templatesDir, `${templateId}.json`);
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  try {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
    let html = template.htmlContent;
    
    // Parse memory buffers if provided by the client
    let memoryLetterheadBuffer = null;
    let memoryLetterheadExt = null;
    if (letterheadData) {
      const parts = letterheadData.split(',');
      const base64Str = parts.length > 1 ? parts[1] : parts[0];
      memoryLetterheadBuffer = Buffer.from(base64Str, 'base64');
      memoryLetterheadExt = letterheadName ? path.extname(letterheadName).toLowerCase() : '';
    }

    let memoryStampBuffer = null;
    if (hasStamp && stampData) {
      const parts = stampData.split(',');
      const base64Str = parts.length > 1 ? parts[1] : parts[0];
      memoryStampBuffer = Buffer.from(base64Str, 'base64');
    }
    
    // 1. Replace Standard Placeholders
    if (formValues) {
      Object.keys(formValues).forEach(key => {
        const val = formValues[key] || '';
        // Replace all occurrences of {{key}}
        const placeholderRegex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        html = html.replace(placeholderRegex, val);
      });
    }
    
    // 2. Build and Replace Specifications Table
    if (template.hasSpecificationsTable && specifications && Array.isArray(specifications)) {
      let tableHtml = `
        <table class="spec-table" style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: sans-serif;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-weight: bold; width: 30%;">Descriptions</th>
              <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-weight: bold; width: 35%;">Bid requirements specifications</th>
              <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-weight: bold; width: 35%;">Offered product specifications</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      specifications.forEach((spec, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        tableHtml += `
          <tr style="background-color: ${rowBg};">
            <td style="border: 1px solid #d1d5db; padding: 8px 10px; vertical-align: top;">${spec.description || ''}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px 10px; vertical-align: top;">${spec.requiredSpec || ''}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px 10px; vertical-align: top;">${spec.offeredSpec || ''}</td>
          </tr>
        `;
      });
      
      tableHtml += `
          </tbody>
        </table>
      `;
      
      // Replace the specifications table tag
      html = html.replace(/\{\{\s*specifications_table\s*\}\}/g, tableHtml);
    }
    
    // 2.5 Build and Replace Quotation Table
    if (html.includes('{{quotation_table}}') && specifications && Array.isArray(specifications)) {
      let subTotal = 0;
      let tableRowsHtml = '';
      
      specifications.forEach((item, idx) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.priceUnit) || 0;
        const gstPercent = parseFloat(item.gst) || 0;
        const itemSubtotal = qty * price;
        const itemGst = itemSubtotal * (gstPercent / 100);
        const itemAmount = itemSubtotal + itemGst;
        
        subTotal += itemAmount;
        
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        const formattedAmount = itemAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedPrice = price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        tableRowsHtml += `
          <tr style="background-color: ${rowBg};">
            <td style="border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; width: 6%;">${idx + 1}</td>
            <td style="border: 1px solid #000; padding: 8px; vertical-align: top; text-align: left; width: 44%;">${item.description || ''}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; width: 10%;">${item.hsnSac || ''}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; width: 8%;">${item.unit || 'unit'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; width: 8%;">${qty}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; width: 10%;">${formattedPrice}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; width: 8%;">${gstPercent}%</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right; vertical-align: top; width: 12%; font-weight: bold;">₹ ${formattedAmount}</td>
          </tr>
        `;
      });

      const finalAmountVal = Math.round(subTotal);
      const roundOffVal = finalAmountVal - subTotal;
      const roundOffSign = roundOffVal >= 0 ? '+' : '-';
      
      const subTotalFormatted = `₹ ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const finalAmountFormatted = `₹ ${finalAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const amountInWords = convertNumberToWords(finalAmountVal);
      
      let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; margin: 0; font-family: sans-serif; border: 1px solid #000; font-size: 13px;">
          <thead>
            <tr style="background-color: #419b88; color: #fff; text-align: center; border-bottom: 1px solid #000;">
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 6%;">Sl. No.</th>
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 44%;">Description</th>
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 10%;">HSN/SAC</th>
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 8%;">Unit</th>
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 8%;">Quantity</th>
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 10%;">Price /Unit</th>
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 8%;">GST (%)</th>
              <th style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 12%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <!-- Sub Total Row -->
            <tr style="border-top: 1.5px solid #000;">
              <td colspan="7" style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold; background-color: #419b88; color: #fff;">Sub Total</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${subTotalFormatted}</td>
            </tr>
            <!-- Amount in Words & Round off / Total -->
            <tr>
              <td colspan="5" rowspan="2" style="border: 1px solid #000; padding: 10px; vertical-align: top; text-align: left; font-weight: bold; line-height: 1.5;">
                Amount In Words: <span style="font-weight: normal; text-transform: uppercase;">${amountInWords}</span>
              </td>
              <td colspan="2" style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">Round off: ${roundOffSign}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">₹ ${Math.abs(roundOffVal).toFixed(2)}</td>
            </tr>
            <tr style="background-color: #419b88; color: #fff; font-weight: bold;">
              <td colspan="2" style="border: 1px solid #000; padding: 8px; text-align: right;">Final Amount:</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: right;">${finalAmountFormatted}</td>
            </tr>
          </tbody>
        </table>
      `;

      html = html.replace(/\{\{\s*quotation_table\s*\}\}/g, tableHtml);
    }
    
    // Find uploaded files for letterhead and stamp (fallback if memory buffers not provided)
    const lhFiles = fs.readdirSync(letterheadDir);
    const stampFiles = fs.readdirSync(stampDir);
    
    const letterheadFileName = lhFiles.length > 0 ? lhFiles[0] : null;
    const letterheadPath = letterheadFileName ? path.join(letterheadDir, letterheadFileName) : null;
    const letterheadExt = letterheadPath ? path.extname(letterheadPath).toLowerCase() : null;
    
    const stampFileName = stampFiles.length > 0 ? stampFiles[0] : null;
    const stampPath = stampFileName ? path.join(stampDir, stampFileName) : null;
    
    // 3. Inject Stamp PNG (if requested)
    let stampBase64 = '';
    const canUseStamp = hasStamp && (memoryStampBuffer || (stampPath && fs.existsSync(stampPath)));
    if (canUseStamp) {
      if (memoryStampBuffer) {
        stampBase64 = `data:image/png;base64,${memoryStampBuffer.toString('base64')}`;
      } else {
        const stampBuffer = fs.readFileSync(stampPath);
        stampBase64 = `data:image/png;base64,${stampBuffer.toString('base64')}`;
      }
      
      const stampImgTag = `<img src="${stampBase64}" style="width: 120px; height: auto; display: inline-block; vertical-align: middle;" alt="Company Stamp" />`;
      
      if (html.includes('{{company_stamp}}')) {
        html = html.replace(/\{\{\s*company_stamp\s*\}\}/g, stampImgTag);
      } else {
        // If no explicit stamp placeholder, we append it towards the end
        // near the authorized signatory or end of doc
        const stampContainer = `
          <div style="margin-top: 30px; text-align: left; page-break-inside: avoid;">
            <p style="font-weight: bold; margin-bottom: 5px;">Authorized Stamp & Signature:</p>
            ${stampImgTag}
          </div>
        `;
        html = html + stampContainer;
      }
    } else {
      // Clear out the placeholder if stamp not requested or missing
      html = html.replace(/\{\{\s*company_stamp\s*\}\}/g, '');
    }

    // ----------------------------------------------------
    // PDF Generation Mode (Puppeteer)
    // ----------------------------------------------------
    if (outputFormat === 'pdf') {
      const isBackgroundLetterhead = template.useLetterhead && 
        (memoryLetterheadBuffer || (letterheadPath && fs.existsSync(letterheadPath)));
      
      // We use `@page` margins to offset content so it repeats correctly on every page
      const topMargin = template.marginSettings?.top || (isBackgroundLetterhead ? '40mm' : '20mm');
      const bottomMargin = template.marginSettings?.bottom || (isBackgroundLetterhead ? '40mm' : '20mm');
      const leftMargin = template.marginSettings?.left || '20mm';
      const rightMargin = template.marginSettings?.right || '20mm';
      
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: A4;
              margin: ${topMargin} ${rightMargin} ${bottomMargin} ${leftMargin};
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #1f2937;
              line-height: 1.6;
              font-size: 14px;
              margin: 0;
              padding: 0;
            }
            p { margin-top: 0; margin-bottom: 1.2em; }
            h1, h2, h3, h4 {
              color: #111827;
              margin-top: 1.5em;
              margin-bottom: 0.5em;
            }
            h1 { font-size: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
            h2 { font-size: 18px; }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th, td {
              word-wrap: break-word;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          </style>
        </head>
        <body>
          <div class="content">
            ${html}
          </div>
        </body>
        </html>
      `;
      
      // Launch Puppeteer browser instance
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      
      let pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
      });
      
      await browser.close();
      
      // If background letterhead is used, overlay it as a background (PDF or Image)
      if (isBackgroundLetterhead) {
        const lhSource = memoryLetterheadBuffer || letterheadPath;
        const lhExt = memoryLetterheadExt || letterheadExt;
        pdfBuffer = await overlayLetterhead(pdfBuffer, lhSource, lhExt);
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${template.name.replace(/\s+/g, '_')}_generated.pdf"`);
      return res.send(Buffer.from(pdfBuffer));
    }
    
    // ----------------------------------------------------
    // DOCX Generation Mode (docx library)
    // ----------------------------------------------------
    if (outputFormat === 'docx') {
      const conversionOptions = {
        letterheadPath: template.useLetterhead ? letterheadPath : null,
        letterheadBuffer: template.useLetterhead ? memoryLetterheadBuffer : null,
        letterheadExt: memoryLetterheadExt || letterheadExt,
        stampPath: stampPath,
        stampBuffer: memoryStampBuffer,
        hasStamp: hasStamp
      };
      
      const doc = convertHtmlToDocx(html, conversionOptions);
      const docBuffer = await Packer.toBuffer(doc);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${template.name.replace(/\s+/g, '_')}_generated.docx"`);
      return res.send(docBuffer);
    }
    
    res.status(400).json({ error: 'Invalid output format' });
  } catch (err) {
    console.error("Generation error:", err);
    res.status(500).json({ error: 'Failed to generate document: ' + err.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Document Automation server is running on http://localhost:${PORT}`);
});
