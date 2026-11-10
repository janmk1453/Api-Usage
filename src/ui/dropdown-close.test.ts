import { describe, expect, it, vi } from 'vitest';
import { afterNextPaint, closeDropdownInstant, closeDropdownThenPaint } from './dropdown-close';

function makeDrop(display = 'block') {
  const style: any = {
    display,
    transition: '',
    setProperty(key: string, value: string) { style[key] = value; },
    removeProperty(key: string) { delete style[key]; },
  };
  const drop: any = {
    style,
    layoutReads: 0,
    getBoundingClientRect() { drop.layoutReads += 1; return { width: 100 }; },
  };
  return drop;
}

describe('closeDropdownInstant', () => {
  it('瞬时时关闭：关掉过渡 → 写 display:none → 还原过渡', () => {
    const drop = makeDrop();
    closeDropdownInstant(drop);
    expect(drop.style.display).toBe('none');
    // 过渡配置必须还回去，否则浮层下次打开就没有淡入了
    expect(drop.style.transition).toBe(undefined);
    expect(drop.style.transition).not.toBe('none');
    expect(drop.layoutReads).toBe(1);
  });

  it('原有内联过渡配置写回原值', () => {
    const drop = makeDrop();
    drop.style.transition = 'opacity 200ms linear';
    closeDropdownInstant(drop);
    expect(drop.style.transition).toBe('opacity 200ms linear');
  });

  it('已经关闭的浮层不动过渡，避免打断进行中的开合', () => {
    const drop = makeDrop('none');
    drop.style.transition = 'opacity 90ms ease';
    closeDropdownInstant(drop);
    expect(drop.style.transition).toBe('opacity 90ms ease');
    expect(drop.layoutReads).toBe(0);
  });

  it('传 null / undefined 不报错', () => {
    expect(() => closeDropdownInstant(null)).not.toThrow();
    expect(() => closeDropdownInstant(undefined)).not.toThrow();
  });
});

describe('afterNextPaint', () => {
  it('先关闭、后重绘：调度前不执行，调度后才执行', () => {
    const drop = makeDrop();
    const run = vi.fn();
    let fire: (() => void) | null = null;
    closeDropdownThenPaint(drop, run, (cb) => { fire = cb; });
    expect(drop.style.display).toBe('none');
    expect(run).not.toHaveBeenCalled();
    fire!();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rAF 与兜底定时器同时触发也只执行一次', () => {
    const run = vi.fn();
    const cbs: Array<() => void> = [];
    afterNextPaint(run, (cb) => { cbs.push(cb); cbs.push(cb); });
    cbs[0]();
    cbs[1]();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('重绘抛错不往上冒，也不影响后续关闭', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fire: (() => void) | null = null;
    afterNextPaint(() => { throw new Error('boom'); }, (cb) => { fire = cb; });
    expect(() => fire!()).not.toThrow();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('调度器自身抛错时回退到定时器，任务不丢', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    afterNextPaint(run, () => { throw new Error('sched'); });
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(run).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
