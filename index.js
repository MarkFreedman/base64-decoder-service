const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json({ limit: '100mb' }));

app.post('/decode', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).send('Missing base64 data');

  const buffer = Buffer.from(data, 'base64');
  const outputPath = '/tmp/input.mov';
  fs.writeFileSync(outputPath, buffer);

  res.send({ success: true, path: outputPath, size: buffer.length });
});

app.listen(3000, () => console.log('Base64 decoder running on port 3000'));
