const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const { exec } = require('child_process');

app.use(express.json({ limit: '100mb' }));

app.post('/decode', (req, res) => {
  const { data, filename } = req.body;
  if (!data || !filename) return res.status(400).send('Missing base64 data or filename');

  const inputPath = `/tmp/${filename}`;
  const buffer = Buffer.from(data, 'base64');
  fs.writeFileSync(inputPath, buffer);

  res.send({ success: true, inputPath, size: buffer.length });
});

app.get('/video', (req, res) => {
  const filePath = '/tmp/input.mov';
  if (fs.existsSync(filePath)) {
    res.download(filePath); // prompts file download in browser
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/audio', (req, res) => {
  const { filename } = req.query;
  if (!filename) return res.status(400).send('Missing filename query param');

  const inputPath = `/tmp/${filename}`;
  const outputPath = '/tmp/output.mp3';

  exec(`ffmpeg -i ${inputPath} -vn -acodec libmp3lame ${outputPath}`, (err) => {
    if (err) {
      console.error('FFmpeg error:', err);
      return res.status(500).send('Error extracting audio');
    }
    res.download(outputPath);
  });
});

app.listen(3000, () => console.log('Base64 decoder running on port 3000'));
