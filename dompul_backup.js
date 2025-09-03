const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Storage untuk dompul states
const dompulStates = new Map(); // key: chatId, value: { step, inputMessageId }

// Database setup
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Initialize settings table if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  
  // Set default dompul enabled jika belum ada
  db.get("SELECT value FROM settings WHERE key = 'dompul_enabled'", (err, row) => {
    if (!row) {
      db.run("INSERT INTO settings (key, value) VALUES ('dompul_enabled', 'true')");
    }
  });
});

// Function untuk get setting dari database
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT value FROM settings WHERE key = ?", [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
};

// Function untuk set setting ke database
const setSetting = (key, value) => {
  return new Promise((resolve, reject) => {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Function untuk cek apakah dompul enabled
const isDompulEnabled = async () => {
  try {
    const value = await getSetting('dompul_enabled');
    return value === 'true';
  } catch (error) {
    console.error('Error checking dompul status:', error);
    return true; // Default true jika error
  }
};

function isAuthorized(id) {
  return id.toString() === process.env.ADMIN_ID;
}

// Mapping seri nomor XL dan Axis
const xlAxisSeries = [
  '0817', '0818', '0819', // XL
  '0859', '0877', '0878', // XL
  '0831', '0832', '0833', '0838' // Axis
];

// Function untuk cek apakah nomor adalah XL/Axis
const isXLAxisNumber = (nomor) => {
  // Pastikan nomor dalam format 08xxx
  let checkNumber = nomor;
  if (checkNumber.startsWith('62')) {
    checkNumber = '0' + checkNumber.substring(2);
  } else if (checkNumber.length === 10 && !checkNumber.startsWith('0')) {
    checkNumber = '0' + checkNumber;
  }
  
  // Cek 4 digit pertama
  const prefix = checkNumber.substring(0, 4);
  return xlAxisSeries.includes(prefix);
};

// Function untuk cek dompul single nomor menggunakan KMSP Store API
const checkDompul = async (nomor_hp) => {
  try {
    // Format nomor HP
    let formattedMsisdn = nomor_hp.replace(/\D/g, '');
    if (formattedMsisdn.startsWith('62')) {
      formattedMsisdn = '0' + formattedMsisdn.substring(2);
    }
    if (!formattedMsisdn.startsWith('0') && formattedMsisdn.length >= 10 && formattedMsisdn.length <= 11) {
      formattedMsisdn = '0' + formattedMsisdn;
    }

    const params = {
      msisdn: formattedMsisdn,
      isJSON: 'true',
      _: Date.now().toString()
    };

    const response = await axios.get("https://apigw.kmsp-store.com/sidompul/v4/cek_kuota", {
      params,
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "Authorization": "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://sidompul.kmsp-store.com",
        "Priority": "u=1, i",
        "Referer": "https://sidompul.kmsp-store.com/",
        "Sec-CH-UA": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
        "X-App-Version": "4.0.0"
      },
      timeout: 30000
    });

    return {
      status: 'success',
      data: response.data
    };
  } catch (error) {
    console.error(`❌ Error checking dompul untuk ${nomor_hp}:`, error.message);
    
    return {
      status: 'error',
      message: error.response?.data?.message || error.message
    };
  }
};

module.exports = (bot) => {
  // Handle /dompulon command (Admin only)
  bot.onText(/\/dompulon$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek authorization
    if (!isAuthorized(userId)) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk menggunakan command ini.");
    }

    try {
      await setSetting('dompul_enabled', 'true');
      await bot.sendMessage(chatId, "✅ <b>Fitur Dompul telah diaktifkan!</b>", { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error enabling dompul:', error);
      await bot.sendMessage(chatId, "❌ <b>Gagal mengaktifkan fitur dompul!</b>", { parse_mode: 'HTML' });
    }
  });

  // Handle /dompuloff command (Admin only)
  bot.onText(/\/dompuloff$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek authorization
    if (!isAuthorized(userId)) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk menggunakan command ini.");
    }

    try {
      await setSetting('dompul_enabled', 'false');
      await bot.sendMessage(chatId, "🔒 <b>Fitur Dompul telah dinonaktifkan!</b>", { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error disabling dompul:', error);
      await bot.sendMessage(chatId, "❌ <b>Gagal menonaktifkan fitur dompul!</b>", { parse_mode: 'HTML' });
    }
  });

  // Handle /dompul command dengan direct execution
  bot.onText(/\/dompul(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek apakah fitur dompul aktif (admin bypass)
    const enabled = await isDompulEnabled();
    const isAdmin = isAuthorized(userId);
    
    if (!enabled && !isAdmin) {
      return bot.sendMessage(chatId, "<b><i>Fitur ditutup!</i></b>", { parse_mode: 'HTML' });
    }

    const input = match[1] ? match[1].trim() : '';
    
    // Jika tidak ada input nomor, berikan contoh
    if (!input) {
      return bot.sendMessage(chatId,
        '📱 <b>Cara Penggunaan:</b>\n\n' +
        '<code>/dompul 087835360454</code> - Single\n' +
        '<code>/dompul 087835360454 087764659975</code> - Multiple\n\n' +
        '<i>Atau pisahkan nomor dengan spasi/enter</i>',
        { parse_mode: 'HTML' }
      );
    }

    // Parse nomor HP dari input (support spasi dan line break)
    const lines = input.split(/[\s\n\r]+/).map(line => line.trim()).filter(line => line);
    const validNumbers = [];
    
    for (const line of lines) {
      const cleanNumber = line.replace(/\D/g, '');
      if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
        validNumbers.push(cleanNumber);
      }
    }
    
    // Hilangkan duplikasi nomor
    const uniqueNumbers = [...new Set(validNumbers)];
    
    if (uniqueNumbers.length === 0) {
      return bot.sendMessage(chatId, 
        '❌ <b>Tidak ada nomor yang valid!</b>\n\n' +
        'Format: 10-15 digit angka.\n' +
        'Contoh: <code>/dompul 087835360454</code>',
        { parse_mode: 'HTML' }
      );
    }

    // Langsung eksekusi cek dompul
    await processDompulRequest(chatId, uniqueNumbers, bot);
  });
  
  // Tidak ada message handler lagi - semua direct via /dompul command
};
    
    if (text.startsWith("/")) return;
    
    try {
      // === CEK CANCEL/EXIT ===
      if (['exit', 'EXIT', 'Exit'].includes(text)) {
        // Hapus input form
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {
            // Ignore delete error
          }
        }
        
        dompulStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Parse nomor HP (multiple lines)
      const lines = text.split(/\n|\r/).map(line => line.trim()).filter(line => line);
      const validNumbers = [];
      
      for (const line of lines) {
        const cleanNumber = line.replace(/\D/g, '');
        if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
          validNumbers.push(cleanNumber);
        }
      }
      
      // Hilangkan duplikasi nomor
      const uniqueNumbers = [...new Set(validNumbers)];
      
      if (uniqueNumbers.length === 0) {
        await bot.sendMessage(chatId, 
          '❌ <b>Tidak ada nomor yang valid!</b>\n\n' +
          'Format: 10-15 digit angka per baris.\n' +
          'Coba lagi atau ketik "exit" untuk batal.',
          { parse_mode: 'HTML' }
        );
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Hapus pesan input user dan form input
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}

      // Mulai proses cek dompul massal secara concurrent
      let totalSuccess = 0;
      let totalFailed = 0;
      let completedCount = 0;

      // Function untuk process single nomor
      const processSingleNomor = async (nomor_hp, index) => {
        try {
          // Cek apakah nomor adalah XL/Axis
          if (!isXLAxisNumber(nomor_hp)) {
            // Format nomor ke 08xxxxx untuk display
            let displayNumber = nomor_hp;
            if (displayNumber.startsWith('62')) {
              displayNumber = '0' + displayNumber.substring(2);
            } else if (displayNumber.length === 10 && !displayNumber.startsWith('0')) {
              displayNumber = '0' + displayNumber;
            }
            
            return {
              success: false,
              nomor: displayNumber,
              index: index,
              error: 'Bukan nomor XL & Axis 🗿',
              isValidProvider: false
            };
          }

          // Hit API cek dompul
          const result = await checkDompul(nomor_hp);
          
          // Format nomor ke 08xxxxx untuk display
          let displayNumber = nomor_hp;
          if (displayNumber.startsWith('62')) {
            displayNumber = '0' + displayNumber.substring(2);
          } else if (displayNumber.length === 10 && !displayNumber.startsWith('0')) {
            displayNumber = '0' + displayNumber;
          }

          return {
            success: result.status === 'success',
            nomor: displayNumber,
            index: index,
            data: result.data,
            error: result.message,
            isValidProvider: true
          };

        } catch (error) {
          // Format nomor untuk display
          let displayNumber = nomor_hp;
          if (displayNumber.startsWith('62')) {
            displayNumber = '0' + displayNumber.substring(2);
          } else if (displayNumber.length === 10 && !displayNumber.startsWith('0')) {
            displayNumber = '0' + displayNumber;
          }

          return {
            success: false,
            nomor: displayNumber,
            index: index,
            error: error.message,
            isValidProvider: true
          };
        }
      };

      // Function untuk send hasil segera setelah API call selesai
      const processAndSendResult = async (result) => {
        completedCount++;
        
        try {
          if (result.success && result.data && result.data.data && result.data.data.hasil) {
            // Clean up HTML tags dan format hasil
            let resultText = result.data.data.hasil
              .replace(/<br>/g, '\n')
              .replace(/<[^>]*>/g, '') // Remove HTML tags
              .replace(/&nbsp;/g, ' ') // Replace HTML space
              .trim();
            
            // Handle duplicate "24jam di semua jaringan" - keep the smaller value
            const lines = resultText.split('\n');
            const processedLines = [];
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              
              // Check for duplicate "24jam di semua jaringan" benefit
              if (line.includes('🎁 Benefit: 24jam di semua jaringan')) {
                // Look for the next occurrence of the same benefit
                let foundDuplicate = false;
                let duplicateIndex = -1;
                
                for (let j = i + 1; j < lines.length; j++) {
                  if (lines[j].includes('🎁 Benefit: 24jam di semua jaringan')) {
                    foundDuplicate = true;
                    duplicateIndex = j;
                    break;
                  }
                  if (lines[j].includes('🎁 Quota:') || lines[j].includes('=====')) {
                    break;
                  }
                }
                
                if (foundDuplicate) {
                  // Get quota values from both benefits
                  const firstQuotaLine = lines[i + 2] || '';
                  const secondQuotaLine = lines[duplicateIndex + 2] || '';
                  
                  // Extract quota values
                  const firstQuota = parseFloat(firstQuotaLine.replace(/[^\d.]/g, '')) || 0;
                  const secondQuota = parseFloat(secondQuotaLine.replace(/[^\d.]/g, '')) || 0;
                  
                  // Keep the one with smaller quota value (more realistic)
                  if (firstQuota > secondQuota) {
                    // Skip the first one, keep the second
                    i += 3; // Skip current benefit (4 lines)
                    continue;
                  } else {
                    // Keep the first one, mark duplicate for skipping
                    processedLines.push(line);
                    processedLines.push(lines[i + 1] || ''); // Tipe Kuota
                    processedLines.push(lines[i + 2] || ''); // Kuota
                    processedLines.push(lines[i + 3] || ''); // Sisa Kuota
                    i += 3;
                    
                    // Mark duplicate lines to be skipped
                    for (let k = duplicateIndex; k < duplicateIndex + 4 && k < lines.length; k++) {
                      lines[k] = '__SKIP__';
                    }
                    continue;
                  }
                }
              }
              
              // Skip lines marked for removal
              if (line === '__SKIP__') {
                continue;
              }
              
              processedLines.push(line);
            }
            
            const cleanResultText = processedLines.join('\n');
            
            // Tambahkan header dengan nomor dan progress
            const headerText = `✅ <b>NOMOR ${result.index + 1}/${uniqueNumbers.length}</b> <code>[${completedCount}/${uniqueNumbers.length}]</code>\n\n${cleanResultText}`;
            
            await bot.sendMessage(chatId, headerText, { parse_mode: 'HTML' });
            totalSuccess++;
            
          } else {
            // Handle error hasil
            let errorText = '';
            
            if (!result.isValidProvider) {
              errorText = `❌ <b>NOMOR ${result.index + 1}/${uniqueNumbers.length}</b> <code>[${completedCount}/${uniqueNumbers.length}]</code>\n\n<i>Nomer ${result.nomor} ${result.error}</i>`;
            } else {
              errorText = `❌ <b>NOMOR ${result.index + 1}/${uniqueNumbers.length}</b> <code>[${completedCount}/${uniqueNumbers.length}]</code>\n\n<i>Nomor ${result.nomor} - ${result.error || 'Error tidak diketahui'}</i>`;
            }
            
            await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });
            totalFailed++;
          }

        } catch (sendError) {
          console.error('Error sending result:', sendError.message);
          totalFailed++;
        }
      };

      // Jalankan semua API call secara concurrent
      const allPromises = uniqueNumbers.map((nomor_hp, index) => 
        processSingleNomor(nomor_hp, index).then(result => {
          // Process dan kirim hasil segera setelah API call selesai
          return processAndSendResult(result);
        }).catch(error => {
          // Handle error dan kirim juga
          const errorResult = {
            success: false,
            error: error.message,
            nomor: nomor_hp,
            index: index,
            isValidProvider: true
          };
          return processAndSendResult(errorResult);
        })
      );

      // Tunggu SEMUA hasil dikirim (tapi pengiriman sudah real-time)
      await Promise.allSettled(allPromises);

      // Clean up state
      dompulStates.delete(chatId);

    } catch (error) {
      console.error('Error handling dompul input:', error.message);
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      dompulStates.delete(chatId);
    }
  });
};

// Export fungsi-fungsi yang dibutuhkan untuk callback handler
module.exports.isDompulEnabled = isDompulEnabled;
module.exports.isAuthorized = isAuthorized;
module.exports.dompulStates = dompulStates;