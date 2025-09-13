/**
 * 🚪 EXITER UTILITY - Comprehensive Exit Flow Management System
 * ================================================================
 * 
 * Utilitas lengkap untuk mengelola berbagai pattern exit flow yang konsisten
 * dan smooth di seluruh bot dengan bug-free implementation.
 * 
 * 🎯 SUPPORTED EXITER PATTERNS:
 * 
 * 1️⃣ VIEW EXITER (exiter biasa)
 *    └── Untuk tampilan read-only (config, laporan, view-only content)
 *    └── Flow: Display → Exit
 *    └── Usage: Lihat konfigurasi, tampilan data, dll.
 * 
 * 2️⃣ INPUT EXITER
 *    └── Untuk single-step input collection
 *    └── Flow: Input Request → User Input/Exit → Result
 *    └── Usage: Delete item, single form input, dll.
 * 
 * 3️⃣ STEP EXITER (step-by-step exiter)
 *    └── Untuk multi-step input flows
 *    └── Flow: Step 1 → Step 2 → Step N → Result
 *    └── Usage: Multi-form input, wizard-like flows, dll.
 * 
 * 💫 FEATURES:
 * ✅ 13 comprehensive exit keywords (exit, keluar, batal, c, x + variations)
 * ✅ Smooth auto-delete dengan delay untuk UX profesional
 * ✅ Styled input messages dengan italic formatting
 * ✅ Built-in error handling untuk semua delete operations
 * ✅ Centralized logic untuk consistency dan maintainability
 */

/**
 * 🔧 CORE EXIT FLOW HANDLER (untuk manual implementation)
 * =======================================================
 * Legacy function untuk backward compatibility.
 * Disarankan menggunakan pattern-specific functions di bawah.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {Object} msg - Message object dari Telegram  
 * @param {Map} stateMap - Map untuk tracking state (contoh: adminState)
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Array} exitKeywords - Array kata kunci exit (default: manual keywords)
 * @returns {boolean} true jika exit berhasil diproses
 */
const handleExitFlow = async (bot, msg, stateMap, chatId, state, exitKeywords = ['exit', 'EXIT', 'Exit']) => {
  // Pastikan ada text message
  if (!msg.text) return false;
  
  const text = msg.text.trim();
  
  // Cek apakah input adalah exit command
  if (exitKeywords.includes(text)) {
    // Hapus result/input message jika ada dengan autoDeleteMessage (non-sequential)
    if (state.resultMessageId) {
      autoDeleteMessage(bot, chatId, state.resultMessageId, 100);
    }
    if (state.inputMessageId) {
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
    }
    
    // Hapus user message dengan delay kecil agar bersamaan
    autoDeleteMessage(bot, chatId, msg.message_id, 100);
    
    // Clear state
    stateMap.delete(chatId);
    return true; // Exit command berhasil diproses
  }
  
  return false; // Bukan exit command
};

/**
 * 🧹 INPUT CLEANUP HANDLER
 * ========================
 * Utility untuk cleanup input non-exit dalam flow mode.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {Object} msg - Message object dari Telegram
 * @param {string} chatId - Chat ID  
 * @param {boolean} keepResult - Tetap tampilkan result message (default: true)
 */
const handleNonExitInput = async (bot, msg, chatId, keepResult = true) => {
  // Untuk input lainnya, hapus message user (biarkan result tetap tampil jika keepResult = true)
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    // Ignore delete error
  }
};

/**
 * ⏰ SMART AUTO-DELETE MESSAGE
 * ============================
 * Menghapus message dengan delay untuk smooth UX.
 * Built-in error handling untuk semua delete operations.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {string} chatId - Chat ID
 * @param {number} messageId - Message ID yang akan dihapus
 * @param {number} delay - Delay dalam milliseconds (default: 1000ms)
 */
const autoDeleteMessage = async (bot, chatId, messageId, delay = 1000) => {
  setTimeout(async () => {
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (e) {
      // Ignore delete error
    }
  }, delay);
};

/**
 * 🔥 BATCH AUTO-DELETE MESSAGES  
 * ==============================
 * Menghapus multiple messages secara bersamaan untuk smooth UX.
 * Semua messages akan hilang dengan delay yang sama (simultan).
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {string} chatId - Chat ID
 * @param {Array} messageIds - Array message IDs untuk dihapus
 * @param {number} delay - Delay dalam milliseconds (default: 100ms)
 */
const autoDeleteMultipleMessages = async (bot, chatId, messageIds, delay = 100) => {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return;
  
  // Hapus semua messages dengan delay yang sama agar terlihat bersamaan
  messageIds.forEach(messageId => {
    if (messageId) {
      autoDeleteMessage(bot, chatId, messageId, delay);
    }
  });
};

