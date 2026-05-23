import { Injectable, Inject } from '@nestjs/common';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import tencentcloud from "tencentcloud-sdk-nodejs";
const ffmpegPath: string | null = require('ffmpeg-static');

type UploadedAudio = {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
};


type AsrClient = InstanceType<typeof tencentcloud.asr.v20190614.Client>;
@Injectable()
export class SpeechService {
    constructor(@Inject('ASR_CLIENT') private readonly asrClient: AsrClient) {

    }

    private convertToWav(buffer: Buffer, originalname?: string): Buffer {
        if (!ffmpegPath) {
            throw new Error('ffmpeg-static 未正确安装');
        }

        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asr-upload-'));
        const inputPath = path.join(workDir, originalname || 'input.bin');
        const outputPath = path.join(workDir, 'output.wav');

        try {
            fs.writeFileSync(inputPath, buffer);

            const result = spawnSync(ffmpegPath, [
                '-y',
                '-i', inputPath,
                '-ac', '1',
                '-ar', '16000',
                '-acodec', 'pcm_s16le',
                outputPath,
            ], { stdio: 'pipe' });

            if (result.status !== 0) {
                const stderr = result.stderr?.toString().trim();
                throw new Error(stderr || '音频转码失败');
            }

            return fs.readFileSync(outputPath);
        } finally {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    }

    async recognizeBySentence(file: UploadedAudio): Promise<string> {
        if (!file?.buffer?.length) {
            throw new Error('音频数据为空');
        }

        const wavBuffer = this.convertToWav(file.buffer, file.originalname);
        const audioBase64 = wavBuffer.toString('base64');
        const params = {
            ProjectId: 0,
            SubServiceType: 2,
            EngSerViceType: "16k_zh",
            SourceType: 1,
            Data: audioBase64,
            DataLen: wavBuffer.length,
            VoiceFormat: "wav",
        };

        const data = await this.asrClient.SentenceRecognition(params);

        return data.Result;
    }

}
