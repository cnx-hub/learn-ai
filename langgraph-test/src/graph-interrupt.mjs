import { Annotation, StateGraph, START, END, interrupt, MemorySaver, Command } from "@langchain/langgraph";
import { createInterface } from "node:readline/promises";

const StateAnnotation = Annotation.Root({
    actionSummary: Annotation({
        reducer: (_prev, next) => next,
        default: () => "",
    }),
    userInput: Annotation({
        reducer: (_prev, next) => next,
        default: () => "",
    }),
});

const showTransfer = () => {
    console.log('showTransfer')
    return { actionSummary: "向张三转账 ¥100（模拟，不会真扣款）" }
}

const waitConfirm = (state) => {
    console.log('waitConfirm  ---> start')
    const text = interrupt({
        hint: "终端里输入「确认」或备注后回车，图才会继续",
        actionSummary: state.actionSummary,
    })
    console.log('waitConfirm  ---> end')

    return { userInput: String(text) };
}

const graph = new StateGraph(StateAnnotation)
    .addNode('showTransfer', showTransfer)
    .addNode('waitConfirm', waitConfirm)
    .addEdge(START, 'showTransfer')
    .addEdge('showTransfer', 'waitConfirm')
    .addEdge('waitConfirm', END)
    // .compile();
    .compile({ checkpointer: new MemorySaver() });

// 使用 interrupt 必须配有 checkpointer


const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const config = { configurable: { thread_id: "interrupt-demo" } };


const paused = await graph.invoke({}, config);
console.log("\n待你确认：", paused.__interrupt__?.[0]?.value);
// console.log('xxxx', paused);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const line = (await rl.question(">= ")).trim();
await rl.close();

if (!line) {
    console.error("未输入，退出。");
    process.exit(1);
}

const done = await graph.invoke(new Command({ resume: line }), config);
console.log("结果：", done);

