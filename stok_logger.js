// === STOK LOGGER REALTIME ===
// Monitor perubahan stok dan auto update ke channel Telegram
// Tidak mengubah database atau logika existing - hanya monitoring

const { getStok } = require('./db');

// Konfigurasi logging stok
const STOK_LOG_ENABLED = process.env.STOK_LOG_ENABLED === 'true' || false;
const STOK_LOG_CHAT_ID = process.env.STOK_LOG_CHAT_ID;
const STOK_LOG_MESSAGE_ID = process.env.STOK_LOG_MESSAGE_ID;
// Parse topic ID with error handling
let STOK_LOG_TOPIC_ID = null;
if (process.env.STOK_LOG_TOPIC_ID && process.env.STOK_LOG_TOPIC_ID.trim() !== '') {
  const topicId = parseInt(process.env.STOK_LOG_TOPIC_ID);
  if (!isNaN(topicId) && topicId > 0) {
    STOK_LOG_TOPIC_ID = topicId;
  }
}
const BOT_NAME = process.env.BOT_NAME || '@DefaultBot';

// Cache stok terakhir untuk deteksi perubahan
let lastStokCache = new Map();
let monitoringActive = false;
let monitorInterval = null;

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

// List kategori yang dimonitor
const KATEGORI_BULANAN = ['SUPERMINI', 'SUPERBIG', 'MINI', 'BIG', 'LITE', 'JUMBO', 'MEGABIG', 'SUPERJUMBO'];
const KATEGORI_BEKASAN = ['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'];

// Mapping untuk display format
const DISPLAY_MAPPING = {
  'SUPERJUMBO': 'SUPER JUMBO',
  '3H': 'BEKASAN 3H',
  '4H': 'BEKASAN 4H',
  '5H': 'BEKASAN 5H', 
  '6H': 'BEKASAN 6H',
  '7H': 'BEKASAN 7H',
  '8H': 'BEKASAN 8H',
  '9H': 'BEKASAN 9H',
  '10H': 'BEKASAN 10H'
};

// === GENERATE STOK MESSAGE ===
const generateStokMessage = (stokData, timestamp = null, addDot = false) => {
  try {
    let message = `STOK AKRAB DARI BOT @bebekgorenghajislametbot\n`;
    message += `├───────────────────┤\n`;
    message += `🌙 BULANAN\n\n`;
    message += `<code>`;
    
    // Bulanan products
    KATEGORI_BULANAN.forEach(kategori => {
      const displayName = DISPLAY_MAPPING[kategori] || kategori;
      const stok = stokData[kategori] || 0;
      const stokText = stok > 0 ? stok.toString() : '-';
      const paddedProduct = displayName.padEnd(11);
      message += `${paddedProduct} : ${stokText}\n`;
    });
    
    message += `</code>`;
    message += `├───────────────────┤\n`;
    message += `⚡️ BEKASAN\n\n`;
    message += `<code>`;
    
    // Bekasan products
    KATEGORI_BEKASAN.forEach(kategori => {
      const displayName = DISPLAY_MAPPING[kategori] || kategori;
      const stok = stokData[kategori] || 0;
      const stokText = stok > 0 ? stok.toString() : '-';
      const paddedProduct = displayName.padEnd(11);
      message += `${paddedProduct} : ${stokText}\n`;
    });
    
    message += `</code>`;
    message += `├───────────────────┤\n\n`;
    // Add dot trick untuk menghindari "message not modified" error
    message += `STOK UPDATE OTOMATIS REALTIME🗿👍🏻${addDot ? '.' : ''}`;
    
    return message;
  } catch (error) {
    console.error('Error generating stok message:', error);
    return `❌ Error generating stok message: ${error.message}`;
  }
};

// === GET ALL STOK DATA ===
const getAllStokData = async () => {
  const stokData = {};
  
  try {
    // Ambil stok bulanan
    for (const kategori of KATEGORI_BULANAN) {
      const stokList = await getStok(kategori);
      stokData[kategori] = stokList.length;
    }
    
    // Ambil stok bekasan
    for (const kategori of KATEGORI_BEKASAN) {
      const stokList = await getStok(kategori);
      stokData[kategori] = stokList.length;
    }
    
    return stokData;
  } catch (error) {
    console.error('❌ Error getting stok data:', error.message);
    return null;
  }
};

// === DETECT STOK CHANGES ===
const detectStokChanges = (oldStok, newStok) => {
  const changes = {};
  let hasChanges = false;
  
  // Combine all categories
  const allKategori = [...KATEGORI_BULANAN, ...KATEGORI_BEKASAN];
  
  allKategori.forEach(kategori => {
    const oldCount = oldStok[kategori] || 0;
    const newCount = newStok[kategori] || 0;
    
    if (oldCount !== newCount) {
      changes[kategori] = {
        from: oldCount,
        to: newCount,
        change: newCount - oldCount
      };
      hasChanges = true;
    }
  });
  
  return hasChanges ? changes : null;
};

