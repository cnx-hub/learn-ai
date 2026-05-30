import { ChatOpenAI } from '@langchain/openai';
import { UIMessage } from 'ai';
export declare class AiService {
    private model;
    private webSearchTool;
    private agent;
    constructor(model: ChatOpenAI, webSearchTool: any);
    stream(messages: UIMessage[]): Promise<ReadableStream<import("ai").UIMessageChunk>>;
}
