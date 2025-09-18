#!/usr/bin/env node

// INTERACTIVE SMART RETRY FLOW TESTER - ADVANCED CLI
// Interactive CLI untuk testing smart retry dengan pilihan produk dan input manual

const readline = require('readline');
const axios = require('axios');
const { kickMemberAPI1Only } = require('./menu/admin/manage_akrab/kick1');
const { normalizePhoneNumber, isValidIndonesianPhone } = require('./utils/normalize');

// Database functions
const { 
  getLastPengelolaForNumber, 
  getAllPengelolaNumbers, 
  getHargaPaket,
  getDeskripsiPaket,
  getKuotaPaket,
  countStok,
  getKonfigurasi
} = require('./db');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for CLI output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

const log = (message, color = 'white') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const separator = () => {
  log('='.repeat(80), 'cyan');
};

const clearScreen = () => {
  console.clear();
};

// Helper function to prompt user input
const prompt = (question, color = 'white') => {
  return new Promise((resolve) => {
    rl.question(`${colors[color]}${question}${colors.reset}`, resolve);
  });
};

// Product data - akan diambil dari database
let products = [];

// Load products from database
const loadProductsFromDatabase = async () => {
  try {
    log(`📊 Loading products from database configuration...`, 'blue');
    
    // Define product categories based on db.js configuration
    const bulatanProducts = [
      'SUPERMINI', 'SUPERBIG', 'MINI', 'BIG', 'LITE', 'JUMBO', 'MEGABIG', 'SUPERJUMBO'
    ];
    
    const bekasanProducts = [
      '3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'
    ];
    
    products = [];
    let id = 1;
    
    // Load BULANAN products
    for (const productCode of bulatanProducts) {
      try {
        const harga = await getHargaPaket(productCode.toLowerCase());
        const deskripsi = await getDeskripsiPaket(productCode.toLowerCase());
        const kuota = await getKuotaPaket(productCode.toLowerCase());
        const stockCount = await countStok('BULANAN');
        
        if (harga > 0) {
          // Extract kuota info from description for display
          let kuotaDisplay = kuota || '0';
          if (kuotaDisplay === '0') {
            kuotaDisplay = 'UNLIMIT';
          } else {
            kuotaDisplay = kuotaDisplay + 'GB';
          }
          
          products.push({
            id: id++,
            name: `BULANAN ${productCode}`,
            category: 'BULANAN',
            kuota: kuota || '0',
            kuotaDisplay: kuotaDisplay,
            provider: 'XL',
            harga: harga,
            kode_produk: productCode.toLowerCase(),
            stock_count: stockCount,
            deskripsi: deskripsi || 'Area-based quota allocation'
          });
        }
      } catch (error) {
        console.error(`Error loading BULANAN ${productCode}:`, error.message);
      }
    }
    
    // Load BEKASAN products
    for (const productCode of bekasanProducts) {
      try {
        const harga = await getHargaPaket(productCode.toLowerCase());
        const stockCount = await countStok('BEKASAN');
        
        if (harga > 0) {
          // Extract hours from product code
          const hours = productCode.replace('H', '');
          
          products.push({
            id: id++,
            name: `BEKASAN ${productCode}`,
            category: 'BEKASAN',
            kuota: hours, // For bekasan, use hours instead of GB
            kuotaDisplay: `${hours}H`,
            provider: 'XL',
            harga: harga,
            kode_produk: productCode.toLowerCase(),
            stock_count: stockCount,
            deskripsi: `${hours} hours duration package`
          });
        }
      } catch (error) {
        console.error(`Error loading BEKASAN ${productCode}:`, error.message);
      }
    }
    
    if (products.length === 0) {
      log(`⚠️ No products found in database configuration, using fallback products`, 'yellow');
      // Fallback products if database configuration is empty
      products = [
        { id: 1, name: 'BULANAN SUPERMINI', category: 'BULANAN', kuota: '0', kuotaDisplay: 'UNLIMIT', provider: 'XL', harga: 40000, kode_produk: 'supermini', stock_count: 0 },
        { id: 2, name: 'BULANAN MINI', category: 'BULANAN', kuota: '15', kuotaDisplay: '15GB', provider: 'XL', harga: 50000, kode_produk: 'mini', stock_count: 0 },
        { id: 3, name: 'BEKASAN 3H', category: 'BEKASAN', kuota: '3', kuotaDisplay: '3H', provider: 'XL', harga: 8000, kode_produk: '3h', stock_count: 0 },
        { id: 4, name: 'BEKASAN 5H', category: 'BEKASAN', kuota: '5', kuotaDisplay: '5H', provider: 'XL', harga: 12000, kode_produk: '5h', stock_count: 0 }
      ];
      return;
    }
    
    log(`✅ Loaded ${products.length} products from database configuration`, 'green');
    
    // Show categories summary
    const categories = {};
    products.forEach(p => {
      if (!categories[p.category]) categories[p.category] = 0;
      categories[p.category]++;
    });
    
    Object.entries(categories).forEach(([cat, count]) => {
      log(`   📦 ${cat}: ${count} products`, 'white');
    });
    
  } catch (error) {
    log(`❌ Error loading products from database: ${error.message}`, 'red');
    
    // Use fallback products
    products = [
      { id: 1, name: 'BULANAN SUPERMINI', category: 'BULANAN', kuota: '0', kuotaDisplay: 'UNLIMIT', provider: 'XL', harga: 40000, kode_produk: 'supermini', stock_count: 0 },
      { id: 2, name: 'BULANAN MINI', category: 'BULANAN', kuota: '15', kuotaDisplay: '15GB', provider: 'XL', harga: 50000, kode_produk: 'mini', stock_count: 0 },
      { id: 3, name: 'BEKASAN 3H', category: 'BEKASAN', kuota: '3', kuotaDisplay: '3H', provider: 'XL', harga: 8000, kode_produk: '3h', stock_count: 0 },
      { id: 4, name: 'BEKASAN 5H', category: 'BEKASAN', kuota: '5', kuotaDisplay: '5H', provider: 'XL', harga: 12000, kode_produk: '5h', stock_count: 0 }
    ];
    
    log(`⚠️ Using ${products.length} fallback products`, 'yellow');
  }
};

