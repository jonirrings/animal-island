import { h, onMounted, ref } from 'vue';
import * as Icons from '@animal-island/vue-icons';

/**
 * 用 Vue 3 运行时真实挂载图标。
 *
 * 等价于 React 版本：按 PascalCase 名从包导出里取函数式组件。
 */
export default {
  props: {
    names: { type: Array, required: true },
    size: { type: Number, default: 48 },
  },
  setup(props) {
    const host = ref(null);
    const started = performance.now();

    onMounted(() => {
      const elapsed = Math.round(performance.now() - started);
      if (host.value) {
        host.value.dataset.mountMs = String(elapsed);
        host.value.dataset.rendered = String(props.names.length);
        host.value.dataset.status = `mounted ${props.names.length} icons in ${elapsed}ms`;
      }
    });

    return () => {
      const children = props.names.map((name) => {
        const Icon = Icons[name];
        if (!Icon) return h('div', { class: 'rt-missing', key: name }, name);
        return h('div', { class: 'rt-cell', key: name, title: name }, [
          h(Icon, { size: props.size }),
          h('span', null, name),
        ]);
      });
      return h('div', { class: 'rt-grid', ref: host }, children);
    };
  },
};
