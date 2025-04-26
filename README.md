# Base64 Decoder and Audio Extractor Microservice

This Node.js microservice accepts a base64-encoded `.mov` video file, decodes it, saves it to disk, and extracts the audio as an `.mp3` file using `ffmpeg`. 

It is deployed via Elestio using GitHub CI/CD and Docker.

---

## 🚀 How It Works

### Endpoints

| Method | URL                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| POST   | `/decode`                   | Upload base64 video and save as `.mov` |
| GET    | `/download`                 | Download the saved `.mov` file         |
| GET    | `/download-mp3`             | Download the extracted `.mp3` file    |

---

## 🛠 Deployment Overview

### 1. Create GitHub Repository
Host your Node.js project and Dockerfile.

### 2. Microservice Code

**index.js**
```javascript
const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
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

app.get('/download', (req, res) => {
  res.download('/tmp/input.mov');
});

app.get('/download-mp3', (req, res) => {
  const inputPath = '/tmp/input.mov';
  const outputPath = '/tmp/output.mp3';

  exec(`ffmpeg -i ${inputPath} -vn -acodec libmp3lame ${outputPath}`, (err) => {
    if (err) return res.status(500).send('Error extracting audio');
    res.download(outputPath);
  });
});

app.listen(3000, () => console.log('Decoder service running on port 3000'));

### 3. Dockerfile

FROM node:20

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]

### 4. Elestio CI/CD Setup

	•	Create new CI/CD project
	•	Link to GitHub repository
	•	Switch Build Method to Docker Build (NOT “Full Stack App”)
	•	Confirm Dockerfile is detected
	•	Set exposed port to 3000
	•	Trigger deployment

✅ ffmpeg is automatically installed and ready inside the container.

### 5. n8n Integration Example

POST Request to /decode
	•	URL: https://your-elestio-service-url/decode
	•	Headers:
	•	Content-Type: application/json
	•	Body:

    {
      "data": "{{ $binary.data.data }}"
    }

GET Request to /download-mp3

After decoding, download the extracted .mp3:

https://your-elestio-service-url/download-mp3

🎯 Notes
	•	Ensure your input .mov file contains actual audio. Silent videos will still generate a valid .mp3, but it will be empty.
	•	Base64 payloads must not exceed your server’s body size limit (default limit here is 100mb).
	•	You can extend the service by adding authentication, auto-expiration of files, or additional media conversions.

📄 License

MIT License.
