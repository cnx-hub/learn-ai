import { model } from './initConfig.mjs';


const prompt = `详细介绍莫扎特的信息。`;


console.log("🌊普通流式输出演示（无结构化）\n");

try {
    const stream = await model.stream(prompt);
    console.log(stream);
    let fullContent = '';
    let chunkCount = 0;
    console.log("📡 接收流式数据:\n");

    for await (let chunk of stream) {
        chunkCount++;
        const content = chunk.content;
        fullContent += content;
        console.log(`第 ${chunkCount} 块数据: ${content}`);

        process.stdout.write(content);
    }

    console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);
    console.log(`📝 完整内容: ${fullContent}`);
} catch (error) {
    console.log('流式解析错误：', error.message);
}
