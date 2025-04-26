const express = require('express');
const fs = require('fs');
const path = require('path');
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

// Download or start extracting audio
app.get('/audio', (req, res) => {
  const { filename, format = 'mp3' } = req.query;
  if (!filename) return res.status(400).send('Missing filename query param');

  const inputPath = `/tmp/${filename}`;
  const baseName = filename.split('.').slice(0, -1).join('.');
  const outputPath = `/tmp/${baseName}.${format}`;

  let ffmpegCmd = '';

  if (format === 'mp3') {
    ffmpegCmd = `ffmpeg -y -i ${inputPath} -vn -acodec libmp3lame ${outputPath}`;
  } else if (format === 'wav') {
    ffmpegCmd = `ffmpeg -y -i ${inputPath} -vn ${outputPath}`;
  } else {
    return res.status(400).send('Unsupported audio format');
  }

  if (fs.existsSync(outputPath)) {
    const outputStat = fs.statSync(outputPath);
    const inputStat = fs.statSync(inputPath);

    if (outputStat.mtimeMs > inputStat.mtimeMs) {
      // Audio file is newer than video → audio is ready
      return res.status(201).send({
        message: 'Audio already exists and is up-to-date',
        outputPath,
        size: outputStat.size,
      });
    }
    // Otherwise, re-extract
  }

  // File not yet extracted or out of date → start ffmpeg async
  exec(ffmpegCmd, (err) => {
    if (err) {
      console.error('FFmpeg error:', err);
    } else {
      console.log('Audio extracted successfully:', outputPath);
    }
  });

  // Respond immediately while ffmpeg runs in background
  return res.status(202).send('Audio extraction started. Please check back soon.');
});

// Download any file by full path
app.get('/file', (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Start the server
app.listen(3000, () => console.log('Decoder service running on port 3000'));