// Helper function untuk format nomor internasional
function formatNomorToInternational(nomor) {
  if (typeof nomor !== 'string') nomor = String(nomor);
  let cleanNomor = nomor.replace(/\D/g, '');
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  } else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  return cleanNomor;
}

// Mock API KMSP DOMPUL validation
const validateNomorWithDompul = async (nomorPembeli) => {
  log(`📞 Validating number with DOMPUL API: ${nomorPembeli}`, 'blue');
  
  // Simulate API delay
  for (let i = 3; i > 0; i--) {
    process.stdout.write(`\r⏳ Checking DOMPUL API... ${i}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log();
  
  // Mock different scenarios based on number patterns
  const lastDigit = parseInt(nomorPembeli.slice(-1));
  
  if (lastDigit >= 0 && lastDigit <= 3) {
    // 40% chance: Has AKRAB package
    log(`⚠️ DOMPUL Response: Number has AKRAB package detected`, 'yellow');
    return {
      valid: false,
      reason: 'has_akrab_package',
      hasAkrab: true
    };
  } else if (lastDigit >= 4 && lastDigit <= 7) {
    // 40% chance: No package (clean)
    log(`✅ DOMPUL Response: Number has no package (clean)`, 'green');
    return {
      valid: true,
      reason: 'no_package_clean',
      hasAkrab: false
    };
  } else {
    // 20% chance: API error
    log(`⚠️ DOMPUL Response: API error, proceeding anyway`, 'yellow');
    return {
      valid: true,
      reason: 'validation_error_proceed',
      hasAkrab: false
    };
  }
};

// Check previous registration
const checkPreviousRegistration = async (nomorPembeli, kategori) => {
  log(`🔍 Checking if ${nomorPembeli} was registered in last 1 month (${kategori})...`, 'blue');
  
  // Simulate database search
  for (let i = 3; i > 0; i--) {
    process.stdout.write(`\r⏳ Searching database... ${i}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log();
  
  try {
    const lastPengelola = await getLastPengelolaForNumber(nomorPembeli, kategori);
    
    if (lastPengelola) {
      log(`📋 Previous registration found: ${lastPengelola} (${kategori})`, 'yellow');
      return {
        found: true,
        pengelola: lastPengelola,
        kategori: kategori
      };
    } else {
      log(`📋 No previous registration found in last 1 month`, 'green');
      return {
        found: false
      };
    }
  } catch (error) {
    log(`❌ Error checking previous registration: ${error.message}`, 'red');
    return {
      found: false,
      error: error.message
    };
  }
};

// Kick member function
const kickMember = async (pengelola, nomorTarget) => {
  log(`👠 Attempting to kick member ${nomorTarget} from ${pengelola}`, 'magenta');
  
  // Simulate kick process
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`\r⏳ Processing kick... ${i}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log();
  
  try {
    const kickResult = await kickMemberAPI1Only(pengelola, nomorTarget);
    
    if (kickResult.success) {
      log(`✅ KICK SUCCESS: ${kickResult.message || 'Member kicked successfully'}`, 'green');
      return {
        success: true,
        message: kickResult.message
      };
    } else {
      log(`❌ KICK FAILED: ${kickResult.error}`, 'red');
      return {
        success: false,
        error: kickResult.error
      };
    }
  } catch (error) {
    log(`❌ KICK ERROR: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message
    };
  }
};

