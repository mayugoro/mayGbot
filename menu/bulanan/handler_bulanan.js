// akan menggunakan full api1

const axios = require('axios');
const { freezeStok, getKuotaPaket } = require('../../db');
const { normalizePhoneNumber, isValidIndonesianPhone } = require('../../utils/normalize');

const stateBulanan = new Map();

// === HELPER FUNCTION: FORMAT NOMOR TO INTERNATIONAL ===
function formatNomorToInternational(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  } else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  return cleanNomor;
}

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
      { text: '✨ PAKET LAINNYA ✨', callback_data: 'paket_lainnya' }
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
    
    await setStateBulanan(nextUser.chatId, {
      nomor_hp,
      paket: nextUser.paket,
      step: 'pilih_slot',
      userId: nextUser.userId,
      originalMessageId: nextUser.originalMessageId,  // ✅ Restore originalMessageId dari queue
      loadingMessageId: loadingMsg ? loadingMsg.message_id : null,  // ✅ Pass loading message ID
      attemptedPengelola: nextUser.attemptedPengelola || []  // ✅ Restore attempted list dari queue
    });
  }, 1000);
};

// === HELPER FUNCTION: CARI NOMOR PENGELOLA KOSONG ===
const findAvailablePengelola = async (excludeNumbers = [], paket) => {
  try {
    // Ambil list semua nomor pengelola dari database
    const { getAllPengelolaNumbers } = require('../../db');
    const allPengelola = await getAllPengelolaNumbers(paket);
    
    // Filter nomor yang tidak sedang digunakan dan tidak dalam exclude list
    const availablePengelola = allPengelola.filter(nomor => 
      !activePengelolaSessions.has(nomor) && !excludeNumbers.includes(nomor)
    );
    
    return availablePengelola.length > 0 ? availablePengelola[0] : null;
  } catch (err) {
    console.error('Error finding available pengelola:', err.message);
    return null;
  }
};

// === HELPER FUNCTION: CEK APAKAH PAKET PUNYA MULTIPLE PENGELOLA ===
const hasMultiplePengelola = async (paket) => {
  try {
    const { getAllPengelolaNumbers } = require('../../db');
    const allPengelola = await getAllPengelolaNumbers(paket);
    
    // Buat Set untuk menghilangkan duplikasi, lalu cek jumlahnya
    const uniquePengelola = new Set(allPengelola);
    return uniquePengelola.size > 1;
  } catch (err) {
    console.error('Error checking multiple pengelola:', err.message);
    return false;
  }
};

