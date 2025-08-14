const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

const app = express();
const PORT = process.env.PORT || 3002;

// Normalize paths for Windows
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
const CONVERTED_DIR = path.resolve(__dirname, 'converted');

// Function to validate that a file path is within a allowed directory
function isPathInDirectory(file, directory) {
  const resolvedFile = path.resolve(file);
  const resolvedDirectory = path.resolve(directory);
  return resolvedFile.startsWith(resolvedDirectory);
}

// Function to sanitize filename
function sanitizeFilename(filename) {
  // Remove path separators and other potentially dangerous characters
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '');
}

// Serve static files from the build directory (React app)
app.use(express.static(path.join(__dirname, 'build')));
// Use resolved paths for static serving with security measures
app.use('/converted', express.static(CONVERTED_DIR, {
  // Add security headers
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}), (err, req, res, next) => {
  // Error handling middleware for static file serving
  console.error('Static file serving error:', err);
  if (err.code === 'ENOENT') {
    return res.status(404).send('File not found');
  }
  res.status(500).send('Internal server error');
});

// For any other route, serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Ensure directories exist with proper error handling
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR, { recursive: true });
} catch (err) {
  console.error('Error creating directories:', err);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const id = nanoid(8);
    const ext = path.extname(file.originalname);
    // Sanitize the original filename
    const baseName = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${Date.now()}-${id}${ext}`);
  }
});

const upload = multer({ storage });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        console.error(`Command failed: ${cmd}`, { args, code, stderr });
        reject(new Error(`${cmd} exited with ${code}: ${stderr}`));
      }
    });
    // Handle spawn errors
    child.on('error', (err) => {
      console.error(`Failed to spawn command: ${cmd}`, err);
      reject(new Error(`Failed to run ${cmd}: ${err.message}`));
    });
  });
}

function findRecentPdfForBase(base) {
  // Look for files in CONVERTED_DIR that start with base and end with .pdf
  try {
    const files = fs.readdirSync(CONVERTED_DIR);
    const candidates = files
      .filter(f => f.toLowerCase().endsWith('.pdf') && (f.startsWith(base) || f.startsWith(path.basename(base))))
      .map(f => {
        const full = path.resolve(CONVERTED_DIR, f);
        // Validate path is within converted directory
        if (!isPathInDirectory(full, CONVERTED_DIR)) {
          throw new Error('File access restricted to converted directory');
        }
        const stat = fs.statSync(full);
        return { full, mtime: stat.mtimeMs, size: stat.size };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return candidates.length ? candidates[0].full : null;
  } catch (err) {
    console.error('Error in findRecentPdfForBase:', err);
    return null;
  }
}

async function convertToViewable(inputPath) {
  // Validate input path is within uploads directory
  if (!isPathInDirectory(inputPath, UPLOAD_DIR)) {
    throw new Error('File access restricted to uploads directory');
  }
  
  const ext = path.extname(inputPath).toLowerCase();
  const base = path.basename(inputPath, ext);
  const outBase = path.join(CONVERTED_DIR, base);

  // Handle epub directly (no conversion)
  if (ext === '.epub') {
    const dst = `${outBase}.epub`;
    try { 
      // Validate destination path is within converted directory
      if (!isPathInDirectory(dst, CONVERTED_DIR)) {
        throw new Error('File access restricted to converted directory');
      }
      fs.copyFileSync(inputPath, dst); 
    } catch (e) {
      console.error('Error copying epub file:', e);
    }
    return { type: 'epub', path: fs.existsSync(dst) ? dst : inputPath };
  }

  // For mobi -> epub if calibre's ebook-convert is available
  if (ext === '.mobi') {
    const epubPath = `${outBase}.epub`;
    try {
      // Validate destination path is within converted directory
      if (!isPathInDirectory(epubPath, CONVERTED_DIR)) {
        throw new Error('File access restricted to converted directory');
      }
      await runCommand('ebook-convert', [
        `"${inputPath}"`,
        `"${epubPath}"`
      ]);
      return { type: 'epub', path: epubPath };
    } catch (e) {
      // Fall back to PDF via calibre if available
      const pdfPath = `${outBase}.pdf`;
      try {
        // Validate destination path is within converted directory
        if (!isPathInDirectory(pdfPath, CONVERTED_DIR)) {
          throw new Error('File access restricted to converted directory');
        }
        await runCommand('ebook-convert', [
          `"${inputPath}"`,
          `"${pdfPath}"`
        ]);
        return { type: 'pdf', path: pdfPath };
      } catch (e2) {
        throw new Error('Need Calibre (ebook-convert) installed for MOBI');
      }
    }
  }

  // Office/Pages/WPS/XML/XPS -> PDF via LibreOffice or other tools
  const toPdfCandidates = [
    '.docm', '.dotx', '.dotm', '.wps', '.xml', '.pages', '.xps',
    '.docx', '.doc', '.rtf', '.txt', '.odt'
  ];
  if (toPdfCandidates.includes(ext)) {
    const pdfPath = `${outBase}.pdf`;

    // Try LibreOffice first
    try {
      // soffice --headless --convert-to pdf --outdir converted uploads/foo.docm
      // Use resolve to ensure proper path handling on Windows
      const resolvedInputPath = path.resolve(inputPath);
      const resolvedConvertedDir = path.resolve(CONVERTED_DIR);
      
      // Validate paths
      if (!isPathInDirectory(resolvedInputPath, UPLOAD_DIR)) {
        throw new Error('File access restricted to uploads directory');
      }
      
      await runCommand('soffice', [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', resolvedConvertedDir,
        resolvedInputPath
      ]);
      
      // Ensure expected path exists, LibreOffice may vary the output name
      const maybePdf = path.resolve(CONVERTED_DIR, `${path.basename(base)}.pdf`);
      // Validate path
      if (!isPathInDirectory(maybePdf, CONVERTED_DIR)) {
        throw new Error('File access restricted to converted directory');
      }
      
      if (fs.existsSync(maybePdf)) return { type: 'pdf', path: maybePdf };
      if (fs.existsSync(pdfPath)) return { type: 'pdf', path: pdfPath };
      const found = findRecentPdfForBase(path.basename(base));
      if (found) {
        // Validate found path
        if (!isPathInDirectory(found, CONVERTED_DIR)) {
          throw new Error('File access restricted to converted directory');
        }
        // Normalize name by copying to our preferred path
        try { 
          fs.copyFileSync(found, pdfPath); 
          return { type: 'pdf', path: pdfPath }; 
        } catch (copyErr) {
          console.error('Error copying PDF file:', copyErr);
        }
        return { type: 'pdf', path: found };
      }
    } catch (e) {
      console.error('LibreOffice conversion failed:', e);
      // continue to other methods
    }

    // Special-case .pages: try to extract embedded QuickLook PDF
    if (ext === '.pages') {
      try {
        const zip = new AdmZip(inputPath);
        const entries = zip.getEntries();
        const pdfEntry = entries.find(en => /QuickLook\/.+\.pdf$/i.test(en.entryName) || /Preview\.pdf$/i.test(en.entryName));
        if (pdfEntry) {
          const data = pdfEntry.getData();
          // Validate destination path
          if (!isPathInDirectory(pdfPath, CONVERTED_DIR)) {
            throw new Error('File access restricted to converted directory');
          }
          fs.writeFileSync(pdfPath, data);
          if (fs.existsSync(pdfPath)) return { type: 'pdf', path: pdfPath };
        }
      } catch (_) {
        // not a zip or no embedded pdf
      }
    }

    // Try XPS specific: mutool convert to pdf if available
    if (ext === '.xps') {
      try {
        // Validate destination path
        if (!isPathInDirectory(pdfPath, CONVERTED_DIR)) {
          throw new Error('File access restricted to converted directory');
        }
        await runCommand('mutool', [
          'convert',
          '-o', `"${pdfPath}"`,
          `"${inputPath}"`
        ]);
        if (fs.existsSync(pdfPath)) return { type: 'pdf', path: pdfPath };
      } catch (e) {
        console.error('MuPDF conversion failed:', e);
      }
    }

    throw new Error('Conversion to PDF failed. Install LibreOffice (soffice) and/or MuPDF (mutool).');
  }

  // If already a PDF
  if (ext === '.pdf') {
  const dst = `${outBase}.pdf`;
  try { 
    // Validate destination path
    if (!isPathInDirectory(dst, CONVERTED_DIR)) {
      throw new Error('File access restricted to converted directory');
    }
    fs.copyFileSync(inputPath, dst); 
  } catch (e) {
    console.error('Error copying PDF file:', e);
  }
  return { type: 'pdf', path: fs.existsSync(dst) ? dst : inputPath };
  }

  throw new Error(`Unsupported extension: ${ext}`);
}

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await convertToViewable(req.file.path);
    const id = nanoid(8);
    // Ensure we only use the basename for the URL to avoid path traversal issues
    const fileName = path.basename(result.path);
    const publicPath = `/converted/${fileName}`;
    res.json({ id, type: result.type, url: publicPath, name: req.file.originalname });
  } catch (err) {
    console.error('Upload/Conversion error:', err);
    // Log additional details for debugging
    console.error('File details:', {
      originalname: req.file?.originalname,
      filename: req.file?.filename,
      path: req.file?.path
    });
    res.status(500).json({ error: err.message });
  }
});

app.get('/view/pdf', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');
  res.sendFile(path.join(__dirname, 'views', 'pdf.html'));
});

app.get('/view/epub', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');
  res.sendFile(path.join(__dirname, 'views', 'epub.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
