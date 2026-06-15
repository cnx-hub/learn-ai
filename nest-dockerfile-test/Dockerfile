# ============================================
# 构建阶段：需要完整依赖来编译 TypeScript
# ============================================
FROM node:24.15-alpine AS builder

# 设置工作目录
WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存
COPY package*.json ./

# 设置淘宝镜像源，加速依赖安装
RUN npm config set registry https://registry.npmmirror.com/

# 安装所有依赖（包括 devDependencies）
RUN npm install

# 复制项目源码
COPY . .

# 构建 Nest 项目（编译成 JavaScript）
RUN npm run build

# ============================================
# 生产阶段：只包含运行时需要的内容，镜像更小
# ============================================
FROM node:24.15-alpine

# 设置生产环境
ENV NODE_ENV=production

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 设置淘宝镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 只安装生产依赖（不包含 devDependencies）
RUN npm install --production

# 从构建阶段复制编译后的代码
COPY --from=builder /app/dist ./dist

# 声明暴露的端口
EXPOSE 3000

# 启动应用
CMD ["node", "dist/main.js"]
