// INI API HIDEPULSA
const axios = require('axios');
const { freezeStok } = require('../../db');
const { normalizePhoneNumber, isValidIndonesianPhone } = require('../../utils/normalize');

const stateBekasan = new Map();
const sessionTerakhir = new Map();

// === SAFE DELETE MESSAGE HELPER ===
const safeDeleteMessage = async (bot, chatId, messageId, context = '') => {
  if (!messageId) return;
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (e) {
    // Only log non-"message not found" errors for debugging
    if (!e.message.includes('message to delete not found') && 
        !e.message.includes('Bad Request: message to delete not found')) {
      console.log(`Safe delete message error (${context}):`, e.message);
    }
  }
};

// === MAIN KEYBOARD GENERATOR ===
const generateMainKeyboard = (userId) => {
  const keyboard = [
    [
      { text: '🗒️ REDEEM KODE 🗒️', callback_data: 'redeem_menu' }
    ],
    [
      { text: '📦 STOK BULANAN', callback_data: 'cek_stok_bulanan' },
      { text: '📦 STOK BEKASAN', callback_data: 'cek_stok' }
    ],
    [
      { text: '🌙 BELI BULANAN', callback_data: 'menu_bulanan' },
      { text: '⚡ BELI BEKASAN', callback_data: 'menu_bekasan' }
    ],
    [
      { text: '✨ AKRAB GLOBAL ✨', callback_data: 'menu_akrab_global' }
    ],
    [
      { text: '💌 CEK SIDOMPUL 💌', callback_data: 'cek_sidompul' }
    ]
  ];

  // Only add admin button if user is admin
  if (userId.toString() === process.env.ADMIN_ID) {
    keyboard.push([
      { text: '🛠️ ADMIN', callback_data: 'menu_admin' }
    ]);
  }

  return keyboard;
};

// === LOCKING SYSTEM ===
const activePengelolaSessions = new Map(); // key: nomor_hp, value: { userId, chatId, timestamp, step }
const userActiveSessions = new Map();      // key: userId, value: nomor_hp
const waitingQueues = new Map();           // key: nomor_hp, value: Array of waiting users

const SESSION_STATES = {
  SLOT_CHECKING: 'checking_slot',
  INPUT_WAITING: 'waiting_input', 
  PROCESSING: 'processing_transaction',
  COMPLETED: 'completed'
};

// Function untuk release lock dan notify waiting users
const releasePengelolaLock = (nomor_hp, userId, reason = 'completed') => {
  // console.log(`🔓 Releasing lock for ${nomor_hp} by user ${userId} - reason: ${reason}`);
  
  activePengelolaSessions.delete(nomor_hp);
  userActiveSessions.delete(userId);
  
  // Notify waiting users
  notifyWaitingUsers(nomor_hp);
};

// Function untuk notify waiting users
const notifyWaitingUsers = (nomor_hp) => {
  const queue = waitingQueues.get(nomor_hp);
  if (!queue || queue.length === 0) return;
  
  // console.log(`📢 Notifying ${queue.length} waiting users for ${nomor_hp}`);
  
  // Ambil user pertama dalam antrian
  const nextUser = queue.shift();
  
  // Hapus queue message "⚠️Nomer pengelola kode..." terlebih dahulu
  if (nextUser.queueMessageId) {
    global.bot.deleteMessage(nextUser.chatId, nextUser.queueMessageId).catch(err => {
      // Ignore delete error
    });
  }
  
  // Auto trigger untuk user berikutnya
  const notificationPromise = global.bot.sendMessage(nextUser.chatId, 
    `<b><i>Sudah sampai di antrian anda.\n` +
    `⚡ Memulai transaksi otomatis..!!</i></b>`, 
    { parse_mode: 'HTML' }
  ).catch(err => console.error('Error notifying waiting user:', err));
  
  // Auto start session untuk user berikutnya
  setTimeout(async () => {
    // Hapus notification message sebelum mulai transaksi
    try {
      const notificationMsg = await notificationPromise;
      if (notificationMsg && notificationMsg.message_id) {
        await global.bot.deleteMessage(nextUser.chatId, notificationMsg.message_id);
      }
    } catch (e) {
      // Ignore delete error
    }
    
    // Kirim loading message untuk mengisi gap sebelum "❗Masukan Nomor...."
    let loadingMsg;
    try {
      loadingMsg = await global.bot.sendMessage(nextUser.chatId, 
        '📧 <b>Mengecek slot kosong... 📧</b>', 
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error('Error sending loading message for queue user:', e);
    }
    
    await setStateBekasan(nextUser.chatId, {
      nomor_hp,
      kategori: nextUser.kategori,
      step: 'pilih_slot',
      userId: nextUser.userId,
      originalMessageId: nextUser.originalMessageId,
      loadingMessageId: loadingMsg ? loadingMsg.message_id : null  // ✅ Pass loading message ID
    });
  }, 1000);
};

// === HELPER FUNCTION: CEK APAKAH NOMOR ADALAH XL/AXIS ===
const isXLAxisNumber = (nomor) => {
  // Mapping seri nomor XL dan Axis (sama seperti dompul.js)
  const xlAxisSeries = [
    '0817', '0818', '0819', // XL
    '0859', '0877', '0878', // XL
    '0831', '0832', '0833', '0838' // Axis
  ];
  
  // Pastikan nomor dalam format 08xxx
  let checkNumber = nomor;
  if (checkNumber.startsWith('62')) {
    checkNumber = '0' + checkNumber.substring(2);
  } else if (checkNumber.length === 10 && !checkNumber.startsWith('0')) {
    checkNumber = '0' + checkNumber;
  }
  
  // Cek 4 digit pertama
  const prefix = checkNumber.substring(0, 4);
  const result = xlAxisSeries.includes(prefix);
  
  return result;
};

// === HELPER FUNCTION: VALIDASI NOMOR DENGAN API DOMPUL ===
const validateNomorWithDompul = async (nomorPembeli) => {
  try {
    const response = await axios.post("https://api.hidepulsa.com/api/tools", {
      action: "cek_dompul",
      id_telegram: process.env.ADMIN_ID,
      password: process.env.PASSWORD2,
      nomor_hp: nomorPembeli
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.APIKEY2
      },
      timeout: 15000 // 15 detik timeout untuk stabilitas
    });

    const responseData = response.data;
    
    // Cek apakah response sukses dan ada data
    if (responseData.status === 'success' && responseData.data) {
      const dompulData = responseData.data;
      
      // Parse data dari response yang nested (sesuai struktur response nyata)
      // Path: responseData.data.data.data.packageInfo
      const data = dompulData.data && dompulData.data.data ? dompulData.data.data : null;
      
      // Cek paket aktif dari packageInfo
      if (data && data.packageInfo && Array.isArray(data.packageInfo)) {
        const akrabPackages = [];
        
        // Loop melalui packageInfo untuk mencari paket akrab
        data.packageInfo.forEach((packageGroup, groupIndex) => {
          if (Array.isArray(packageGroup)) {
            packageGroup.forEach((packageItem, itemIndex) => {
              if (packageItem.packages && packageItem.packages.name) {
                const packageName = packageItem.packages.name;
                // Cek apakah ada paket dengan nama "akrab" atau "Akrab"
                if (packageName.toLowerCase().includes('akrab')) {
                  akrabPackages.push(packageName);
                }
              }
            });
          }
        });

        if (akrabPackages.length > 0) {
          return {
            valid: false,
            reason: 'akrab_package_exists',
            packages: akrabPackages
          };
        } else {
          return {
            valid: true,
            reason: 'no_akrab_packages'
          };
        }
      } else {
        // Tidak ada packageInfo atau struktur tidak sesuai - anggap aman, lanjut proses
        return {
          valid: true,
          reason: 'no_package_info'
        };
      }

    } else if (responseData.status === 'error' && responseData.data && responseData.data.text) {
      // Handle kasus nomor tidak memiliki paket (dari struktur dompul.js)
      try {
        const textData = JSON.parse(responseData.data.text);
        if (textData && textData.message && textData.message.includes('tidak memiliki paket')) {
          return {
            valid: true,
            reason: 'no_packages_active'
          };
        } else {
          // Error lain dari API - lanjut proses tanpa validasi
          return {
            valid: true, // Ubah ke true agar tidak block proses
            reason: 'api_error_proceed',
            error: textData.message || 'Unknown API error'
          };
        }
      } catch (parseError) {
        // Parse error - lanjut proses tanpa validasi
        return {
          valid: true, // Ubah ke true agar tidak block proses
          reason: 'parse_error_proceed',
          error: parseError.message
        };
      }
    } else {
      // Response tidak sesuai ekspektasi - lanjut proses tanpa validasi
      return {
        valid: true, // Ubah ke true agar tidak block proses
        reason: 'unexpected_response_proceed',
        error: responseData.message || 'Unexpected API response'
      };
    }

  } catch (error) {
    // Semua error di catch - lanjut proses tanpa validasi
    return {
      valid: true, // Ubah ke true agar tidak block proses
      reason: 'validation_error_proceed',
      error: error.message
    };
  }
};

