import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url'
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import z from 'zod';
import { RunnableSequence } from "@langchain/core/runnables";


const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env'), quiet: true });

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    }
});

const schema = z.object({
    translation: z.string().describe("翻译后的英文文本"),
    keywords: z.array(z.string()).length(3).describe("3个关键词")
});

const paser = StructuredOutputParser.fromZodSchema(schema);


const promptTemplate = PromptTemplate.fromTemplate(
    '将以下文本翻译成英文，然后总结为3个关键词。\n\n文本：{text}\n\n{format_instructions}'
)

const chain = RunnableSequence.from([
    promptTemplate,
    model,
    paser
]);

// pipe 内部也是 runnable
// const chain = promptTemplate.pipe(model).pipe(paser)

const input = {
    text: 'LangChain 是一个强大的 AI 应用开发框架',
    format_instructions: paser.getFormatInstructions()
};

const result = await chain.invoke(input)

console.log('✅ 最终结果:');
console.log(result);
