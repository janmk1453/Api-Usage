/**
 * 请求发起方判定 —— 纯逻辑单测
 *
 * 只覆盖栈解析：真实栈帧形态取自 ST 扩展（module script，路径带 ?ver）与酒馆助手
 * （srcdoc iframe）的实际统计。抓栈本身依赖宿主，交给真机验证。
 */
import { describe, it, expect } from 'vitest';
import { originFromStack, pluginNameFromPath, registerRequestOriginSelf } from './request-origin';

const EXT_FRAME = '    at Object.<anonymous> (http://127.0.0.1:8000/scripts/extensions/third-party/ST-BaiBai-Image/dist/index.js?ver=0.3.6:1:15320)';
const SELF_FRAME = '    at patched (http://127.0.0.1:8000/scripts/extensions/third-party/Api-Usage/dist/index-abc123.js:1:8402)';
const TAVERN_FRAME = '    at sendOpenAIRequest (http://127.0.0.1:8000/scripts/openai.js:1:120034)';
const GENERATE_FRAME = '    at Generate (http://127.0.0.1:8000/script.js:1:99001)';
const SRCDOC_FRAME = '    at run (about:srcdoc:12:34)';

describe('pluginNameFromPath', () => {
  it('取出扩展目录名，忽略查询串', () => {
    expect(pluginNameFromPath(EXT_FRAME)).toBe('ST-BaiBai-Image');
    expect(pluginNameFromPath('/scripts/extensions/third-party/JS-Slash-Runner/index.js')).toBe('JS-Slash-Runner');
  });
  it('非第三方路径返回 null', () => {
    expect(pluginNameFromPath('/scripts/openai.js')).toBeNull();
    expect(pluginNameFromPath('about:srcdoc')).toBeNull();
  });
});

describe('originFromStack', () => {
  it('扩展直连：没有酒馆帧时认出扩展目录名', () => {
    const stack = 'Error\n' + SELF_FRAME + '\n' + EXT_FRAME;
    expect(originFromStack(stack)).toMatchObject({ kind: 'extension', label: 'ST-BaiBai-Image' });
  });

  it('扩展经酒馆 generateRaw 转发：扩展帧在酒馆帧外层，仍算扩展发起', () => {
    const stack = ['Error', SELF_FRAME, TAVERN_FRAME, GENERATE_FRAME, EXT_FRAME].join('\n');
    expect(originFromStack(stack)).toMatchObject({ kind: 'extension', label: 'ST-BaiBai-Image' });
  });

  it('酒馆主流程：只有主链脚本时归为酒馆主界面', () => {
    const stack = ['Error', SELF_FRAME, TAVERN_FRAME, GENERATE_FRAME].join('\n');
    expect(originFromStack(stack)).toMatchObject({ kind: 'tavern', label: '酒馆主界面' });
  });

  it('扩展自己直连、被酒馆 UI 事件触发：酒馆帧在扩展外层，仍算扩展', () => {
    // 实测形态：扩展按钮回调 → ExtA.directFetch → fetch，栈里没有酒馆发送帧
    const stack = ['Error', SELF_FRAME, EXT_FRAME, GENERATE_FRAME].join('\n');
    expect(originFromStack(stack)).toMatchObject({ kind: 'extension', label: 'ST-BaiBai-Image' });
  });

  it('酒馆助手脚本调用酒馆 API：srcdoc 帧在酒馆帧外层，归为脚本', () => {
    const stack = ['Error', SELF_FRAME, TAVERN_FRAME, GENERATE_FRAME, SRCDOC_FRAME].join('\n');
    expect(originFromStack(stack)).toMatchObject({ kind: 'script' });
  });

  it('脚本只包装了 fetch、真正发起者是酒馆：srcdoc 帧在酒馆帧内层，判酒馆而不是脚本', () => {
    const stack = ['Error', SELF_FRAME, SRCDOC_FRAME, TAVERN_FRAME].join('\n');
    expect(originFromStack(stack)).toMatchObject({ kind: 'tavern' });
  });

  it('自身帧不算来源：全是 Api-Usage 自己的帧时返回 null', () => {
    expect(originFromStack('Error\n' + SELF_FRAME + '\n' + SELF_FRAME)).toBeNull();
  });

  it('认不出就不认：空栈与无关帧返回 null', () => {
    expect(originFromStack('')).toBeNull();
    expect(originFromStack('Error\n    at <anonymous>:1:1')).toBeNull();
  });
});

describe('registerRequestOriginSelf', () => {
  it('注册自身脚本后，同目录帧不再被当成第三方扩展', () => {
    registerRequestOriginSelf('http://127.0.0.1:8000/scripts/extensions/third-party/MyBuild/123.js');
    const frame = '    at patched (http://127.0.0.1:8000/scripts/extensions/third-party/MyBuild/123.js:1:1)';
    expect(originFromStack('Error\n' + frame)).toBeNull();
  });
});
