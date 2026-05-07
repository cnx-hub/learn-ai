import { Controller, Get, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service';
import { from, map, Observable } from 'rxjs';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('chat')
  async chat(@Query('query') query: string) {
    const res = await this.aiService.runChain(query);
    return { answer: res };
  }

  @Sse('chat/stream')
  chatStream(@Query('query') query: string): Observable<{ data: string }> {
    return from(this.aiService.runStreamChain(query)).pipe(
      map((chunk) => ({ data: chunk })),
    );
  }
}
