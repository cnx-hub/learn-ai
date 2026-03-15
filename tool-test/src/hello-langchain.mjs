import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ChatOpenAI } from "@langchain/openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
// console.log(__dirname,'dirname');
dotenv.config({ path: join(__dirname, '../../.env') });

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME || 'qwen-coder-turbo',
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    }
});

const response = await model.invoke("介绍下自己");
console.log(response.content);