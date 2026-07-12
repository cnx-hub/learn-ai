import { ChatOpenAI } from "@langchain/openai";
import 'dotenv/config';

export const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.MODEL_NAME,
    configuration: {
        base: process.env.OPENAI_API_BASE,
    },
    temperature: 0,
});