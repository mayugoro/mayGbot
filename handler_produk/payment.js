const QRCode = require('qrcode');
const { PRODUCT_INFO } = require('./products');
const { kurangiSaldo, getUserSaldo } = require('../db');

// Function untuk mendapatkan harga retail berdasarkan nama produk
function getRetailPrice(namaProduk) {
  const productEntry = Object.values(PRODUCT_INFO).find(product => 
    product.nama === namaProduk
  );
  return productEntry ? productEntry.harga : 'Rp N/A';
}

// Function untuk mendapatkan harga retail dalam bentuk angka (untuk pemotongan saldo)
function getRetailPriceNumber(namaProduk) {
  const productEntry = Object.values(PRODUCT_INFO).find(product => 
    product.nama === namaProduk
  );
  if (productEntry && productEntry.harga) {
    // Extract number dari string seperti "Rp 500" menjadi 500
    const price = productEntry.harga.replace(/[^\d]/g, '');
    return parseInt(price) || 0;
  }
  return 0;
}

// Function untuk generate QR Code
async function generateQRCode(qrCodeString) {
  try {
    const qrCodeBuffer = await QRCode.toBuffer(qrCodeString, {
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeBuffer;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Fungsi untuk menampilkan pilihan metode pembayaran (SMART SELECTOR)
async function showPaymentOptions(chatId, nomorHP, produkType, produkNama, bot) {
  try {
    const products = require('./products');
    
    // Get product info untuk mengambil payment methods yang didukung
    const productInfo = products.getProductInfo(produkType);
    
    if (!productInfo || !productInfo.payment) {
      throw new Error('Informasi pembayaran produk tidak ditemukan');
    }
    
    // Parse payment methods dari string (contoh: "dana, shopee, gopay, qris, pulsa")
    const supportedPayments = productInfo.payment
      .split(',')
      .map(method => method.trim().toLowerCase())
      .filter(method => method.length > 0);
    
    // Mapping emoji dan display name untuk setiap payment method
    const paymentConfig = {
      'dana': { emoji: '💙', display: 'DANA', callback: 'dana' },
      'gopay': { emoji: '�', display: 'GoPay', callback: 'gopay' },
      'shopee': { emoji: '🧡', display: 'ShopeePay', callback: 'shopeepay' },
      'shopeepay': { emoji: '🧡', display: 'ShopeePay', callback: 'shopeepay' },
      'qris': { emoji: '📱', display: 'QRIS', callback: 'qris' },
      'pulsa': { emoji: '📞', display: 'Pulsa', callback: 'pulsa' },
      'ovo': { emoji: '💜', display: 'OVO', callback: 'ovo' },
      'linkaja': { emoji: '❤️', display: 'LinkAja', callback: 'linkaja' }
    };
    
    // Generate keyboard dinamis berdasarkan payment methods yang didukung
    const paymentKeyboard = [];
    const buttonsPerRow = 2;
    
    // Group payment methods in rows of 2
    for (let i = 0; i < supportedPayments.length; i += buttonsPerRow) {
      const row = [];
      
      for (let j = i; j < Math.min(i + buttonsPerRow, supportedPayments.length); j++) {
        const method = supportedPayments[j];
        const config = paymentConfig[method];
        
        if (config) {
          row.push({
            text: `${config.emoji} ${config.display}`,
            callback_data: `pay_${config.callback}_${produkType}_${nomorHP}`
          });
        } else {
          // Fallback untuk payment method yang belum terdefinisi
          const displayMethod = method.charAt(0).toUpperCase() + method.slice(1);
          row.push({
            text: `� ${displayMethod}`,
            callback_data: `pay_${method}_${produkType}_${nomorHP}`
          });
        }
      }
      
      if (row.length > 0) {
        paymentKeyboard.push(row);
      }
    }
    
    // Add back button
    paymentKeyboard.push([{
      text: "🔙 Kembali",
      callback_data: "back_to_menu"
    }]);

    // Create message text with dynamic payment info
    const paymentText = `💳 <b>PILIH METODE PEMBAYARAN</b>\n\n`;
    const productText = `📦 Produk: ${produkNama}\n`;
    const phoneText = `📱 Nomor: ${nomorHP}\n`;
    const supportedText = `💳 Metode tersedia: ${supportedPayments.length} opsi\n\n`;
    const instructionText = `👆 Pilih metode pembayaran yang Anda inginkan:`;

    await bot.sendMessage(chatId, paymentText + productText + phoneText + supportedText + instructionText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: paymentKeyboard
      }
    });

  } catch (error) {
    console.error('Error showing payment options:', error);
    
    // Fallback ke static keyboard jika ada error
    const fallbackKeyboard = [
      [
        { text: "💙 DANA", callback_data: `pay_dana_${produkType}_${nomorHP}` },
        { text: "💚 GoPay", callback_data: `pay_gopay_${produkType}_${nomorHP}` }
      ],
      [
        { text: "🧡 ShopeePay", callback_data: `pay_shopeepay_${produkType}_${nomorHP}` },
        { text: "📱 QRIS", callback_data: `pay_qris_${produkType}_${nomorHP}` }
      ],
      [
        { text: "📞 Pulsa", callback_data: `pay_pulsa_${produkType}_${nomorHP}` }
      ],
      [
        { text: "🔙 Kembali", callback_data: "back_to_menu" }
      ]
    ];
    
    await bot.sendMessage(chatId, `💳 <b>PILIH METODE PEMBAYARAN</b>\n\n📦 Produk: ${produkNama}\n📱 Nomor: ${nomorHP}\n\n⚠️ Menggunakan opsi default\n👆 Pilih metode pembayaran:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: fallbackKeyboard
      }
    });
  }
}

// Function untuk proses pembelian dengan nomor HP yang sudah ada
async function processPurchaseWithPhone(chatId, produkType, paymentMethod, nomorHP, bot, userId) {
  let loadingMsg = null;

  try {
    // Normalize payment method untuk konsistensi UI (tapi jangan ubah untuk API)
    let displayPaymentMethod = paymentMethod;
    if (paymentMethod === 'shopee') {
      displayPaymentMethod = 'shopeepay'; // Untuk UI display dan logic handling
    }
    
    // Kirim status loading
    loadingMsg = await bot.sendMessage(chatId, '⏳ Memproses pembelian...');

    // Import products untuk mapping API data
    const products = require('./products');
    const api = require('./api');
    
    // Get API mapping untuk produk
    const apiData = products.getAPIMapping(produkType);
    if (!apiData) {
      throw new Error('Mapping produk tidak ditemukan');
    }

    // === VALIDASI SALDO SEBELUM PROSES ===
    try {
      const saldoUser = await getUserSaldo(userId);
      const hargaProduk = getRetailPriceNumber(apiData.nama_paket);
      
      if (saldoUser < hargaProduk) {
        // Saldo tidak cukup, kirim alert dan return
        if (loadingMsg) {
          await bot.deleteMessage(chatId, loadingMsg.message_id);
        }
        await bot.sendMessage(chatId, `❗<b>Saldo tidak cukup untuk membeli produk!</b>\n\n💰 Saldo Anda: Rp ${saldoUser.toLocaleString('id-ID')}\n💸 Harga produk: ${getRetailPrice(apiData.nama_paket)}`, {
          parse_mode: 'HTML'
        });
        return;
      }
    } catch (saldoErr) {
      console.error('Error checking balance:', saldoErr.message);
      if (loadingMsg) {
        await bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await bot.sendMessage(chatId, '❌ <b>Gagal memverifikasi saldo</b>\n\nSilakan coba lagi atau hubungi admin.', {
        parse_mode: 'HTML'
      });
      return;
    }

    // Set payment method
    apiData.payment = paymentMethod;

    // Hit API pembelian
    const result = await api.processPurchase(nomorHP, apiData, paymentMethod);

    // Format response berdasarkan hasil API dan payment method
    let resultText = `🛒 <b>HASIL PEMBELIAN</b>\n\n`;
    resultText += `📦 Produk: ${apiData.nama_paket}\n`;
    resultText += `📱 Nomor: ${nomorHP}\n`;
    resultText += `💳 Payment: ${displayPaymentMethod.toUpperCase()}\n\n`;

    let inlineKeyboard = null;

    if (result.status === 'success') {
      // Extract informasi penting
      const transactionData = result.data?.data;
      let isTransactionComplete = false;
      let paymentProcessed = false;

      // Handle berdasarkan payment method dan validasi keberhasilan
      if (displayPaymentMethod === 'dana') {
        let deeplink = result.data?.data?.data?.deeplink || result.data?.data?.deeplink || result.data?.deeplink || result.deeplink;
        
        if (deeplink) {
          paymentProcessed = true;
          
          // Get saldo info
          try {
            const retailPrice = getRetailPriceNumber(apiData.nama_paket);
            const saldoAwal = await getUserSaldo(userId);
            await kurangiSaldo(userId, retailPrice);
            const saldoAkhir = await getUserSaldo(userId);
            
            // Format output simpel seperti pulsa
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n`;
            resultText += `Saldo terpotong: Rp.${retailPrice.toLocaleString('id-ID')}\n`;
            resultText += `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}</code>\n\n`;
            resultText += `💙 <b>Klik tombol DANA untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
            
          } catch (saldoError) {
            console.error('Error managing user balance:', saldoError);
            // Fallback tanpa info saldo
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Status         : Pembayaran berhasil diproses</code>\n\n`;
            resultText += `💙 <b>Klik tombol DANA untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
          }
          
          inlineKeyboard = [
            [{ text: "💙 Buka DANA", url: deeplink }]
          ];
        } else {
          resultText += `❌ <b>GAGAL!</b>\n\n`;
          resultText += `💙 <b>DANA PAYMENT ERROR</b>\n`;
          resultText += `⚠️ Deeplink tidak tersedia. Silakan coba lagi atau gunakan metode lain.\n`;
        }
        
      } else if (displayPaymentMethod === 'gopay') {
        let deeplink = result.data?.data?.data?.deeplink || result.data?.data?.deeplink || result.data?.deeplink || result.deeplink;
        
        if (deeplink) {
          paymentProcessed = true;
          
          // Get saldo info
          try {
            const retailPrice = getRetailPriceNumber(apiData.nama_paket);
            const saldoAwal = await getUserSaldo(userId);
            await kurangiSaldo(userId, retailPrice);
            const saldoAkhir = await getUserSaldo(userId);
            
            // Format output simpel seperti pulsa
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n`;
            resultText += `Saldo terpotong: Rp.${retailPrice.toLocaleString('id-ID')}\n`;
            resultText += `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}</code>\n\n`;
            resultText += `� <b>Klik tombol GoPay untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
            
          } catch (saldoError) {
            console.error('Error managing user balance:', saldoError);
            // Fallback tanpa info saldo
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Status         : Pembayaran berhasil diproses</code>\n\n`;
            resultText += `💚 <b>Klik tombol GoPay untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
          }
          
          inlineKeyboard = [
            [{ text: "💚 Buka GoPay", url: deeplink }]
          ];
        } else {
          resultText += `❌ <b>GAGAL!</b>\n\n`;
          resultText += `💚 <b>GOPAY PAYMENT ERROR</b>\n`;
          resultText += `⚠️ Deeplink tidak tersedia. Silakan coba lagi atau gunakan metode lain.\n`;
        }
        
      } else if (displayPaymentMethod === 'shopeepay') {
        // ShopeePay dengan path deeplink khusus: result.data.data.data.deeplink
        let deeplink = null;
        let shopeepayStatus = 'unknown';
        
        // Check deeplink dengan prioritas result.data.data.data.deeplink
        if (result.data?.data?.data?.deeplink) {
          deeplink = result.data.data.data.deeplink;
          shopeepayStatus = 'deeplink_found';
        } else {
          shopeepayStatus = 'no_deeplink';
        }
        
        if (deeplink) {
          paymentProcessed = true;
          
          // Get saldo info
          try {
            const retailPrice = getRetailPriceNumber(apiData.nama_paket);
            const saldoAwal = await getUserSaldo(userId);
            await kurangiSaldo(userId, retailPrice);
            const saldoAkhir = await getUserSaldo(userId);
            
            // Format output simpel seperti pulsa
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n`;
            resultText += `Saldo terpotong: Rp.${retailPrice.toLocaleString('id-ID')}\n`;
            resultText += `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}</code>\n\n`;
            resultText += `🧡 <b>Klik tombol ShopeePay untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
            
          } catch (saldoError) {
            console.error('Error managing user balance:', saldoError);
            // Fallback tanpa info saldo
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Status         : Pembayaran berhasil diproses</code>\n\n`;
            resultText += `🧡 <b>Klik tombol ShopeePay untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
          }
          
          inlineKeyboard = [
            [{ text: "🧡 Buka ShopeePay", url: deeplink }]
          ];
        } else {
          resultText += `❌ <b>GAGAL!</b>\n\n`;
          resultText += `🧡 <b>SHOPEEPAY PAYMENT ERROR</b>\n`;
          resultText += `⚠️ Deeplink ShopeePay tidak ditemukan.\n`;
          resultText += `📱 Silakan coba dengan metode lain atau hubungi admin.\n`;
          resultText += `💡 <i>Alternatif: Gunakan DANA atau GoPay untuk pembayaran yang lebih stabil</i>`;
        }
        
      } else if (displayPaymentMethod === 'qris') {
        // Cari parameter QR dari berbagai kemungkinan field di response
        let qrString = null;
        
        // Cek berbagai kemungkinan field yang mengandung QR string
        if (result.qr_code) {
          qrString = result.qr_code;
        } else if (result.data?.qr_code) {
          qrString = result.data.qr_code;
        } else if (result.data?.data?.qr_code) {
          qrString = result.data.data.qr_code;
        } else if (result.data?.data?.qr_string) {
          qrString = result.data.data.qr_string;
        } else if (result.data?.qr_string) {
          qrString = result.data.qr_string;
        } else if (result.qr_string) {
          qrString = result.qr_string;
        } else {
          // Cari field yang mengandung kata 'qr' (case insensitive)
          const findQRField = (obj, path = '') => {
            for (const [key, value] of Object.entries(obj)) {
              if (typeof value === 'string' && key.toLowerCase().includes('qr') && value.length > 10) {
                return value;
              } else if (typeof value === 'object' && value !== null) {
                const found = findQRField(value, `${path}.${key}`);
                if (found) return found;
              }
            }
            return null;
          };
          
          qrString = findQRField(result);
        }

        if (qrString) {
          paymentProcessed = true;
          
          // Generate QR code dan kirim langsung dengan caption lengkap
          try {
            const qrCodeBuffer = await generateQRCode(qrString);
            
            // Potong saldo setelah QR berhasil di-generate
            try {
              const retailPrice = getRetailPriceNumber(apiData.nama_paket);
              if (retailPrice > 0) {
                const saldoAwal = await getUserSaldo(userId);
                await kurangiSaldo(userId, retailPrice);
                const saldoAkhir = await getUserSaldo(userId);
                
                // Format output simpel seperti pulsa dan e-wallet
                let qrCaption = `✅ <b>Sukses !!</b>\n\n`;
                qrCaption += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
                qrCaption += `Nomor          : ${nomorHP}\n`;
                qrCaption += `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n`;
                qrCaption += `Saldo terpotong: Rp.${retailPrice.toLocaleString('id-ID')}\n`;
                qrCaption += `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}</code>\n\n`;
                qrCaption += `📱 <b>Scan QR Code untuk menyelesaikan pembayaran</b>\n`;
                qrCaption += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;

                // Hapus loading message dan kirim QR dengan caption lengkap
                await bot.deleteMessage(chatId, loadingMsg.message_id);
                
                await bot.sendPhoto(chatId, qrCodeBuffer, {
                  caption: qrCaption,
                  parse_mode: 'HTML'
                });
                
                return;
              }
            } catch (saldoError) {
              console.error('Error managing user balance:', saldoError);
              // Lanjutkan dengan QR tanpa info saldo
            }
            
            // Fallback jika ada masalah dengan saldo
            let qrCaption = `Nomor : ${nomorHP}\n`;
            qrCaption += `Produk : ${apiData.nama_paket}\n`;
            const harga = getRetailPrice(apiData.nama_paket);
            qrCaption += `Harga : ${harga}\n\n`;
            qrCaption += `*berlaku 10 menit`;

            await bot.deleteMessage(chatId, loadingMsg.message_id);
            
            await bot.sendPhoto(chatId, qrCodeBuffer, {
              caption: qrCaption,
              parse_mode: 'HTML'
            });
            
            return;
            
          } catch (qrError) {
            console.error('❌ Error generating QR code image:', qrError);
            
            // QR gagal di-generate, jangan potong saldo
            resultText += `❌ <b>GAGAL!</b>\n\n`;
            resultText += `❌ <b>QRIS PAYMENT ERROR</b>\n`;
            resultText += `🚫 Gagal membuat QR Code\n`;
            resultText += `📋 Silakan hubungi admin atau coba metode pembayaran lain`;
          }
          
        } else {
          resultText += `❌ <b>GAGAL!</b>\n\n`;
          resultText += `❌ <b>QRIS PAYMENT ERROR</b>\n`;
          resultText += `🚫 QR Code tidak ditemukan dalam response API\n`;
          resultText += `📋 Silakan hubungi admin atau coba metode pembayaran lain`;
        }
        
      } else if (displayPaymentMethod === 'pulsa') {
        // PULSA PAYMENT - Format output khusus dengan validasi status yang lebih ketat
        
        // Cek status transaksi pulsa lebih detail
        let isPulsaSuccess = false;
        let errorMessage = 'Transaksi gagal';
        
        // Cek berbagai kemungkinan field status
        if (result.status === 'success' && 
            result.data && 
            result.data.data &&
            result.data.data.status &&
            (result.data.data.status.toLowerCase() === 'success' || 
             result.data.data.status.toLowerCase() === 'sukses' ||
             result.data.data.status.toLowerCase() === 'completed')) {
          isPulsaSuccess = true;
        } else if (result.status === 'success' && 
                   result.data && 
                   (result.data.status === 'success' || result.data.status === 'Sukses')) {
          // Fallback ke data.status jika data.data.status tidak ada
          isPulsaSuccess = true;
        } else {
          // Extract error message dari berbagai kemungkinan field, prioritas data.data.message
          let rawErrorMessage = 'Transaksi gagal';
          
          if (result.data && result.data.data && result.data.data.message) {
            rawErrorMessage = result.data.data.message;
          } else if (result.data && result.data.message) {
            rawErrorMessage = result.data.message;
          } else if (result.message) {
            rawErrorMessage = result.message;
          } else if (result.error) {
            rawErrorMessage = result.error;
          } else if (result.data && result.data.error) {
            rawErrorMessage = result.data.error;
          }
          
          // Mapping error messages untuk user-friendly display
          if (rawErrorMessage.toLowerCase().includes('balance_insufficient') || 
              rawErrorMessage.toLowerCase().includes('insufficient balance')) {
            errorMessage = 'Pulsa tidak mencukupi';
          } else if (rawErrorMessage.toLowerCase().includes('invalid number') || 
                     rawErrorMessage.toLowerCase().includes('nomor tidak valid')) {
            errorMessage = 'Nomor tidak valid';
          } else if (rawErrorMessage.toLowerCase().includes('provider error') || 
                     rawErrorMessage.toLowerCase().includes('operator error')) {
            errorMessage = 'Provider sedang bermasalah';
          } else if (rawErrorMessage.toLowerCase().includes('timeout')) {
            errorMessage = 'Koneksi timeout, coba lagi';
          } else if (rawErrorMessage.toLowerCase().includes('failed') || 
                     rawErrorMessage.toLowerCase().includes('gagal')) {
            errorMessage = 'Transaksi gagal';
          } else {
            // Gunakan pesan asli jika tidak ada mapping
            errorMessage = rawErrorMessage;
          }
        }
        
        if (isPulsaSuccess) {
          paymentProcessed = true;
          
          // Get saldo info
          try {
            const retailPrice = getRetailPriceNumber(apiData.nama_paket);
            const saldoAwal = await getUserSaldo(userId);
            await kurangiSaldo(userId, retailPrice);
            const saldoAkhir = await getUserSaldo(userId);
            
            // Format output sesuai permintaan
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n`;
            resultText += `Saldo terpotong: Rp.${retailPrice.toLocaleString('id-ID')}\n`;
            resultText += `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}</code>`;
            
          } catch (saldoError) {
            console.error('Error managing user balance:', saldoError);
            // Fallback tanpa info saldo
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Status         : Pembayaran berhasil diproses</code>`;
          }
        } else {
          // PULSA GAGAL - JANGAN potong saldo
          resultText = `❌ <b>Gagal !!</b>\n\n`;
          resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
          resultText += `Nomor          : ${nomorHP}\n`;
          resultText += `Error          : ${errorMessage}\n`;
          resultText += `Status         : Saldo tidak terpotong</code>`;
        }
        
      } else if (displayPaymentMethod === 'ovo') {
        let deeplink = result.data?.data?.data?.deeplink || result.data?.data?.deeplink || result.data?.deeplink || result.deeplink;
        
        if (deeplink) {
          paymentProcessed = true;
          
          // Get saldo info
          try {
            const retailPrice = getRetailPriceNumber(apiData.nama_paket);
            const saldoAwal = await getUserSaldo(userId);
            await kurangiSaldo(userId, retailPrice);
            const saldoAkhir = await getUserSaldo(userId);
            
            // Format output simpel seperti pulsa
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n`;
            resultText += `Saldo terpotong: Rp.${retailPrice.toLocaleString('id-ID')}\n`;
            resultText += `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}</code>\n\n`;
            resultText += `💜 <b>Klik tombol OVO untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
            
          } catch (saldoError) {
            console.error('Error managing user balance:', saldoError);
            // Fallback tanpa info saldo
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Status         : Pembayaran berhasil diproses</code>\n\n`;
            resultText += `💜 <b>Klik tombol OVO untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
          }
          
          inlineKeyboard = [
            [{ text: "💜 Buka OVO", url: deeplink }]
          ];
        } else {
          resultText += `❌ <b>GAGAL!</b>\n\n`;
          resultText += `💜 <b>OVO PAYMENT ERROR</b>\n`;
          resultText += `⚠️ Deeplink tidak tersedia. Silakan coba lagi atau gunakan metode lain.\n`;
        }
        
      } else if (displayPaymentMethod === 'linkaja') {
        let deeplink = result.data?.data?.data?.deeplink || result.data?.data?.deeplink || result.data?.deeplink || result.deeplink;
        
        if (deeplink) {
          paymentProcessed = true;
          
          // Get saldo info
          try {
            const retailPrice = getRetailPriceNumber(apiData.nama_paket);
            const saldoAwal = await getUserSaldo(userId);
            await kurangiSaldo(userId, retailPrice);
            const saldoAkhir = await getUserSaldo(userId);
            
            // Format output simpel seperti pulsa
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Saldo awal     : Rp.${saldoAwal.toLocaleString('id-ID')}\n`;
            resultText += `Saldo terpotong: Rp.${retailPrice.toLocaleString('id-ID')}\n`;
            resultText += `Saldo akhir    : Rp.${saldoAkhir.toLocaleString('id-ID')}</code>\n\n`;
            resultText += `❤️ <b>Klik tombol LinkAja untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
            
          } catch (saldoError) {
            console.error('Error managing user balance:', saldoError);
            // Fallback tanpa info saldo
            resultText = `✅ <b>Sukses !!</b>\n\n`;
            resultText += `<code>Jenis paket    : ${apiData.nama_paket.toUpperCase()}\n`;
            resultText += `Nomor          : ${nomorHP}\n`;
            resultText += `Status         : Pembayaran berhasil diproses</code>\n\n`;
            resultText += `❤️ <b>Klik tombol LinkAja untuk menyelesaikan pembayaran</b>\n`;
            resultText += `⏰ <i>Harap selesaikan dalam 10 menit</i>`;
          }
          
          inlineKeyboard = [
            [{ text: "❤️ Buka LinkAja", url: deeplink }]
          ];
        } else {
          resultText += `❌ <b>GAGAL!</b>\n\n`;
          resultText += `❤️ <b>LINKAJA PAYMENT ERROR</b>\n`;
          resultText += `⚠️ Deeplink tidak tersedia. Silakan coba lagi atau gunakan metode lain.\n`;
        }
        
      } else {
        // Fallback untuk payment method lain
        paymentProcessed = true;
        resultText += `✅ <b>BERHASIL!</b>\n\n`;
        resultText += `💳 <b>${displayPaymentMethod.toUpperCase()} PAYMENT</b>\n`;
        resultText += `📋 <b>Informasi Pembayaran:</b>\n`;
        if (transactionData?.details && transactionData.details.length > 0) {
          transactionData.details.forEach(detail => {
            resultText += `• ${detail.name}: Rp ${detail.amount?.toLocaleString('id-ID')}\n`;
          });
        } else {
          resultText += `✅ Pembayaran menggunakan ${displayPaymentMethod.toUpperCase()} berhasil diproses.\n`;
          resultText += `📋 Paket akan aktif dalam 1-5 menit.`;
        }
      }

      // Potong saldo hanya jika pembayaran berhasil diproses untuk QRIS (pulsa dan e-wallet sudah ditangani di atas)
      if (paymentProcessed && displayPaymentMethod === 'qris') {
        // QRIS sudah ditangani langsung dengan photo caption
        // Tidak perlu handling tambahan di sini
      }

    } else {
      resultText += `❌ <b>GAGAL!</b>\n\n`;
      resultText += `🚫 Error: ${result.message || 'Tidak diketahui'}\n`;
      if (result.data?.message) {
        resultText += `📋 Detail: ${result.data.message}`;
      }
    }

    // Update loading message dengan hasil yang clean
    const messageOptions = {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      parse_mode: 'HTML'
    };

    if (inlineKeyboard) {
      messageOptions.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    await bot.editMessageText(resultText, messageOptions);

  } catch (error) {
    console.error('Error in processPurchaseWithPhone:', error);
    
    const errorMsg = error.response?.data?.message || error.message || 'Terjadi kesalahan';
    const errorText = `❌ <b>GAGAL PEMBELIAN</b>\n\n🚫 Error: ${errorMsg}`;
    
    if (loadingMsg) {
      try {
        await bot.editMessageText(errorText, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: 'HTML'
        });
      } catch (e) {
        await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });
      }
    } else {
      await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });
    }
  }
}

module.exports = {
  generateQRCode,
  showPaymentOptions,
  processPurchaseWithPhone
};
