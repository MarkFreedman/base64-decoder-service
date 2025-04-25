const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json({ limit: '100mb' }));

// Existing decode endpoint
app.post('/decode', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).send('Missing base64 data');

  const buffer = Buffer.from(data, 'base64');
  const outputPath = '/tmp/input.mov';
  fs.writeFileSync(outputPath, buffer);

  res.send({ success: true, path: outputPath, size: buffer.length });
});

// 🆕 Add this route to serve the file
app.get('/download', (req, res) => {
  const filePath = '/tmp/input.mov';
  if (fs.existsSync(filePath)) {
    res.download(filePath); // prompts file download in browser
  } else {
    res.status(404).send('File not found');
  }
});

app.listen(3000, () => console.log('Base64 decoder running on port 3000'));