// Export function untuk set state dari list_bekasan.js
const setStateBekasan = async (chatId, state) => {
  const { nomor_hp, userId, kategori } = state;
  
  // === VALIDASI SALDO SEBELUM LOCK ===
  try {
    const { getUserSaldo, getHargaPaket } = require('../../db');
    const saldoUser = await getUserSaldo(userId);
    const hargaPaket = await getHargaPaket(kategori);
    
    if (saldoUser < hargaPaket) {
      // Saldo tidak cukup, kirim alert dan return tanpa lock
      global.bot.sendMessage(chatId, `❗<b>Saldo tidak cukup untuk membeli produk!</b>`, {
        parse_mode: 'HTML'
      }).catch(err => console.error('Error sending insufficient balance message:', err));
      return;
    }
  } catch (dbErr) {
    console.error('Error checking balance:', dbErr.message);
    global.bot.sendMessage(chatId, '❌ <b>Gagal memverifikasi saldo</b>\n\nSilakan coba lagi atau hubungi admin.', {
      parse_mode: 'HTML'
    }).catch(err => console.error('Error sending DB error message:', err));
    return;
  }
  
  // Cek apakah user sudah punya sesi aktif
  if (userActiveSessions.has(userId)) {
    const existingPengelola = userActiveSessions.get(userId);
    global.bot.sendMessage(chatId, 
      `<b><i>⚠️Nomer pengelola kode ${existingPengelola.slice(-5)} masih di gunakan user lain...\nTunggu sebentar...!!</i></b>`,
      { parse_mode: 'HTML' }
    ).catch(err => console.error('Error sending active session message:', err));
    return;
  }
  
  // Cek apakah nomor pengelola sedang digunakan
  if (activePengelolaSessions.has(nomor_hp)) {
    const session = activePengelolaSessions.get(nomor_hp);
    const waitTime = Math.ceil((Date.now() - session.timestamp) / 1000);
    
    // Hapus loading message "📧 Mengecek slot kosong... 📧" terlebih dahulu
    if (state.loadingMessageId) {
      try {
        await global.bot.deleteMessage(chatId, state.loadingMessageId);
      } catch (e) {
        // Ignore delete error
      }
    }
    
    // Tambah ke waiting queue
    if (!waitingQueues.has(nomor_hp)) {
      waitingQueues.set(nomor_hp, []);
    }
    
    waitingQueues.get(nomor_hp).push({
      userId, chatId, kategori: state.kategori, timestamp: Date.now(),
      originalMessageId: state.originalMessageId
    });
    
    const position = waitingQueues.get(nomor_hp).length;
    const queueMessage = await global.bot.sendMessage(chatId, 
      `<b><i>⚠️Nomer pengelola kode ${nomor_hp.slice(-5)} masih di gunakan user lain...\nTunggu sebentar...!!</i></b>`,
      { parse_mode: 'HTML' }
    ).catch(err => console.error('Error sending queue message:', err));
    
    // Simpan queue message ID untuk dihapus nanti
    if (queueMessage) {
      // Simpan ke waiting queue object
      const userInQueue = waitingQueues.get(nomor_hp)[waitingQueues.get(nomor_hp).length - 1];
      userInQueue.queueMessageId = queueMessage.message_id;
    }
    
    return;
  }
  
  // Lock nomor pengelola
  activePengelolaSessions.set(nomor_hp, {
    userId,
    chatId,
    timestamp: Date.now(),
    step: SESSION_STATES.SLOT_CHECKING,
    lastActivity: Date.now()
  });
  
  // Lock user session
  userActiveSessions.set(userId, nomor_hp);
  
  // console.log(`🔒 Lock acquired for ${nomor_hp} by user ${userId}`);
  
  stateBekasan.set(chatId, state);
  
  // Trigger cek slot kosong langsung setelah state di-set
  setTimeout(() => {
    checkSlotKosong(chatId);
  }, 1000);
};

