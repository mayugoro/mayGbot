// Transaction Logger untuk monitoring semua transaksi
const { formatForLogger } = require('./utils/normalize');

// Konfigurasi logging
const LOG_CHAT_ID = process.env.LOG_CHAT_ID; // Chat ID grup/channel untuk log transaksi
const LOG_TOPIC_SUCCESS = process.env.LOG_TOPIC_SUCCESS || 2; // Topic untuk transaksi berhasil
const LOG_TOPIC_FAILED = process.env.LOG_TOPIC_FAILED || 3;   // Topic untuk transaksi gagal (valid tapi gagal <15 detik/timeout)
const LOG_TOPIC_STUCK = process.env.LOG_TOPIC_STUCK || 6;     // Topic untuk transaksi nyangkut (tertolak validasi API dompul)
const LOG_ENABLED = process.env.LOG_ENABLED === 'true' || false;
const BOT_NAME = process.env.BOT_NAME || '@DefaultBot'; // Identifier untuk multi-bot support

// Format waktu Indonesia
const formatTime = (date = new Date()) => {
  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Function untuk log transaksi ke grup/channel
// Topic routing:
// - SUCCESS (topic 2): Transaksi berhasil
// - GAGAL (topic 3): Transaksi valid tapi gagal dalam <15 detik atau timeout
// - NYANGKUT (topic 6): Transaksi tertolak saat validasi API dompul
const logTransaction = async (bot, transactionData) => {
  if (!LOG_ENABLED || !LOG_CHAT_ID || !bot) {
    return;
  }

  try {
    const {
      userId,
      username,
      kategori,
      nomor,
      pengelola = null,
      status = 'completed',
      harga = null,
      saldoSebelum = null,
      saldoSesudah = null,
      trxId = null,
      provider = null,
      error = null,
      botName = null  // ← TAMBAHAN untuk identify bot
    } = transactionData;

    // Format pesan untuk berbagai jenis transaksi
    let logMessage = '';
    let emoji = '';
    
    if (status === 'completed') {
      emoji = '✅';
      logMessage = `${emoji} <b>TRANSAKSI BERHASIL</b>\n\n`;
    } else if (status === 'failed') {
      emoji = '❌';
      logMessage = `${emoji} <b>TRANSAKSI GAGAL</b>\n\n`;
    } else if (status === 'pending') {
      emoji = '⏳';
      logMessage = `${emoji} <b>TRANSAKSI PENDING</b>\n\n`;
    } else {
      emoji = '📋';
      logMessage = `${emoji} <b>TRANSAKSI</b>\n\n`;
    }

    // Detail transaksi dengan format yang lebih fokus
    logMessage += `🤖 <b>Bot:</b> ${botName || BOT_NAME}\n`;
    logMessage += `💌 <b>ID:</b> <code>${userId}</code>\n`;
    logMessage += `💌 <b>Username:</b> @${username || 'unknown'}\n`;
    logMessage += `🗒️ <b>Paket:</b> ${kategori.toUpperCase()}\n`;
    logMessage += `⚡️ <b>Pengelola:</b> <code>${formatForLogger(pengelola || nomor)}</code>\n`;
    logMessage += `⚡️ <b>Pembeli:</b> <code>${formatForLogger(nomor)}</code>\n`;
    
    if (harga) {
      logMessage += `💰 <b>Harga:</b> Rp ${harga.toLocaleString('id-ID')}\n`;
    }
    
    // Tampilkan informasi saldo jika tersedia
    if (saldoSebelum !== null && saldoSesudah !== null) {
      logMessage += `💳 <b>Saldo Sebelum:</b> Rp ${saldoSebelum.toLocaleString('id-ID')}\n`;
      logMessage += `💳 <b>Saldo Sesudah:</b> Rp ${saldoSesudah.toLocaleString('id-ID')}\n`;
    }
    
    if (error) {
      logMessage += `❌ <b>Error:</b> ${error}\n`;
    }
    
    if (trxId) {
      logMessage += `🆔 <b>TRX ID:</b> <code>${trxId}</code>\n`;
    }
    
    logMessage += `⌚️ <b>Waktu:</b> ${formatTime()}`;

    // Tentukan topic berdasarkan status transaksi
    let topicId;
    if (status === 'completed') {
      topicId = LOG_TOPIC_SUCCESS; // Topic SUCCESS
    } else if (status === 'validation_failed' || status === 'api_rejected') {
      topicId = LOG_TOPIC_STUCK;   // Topic NYANGKUT (validasi gagal di API dompul)
    } else if (status === 'failed' || status === 'timeout') {
      topicId = LOG_TOPIC_FAILED;  // Topic GAGAL (valid tapi gagal <15 detik atau timeout)
    } else {
      topicId = LOG_TOPIC_FAILED;  // Default ke GAGAL
    }

    // Kirim ke grup/channel log dengan topic yang sesuai
    await bot.sendMessage(LOG_CHAT_ID, logMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      message_thread_id: topicId
    });

  } catch (error) {
    console.error('❌ Error sending transaction log:', error.message);
  }
};

