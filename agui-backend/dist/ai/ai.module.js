"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const ai_controller_1 = require("./ai.controller");
const ai_service_1 = require("./ai.service");
const config_1 = require("@nestjs/config");
const openai_1 = require("@langchain/openai");
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        controllers: [ai_controller_1.AiController],
        providers: [ai_service_1.AiService,
            {
                provide: 'CHAT_MODEL',
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    return new openai_1.ChatOpenAI({
                        apiKey: configService.get('OPENAI_API_KEY'),
                        model: configService.get('MODEL_NAME'),
                        temperature: 0.5,
                        configuration: {
                            baseURL: configService.get('OPENAI_BASE_URL'),
                        }
                    });
                },
            },
            {
                provide: 'WEB_SEARCH_TOOL',
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const schema = zod_1.z.object({
                        query: zod_1.z
                            .string()
                            .min(1)
                            .describe('搜索关键词，例如：公司年报、某个事件等'),
                        count: zod_1.z
                            .number()
                            .int()
                            .min(1)
                            .max(20)
                            .optional()
                            .describe('返回的搜索结果数量，默认 10 条'),
                    });
                    return (0, tools_1.tool)(async ({ query, count }) => {
                        const apiKey = configService.get('BOCHA_API_KEY');
                        if (!apiKey) {
                            return 'Bocha Web Search 的 API Key 未配置（环境变量 BOCHA_API_KEY），请先在服务端配置后再重试。';
                        }
                        const url = 'https://api.bochaai.com/v1/web-search';
                        const body = {
                            query,
                            freshness: 'noLimit',
                            summary: true,
                            count: count ?? 10,
                        };
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${apiKey}`,
                            },
                            body: JSON.stringify(body),
                        });
                        if (!response.ok) {
                            return `Bocha Web Search API 请求失败，状态码：${response.status}`;
                        }
                        let json;
                        try {
                            json = (await response.json());
                        }
                        catch (e) {
                            return `搜索 API 请求失败，原因是：搜索结果解析失败 ${e.message}`;
                        }
                        try {
                            if (json.code !== 200 || !json.data) {
                                return `搜索 API 请求失败，原因是: ${json.msg ?? '未知错误'}`;
                            }
                            const webpages = json.data.webPages?.value ?? [];
                            if (!webpages.length) {
                                return '未找到相关结果。';
                            }
                            const formatted = webpages
                                .map((page, idx) => `引用: ${idx + 1}
标题: ${page.name}
URL: ${page.url}
摘要: ${page.summary}
网站名称: ${page.siteName}
网站图标: ${page.siteIcon}
发布时间: ${page.dateLastCrawled}`)
                                .join('\n\n');
                            return formatted;
                        }
                        catch (e) {
                            return `搜索 API 请求失败，原因是：搜索结果解析失败 ${e.message}`;
                        }
                    }, {
                        name: 'web_search',
                        schema,
                        description: '使用 Bocha Web Search API 搜索互联网网页。输入为搜索关键词（可选 count 指定结果数量），返回包含标题、URL、摘要、网站名称、图标和时间等信息的结果列表。'
                    });
                },
            }
        ]
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map