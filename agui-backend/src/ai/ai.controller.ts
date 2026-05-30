import { BadRequestException, Body, Controller, Get, Post, Query, Res, Sse } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { pipeUIMessageStreamToResponse, UIMessage } from 'ai';

@Controller('ai')
export class AiController {
    
    constructor(private readonly aiService: AiService) { }


    @Post('chat')
    async chat(
        @Body() body: { messages?: UIMessage[] },
        @Res({ passthrough: false }) res: Response,

    ): Promise<void> {
        if (!body?.messages || !Array.isArray(body.messages)) {
            throw new BadRequestException('Invalid JSON');
        }

        const stream = await this.aiService.stream(body.messages);
        pipeUIMessageStreamToResponse({ response: res, stream });
    }
}
