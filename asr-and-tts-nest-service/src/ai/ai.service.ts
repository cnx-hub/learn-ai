import { Injectable, Inject } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Runnable } from '@langchain/core/runnables';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AI_TTS_STREAM_EVENT, AiTtsStreamEvent } from '../common/stream-events';


@Injectable()
export class AiService {
  private readonly chain: Runnable;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    private readonly eventEmitter: EventEmitter2
  ) {
    const prompt = PromptTemplate.fromTemplate('请回答以下问题：\n\n{query}');
    this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  async *streamChain(query: string, ttsSessionId: string) {
    try {
      const stream = await this.chain.stream({ query });
      for await (const chunk of stream) {
        if (ttsSessionId) {
          const chunkEvent: AiTtsStreamEvent = {
            type: 'chunk',
            sessionId: ttsSessionId,
            chunk,
          };
          this.eventEmitter.emit(AI_TTS_STREAM_EVENT, chunkEvent);
        }
        yield chunk;
      }

      if (ttsSessionId) {
        const endEvent: AiTtsStreamEvent = { type: 'end', sessionId: ttsSessionId };
        this.eventEmitter.emit(AI_TTS_STREAM_EVENT, endEvent);
      }
    } catch (error) {
      if (ttsSessionId) {
        const errorEvent: AiTtsStreamEvent = {
          type: 'error',
          sessionId: ttsSessionId,
          error: error instanceof Error ? error.message : String(error),
        };
        this.eventEmitter.emit(AI_TTS_STREAM_EVENT, errorEvent);
      }
      throw error;
    }
  }
}
