const axios = require('axios');

async function testLoyaltyApplication() {
  try {
    const testData = {
      customerInfo: {
        name: "Test User",
        email: "test@example.com", 
        phone: "0111111111"
      },
      items: [{
        productId: 56,
        quantity: 1,
        price: 40
      }],
      total: 40,
      subtotal: 40,
      couponDiscount: 0,
      paymentMethod: "cod",
      paymentStatus: "pending",
      userId: "test-user-123",
      loyaltyPointsToRedeem: 3,
      applyLoyalty: false // Server should ignore this and auto-apply
    };

    console.log('🧪 Testing server-controlled loyalty logic...');
    console.log('📤 Sending checkout request with:', JSON.stringify(testData, null, 2));

    const response = await axios.post('http://localhost:3001/api/checkout', testData);
    
    console.log('✅ Response received:');
    console.log('📊 Order Details:', {
      total: response.data.order?.total,
      loyaltyRedeemed: response.data.order?.loyaltyRedeemed,
      subtotal: response.data.order?.subtotal,
      couponDiscount: response.data.order?.couponDiscount
    });
    
    // Check if loyalty was applied correctly
    const expectedTotal = 37; // 40 - 3 loyalty points
    const actualTotal = response.data.order?.total;
    const loyaltyRedeemed = response.data.order?.loyaltyRedeemed;
    
    if (actualTotal === expectedTotal && loyaltyRedeemed === 3) {
      console.log('🎉 SUCCESS: Loyalty points auto-applied correctly!');
      console.log(`💰 Total: ${actualTotal} (expected: ${expectedTotal})`);
      console.log(`⭐ Loyalty redeemed: ${loyaltyRedeemed} points`);
    } else {
      console.log('❌ ISSUE: Loyalty points not applied correctly');
      console.log(`💰 Expected total: ${expectedTotal}, Actual: ${actualTotal}`);
      console.log(`⭐ Expected loyalty: 3, Actual: ${loyaltyRedeemed}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing loyalty:', error.response?.data || error.message);
  }
}

testLoyaltyApplication();