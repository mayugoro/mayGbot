// Script untuk mengelola webhook Telegram Bot
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN tidak ditemukan di .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN);

async function setWebhook() {
  try {
    if (!WEBHOOK_URL) {
      console.error('❌ WEBHOOK_URL tidak ditemukan di .env');
      console.log('💡 Tambahkan WEBHOOK_URL=https://domain-anda.com ke file .env');
      return;
    }

    const webhookUrl = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
    
    console.log('🔧 Memasang webhook...');
    console.log(`🔗 URL: ${webhookUrl}`);
    
    // Hapus webhook lama
    await bot.deleteWebHook();
    console.log('🗑️  Webhook lama dihapus');

    // Set webhook baru
    const result = await bot.setWebHook(webhookUrl);
    
    if (result) {
      console.log('✅ Webhook berhasil dipasang!');
      
      // Verifikasi webhook
      const info = await bot.getWebHookInfo();
      console.log('\n📋 Info Webhook:');
      console.log(`   URL: ${info.url}`);
      console.log(`   Has Custom Certificate: ${info.has_custom_certificate}`);
      console.log(`   Pending Updates: ${info.pending_update_count}`);
      if (info.last_error_date) {
        console.log(`   Last Error: ${new Date(info.last_error_date * 1000)}`);
        console.log(`   Error Message: ${info.last_error_message}`);
      }
    } else {
      console.log('❌ Gagal memasang webhook');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function removeWebhook() {
  try {
    console.log('🗑️  Menghapus webhook...');
    const result = await bot.deleteWebHook();
    
    if (result) {
      console.log('✅ Webhook berhasil dihapus!');
      console.log('💡 Bot sekarang bisa menggunakan polling mode');
    } else {
      console.log('❌ Gagal menghapus webhook');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function getWebhookInfo() {
  try {
    console.log('📋 Mengambil info webhook...');
    const info = await bot.getWebHookInfo();
    
    console.log('\n📊 Webhook Info:');
    console.log(`   URL: ${info.url || 'Tidak ada'}`);
    console.log(`   Has Custom Certificate: ${info.has_custom_certificate}`);
    console.log(`   Pending Updates: ${info.pending_update_count}`);
    console.log(`   Max Connections: ${info.max_connections || 40}`);
    console.log(`   Allowed Updates: ${info.allowed_updates?.join(', ') || 'Semua'}`);
    
    if (info.last_error_date) {
      console.log(`\n❌ Last Error: ${new Date(info.last_error_date * 1000)}`);
      console.log(`   Error Message: ${info.last_error_message}`);
    } else {
      console.log('\n✅ Tidak ada error');
    }
    
    if (info.url) {
      console.log('\n🟢 Status: Webhook aktif');
    } else {
      console.log('\n🔴 Status: Webhook tidak aktif (polling mode)');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'set':
    setWebhook();
    break;
  case 'remove':
    removeWebhook();
    break;
  case 'info':
    getWebhookInfo();
    break;
  default:
    console.log('🤖 Telegram Bot Webhook Manager\n');
    console.log('Perintah yang tersedia:');
    console.log('  node webhook-manager.js set     - Pasang webhook');
    console.log('  node webhook-manager.js remove  - Hapus webhook');
    console.log('  node webhook-manager.js info    - Lihat info webhook');
    console.log('\n💡 Pastikan WEBHOOK_URL sudah diset di file .env');
    break;
}
