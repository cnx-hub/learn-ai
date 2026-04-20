import { SystemMessagePromptTemplate, HumanMessagePromptTemplate, ChatPromptTemplate, PipelinePromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { personaPrompt, contextPrompt } from './pipeline-prompt-template.mjs';


const weeklyTaskPrompt = PromptTemplate.fromTemplate(
    `以下是本周与你所在团队相关的关键事实与数据（Git / Jira / 运维等）：
{dev_activities}

请你基于这些信息，帮我生成一份【技术周报】，重点包含：
1. 本周整体达成情况
2. 关键成果与亮点
3. 主要问题 / 风险
4. 下周的改进方向与优先级建议
`
);

const weeklyFormatPrompt = PromptTemplate.fromTemplate(
    `请用 Markdown 写这份周报，结构建议为：
1. 本周概览（2-3 句话）
2. 详细拆分（按项目或模块分段）
3. 关键指标表格（字段示例：模块 / 亮点 / 风险 / 下周计划）

语气要求：{tone}，既专业清晰，又适合发给老板并抄送团队。`
);

const systemTemplate = SystemMessagePromptTemplate.fromTemplate(
    `你是一名资深工程团队负责人，擅长把复杂的技术细节总结成结构化、易读的周报`,
)

const humanTemplate = HumanMessagePromptTemplate.fromTemplate(
    `人设与写作风格：
{persona_block}

团队与本周背景：
{context_block}

任务与输入数据：
{task_block}

输出格式要求：
{format_block}

现在请基于以上信息，直接输出最终的周报内容。`
)

const chatPrompt = ChatPromptTemplate.fromMessages([
    systemTemplate,
    humanTemplate,
]);

const navigatePrompt = new PipelinePromptTemplate({
    pipelinePrompts: [
        { name: 'persona_block', prompt: personaPrompt },
        { name: 'context_block', prompt: contextPrompt },
        { name: 'task_block', prompt: weeklyTaskPrompt },
        { name: 'format_block', prompt: weeklyFormatPrompt },
    ],
    finalPrompt: chatPrompt,
})

const chatMessages = await navigatePrompt.formatPromptValue({
    tone: '专业、清晰、略带鼓励',
    company_name: '星航科技',
    team_name: '智能应用平台组',
    manager_name: '王总',
    week_range: '2025-05-05 ~ 2025-05-11',
    team_goal: '完成内部 AI 助手灰度上线，并确保核心链路稳定。',
    dev_activities:
        '- 小李：完成 AI 助手工单流转能力，对接客服系统，提交 25 次\n' +
        '- 小张：接入日志检索和知识库查询，提交 19 次\n' +
        '- 小王：完善监控、告警与埋点，新增 10 条核心告警规则\n' +
        '- 实习生小陈：补充使用文档和 FAQ，支持 3 个内部试点团队',
});

console.log('另一种 chatMessage 写法：\n')
console.log(chatMessages.toChatMessages())


