import { Fragment, type ReactNode } from 'react';
import { t } from '../i18n';

type Key = Parameters<typeof t>[0];

/**
 * A translated sentence with elements in it ("Shopping at <strong>Store</strong>."): the sentence is
 * translated whole, so each language puts the element where it belongs.
 */
export function richT(key: Key, nodes: Record<string, ReactNode>, vars: Record<string, string | number> = {}): ReactNode {
  const marked = Object.fromEntries(Object.keys(nodes).map((k) => [k, `\u0000${k}\u0000`]));
  const parts = t(key, { ...vars, ...marked }).split('\u0000');
  return parts.map((part, i) => <Fragment key={i}>{i % 2 ? nodes[part] : part}</Fragment>);
}
