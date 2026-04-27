import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';

const mockUsers = new Map([
    [
        "user-123",
        {
            id: "user-123",
            name: "神光",
            email: "guang@example.com",
        },
    ],
]);

const fetchUserFromConfig = RunnableLambda.from((input, config) => {
    const userId = config.configurable.userId;

    console.log("【节点1】收到了通知内容:", input);
    console.log("【节点1】从 config 里拿到 userId:", userId);

    const user = userId ? mockUsers.get(userId) : null;

    if (!user) {
        throw new Error("未找到用户，无法发送通知");
    }

    return {
        user,
        notification: input,
    }
});

const checkPermissionByRole = RunnableLambda.from((state, config) => {
    const role = config?.configurable?.role ?? "普通用户";

    console.log("【节点2】当前角色:", role);

    const canSend =
        role === "管理员" ||
        role === "运营" ||
        role === "系统";

    if (!canSend) {
        throw new Error(`角色「${role}」无权限发送系统通知`);
    }

    return {
        ...state,
        role,
    }
})

const formatNotificationByLocale = RunnableLambda.from((state, config) => {
    const locale = config?.configurable?.locale ?? "zh-CN";

    console.log("【节点3】locale:", locale);

    let content;
    if (locale === "en-US") {
        content = `Dear ${state.user.name},\n\n${state.notification}\n\n(from role: ${state.role})`;
    } else {
        content = `亲爱的 ${state.user.name}，\n\n${state.notification}\n\n（发送人角色：${state.role}）`;
    }


    return {
        ...state,
        locale,
        finalContent: content,
    }
});

const chain = RunnableSequence.from([
    fetchUserFromConfig,
    checkPermissionByRole,
    formatNotificationByLocale
]);

const chainWithConfig = chain.withConfig({
    tags: ["demo", "withConfig", "notification"],
    metadata: {
        demoName: "RunnableWithConfig",
    },
    configurable: {
        userId: "user-123",
        role: "管理员",
        locale: "zh-CN",
    }
});

const chainWithConfig2 = chain.withConfig({
    configurable: {
        userId: "user-123",
        role: "运营",
        locale: "en-US",
    }
});

// 输入为"要发送的通知文案"
const result = await chainWithConfig.invoke("你有一条新的系统通知，请及时查看。");
console.log("✅ 最终通知内容:\n", result.finalContent);

console.log("\n--- chainWithConfig2 ---\n");

const result2 = await chainWithConfig2.invoke("System maintenance scheduled tonight.");
console.log("✅ 最终通知内容:\n", result2.finalContent);