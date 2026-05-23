import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { SpeechService } from './speech.service';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('speech')
export class SpeechController {

    constructor(private readonly speechService: SpeechService) {
    }

    @Post('asr')
    @UseInterceptors(FileInterceptor('audio'))
    async recognize(
        @UploadedFile()
        file?: {
            buffer: Buffer;
            originalname: string;
            mimetype: string;
            size: number;
        },
    ) {
        if (!file?.buffer?.length) {
            throw new BadRequestException(
                '请通过 FormData 的 audio 字段上传音频文件',
            );
        }

        const text = await this.speechService.recognizeBySentence(file);
        return { text };
    }
}
