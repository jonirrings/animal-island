/**
 * 极简 SVG 解析器：只处理图标会用到的语法子集。
 * 支持 XML 声明、注释、自闭合标签、嵌套元素、实体解码。
 */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export const decodeEntities = (value) =>
  value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const codePoint =
        entity[1] === 'x' || entity[1] === 'X'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return Object.hasOwn(ENTITIES, entity) ? ENTITIES[entity] : match;
  });

const ATTRIBUTE_PATTERN = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const parseAttributes = (source) => {
  const attributes = {};
  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const [, name, doubleQuoted, singleQuoted] = match;
    attributes[name] = decodeEntities(doubleQuoted ?? singleQuoted ?? '');
  }
  return attributes;
};

/**
 * 把 SVG 字符串解析成 `{ name, attributes, children }` 树。
 * @param {string} source
 * @returns {{ name: string, attributes: Record<string, string>, children: Array<object> }}
 */
export function parseSvg(source) {
  const root = { name: '#document', attributes: {}, children: [] };
  const stack = [root];
  let index = 0;

  const findTagEnd = (from) => {
    let quote = null;
    for (let i = from; i < source.length; i += 1) {
      const char = source[i];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        return i;
      }
    }
    return -1;
  };

  while (index < source.length) {
    const open = source.indexOf('<', index);
    if (open === -1) break;

    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open);
      index = end === -1 ? source.length : end + 3;
      continue;
    }

    if (source.startsWith('<?', open) || source.startsWith('<!', open)) {
      const end = source.indexOf('>', open);
      index = end === -1 ? source.length : end + 1;
      continue;
    }

    const close = findTagEnd(open);
    if (close === -1) break;

    const body = source.slice(open + 1, close);

    if (body.startsWith('/')) {
      const name = body.slice(1).trim();
      const parent = stack[stack.length - 1];
      if (parent.name !== name) {
        throw new Error(`标签不匹配：期望 </${parent.name}>，实际 </${name}>`);
      }
      stack.pop();
      index = close + 1;
      continue;
    }

    const selfClosing = body.endsWith('/');
    const content = selfClosing ? body.slice(0, -1) : body;
    const nameMatch = content.match(/^([^\s/>]+)/);
    if (!nameMatch) {
      index = close + 1;
      continue;
    }

    const name = nameMatch[1];
    const node = {
      name,
      attributes: parseAttributes(content.slice(name.length)),
      children: [],
    };

    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);

    index = close + 1;
  }

  if (stack.length !== 1) {
    throw new Error(`标签未闭合：<${stack[stack.length - 1].name}>`);
  }

  const svg = root.children.find((child) => child.name === 'svg');
  if (!svg) throw new Error('未找到根 <svg> 元素。');

  return svg;
}
