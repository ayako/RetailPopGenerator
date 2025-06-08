import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateInputs, generateImage, editImage, generateVideo } from './generator.js';

// __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(bodyParser.json({ limit: '1mb' }));
// Serve all files in this directory as static (index.html, app.js, styles.css, generated JPGs)
app.use(express.static(__dirname));

// Load template.json for front-end
app.get('/template.json', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'template.json'));
});

// Endpoint to generate chat inputs
app.post('/api/generateInputs', async (req, res) => {
  const { objectives } = req.body;
  try {
    const parsed = await generateInputs(objectives);
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to generate image and return file path
app.post('/api/generateImage', async (req, res) => {
  const { prompt, template } = req.body;
  try {
    // save image to JPG on server
    const name = (template || 'default').replace(/[^\w\-]/g, '');
    const fileName = `pop_image_${name}.jpg`;
    const filePath = path.join(__dirname, fileName);
    await generateImage(prompt, filePath);
    // return URL for client to fetch
    res.json({ url: `/${fileName}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to edit image and return file path
app.post('/api/editImage', async (req, res) => {
  const { prompt, filePath } = req.body;
  try {
    await editImage(prompt, filePath);
    res.json({ url: `/${filePath}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to generate video and return file path
app.post('/api/generateVideo', async (req, res) => {
  const { prompt, template } = req.body;
  try {
    // save image to JPG on server
    const name = (template || 'default').replace(/[^\w\-]/g, '');
    const fileName = `pop_video_${name}.mp4`;
    const filePath = path.join(__dirname, fileName);
    await generateVideo(prompt, filePath);
    // return URL for client to fetch
    res.json({ url: `/${fileName}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
