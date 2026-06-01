import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessageChunk, createAgent } from 'langchain';

import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { UIMessage } from 'ai';

@Injectable()
export class AiService {
  private agent: ReturnType<typeof createAgent>;

  constructor(
    @Inject('CHAT_MODEL') private model: ChatOpenAI,
    @Inject('WEB_SEARCH_TOOL') private webSearchTool: any,
    @Inject('SEND_MAIL_TOOL') private sendMailTool: any,
  ) {
    this.agent = createAgent({
      model: this.model,
      tools: [this.webSearchTool, this.sendMailTool],
      systemPrompt:
        '你是一个专业的互联网搜索助手，能够使用 Bocha Web Search API 搜索互联网网页。',
    });
  }

  async stream(messages: UIMessage[]) {
    const lcMessages = await toBaseMessages(messages);
    const lgStream = await this.agent.stream(
      { messages: lcMessages },
      {
        streamMode: ['messages', 'values'],
        recursionLimit: 12,
      },
    );

    return toUIMessageStream(lgStream as AsyncIterable<AIMessageChunk>);
  }
}
