/**
 * 统一数据框架入口 — 所有对话数据的唯一 储存/调用/修改/展示 通路
 * 使用：
 *   import { repository } from './data/repository'; // 写
 *   import { computeOverview, computeStats } from './data/computed'; // 读派生
 *   import { on, DataEvents } from './data/events'; // 订阅
 */
export * from './types';
export * from './repository';
export * from './computed';
export * from './events';
