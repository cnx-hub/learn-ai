import { Injectable, Inject } from '@nestjs/common';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Runnable } from '@langchain/core/runnables';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly chain: Runnable;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const prompt = PromptTemplate.fromTemplate('请回答以下问题：\n\n{query}');

    const model = new ChatOpenAI({
      temperature: 0.7,
      model: configService.get('MODEL_NAME'),
      apiKey: configService.get('OPENAI_API_KEY'),
      configuration: {
        baseURL: configService.get('OPENAI_BASE_URL'),
      },
    });

    this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  async runChain(query: string): Promise<string> {
    return this.chain.invoke({ query }) as Promise<string>;
  }

  create(createAiDto: CreateAiDto) {
    return 'This action adds a new ai';
  }

  findAll() {
    return `This action returns all ai`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ai`;
  }

  update(id: number, updateAiDto: UpdateAiDto) {
    return `This action updates a #${id} ai`;
  }

  remove(id: number) {
    return `This action removes a #${id} ai`;
  }
}