// Export function untuk set state dari list_bulanan.js
const setStateBulanan = async (chatId, state) => {
  const { nomor_hp, userId, paket, attemptedPengelola = [] } = state;
  
  // === VALIDASI SALDO SEBELUM LOCK ===
  try {
    const { getUserSaldo, getHargaPaket } = require('../../db');
    const saldoUser = await getUserSaldo(userId);
    const hargaPaket = await getHargaPaket(paket);
    
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
    // === CEK APAKAH PAKET PUNYA MULTIPLE PENGELOLA ===
    const hasMultiple = await hasMultiplePengelola(paket);
    
    if (hasMultiple) {
      // === AUTO SWITCH LOGIC (untuk paket dengan multiple pengelola) ===
      // Cari nomor pengelola lain yang kosong
      const newAttemptedList = [...attemptedPengelola, nomor_hp];
      const alternatePengelola = await findAvailablePengelola(newAttemptedList, paket);
      
      if (alternatePengelola) {
        // Found alternative! Auto switch ke pengelola lain
        const loadingMsg = await global.bot.sendMessage(chatId, 
          `🔄 <b>Pengelola ${nomor_hp.slice(-5)} sedang busy...\n` +
          `Auto switching ke pengelola ${alternatePengelola.slice(-5)}...</b>`, 
          { parse_mode: 'HTML' }
        ).catch(err => console.error('Error sending switch message:', err));
        
        // Hapus loading message sebelumnya jika ada
        if (state.loadingMessageId) {
          try {
            await global.bot.deleteMessage(chatId, state.loadingMessageId);
          } catch (e) {
            // Ignore delete error
          }
        }
        
        // Recursive call dengan pengelola baru
        setTimeout(async () => {
          // Hapus switch message
          if (loadingMsg) {
            try {
              await global.bot.deleteMessage(chatId, loadingMsg.message_id);
            } catch (e) {
              // Ignore delete error
            }
          }
          
          // Kirim loading message baru
          let newLoadingMsg;
          try {
            newLoadingMsg = await global.bot.sendMessage(chatId, 
              '📧 <b>Mengecek slot kosong... 📧</b>', 
              { parse_mode: 'HTML' }
            );
          } catch (e) {
            console.error('Error sending new loading message:', e);
          }
          
          await setStateBulanan(chatId, {
            ...state,
            nomor_hp: alternatePengelola,
            attemptedPengelola: newAttemptedList,
            loadingMessageId: newLoadingMsg ? newLoadingMsg.message_id : null
          });
        }, 1000);
        
        return; // Exit current call
      }
    }
    
    // === FALLBACK TO QUEUE SYSTEM ===
    // Jika hanya 1 pengelola ATAU semua pengelola busy, masuk ke queue system
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
      userId, chatId, paket: state.paket, timestamp: Date.now(),
      originalMessageId: state.originalMessageId,  // ✅ Simpan originalMessageId untuk queue
      attemptedPengelola: hasMultiple ? (attemptedPengelola.includes(nomor_hp) ? attemptedPengelola : [...attemptedPengelola, nomor_hp]) : []  // ✅ Simpan attempted list untuk queue jika multiple
    });
    
    const position = waitingQueues.get(nomor_hp).length;
    
    // Pesan berbeda untuk single vs multiple pengelola
    let queueMsg;
    if (hasMultiple) {
      queueMsg = `<b><i>⚠️ Semua pengelola sedang busy...\n` +
                 `Menunggu pengelola ${nomor_hp.slice(-5)}...\n` +
                 `Posisi antrian: ${position}</i></b>`;
    } else {
      queueMsg = `<b><i>⚠️ Pengelola ${nomor_hp.slice(-5)} sedang digunakan...\n` +
                 `Tunggu sebentar...!!\n` +
                 `Posisi antrian: ${position}</i></b>`;
    }
    
    const queueMessage = await global.bot.sendMessage(chatId, queueMsg, {
      parse_mode: 'HTML'
    }).catch(err => console.error('Error sending queue message:', err));
    
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
  
  stateBulanan.set(chatId, state);
  
  // Trigger cek slot kosong langsung setelah state di-set
  setTimeout(() => {
    checkSlotKosong(chatId);
  }, 1000);
};

