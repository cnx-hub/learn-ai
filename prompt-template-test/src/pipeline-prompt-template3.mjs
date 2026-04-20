import { PipelinePromptTemplate, PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
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

const finalyWeeklyPrompt = ChatPromptTemplate.fromMessages([
    [
        'system',
        `你是一名资深工程团队负责人，擅长把复杂的技术细节总结成结构化、易读的周报`,
    ],
    [
        'human',
        `人设与写作风格：
{persona_block}

团队与本周背景：
{context_block}

任务与输入数据：
{task_block}

输出格式要求：
{format_block}

现在请基于以上信息，直接输出最终的周报内容。`,
    ]
])


const navigatePrompt = new PipelinePromptTemplate({
    pipelinePrompts: [
        { name: 'persona_block', prompt: personaPrompt },
        { name: 'context_block', prompt: contextPrompt },
        { name: 'task_block', prompt: weeklyTaskPrompt },
        { name: 'format_block', prompt: weeklyFormatPrompt },
    ],
    finalPrompt: finalyWeeklyPrompt,
});

const promptValue = await navigatePrompt.formatPromptValue(
    {
        tone: '专业、清晰、略带鼓励',
        company_name: '星航科技',
        team_name: 'AI 平台组',
        manager_name: '王总',
        week_range: '2025-05-12 ~ 2025-05-18',
        team_goal: '完成周报自动生成能力的灰度验证，并收集团队反馈。',
        dev_activities:
            '- Git：本周合并 4 个主要特性分支，包含 Prompt 配置化和日志观测优化\n' +
            '- Jira：关闭 9 个 Story / 5 个 Bug，新增 2 个 TechDebt 任务\n' +
            '- 运维：本周线上 P1 事故 0 起，P2 1 起（由配置变更引起，已完成复盘）\n' +
            '- 其他：完成与数据平台、运维平台两次联合评审会议',
    }
)

console.log('Pipeline + ChatPromptTemplate 生成的消息:');
console.log(promptValue.toChatMessages());
