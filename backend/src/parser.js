const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

/**
 * Extracts placeholders matching {{placeholder_name}} from a string.
 * Excludes {{specifications_table}} as it is handled dynamically.
 */
function extractPlaceholders(text) {
  if (!text) return [];
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  const placeholders = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const val = match[1].trim();
    if (val !== 'specifications_table') {
      placeholders.add(val);
    }
  }
  return Array.from(placeholders);
}

/**
 * Parses DOCX file buffer and returns HTML representation and placeholders.
 */
async function parseDocx(buffer) {
  const result = await mammoth.convertToHtml({ buffer: buffer });
  const html = result.value; // The generated HTML
  const placeholders = extractPlaceholders(html);
  
  // Also check if specifications table is present
  const hasTable = html.includes('{{specifications_table}}');
  
  return {
    htmlContent: html,
    placeholders,
    hasSpecificationsTable: hasTable,
    warnings: result.warnings
  };
}

/**
 * Parses PDF file buffer and returns a text-based HTML representation and placeholders.
 */
async function parsePdf(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  
  // Format PDF plain text to basic HTML paragraphs
  const paragraphs = text
    .split(/\n\s*\n/) // Split by blank lines to find paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
    
  const placeholders = extractPlaceholders(text);
  const hasTable = text.includes('{{specifications_table}}');
  
  return {
    htmlContent: paragraphs,
    placeholders,
    hasSpecificationsTable: hasTable
  };
}

module.exports = {
  extractPlaceholders,
  parseDocx,
  parsePdf
};
