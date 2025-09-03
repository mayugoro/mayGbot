const axios = require('axios');

// KMSP Store API with token rotation handling
class KMSPDompulAPI {
  constructor() {
    this.baseURL = 'https://apigw.kmsp-store.com/sidompul/v4/cek_kuota';
    
    // Static credentials (might change in future)
    this.credentials = [
      {
        name: 'Primary',
        basicAuth: 'c2lkb21wdWxhcGk6YXBpZ3drbXNw', // sidompulapi:apigwkmsp
        apiKey: '60ef29aa-a648-4668-90ae-20951ef90c55'
      }
      // Future tokens can be added here
    ];
    
    this.currentCredentialIndex = 0;
  }

  getCurrentCredentials() {
    return this.credentials[this.currentCredentialIndex];
  }

  rotateCredentials() {
    if (this.currentCredentialIndex < this.credentials.length - 1) {
      this.currentCredentialIndex++;
      return true;
    }
    return false; // No more credentials to try
  }

  resetCredentials() {
    this.currentCredentialIndex = 0;
  }

  async checkDompul(msisdn, retryCount = 0) {
    try {
      const formattedMsisdn = this.formatMsisdn(msisdn);
      const creds = this.getCurrentCredentials();
      
      const params = {
        msisdn: formattedMsisdn,
        isJSON: 'true',
        _: Date.now().toString()
      };

      console.log(`🔄 Checking dompul for: ${formattedMsisdn} (Attempt ${retryCount + 1})`);
      if (retryCount > 0) {
        console.log(`🔑 Using credentials: ${creds.name}`);
      }

      const response = await axios.get(this.baseURL, {
        params,
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
          "Authorization": `Basic ${creds.basicAuth}`,
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
          "X-API-Key": creds.apiKey,
          "X-App-Version": "4.0.0"
        },
        timeout: 30000
      });

      // Reset credentials on success
      this.resetCredentials();

      if (response.data && response.data.status) {
        return {
          success: true,
          data: response.data,
          formatted_number: formattedMsisdn,
          credentials_used: creds.name
        };
      } else {
        return {
          success: false,
          error: 'API returned unsuccessful status',
          data: response.data
        };
      }

    } catch (error) {
      // Handle 401 Unauthorized - try credential rotation
      if (error.response?.status === 401 && retryCount < this.credentials.length) {
        console.log(`❌ 401 Unauthorized with ${this.getCurrentCredentials().name}`);
        
        if (this.rotateCredentials()) {
          console.log(`🔄 Rotating to next credentials...`);
          return await this.checkDompul(msisdn, retryCount + 1);
        }
      }

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        response_data: error.response?.data,
        retry_count: retryCount
      };
    }
  }

  formatMsisdn(msisdn) {
    let cleaned = msisdn.replace(/\D/g, '');
    
    if (cleaned.startsWith('62')) {
      cleaned = '0' + cleaned.substring(2);
    }
    
    if (!cleaned.startsWith('0') && cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '0' + cleaned;
    }
    
    return cleaned;
  }

  // Method to check if token is still valid
  async validateToken(basicAuth, apiKey) {
    try {
      const testNumber = '087835360454'; // Known working number
      const params = {
        msisdn: testNumber,
        isJSON: 'true',
        _: Date.now().toString()
      };

      const response = await axios.get(this.baseURL, {
        params,
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Authorization": `Basic ${basicAuth}`,
          "X-API-Key": apiKey,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 15000
      });

      return response.status === 200 && response.data.status === true;
    } catch (error) {
      return false;
    }
  }

  // Method to add new credentials
  addCredentials(name, basicAuth, apiKey) {
    this.credentials.push({
      name,
      basicAuth,
      apiKey
    });
    console.log(`✅ Added new credentials: ${name}`);
  }

  // Method to test all available credentials
  async testAllCredentials() {
    console.log('🧪 Testing all available credentials...\n');
    
    const testNumber = '087835360454';
    const results = [];

    for (let i = 0; i < this.credentials.length; i++) {
      const creds = this.credentials[i];
      console.log(`Testing ${creds.name}...`);
      
      const isValid = await this.validateToken(creds.basicAuth, creds.apiKey);
      results.push({
        name: creds.name,
        valid: isValid,
        basicAuth: creds.basicAuth.substring(0, 10) + '...',
        apiKey: creds.apiKey.substring(0, 10) + '...'
      });
      
      console.log(`${isValid ? '✅' : '❌'} ${creds.name}: ${isValid ? 'VALID' : 'INVALID'}`);
    }

    return results;
  }
}

// Test function
async function testTokenRotation() {
  const api = new KMSPDompulAPI();
  
  console.log('🔐 KMSP Token Analysis & Rotation Test\n');
  
  // Test current credentials
  console.log('1. Testing current credentials:');
  await api.testAllCredentials();
  
  console.log('\n2. Testing actual dompul check:');
  const result = await api.checkDompul('087835360454');
  
  if (result.success) {
    console.log(`✅ Success with: ${result.credentials_used}`);
    console.log(`📱 MSISDN: ${result.data.data.msisdn}`);
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
  
  // Decode current token for analysis
  console.log('\n3. Current token analysis:');
  const currentCreds = api.getCurrentCredentials();
  const decoded = Buffer.from(currentCreds.basicAuth, 'base64').toString();
  console.log(`🔑 Decoded Basic Auth: ${decoded}`);
  console.log(`🆔 API Key: ${currentCreds.apiKey}`);
  
  console.log('\n📊 Token Stability Assessment:');
  console.log('- Type: Static Basic Authentication');
  console.log('- Rotation Risk: LOW-MEDIUM');
  console.log('- Recommendation: Monitor for 401 errors');
}

if (require.main === module) {
  testTokenRotation().catch(console.error);
}

module.exports = KMSPDompulAPI;
