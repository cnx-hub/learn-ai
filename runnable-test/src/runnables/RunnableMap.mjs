import { RunnableLambda, RunnableMap } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';

const addOne = RunnableLambda.from((input) => {
    console.log(`输入: ${JSON.stringify(input)}`);
    return input?.num + 1;
});

const multiplyTwo = RunnableLambda.from((input) => input?.num * 2);
const square = RunnableLambda.from((input) => Math.pow(input?.num, 2));


const greetTemplate = PromptTemplate.fromTemplate("你好，{name}！");
const weatherTemplate = PromptTemplate.fromTemplate("今天天气{weather}。");

const chain = RunnableMap.from(
    {
        // 数学运算
        add: addOne,
        multiply: multiplyTwo,
        square: square,

        // prompt 格式化
        greeting: greetTemplate,
        weather: weatherTemplate,
    }
);

// 测试输入
const input = {
    name: "神光",
    weather: "多云",
    num: 5,
};

const result = await chain.invoke(input);

console.log(result, 'result');