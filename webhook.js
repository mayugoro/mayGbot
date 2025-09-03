// Webhook server untuk Telegram Bot
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Middleware untuk parsing JSON
app.use(express.json());

// Set environment untuk webhook mode
process.env.NODE_ENV = 'production';

// Import main.js yang akan otomatis detect webhook mode
const main = require('./main');
const bot = main; // main.js export bot instance

// Set webhook URL
const setWebhook = async () => {
  try {
    if (!WEBHOOK_URL) {
      console.log('❌ WEBHOOK_URL tidak ditemukan di .env');
      console.log('💡 Tambahkan WEBHOOK_URL=https://domain-anda.com ke file .env');
      return;
    }

    const webhookUrl = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
    
    // Hapus webhook lama terlebih dahulu
    await bot.deleteWebHook();
    console.log('🗑️  Webhook lama dihapus');

    // Set webhook baru
    const result = await bot.setWebHook(webhookUrl);
    
    if (result) {
      console.log('✅ Webhook berhasil dipasang!');
      console.log(`🔗 Webhook URL: ${webhookUrl}`);
      
      // Verifikasi webhook info
      const webhookInfo = await bot.getWebHookInfo();
      console.log('📋 Info Webhook:');
      console.log(`   URL: ${webhookInfo.url}`);
      console.log(`   Has Custom Certificate: ${webhookInfo.has_custom_certificate}`);
      console.log(`   Pending Update Count: ${webhookInfo.pending_update_count}`);
      if (webhookInfo.last_error_date) {
        console.log(`   Last Error: ${new Date(webhookInfo.last_error_date * 1000)}`);
        console.log(`   Last Error Message: ${webhookInfo.last_error_message}`);
      }
    } else {
      console.log('❌ Gagal memasang webhook');
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
  }
};

// Endpoint untuk menerima update dari Telegram
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  try {
    // Proses update dari Telegram
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error processing update:', error);
    res.sendStatus(500);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Info webhook endpoint
app.get('/webhook-info', async (req, res) => {
  try {
    const webhookInfo = await bot.getWebHookInfo();
    res.json(webhookInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Telegram Bot Webhook Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Menerima signal SIGINT, shutting down...');
  
  try {
    // Hapus webhook saat shutdown
    await bot.deleteWebHook();
    console.log('🗑️  Webhook dihapus');
  } catch (error) {
    console.error('❌ Error menghapus webhook:', error.message);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Menerima signal SIGTERM, shutting down...');
  
  try {
    await bot.deleteWebHook();
    console.log('🗑️  Webhook dihapus');
  } catch (error) {
    console.error('❌ Error menghapus webhook:', error.message);
  }
  
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Webhook server berjalan di port ${PORT}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  // Set webhook setelah server start
  await setWebhook();
});

module.exports = app;
