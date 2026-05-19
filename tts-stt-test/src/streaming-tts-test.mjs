
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
    path: path.resolve(__dirname, "..", '..', ".env"),
    quiet: true
});

const APP_ID = process.env.APP_ID;
const SECRET_ID = process.env.SECRET_ID;
const SECRET_KEY = process.env.SECRET_KEY;
const VOICE_TYPE = 603004;

function buildWsUrl() {
    const now = Math.floor(Date.now() / 1000);
    const sessionId = `session_${now}_${Math.random().toString(36).slice(2)}`;

    const params = {
        Action: "TextToStreamAudioWSv2",
        AppId: parseInt(APP_ID),
        Codec: "mp3",
        Expired: now + 3600,
        SampleRate: 16000,
        SecretId: SECRET_ID,
        SessionId: sessionId,
        Speed: 0,
        Timestamp: now,
        VoiceType: VOICE_TYPE,
        Volume: 5,
    };

    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
    const rawStr = `GETtts.cloud.tencent.com/stream_wsv2?${signStr}`;
    const signature = crypto
        .createHmac("sha1", SECRET_KEY)
        .update(rawStr)
        .digest("base64");
    const searchParams = new URLSearchParams({
        ...params,
        Signature: signature,
    });

    return {
        sessionId,
        url: `wss://tts.cloud.tencent.com/stream_wsv2?${searchParams.toString()}`,
    };

}

try {
    const res = buildWsUrl();
} catch (error) {
    console.error(error);

}