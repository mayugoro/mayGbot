// Production webhook server
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN tidak ditemukan');
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bot instance untuk production (tanpa polling)
const bot = new TelegramBot(BOT_TOKEN);

// Import bot handlers
try {
  // Import main bot logic (pastikan main.js tidak start polling)
  const mainBot = require('./main');
  console.log('✅ Bot handlers loaded successfully');
} catch (error) {
  console.error('❌ Error loading bot handlers:', error.message);
}

// Webhook endpoint untuk menerima updates dari Telegram
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  try {
    console.log('📨 Received webhook update:', JSON.stringify(req.body, null, 2));
    
    // Process update from Telegram
    bot.processUpdate(req.body);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing webhook update:', error);
    res.status(500).send('Error processing update');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    bot_token: BOT_TOKEN ? 'configured' : 'missing',
    webhook_url: WEBHOOK_URL || 'not configured'
  });
});

// Webhook info endpoint
app.get('/webhook-info', async (req, res) => {
  try {
    const webhookInfo = await bot.getWebHookInfo();
    res.json({
      webhook_info: webhookInfo,
      server_time: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      server_time: new Date().toISOString()
    });
  }
});

// Test webhook endpoint
app.post('/webhook/test', (req, res) => {
  res.json({
    message: 'Webhook endpoint is working!',
    received_data: req.body,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Telegram Bot Webhook Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    endpoints: {
      webhook: `/webhook/${BOT_TOKEN}`,
      health: '/health',
      'webhook-info': '/webhook-info',
      test: '/webhook/test'
    }
  });
});

// Set webhook saat server start
const setupWebhook = async () => {
  try {
    if (!WEBHOOK_URL) {
      console.log('❌ WEBHOOK_URL tidak di-set, webhook tidak akan dipasang');
      return;
    }

    const webhookUrl = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
    
    console.log('🔧 Setting up webhook...');
    console.log(`🔗 Webhook URL: ${webhookUrl}`);
    
    // Hapus webhook lama
    await bot.deleteWebHook();
    console.log('🗑️  Old webhook deleted');
    
    // Set webhook baru
    const result = await bot.setWebHook(webhookUrl, {
      max_connections: 40,
      allowed_updates: ['message', 'callback_query', 'inline_query']
    });
    
    if (result) {
      console.log('✅ Webhook berhasil dipasang!');
      
      // Verify webhook
      setTimeout(async () => {
        try {
          const info = await bot.getWebHookInfo();
          console.log('\n📋 Webhook Info:');
          console.log(`   URL: ${info.url}`);
          console.log(`   Has Custom Certificate: ${info.has_custom_certificate}`);
          console.log(`   Pending Updates: ${info.pending_update_count}`);
          console.log(`   Max Connections: ${info.max_connections}`);
          if (info.last_error_date) {
            console.log(`   ❌ Last Error: ${new Date(info.last_error_date * 1000)}`);
            console.log(`   Error Message: ${info.last_error_message}`);
          } else {
            console.log('   ✅ No errors');
          }
        } catch (error) {
          console.error('❌ Error getting webhook info:', error.message);
        }
      }, 2000);
      
    } else {
      console.log('❌ Failed to set webhook');
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Remove webhook on shutdown
    await bot.deleteWebHook();
    console.log('🗑️  Webhook removed');
  } catch (error) {
    console.error('❌ Error removing webhook:', error.message);
  }
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Webhook server started on port ${PORT}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🌐 Server URL: ${WEBHOOK_URL || 'http://localhost:' + PORT}`);
  
  // Setup webhook after server is ready
  await setupWebhook();
  
  console.log('\n🟢 Server is ready to receive webhooks!');
});

module.exports = app;