/**
 * 🚪 ENHANCED EXIT HANDLER WITH AUTO-DELETE
 * ==========================================
 * Advanced exit handler dengan automatic cleanup untuk semua related messages.
 * Menggabungkan exit detection + auto-delete dalam satu function.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {Object} msg - Message object dari user
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object (dengan inputMessageId, resultMessageId, dll)
 * @param {Array} exitKeywords - Exit keywords (default: EXIT_KEYWORDS.COMBINED)
 * @returns {boolean} true jika exit berhasil diproses
 */
const handleExitWithAutoDelete = async (bot, msg, chatId, state, exitKeywords = null) => {
  if (!msg.text) return false;
  
  // Default menggunakan EXIT_KEYWORDS.COMBINED jika tidak disediakan
  const keywords = exitKeywords || module.exports.EXIT_KEYWORDS.COMBINED;
  
  if (keywords.includes(msg.text.trim())) {
    // Kumpulkan semua message IDs yang perlu dihapus
    const messagesToDelete = [msg.message_id]; // User message
    
    if (state.inputMessageId) {
      messagesToDelete.push(state.inputMessageId);
    }
    if (state.resultMessageId) {
      messagesToDelete.push(state.resultMessageId);
    }
    
    // Hapus semua messages secara bersamaan
    autoDeleteMultipleMessages(bot, chatId, messagesToDelete, 100);
    
    return true; // Exit berhasil diproses
  }
  
  return false; // Bukan exit command
};

/**
 * 📨 SMART MESSAGE SENDER WITH TRACKING
 * ====================================== 
 * Mengirim message dengan auto-tracking state dan optional auto-delete.
 * Menggabungkan send + state management + cleanup dalam satu function.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {string} chatId - Chat ID
 * @param {string} content - Content message yang akan dikirim
 * @param {Object} options - Telegram sendMessage options
 * @param {Map} stateMap - State map untuk tracking (contoh: adminState)
 * @param {Object} currentState - Current state object
 * @param {Object} originalMsg - Original message untuk auto-delete
 * @returns {Object} Sent message object
 */
const sendMessageWithTracking = async (bot, chatId, content, options, stateMap, currentState, originalMsg) => {
  // Kirim output
  const resultMsg = await bot.sendMessage(chatId, content, options);
  
  // Auto-delete command message setelah respons dikirim
  if (originalMsg) {
    autoDeleteMessage(bot, chatId, originalMsg.message_id);
  }
  
  // Update state dengan message ID untuk tracking
  if (stateMap && currentState) {
    currentState.resultMessageId = resultMsg.message_id;
    stateMap.set(chatId, currentState);
  }
  
  return resultMsg;
};

/**
 * 🔄 COMPLETE FLOW HANDLER WITH EXIT 
 * ==================================
 * Template lengkap untuk flow dengan exit functionality.
 * Handles state management, exit detection, dan cleanup automatik.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {Object} msg - Message object
 * @param {Map} stateMap - State management map (contoh: adminState)
 * @param {string} flowMode - Mode name untuk state tracking (contoh: 'lihat_konfigurasi')
 * @param {Array} exitKeywords - Custom exit keywords (optional, default: manual keywords)
 * @returns {Object} Flow control object { isExit: boolean, shouldContinue: boolean }
 */
const handleFlowWithExit = async (bot, msg, stateMap, flowMode, exitKeywords = ['exit', 'EXIT', 'Exit']) => {
  const chatId = msg.chat.id;
  const state = stateMap.get(chatId);
  
  // Jika sedang dalam flow mode yang ditentukan
  if (state && state.mode === flowMode) {
    // Handle exit flow
    const isExitCommand = await handleExitFlow(bot, msg, stateMap, chatId, state, exitKeywords);
    
    if (isExitCommand) {
      return { isExit: true, shouldContinue: false };
    }
    
    // Handle non-exit input (cleanup user message)
    await handleNonExitInput(bot, msg, chatId);
    return { isExit: false, shouldContinue: false }; // Stop processing, tapi bukan exit
  }
  
  return { isExit: false, shouldContinue: true }; // Lanjutkan processing normal
};

/**
 * 💬 EXIT INSTRUCTION GENERATOR
 * =============================
 * Generate text instruksi exit yang standard dan konsisten.
 * 
 * @param {string} exitKeyword - Kata kunci exit (default: 'exit')
 * @returns {string} Exit instruction text dengan formatting
 */
const generateExitInstruction = (exitKeyword = 'exit') => {
  return `<i>💡 Ketik "${exitKeyword}" untuk keluar dari tampilan ini</i>`;
};

