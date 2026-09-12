import { HumanMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import 'dotenv/config';

const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'qwen3-omni-30b-a3b-captioner',
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
});

const response = await model.invoke([
    new HumanMessage({
        content: [
            {
                type: 'input_audio',
                input_audio: {
                    data: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/tixcef/cherry.wav',
                },
            }
        ]
    })
])

console.log('model: qwen3-omni-30b-a3b-captioner');
console.log(response.content);