import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  totalPrice: { type: Number },
  selectedOptions: { type: Object, default: {} },
  optionsPricing: { type: Object, default: {} },
  productOptions: { type: Array, default: [] }, // خيارات المنتج الجديدة
  productOptionsPriceModifier: { type: Number, default: 0 }, // تعديل السعر من خيارات المنتج
  productImage: { type: String, default: '' },
  attachments: { 
    type: Object, 
    default: {} 
  }, // المرفقات: { images: [], text: '' }
  addOns: [{
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' }
  }],
  basePrice: { type: Number, default: 0 },
  addOnsPrice: { type: Number, default: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  
  // معلومات العميل
  customerName: { type: String, required: true },
  customerEmail: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  
  // معلومات التوصيل التفصيلية (اختيارية)
  customerAddress: { type: String },
  
  // تفاصيل الطلب
  items: [orderItemSchema],
  subtotal: { type: Number },



  discount: { type: Number, default: 0 },
  total: { type: Number },
  
  // معلومات الكوبون
  couponCode: { type: String, default: '' },
  couponDiscount: { type: Number, default: 0 },
  loyaltyRedeemed: { type: Number, default: 0 },
  loyaltyEarned: { type: Number, default: 0 },
  
  // حالة الطلب
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'], 
    default: 'pending' 
  },
  
  // طريقة الدفع
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'cod', 'card', 'bank', 'bank_transfer', 'wallet'], 
    default: 'cod' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  },
  paymentId: { 
    type: String, 
    default: '' 
  },
  
  // ملاحظات
  notes: { type: String, default: '' },
  
  // تتبع الوقت
  orderDate: { type: Date, default: Date.now },
  expectedDelivery: { type: Date },
  deliveredAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-increment ID
orderSchema.pre('save', async function(next) {
  // حساب الـ ID التلقائي فقط لو مش موجود
  if (this.isNew && !this.id) {
    const lastOrder = await this.constructor.findOne().sort({ id: -1 });
    this.id = lastOrder ? lastOrder.id + 1 : 1;
  }
  
  // حساب إجمالي كل عنصر
  this.items.forEach(item => {
    if (!item.totalPrice) {
      item.totalPrice = item.price * item.quantity;
    }
  });
  
  // حساب الإجمالي الفرعي إذا لم يكن محدد
  if (!this.subtotal) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }
  
  // حساب الإجمالي النهائي إذا لم يكن محدد
  if (!this.total) {
    this.total = this.subtotal - (this.discount || 0) - (this.couponDiscount || 0) - (this.loyaltyRedeemed || 0);
  }
  
  this.updatedAt = new Date();
  next();
});

// Methods لتغيير حالة الطلب
orderSchema.methods.confirm = function() {
  this.status = 'confirmed';
  return this.save();
};



orderSchema.methods.deliver = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

orderSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

orderSchema.virtual('statusInArabic').get(function() {
  const statusMap = {
    'pending': 'في الانتظار',
    'confirmed': 'مؤكد',
    'preparing': 'قيد التحضير',

    'delivered': 'تم التسليم',
    'cancelled': 'ملغي'
  };
  return statusMap[this.status] || this.status;
});

// Indexes للبحث السريع
orderSchema.index({ id: 1 });
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ customerPhone: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;