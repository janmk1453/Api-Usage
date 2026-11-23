/**
 * 历史记录页顶部的「冷库读取失败」告警条
 *
 * 更早的记录只存在 IndexedDB 的单键 cold_history 里；这条读不出来时，
 * 历史页 / 统计 / 导出的全量合并会退化成热区那 MAX_HISTORY 条，用户看到的
 * 是「记录凭空少了一截」。所以失败必须说出来，并给一个能自证的重试入口，
 * 绝不能在 catch 里静默吞掉。
 */
import { esc } from '../utils/date';
import { icon } from './icons';

export const COLD_WARN_HOST_ID = 'aus-history-cold';
export const COLD_WARN_RETRY_ID = 'aus-history-cold-retry';

/** 失败信息的最小形状（来自 store/persistence 的 ColdReadFailure） */
export interface ColdReadFailureLike {
  message?: string;
  at?: number;
}

/**
 * 告警条 HTML（纯函数，便于单测）
 * @param failure 读取失败信息；为空表示当前没有失败，返回空串
 * @param maxHistory 热区上限，用来说明「现在只剩多少条」
 */
export function coldReadWarnHTML(failure: ColdReadFailureLike | null, maxHistory: number): string {
  if (!failure) return '';
  const limit = Number.isFinite(maxHistory) && maxHistory > 0 ? Math.floor(maxHistory) : 0;
  const detail = String(failure.message ?? '').trim();
  const limitText = limit > 0 ? `这里只显示最近 ${limit} 条` : '这里只显示热区的部分记录';
  return (
    '<div class="aus-cold-warn" role="alert">' +
      '<div class="aus-cold-warn-text">' +
        '<span class="aus-cold-warn-title">更早的历史记录没能读出来</span>' +
        `<span class="aus-cold-warn-desc">浏览器存储（IndexedDB）读取失败，${limitText}；更早的记录没有被删除，重试即可再读。</span>` +
        (detail ? `<span class="aus-cold-warn-detail" title="${esc(detail)}">失败原因：${esc(detail)}</span>` : '') +
      '</div>' +
      `<button type="button" class="aus-cold-warn-retry" id="${COLD_WARN_RETRY_ID}">${icon('refresh', 14)}<span>重试</span></button>` +
    '</div>'
  );
}
