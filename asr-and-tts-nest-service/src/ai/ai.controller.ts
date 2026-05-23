import { Controller, Sse, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { map, from, Observable } from 'rxjs'


@Controller('ai')
export class AiController {

    constructor(private readonly aiService: AiService) { }


    @Sse('chat/stream')
    chatStream(@Query('query') query: string): Observable<{ data: string }> {
        return from(this.aiService.streamChain(query)).pipe(
            map((chunk) => ({ data: chunk }))
        );
    }
}