// Function untuk cek slot kosong dan auto select
const checkSlotKosong = async (chatId) => {
  const state = stateBekasan.get(chatId);
  if (!state || state.step !== 'pilih_slot') return;

  const { nomor_hp, kategori, loadingMessageId, userId } = state;

  // Update session state
  const session = activePengelolaSessions.get(nomor_hp);
  if (session) {
    session.step = SESSION_STATES.SLOT_CHECKING;
    session.lastActivity = Date.now();
  }

  try {
    // === HIT API PERTAMA ===
    let res;
    try {
      res = await axios.post("https://api.hidepulsa.com/api/akrab", {
        action: "info",
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD2,
        nomor_hp
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.APIKEY2
        }
      });
    } catch (apiErr) {
      console.error('API Error in slot check:', apiErr.message);
      
      // RELEASE LOCK karena API error
      releasePengelolaLock(nomor_hp, userId, 'api_error_slot_check');
      stateBekasan.delete(chatId);
      
      const teksError = '❌ <b>Gagal mengecek slot kosong</b>\n\nSilakan coba lagi atau hubungi admin.\n\n🔓 Nomor pengelola telah dibebaskan.';
      
      if (loadingMessageId) {
        try {
          // Send new error message FIRST
          await global.bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
          
          // Delete old loading message safely
          await safeDeleteMessage(global.bot, chatId, loadingMessageId, 'api error slot check');
        } catch (e) {
          // Ignore send/delete error
        }
      } else {
        await global.bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
      }
      return;
    }

    let data = res.data?.data;
    let slotList = data?.data_slot || [];

    // === RETRY MECHANISM ===
    // Jika hit pertama tidak menghasilkan data slot, coba hit kedua
    if (!slotList || slotList.length === 0) {
      try {
        // Update status untuk retry
        if (loadingMessageId) {
          try {
            // Send new retry message FIRST
            const retryMsg = await global.bot.sendMessage(chatId, `🔄 <b>Retry cek slot kosong...</b>`, {
              parse_mode: 'HTML'
            });
            
            // Update loadingMessageId untuk step berikutnya SEBELUM delete
            state.loadingMessageId = retryMsg.message_id;
            stateBekasan.set(chatId, state);
            
            // Delete old loading message safely
            await safeDeleteMessage(global.bot, chatId, loadingMessageId, 'retry slot check');
          } catch (e) {
            // Ignore send/delete error - tapi tetap update state jika ada retry message
            console.log('Retry message handling error (ignored):', e.message);
          }
        }

        // Delay sebentar sebelum retry
        await new Promise(resolve => setTimeout(resolve, 500));

        // === HIT API KEDUA ===
        const retryRes = await axios.post("https://api.hidepulsa.com/api/akrab", {
          action: "info",
          id_telegram: process.env.ADMIN_ID,
          password: process.env.PASSWORD2,
          nomor_hp
        }, {
          headers: {
            "Content-Type": "application/json",
            Authorization: process.env.APIKEY2
          }
        });

        // Gunakan hasil dari hit kedua
        const retryData = retryRes.data?.data;
        if (retryData) {
          data = retryData;
          slotList = retryData?.data_slot || [];
        }

      } catch (retryErr) {
        // Jika retry gagal, tetap gunakan hasil hit pertama
        console.log(`Retry failed for ${nomor_hp}:`, retryErr.message);
      }
    }
    // Pastikan sisa-add bertipe number
    slotList.forEach(s => { 
      if (typeof s["sisa-add"] === 'string') s["sisa-add"] = parseInt(s["sisa-add"]);
    });

    // Prioritaskan slot kosong dengan sisa-add === 1
    const kosongSisa1 = slotList.filter(s => (!s.nomor || s.nomor === "") && s["sisa-add"] === 1);
    // Slot kosong lain (sisa-add bukan 1)
    const kosongLain = slotList.filter(s => (!s.nomor || s.nomor === "") && s["sisa-add"] !== 1);
    // Gabungkan, yang sisa-add 1 di depan
    const kosong = [...kosongSisa1, ...kosongLain];

    // Debug urutan slot yang dipilih
    // console.log('Urutan slot kosong:', kosong.map(s => ({ slot: s["slot-ke"], sisa: s["sisa-add"] })));

    if (!kosong.length) {
      // RELEASE LOCK karena tidak ada slot kosong
      releasePengelolaLock(nomor_hp, userId, 'no_slots_available');
      stateBekasan.delete(chatId);

      // Tambahkan info jika masih tidak ada data setelah retry
      let teksKosong = '<b><i>Sedang me-refresh token...\n\nSilahkan klik lagi ✅ LANJUT BELI!</i></b>';
      if ((!slotList || slotList.length === 0)) {
        teksKosong += '\n\n⚠️ <i>Data tidak tersedia setelah 2x hit API</i>';
      }

      if (loadingMessageId) {
        try {
          // Send new slot info message FIRST
          await global.bot.sendMessage(chatId, teksKosong, { parse_mode: 'HTML' });
          
          // Delete old loading/retry message safely
          await safeDeleteMessage(global.bot, chatId, loadingMessageId, 'no slots available');
        } catch (e) {
          // Ignore send/delete error
        }
      } else {
        await global.bot.sendMessage(chatId, teksKosong, { parse_mode: 'HTML' });
      }
      return;
    }

    // AUTO SELECT SLOT KOSONG PRIORITAS SISA-ADD 1
    const selectedSlot = kosong[0]["slot-ke"];
    
    // Update state dengan slot yang dipilih otomatis
    state.step = 'input_nomor';
    state.nomor_slot = selectedSlot;
    stateBekasan.set(chatId, state);

    // Update session state
    if (session) {
      session.step = SESSION_STATES.INPUT_WAITING;
      session.lastActivity = Date.now();
      session.selectedSlot = selectedSlot;
    }

    // Kirim pesan baru untuk input nomor FIRST, lalu hapus loading message
    const teksInput = `❗<b>Masukan Nomor....</b>`;
    await global.bot.sendMessage(chatId, teksInput, { parse_mode: 'HTML' });

    // Hapus pesan loading setelah pesan input nomor terkirim
    await safeDeleteMessage(global.bot, chatId, loadingMessageId, 'input nomor ready');

    // Set timer 30 detik untuk auto cancel jika tidak ada input
    const timeoutId = setTimeout(() => {
      const currentState = stateBekasan.get(chatId);
      if (currentState && currentState.step === 'input_nomor' && currentState.nomor_slot === selectedSlot) {
        // RELEASE LOCK karena timeout
        releasePengelolaLock(nomor_hp, userId, 'input_timeout');
        stateBekasan.delete(chatId);
        
        // Kirim pesan timeout
        global.bot.sendMessage(chatId, '⌛ <b>Waktu input habis.</b>', {
          parse_mode: 'HTML'
        }).catch(err => console.error('Error sending timeout message:', err));
      }
    }, 30000); // 30 detik

    // Simpan timeoutId ke state untuk bisa dibatalkan nanti
    state.timeoutId = timeoutId;
    stateBekasan.set(chatId, state);

  } catch (err) {
    console.error(`Error checking slot kosong: ${err.message}`);
    
    // RELEASE LOCK karena API error
    releasePengelolaLock(nomor_hp, userId, 'api_error_slot_check');
    stateBekasan.delete(chatId);
    
    const teksError = '❌ <b>Gagal mengecek slot kosong</b>\n\nSilakan coba lagi atau hubungi admin.\n\n🔓 Nomor pengelola telah dibebaskan.';
    
    if (loadingMessageId) {
      try {
        // Send new error message FIRST
        await global.bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
        
        // Delete old loading message safely
        await safeDeleteMessage(global.bot, chatId, loadingMessageId, 'slot check error');
      } catch (e) {
        // Ignore send/delete error
      }
    } else {
      await global.bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
    }
  }
};

