import { RunnableSequence, RunnablePassthrough, RunnablePick } from '@langchain/core/runnables';

const inputData = {
    name: "神光",
    age: 30,
    city: "北京",
    country: "中国",
    email: "shenguang@example.com",
    phone: "+86-13800138000",
};

const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
        fullInfo: (input) => `${input.name}，${input.age}岁，来自${input.city}`,
    }),
    new RunnablePick(['fullInfo'])
])

const res = await chain.invoke(inputData);
console.log(res)