const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { normalizePhoneNumber, isValidIndonesianPhone, extractPhonesFromMultilineText } = require('./utils/normalize');
const { getJakartaTime, createJakartaDate, calculateDaysDiff, formatDaysDiff, formatPackageExpiry, parseToJakartaDate, formatToDDMMYYYY, getDompulTimestamp } = require('./utils/date');

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
  // Nomor sudah dalam format 08xxxxxxx, langsung cek prefix
  const prefix = nomor.substring(0, 4);
  return xlAxisSeries.includes(prefix);
};

// Function untuk cek dompul single nomor menggunakan KMSP Store API
const checkDompul = async (nomor_hp) => {
  try {
    // Nomor sudah dinormalisasi ke format 08xxxxxxx, langsung gunakan
    const formattedMsisdn = nomor_hp;

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

  // Handle /dompul command
  bot.onText(/\/dompul$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek apakah fitur dompul aktif (admin bypass)
    const enabled = await isDompulEnabled();
    const isAdmin = isAuthorized(userId);
    
    if (!enabled && !isAdmin) {
      return bot.sendMessage(chatId, "<b><i>Fitur ditutup!</i></b>", { parse_mode: 'HTML' });
    }

    // Set state untuk input nomor
    dompulStates.set(chatId, { step: 'input_nomor' });
    
    const inputMsg = await bot.sendMessage(chatId,
      '<i>Masukan nomor . . .\n' +
      'Bisa massal, pisahkan dengan Enter.\n\n' +
      '💡 Ketik "exit" untuk membatalkan</i>',
      { parse_mode: 'HTML' }
    );
    
    // Simpan message ID input untuk bisa diedit nanti
    const currentState = dompulStates.get(chatId);
    currentState.inputMessageId = inputMsg.message_id;
    dompulStates.set(chatId, currentState);
  });

  // Handle text input untuk dompul
  bot.on('message', async (msg) => {
    if (!msg || !msg.chat || !msg.from || !msg.text) return;
    
    // === PROTEKSI BROADCAST SESI ===
    // Jika admin sedang dalam sesi broadcast, jangan proses trigger menu lain
    if (bot.isAdminInBroadcastSession && bot.isAdminInBroadcastSession(msg)) {
      return; // Skip processing, biarkan broadcast handler yang menangani
    }
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();

    const state = dompulStates.get(chatId);
    if (!state || state.step !== 'input_nomor') return;
    
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

      // Parse nomor HP menggunakan utility - deteksi absolut dengan normalisasi
      const validNumbers = extractPhonesFromMultilineText(text);
      const uniqueNumbers = validNumbers; // Already deduplicated by utility
      
      if (uniqueNumbers.length === 0) {
        await bot.sendMessage(chatId, 
          '❌ <b>Tidak ada nomor Indonesia yang valid!</b>\n\n' +
          'Format: Nomor Indonesia 08xxxxxxxx\n' +
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
          // Nomor sudah dinormalisasi ke format 08xxxxxxx, langsung gunakan untuk display
          const displayNumber = nomor_hp;
          
          // Cek apakah nomor adalah XL/Axis
          if (!isXLAxisNumber(nomor_hp)) {
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

          return {
            success: result.status === 'success',
            nomor: displayNumber,
            index: index,
            data: result.data,
            error: result.message,
            isValidProvider: true
          };

        } catch (error) {
          // Nomor sudah dinormalisasi, langsung gunakan
          const displayNumber = nomor_hp;

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
            // Parse dan format hasil sesuai format yang diinginkan
            let rawData = result.data.data.hasil
              .replace(/<br>/g, '\n')
              .replace(/<[^>]*>/g, '') // Remove HTML tags
              .replace(/&nbsp;/g, ' ') // Replace HTML space
              .trim();

            // Extract informasi dasar
            let formattedResult = `├──────────SUKSES──────────┤\n\n`;

            // Extract dan format nomor
            const msisdnMatch = rawData.match(/MSISDN:\s*(\d+)/);
            if (msisdnMatch) {
              let displayNumber = msisdnMatch[1];
              if (displayNumber.startsWith('62')) {
                displayNumber = '0' + displayNumber.substring(2);
              }
              formattedResult += `💌 <b>Nomor          :</b> <code>${displayNumber}</code>\n`;
            }

            // Extract tipe kartu
            const tipeKartuMatch = rawData.match(/Tipe Kartu:\s*([^\n]+)/);
            if (tipeKartuMatch) {
              formattedResult += `📧 <b>Tipe              :</b> ${tipeKartuMatch[1]} (PREPAID)\n`;
            }

            // Extract dukcapil
            const dukcapilMatch = rawData.match(/Status Dukcapil:\s*([^\n]+)/);
            if (dukcapilMatch) {
              formattedResult += `📧 <b>Dukcapil       :</b> ${dukcapilMatch[1]} ✅\n`;
            }

            // Extract umur kartu
            const umurKartuMatch = rawData.match(/Umur Kartu:\s*([^\n]+)/);
            if (umurKartuMatch) {
              let umur = umurKartuMatch[1].replace(/\s*0 Bulan/g, '').trim();
              formattedResult += `📧 <b>Umur Kartu  :</b> ${umur}\n`;
            }

            // Extract jaringan (dari Status 4G)
            const status4gMatch = rawData.match(/Status 4G:\s*([^\n]+)/);
            if (status4gMatch) {
              formattedResult += `📶 <b>Jaringan       :</b> ${status4gMatch[1]}\n`;
            }

            // Calculate tenggang (masa berakhir - sekarang) with accurate Jakarta timezone
            const masaBerakhirMatch = rawData.match(/Masa Berakhir Tenggang:\s*([^\n]+)/);
            if (masaBerakhirMatch) {
              try {
                const diffDays = calculateDaysDiff(masaBerakhirMatch[1]);
                formattedResult += `⚡ <b>Tenggang     :</b> ${formatDaysDiff(diffDays)}\n\n`;
              } catch (e) {
                formattedResult += `⚡ <b>Tenggang     :</b> ${masaBerakhirMatch[1]}\n\n`;
              }
            }

            // Extract quota info
            const quotaSections = rawData.split('🎁 Quota:').slice(1);
            let akrabPackages = []; // Only Paket Akrab packages
            let otherPackages = []; // Non-Paket Akrab packages
            let kuotaData = [];
            
            for (const section of quotaSections) {
              const quotaNameMatch = section.match(/^([^\n]+)/);
              const aktifHinggaMatch = section.match(/🍂 Aktif Hingga:\s*([^\n]+)/);
              
              if (quotaNameMatch && aktifHinggaMatch) {
                const packageName = quotaNameMatch[1].trim();
                
                // Separate packages based on whether they contain "Paket Akrab"
                if (packageName.toLowerCase().includes('paket akrab')) {
                  akrabPackages.push({
                    name: packageName,
                    expiry: aktifHinggaMatch[1]
                  });
                } else {
                  otherPackages.push({
                    name: packageName,
                    expiry: aktifHinggaMatch[1]
                  });
                }
                
                // Extract benefits dari section ini
                const benefits = section.split('🎁 Benefit:').slice(1);
                
                for (const benefit of benefits) {
                  const benefitNameMatch = benefit.match(/^([^\n]+)/);
                  const tipeKuotaMatch = benefit.match(/🎁 Tipe Kuota:\s*([^\n]+)/);
                  const kuotaMatch = benefit.match(/🎁 Kuota:\s*([^\n]+)/);
                  const sisaKuotaMatch = benefit.match(/🌲 Sisa Kuota:\s*([^\n]+)/);

                  if (benefitNameMatch && tipeKuotaMatch && tipeKuotaMatch[1] === 'DATA' && kuotaMatch && sisaKuotaMatch) {
                    let benefitName = benefitNameMatch[1].trim();
                    let totalKuota = kuotaMatch[1];
                    let sisaKuota = sisaKuotaMatch[1];
                    
                    // Keep original benefit names for better identification
                    // No mapping to simplified names
                    
                    kuotaData.push({
                      name: benefitName,
                      total: totalKuota,
                      sisa: sisaKuota,
                      packageName: packageName
                    });
                  }
                }
              }
            }

            // Format Paket Akrab packages (merged)
            if (akrabPackages.length > 0) {
              const akrabNames = akrabPackages.map(pkg => pkg.name);
              formattedResult += `✨ <b>${akrabNames.join(' + ')} :</b>\n`;
              
              // Use first expiry date for merged display
              let expiry = akrabPackages[0].expiry;
              let remainingDays = '';
              
              if (expiry.match(/\d{4}-\d{2}-\d{2}/)) {
                const diffDays = calculateDaysDiff(expiry.split(' ')[0]);
                remainingDays = formatPackageExpiry(diffDays);
                
                const jakartaDate = parseToJakartaDate(expiry.split(' ')[0]);
                expiry = jakartaDate ? formatToDDMMYYYY(jakartaDate) : expiry;
              } else {
                remainingDays = `(⚡30 HARI)`;
              }
              
              formattedResult += `🌙 <b>Aktif Hingga :</b> ${expiry} ${remainingDays}\n\n`;
            }

            // Process kuota data - filter Kuota Bersama to keep only the smallest one
            let processedKuota = [];
            let kuotaBersamaEntries = [];
            
            for (const kuota of kuotaData) {
              // Check if this kuota belongs to Paket Akrab
              const isFromAkrab = akrabPackages.some(pkg => pkg.name === kuota.packageName);
              
              if (isFromAkrab) {
                // Apply simplified naming for Paket Akrab benefits
                let benefitName = kuota.name;
                if (benefitName.includes('24jam di semua jaringan')) {
                  benefitName = 'Kuota Bersama';
                } else if (benefitName.includes('Nasional')) {
                  benefitName = 'Kuota Nasional';
                } else if (benefitName.includes('myRewards')) {
                  benefitName = 'My Reward';
                }
                
                if (benefitName === 'Kuota Bersama') {
                  kuotaBersamaEntries.push({
                    name: benefitName,
                    total: kuota.total,
                    sisa: kuota.sisa
                  });
                } else {
                  processedKuota.push({
                    name: benefitName,
                    total: kuota.total,
                    sisa: kuota.sisa
                  });
                }
              }
            }
            
            // If there are multiple Kuota Bersama entries, keep only the one with smallest total
            if (kuotaBersamaEntries.length > 0) {
              let smallestKuotaBersama = kuotaBersamaEntries[0];
              
              for (const kuota of kuotaBersamaEntries) {
                const currentTotal = parseFloat(kuota.total.replace(/[^\d.]/g, ''));
                const smallestTotal = parseFloat(smallestKuotaBersama.total.replace(/[^\d.]/g, ''));
                
                if (currentTotal < smallestTotal) {
                  smallestKuotaBersama = kuota;
                }
              }
              
              processedKuota.unshift(smallestKuotaBersama); // Add to beginning
            }

            // Sort processedKuota in specific order: Kuota Bersama -> Kuota Nasional -> Kuota Lokal 2/3/4 -> My Reward
            processedKuota.sort((a, b) => {
              const getOrder = (name) => {
                if (name === 'Kuota Bersama') return 1;
                if (name === 'Kuota Nasional') return 2;
                if (name === 'Kuota Lokal 2') return 3;
                if (name === 'Kuota Lokal 3') return 4;
                if (name === 'Kuota Lokal 4') return 5;
                if (name === 'My Reward') return 6;
                return 7; // Others at the end
              };
              return getOrder(a.name) - getOrder(b.name);
            });

            // Format kuota data from Paket Akrab with <code> for alignment
            if (processedKuota.length > 0) {
              let maxNameLength = 0;
              let maxValueLength = 0;
              
              // Find max lengths for name and value alignment
              for (const kuota of processedKuota) {
                if (kuota.name.length > maxNameLength) {
                  maxNameLength = kuota.name.length;
                }
                
                // Extract number part for alignment (remove unit like GB, MB, KB)
                let valueOnly = kuota.sisa === '0' ? '0' : kuota.sisa.replace(/\s*(GB|MB|KB)$/i, '');
                if (valueOnly.length > maxValueLength) {
                  maxValueLength = valueOnly.length;
                }
              }
              
              for (const kuota of processedKuota) {
                const paddedName = kuota.name.padEnd(maxNameLength);
                
                // Format sisa with aligned GB
                let sisaFormatted;
                if (kuota.sisa === '0') {
                  sisaFormatted = '0'.padStart(maxValueLength) + ' GB';
                } else {
                  const valueMatch = kuota.sisa.match(/^(.*?)\s*(GB|MB|KB)?$/i);
                  if (valueMatch) {
                    const value = valueMatch[1];
                    const unit = valueMatch[2] || 'GB';
                    sisaFormatted = value.padStart(maxValueLength) + ' ' + unit;
                  } else {
                    sisaFormatted = kuota.sisa.padStart(maxValueLength + 3); // fallback
                  }
                }
                
                formattedResult += `<code>🔖 ${paddedName} : ${sisaFormatted}</code>\n`;
              }
            }

            // Format other packages (non-Paket Akrab) separately
            for (const otherPkg of otherPackages) {
              formattedResult += `\n✨ <b>${otherPkg.name} :</b>\n`;
              
              let expiry = otherPkg.expiry;
              let remainingDays = '';
              
              if (expiry.match(/\d{4}-\d{2}-\d{2}/)) {
                const diffDays = calculateDaysDiff(expiry.split(' ')[0]);
                remainingDays = formatPackageExpiry(diffDays);
                
                const jakartaDate = parseToJakartaDate(expiry.split(' ')[0]);
                expiry = jakartaDate ? formatToDDMMYYYY(jakartaDate) : expiry;
              } else {
                remainingDays = `(⚡30 HARI)`;
              }
              
              formattedResult += `🌙 <b>Aktif Hingga :</b> ${expiry} ${remainingDays}\n\n`;
              
              // Get kuota for this specific package
              let otherKuotaData = [];
              for (const kuota of kuotaData) {
                if (kuota.packageName === otherPkg.name) {
                  let customName = kuota.name;
                  
                  // Custom naming rules for non-Paket Akrab benefits
                  if (customName.includes('24 Jam Semua Jaringan')) {
                    // Check if it's an application-specific quota first
                    if (customName.match(/YouTube|Instagram|Facebook|Netflix|Iflix|VIU|Joox/i)) {
                      // For application-specific quotas, show only the app name
                      const appMatch = customName.match(/(YouTube|Instagram|Facebook|Netflix|Iflix|VIU|Joox)/i);
                      if (appMatch) {
                        customName = appMatch[1];
                      }
                    }
                    // For non-application quotas, replace "24 Jam Semua Jaringan" with "Kuota reguler"
                    else {
                      customName = customName.replace('24 Jam Semua Jaringan', 'Kuota reguler').replace(/\s+/g, ' ').trim();
                    }
                  }
                  
                  otherKuotaData.push({
                    name: customName,
                    total: kuota.total,
                    sisa: kuota.sisa
                  });
                }
              }
              
              // Format kuota for this package
              if (otherKuotaData.length > 0) {
                let maxNameLength = 0;
                let maxValueLength = 0;
                
                // Find max lengths for name and value alignment
                for (const kuota of otherKuotaData) {
                  if (kuota.name.length > maxNameLength) {
                    maxNameLength = kuota.name.length;
                  }
                  
                  // Extract number part for alignment (remove unit like GB, MB, KB)
                  let valueOnly = kuota.sisa === '0' ? '0' : kuota.sisa.replace(/\s*(GB|MB|KB)$/i, '');
                  if (valueOnly.length > maxValueLength) {
                    maxValueLength = valueOnly.length;
                  }
                }
                
                for (const kuota of otherKuotaData) {
                  const paddedName = kuota.name.padEnd(maxNameLength);
                  
                  // Format sisa with aligned GB
                  let sisaFormatted;
                  if (kuota.sisa === '0') {
                    sisaFormatted = '0'.padStart(maxValueLength) + ' GB';
                  } else {
                    const valueMatch = kuota.sisa.match(/^(.*?)\s*(GB|MB|KB)?$/i);
                    if (valueMatch) {
                      const value = valueMatch[1];
                      const unit = valueMatch[2] || 'GB';
                      sisaFormatted = value.padStart(maxValueLength) + ' ' + unit;
                    } else {
                      sisaFormatted = kuota.sisa.padStart(maxValueLength + 3); // fallback
                    }
                  }
                  
                  formattedResult += `<code>🔖 ${paddedName} : ${sisaFormatted}</code>\n`;
                }
              }
            }
            
            // Add footer
            formattedResult += `├──────────────────────────┤\n\n`;
            formattedResult += `⌚️ <b>Last Update:</b> ${getDompulTimestamp()}\n`;
            
            await bot.sendMessage(chatId, formattedResult, { parse_mode: 'HTML' });
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