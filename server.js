const express = require('express');
const cors = require('cors');
require('dotenv').config();

const TradingBot = require('./src/TradingBot');
const DiscordBot = require('./src/DiscordBot');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize bots
const tradingBot = new TradingBot();
const discordBot = new DiscordBot();

// Initialize bots
(async () => {
  try {
    await tradingBot.initialize();
    await discordBot.initialize();
    tradingBot.setDiscordBot(discordBot);
    console.log('Bots initialized successfully');

    // Start automated analysis using setInterval
    startAutomatedAnalysis();
  } catch (error) {
    console.error('Failed to initialize bots:', error);
  }
})();

// Automated analysis function
function startAutomatedAnalysis() {
  const analysisInterval = tradingBot.getConfig().analysisInterval || 5; // minutes
  const intervalMs = analysisInterval * 60 * 1000; // Convert to milliseconds

  console.log(`Starting automated analysis every ${analysisInterval} minutes`);

  setInterval(async () => {
    if (tradingBot.getConfig().enabled) {
      console.log('Running scheduled analysis...');
      try {
        await tradingBot.analyzeAllPairs();
      } catch (error) {
        console.error('Scheduled analysis failed:', error);
      }
    }
  }, intervalMs);
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Get current configuration
app.get('/api/config', (req, res) => {
  res.json(tradingBot.getConfig());
});

// Update configuration
app.post('/api/config', (req, res) => {
  try {
    tradingBot.updateConfig(req.body);
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Manual analysis trigger
app.post('/api/analyze', async (req, res) => {
  try {
    const results = await tradingBot.analyzeAllPairs();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent signals
app.get('/api/signals', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(tradingBot.getRecentSignals(limit));
});

// Get logs
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(tradingBot.getRecentLogs(limit));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
