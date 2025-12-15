import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

console.log('process.cwd():', process.cwd());
console.log('__dirname:', __dirname);
console.log('path.join(process.cwd(), "uploads"):', path.join(process.cwd(), 'uploads'));
console.log('path.join(__dirname, "uploads"):', path.join(__dirname, 'uploads'));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test endpoint',
    cwd: process.cwd(),
    dirname: __dirname,
    uploadPath: path.join(process.cwd(), 'uploads')
  });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});