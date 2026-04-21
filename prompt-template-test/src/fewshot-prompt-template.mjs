import { FewShotPromptTemplate, PromptTemplate } from "@langchain/core/prompts";

const examplePrompt = PromptTemplate.fromTemplate(
    `用户输入：{user_requirement}
期望周报结构：{expected_style}
模型示例输出片段：
{report_snippet}
---`
);

// 3. 准备几条示例数据（few-shot examples）
const examples = [
    {
        user_requirement:
            '重点突出稳定性治理，本周主要在修 Bug 和清理技术债，适合发给偏关注风险的老板。',
        expected_style: '语气稳健、偏保守，多强调风险识别和已做的兜底动作。',
        report_snippet:
            `- 支付链路本周共处理线上 P1 Bug 2 个、P2 Bug 3 个，全部在 SLA 内完成修复；\n` +
            `- 针对历史高频超时问题，完成 3 个核心接口的超时阈值和重试策略优化；\n` +
            `- 清理 12 条重复/噪音告警，减少值班同学 30% 的告警打扰。`,
    },
    {
        user_requirement:
            '偏向对外展示成果，希望多写一些亮点，适合发给更大范围的跨部门同学。',
        expected_style: '语气积极、突出成果，对技术细节做适度抽象。',
        report_snippet:
            `- 新上线「订单实时看板」，业务侧可以实时查看核心转化漏斗；\n` +
            `- 首次打通埋点 → 数据仓库 → 实时服务链路，为后续精细化运营提供基础能力；\n` +
            `- 和产品、运营一起完成 2 场内部分享，会后收到 15 条正向反馈。`,
    },
];

const fewShotPrompt = new FewShotPromptTemplate({
    examples,
    examplePrompt: examplePrompt,
    prefix:
        `下面是几条已经写好的【周报示例】，你可以从中学习语气、结构和信息组织方式：\n`,
    suffix:
        `\n当前用户需求：{user_requirement}` +
        `\n期望语气/风格：{expected_style}` +
        `\n基于上面的示例风格，请帮我写一份新的周报。` +
        `\n如果用户有额外要求，请在满足要求的前提下，尽量保持示例中的结构和条理性。`,
    inputVariables: ['user_requirement', 'expected_style'],
});

// format 中的 value 只会用于渲染 prefix 和 suffix 的占位符
// examples 是固定数组不会因为 format 传参变化而变化

const fewShotBlock = await fewShotPrompt.format({
    user_requirement: '本周重点是 AI 助手灰度上线后的稳定性治理与问题闭环',
    expected_style: '语气专业克制，强调风险识别、修复动作和下周计划',
});

console.log(fewShotBlock);
