import {parse as parseEmoji} from '@twemoji/parser';

/**
 * Pinned Twemoji (jdecked/twemoji) asset release. Assets are served as SVGs so
 * they stay crisp at any size and follow the current text colour context.
 */
export const TWEMOJI_VERSION = '15.1.0';
export const TWEMOJI_BASE = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/`;

export type EmojiPart = {type: 'text'; text: string} | {type: 'emoji'; text: string; url: string};

export function twemojiUrl(codepoints: string): string {
  return TWEMOJI_BASE + codepoints + '.svg';
}

/**
 * Split a string into plain-text and emoji parts. Emoji detection, sequence
 * handling (ZWJ, variation selectors, flags) and asset naming come from the
 * official Twemoji parser so results match Twitter's own rendering.
 */
export function splitEmoji(text: string): EmojiPart[] {
  if (!text) return [];
  const entities = parseEmoji(text, {assetType: 'svg', buildUrl: twemojiUrl});
  if (!entities.length) return [{type: 'text', text}];
  const parts: EmojiPart[] = [];
  let last = 0;
  for (const entity of entities) {
    const [start, end] = entity.indices;
    if (start > last) parts.push({type: 'text', text: text.slice(last, start)});
    parts.push({type: 'emoji', text: entity.text, url: entity.url});
    last = end;
  }
  if (last < text.length) parts.push({type: 'text', text: text.slice(last)});
  return parts;
}
