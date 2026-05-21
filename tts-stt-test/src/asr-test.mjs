import dotenv from 'dotenv';
import fs from 'fs';
import tencentcloud from "tencentcloud-sdk-nodejs";

const __dirname = import.meta.dirname;
dotenv.config({ path: `${__dirname}/../../.env`, quiet: true });

const SECRET_ID = process.env.SECRET_ID;
const SECRET_KEY = process.env.SECRET_KEY;

const AUDIO_FILE = './output3.mp3'

const AsrClient = tencentcloud.asr.v20190614.Client;
const client = new AsrClient({
    credential: {
        secretId: SECRET_ID,
        secretKey: SECRET_KEY,
    },
    region: "ap-shanghai",
    profile: {
        httpProfile: {
            reqMethod: "POST",
            reqTimeout: 30,
        },
    },
});

async function run() {
    if (!SECRET_ID || !SECRET_KEY) {
        throw new Error("请先在 .env 配置 SECRET_ID、SECRET_KEY、APP_ID");
    }

    try {
        const audioBase64 = fs.readFileSync(AUDIO_FILE).toString("base64");

        const params = {
            EngSerViceType: "16k_zh",
            SourceType: 1,
            Data: audioBase64,
            DataLen: Buffer.byteLength(audioBase64),
            VoiceFormat: "mp3",
        };

        const data = await new Promise((resolve, reject) => {
            client.SentenceRecognition(params, (err, response) => {
                if (err) reject(err);
                else resolve(response);
            });
        });
        console.log("识别结果：", data.Result);
    } catch (error) {
        console.error("识别失败：", error);

    }
}

run();
