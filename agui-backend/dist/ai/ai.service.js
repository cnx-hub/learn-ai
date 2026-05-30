"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = require("@langchain/openai");
const langchain_1 = require("langchain");
const langchain_2 = require("@ai-sdk/langchain");
let AiService = class AiService {
    model;
    webSearchTool;
    agent;
    constructor(model, webSearchTool) {
        this.model = model;
        this.webSearchTool = webSearchTool;
        this.agent = (0, langchain_1.createAgent)({
            model: this.model,
            tools: [this.webSearchTool],
            systemPrompt: '你是一个专业的互联网搜索助手，能够使用 Bocha Web Search API 搜索互联网网页。',
        });
    }
    async stream(messages) {
        const lcMessages = await (0, langchain_2.toBaseMessages)(messages);
        const lgStream = await this.agent.stream({ messages: lcMessages }, {
            streamMode: ['messages', 'values'],
            recursionLimit: 12,
        });
        return (0, langchain_2.toUIMessageStream)(lgStream);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('CHAT_MODEL')),
    __param(1, (0, common_1.Inject)('WEB_SEARCH_TOOL')),
    __metadata("design:paramtypes", [openai_1.ChatOpenAI, Object])
], AiService);
//# sourceMappingURL=ai.service.js.map