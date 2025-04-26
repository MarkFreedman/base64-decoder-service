const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();

app.use(express.json({ limit: '100mb' }));

// Upload and decode base64 video
app.post('/decode', (req, res) => {
  const { data, filename } = req.body;
  if (!data || !filename) return res.status(400).send('Missing base64 data or filename');

  const inputPath = `/tmp/${filename}`;
  const buffer = Buffer.from(data, 'base64');
  fs.writeFileSync(inputPath, buffer);

  res.send({ success: true, inputPath, size: buffer.length });
});

// Download saved video
app.get('/video', (req, res) => {
  const { filename } = req.query;
  if (!filename) return res.status(400).send('Missing filename query param');

  const filePath = `/tmp/${filename}`;
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('Video file not found');
  }
});

// Download extracted audio
app.get('/audio', (req, res) => {
  const { filename, format = 'mp3' } = req.query;
  if (!filename) return res.status(400).send('Missing filename query param');

  const inputPath = `/tmp/${filename}`;
  const outputPath = `/tmp/output.${format}`;

  let ffmpegCmd = '';

  if (format === 'mp3') {
    ffmpegCmd = `ffmpeg -i ${inputPath} -vn -acodec libmp3lame ${outputPath}`;
  } else if (format === 'wav') {
    ffmpegCmd = `ffmpeg -i ${inputPath} -vn ${outputPath}`;
  } else {
    return res.status(400).send('Unsupported audio format');
  }

  exec(ffmpegCmd, (err) => {
    if (err) {
      console.error('FFmpeg error:', err);
      return res.status(500).send('Error extracting audio');
    }
    res.download(outputPath);
  });
});

app.listen(3000, () => console.log('Decoder service running on port 3000'));
