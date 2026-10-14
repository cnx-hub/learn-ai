import { ValueTransformer } from 'typeorm';

export const bigintTransformer: ValueTransformer = {
  to: (v) => v, // 写入：原样交给驱动
  from: (v) => (v == null ? v : String(v)), // 读出：统一转成 string
};
