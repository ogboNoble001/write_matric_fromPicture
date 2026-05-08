require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors({ origin: '*' }));
app.use(express.json());

// Main extraction endpoint
app.post('/api/extract-matric', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    const prompt = `
      You are a data extraction assistant. Extract ALL student records visible in this image.
      
      Return ONLY a valid JSON array with no markdown formatting, no code blocks, no explanation.
      Just raw JSON.
      
      Each object must have these exact fields:
      - name: full student name (string)
      - matric: matric number (string)
      - department: department name (string)
      - level: level e.g. "100" (string)
      - gender: "MALE" or "FEMALE" (string)
      
      If a field is not visible, use null.
      Extract every single student you can see, do not skip any.
      
      Example format:
      [{"name":"JOHN DOE CHUKWU","matric":"202440123456AB","department":"AGRICULTURAL BUSINESS","level":"100","gender":"MALE"}]
    `;
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64Image } }
    ]);
    
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    
    res.json({ success: true, count: data.length, data });
    
  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: 'Extraction failed', details: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', gemini: !!process.env.GEMINI_API_KEY });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Matric Extractor running on port ${PORT}`);
});