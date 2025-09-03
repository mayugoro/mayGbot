// State management untuk session pembelian
const statePembelian = new Map();

// Set session untuk input nomor HP
function setInputSession(chatId, produkType, produkNama, messageId) {
  statePembelian.set(chatId, { 
    mode: 'input_nomor', 
    produk: produkType,
    produkNama: produkNama,
    messageId: messageId 
  });
}

// Set session untuk pilih payment dengan timeout
function setPaymentSession(chatId, produkType, produkNama, nomorHP, bot) {
  const currentTime = Date.now();
  statePembelian.set(chatId, { 
    mode: 'pilih_payment', 
    produk: produkType,
    produkNama: produkNama,
    nomorHP: nomorHP,
    timestamp: currentTime
  });

  // Set timeout 2 menit untuk auto-clear session
  setTimeout(() => {
    const state = statePembelian.get(chatId);
    if (state && state.timestamp === currentTime) {
      statePembelian.delete(chatId);
      bot.sendMessage(chatId, '⏰ Session pembayaran berakhir. Silakan mulai ulang dengan /produk').catch(e => {
        // Silent error handling
      });
    }
  }, 2 * 60 * 1000); // 2 menit
}

// Get session data
function getSession(chatId) {
  return statePembelian.get(chatId);
}

// Clear session
function clearSession(chatId) {
  statePembelian.delete(chatId);
}

// Update session dengan input message ID
function updateSessionInput(chatId, inputMessageId) {
  const currentState = statePembelian.get(chatId);
  if (currentState) {
    currentState.inputMessageId = inputMessageId;
    statePembelian.set(chatId, currentState);
  }
}

// Validate session untuk payment
function validatePaymentSession(chatId) {
  const state = statePembelian.get(chatId);
  
  if (!state) {
    return { valid: false, error: "Session tidak ditemukan. Silakan mulai ulang dengan /produk" };
  }
  
  if (state.mode !== 'pilih_payment') {
    return { valid: false, error: "Session tidak valid. Silakan mulai ulang dengan /produk" };
  }

  // Check session timeout (2 menit = 120000ms)
  const currentTime = Date.now();
  const sessionAge = currentTime - state.timestamp;
  if (sessionAge > 2 * 60 * 1000) {
    statePembelian.delete(chatId);
    return { valid: false, error: "Session timeout" };
  }

  return { valid: true, state: state };
}

// Update session dengan input message ID
function updateInputMessageId(chatId, inputMessageId) {
  const currentState = statePembelian.get(chatId);
  if (currentState) {
    currentState.inputMessageId = inputMessageId;
    statePembelian.set(chatId, currentState);
  }
}

// Handle input nomor HP
async function handleInput(chatId, text, bot, payment) {
  const state = getSession(chatId);
  if (!state || state.mode !== 'input_nomor') return;

  // Cek batal
  if (['batal', 'BATAL', 'Batal'].includes(text)) {
    try {
      if (state.inputMessageId) {
        await bot.deleteMessage(chatId, state.inputMessageId);
      }
      clearSession(chatId);
      await bot.sendMessage(chatId, '❌ Pembelian dibatalkan');
    } catch (e) {
      console.error('Error canceling purchase:', e);
    }
    return;
  }

  // Validasi nomor HP menggunakan handler messages
  const messages = require('./messages');
  const validation = messages.validatePhoneNumber(text);
  
  if (!validation.isValid) {
    try {
      const errorMsg = validation.errorMessage || 'Format nomor HP tidak valid';
      await bot.sendMessage(chatId, `❌ ${errorMsg}. Contoh: 08123456789`);
    } catch (e) {
      console.error('Error sending validation message:', e);
    }
    return;
  }

  try {
    // Hapus pesan input form
    if (state.inputMessageId) {
      await bot.deleteMessage(chatId, state.inputMessageId);
    }

    // Tampilkan pilihan metode pembayaran dengan nomor yang sudah divalidasi
    await showPaymentSelection(chatId, validation.cleanNumber, state.produk, state.produkNama, bot);
    
  } catch (error) {
    console.error('Error processing phone input:', error);
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses nomor HP');
  }

  clearSession(chatId);
}

// Function untuk menampilkan pilihan metode pembayaran
async function showPaymentSelection(chatId, nomorHP, produkType, produkNama, bot) {
  const products = require('./products');
  const produkInfo = products.getProductInfo(produkType);
  
  if (!produkInfo) {
    throw new Error('Produk tidak ditemukan');
  }

  // Ambil metode pembayaran yang tersedia untuk produk ini
  const paymentMethods = produkInfo.payment.split(', ');
  
  // Format pesan pilihan metode pembayaran
  let paymentText = `💳 <b>PILIH METODE PEMBAYARAN</b>\n\n`;
  paymentText += `📦 Produk: <b>${produkNama}</b>\n`;
  paymentText += `📱 Nomor HP: <code>${nomorHP}</code>\n`;
  paymentText += `💰 Harga: ${produkInfo.harga}\n\n`;
  paymentText += `💡 Pilih metode pembayaran:`;

  // Buat tombol untuk setiap metode pembayaran
  const paymentKeyboard = [];
  const buttonsPerRow = 2;
  
  for (let i = 0; i < paymentMethods.length; i += buttonsPerRow) {
    const row = [];
    for (let j = i; j < i + buttonsPerRow && j < paymentMethods.length; j++) {
      const method = paymentMethods[j].trim();
      let emoji = "";
      switch (method) {
        case "dana": emoji = "💙"; break;
        case "shopee": emoji = "🧡"; break;
        case "gopay": emoji = "💚"; break;
        case "pulsa": emoji = "📱"; break;
        case "qris": emoji = "📱"; break;
        default: emoji = "💳"; break;
      }
      row.push({
        text: `${emoji} ${method.toUpperCase()}`,
        callback_data: `payment_${produkType}_${method}_${nomorHP}`
      });
    }
    paymentKeyboard.push(row);
  }
  
  // Tambah tombol kembali
  paymentKeyboard.push([
  { text: "🔙 KEMBALI", callback_data: "back_to_menu" }
  ]);

  // Kirim message pilihan pembayaran
  await bot.sendMessage(chatId, paymentText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: paymentKeyboard
    }
  });
}

module.exports = {
  setInputSession,
  setPaymentSession,
  getSession,
  clearSession,
  updateSessionInput,
  updateInputMessageId,
  validatePaymentSession,
  handleInput
};
