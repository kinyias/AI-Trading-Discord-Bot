const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });
    this.channelId = process.env.DISCORD_CHANNEL_ID;
  }

  async initialize() {
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.warn(
        'Discord bot token not provided, Discord integration disabled'
      );
      return;
    }

    this.client.on('ready', () => {
      console.log(`Discord bot logged in as ${this.client.user.tag}`);
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    await this.client.login(process.env.DISCORD_BOT_TOKEN);
  }

  async sendSignal(signal) {
    if (!this.client.isReady() || !this.channelId) {
      console.warn('Discord bot not ready or channel ID not set');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);

      const embed = new EmbedBuilder()
        .setTitle(`🤖 AI Trading Signal: ${signal.pair}`)
        .setColor(this.getSignalColor(signal.signal))
        .addFields(
          { name: '📊 Signal', value: signal.signal, inline: true },
          { name: '⏰ Timeframe', value: signal.timeframe, inline: true },
          {
            name: '🎯 Confidence',
            value: `${signal.confidence}%`,
            inline: true,
          },
          {
            name: '💰 Current Price',
            value: `$${signal.current_price}`,
            inline: true,
          },
          {
            name: '🎯 Entry Price',
            value: `$${signal.entry_price || 'N/A'}`,
            inline: true,
          },
          {
            name: '🛑 Stop Loss',
            value: `$${signal.stop_loss || 'N/A'}`,
            inline: true,
          },
          {
            name: '💎 Take Profit',
            value: `$${signal.take_profit || 'N/A'}`,
            inline: true,
          },
          {
            name: '🧠 AI Reasoning',
            value: signal.reasoning || 'No reasoning provided',
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: 'AI Crypto Trading Bot' });

      await channel.send({ embeds: [embed] });
      console.log(`Signal sent to Discord for ${signal.pair}`);
    } catch (error) {
      console.error('Failed to send Discord message:', error);
    }
  }

  getSignalColor(signal) {
    switch (signal.toUpperCase()) {
      case 'BUY':
        return 0x00ff00; // Green
      case 'SELL':
        return 0xff0000; // Red
      case 'HOLD':
        return 0xffff00; // Yellow
      default:
        return 0x808080; // Gray
    }
  }
}

module.exports = DiscordBot;