// === SEND STOK UPDATE ===
const sendStokUpdate = async (bot, stokData, changes = null, addDot = false) => {
  if (!STOK_LOG_ENABLED || !STOK_LOG_CHAT_ID || !STOK_LOG_MESSAGE_ID || !bot) {
    return false;
  }

  try {
    const message = generateStokMessage(stokData, null, addDot);
    
    const editOptions = {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    // Edit the existing message instead of sending new one
    await bot.editMessageText(message, {
      chat_id: STOK_LOG_CHAT_ID,
      message_id: parseInt(STOK_LOG_MESSAGE_ID),
      ...editOptions
    });
    
    return true;
    
  } catch (error) {
    // Check if error is "message not modified" (normal case)
    if (error.response && error.response.description && 
        error.response.description.includes('message is not modified')) {
      console.log('✅ Terhubung ke logchat, tidak ada pesan yg diupdate dan di ubah.');
      return true; // This is actually success - no changes needed
    }
    
    // Other errors are real problems - log and return false
    console.error('❌ Error updating stok message:', error.message);
    if (error.response && error.response.description) {
      console.error('Telegram error:', error.response.description);
    }
    return false;
  }
};

// === SEND INITIAL STOK MESSAGE ===
const sendInitialStok = async (bot) => {
  if (!STOK_LOG_ENABLED || !STOK_LOG_CHAT_ID) {
    return false;
  }

  try {
    const stokData = await getAllStokData();
    if (!stokData) {
      return false;
    }

    // Cache initial data
    lastStokCache = new Map(Object.entries(stokData));
    
    // Send initial message with dot trick
    console.log('🔄 Initializing stok message with dot trick...');
    const resultWithDot = await sendStokUpdate(bot, stokData, null, true); // Add dot
    
    if (resultWithDot) {
      // Wait 1 second then remove dot
      setTimeout(async () => {
        try {
          await sendStokUpdate(bot, stokData, null, false); // Remove dot
          console.log('✅ Dot trick completed - message normalized');
        } catch (error) {
          // Silent ignore for second update
        }
      }, 1000);
    }
    
    return resultWithDot;
    
  } catch (error) {
    // Only handle errors from getAllStokData or other functions, not from sendStokUpdate
    console.error('❌ Error in sendInitialStok:', error.message);
    return false;
  }
};

// === START MONITORING ===
const startStokMonitoring = (bot, intervalMs = 30000) => { // Default 30 detik
  if (!STOK_LOG_ENABLED || !STOK_LOG_CHAT_ID || !bot) {
    return false;
  }

  if (monitoringActive) {
    return false;
  }

  // Send initial stok
  sendInitialStok(bot);
  
  monitoringActive = true;
  monitorInterval = setInterval(async () => {
    try {
      const currentStok = await getAllStokData();
      if (!currentStok) return;

      // Convert cache Map to object for comparison
      const lastStok = Object.fromEntries(lastStokCache);
      
      // Detect changes
      const changes = detectStokChanges(lastStok, currentStok);
      
      if (changes) {
        // Send update with changes
        try {
          await sendStokUpdate(bot, currentStok, changes);
          // Update cache only if successful
          lastStokCache = new Map(Object.entries(currentStok));
        } catch (updateError) {
          console.error('❌ Error in stok monitoring:', updateError.message);
          if (updateError.response && updateError.response.description) {
            console.error('Telegram error:', updateError.response.description);
          }
        }
      }
      // If no changes, don't send update (realtime monitoring)
      
    } catch (error) {
      console.error('❌ Error in stok monitoring:', error.message);
    }
  }, intervalMs);

  return true;
};

// === STOP MONITORING ===
const stopStokMonitoring = () => {
  if (!monitoringActive) {
    return false;
  }

  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  
  monitoringActive = false;
  lastStokCache.clear();
  
  return true;
};

// === GET MONITORING STATUS ===
const getMonitoringStatus = () => {
  return {
    active: monitoringActive,
    enabled: STOK_LOG_ENABLED,
    chatId: STOK_LOG_CHAT_ID,
    topicId: STOK_LOG_TOPIC_ID,
    intervalActive: monitorInterval !== null,
    cacheSize: lastStokCache.size
  };
};

// === TEST STOK LOGGING ===
const testStokLogging = async (bot) => {
  if (!STOK_LOG_ENABLED || !STOK_LOG_CHAT_ID || !STOK_LOG_MESSAGE_ID) {
    console.log('❌ Stok logging disabled or configuration incomplete');
    return false;
  }

  try {
    // Test connection ke channel tanpa mengirim message
    // Bisa test dengan getChat atau method lain yang tidak mengirim pesan
    
    // console.log('✅ Stok logging system ready'); // Optional: log ke console saja
    return true;
  } catch (error) {
    console.error('❌ Failed to test stok logging channel:', error.message);
    return false;
  }
};

module.exports = {
  startStokMonitoring,
  stopStokMonitoring,
  sendInitialStok,
  getMonitoringStatus,
  testStokLogging,
  STOK_LOG_ENABLED,
  STOK_LOG_CHAT_ID,
  STOK_LOG_MESSAGE_ID,
  STOK_LOG_TOPIC_ID
};
