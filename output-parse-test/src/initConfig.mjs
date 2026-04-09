import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { ChatOpenAI } from '@langchain/openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env'), quiet: true });

const model = new ChatOpenAI({
    apiKey: process.env.API_KEY,
    modelName: process.env.MODEL_NAME,
    configuration: {
        baseURL: process.env.BASE_URL,
    }
});

export {
    model
}
