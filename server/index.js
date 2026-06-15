const dotenv = require('dotenv');
const { onRequest } = require('firebase-functions/v2/https');
const connectDB = require('./config/db');
const createApp = require('./app');

dotenv.config();

const dbReady = connectDB();
const app = createApp(dbReady);

exports.api = onRequest({ region: 'us-central1', invoker: 'public' }, app);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  dbReady
    .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((error) => {
      console.error(`Server failed to start: ${error.message}`);
      process.exit(1);
    });
}
