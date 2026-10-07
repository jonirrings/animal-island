import path from 'node:path';

const HEADER = '// 此文件由 tools/build-icons 生成，请勿手工编辑。';
const SVELTE_HEADER = '<!-- 此文件由 tools/build-icons 生成，请勿手工编辑。 -->';

/**
 * @param {string} name kebab-case 图标名，如 `alert-circle`
 * @returns {string} PascalCase 组件名，如 `AlertCircle`
 */
export const toPascalCase = (name) =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const serializeIconData = ({ name, viewBox, root, node }) =>
  JSON.stringify({ name, viewBox, root, node }, null, 2);

const sharedBody = (icon) => `${serializeIconData(icon)};

const ${icon.componentName} = createIcon(__iconData);

export default ${icon.componentName};
`;

/**
 * React / Vue / Solid 共用的图标模块（纯 TS，无 JSX）。
 * @param {object} icon
 */
export const emitScriptIcon = (icon) => `${HEADER}
import { createIcon } from '../createIcon';
import type { IconData } from '../types';

export const __iconData: IconData = ${sharedBody(icon)}`;

/**
 * Svelte 5 图标组件。
 * @param {object} icon
 */
export const emitSvelteIcon = (icon) => `${SVELTE_HEADER}
<script module lang="ts">
  import type { IconData } from '../types';

  export const __iconData: IconData = ${serializeIconData(icon)};
</script>

<script lang="ts">
  import Icon from '../Icon.svelte';
  import type { IconProps } from '../types';

  let props: IconProps = $props();
</script>

<Icon {...props} icon={__iconData} />
`;

export const emitBarrel = (icons, { svelte = false, prefix = './icons/' } = {}) => `${HEADER}
${icons
  .map(
    (icon) =>
      `export { default as ${icon.componentName} } from '${prefix}${icon.name}${
        svelte ? '.svelte' : ''
      }';`,
  )
  .join('\n')}
`;

export const extensionFor = (framework) => (framework === 'svelte' ? '.svelte' : '.ts');

/**
 * 单测用：把 iconData 还原成 SVG 树，方便和源文件逐节点对比。
 * @param {{ viewBox: string, root: Record<string, string>, node: any[] }} icon
 */
export const iconDataToTree = (icon) => ({
  name: 'svg',
  attributes: { viewBox: icon.viewBox, ...icon.root },
  children: icon.node.map(nodeToTree),
});

const nodeToTree = ([name, attributes, children]) => ({
  name,
  attributes,
  children: (children ?? []).map(nodeToTree),
});

/** 写文件用的相对路径，集中在这里方便改目录结构。 */
export const outputPaths = (outRoot, framework) => {
  const packageDir = path.join(outRoot, framework);
  const sourceDir = path.join(packageDir, 'src');
  const iconDir = path.join(sourceDir, 'icons');
  return {
    packageDir,
    sourceDir,
    iconDir,
    barrel: path.join(iconDir, 'index.ts'),
  };
};
