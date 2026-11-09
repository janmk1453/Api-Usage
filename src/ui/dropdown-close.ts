/**
 * 胶囊下拉的「点选项 → 关闭 → 重绘」统一收口。
 *
 * 历史问题：选项处理器习惯写成
 *   drop.style.display = 'none';
 *   renderStatsView();          // 内部重建整页 + 重画 ECharts
 * 两件事挤在同一个任务里，浏览器必须等整段 JS 跑完才首次绘制，于是下拉的关闭状态一直画不出来，
 * 用户看到的是「点了没反应，等一下才突然消失」。反过来先只写 display 也不够：浮层是 90ms 的
 * 淡出过渡，元素在过渡期间仍占着旧画面。所以这里拆成两步：
 *   1) closeDropdownInstant：临时关掉过渡再把 display 写成 none，让浮层当场消失（不参与淡出）；
 *   2) closeDropdownThenPaint：把重绘推到下一帧之后，先让屏幕把「已经关了」画出来，再付重绘的钱。
 *
 * 只给「选中某一项后要重绘」的路径使用；点外部关闭、按钮互斥关闭继续走 CSS 淡出（见 style.css
 * 「胶囊下拉浮层：开 / 合过渡」的关闭态规则），不要换成瞬时关闭，否则失去淡出手感。
 */

/** 立即把浮层关掉，不参与 CSS 淡出（临时把 transition 置为 none，写完 display 再还原）。 */
export function closeDropdownInstant(drop: HTMLElement | null | undefined): void {
  if (!drop) return;
  const style = drop.style;
  if (style.display === 'none') return;
  const prev = style.transition;
  style.transition = 'none';
  style.display = 'none';
  // 强制一次布局，确保 none 当场生效，之后的还原不会再触发过渡
  void drop.getBoundingClientRect().width;
  if (prev) style.transition = prev;
  else style.removeProperty('transition');
}

export type PaintScheduler = (run: () => void) => void;

/** 下一帧（双 requestAnimationFrame）之后再执行，另带 120ms 兜底（后台标签页 rAF 会暂停）。只执行一次。 */
export function afterNextPaint(run: () => void, schedule?: PaintScheduler): void {
  let done = false;
  const fire = (): void => {
    if (done) return;
    done = true;
    try {
      run();
    } catch (err) {
      console.error('[aus] 下拉关闭后的重绘失败', err);
    }
  };
  const sched = schedule || defaultSchedule;
  try {
    sched(fire);
  } catch {
    setTimeout(fire, 120);
  }
}

function defaultSchedule(run: () => void): void {
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
  if (raf) raf(() => raf(run));
  else setTimeout(run, 0);
  setTimeout(run, 120);
}

/** 瞬时关闭浮层，再把重绘推到下一帧之后。 */
export function closeDropdownThenPaint(
  drop: HTMLElement | null | undefined,
  run: () => void,
  schedule?: PaintScheduler,
): void {
  closeDropdownInstant(drop);
  afterNextPaint(run, schedule);
}