// Function untuk log redeem code
const logRedeemTransaction = async (bot, redeemData) => {
  if (!LOG_ENABLED || !LOG_CHAT_ID || !bot) {
    return;
  }

  try {
    const {
      userId,
      username,
      code,
      amount,
      status = 'completed',
      error = null,
      saldoSebelum = null,
      saldoSesudah = null,
      botName = null  // ← TAMBAHAN untuk identify bot
    } = redeemData;

    let emoji = status === 'completed' ? '🎁' : '❌';
    let statusText = status === 'completed' ? 'BERHASIL' : 'GAGAL';
    
    let logMessage = `${emoji} <b>REDEEM CODE ${statusText}</b>\n\n`;
    logMessage += `🤖 <b>Bot:</b> ${botName || BOT_NAME}\n`;
    logMessage += `💌 <b>ID:</b> <code>${userId}</code>\n`;
    logMessage += `💌 <b>Username:</b> @${username || 'unknown'}\n`;
    logMessage += `🗒️ <b>Paket:</b> REDEEM CODE\n`;
    logMessage += `⚡️ <b>Pengelola:</b> <code>${code}</code>\n`;
    logMessage += `⚡️ <b>Pembeli:</b> <code>@${username || 'unknown'}</code>\n`;
    
    if (amount) {
      logMessage += `💰 <b>Nominal:</b> Rp ${amount.toLocaleString('id-ID')}\n`;
    }
    
    // Tampilkan informasi saldo jika tersedia (untuk redeem code)
    if (saldoSebelum !== null && saldoSesudah !== null) {
      logMessage += `💳 <b>Saldo Sebelum:</b> Rp ${saldoSebelum.toLocaleString('id-ID')}\n`;
      logMessage += `💳 <b>Saldo Sesudah:</b> Rp ${saldoSesudah.toLocaleString('id-ID')}\n`;
    }
    
    if (error) {
      logMessage += `❌ <b>Error:</b> ${error}\n`;
    }
    
    logMessage += `⌚️ <b>Waktu:</b> ${formatTime()}`;

    await bot.sendMessage(LOG_CHAT_ID, logMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      message_thread_id: status === 'completed' ? LOG_TOPIC_SUCCESS : LOG_TOPIC_FAILED
    });

  } catch (error) {
    console.error('❌ Error sending redeem log:', error.message);
  }
};

// Function untuk log error/kendala
const logError = async (bot, errorData) => {
  if (!LOG_ENABLED || !LOG_CHAT_ID || !bot) {
    return;
  }

  try {
    const {
      userId,
      username,
      action,
      error,
      details = null,
      botName = null  // ← TAMBAHAN untuk identify bot
    } = errorData;

    let logMessage = `🚨 <b>ERROR DETECTED</b>\n\n`;
    logMessage += `🤖 <b>Bot:</b> ${botName || BOT_NAME}\n`;
    logMessage += `💌 <b>ID:</b> <code>${userId}</code>\n`;
    logMessage += `💌 <b>Username:</b> @${username || 'unknown'}\n`;
    logMessage += `🗒️ <b>Paket:</b> ${action}\n`;
    logMessage += `⚡️ <b>Pengelola:</b> <code>-</code>\n`;
    logMessage += `⚡️ <b>Pembeli:</b> <code>${userId}</code>\n`;
    logMessage += `❌ <b>Error:</b> ${error}\n`;
    
    if (details) {
      logMessage += `📝 <b>Details:</b> ${details}\n`;
    }
    
    logMessage += `⌚️ <b>Waktu:</b> ${formatTime()}`;

    // Tentukan topic berdasarkan jenis error
    let topicId = LOG_TOPIC_FAILED; // Default untuk GAGAL
    
    // NYANGKUT: Error validasi API dompul
    if (error.toLowerCase().includes('validation') || 
        error.toLowerCase().includes('api rejected') ||
        error.toLowerCase().includes('invalid') ||
        error.toLowerCase().includes('dompul') ||
        action.toLowerCase().includes('validation')) {
      topicId = LOG_TOPIC_STUCK; // Topic NYANGKUT
    }
    // GAGAL: Timeout atau error setelah validasi berhasil
    else if (error.toLowerCase().includes('timeout') || 
             error.toLowerCase().includes('failed after') ||
             action.toLowerCase().includes('timeout')) {
      topicId = LOG_TOPIC_FAILED; // Topic GAGAL
    }

    await bot.sendMessage(LOG_CHAT_ID, logMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      message_thread_id: topicId
    });

  } catch (error) {
    console.error('❌ Error sending error log:', error.message);
  }
};

// Function untuk setup/test logging
const testLogging = async (bot) => {
  if (!LOG_ENABLED || !LOG_CHAT_ID) {
    console.log('❌ Transaction logging disabled or LOG_CHAT_ID not set');
    return false;
  }

  try {
    // Test connection ke channel tanpa mengirim message
    // Bisa test dengan getChat atau method lain yang tidak mengirim pesan
    
    // console.log('✅ Transaction logging system ready'); // Optional: log ke console saja
    return true;
  } catch (error) {
    console.error('❌ Failed to test logging channel:', error.message);
    return false;
  }
};

module.exports = {
  logTransaction,
  logRedeemTransaction,
  logError,
  testLogging,
  LOG_ENABLED,
  LOG_CHAT_ID
};