/**
 * 🎨 STYLED INPUT MESSAGE GENERATOR (untuk INPUT EXITER)
 * ======================================================
 * Generate styled input message dengan italic formatting dan exit instruction.
 * Khusus digunakan untuk INPUT EXITER pattern (single-step input collection).
 * 
 * @param {string} mainText - Text utama untuk input (contoh: "📱 Masukkan nomor untuk cek pulsa")
 * @param {string} subtitle - Subtitle atau instruction tambahan (contoh: "Bisa massal, pisahkan dengan Enter.")
 * @param {string} exitText - Custom exit text (default: "membatalkan")
 * @returns {string} Styled input message dengan format italic lengkap
 */
const generateStyledInputMessage = (mainText, subtitle = '', exitText = 'membatalkan') => {
  let message = `<i>${mainText}`;
  
  if (subtitle) {
    message += `\n${subtitle}`;
  }
  
  message += `\n\n💡 Ketik "exit" untuk ${exitText}</i>`;
  
  return message;
};

/**
 * 📤 STYLED INPUT MESSAGE SENDER (untuk INPUT EXITER)
 * ===================================================
 * Mengirim styled input message dengan tracking dan exiter support.
 * Menggabungkan generateStyledInputMessage + sendMessage + tracking.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {string} chatId - Chat ID
 * @param {string} mainText - Text utama untuk input
 * @param {string} subtitle - Subtitle atau instruction tambahan  
 * @param {string} exitText - Custom exit text (default: "membatalkan")
 * @param {Object} options - Additional send message options
 * @returns {Object} Sent message object
 */
const sendStyledInputMessage = async (bot, chatId, mainText, subtitle = '', exitText = 'membatalkan', options = {}) => {
  const styledMessage = generateStyledInputMessage(mainText, subtitle, exitText);
  
  const defaultOptions = { parse_mode: 'HTML' };
  const finalOptions = { ...defaultOptions, ...options };
  
  return await sendMessageWithTracking(bot, chatId, styledMessage, finalOptions);
};

/**
 * 🔄 STEP-BY-STEP EXIT HANDLER (untuk STEP EXITER)
 * =================================================
 * Handle exit untuk step-by-step flow tanpa mengganggu logika flow.
 * Fungsi ini digunakan di dalam setiap step, bukan di awal handler.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {Object} msg - Message object dari user
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Map} stateMap - State management map (contoh: adminState)
 * @param {Array} exitKeywords - Exit keywords (default: EXIT_KEYWORDS.COMBINED)
 * @returns {boolean} true jika exit berhasil diproses, false jika bukan exit
 */
const handleStepByStepExit = async (bot, msg, chatId, state, stateMap, exitKeywords = null) => {
  if (!msg.text) return false;
  
  // Default menggunakan EXIT_KEYWORDS.COMBINED jika tidak disediakan
  const keywords = exitKeywords || module.exports.EXIT_KEYWORDS.COMBINED;
  
  if (keywords.includes(msg.text.trim())) {
    // Hapus input message dan user message dengan delay 100ms untuk smooth effect
    if (state.inputMessageId) {
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
    }
    autoDeleteMessage(bot, chatId, msg.message_id, 100);
    
    // Clear state dari map
    stateMap.delete(chatId);
    
    return true; // Exit berhasil diproses
  }
  
  return false; // Bukan exit command
};

/**
 * 🔧 STEP HANDLER WITH EXIT (untuk STEP EXITER)
 * ==============================================
 * Template untuk step dalam step-by-step flow dengan built-in exit handling.
 * Digunakan untuk setiap step dalam multi-step flow agar konsisten.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {Object} msg - Message object
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Map} stateMap - State management map (contoh: adminState)
 * @param {string} currentStep - Current step name untuk validasi
 * @param {Function} stepLogic - Function yang berisi logika step (dipanggil jika bukan exit)
 * @param {Array} exitKeywords - Custom exit keywords (optional)
 * @returns {boolean} true jika step selesai diproses (exit atau logic), false jika bukan step ini
 */
const handleStepWithExit = async (bot, msg, chatId, state, stateMap, currentStep, stepLogic, exitKeywords = null) => {
  // Pastikan ini adalah step yang benar
  if (!state || state.step !== currentStep) return false;
  
  // Handle exit untuk step ini
  if (await handleStepByStepExit(bot, msg, chatId, state, stateMap, exitKeywords)) {
    return true; // Exit berhasil diproses
  }
  
  // Jika bukan exit, jalankan logika step
  if (typeof stepLogic === 'function') {
    await stepLogic();
  }
  
  return true; // Step selesai diproses
};

/**
 * ➡️ STEP TRANSITION UTILITY (untuk STEP EXITER)
 * =============================================== 
 * Utility untuk transisi antar step dengan smooth message cleanup.
 * Menghapus input sebelumnya, update state, dan kirim input form berikutnya.
 * 
 * @param {Object} bot - Bot instance Telegram
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Map} stateMap - State management map
 * @param {Object} msg - User message object
 * @param {string} nextStep - Next step name
 * @param {string} mainText - Main text untuk input step berikutnya
 * @param {string} subtitle - Subtitle untuk input step berikutnya
 * @param {string} exitText - Custom exit text (default: "membatalkan")
 */
