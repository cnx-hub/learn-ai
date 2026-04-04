import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL
    }
});


async function fileHistoryDemo() {

    // 系统提示词
    const systemMessage = new SystemMessage(
        "你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。"
    );

    const filePath = join(process.cwd(), 'chat_history.json');
    const sessionId = 'user_session_001';
    const userId = 'user_001'

    const history = new FileSystemChatMessageHistory({
        filePath,
        userId,
        sessionId,
    });

    const restoredMessages = await history.getMessages();
    console.log(`从文件恢复了 ${restoredMessages.length} 条历史消息：`);
    restoredMessages.forEach((msg, index) => {
        const type = msg.type;
        const prefix = type === 'human' ? '用户' : '助手';
        console.log(`  ${index + 1}. [${prefix}]: ${msg.content.substring(0, 50)}...`);
    });


    console.log("[第三轮对话]");
    const userMessage3 = new HumanMessage(
        "需要哪些食材？"
    );
    history.addMessage(userMessage3);
    const messages3 = [systemMessage, ...(await history.getMessages())];

    const response3 = await model.invoke(messages3);
    history.addMessage(response3);

    console.log(`用户: ${userMessage3.content}`);
    console.log(`助手: ${response3.content}`);
    console.log(`✓ 对话已保存到文件\n`);

};

fileHistoryDemo().catch(console.error)