// Auto cleanup untuk session yang timeout/stale
const cleanupStaleSessions = () => {
  const now = Date.now();
  const TIMEOUT_DURATION = 180000; // 3 menit timeout
  
  for (const [nomor_hp, session] of activePengelolaSessions) {
    if (now - session.lastActivity > TIMEOUT_DURATION) {
      // console.log(`🧹 Cleaning up stale session for ${nomor_hp} - user ${session.userId}`);
      
      // Release lock untuk session yang timeout
      releasePengelolaLock(nomor_hp, session.userId, 'session_timeout');
      
      // Cleanup state juga
      stateBekasan.delete(session.chatId);
      
      // Notify user
      global.bot.sendMessage(session.chatId, 
        '⌛ <b>Sesi telah berakhir</b>\n\n' +
        'Sesi Anda telah berakhir karena tidak ada aktivitas.\n\n' +
        '🔓 Nomor pengelola telah dibebaskan.\n' +
        '🔄 Silakan mulai transaksi baru.',
        { parse_mode: 'HTML' }
      ).catch(err => console.error('Error sending cleanup notification:', err));
    }
  }
};

// Jalankan cleanup setiap 1 menit
setInterval(cleanupStaleSessions, 60000);

module.exports = (bot) => {
  // Store bot instance globally
  global.bot = bot;

  // HAPUS SEMUA CALLBACK QUERY HANDLER UNTUK SLOT SELECTION
  // Karena sekarang auto select, tidak perlu lagi handle addslot_\d+

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    const text = msg.text.trim();
    const state = stateBekasan.get(chatId);

    if (!state || state.step !== 'input_nomor' || text.startsWith('/')) return;

    const { nomor_hp, userId } = state;
    
    // BATALKAN TIMEOUT TIMER karena user sudah input
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      delete state.timeoutId;
    }
    
    // Update session state ke PROCESSING
    const session = activePengelolaSessions.get(nomor_hp);
    if (session) {
      session.step = SESSION_STATES.PROCESSING;
      session.lastActivity = Date.now();
    }

    // NORMALISASI NOMOR INPUT
    const normalizedNumber = normalizePhoneNumber(text);
    
    if (!normalizedNumber || !isValidIndonesianPhone(normalizedNumber)) {
      await bot.sendMessage(chatId, '❌ Format nomor tidak valid!\n\n✅ Format yang diterima:\n• 08xxxxxxxxxx\n• 628xxxxxxxxxx\n• 8xxxxxxxxxx\n\n💡 Contoh: 08123456789 atau 628123456789');
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      return;
    }

    const { nomor_slot, kategori, loadingMessageId } = state;
    
    // Hapus message input nomor jika ada loadingMessageId
    await safeDeleteMessage(bot, chatId, loadingMessageId, 'before processing');
    
    // Simpan waktu mulai untuk validasi
    const startTime = Date.now();
    const processingMsg = await bot.sendMessage(chatId, '⏳ <b>Diproses, Mohon tunggu sebentar...</b>', { parse_mode: 'HTML' });

    // === LAYER 4 VALIDATION: VALIDASI NOMOR PEMBELI DENGAN API DOMPUL ===
    // Update processing message untuk menunjukkan validasi sedang berjalan
    await bot.editMessageText('🔍 <b>Memvalidasi nomor pembeli...</b>', {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'HTML'
    });

    // Cek apakah nomor adalah XL/Axis sebelum validasi dompul
    const isXLAxisResult = isXLAxisNumber(normalizedNumber);
    
    if (!isXLAxisResult) {
      // Skip validasi dompul untuk nomor non-XL/Axis, langsung lanjut ke proses ADD
      await bot.editMessageText('⏳ <b>Memproses pembelian...</b>', {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'HTML'
      });
    } else {
      // Gunakan helper function untuk validasi dompul pada nomor XL/Axis
      const validationResult = await validateNomorWithDompul(normalizedNumber);

      if (validationResult.valid === false) {
        // GAGAL VALIDASI: Nomor masih memiliki paket akrab aktif - TOLAK TANPA POTONG SALDO
        // RELEASE LOCK karena validasi gagal
        releasePengelolaLock(nomor_hp, userId, 'validation_failed_akrab_exists');
        
        // Ambil saldo user untuk ditampilkan (tanpa dipotong)
        const { getUserSaldo } = require('../../db');
        const saldoUser = await getUserSaldo(msg.from.id);
        
        const teksGagalValidasi = `❌ Gagal !!\n\n` +
          `<code>Detail         : Nomor masih memiliki paket akrab aktif\n` +
          `Jenis paket    : BEKASAN ${kategori.toUpperCase()}\n` +
          `Nomor          : ${normalizedNumber}\n` +
          `Kode           : -\n` +
          `Kuota Bersama  : -\n` +
          `Saldo awal     : Rp.${saldoUser.toLocaleString('id-ID')}\n` +
          `Saldo terpotong: -\n` +
          `Saldo akhir    : Rp.${saldoUser.toLocaleString('id-ID')}\n` +
          `Waktu eksekusi : 0 detik ❌</code>`;

        // Kirim hasil gagal validasi TANPA potong saldo
        await bot.sendMessage(chatId, teksGagalValidasi, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id
        });

        // Log transaksi validasi gagal ke grup/channel (NYANGKUT)
        try {
          const { logTransaction } = require('../../transaction_logger');
          await logTransaction(bot, {
            userId: msg.from.id,
            username: msg.from.username,
            kategori: kategori.toUpperCase(), // kategori sudah tersedia dari state
            nomor: normalizedNumber, // Nomor customer/pembeli
            pengelola: nomor_hp, // Nomor pengelola
            status: 'validation_failed',
            harga: 0, // Tidak ada potongan saldo
            saldoSebelum: saldoUser,
            saldoSesudah: saldoUser, // Saldo tidak berubah
            provider: 'DOMPUL_API',
            error: 'Nomor masih memiliki paket akrab aktif'
          });
        } catch (logError) {
          console.error('Error logging validation failed transaction:', logError.message);
        }

        // Hapus message processing
        try {
          await bot.deleteMessage(chatId, processingMsg.message_id);
        } catch (e) {
          // Ignore delete error
        }

        stateBekasan.delete(chatId);

        // Auto restore menu setelah validasi gagal (simplified)
        setTimeout(async () => {
          if (state.originalMessageId) {
            try {
              await global.bot.deleteMessage(chatId, state.originalMessageId);
            } catch (e) {}
          }
        }, 1000);
        
        setTimeout(async () => {
          try {
            const { getUserSaldo } = require('../../db');
            const saldo = await getUserSaldo(msg.from.id);
            
            const formatUptime = (ms) => {
              let s = Math.floor(ms / 1000);
              const hari = Math.floor(s / 86400); s %= 86400;
              const jam = Math.floor(s / 3600); s %= 3600;
              const menit = Math.floor(s / 60); const detik = s % 60;
              let hasil = [];
              if (hari > 0) hasil.push(`${hari} hari`);
              if (jam > 0) hasil.push(`${jam} jam`);
              if (menit > 0) hasil.push(`${menit} menit`);
              if (detik > 0 || hasil.length === 0) hasil.push(`${detik} detik`);
              return hasil.join(' ');
            };

            const BOT_START_TIME = Date.now() - (process.uptime() * 1000);
            const uptime = formatUptime(Date.now() - BOT_START_TIME);
            
            const generateUserDetail = (userId, username, saldo, uptime) => {
              return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
                     '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
                     '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
                     '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
            };

            const detail = generateUserDetail(msg.from.id, msg.from.username, saldo, uptime);

            await global.bot.sendPhoto(chatId, './welcome.jpg', {
              caption: detail,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: generateMainKeyboard(msg.from.id) }
            });
          } catch (err) {
            console.error('Error restoring main menu after validation failed:', err.message);
          }
        }, 2000);

        return; // STOP EXECUTION - tidak lanjut ke API ADD
      }

      // VALIDASI BERHASIL atau TIDAK DAPAT DIVALIDASI - LANJUT KE PROSES ADD NORMAL
      // Tidak ada output khusus, langsung lanjut ke proses ADD
      await bot.editMessageText('⏳ <b>Memproses pembelian...</b>', {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'HTML'
      });
    }

    // Delay sebentar sebelum lanjut ke API ADD
    await new Promise(resolve => setTimeout(resolve, 1000));

    // === PROSES API ADD SETELAH VALIDASI BERHASIL ===
    // Reset start time untuk menghitung execution time API ADD saja
    const addStartTime = Date.now();
    
    try {
      const res = await axios.post("https://api.hidepulsa.com/api/akrab", {
        action: "add",
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD2,
        nomor_hp,
        nomor_slot,
        nomor_anggota: normalizedNumber, // Gunakan nomor yang sudah dinormalisasi
        nama_anggota: `${msg.from.username || msg.from.first_name || 'USER'} BEKASAN`, // Gunakan username Telegram
        nama_admin: "XL"
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.APIKEY2
        },
        timeout: 300000 // 5 menit timeout untuk menghindari socket hang up
      });

      // Hitung waktu eksekusi
      const addExecutionTime = Math.floor((Date.now() - addStartTime) / 1000);
      
      // Ambil harga dari database
      const { getHargaPaket, getHargaGagal } = require('../../db');
      const harga = await getHargaPaket(kategori);
      
      // Kode pengelola (5 digit terakhir nomor)
      const kodePengelola = nomor_hp.slice(-5);
      
      const info = res.data?.data?.details || {};
      const kuota = 0;

      let teksHasil = '';

      // Logika berdasarkan waktu eksekusi
      if (addExecutionTime >= 8) {
        // SUKSES - Waktu eksekusi >= 8 detik
        
        // Ambil saldo user sebelum dipotong
        const { getUserSaldo } = require('../../db');
        const saldoAwal = await getUserSaldo(msg.from.id);
        const saldoAkhir = saldoAwal - harga;
        
        teksHasil = `✅ Sukses !!\n\n` +
          `<code>Detail         : Sukses bjir🗿\n` +
          `Jenis paket    : BEKASAN ${kategori.toUpperCase()}\n` +
          `Nomor          : ${info["nomor-anggota"] || normalizedNumber}\n` +
          `Kode           : ${kodePengelola}\n` +
          `Kuota Bersama  : 0gb\n` +
          `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
          `Saldo terpotong: Rp.${harga.toLocaleString('id-ID')}\n` +
          `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
          `Waktu eksekusi : ${addExecutionTime} detik ✅</code>`;

        // Kurangi saldo sesuai harga penuh SETELAH membuat output
        try {
          const { kurangiSaldo } = require('../../db');
          await kurangiSaldo(msg.from.id, harga);
        } catch (saldoErr) {
          console.error('Error mengurangi saldo:', saldoErr.message);
        }

        // HANYA catat transaksi jika SUKSES dengan user_id dan nomor normalized
        await freezeStok(state.kategori, nomor_hp, normalizedNumber, nomor_slot, kuota, msg.from.id, bot, {
          saldoSebelum: saldoAwal,
          saldoSesudah: saldoAkhir,
          harga: harga
        });

        // RELEASE LOCK karena transaksi SUKSES
        releasePengelolaLock(nomor_hp, userId, 'transaction_success');

      } else {
        // GAGAL - Waktu eksekusi < 15 detik
        const biayaGagal = await getHargaGagal();
        
        // Ambil saldo user sebelum dipotong
        const { getUserSaldo } = require('../../db');
        const saldoAwal = await getUserSaldo(msg.from.id);
        const saldoAkhir = saldoAwal - biayaGagal;
        
        teksHasil = `❌ Gagal !!\n\n` +
          `<code>Detail         : nyangkut, ada akrab\n` +
          `Jenis paket    : BEKASAN ${kategori.toUpperCase()}\n` +
          `Nomor          : ${normalizedNumber}\n` +
          `Kode           : -\n` +
          `Kuota Bersama  : -\n` +
          `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
          `Saldo terpotong: Rp.${biayaGagal.toLocaleString('id-ID')}\n` +
          `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
          `Waktu eksekusi : ${addExecutionTime} detik ❌</code>`;

        // Kurangi saldo hanya Rp. 700 SETELAH membuat output
        try {
          const { kurangiSaldo } = require('../../db');
          await kurangiSaldo(msg.from.id, biayaGagal);
        } catch (saldoErr) {
          console.error('Error mengurangi saldo:', saldoErr.message);
        }

        // Log transaksi gagal ke grup/channel
        try {
          const { logTransaction } = require('../../transaction_logger');
          await logTransaction(bot, {
            userId: msg.from.id,
            username: msg.from.username,
            kategori: state.kategori,
            nomor: normalizedNumber, // Nomor customer/pembeli
            pengelola: nomor_hp, // Nomor pengelola
            status: 'failed',
            harga: biayaGagal,
            saldoSebelum: saldoAwal,
            saldoSesudah: saldoAkhir,
            provider: 'SISTEM',
            error: 'Transaksi gagal - waktu eksekusi < 15 detik'
          });
        } catch (logError) {
          console.error('Warning: Failed to log failed transaction:', logError.message);
        }

        // RELEASE LOCK karena transaksi GAGAL
        releasePengelolaLock(nomor_hp, userId, 'transaction_failed');
      }

      // Hapus message "Memproses penambahan anggota..." dan kirim hasil dengan reply
      try {
        await bot.deleteMessage(chatId, processingMsg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      
      // JANGAN hapus pesan input nomor user - biarkan tetap terlihat
      // try {
      //   await bot.deleteMessage(chatId, msg.message_id);
      // } catch (e) {
      //   // Ignore delete error
      // }
      
      await bot.sendMessage(chatId, teksHasil, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id  // Reply ke pesan nomor user
      });

      // === AUTO-RESTORE MENU PATTERN ===
      // Hapus menu detail bekasan setelah 1 detik
      setTimeout(async () => {
        try {
          // Hapus menu detail bekasan yang dipilih user
          // Message ID disimpan saat user memilih paket bekasan
          if (state.originalMessageId) {
            await bot.deleteMessage(chatId, state.originalMessageId);
          }
        } catch (deleteErr) {
          // Ignore delete error jika menu sudah tidak ada
        }
      }, 1000);
      
      // Tampilkan menu utama setelah 2 detik (sama persis dengan main.js)
      setTimeout(async () => {
        try {
          const { getUserSaldo } = require('../../db');
          
          // Format uptime sama dengan main.js
          const formatUptime = (ms) => {
            let s = Math.floor(ms / 1000);
            const hari = Math.floor(s / 86400);
            s %= 86400;
            const jam = Math.floor(s / 3600);
            s %= 3600;
            const menit = Math.floor(s / 60);
            const detik = s % 60;
            let hasil = [];
            if (hari > 0) hasil.push(`${hari} hari`);
            if (jam > 0) hasil.push(`${jam} jam`);
            if (menit > 0) hasil.push(`${menit} menit`);
            if (detik > 0 || hasil.length === 0) hasil.push(`${detik} detik`);
            return hasil.join(' ');
          };
          
          // Generate user detail sama dengan main.js
          const generateUserDetail = (userId, username, saldo, uptime) => {
            return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
                   '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
                   '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
                   '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
          };
          
          // Ambil saldo terbaru
          const saldoTerbaru = await getUserSaldo(msg.from.id);
          
          // Hitung uptime dari BOT_START_TIME global atau fallback ke process.uptime
          let uptimeMs;
          if (global.BOT_START_TIME) {
            uptimeMs = Date.now() - global.BOT_START_TIME;
          } else {
            uptimeMs = process.uptime() * 1000;
          }
          const uptime = formatUptime(uptimeMs);
          
          // Generate detail persis sama dengan main.js
          const detail = generateUserDetail(msg.from.id, msg.from.username, saldoTerbaru, uptime);
          
          // Kirim menu utama persis sama dengan main.js
          await bot.sendPhoto(chatId, './welcome.jpg', {
            caption: detail,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: generateMainKeyboard(msg.from.id) }
          }, {
            filename: 'welcome.jpg',
            contentType: 'image/jpeg'
          });
        } catch (restoreErr) {
          console.error('Error restoring menu:', restoreErr.message);
        }
      }, 2000);
      // === END AUTO-RESTORE PATTERN ===

      // Simpan sesi terakhir (hanya jika SUKSES)
      if (addExecutionTime >= 15) {
        sessionTerakhir.set(chatId, {
          nomor_hp,
          nomor_slot,
          input_gb: kuota
        });

        // Set timeout untuk hapus session terakhir setelah 60 detik
        setTimeout(() => {
          sessionTerakhir.delete(chatId);
        }, 60000);
      }

      // Hapus state setelah selesai
      stateBekasan.delete(chatId);

      // Set kuota ke 0 setelah 10 detik (hanya jika SUKSES)
      if (addExecutionTime >= 15) {
        setTimeout(async () => {
          try {
            await axios.post("https://api.hidepulsa.com/api/akrab", {
              action: "edit",
              id_telegram: process.env.ADMIN_ID,
              password: process.env.PASSWORD2,
              nomor_hp,
              nomor_slot,
              input_gb: "0"
            }, {
              headers: {
                "Content-Type": "application/json",
                Authorization: process.env.APIKEY2
              },
              timeout: 60000 // 1 menit timeout untuk edit kuota
            });
          } catch (err) {
            console.warn(`⚠️ Edit kuota gagal untuk ${nomor_hp} SLOT ${nomor_slot}:`, err.message);
          }
        }, 10000);
      }

    } catch (err) {
      console.error(`Error adding anggota bekasan: ${err.message}`);
      const addExecutionTime = Math.floor((Date.now() - addStartTime) / 1000);
      const { getHargaGagal } = require('../../db');
      const biayaGagal = await getHargaGagal();

      // === SPECIAL HANDLING UNTUK SOCKET HANG UP ===
      // Socket hang up biasanya berarti server masih memproses tapi client timeout
      if (err.code === 'ECONNRESET' || err.message.includes('socket hang up') || err.message.includes('timeout')) {
        console.warn(`⚠️ [SOCKET HANG UP] Possible server still processing - API ADD execution time: ${addExecutionTime}s`);
        
        // Jika execution time >= 8 detik, kemungkinan besar server berhasil memproses
        if (addExecutionTime >= 8) {
          console.log(`✅ [SOCKET HANG UP] Treating as SUCCESS due to API ADD execution time >= 8s`);
          
          // TREAT AS SUCCESS - calculate as successful transaction
          const { getHargaPaket } = require('../../db');
          const harga = await getHargaPaket(kategori);
          const kodePengelola = nomor_hp.slice(-5);
          const kuota = 0;
          
          // Ambil saldo user sebelum dipotong
          const { getUserSaldo } = require('../../db');
          const saldoAwal = await getUserSaldo(msg.from.id);
          const saldoAkhir = saldoAwal - harga;
          
          const teksHasilSuccess = `✅ Sukses !! (Network Timeout)\n\n` +
            `<code>Detail         : Sukses (timeout jaringan)\n` +
            `Jenis paket    : BEKASAN ${kategori.toUpperCase()}\n` +
            `Nomor          : ${normalizedNumber}\n` +
            `Kode           : ${kodePengelola}\n` +
            `Kuota Bersama  : 0gb\n` +
            `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
            `Saldo terpotong: Rp.${harga.toLocaleString('id-ID')}\n` +
            `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
            `Waktu eksekusi : ${addExecutionTime} detik ⚠️</code>\n\n` +
            `⚠️ <i>Nomor kemungkinan sudah ter-add meski ada timeout jaringan</i>`;

          // Kirim hasil success
          await bot.sendMessage(chatId, teksHasilSuccess, {
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id
          });

          // Kurangi saldo dengan harga paket (bukan biaya gagal)
          try {
            const { kurangiSaldo } = require('../../db');
            await kurangiSaldo(msg.from.id, harga);
          } catch (saldoErr) {
            console.error('Error mengurangi saldo (success case):', saldoErr.message);
          }

          // Catat transaksi sebagai sukses
          await freezeStok(kategori, nomor_hp, normalizedNumber, nomor_slot, kuota, msg.from.id, bot, {
            saldoSebelum: saldoAwal,
            saldoSesudah: saldoAkhir,
            harga: harga
          });

          // RELEASE LOCK sebagai sukses
          releasePengelolaLock(nomor_hp, userId, 'transaction_success_timeout');

          // Auto edit kuota untuk socket hang up yang dianggap sukses
          setTimeout(async () => {
            try {
              await axios.post("https://api.hidepulsa.com/api/akrab", {
                action: "edit",
                id_telegram: process.env.ADMIN_ID,
                password: process.env.PASSWORD2,
                nomor_hp,
                nomor_slot,
                input_gb: "0"
              }, {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: process.env.APIKEY2
                },
                timeout: 60000 // 1 menit timeout untuk edit kuota
              });
            } catch (editErr) {
              console.warn(`⚠️ Edit kuota timeout case gagal untuk ${nomor_hp} SLOT ${nomor_slot}:`, editErr.message);
            }
          }, 10000);

        } else {
          console.log(`❌ [SOCKET HANG UP] Treating as FAILURE due to API ADD execution time < 8s`);
          
          // TREAT AS FAILURE - execution time < 15 detik
          // Ambil saldo user sebelum dipotong
          const { getUserSaldo } = require('../../db');
          const saldoAwal = await getUserSaldo(msg.from.id);
          const saldoAkhir = saldoAwal - biayaGagal;
          
          const teksGagalTimeout = `❌ Gagal !! (Network Timeout)\n\n` +
            `<code>Detail         : Timeout jaringan\n` +
            `Jenis paket    : BEKASAN ${kategori.toUpperCase()}\n` +
            `Nomor          : ${normalizedNumber}\n` +
            `Kode           : -\n` +
            `Kuota Bersama  : -\n` +
            `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
            `Saldo terpotong: Rp.${biayaGagal.toLocaleString('id-ID')}\n` +
            `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
            `Waktu eksekusi : ${addExecutionTime} detik ⚠️</code>\n\n` +
            `⚠️ <i>Timeout jaringan - silakan cek manual apakah nomor ter-add</i>`;

          // Kirim hasil timeout
          await bot.sendMessage(chatId, teksGagalTimeout, {
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id
          });

          // Kurangi saldo dengan biaya gagal
          try {
            const { kurangiSaldo } = require('../../db');
            await kurangiSaldo(msg.from.id, biayaGagal);
          } catch (saldoErr) {
            console.error('Error mengurangi saldo (timeout case):', saldoErr.message);
          }

          // Log transaksi timeout ke grup/channel
          try {
            const { logTransaction } = require('../../transaction_logger');
            await logTransaction(bot, {
              userId: msg.from.id,
              username: msg.from.username,
              kategori: kategori.toUpperCase(),
              nomor: normalizedNumber,
              pengelola: nomor_hp,
              status: 'timeout',
              harga: biayaGagal,
              saldoSebelum: saldoAwal,
              saldoSesudah: saldoAkhir,
              provider: 'API_TIMEOUT',
              error: 'Timeout jaringan - waktu eksekusi melebihi batas'
            });
          } catch (logError) {
            console.error('Warning: Failed to log timeout transaction:', logError.message);
          }

          // RELEASE LOCK sebagai gagal
          releasePengelolaLock(nomor_hp, userId, 'transaction_failed_timeout');
        }

      } else {
        // ERROR LAINNYA (bukan socket hang up) - treat as normal failure
        console.log(`❌ [API ERROR] Non-timeout error: ${err.message}`);

        // RELEASE LOCK karena API ERROR
        releasePengelolaLock(nomor_hp, userId, 'api_error_add_anggota');

        // Format output gagal karena error API normal
        // TIDAK memanggil freezeStok untuk transaksi yang error
        
        // Ambil saldo user sebelum dipotong
        const { getUserSaldo } = require('../../db');
        const saldoAwal = await getUserSaldo(msg.from.id);
        const saldoAkhir = saldoAwal - biayaGagal;
        
        const teksGagal = `❌ Gagal !!\n\n` +
          `<code>Detail         : nyangkut, ada akrab\n` +
          `Jenis paket    : BEKASAN ${kategori.toUpperCase()}\n` +
          `Nomor          : ${normalizedNumber}\n` +
          `Kode           : -\n` +
          `Kuota Bersama  : -\n` +
          `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
          `Saldo terpotong: Rp.${biayaGagal.toLocaleString('id-ID')}\n` +
          `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
          `Waktu eksekusi : ${addExecutionTime} detik ❌</code>`;

        // Kirim hasil FIRST, lalu hapus processing message
        await bot.sendMessage(chatId, teksGagal, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id // Reply ke message nomor user
        });

        // Kurangi saldo SETELAH kirim pesan
        try {
          const { kurangiSaldo } = require('../../db');
          await kurangiSaldo(msg.from.id, biayaGagal);
        } catch (saldoErr) {
          console.error('Error mengurangi saldo:', saldoErr.message);
        }

        // Log transaksi API error ke grup/channel
        try {
          const { logTransaction } = require('../../transaction_logger');
          await logTransaction(bot, {
            userId: msg.from.id,
            username: msg.from.username,
            kategori: kategori.toUpperCase(),
            nomor: normalizedNumber,
            pengelola: nomor_hp,
            status: 'failed',
            harga: biayaGagal,
            saldoSebelum: saldoAwal,
            saldoSesudah: saldoAkhir,
            provider: 'API_ERROR',
            error: `API Error - ${err.message}`
          });
        } catch (logError) {
          console.error('Warning: Failed to log API error transaction:', logError.message);
        }
      }

      // === CLEANUP UNTUK SEMUA ERROR CASES ===
      // Hapus message "Memproses..." setelah hasil terkirim
      try {
        await bot.deleteMessage(chatId, processingMsg.message_id);
      } catch (e) {
        // Ignore delete error
      }

      stateBekasan.delete(chatId);

      // Auto restore menu setelah transaksi gagal (sama seperti create.js)
      setTimeout(async () => {
        // Hapus pesan detail paket (originalMessageId) setelah 1 detik
        if (state.originalMessageId) {
          try {
            await global.bot.deleteMessage(chatId, state.originalMessageId);
          } catch (e) {
            console.error('Error deleting original message:', e);
          }
        }
      }, 1000); // 1 detik untuk hapus detail paket
      
      setTimeout(async () => {
        try {
          const { getUserSaldo } = require('../../db');
          const saldo = await getUserSaldo(msg.from.id);
          
          // Generate uptime (simplified version)
          const formatUptime = (ms) => {
            let s = Math.floor(ms / 1000);
            const hari = Math.floor(s / 86400);
            s %= 86400;
            const jam = Math.floor(s / 3600);
            s %= 3600;
            const menit = Math.floor(s / 60);
            const detik = s % 60;
            let hasil = [];
            if (hari > 0) hasil.push(`${hari} hari`);
            if (jam > 0) hasil.push(`${jam} jam`);
            if (menit > 0) hasil.push(`${menit} menit`);
            if (detik > 0 || hasil.length === 0) hasil.push(`${detik} detik`);
            return hasil.join(' ');
          };

          const BOT_START_TIME = Date.now() - (process.uptime() * 1000);
          const uptime = formatUptime(Date.now() - BOT_START_TIME);
          
          const generateUserDetail = (userId, username, saldo, uptime) => {
            return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
                   '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
                   '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
                   '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
          };

          const detail = generateUserDetail(msg.from.id, msg.from.username, saldo, uptime);

          await global.bot.sendPhoto(chatId, './welcome.jpg', {
            caption: detail,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: generateMainKeyboard(msg.from.id) }
          }, {
            filename: 'welcome.jpg',
            contentType: 'image/jpeg'
          });
        } catch (err) {
          console.error('Error restoring main menu:', err.message);
        }
      }, 2000); // 2 detik delay untuk memberi waktu user membaca hasil
    }
  });

};

// Export setStateBekasan function
module.exports.setStateBekasan = setStateBekasan;
// == END LOCKING SYSTEM ===