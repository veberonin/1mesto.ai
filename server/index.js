require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection (or fallback to in-memory/JSON storage if MongoDB URI not provided)
let isMongoConnected = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wispr_flow';

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 3000
}).then(() => {
  isMongoConnected = true;
  console.log('Connected to MongoDB successfully');
}).catch(err => {
  console.log('MongoDB connection warning: Running with local fallback storage (memory/JSON). Error:', err.message);
});

// Mongoose Schemas
const sessionSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  durationSeconds: Number,
  wordCount: Number,
  averageWpm: Number,
  maxWpm: Number,
  language: String,
  mode: String
});

const Session = mongoose.model('Session', sessionSchema);

// Fallback in-memory storage if MongoDB is offline
let fallbackSessions = [];

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mongoConnected: isMongoConnected });
});

// Save session stats
app.post('/api/stats', async (req, res) => {
  try {
    const { durationSeconds, wordCount, averageWpm, maxWpm, language, mode } = req.body;
    const sessionData = {
      timestamp: new Date(),
      durationSeconds: durationSeconds || 0,
      wordCount: wordCount || 0,
      averageWpm: averageWpm || 0,
      maxWpm: maxWpm || 0,
      language: language || 'ru',
      mode: mode || 'clean'
    };

    if (isMongoConnected) {
      const session = new Session(sessionData);
      await session.save();
    } else {
      fallbackSessions.push({ ...sessionData, id: Date.now() });
    }

    res.json({ success: true, message: 'Stats saved successfully' });
  } catch (err) {
    console.error('Error saving stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get aggregate stats
app.get('/api/stats', async (req, res) => {
  try {
    let sessions = [];
    if (isMongoConnected) {
      sessions = await Session.find().sort({ timestamp: -1 }).limit(100);
    } else {
      sessions = fallbackSessions.slice(-100).reverse();
    }

    // Calculate totals and records
    let totalWords = 0;
    let totalSessions = sessions.length;
    let maxWpmRecord = 0;
    let wpmSum = 0;

    sessions.forEach(s => {
      totalWords += (s.wordCount || 0);
      if ((s.maxWpm || s.averageWpm || 0) > maxWpmRecord) {
        maxWpmRecord = Math.max(s.maxWpm || 0, s.averageWpm || 0);
      }
      wpmSum += (s.averageWpm || 0);
    });

    const avgSessionWpm = totalSessions > 0 ? Math.round(wpmSum / totalSessions) : 0;

    res.json({
      totalWords,
      totalSessions,
      maxWpmRecord,
      avgSessionWpm,
      recentSessions: sessions
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// AI Formatting Endpoint using Gemini API / Emergent Key
app.post('/api/format', async (req, res) => {
  try {
    const { text, mode, language } = req.body;
    if (!text) {
      return res.json({ formattedText: '' });
    }

    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
    
    // If API key provided, attempt Gemini AI formatting
    if (apiKey && apiKey.length > 5) {
      try {
        const prompt = `You are Wispr Flow AI text formatter. Format the following dictated speech transcript.
Rules:
1. Remove filler words ("эм", "ну", "э", "а-а", "um", "uh", "like", "you know").
2. Fix punctuation, capitalization, and grammar automatically.
3. Apply mode: "${mode || 'clean'}".
   - clean: Standard clean text with proper punctuation.
   - email: Professional email structure with greeting and sign-off.
   - bullets: Bullet point list summarizing key takeaways.
   - code: Clean technical explanation or code syntax formatting if applicable.
   - casual: Friendly chat style.
4. Language: ${language === 'ru' ? 'Russian' : 'English'}.
5. Return ONLY the formatted text without markdown code blocks unless requested.

Transcript: "${text}"`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const data = await response.json();
        if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
          let aiText = data.candidates[0].content.parts[0].text.trim();
          // Strip accidental markdown code blocks
          if (aiText.startsWith('```')) {
            aiText = aiText.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
          }
          return res.json({ formattedText: aiText });
        }
      } catch (aiErr) {
        console.log('AI Formatting fallback triggered due to error:', aiErr.message);
      }
    }

    // Fallback smart rule-based formatter if no API key or API call fails
    let cleaned = text
      .replace(/\b(эм|ну|э|а-э|вот|типа того|как бы)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      if (!/[.!?]$/.test(cleaned)) {
        cleaned += '.';
      }
    }

    if (mode === 'bullets' && cleaned) {
      cleaned = `• ${cleaned.split('. ').join('\n• ')}`;
    } else if (mode === 'email' && cleaned) {
      cleaned = `Здравствуйте!\n\n${cleaned}\n\nС уважением,\nКоманда Wispr Flow`;
    }

    res.json({ formattedText: cleaned });
  } catch (err) {
    console.error('Formatting error:', err);
    res.status(500).json({ error: err.message, formattedText: req.body.text });
  }
});

// Serve frontend static files in production
const frontendBuildPath = path.join(__dirname, '../dist');
app.use(express.static(frontendBuildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Wispr Flow Backend running. Frontend build not found yet, run npm run build.');
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Wispr Flow Server running on port ${PORT}`);
});
