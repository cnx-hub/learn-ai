import type { Response } from 'express';
import { AiService } from './ai.service';
import { UIMessage } from 'ai';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    chat(body: {
        messages?: UIMessage[];
    }, res: Response): Promise<void>;
}