// Function untuk cek slot kosong
const checkSlotKosong = async (chatId) => {
  const state = stateBulanan.get(chatId);
  if (!state || state.step !== 'pilih_slot') return;

  const { nomor_hp, paket, loadingMessageId, userId } = state;

  // Update session state
  const session = activePengelolaSessions.get(nomor_hp);
  if (session) {
    session.step = SESSION_STATES.SLOT_CHECKING;
    session.lastActivity = Date.now();
  }

  try {
    // === HIT API1 KHFY-Store PERTAMA ===
    const formattedNomor = formatNomorToInternational(nomor_hp);
    console.log(`📋 CEKSLOT1: Checking slot for ${nomor_hp} -> ${formattedNomor}`);
    
    const requestBody = new URLSearchParams({
      id_parent: formattedNomor,
      token: process.env.APIKEY1
    }).toString();
    
    const res = await axios.post(
      `${process.env.API1}/member_info_akrab`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    console.log(`📋 CEKSLOT1: Raw API Response:`, JSON.stringify(res.data, null, 2));
    
    let data = res.data?.data;
    let slotList = data?.member_info?.members || [];
    
    console.log(`📋 CEKSLOT1: Parsed data:`, data);
    console.log(`📋 CEKSLOT1: SlotList length:`, slotList.length);

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
            
            // Delete old loading message AFTER new message sent
            await global.bot.deleteMessage(chatId, loadingMessageId);
            
            // Update loadingMessageId untuk step berikutnya
            state.loadingMessageId = retryMsg.message_id;
            stateBulanan.set(chatId, state);
          } catch (e) {
            // Ignore send/delete error
          }
        }

        // Delay sebentar sebelum retry
        await new Promise(resolve => setTimeout(resolve, 500));

        // === HIT API1 KHFY-Store KEDUA ===
        const retryRes = await axios.post(
          `${process.env.API1}/member_info_akrab`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
          }
        );

        console.log(`📋 CEKSLOT1 RETRY: Raw API Response:`, JSON.stringify(retryRes.data, null, 2));

        // Gunakan hasil dari hit kedua
        const retryData = retryRes.data?.data;
        if (retryData) {
          data = retryData;
          slotList = retryData?.member_info?.members || [];
          console.log(`📋 CEKSLOT1 RETRY: Updated slotList length:`, slotList.length);
        }

      } catch (retryErr) {
        // Jika retry gagal, tetap gunakan hasil hit pertama
        console.log(`Retry failed for ${nomor_hp}:`, retryErr.message);
      }
    }

    // Filter slot kosong berdasarkan API1 format (msisdn kosong = slot kosong)
    console.log(`📋 CEKSLOT1: All slots:`, JSON.stringify(slotList, null, 2));
    
    // Gabungkan members dan additional_members untuk mendapatkan semua slot
    const additionalMembers = data?.member_info?.additional_members || [];
    const allSlots = [...slotList, ...additionalMembers];
    console.log(`📋 CEKSLOT1: All slots (including additional):`, allSlots.length);
    
    const kosong = allSlots.filter(s => !s.msisdn || s.msisdn === "");
    console.log(`📋 CEKSLOT1: Available slots (empty msisdn):`, kosong.length);
    console.log(`📋 CEKSLOT1: Available slots details:`, JSON.stringify(kosong, null, 2));

    if (!kosong.length) {
      // RELEASE LOCK karena tidak ada slot kosong
      releasePengelolaLock(nomor_hp, userId, 'no_slots_available');
      stateBulanan.delete(chatId);
      
      // Tambahkan info jika masih tidak ada data setelah retry
      let teksKosong = '❌ <b>Tidak ada slot kosong</b>\n\nSilakan coba lagi nanti atau pilih paket lain.';
      if ((!slotList || slotList.length === 0)) {
        teksKosong += '\n\n⚠️ <i>Data tidak tersedia setelah 2x hit API</i>';
      }
      
      if (loadingMessageId) {
        try {
          // Send new slot info message FIRST
          await global.bot.sendMessage(chatId, teksKosong, { parse_mode: 'HTML' });
          
          // Delete old loading/retry message AFTER new message sent
          await global.bot.deleteMessage(chatId, loadingMessageId);
        } catch (e) {
          // Ignore send/delete error
        }
      } else {
        await global.bot.sendMessage(chatId, teksKosong, { parse_mode: 'HTML' });
      }
      return;
    }

    // AUTO SELECT SLOT KOSONG PERTAMA (menggunakan field 'slot_id' dari API1)
    const selectedSlot = kosong[0].slot_id;
    
    // Update state dengan slot yang dipilih otomatis
    state.step = 'input_nomor';
    state.nomor_slot = selectedSlot;
    stateBulanan.set(chatId, state);

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
    if (loadingMessageId) {
      try {
        await global.bot.deleteMessage(chatId, loadingMessageId);
      } catch (e) {
        console.error('Error deleting loading message:', e);
      }
    }

    // Set timer 30 detik untuk auto cancel jika tidak ada input
    const timeoutId = setTimeout(() => {
      const currentState = stateBulanan.get(chatId);
      if (currentState && currentState.step === 'input_nomor' && currentState.nomor_slot === selectedSlot) {
        // RELEASE LOCK karena timeout
        releasePengelolaLock(nomor_hp, userId, 'input_timeout');
        stateBulanan.delete(chatId);
        
        // Kirim pesan timeout
        global.bot.sendMessage(chatId, '⌛ <b>Waktu input habis.</b>', {
          parse_mode: 'HTML'
        }).catch(err => console.error('Error sending timeout message:', err));
      }
    }, 30000); // 30 detik

    // Simpan timeoutId ke state untuk bisa dibatalkan nanti
    state.timeoutId = timeoutId;
    stateBulanan.set(chatId, state);

  } catch (err) {
    console.error(`Error checking slot kosong: ${err.message}`);
    
    // RELEASE LOCK karena API error
    releasePengelolaLock(nomor_hp, userId, 'api_error_slot_check');
    stateBulanan.delete(chatId);
    
    const teksError = '❌ <b>Gagal mengecek slot kosong</b>\n\nSilakan coba lagi atau hubungi admin.\n\n🔓 Nomor pengelola telah dibebaskan.';
    
    if (loadingMessageId) {
      try {
        // Send new error message FIRST
        await global.bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
        
        // Delete old loading message AFTER new message sent
        await global.bot.deleteMessage(chatId, loadingMessageId);
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
      console.log(`🧹 [BULANAN] Cleaning up stale session for ${nomor_hp.slice(-5)} - user ${session.userId}`);
      
      // Release lock untuk session yang timeout
      releasePengelolaLock(nomor_hp, session.userId, 'session_timeout');
      
      // Cleanup state juga
      stateBulanan.delete(session.chatId);
      
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

// === HELPER FUNCTION: VALIDASI NOMOR DENGAN API KMSP DOMPUL ===
const validateNomorWithDompul = async (nomorPembeli) => {
  try {
    // Format nomor ke format 08xxx seperti di dompul.js
    let formattedMsisdn = nomorPembeli.replace(/\D/g, '');
    if (formattedMsisdn.startsWith('62')) {
      formattedMsisdn = '0' + formattedMsisdn.substring(2);
    }
    if (!formattedMsisdn.startsWith('0') && formattedMsisdn.length >= 10 && formattedMsisdn.length <= 11) {
      formattedMsisdn = '0' + formattedMsisdn;
    }
    
    console.log(`🔍 DOMPUL: Validating ${nomorPembeli} -> ${formattedMsisdn}`);
    
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
      timeout: 30000 // 30 detik timeout seperti di dompul.js
    });

    console.log(`🔍 DOMPUL: Raw response:`, JSON.stringify(response.data, null, 2));

    const responseData = response.data;
    
    if (responseData && responseData.data && responseData.data.hasil) {
      // Clean up HTML tags dari hasil
      let resultText = responseData.data.hasil
        .replace(/<br>/g, '\n')
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace HTML space
        .trim();
      
      console.log(`🔍 DOMPUL: Cleaned result text:`, resultText);
      
      // Cek apakah ada keyword "akrab" dalam hasil
      const lowerResultText = resultText.toLowerCase();
      const hasAkrab = lowerResultText.includes('akrab') || 
                     lowerResultText.includes('family') ||
                     lowerResultText.includes('keluarga');
      
      if (hasAkrab) {
        console.log(`🔍 DOMPUL: ❌ VALIDATION FAILED - Akrab package found in results`);
        return {
          valid: false,
          reason: 'akrab_package_exists',
          packages: ['Detected from dompul results: akrab package exists']
        };
      } else {
        console.log(`🔍 DOMPUL: ✅ VALIDATION PASSED - No akrab packages found in results`);
        return {
          valid: true,
          reason: 'no_akrab_packages'
        };
      }
      
    } else {
      // Tidak ada hasil atau struktur tidak sesuai - anggap aman, lanjut proses
      console.log(`🔍 DOMPUL: ✅ VALIDATION PASSED - No results data found`);
      return {
        valid: true,
        reason: 'no_results_data'
      };
    }

  } catch (error) {
    console.log(`🔍 DOMPUL: ✅ VALIDATION PASSED - Error occurred, proceeding anyway:`, error.message);
    
    // Jika error dari response, cek apakah ada pesan khusus
    if (error.response && error.response.data && error.response.data.message) {
      const errorMessage = error.response.data.message.toLowerCase();
      if (errorMessage.includes('tidak memiliki paket') || errorMessage.includes('no package')) {
        return {
          valid: true,
          reason: 'no_packages_active'
        };
      }
    }
    
    // Semua error lainnya - lanjut proses tanpa validasi
    return {
      valid: true,
      reason: 'validation_error_proceed',
      error: error.message
    };
  }
};

// Jalankan cleanup setiap 1 menit
setInterval(cleanupStaleSessions, 60000);

module.exports = (bot) => {
  // Store bot instance globally
  global.bot = bot;

  // HAPUS SEMUA CALLBACK QUERY HANDLER UNTUK SLOT SELECTION
  // Karena sekarang menggunakan auto select seperti bekasan

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    const text = msg.text.trim();
    const state = stateBulanan.get(chatId);

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

    const { nomor_slot, paket } = state;
    
    // Ambil kuota dari konfigurasi admin
    const kuotaDefault = await getKuotaPaket(paket);
    const kuotaGB = kuotaDefault === '0' ? '0' : kuotaDefault; // 0 = unlimited
    
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
          `Jenis paket    : ${paket.toUpperCase()}\n` +
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
            kategori: state.paket.toUpperCase(), // Gunakan state.paket
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

        stateBulanan.delete(chatId);

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
      // === API1 KHFY-Store ADD MEMBER ===
      const formattedParent = formatNomorToInternational(nomor_hp);
      console.log(`🔄 ADD: Processing ${nomor_hp} -> ${formattedParent}, slot: ${nomor_slot}`);
      
      const requestBody = new URLSearchParams({
        id_parent: formattedParent,
        slot: nomor_slot,
        phone: normalizedNumber, // Gunakan nomor yang sudah dinormalisasi
        name: `${msg.from.username || msg.from.first_name || 'USER'} ${paket.toUpperCase()}`, // Gunakan username Telegram
        token: process.env.APIKEY1
      }).toString();
      
      const res = await axios.post(
        `${process.env.API1}/change_member_akrab_v2`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 300000 // 5 menit timeout untuk menghindari socket hang up
        }
      );

      const addExecutionTime = Math.floor((Date.now() - addStartTime) / 1000);
      
      const { getHargaPaket, getHargaGagal } = require('../../db');
      const harga = await getHargaPaket(paket);
      
      const kodePengelola = nomor_hp.slice(-5);
      const info = res.data?.data?.details || {};

      let teksHasil = '';

      if (addExecutionTime >= 8) {
        // SUKSES - RELEASE LOCK SETELAH BERHASIL
        const kuotaText = kuotaGB === '0' ? '0gb' : `${kuotaGB}gb`;
        
        // Ambil saldo user sebelum dipotong
        const { getUserSaldo } = require('../../db');
        const saldoAwal = await getUserSaldo(msg.from.id);
        const saldoAkhir = saldoAwal - harga;
        
        teksHasil = `✅ Sukses !!\n\n` +
          `<code>Detail         : Sukses bjir🗿\n` +
          `Jenis paket    : ${paket.toUpperCase()}\n` +
          `Nomor          : ${info["nomor-anggota"] || normalizedNumber}\n` +
          `Kode           : ${kodePengelola}\n` +
          `Kuota Bersama  : ${kuotaText}\n` +
          `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
          `Saldo terpotong: Rp.${harga.toLocaleString('id-ID')}\n` +
          `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
          `Waktu eksekusi : ${addExecutionTime} detik ✅</code>`;

        // Kurangi saldo SETELAH membuat output
        try {
          const { kurangiSaldo } = require('../../db');
          await kurangiSaldo(msg.from.id, harga);
        } catch (saldoErr) {
          console.error('Error mengurangi saldo:', saldoErr.message);
        }

        // HANYA catat transaksi jika SUKSES dengan user_id dan nomor normalized
        await freezeStok(paket.toUpperCase(), nomor_hp, normalizedNumber, nomor_slot, kuotaGB, msg.from.id, bot, {
          saldoSebelum: saldoAwal,
          saldoSesudah: saldoAkhir,
          harga: harga
        });

        // RELEASE LOCK karena transaksi SUKSES
        releasePengelolaLock(nomor_hp, userId, 'transaction_success');

      } else {
        // GAGAL - RELEASE LOCK karena transaksi GAGAL (< 15 detik)
        const biayaGagal = await getHargaGagal();
        
        // Ambil saldo user sebelum dipotong
        const { getUserSaldo } = require('../../db');
        const saldoAwal = await getUserSaldo(msg.from.id);
        const saldoAkhir = saldoAwal - biayaGagal;
        
        teksHasil = `❌ Gagal !!\n\n` +
          `<code>Detail         : nyangkut, ada akrab\n` +
          `Jenis paket    : ${paket.toUpperCase()}\n` +
          `Nomor          : ${normalizedNumber}\n` +
          `Kode           : -\n` +
          `Kuota Bersama  : -\n` +
          `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n` +
          `Saldo terpotong: Rp.${biayaGagal.toLocaleString('id-ID')}\n` +
          `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}\n` +
          `Waktu eksekusi : ${addExecutionTime} detik ❌</code>`;

        // Kurangi saldo SETELAH membuat output
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
            kategori: paket.toUpperCase(),
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

      // Kirim hasil FIRST, lalu hapus processing message
      await bot.sendMessage(chatId, teksHasil, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id // Reply ke message nomor user
      });

      // Hapus message "Memproses..." setelah hasil terkirim
      try {
        await bot.deleteMessage(chatId, processingMsg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      stateBulanan.delete(chatId);

      // Auto restore menu setelah transaksi (sama seperti create.js)
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

      // Auto edit kuota setelah 10 detik untuk bulanan (hanya jika SUKSES)
      if (addExecutionTime >= 15) {
        setTimeout(async () => {
          try {
            // === API1 KHFY-Store SET_KUBER ===
            const formattedParent = formatNomorToInternational(nomor_hp);
            console.log(`⚙️ SET_KUBER: Setting quota ${kuotaGB}GB for ${nomor_hp} -> ${formattedParent}, slot: ${nomor_slot}`);
            
            const requestBody = new URLSearchParams({
              id_parent: formattedParent,
              slot: nomor_slot,
              kuota: kuotaGB,
              token: process.env.APIKEY1
            }).toString();
            
            await axios.post(
              `${process.env.API1}/set_kuber_akrab`,
              requestBody,
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 60000 // 1 menit timeout untuk edit kuota
              }
            );
          } catch (err) {
            console.warn(`⚠️ Edit kuota bulanan gagal untuk ${nomor_hp} SLOT ${nomor_slot}:`, err.message);
          }
        }, 10000);
      }

  } catch (err) {
    console.error(`Error adding anggota bulanan: ${err.message}`);
    const addExecutionTime = Math.floor((Date.now() - addStartTime) / 1000);
    const { getHargaGagal } = require('../../db');
    const biayaGagal = await getHargaGagal();

    // === SPECIAL HANDLING UNTUK SOCKET HANG UP ===
    // Socket hang up biasanya berarti server masih memproses tapi client timeout
    if (err.code === 'ECONNRESET' || err.message.includes('socket hang up') || err.message.includes('timeout')) {
      console.warn(`⚠️ [SOCKET HANG UP] Possible server still processing - API ADD execution time: ${addExecutionTime}s`);
      
        // Jika execution time >= 8 detik, kemungkinan besar server berhasil memproses
        if (addExecutionTime >= 8) {
          console.log(`✅ [SOCKET HANG UP] Treating as SUCCESS due to API ADD execution time >= 8s`);        // TREAT AS SUCCESS - calculate as successful transaction
        const { getHargaPaket } = require('../../db');
        const harga = await getHargaPaket(paket);
        const kuotaText = kuotaGB === '0' ? '0gb' : `${kuotaGB}gb`;
        const kodePengelola = nomor_hp.slice(-5);
        
        // Ambil saldo user sebelum dipotong
        const { getUserSaldo } = require('../../db');
        const saldoAwal = await getUserSaldo(msg.from.id);
        const saldoAkhir = saldoAwal - harga;
        
        const teksHasilSuccess = `✅ Sukses !! (Network Timeout)\n\n` +
          `<code>Detail         : Sukses (timeout jaringan)\n` +
          `Jenis paket    : ${paket.toUpperCase()}\n` +
          `Nomor          : ${normalizedNumber}\n` +
          `Kode           : ${kodePengelola}\n` +
          `Kuota Bersama  : ${kuotaText}\n` +
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
        await freezeStok(paket.toUpperCase(), nomor_hp, normalizedNumber, nomor_slot, kuotaGB, msg.from.id, bot, {
          saldoSebelum: saldoAwal,
          saldoSesudah: saldoAkhir,
          harga: harga
        });

        // RELEASE LOCK sebagai sukses
        releasePengelolaLock(nomor_hp, userId, 'transaction_success_timeout');

        // Auto edit kuota untuk socket hang up yang dianggap sukses
        setTimeout(async () => {
          try {
            // === API1 KHFY-Store SET_KUBER ===
            const formattedParent = formatNomorToInternational(nomor_hp);
            console.log(`⚙️ SET_KUBER (hangup): Setting quota ${kuotaGB}GB for ${nomor_hp} -> ${formattedParent}, slot: ${nomor_slot}`);
            
            const requestBody = new URLSearchParams({
              id_parent: formattedParent,
              slot: nomor_slot,
              kuota: kuotaGB,
              token: process.env.APIKEY1
            }).toString();
            
            await axios.post(
              `${process.env.API1}/set_kuber_akrab`,
              requestBody,
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
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
          `Jenis paket    : ${paket.toUpperCase()}\n` +
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
            kategori: paket.toUpperCase(),
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
        `Jenis paket    : ${paket.toUpperCase()}\n` +
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
          kategori: paket.toUpperCase(),
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

    stateBulanan.delete(chatId);

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

module.exports.setStateBulanan = setStateBulanan;
// === END OF BULANAN HANDLER ===