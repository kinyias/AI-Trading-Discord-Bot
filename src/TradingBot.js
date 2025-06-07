const ccxt = require('ccxt');
const axios = require('axios');

class TradingBot {
  constructor() {
    this.exchange = null;
    this.config = {
      pairs: ['TON/USDT', 'SOL/USDC'],
      timeframes: ['1h', '1d'],
      analysisInterval: 24 * 60, // 1 day
      enabled: true,
    };
    this.signals = [];
    this.logs = [];
    this.discordBot = null;
  }

  async initialize() {
    // Initialize Binance exchange
    this.exchange = new ccxt.binance();

    console.log('Trading bot initialized');
  }

  setDiscordBot(discordBot) {
    this.discordBot = discordBot;
  }

  getConfig() {
    return this.config;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('Configuration updated:', this.config);
  }

  async fetchMarketData(pair, timeframe, limit = 100) {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(
        pair,
        timeframe,
        undefined,
        limit
      );
      return ohlcv.map((candle) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      console.error(`Failed to fetch data for ${pair} ${timeframe}:`, error);
      throw error;
    }
  }

  async generateAISignal(pair, timeframe, marketData) {
    try {
      const prompt = `
      Here is the market data for ${pair} on ${timeframe}: ${JSON.stringify(
        marketData
      )}

      * Analyze the current market data for Internet Computer (ICP) from Binance (USD pairing) using Smart Money Concept (SMC) to identify the highest-probability buy or sell opportunity that maximizes potential wins. Leverage SMC principles such as liquidity zones, order blocks (prioritized), breaker blocks, and fair value gaps to pinpoint institutional activity. Avoid trading during periods of extreme volatility (e.g., when Bollinger Bands widen beyond 2.5 standard deviations from the 20-period mean on the 15-minute chart).
      
      * Incorporate the following additional rules to increase win probability:
      
      - Confirmation with Volume Analysis: Ensure SMC signals (e.g., liquidity sweep, order block retest, or fair value gap) are confirmed by volume exceeding the 20-period average by at least 50%.
      - Candlestick Patterns: Require confirmation from a bullish/bearish engulfing, pin bar, or inside bar at key SMC levels.
      - Confluence with Key Levels: Ensure the signal aligns with major support/resistance (from the 15-minute or daily chart), Fibonacci 61.8% retracement, or the 50/200 EMA.
      
      * Rules for Signal Generation:
      
      - Prioritize the single most recent, high-confidence opportunity based on SMC principles, confirmed by clear institutional footprints (e.g., liquidity sweep reversing 1% within 3 candles, order block retest with volume and candlestick confirmation).
      - Set Stop-Loss and Take-Profit based on SMC structure: Stop-Loss below/above the nearest SMC level (e.g., order block base, breaker block, or liquidity zone), and Take-Profit at the next logical SMC target (e.g., opposing liquidity zone, fair value gap fill, or breaker block retest), ensuring a risk-reward ratio of at least 1:1.5, adjustable based on market context.
      - Avoid multiple signals—focus on one actionable trade with the strongest setup.
      
      * Important:
      
      - Do not include additional text or explanations outside the structured format.
      - If the signal is 'No Signal,' omit all other fields (e.g., Entry Price, Stop-Loss, Take-Profit, Confidence Level).
      - Ensure the response is concise, data-driven, and adheres strictly to the format.
      - Track the previous signal internally to compare with the current analysis, responding only when a change occurs or it’s the first signal.
      
      Provide a trading signal with entry, stop loss, and take profit levels.
          `;

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'deepseek/deepseek-chat:free',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert crypto trading analyst. Analyze the provided market data and generate trading signals. Respond with a valid JSON object in the following format: {"signal": "BUY/SELL/HOLD", "confidence": number, "reasoning": "string", "entry_price": number, "stop_loss": number, "take_profit": number}',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const aiResponse = response.data.choices[0].message.content;

      // Clean up the response to handle potential markdown formatting
      let cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();

      try {
        return JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response:', cleanResponse);
        // Return a default response if parsing fails
        return {
          signal: 'HOLD',
          confidence: 0,
          reasoning: 'Failed to parse AI response',
          entry_price: 0,
          stop_loss: 0,
          take_profit: 0,
        };
      }
    } catch (error) {
      console.error('AI signal generation failed:', error);
      throw error;
    }
  }

  async analyzePair(pair, timeframe) {
    try {
      console.log(`Analyzing ${pair} on ${timeframe}`);

      const marketData = await this.fetchMarketData(pair, timeframe);
      const aiSignal = await this.generateAISignal(pair, timeframe, marketData);

      const signal = {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        pair,
        timeframe,
        signal: aiSignal.signal,
        confidence: aiSignal.confidence,
        reasoning: aiSignal.reasoning,
        entry_price: aiSignal.entry_price,
        stop_loss: aiSignal.stop_loss,
        take_profit: aiSignal.take_profit,
        current_price: marketData[marketData.length - 1].close,
      };

      this.signals.unshift(signal);
      this.addLog(
        `Signal generated for ${pair} ${timeframe}: ${aiSignal.signal} (${aiSignal.confidence}% confidence)`
      );

      // Send to Discord if bot is available
      if (this.discordBot) {
        await this.discordBot.sendSignal(signal);
      }

      return signal;
    } catch (error) {
      console.error(`Analysis failed for ${pair} ${timeframe}:`, error);
      this.addLog(`Analysis failed for ${pair} ${timeframe}: ${error.message}`);
      throw error;
    }
  }

  async analyzeAllPairs() {
    if (!this.config.enabled) {
      console.log('Analysis disabled in configuration');
      return [];
    }

    const results = [];

    for (const pair of this.config.pairs) {
      for (const timeframe of this.config.timeframes) {
        try {
          const signal = await this.analyzePair(pair, timeframe);
          results.push(signal);

          // Add delay between requests to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to analyze ${pair} ${timeframe}:`, error);
        }
      }
    }

    return results;
  }

  getRecentSignals(limit = 20) {
    return this.signals.slice(0, limit);
  }

  addLog(message) {
    this.logs.unshift({
      timestamp: new Date(),
      message,
    });

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }
  }

  getRecentLogs(limit = 50) {
    return this.logs.slice(0, limit);
  }
}

module.exports = TradingBot;
