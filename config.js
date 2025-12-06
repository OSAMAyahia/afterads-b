// Configuration file for MongoDB and other settings
export const config = {
  // Database Configuration
  mongodb: {
  // MongoDB Atlas URI (الجديدة)
  atlasUri: 'mongodb+srv://after_ads2025:AAAAssssDDDD1234@cluster0.zmef4xc.mongodb.net/after_ads?retryWrites=true&w=majority&appName=Cluster0',

  // اسم الداتابيز الجديدة
  dbName: 'after_ads',

  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
},

  // Server Configuration
  server: {
    port: process.env.PORT || 3002,
    env: process.env.NODE_ENV || 'development'
  },

  // Email Configuration
  email: {
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'am1322460@gmail.com',
      pass: 'hqww szea ruof uuyy'
    },
    from: {
      name: 'AFTERADS.store',
      address: 'am1322460@gmail.com'
    },
    pool: true,
    maxConnections: 1,
    rateDelta: 20000,
    rateLimit: 5,
    tls: {
      rejectUnauthorized: false
    },
    dkim: {
      domainName: 'gmail.com',
      keySelector: 'default',
      privateKey: false
    }
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  }
};

// Helper function to get MongoDB URI based on environment
export const getMongoUri = () => {
  // إذا كان متاح في environment variables
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  
  // إذا كان يعمل في Docker
  if (process.env.NODE_ENV === 'docker' || process.env.DOCKER_ENV) {
    return config.mongodb.dockerUri;
  }
  
  // إذا كان يعمل محلياً
  if (process.env.NODE_ENV === 'local') {
    return config.mongodb.localUri;
  }
  
  // الافتراضي هو MongoDB Atlas
  return config.mongodb.atlasUri;
}; 