/**
 * 极简 JSON Schema 校验器。
 *
 * 只实现本项目两个 schema 用到的 draft 2020-12 子集：
 * type / required / additionalProperties / properties / items /
 * minLength / minItems / uniqueItems / pattern / const / enum /
 * dependentRequired / minimum。
 *
 * 不追求规范完备 —— 够校验 icon.schema.json 与 category.schema.json 即可，
 * 这样 schema 文件是唯一真相源，校验逻辑不必重复描述字段。
 */

const typeOf = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

const matchesType = (value, expected) => {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
};

/**
 * @param {unknown} value 待校验的值
 * @param {object} schema schema 片段
 * @param {string} path 当前路径，用于错误信息
 * @param {string[]} errors 收集错误
 */
export const validateSchema = (value, schema, path = '$', errors = []) => {
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path}: 期望类型 ${types.join('|')}，实际 ${typeOf(value)}`);
      return errors;
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: 期望常量 ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`${path}: 值 ${JSON.stringify(value)} 不在枚举内`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: 长度不足 ${schema.minLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${path}: 值 ${JSON.stringify(value)} 不匹配 ${schema.pattern}`);
    }
  }

  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${path}: 小于最小值 ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: 元素数少于 ${schema.minItems}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) errors.push(`${path}: 存在重复元素 ${key}`);
        seen.add(key);
      }
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => {
        validateSchema(item, schema.items, `${path}[${index}]`, errors);
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${path}: 缺少必填字段 ${key}`);
    }
    for (const key of Object.keys(properties)) {
      if (Object.hasOwn(value, key)) {
        validateSchema(value[key], properties[key], `${path}.${key}`, errors);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          errors.push(`${path}: 不允许的字段 ${key}`);
        }
      }
    }
    for (const [key, dependents] of Object.entries(schema.dependentRequired ?? {})) {
      if (Object.hasOwn(value, key)) {
        for (const dependent of dependents) {
          if (!Object.hasOwn(value, dependent)) {
            errors.push(`${path}: 字段 ${key} 要求同时提供 ${dependent}`);
          }
        }
      }
    }
  }

  return errors;
};

export default validateSchema;
