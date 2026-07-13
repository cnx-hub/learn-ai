import { z } from "zod";
import { createMiddleware, createAgent, tool } from "langchain";
import { model } from "./model.mjs";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

const getCurrentTime = tool(
    () => {
        return new Date().toISOString();
    },
    {
        name: "getCurrentTime",
        description: "返回当前 UTC 时间的 ISO 8601 字符串",
        schema: z.object({}),
    },
);

const extendedToolsMiddleware = createMiddleware({
    name: "ExtendedToolsMiddleware",
    stateSchema: z.object({
        toolInvocationCount: z.number().default(0),
    }),
    tools: [getCurrentTime],
    wrapToolCall: async (request, handler) => {
        const toolName = request.tool?.name ?? request.toolCall.name;
        console.log(
            `[Tools] 即将执行: ${toolName}`,
            "args:",
            request.toolCall.args ?? {}
        );
        // 1. 执行工具调用
        const result = await handler(request);

        if (!ToolMessage.isInstance(result)) return result;

        const wrapped = new ToolMessage({
            content: `${result.content}\n[wrapToolCall] 已由 ExtendedToolsMiddleware 包装`,
            tool_call_id: result.tool_call_id,
            name: result.name,
        });

        console.log(
            `[Tools] 执行完成: ${toolName}`,
            typeof wrapped.content === "string"
                ? wrapped.content.slice(0, 120)
                : wrapped
        );

        // 3. 如果返回的是 ToolMessage，我们需要用 Command 包装它并更新 state
        return new Command({
            update: {
                messages: [wrapped],
                toolInvocationCount: request.state.toolInvocationCount + 1,
            },
        });
    },
    afterAgent: (state) => {
        console.log(
            `[ExtendedTools] agent 结束，累计工具调用: ${state.toolInvocationCount} 次\n`
        );
    }
});


const agent = createAgent({
    model,
    tools: [],
    systemPrompt:
        "你是一个助手。",
    middleware: [extendedToolsMiddleware],
});

for (const text of [
    "给我当前时间",
]) {
    console.log("\n用户:", text);
    const { messages, toolInvocationCount } = await agent.invoke({
        messages: [new HumanMessage(text)],
    });
    console.log("回复:", messages.at(-1)?.content);
    console.log("toolInvocationCount:", toolInvocationCount);
}