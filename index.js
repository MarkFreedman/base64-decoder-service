const express = require('express');
const fs = require('fs');
const path = require('path');
const { execCommand } = require('./utils/execCommand');
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
app.post('/audio', async (req, res) => {
  const { filename, format = 'mp3' } = req.query;
  if (!filename) return res.status(400).send('Missing filename query param');

  const inputPath = `/tmp/${filename}`;
  const baseName = path.parse(filename).name;
  const outputPath = `/tmp/${baseName}.${format}`;

  try {
    // Check if the output file already exists and is newer than input
    if (fs.existsSync(outputPath)) {
      const inputStats = fs.statSync(inputPath);
      const outputStats = fs.statSync(outputPath);

      if (outputStats.mtimeMs >= inputStats.mtimeMs) {
        // Audio already exists and is fresh
        return res.status(201).json({
          message: 'Audio already exists and is up-to-date',
          outputPath,
          size: outputStats.size
        });
      }
    }

    // Start extraction using execCommand
    let ffmpegCmd = '';

    if (format === 'mp3') {
      ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame "${outputPath}"`;
    } else if (format === 'wav') {
      ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vn "${outputPath}"`;
    } else {
      return res.status(400).send('Unsupported audio format');
    }

    // Kick off ffmpeg asynchronously
    execCommand(ffmpegCmd)
      .then(() => console.log(`Audio extracted successfully: ${outputPath}`))
      .catch((err) => console.error(`FFmpeg error:`, err));

    return res.status(202).json({
      message: 'Audio extraction started',
      inputPath,
      outputPath
    });
  } catch (error) {
    console.error('Error in /audio endpoint:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the server
app.listen(3000, () => console.log('Decoder service running on port 3000'));