const transitionToNextStep = async (bot, chatId, state, stateMap, msg, nextStep, mainText, subtitle = '', exitText = 'membatalkan') => {
  // Update state ke step berikutnya
  state.step = nextStep;
  stateMap.set(chatId, state);
  
  // Hapus pesan sebelumnya dengan smooth delete
  autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
  autoDeleteMessage(bot, chatId, msg.message_id, 100);
  
  // Kirim input form untuk step berikutnya
  const nextInputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, exitText);
  state.inputMessageId = nextInputMsg.message_id;
  stateMap.set(chatId, state);
};

/**
 * 🚀 FLOW STATE INITIALIZER
 * =========================
 * Inisialisasi flow state untuk memulai pattern exiter baru.
 * 
 * @param {Map} stateMap - State management map (contoh: adminState)
 * @param {string} chatId - Chat ID
 * @param {string} mode - Flow mode name (contoh: 'tambah_saldo', 'lihat_konfigurasi')
 * @param {Object} additionalData - Data tambahan untuk state (optional)
 */
const initializeFlowState = (stateMap, chatId, mode, additionalData = {}) => {
  stateMap.set(chatId, { 
    mode: mode,
    ...additionalData 
  });
};

// ================================================================
// 🎯 EXPORT SECTION - All Functions & Constants
// ================================================================

module.exports = {
  // 🔧 Core Functions
  handleExitFlow,                // Legacy exit handler
  handleNonExitInput,           // Input cleanup utility
  
  // ⏰ Auto-Delete Functions
  autoDeleteMessage,            // Single message auto-delete
  autoDeleteMultipleMessages,   // Batch message auto-delete
  handleExitWithAutoDelete,     // Enhanced exit dengan auto-delete
  
  // 🔄 Step Exiter Functions (untuk step-by-step flows)
  handleStepByStepExit,         // Exit handler untuk step flows
  handleStepWithExit,           // Step template dengan exit
  transitionToNextStep,         // Step transition utility
  
  // 📨 Message Functions
  sendMessageWithTracking,      // Smart message sender dengan tracking
  generateStyledInputMessage,   // Generate styled input text
  sendStyledInputMessage,       // Send styled input dengan tracking
  
  // 🎛️ Flow Management
  handleFlowWithExit,          // Complete flow handler
  generateExitInstruction,     // Generate exit instruction text
  initializeFlowState         // Flow state initializer
};

// ================================================================
// 🔑 EXIT KEYWORDS CONSTANTS - 13 Comprehensive Exit Options
// ================================================================
module.exports.EXIT_KEYWORDS = {
  // 🚪 Standard Exit Keywords
  STANDARD: ['exit', 'EXIT', 'Exit', 'c', 'C', 'x', 'X'],
  
  // 🔙 Indonesian "Keluar" (Exit)
  KELUAR: ['keluar', 'KELUAR', 'Keluar'],
  
  // ❌ Indonesian "Batal" (Cancel)
  BATAL: ['batal', 'BATAL', 'Batal'],
  
  // 🛑 Stop Keywords
  STOP: ['stop', 'STOP', 'Stop'],
  
  // 🎯 Combined - All 13 Exit Options (RECOMMENDED)
  COMBINED: ['exit', 'EXIT', 'Exit', 'keluar', 'KELUAR', 'Keluar', 'batal', 'BATAL', 'Batal', 'c', 'C', 'x', 'X']
};

// ================================================================
// 📚 USAGE EXAMPLES & PATTERN GUIDELINES
// ================================================================
//
// 🔴 VIEW EXITER (untuk read-only displays seperti atur_lainnya.js):
// const { autoDeleteMessage, EXIT_KEYWORDS } = require('./utils/exiter');
// if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) {
//   autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
//   autoDeleteMessage(bot, chatId, msg.message_id, 100);
//   adminState.delete(chatId);
// }
//
// 🟡 INPUT EXITER (untuk single-step input seperti hapus_stok.js):
// const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('./utils/exiter');
// const inputMsg = await sendStyledInputMessage(bot, chatId, "Masukkan data...", "Subtitle...");
// if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) { /* handle exit */ }
//
// 🟢 STEP EXITER (untuk multi-step flows seperti tambah_saldo.js):
// const { handleStepByStepExit, transitionToNextStep } = require('./utils/exiter');
// if (await handleStepByStepExit(bot, msg, chatId, state, adminState)) return;
// await transitionToNextStep(bot, chatId, state, adminState, msg, 'step2', 'Next input...');
//
// ================================================================