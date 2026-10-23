import 'dotenv/config';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import { mongoStartupErrorMessage } from './src/utils/startup-error.js';

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error(mongoStartupErrorMessage(error));
    process.exitCode = 1;
  });
