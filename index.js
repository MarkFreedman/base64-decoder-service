const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const {
  RekognitionClient,
  StartLabelDetectionCommand,
  GetLabelDetectionCommand,
} = require('@aws-sdk/client-rekognition');

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(bodyParser.json());

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

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
    const stat = fs.statSync(filePath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Length', stat.size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
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

  let ffmpegCmd;

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
      return res.status(201).send({
        message: 'Audio already exists and is up-to-date',
        outputPath,
        size: outputStat.size,
      });
    }
  }

  exec(ffmpegCmd, (err) => {
    if (err) {
      console.error('FFmpeg error:', err);
    } else {
      console.log('Audio extracted successfully:', outputPath);
    }
  });

  return res.status(202).send('Audio extraction started. Please check back soon.');
});

// Download any file by full path
app.get('/file', (req, res) => {
  const { filePath } = req.query;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Start a label-detection Rekognition job
app.post('/rekognition/start', async (req, res) => {
  const { bucket, key } = req.body;
  if (!bucket || !key) {
    return res.status(400).json({ error: 'Missing bucket or key in request body' });
  }
  try {
    const command = new StartLabelDetectionCommand({
      Video: { S3Object: { Bucket: bucket, Name: key } },
      ClientRequestToken: `${Date.now()}`,       // simple idempotency token
      JobTag: `n8n-${key}`,                      // optional tag for console lookup
    });
    const { JobId } = await rekognition.send(command);
    res.json({ jobId: JobId });
  } catch (err) {
    console.error('StartLabelDetection error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get the results of a Rekognition job
app.get('/rekognition/result/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    const command = new GetLabelDetectionCommand({
      JobId: jobId,
      MaxResults: 1000,
      SortBy: 'TIMESTAMP',
    });
    const data = await rekognition.send(command);
    // flatten the Labels array for easy consumption
    const labels = (data.Labels || []).map(item => ({
      Timestamp: item.Timestamp,
      Name: item.Label.Name,
      Confidence: item.Label.Confidence,
    }));
    res.json({
      status: data.JobStatus,  // IN_PROGRESS, SUCCEEDED, or FAILED
      labels,
    });
  } catch (err) {
    console.error('GetLabelDetection error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(3000, () => console.log('Decoder service running on port 3000'));
