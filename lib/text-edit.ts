export type EditNode = {
  position?: { start: { offset: number }; end: { offset: number } };
  value?: string;
};

export function replaceNode(
  source: string,
  node: EditNode,
  value: string,
) {
  if (!node.position) return source;
  return (
    source.slice(0, node.position.start.offset) +
    value +
    source.slice(node.position.end.offset)
  );
}
