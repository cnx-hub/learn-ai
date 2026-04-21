import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../../.env'), quiet: true });

const VECTOR_DIM = 1024;

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    }
});

const embedding = new OpenAIEmbeddings({
    modelName: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL
    },
    dimensions: VECTOR_DIM,
})


export {
    model,
    embedding,
    VECTOR_DIM
}