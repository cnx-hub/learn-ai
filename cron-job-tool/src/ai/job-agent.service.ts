import { Inject, Injectable, Logger } from "@nestjs/common";
import { ChatOpenAI } from '@langchain/openai';
import {
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';

@Injectable()
export class JobAgentService {
    private readonly logger = new Logger(JobAgentService.name);
    private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

    constructor(
        @Inject('CHAT_MODEL') model: ChatOpenAI,
        @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
        @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
        @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any,
        @Inject('TIME_NOW_TOOL') private readonly timeNowTool: any,
    ) {
        this.modelWithTools = model.bindTools([
            this.sendMailTool,
            this.webSearchTool,
            this.dbUsersCrudTool,
            this.timeNowTool,
        ]);
    }

    async runJob(instruction: string) {
        const messages: BaseMessage[] = [
            new SystemMessage(
                '你是一个用于执行后台任务的智能代理。你会根据给定的任务指令，必要时调用工具（如 db_users_crud、send_mail、web_search、time_now 等）来查询或改写数据，然后给出清晰的步骤和结果说明。',
            ),
            new HumanMessage(instruction),
        ];

        while (true) {
            const aiMessage = await this.modelWithTools.invoke(messages);
            messages.push(aiMessage);

            const toolCalls = aiMessage.tool_calls ?? [];

            if (!toolCalls.length) {
                return String(aiMessage.content ?? '');
            }

            for (const toolCall of toolCalls) {
                const toolCallId = toolCall.id || '';
                const toolName = toolCall.name;

                let result: any;
                try {
                    if (toolName === 'send_mail') {
                        result = await this.sendMailTool.invoke(toolCall.args);
                    } else if (toolName === 'web_search') {
                        result = await this.webSearchTool.invoke(toolCall.args);
                    } else if (toolName === 'db_users_crud') {
                        result = await this.dbUsersCrudTool.invoke(toolCall.args);
                    } else if (toolName === 'time_now') {
                        result = await this.timeNowTool.invoke({});
                    } else {
                        this.logger.warn(`未知工具调用: ${toolName}`);
                        continue;
                    }
                } catch (error) {
                    result = `工具调用失败: ${(error as Error).message}`;
                }

                const content = typeof result === 'string' ? result : JSON.stringify(result);
                messages.push(
                    new ToolMessage({
                        tool_call_id: toolCallId,
                        name: toolName,
                        content,
                    }),
                );
            }
        }
    }


}