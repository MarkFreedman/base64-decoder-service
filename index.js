const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const { exec } = require('child_process');

app.use(express.json({ limit: '100mb' }));

app.post('/decode', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).send('Missing base64 data');

  const buffer = Buffer.from(data, 'base64');
  const inputPath = '/tmp/input.mov';
  const outputPath = '/tmp/output.mp3';

  fs.writeFileSync(inputPath, buffer);

  console.log('Base64 decoded and input.mov saved.');

  // Now run ffmpeg to extract audio
  exec(`ffmpeg -i ${inputPath} -vn -acodec libmp3lame -q:a 2 ${outputPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`ffmpeg error: ${error.message}`);
      return res.status(500).send('Error extracting audio');
    }
    console.log('Audio extracted successfully.');
    res.send({ success: true, inputPath, outputPath });
  });
});

app.get('/download', (req, res) => {
  const filePath = '/tmp/input.mov';
  if (fs.existsSync(filePath)) {
    res.download(filePath); // prompts file download in browser
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/download-mp3', (req, res) => {
  const filePath = '/tmp/output.mp3';
  if (fs.existsSync(filePath)) {
    res.download(filePath); // prompts MP3 download
  } else {
    res.status(404).send('MP3 file not found');
  }
});

app.listen(3000, () => console.log('Base64 decoder running on port 3000'));