// ADD transaction function
const addTransaction = async (pengelola, nomorPembeli, selectedProduct, isRetry = false) => {
  const retryText = isRetry ? ' (SMART RETRY)' : '';
  log(`➕ Executing ADD transaction${retryText}:`, 'blue');
  log(`   📞 Customer: ${nomorPembeli}`, 'white');
  log(`   📱 Pengelola: ${pengelola}`, 'white');
  log(`   📦 Product: ${selectedProduct.name}`, 'white');
  log(`   🗂️ Category: ${selectedProduct.category}`, 'white');
  log(`   💾 Kuota: ${selectedProduct.kuota}GB`, 'white');
  
  // Simulate ADD process with progress
  for (let i = 10; i > 0; i--) {
    process.stdout.write(`\r⏳ Processing ADD transaction... ${i}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log();
  
  // Simulate success/failure based on different factors
  const successRate = isRetry ? 0.85 : 0.75; // Higher success rate for retry
  const success = Math.random() < successRate;
  
  if (success) {
    const executionTime = Math.floor(Math.random() * 15) + 8; // 8-22 seconds
    log(`✅ ADD SUCCESS${retryText}: Transaction completed in ${executionTime}s`, 'green');
    return {
      success: true,
      isRetry,
      executionTime,
      details: {
        'nomor-anggota': nomorPembeli,
        'family_member_id': 'fm_' + Date.now(),
        'product': selectedProduct.name,
        'kuota': selectedProduct.kuota + 'GB'
      }
    };
  } else {
    const executionTime = Math.floor(Math.random() * 7) + 1; // 1-7 seconds
    log(`❌ ADD FAILED${retryText}: Transaction failed in ${executionTime}s`, 'red');
    return {
      success: false,
      isRetry,
      error: 'ADD transaction failed - conflict or timeout',
      executionTime
    };
  }
};

// Display product list
const displayProducts = () => {
  clearScreen();
  log(`\n📦 AVAILABLE PRODUCTS (FROM DATABASE)`, 'bold');
  separator();
  
  log(`${'ID'.padEnd(4)}${'PRODUCT NAME'.padEnd(45)}${'CAT'.padEnd(10)}${'KUOTA'.padEnd(8)}${'STOCK'.padEnd(8)}${'PRICE'}`, 'cyan');
  log('-'.repeat(90), 'dim');
  
  products.forEach(product => {
    const kuotaText = product.kuota === '0' ? 'UNLIMIT' : product.kuota + 'GB';
    const priceText = 'Rp.' + product.harga.toLocaleString('id-ID');
    const stockText = product.stock_count ? product.stock_count.toString() : '0';
    const categoryShort = product.category.substring(0, 8); // Shorten category
    
    // Color coding for stock status
    const stockDisplay = product.stock_count > 0 ? 
      stockText : 
      `${colors.red}${stockText} (OUT)${colors.reset}`;
    
    const productLine = product.stock_count > 0 ? 
      `${String(product.id).padEnd(4)}${product.name.substring(0, 44).padEnd(45)}${categoryShort.padEnd(10)}${kuotaText.padEnd(8)}${stockText.padEnd(8)}${priceText}` :
      `${colors.dim}${String(product.id).padEnd(4)}${product.name.substring(0, 44).padEnd(45)}${categoryShort.padEnd(10)}${kuotaText.padEnd(8)}${stockDisplay.padEnd(20)}${priceText}${colors.reset}`;
    
    if (product.stock_count > 0) {
      log(productLine, 'white');
    } else {
      console.log(productLine); // Already has color codes embedded
    }
    
    // Show additional info if available
    if (product.kode_produk) {
      log(`    📝 Code: ${product.kode_produk}`, 'dim');
    }
  });
  
  separator();
  log(`📊 Total: ${products.length} products available`, 'white');
  log(`⚠️  Note: Products with 0 stock cannot be selected`, 'yellow');
  log(`🔄 Tip: Type '00' to return to previous menu`, 'cyan');
};

// Get available pengelola for category
const getAvailablePengelola = async (category) => {
  try {
    const allPengelola = await getAllPengelolaNumbers(category);
    return allPengelola.length > 0 ? allPengelola : ['087824020813', '087824020814', '087824020815']; // fallback
  } catch (error) {
    // Fallback pengelola numbers
    return ['087824020813', '087824020814', '087824020815'];
  }
};

// Main flow execution
const executeFlow = async (nomorPembeli, selectedProduct, selectedPengelola, logicChoice) => {
  log(`\n🚀 EXECUTING SMART RETRY FLOW`, 'bold');
  separator();
  
  log(`📋 Transaction Details:`, 'cyan');
  log(`   📞 Customer Number: ${nomorPembeli}`, 'white');
  log(`   📦 Product: ${selectedProduct.name}`, 'white');
  log(`   📱 Pengelola: ${selectedPengelola}`, 'white');
  log(`   🔄 Logic: ${logicChoice}`, 'white');
  separator();
  
  const startTime = Date.now();
  
  // Step 1: Validate with DOMPUL
  const validation = await validateNomorWithDompul(nomorPembeli);
  
  if (validation.hasAkrab && (logicChoice === 'LOGIKA 1' || logicChoice === 'LOGIKA 2')) {
    log(`⚠️ AKRAB package detected - proceeding with smart logic`, 'yellow');
    
    // Step 2: Check previous registration
    const previousReg = await checkPreviousRegistration(nomorPembeli, selectedProduct.category);
    
    if (previousReg.found) {
      log(`🎯 Previous registration found - attempting kick from ${previousReg.pengelola}`, 'yellow');
      
      // Step 3: Kick from previous pengelola
      const kickResult = await kickMember(previousReg.pengelola, nomorPembeli);
      
      if (kickResult.success) {
        log(`✅ Kick successful!`, 'green');
        
        if (logicChoice === 'LOGIKA 1') {
          log(`📋 LOGIKA 1: Kick successful, but returning FAILED as per logic 1`, 'yellow');
          return {
            success: false,
            reason: 'logika_1_kicked_but_failed',
            kickPerformed: true,
            duration: Math.floor((Date.now() - startTime) / 1000)
          };
        } else if (logicChoice === 'LOGIKA 2') {
          log(`⏳ LOGIKA 2: Waiting 20 seconds before retry ADD...`, 'yellow');
          
          // Wait 20 seconds with countdown
          for (let i = 20; i > 0; i--) {
            process.stdout.write(`\r⏳ Waiting ${i} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          console.log();
          
          // Retry ADD transaction
          const addResult = await addTransaction(selectedPengelola, nomorPembeli, selectedProduct, true);
          
          return {
            success: addResult.success,
            isSmartRetry: true,
            kickPerformed: true,
            executionTime: addResult.executionTime,
            details: addResult.details,
            error: addResult.error,
            duration: Math.floor((Date.now() - startTime) / 1000)
          };
        }
      } else {
        log(`❌ Kick failed: ${kickResult.error}`, 'red');
        return {
          success: false,
          reason: 'kick_failed',
          kickAttempted: true,
          error: kickResult.error,
          duration: Math.floor((Date.now() - startTime) / 1000)
        };
      }
    } else {
      log(`❌ No previous registration found - returning FAILED`, 'red');
      return {
        success: false,
        reason: 'no_previous_registration',
        duration: Math.floor((Date.now() - startTime) / 1000)
      };
    }
  } else if (!validation.hasAkrab && logicChoice === 'LOGIKA 3') {
    log(`✅ No AKRAB package detected - proceeding with direct ADD`, 'green');
    
    // Direct ADD transaction
    const addResult = await addTransaction(selectedPengelola, nomorPembeli, selectedProduct, false);
    
    return {
      success: addResult.success,
      isDirect: true,
      executionTime: addResult.executionTime,
      details: addResult.details,
      error: addResult.error,
      duration: Math.floor((Date.now() - startTime) / 1000)
    };
  } else {
    log(`⚠️ Logic mismatch: Selected logic doesn't match DOMPUL validation result`, 'yellow');
    return {
      success: false,
      reason: 'logic_mismatch',
      validation: validation,
      selectedLogic: logicChoice,
      duration: Math.floor((Date.now() - startTime) / 1000)
    };
  }
};

