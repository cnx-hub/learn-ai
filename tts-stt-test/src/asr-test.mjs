import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tencentcloud from "tencentcloud-sdk-nodejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(projectRoot, '..', '.env'), quiet: true });

const SECRET_ID = process.env.SECRET_ID;
const SECRET_KEY = process.env.SECRET_KEY;

const AsrClient = tencentcloud.asr.v20190614.Client;
const { Credential, ClientProfile, HttpProfile } = tencentcloud.common;
const AUDIO_FILE = path.resolve(projectRoot, process.env.ASR_AUDIO_FILE || 'output3.mp3');

const credential = new Credential(SECRET_ID, SECRET_KEY);
const httpProfile = new HttpProfile("https://", "asr.tencentcloudapi.com", "POST", 30);
const clientProfile = new ClientProfile("HmacSHA256", httpProfile);
const client = new AsrClient(credential, "ap-shanghai", clientProfile);

// const client = new AsrClient({
//   credential: {
//     secretId: SECRET_ID,
//     secretKey: SECRET_KEY,
//   },
//   region: "ap-shanghai",
//   profile: {
//     httpProfile: {
//       reqMethod: "POST",
//       reqTimeout: 30,
//     },
//   },
// });

function sentenceRecognition(params) {
  return new Promise((resolve, reject) => {
    client.SentenceRecognition(params, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(data);
    });
  });
}

async function run() {
  if (!SECRET_ID || !SECRET_KEY) {
    throw new Error('缺少 SECRET_ID 或 SECRET_KEY，请检查 tts-stt-test/.env 或上级 .env');
  }

  if (!fs.existsSync(AUDIO_FILE)) {
    throw new Error(`找不到音频文件：${AUDIO_FILE}`);
  }

  const audioBuffer = fs.readFileSync(AUDIO_FILE);
  const audioBase64 = audioBuffer.toString("base64");

  const params = {
    ProjectId: 0,
    SubServiceType: 2,
    EngSerViceType: "16k_zh",
    SourceType: 1,
    Data: audioBase64,
    DataLen: audioBuffer.length,
    VoiceFormat: "mp3",
  };

  const data = await sentenceRecognition(params);
  console.log("识别结果：", data.Result);
}

run().catch((err) => {
  console.error("识别失败：", err);
  process.exitCode = 1;
});
