const axios = require('axios');

// Simple KMSP Store API implementation based on working example
class KMSPDompulAPI {
  constructor() {
    this.baseURL = 'https://apigw.kmsp-store.com/sidompul/v4/cek_kuota';
  }

  async checkDompul(msisdn) {
    try {
      // Ensure proper format
      const formattedMsisdn = this.formatMsisdn(msisdn);
      
      const params = {
        msisdn: formattedMsisdn,
        isJSON: 'true',
        _: Date.now().toString()
      };

      console.log(`🔄 Checking dompul for: ${formattedMsisdn}`);
      console.log(`🔗 API URL: ${this.baseURL}?${new URLSearchParams(params).toString()}`);

      const response = await axios.get(this.baseURL, {
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

      if (response.data && response.data.status) {
        return {
          success: true,
          data: response.data,
          formatted_number: formattedMsisdn
        };
      } else {
        return {
          success: false,
          error: 'API returned unsuccessful status',
          data: response.data
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        response_data: error.response?.data
      };
    }
  }

  formatMsisdn(msisdn) {
    // Remove any non-digit characters
    let cleaned = msisdn.replace(/\D/g, '');
    
    // If starts with 62, convert to 0
    if (cleaned.startsWith('62')) {
      cleaned = '0' + cleaned.substring(2);
    }
    
    // If doesn't start with 0 and is 10-11 digits, add 0
    if (!cleaned.startsWith('0') && cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '0' + cleaned;
    }
    
    return cleaned;
  }

  parseResponse(data) {
    if (!data || !data.data) {
      return { error: 'Invalid response data' };
    }

    const result = {
      msisdn: data.data.msisdn,
      provider: data.data.data_sp?.prefix?.value,
      dukcapil: data.data.data_sp?.dukcapil?.value,
      card_age: data.data.data_sp?.active_card?.value,
      active_period: data.data.data_sp?.active_period?.value,
      grace_period: data.data.data_sp?.grace_period?.value,
      volte_status: data.data.data_sp?.status_volte?.value,
      network_status: data.data.data_sp?.status_4g?.value,
      packages: []
    };

    // Parse packages and benefits
    if (data.data.data_sp?.quotas?.value) {
      data.data.data_sp.quotas.value.forEach(packageGroup => {
        packageGroup.forEach(packageItem => {
          if (packageItem.packages) {
            const pkg = {
              name: packageItem.packages.name,
              expiry: packageItem.packages.expDate,
              benefits: packageItem.benefits || []
            };
            result.packages.push(pkg);
          }
        });
      });
    }

    return result;
  }
}

// Test the API
async function testKMSPAPI() {
  const api = new KMSPDompulAPI();
  
  const testNumbers = [
    '087835360454', // Working example
    '087764659975', // Your test number
    '081712345678', // XL
    '083112345678'  // Axis
  ];

  for (const number of testNumbers) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: ${number}`);
    console.log(`${'='.repeat(50)}`);
    
    const result = await api.checkDompul(number);
    
    if (result.success) {
      console.log('✅ SUCCESS');
      console.log('Raw Response:', JSON.stringify(result.data, null, 2));
      
      const parsed = api.parseResponse(result.data);
      console.log('\n📋 Parsed Data:');
      console.log(JSON.stringify(parsed, null, 2));
    } else {
      console.log('❌ FAILED');
      console.log('Error:', result.error);
      if (result.status) console.log('Status:', result.status);
      if (result.response_data) console.log('Response:', result.response_data);
    }
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run test if executed directly
if (require.main === module) {
  console.log('🚀 Starting KMSP Dompul API Test...');
  testKMSPAPI().catch(console.error);
}

module.exports = KMSPDompulAPI;