// Main CLI interface
const main = async () => {
  try {
    // Load products from database first
    await loadProductsFromDatabase();
    
    while (true) {
      clearScreen();
      log(`\n${'='.repeat(80)}`, 'cyan');
      log(`🧪 INTERACTIVE SMART RETRY FLOW TESTER`, 'bold');
      log(`Advanced CLI for testing smart retry with kick system`, 'white');
      log(`${'='.repeat(80)}`, 'cyan');
      
      // Step 1: Product selection
      displayProducts();
      
      const productChoice = await prompt(`\n🛒 Select product (1-${products.length}), '00' to return, or 'exit' to quit: `, 'yellow');
      
      if (productChoice.toLowerCase() === 'exit') {
        log(`\n👋 Goodbye!`, 'green');
        break;
      }
      
      if (productChoice === '00') {
        log(`\n🔄 Returning to previous menu...`, 'cyan');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      const productId = parseInt(productChoice);
      if (isNaN(productId) || productId < 1 || productId > products.length) {
        log(`❌ Invalid product selection!`, 'red');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      const selectedProduct = products[productId - 1];
      
      // Check if product has stock
      if (selectedProduct.stock_count <= 0) {
        log(`\n❌ PRODUCT OUT OF STOCK!`, 'red');
        log(`📦 Product: ${selectedProduct.name}`, 'yellow');
        log(`📊 Current Stock: ${selectedProduct.stock_count}`, 'red');
        log(`\n💡 Please select a different product or wait for stock replenishment.`, 'cyan');
        log(`🔄 Type '00' to return to product selection.`, 'cyan');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      // Step 2: Customer number input
      clearScreen();
      log(`\n📦 Selected Product: ${selectedProduct.name}`, 'green');
      log(`📂 Category: ${selectedProduct.category}`, 'white');
      log(`💾 Kuota: ${selectedProduct.kuota}GB`, 'white');
      log(`💰 Price: Rp.${selectedProduct.harga.toLocaleString('id-ID')}`, 'white');
      separator();
      
      const nomorPembeli = await prompt(`\n📞 Enter customer number (08xxxxxxxxxx) or '00' to return: `, 'yellow');
      
      if (nomorPembeli === '00') {
        log(`\n🔄 Returning to product selection...`, 'cyan');
        continue;
      }
      
      if (!nomorPembeli || nomorPembeli.length < 10) {
        log(`❌ Invalid phone number!`, 'red');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      // Normalize and validate number
      const normalizedNumber = normalizePhoneNumber(nomorPembeli);
      if (!normalizedNumber || !isValidIndonesianPhone(normalizedNumber)) {
        log(`❌ Invalid Indonesian phone number format!`, 'red');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      // Step 3: Pengelola selection
      log(`\n🔍 Getting available pengelola for ${selectedProduct.category}...`, 'blue');
      const availablePengelola = await getAvailablePengelola(selectedProduct.category);
      
      clearScreen();
      log(`\n📱 Available Pengelola for ${selectedProduct.category}:`, 'cyan');
      separator();
      
      availablePengelola.forEach((pengelola, index) => {
        log(`${index + 1}. ${pengelola}`, 'white');
      });
      
      const pengelolaChoice = await prompt(`\n📱 Select pengelola (1-${availablePengelola.length}) or '00' to return: `, 'yellow');
      
      if (pengelolaChoice === '00') {
        log(`\n🔄 Returning to phone number input...`, 'cyan');
        continue;
      }
      
      const pengelolaIndex = parseInt(pengelolaChoice) - 1;
      
      if (isNaN(pengelolaIndex) || pengelolaIndex < 0 || pengelolaIndex >= availablePengelola.length) {
        log(`❌ Invalid pengelola selection!`, 'red');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      const selectedPengelola = availablePengelola[pengelolaIndex];
      
      // Step 4: Logic selection
      clearScreen();
      log(`\n🔄 Select Testing Logic:`, 'cyan');
      separator();
      log(`1. LOGIKA 1: Has AKRAB → Check Previous → Kick → Return Failed`, 'white');
      log(`2. LOGIKA 2: Has AKRAB → Check Previous → Kick → Wait 20s → ADD`, 'white');
      log(`3. LOGIKA 3: No AKRAB → Direct ADD`, 'white');
      separator();
      
      const logicChoice = await prompt(`\n🔄 Select logic (1-3) or '00' to return: `, 'yellow');
      
      if (logicChoice === '00') {
        log(`\n🔄 Returning to pengelola selection...`, 'cyan');
        continue;
      }
      
      const logicNames = ['LOGIKA 1', 'LOGIKA 2', 'LOGIKA 3'];
      const selectedLogic = logicNames[parseInt(logicChoice) - 1];
      
      if (!selectedLogic) {
        log(`❌ Invalid logic selection!`, 'red');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      // Step 5: Confirmation
      clearScreen();
      log(`\n📋 TRANSACTION SUMMARY`, 'bold');
      separator();
      log(`📞 Customer: ${normalizedNumber}`, 'white');
      log(`📦 Product: ${selectedProduct.name}`, 'white');
      log(`📂 Category: ${selectedProduct.category}`, 'white');
      log(`💾 Kuota: ${selectedProduct.kuota}GB`, 'white');
      log(`💰 Price: Rp.${selectedProduct.harga.toLocaleString('id-ID')}`, 'white');
      log(`📱 Pengelola: ${selectedPengelola}`, 'white');
      log(`🔄 Logic: ${selectedLogic}`, 'white');
      separator();
      
      const confirm = await prompt(`\n✅ Proceed with transaction? (y/n): `, 'yellow');
      
      if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        log(`❌ Transaction cancelled`, 'yellow');
        await prompt(`Press Enter to continue...`, 'dim');
        continue;
      }
      
      // Step 6: Execute flow
      const result = await executeFlow(normalizedNumber, selectedProduct, selectedPengelola, selectedLogic);
      
      // Step 7: Display results
      separator();
      log(`\n📊 TRANSACTION RESULT`, 'bold');
      separator();
      
      if (result.success) {
        log(`✅ STATUS: SUCCESS`, 'green');
        if (result.isSmartRetry) log(`🔄 Smart retry executed`, 'yellow');
        if (result.isDirect) log(`➡️ Direct ADD executed`, 'yellow');
        if (result.kickPerformed) log(`👠 Member kick performed`, 'yellow');
        if (result.executionTime) log(`⏱️ Execution time: ${result.executionTime}s`, 'white');
        if (result.details) {
          log(`📋 Details:`, 'cyan');
          Object.entries(result.details).forEach(([key, value]) => {
            log(`   ${key}: ${value}`, 'white');
          });
        }
      } else {
        log(`❌ STATUS: FAILED`, 'red');
        if (result.reason) log(`📝 Reason: ${result.reason}`, 'white');
        if (result.error) log(`💥 Error: ${result.error}`, 'red');
        if (result.kickAttempted) log(`👠 Kick attempted`, 'yellow');
        if (result.kickPerformed) log(`👠 Kick performed`, 'yellow');
      }
      
      log(`⏱️ Total duration: ${result.duration}s`, 'white');
      separator();
      
      const continueChoice = await prompt(`\n🔄 Run another test? (y/n): `, 'yellow');
      if (continueChoice.toLowerCase() !== 'y' && continueChoice.toLowerCase() !== 'yes') {
        break;
      }
    }
    
  } catch (error) {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    console.error(error.stack);
  } finally {
    rl.close();
  }
};

// Handle process termination
process.on('SIGINT', () => {
  log(`\n\n👋 CLI interrupted by user`, 'yellow');
  rl.close();
  process.exit(0);
});

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    console.error(error.stack);
    rl.close();
    process.exit(1);
  });
}

module.exports = {
  validateNomorWithDompul,
  checkPreviousRegistration,
  kickMember,
  addTransaction,
  executeFlow
};