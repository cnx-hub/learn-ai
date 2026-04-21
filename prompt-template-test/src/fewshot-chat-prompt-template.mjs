import { ChatPromptTemplate, FewShotChatMessagePromptTemplate } from '@langchain/core/prompts';

const EXAMPLES = [
    {
        input: '本周主要推进支付稳定性治理，做了事故处置、告警优化和演练。',
        output:
            '- 本周围绕支付链路稳定性开展治理工作：完成 1 起 P1 事故与 2 起 P2 事故的排查与修复，均在 SLA 内关闭；\n' +
            '- 梳理并合并冗余告警规则 8 条，新建 4 条基于 SLO 的告警，大幅降低无效告警噪音；\n' +
            '- 组织 1 次故障应急演练，验证支付核心链路的应急预案可行性。',
    },
    {
        input: '本周交付了新运营看板，并给业务同学做了多场分享。',
        output:
            '- 上线新一代「运营实时看板」，支持业务实时查看关键转化指标和漏斗数据；\n' +
            '- 衔接埋点、数据仓库与可视化链路，为后续精细化运营提供统一数据口径；\n' +
            '- 面向市场和运营团队组织 2 场产品培训，帮助非技术同学理解看板核心能力和使用场景。',
    },
];

const fewShotExamples = new FewShotChatMessagePromptTemplate({
    examples: EXAMPLES,
    examplePrompt: ChatPromptTemplate.fromMessages([
        [
            'human',
            '下面是本周的工作概述：\n{input}\n\n请帮我整理成适合发在团队周报里的要点列表。',
        ],
        [
            'ai', '{output}',
        ]
    ]),
    exampleSeparator: '\n\n', // 可选：示例之间的分隔符，仅影响 formatMessages 输出
    inputVariables: []
});

const chatPrompt = await fewShotExamples.formatPromptValue({});

console.log(chatPrompt.toChatMessages(), 'chatPrompt')